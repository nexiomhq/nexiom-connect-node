export type ContactEmailStatus = "subscribed" | "unsubscribed";

export type ContactPropertyValue = string | number | null;

export interface CreateContactParams {
  email: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  properties?: Record<string, ContactPropertyValue>;
}

/** The current API requires email on updates. */
export interface UpdateContactParams extends Omit<CreateContactParams, "userId"> {
  userId?: string | null;
  emailStatus?: ContactEmailStatus;
}

export interface ListContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  emailStatus?: ContactEmailStatus;
  segmentId?: string;
  listId?: string;
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
