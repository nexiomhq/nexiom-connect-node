import { version } from "../../package.json";
import { NexiomError, NexiomValidationError } from "./errors.js";
import type {
  NexiomConnectOptions,
  NexiomResult,
  RequestOptions,
  ResponseMetadata,
} from "./types.js";
import { integer, jsonBody, nonEmpty } from "./validation.js";

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_TIMEOUT = 2_147_483_647;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function retryDelay(headers: Headers, attempt: number): number {
  const value = headers.get("retry-after");

  if (value !== null) {
    const seconds = Number(value);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
    if (Number.isFinite(delay)) {
      return Math.min(MAX_TIMEOUT, Math.max(0, delay));
    }
  }

  return Math.min(8_000, 500 * 2 ** attempt) * (0.75 + Math.random() * 0.25);
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason);
    };

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
    }
  });
}

/** Internal shared HTTP transport. */
export class Client {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #timeout: number;
  readonly #maxRetries: number;

  constructor(options: NexiomConnectOptions) {
    nonEmpty(options?.apiKey, "apiKey");
    if (/[^\x21-\x7e]/.test(options.apiKey)) {
      throw new NexiomValidationError("apiKey must contain printable ASCII without whitespace");
    }

    this.#apiKey = options.apiKey;

    let url: URL;

    try {
      url = new URL(options.baseUrl ?? "https://api-connect.nxiom.com/api");
    } catch {
      throw new NexiomValidationError("baseUrl must be an absolute HTTP(S) URL");
    }

    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new NexiomValidationError(
        "baseUrl must be an HTTP(S) URL without credentials, query, or fragment",
      );
    }

    if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new NexiomValidationError("baseUrl must use HTTPS except on loopback hosts");
    }

    this.#baseUrl = url.href.replace(/\/+$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#timeout = integer(options.timeout ?? 30_000, "timeout", 1, MAX_TIMEOUT);
    this.#maxRetries = integer(options.maxRetries ?? 2, "maxRetries", 0, 10);
  }

  async request<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions = {},
    idempotencyKey?: string,
  ): Promise<NexiomResult<T>> {
    const timeout = integer(options.timeout ?? this.#timeout, "timeout", 1, MAX_TIMEOUT);
    const maxRetries = integer(options.maxRetries ?? this.#maxRetries, "maxRetries", 0, 10);
    const serialized = body === undefined ? undefined : jsonBody(body);

    const headers = new Headers({
      Authorization: `Bearer ${this.#apiKey}`,
      Accept: "application/json",
      "User-Agent": `nexiom-connect-node/${version}`,
    });

    if (serialized !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    if (idempotencyKey !== undefined) {
      headers.set("Idempotency-Key", idempotencyKey);
    }

    const controller = new AbortController();
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);

    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) {
      abort();
    }

    let response: ResponseMetadata = {
      status: null,
      headers: new Headers(),
      requestId: null,
      idempotencyKey: idempotencyKey ?? null,
    };

    const retryable = method === "GET" || idempotencyKey !== undefined;

    try {
      for (let attempt = 0; ; attempt++) {
        response = { ...response, status: null, headers: new Headers(), requestId: null };
        let error: NexiomError;

        try {
          controller.signal.throwIfAborted();

          const raw = await this.#fetch(`${this.#baseUrl}${path}`, {
            method,
            headers,
            signal: controller.signal,
            redirect: "manual",
            ...(serialized === undefined ? {} : { body: serialized }),
          });

          response = {
            ...response,
            status: raw.status,
            headers: new Headers(raw.headers),
            requestId: raw.headers.get("x-request-id") ?? raw.headers.get("x-correlation-id"),
          };

          const text = await raw.text();
          let payload: unknown;

          try {
            payload = text ? JSON.parse(text) : null;
          } catch {
            payload = null;
          }

          const data = record(payload);
          if (typeof data.correlationId === "string") {
            response.requestId = data.correlationId;
          }

          if (raw.ok) {
            if (
              !payload ||
              typeof payload !== "object" ||
              (!("data" in data) && typeof data.success !== "boolean") ||
              ("data" in data && (data.data === null || typeof data.data !== "object"))
            ) {
              return {
                data: null,
                error: new NexiomError(
                  "API returned an empty or invalid JSON response",
                  "protocol",
                  raw.status,
                  null,
                  response.requestId,
                ),
                response,
              };
            }
            // All resource endpoints return { data }, except deletes ({ success }).
            return { data: ("data" in data ? data.data : payload) as T, error: null, response };
          }

          error = new NexiomError(
            typeof data.message === "string"
              ? data.message
              : `Request failed with HTTP ${raw.status}`,
            "api",
            raw.status,
            typeof data.code === "string"
              ? data.code
              : typeof data.error === "string"
                ? data.error
                : null,
            response.requestId,
            data.details ?? null,
          );

          if (!RETRY_STATUSES.has(raw.status)) {
            return { data: null, error, response };
          }
        } catch {
          if (controller.signal.aborted) {
            throw controller.signal.reason;
          }

          // Do not retain third-party fetch errors: they may embed credentials.

          error = new NexiomError("Unable to complete the API request", "network");
        }

        if (!retryable || attempt >= maxRetries) {
          return { data: null, error, response };
        }

        await pause(retryDelay(response.headers, attempt), controller.signal);
      }
    } catch {
      return {
        data: null,
        error: new NexiomError(
          timedOut ? "Request timed out" : "Request aborted",
          timedOut ? "timeout" : "aborted",
          response.status,
          null,
          response.requestId,
        ),
        response,
      };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }
}
