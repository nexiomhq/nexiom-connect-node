/** Email addresses must be bare addresses. Use fromName for the sender display name. */
export interface EmailAddresses {
  from: string;
  fromName?: string | undefined;
  to: string | string[];
  cc?: string | string[] | undefined;
  bcc?: string | string[] | undefined;
  replyTo?: string | undefined;
  metadata?: Record<string, unknown> | undefined;

  /** Send later: a Date or an ISO 8601 timestamp with an offset, at most 30 days ahead. */
  scheduledAt?: Date | string | undefined;
}

export type SendEmailParams = EmailAddresses &
  (
    | {
        templateId: string;
        templateVariables?: Record<string, string | number | boolean> | undefined;
        subject?: string | undefined;
        html?: string | undefined;
        text?: string | undefined;
      }
    | ({ templateId?: never; templateVariables?: never; subject: string } & (
        | { html: string; text?: string | undefined }
        | { html?: string | undefined; text: string }
      ))
  );

/** Acceptance means queued or scheduled, not delivered. */
export interface SendEmailResponse {
  totalQueued: number;
  messageId: string;
  deliveryIds: string[];

  /** The scheduled send time, or null for an immediate send. */
  scheduledAt: string | null;
}

export interface RescheduleEmailParams {
  /** A Date or an ISO 8601 timestamp with an offset. */
  scheduledAt: Date | string;
}

export interface CancelEmailResponse {
  messageId: string;
  status: "canceled";
  canceledAt: string;
  deliveryIds: string[];
}

export interface RescheduleEmailResponse {
  messageId: string;
  status: "scheduled";
  scheduledAt: string;
  deliveryIds: string[];
}

export type EmailStatus =
  | "scheduled"
  | "canceled"
  | "queued"
  | "sending"
  | "accepted"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed";

export type EmailSource = "api" | "smtp" | "broadcast";

export type EmailDeliveryReason =
  | "unsubscribed"
  | "complaint"
  | "hard_bounce"
  | "invalid"
  | "manual"
  | "recipient_blocked"
  | "envelope_recipient_blocked"
  | "temporary_failure"
  | "sending_paused"
  | "review_required"
  | "review_expired"
  | "sending_delayed"
  | "delivery_uncertain"
  | "message_blocked"
  | "sending_failed"
  | "quota_exceeded"
  | "canceled";

export interface ListEmailsParams {
  /** 1 to 100. Default: 50. */
  limit?: number | undefined;

  /** The previous page's nextCursor. */
  cursor?: string | undefined;
  status?: EmailStatus | undefined;
  source?: EmailSource | undefined;
  recipient?: string | undefined;
  search?: string | undefined;
  contactId?: string | undefined;
  templateId?: string | undefined;
  startDate?: Date | string | undefined;
  endDate?: Date | string | undefined;
}

/** One recipient delivery. Response fields retain the API's snake_case names; dates are ISO strings. */
export interface EmailListItem {
  id: string;
  created_at: string;
  recipient: string;
  subject: string;
  status: EmailStatus;
  scheduled_at: string | null;
}

export interface ListEmailsResponse {
  items: EmailListItem[];

  /** Null when the API does not count the matching deliveries. */
  total: number | null;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface Email extends EmailListItem {
  message_id: string;
  recipient_name: string | null;
  from_address: string;
  from_name: string | null;
  sending_domain: string | null;
  source: EmailSource;
  delivery_reason: EmailDeliveryReason | null;
  status_message: string | null;
  canceled_at: string | null;
  html_content: string | null;
  text_content: string | null;
  accepted_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  failed_at: string | null;
  bounce_type: string | null;
  first_opened_at: string | null;
  first_clicked_at: string | null;
  open_count: number;
  click_count: number;
  domain: { id: string; domain: string } | null;
  contact: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  template: { id: string; name: string } | null;
}
