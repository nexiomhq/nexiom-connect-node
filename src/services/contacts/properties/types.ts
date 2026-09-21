export type ContactPropertyType = "string" | "number" | "date";

export interface CreateContactPropertyParams {
  name: string;
  type: ContactPropertyType;

  /** The API stores fallback values as strings, including numbers and dates. */
  fallbackValue?: string | null;
}

export interface UpdateContactPropertyParams {
  fallbackValue: string | null;
}

/** Filters are applied locally after fetching the complete property collection. */
export interface ListContactPropertiesParams {
  type?: ContactPropertyType;
  search?: string;
}

export interface ContactProperty {
  id: string;
  key: string;
  type: ContactPropertyType;
  fallback_value: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
