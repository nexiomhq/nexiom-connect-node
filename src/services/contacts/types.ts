export type ContactEmailStatus = "subscribed" | "unsubscribed";

export type ContactPropertyValue = string | number | null;

export interface CreateContactParams {
  email: string;
  userId?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  phoneNumber?: string | undefined;
  properties?: Record<string, ContactPropertyValue> | undefined;
}

/** The current API requires email on updates. */
export interface UpdateContactParams extends Omit<CreateContactParams, "userId"> {
  userId?: string | null | undefined;
  emailStatus?: ContactEmailStatus | undefined;
}

export interface ListContactsParams {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  emailStatus?: ContactEmailStatus | undefined;
  segmentId?: string | undefined;
  listId?: string | undefined;
}

/** Response fields retain the API's snake_case names; dates are ISO strings. */
export interface ContactListItem {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  email_status: ContactEmailStatus;
  created_at: string;
}

export interface Contact extends ContactListItem {
  user_id: string | null;
  updated_at: string;
  deleted_at: string | null;
  source: string | null;
  last_emailed_at: string | null;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  total_emails_sent: number;
  total_emails_opened: number;
  total_emails_clicked: number;
}

export interface ContactActivity {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  channel: string | null;
  resource_type: string | null;
  resource_id: string | null;
}

export interface ContactDetails extends Contact {
  organization: string;
  properties: Record<string, ContactPropertyValue> | null;
  email_delivery_block_reason: string | null;
  unsubscribed: boolean;
  activities: ContactActivity[];
}

export interface ListContactsResponse {
  items: ContactListItem[];
  total: number;
  page: number;
  limit: number;
}
