import type { Client } from "../../core/client.js";
import { NexiomValidationError } from "../../core/errors.js";
import type { RequestOptions, SendWhatsAppMessageOptions } from "../../core/types.js";
import { nonEmpty, resourceId } from "../../core/validation.js";
import type {
  SendWhatsAppMessageParams,
  WhatsAppMessage,
  WhatsAppMessageDetails,
  WhatsAppTemplateVariables,
} from "./types.js";

const PATH = "/v1/messaging/whatsapp/messages";
const E164 = /^\+[1-9]\d{6,14}$/;

function phoneNumber(value: unknown, name: string): string {
  if (typeof value !== "string" || !E164.test(value.trim())) {
    throw new NexiomValidationError(`${name} must be an E.164 phone number, such as +213555123456`);
  }

  return value.trim();
}

function variableValues(value: unknown, name: string): WhatsAppTemplateVariables | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new NexiomValidationError(`${name} must be an object of variable values`);
  }

  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_]{1,64}$/.test(key)) {
      throw new NexiomValidationError(`${name} keys must be variable numbers or names`);
    }
    if (typeof item !== "string" || item.length > 1024) {
      throw new NexiomValidationError(`${name}.${key} must be a string of at most 1024 characters`);
    }
  }

  return value as WhatsAppTemplateVariables;
}

export class WhatsAppMessages {
  constructor(private readonly client: Client) {}

  /**
   * Sends an approved template from a connected number. Retries reuse the same idempotency key,
   * so a message is sent at most once.
   */
  send(params: SendWhatsAppMessageParams, options: SendWhatsAppMessageOptions = {}) {
    const sender = phoneNumber(params?.sender, "sender");
    const to = phoneNumber(params.to, "to");
    nonEmpty(params.templateId, "templateId");

    if (
      params.variables !== undefined &&
      (typeof params.variables !== "object" ||
        params.variables === null ||
        Array.isArray(params.variables))
    ) {
      throw new NexiomValidationError("variables must be an object with header and body values");
    }

    const header = variableValues(params.variables?.header, "variables.header");
    const body = variableValues(params.variables?.body, "variables.body");

    const key = options.idempotencyKey ?? globalThis.crypto.randomUUID();
    if (!/^[\x21-\x7e]{1,200}$/.test(key)) {
      throw new NexiomValidationError(
        "idempotencyKey must be 1 to 200 printable ASCII characters without whitespace",
      );
    }

    // Explicit allowlist prevents accidental tenant context or unsupported fields on the wire.
    return this.client.request<WhatsAppMessage>(
      "POST",
      PATH,
      {
        sender,
        to,
        templateId: params.templateId,
        variables: params.variables === undefined ? undefined : { header, body },
      },
      options,
      { idempotencyKey: key },
    );
  }

  /** Fetches one message with its current status and the content the recipient received. */
  get(messageId: string, options?: RequestOptions) {
    return this.client.request<WhatsAppMessageDetails>(
      "GET",
      `${PATH}/${resourceId(messageId)}`,
      undefined,
      options,
    );
  }
}
