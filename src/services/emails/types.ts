/** Email addresses must be bare addresses. Use fromName for the sender display name. */
export interface EmailAddresses {
  from: string;
  fromName?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export type SendEmailParams = EmailAddresses &
  (
    | {
        templateId: string;
        templateVariables?: Record<string, string | number | boolean>;
        subject?: string;
        html?: string;
        text?: string;
      }
    | ({ templateId?: never; templateVariables?: never; subject: string } & (
        | { html: string; text?: string }
        | { html?: string; text: string }
      ))
  );

/** Acceptance means queued, not delivered. */
export interface SendEmailResponse {
  totalQueued: number;
  messageId: string;
  deliveryIds: string[];
}
