export type EmailSuppressionReason =
  | "hard_bounce"
  | "complaint"
  | "unsubscribed"
  | "invalid"
  | "manual"
  | "temporary_failure";

export interface ListEmailSuppressionsParams {
  /** Part of an email address, 1 to 255 characters. */
  search?: string | undefined;

  /** 1 to 100. Default: 50. */
  limit?: number | undefined;

  /** The previous page's nextCursor. */
  cursor?: string | undefined;
}

export interface EmailSuppression {
  email: string;

  /** When an address has several reasons, the one that applies to your sends. */
  reason: EmailSuppressionReason;
}

export interface ListEmailSuppressionsResponse {
  items: EmailSuppression[];
  nextCursor: string | null;
  hasMore: boolean;
}
