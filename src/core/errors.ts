export type ErrorKind = "api" | "network" | "timeout" | "aborted" | "protocol";

/** An API or transport failure. Does not retain request headers or raw transport exceptions. */
export class NexiomError extends Error {
  readonly name = "NexiomError";

  constructor(
    message: string,
    readonly kind: ErrorKind,
    readonly status: number | null = null,
    readonly code: string | null = null,
    readonly requestId: string | null = null,
    readonly details: unknown = null,
  ) {
    super(message);
  }
}

/** Invalid SDK configuration or arguments; thrown before making a request. */
export class NexiomValidationError extends Error {
  readonly name = "NexiomValidationError";
}

/** Why `webhooks.constructEventAsync` refused a request. */
export type WebhookVerificationReason =
  | "missing_headers"
  | "invalid_timestamp"
  | "timestamp_out_of_tolerance"
  | "invalid_signature"
  | "invalid_payload";

/** A webhook request that is not a genuine, current Nexiom Connect event. Respond with 400. */
export class NexiomWebhookVerificationError extends Error {
  readonly name = "NexiomWebhookVerificationError";

  constructor(
    message: string,
    readonly reason: WebhookVerificationReason,
  ) {
    super(message);
  }
}
