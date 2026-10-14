/** Every webhook delivery has this envelope; `data` depends on `type`. */
export interface WebhookEventEnvelope<Type extends string, Data> {
  /** Event ID. Retries and replays carry the same ID: deduplicate on it. */
  id: string;
  type: Type;
  schema_version: number;
  data: Data;
  /** ISO 8601 time the event was created. */
  created_at: string;
}

export interface EmailEventData {
  /** Recipient delivery ID. */
  id: string;
  /** Message ID shared by the deliveries of one send. */
  message_id: string;
  recipient: string;
  occurred_at: string;
}

export interface EmailScheduledEventData extends EmailEventData {
  /** The current send time of the delivery. */
  scheduled_at: string;
}

export interface ContactEventData {
  id: string;
  email: string | null;
  status: "subscribed" | "unsubscribed";
  first_name: string | null;
  last_name: string | null;
}

export interface WhatsAppMessageEventData {
  /** WhatsApp message ID (`msg_…`), as returned by `whatsapp.messages.send`. */
  id: string;
  /** The sending number, in E.164. */
  sender: string;
  /** The recipient, in E.164. */
  recipient: string;
  template: { id: string; name: string; language: string } | null;
  /** The time WhatsApp reported for this status. */
  occurred_at: string;
}

export interface WhatsAppMessageFailedEventData extends WhatsAppMessageEventData {
  /** `meta_` and WhatsApp's error code, such as `meta_131026`, or `meta_error`. */
  failure_code: string;
  failure_reason: string | null;
}

export type EmailEventType =
  | "email.scheduled"
  | "email.canceled"
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.failed"
  | "email.opened"
  | "email.clicked";

export type ContactEventType =
  | "contact.created"
  | "contact.updated"
  | "contact.deleted"
  | "contact.unsubscribed";

export type WhatsAppEventType =
  | "whatsapp.message.sent"
  | "whatsapp.message.delivered"
  | "whatsapp.message.read"
  | "whatsapp.message.failed";

export type WebhookEventType = EmailEventType | ContactEventType | WhatsAppEventType;

/**
 * A verified webhook event. Checking `type` narrows `data`. Event types added after this SDK
 * version are still verified and returned at runtime: handle them in a default branch.
 */
export type WebhookEvent =
  | WebhookEventEnvelope<Exclude<EmailEventType, "email.scheduled">, EmailEventData>
  | WebhookEventEnvelope<"email.scheduled", EmailScheduledEventData>
  | WebhookEventEnvelope<ContactEventType, ContactEventData>
  | WebhookEventEnvelope<Exclude<WhatsAppEventType, "whatsapp.message.failed">, WhatsAppMessageEventData>
  | WebhookEventEnvelope<"whatsapp.message.failed", WhatsAppMessageFailedEventData>;

/** The raw request body, exactly as received: a string, Buffer, or other Uint8Array. */
export type WebhookPayload = string | Uint8Array;

/** Request headers: Fetch API `Headers`, Node's `IncomingHttpHeaders`, or a plain object. */
export type WebhookHeaders =
  | Headers
  | Readonly<Record<string, string | readonly string[] | undefined | null>>;

export interface ConstructEventOptions {
  /** Allowed difference between the signature time and now, in seconds. Default: 300. */
  tolerance?: number | undefined;
}
