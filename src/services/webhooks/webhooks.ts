import { NexiomValidationError, NexiomWebhookVerificationError } from "../../core/errors.js";
import { integer, nonEmpty } from "../../core/validation.js";
import type {
  ConstructEventOptions,
  WebhookEvent,
  WebhookHeaders,
  WebhookPayload,
} from "./types.js";

const TIMESTAMP_HEADER = "x-nexiom-timestamp";
const SIGNATURE_HEADER = "x-nexiom-signature";
const DEFAULT_TOLERANCE = 300;

function headerValue(headers: WebhookHeaders, name: string): string | null {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name);
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name) {
      continue;
    }

    const first = Array.isArray(value) ? value[0] : value;

    return typeof first === "string" ? first : null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Bytes of a hexadecimal signature, or `null` when it is not 64 hexadecimal characters. */
function signatureBytes(signature: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]{64}$/i.test(signature)) {
    return null;
  }

  const bytes = new Uint8Array(32);

  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(signature.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

/** The signed content: the timestamp, a period, and the exact body bytes. */
function signedContent(timestamp: string, body: Uint8Array): Uint8Array<ArrayBuffer> {
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const content = new Uint8Array(prefix.length + body.length);
  content.set(prefix);
  content.set(body, prefix.length);

  return content;
}

function fail(reason: NexiomWebhookVerificationError["reason"], message: string): never {
  throw new NexiomWebhookVerificationError(message, reason);
}

/** Verifies webhook requests with the runtime's Web Crypto API. Makes no network request. */
export class Webhooks {
  /**
   * Checks a webhook request's signature and timestamp, then resolves to its event. Pass the
   * raw body exactly as received, the request headers, and the endpoint's signing secret
   * (`whsec_…`). Rejects with `NexiomWebhookVerificationError` when the request is not genuine
   * or not current.
   */
  async constructEventAsync(
    payload: WebhookPayload,
    headers: WebhookHeaders,
    secret: string,
    options: ConstructEventOptions = {},
  ): Promise<WebhookEvent> {
    if (typeof payload !== "string" && !(payload instanceof Uint8Array)) {
      throw new NexiomValidationError(
        "payload must be the raw request body as a string or Buffer, not parsed JSON",
      );
    }
    if (!isRecord(headers)) {
      throw new NexiomValidationError("headers must be the request headers");
    }
    nonEmpty(secret, "secret");
    const tolerance = integer(
      options.tolerance ?? DEFAULT_TOLERANCE,
      "tolerance",
      1,
      Number.MAX_SAFE_INTEGER,
    );

    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      throw new NexiomValidationError("Webhook verification needs the Web Crypto API");
    }

    const timestamp = headerValue(headers, TIMESTAMP_HEADER)?.trim();
    const signature = headerValue(headers, SIGNATURE_HEADER)?.trim();

    if (!timestamp || !signature) {
      fail("missing_headers", `Missing ${TIMESTAMP_HEADER} or ${SIGNATURE_HEADER} header`);
    }

    const seconds = Number(timestamp);
    if (!/^\d+$/.test(timestamp) || !Number.isSafeInteger(seconds)) {
      fail("invalid_timestamp", `${TIMESTAMP_HEADER} must be a Unix time in seconds`);
    }

    if (Math.abs(Math.floor(Date.now() / 1000) - seconds) > tolerance) {
      fail("timestamp_out_of_tolerance", "The webhook timestamp is outside the allowed tolerance");
    }

    const body = typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
    const received = signatureBytes(signature);

    // HMAC-SHA256 and its constant-time comparison are done by the runtime's Web Crypto.
    const key = await subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid =
      received !== null &&
      (await subtle.verify("HMAC", key, received, signedContent(timestamp, body)));

    if (!valid) {
      fail("invalid_signature", "The webhook signature does not match the payload and secret");
    }

    let event: unknown;

    try {
      event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
    } catch {
      fail("invalid_payload", "The webhook payload is not valid JSON");
    }

    if (
      !isRecord(event) ||
      typeof event.id !== "string" ||
      typeof event.type !== "string" ||
      typeof event.schema_version !== "number" ||
      !isRecord(event.data) ||
      typeof event.created_at !== "string"
    ) {
      fail("invalid_payload", "The webhook payload is not an event envelope");
    }

    return event as unknown as WebhookEvent;
  }
}
