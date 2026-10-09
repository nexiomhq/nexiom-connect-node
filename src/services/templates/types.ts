/** Template list filter: `changes_in_draft` means a published template with an unpublished draft. */
export type TemplateListStatus = "draft" | "published" | "changes_in_draft" | "archived";

export type TemplateOrigin = "custom" | "prebuilt";

/** `draft` is being edited, `published` is used by sends, and `saved` is an earlier version. */
export type TemplateVersionStatus = "draft" | "published" | "saved";

export type TemplateVariableType = "string" | "number";

export interface ListTemplatesParams {
  /** 1 to 10,000. Default: 1. */
  page?: number | undefined;

  /** 1 to 100. Default: 50. */
  limit?: number | undefined;
  status?: TemplateListStatus | undefined;

  /** Matches the name, alias, or description. */
  search?: string | undefined;
  origin?: TemplateOrigin | undefined;

  /** Exact category. */
  category?: string | undefined;
}

export interface ListTemplateVersionsParams {
  /** 1 to 100. Default: 50. */
  limit?: number | undefined;

  /** Return only versions numbered below this one: the last version_number of the previous page. */
  beforeVersion?: number | undefined;
}

/** Response fields retain the API's snake_case names; dates are ISO strings. */
export interface TemplateVariable {
  id: string;
  key: string;
  type: TemplateVariableType;
  required: boolean;
  fallback_value: string | number | null;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  status: TemplateVersionStatus;
  subject: string;
  preview_text: string | null;
  from_name: string | null;
  from_address: string | null;
  reply_to: string | null;

  /** The dashboard editor's document; build on html and text instead. */
  content: Record<string, unknown>;
  html: string;
  text: string | null;
  thumbnail_url: string | null;
  editor_revision: number;
  created_by_customer_id: string | null;
  published_by_customer_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  variables: TemplateVariable[];
}

export interface Template {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  alias: string;
  description: string | null;
  category: string | null;
  origin: TemplateOrigin;
  locale: string;
  draft_version_id: string | null;
  published_version_id: string | null;
  archived_at: string | null;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  draft_version: TemplateVersion | null;

  /** The version sends use; its variables are exactly what a send needs. */
  published_version: TemplateVersion | null;
}

export interface ListTemplatesResponse {
  items: Template[];
  total: number;
  page: number;
  limit: number;
}
