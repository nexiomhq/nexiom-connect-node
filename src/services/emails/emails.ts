import type { Client } from "../../core/client.js";
import { NexiomValidationError } from "../../core/errors.js";
import type { SendEmailOptions } from "../../core/types.js";
import { nonEmpty } from "../../core/validation.js";
import type { SendEmailParams, SendEmailResponse } from "./types.js";

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
      "/v1/emails/send",
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
      },
      options,
      key,
    );
  }
}
