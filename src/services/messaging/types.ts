/** Messaging channels. New channels are added to this union. */
export type MessageChannel = "whatsapp";

/** Values for a template's variables, keyed by variable number (`"1"`) or name (`"first_name"`). */
export type WhatsAppTemplateVariables = Record<string, string>;

/** An approved WhatsApp template and the values of its variables. */
export interface WhatsAppTemplateParams {
  /** The template's ID (`wat_…`), from the sender's WhatsApp Business Account. */
  id: string;
  /** Every header and body variable of the template; omit for a template without variables. */
  variables?:
    | {
        header?: WhatsAppTemplateVariables | undefined;
        body?: WhatsAppTemplateVariables | undefined;
      }
    | undefined;
}

/** A WhatsApp template message from a connected number. */
export interface SendWhatsAppMessageParams {
  channel: "whatsapp";
  /** The connected WhatsApp number to send from, in E.164, for example `+213555000111`. */
  from: string;
  /** The recipient, in E.164, for example `+213555123456`. */
  to: string;
  template: WhatsAppTemplateParams;
}

/** A message on any channel; `channel` selects the fields. */
export type SendMessageParams = SendWhatsAppMessageParams;

/**
 * `accepted` means WhatsApp accepted the message, not that it was delivered. `uncertain` means
 * WhatsApp did not confirm it; it is never resent automatically.
 */
export type WhatsAppMessageStatus =
  | "sending"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "uncertain";

export type WhatsAppTemplateCategory = "marketing" | "utility" | "authentication";

export interface WhatsAppMessage {
  /** Message ID (`msg_…`). */
  id: string;
  channel: "whatsapp";
  status: WhatsAppMessageStatus;
  /** The sending number, in E.164. */
  sender: string;
  /** The number's display name approved by WhatsApp, when there is one. */
  sender_name: string | null;
  recipient: string;
  category: WhatsAppTemplateCategory | null;
  template: { id: string; name: string; language: string; version: number } | null;
  /** Counts toward the plan's included messages, or is paid from the wallet beyond them. */
  is_billable: boolean;
  /** What Nexiom Connect charged, as a decimal string such as `"0.1000"`. Excludes Meta's fees. */
  cost: string;
  /** ISO 4217 currency of `cost`. */
  cost_currency: string;
  /** For a failed message: `meta_` and WhatsApp's error code, or `meta_error`. */
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string;
  accepted_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
}

/** Template text (`variable: null`), or a variable with the value it was sent with. */
export interface WhatsAppContentSegment {
  text: string | null;
  variable: string | null;
}

export interface WhatsAppMessageContent {
  header: WhatsAppContentSegment[] | null;
  body: WhatsAppContentSegment[] | null;
  footer: string | null;
  /** Button labels, in order. */
  buttons: string[];
}

/** A message with the content the recipient received. */
export interface WhatsAppMessageDetails extends WhatsAppMessage {
  content: WhatsAppMessageContent | null;
}

/** A message on any channel; check `channel` to read its channel's fields. */
export type Message = WhatsAppMessage;

/** A message with its content, on any channel. */
export type MessageDetails = WhatsAppMessageDetails;
