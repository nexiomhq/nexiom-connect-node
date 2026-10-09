import type { Client } from "../../core/client.js";
import { NexiomValidationError } from "../../core/errors.js";
import type { RequestOptions, SendEmailOptions } from "../../core/types.js";
import { integer, nonEmpty, queryString, resourceId, timestamp } from "../../core/validation.js";
import type {
  CancelEmailResponse,
  Email,
  ListEmailsParams,
  ListEmailsResponse,
  RescheduleEmailParams,
  RescheduleEmailResponse,
  SendEmailParams,
  SendEmailResponse,
} from "./types.js";

const PATH = "/v1/emails";

export class Emails {
  constructor(private readonly client: Client) {}

  send(params: SendEmailParams, options: SendEmailOptions = {}) {
    nonEmpty(params?.from, "from");

    for (const [name, value] of Object.entries({ to: params.to, cc: params.cc, bcc: params.bcc })) {
      if (value === undefined && name !== "to") {
        continue;
      }

      const addresses = Array.isArray(value) ? value : [value];
      if (addresses.length < 1 || addresses.length > 100) {
        throw new NexiomValidationError(`${name} must contain 1 to 100 addresses`);
      }

      for (const address of addresses) {
        nonEmpty(address, name);
      }
    }

    if (!params.templateId) {
      nonEmpty(params.subject, "subject");
      if (!params.html?.trim() && !params.text?.trim()) {
        throw new NexiomValidationError("html, text, or templateId is required");
      }
    }

    if (Array.isArray(params.to) && params.to.length > 1 && (params.cc || params.bcc)) {
      throw new NexiomValidationError("CC and BCC require one primary recipient");
    }

    const scheduledAt =
      params.scheduledAt === undefined ? undefined : timestamp(params.scheduledAt, "scheduledAt");

    const key = options.idempotencyKey ?? globalThis.crypto.randomUUID();
    if (!/^[\x21-\x7e]{1,128}$/.test(key)) {
      throw new NexiomValidationError(
        "idempotencyKey must be 1 to 128 printable ASCII characters without whitespace",
      );
    }

    // Explicit allowlist prevents accidental tenant context or unsupported fields on the wire.
    const {
      from,
      fromName,
      to,
      cc,
      bcc,
      replyTo,
      subject,
      html,
      text,
      templateId,
      templateVariables,
      metadata,
    } = params;

    return this.client.request<SendEmailResponse>(
      "POST",
      `${PATH}/send`,
      {
        from,
        fromName,
        to,
        cc,
        bcc,
        replyTo,
        subject,
        html,
        text,
        templateId,
        templateVariables,
        metadata,
        scheduledAt,
      },
      options,
      { idempotencyKey: key },
    );
  }

  /** Cancels every scheduled delivery of a message. Canceling twice returns the same result. */
  cancel(messageId: string, options?: RequestOptions) {
    return this.client.request<CancelEmailResponse>(
      "POST",
      `${PATH}/messages/${resourceId(messageId)}/cancel`,
      undefined,
      options,
      { retryable: true },
    );
  }

  /** Moves every scheduled delivery of a message to a new send time. */
  reschedule(messageId: string, params: RescheduleEmailParams, options?: RequestOptions) {
    const path = `${PATH}/messages/${resourceId(messageId)}`;
    const scheduledAt = timestamp(params?.scheduledAt, "scheduledAt");

    return this.client.request<RescheduleEmailResponse>("PATCH", path, { scheduledAt }, options);
  }

  /** Lists recipient deliveries, newest first. Pass nextCursor as cursor for the next page. */
  list(params: ListEmailsParams = {}, options?: RequestOptions) {
    if (params.limit !== undefined) {
      integer(params.limit, "limit", 1, 100);
    }
    if (params.cursor !== undefined && params.cursor.length > 1024) {
      throw new NexiomValidationError("cursor must contain at most 1024 characters");
    }

    const { limit, cursor, status, source, recipient, search, contactId, templateId } = params;

    const query = queryString({
      limit,
      cursor,
      status,
      source,
      recipient,
      search,
      contactId,
      templateId,
      startDate:
        params.startDate === undefined ? undefined : timestamp(params.startDate, "startDate"),
      endDate: params.endDate === undefined ? undefined : timestamp(params.endDate, "endDate"),
    });

    return this.client.request<ListEmailsResponse>("GET", `${PATH}/logs${query}`, undefined, options);
  }

  /** Fetches one recipient delivery by delivery ID (not message ID). */
  get(deliveryId: string, options?: RequestOptions) {
    return this.client.request<Email>(
      "GET",
      `${PATH}/logs/${resourceId(deliveryId)}`,
      undefined,
      options,
      { envelope: "none" },
    );
  }
}
