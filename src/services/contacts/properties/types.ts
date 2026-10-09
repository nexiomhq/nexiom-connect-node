export type ContactPropertyType = "string" | "number" | "date";

export interface CreateContactPropertyParams {
  name: string;
  type: ContactPropertyType;

  /** The API stores fallback values as strings, including numbers and dates. */
  fallbackValue?: string | null | undefined;
}

/** Provide at least one field. A type can change only while no contact has a value for it. */
export interface UpdateContactPropertyParams {
  name?: string | undefined;
  type?: ContactPropertyType | undefined;
  fallbackValue?: string | null | undefined;
}

/** Filters are applied locally after fetching the complete property collection. */
export interface ListContactPropertiesParams {
  type?: ContactPropertyType | undefined;
  search?: string | undefined;
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
