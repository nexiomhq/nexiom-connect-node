import type { Client } from "../../core/client.js";
import { NexiomError } from "../../core/errors.js";
import type { NexiomResult, RequestOptions } from "../../core/types.js";
import {
  integer,
  oneOf,
  optionalString,
  queryString,
  resourceId,
} from "../../core/validation.js";
import type {
  ListTemplatesParams,
  ListTemplatesResponse,
  ListTemplateVersionsParams,
  Template,
  TemplateVariable,
  TemplateVersion,
} from "./types.js";

const PATH = "/v1/emails/templates";

/** The API bounds page offsets; narrow larger collections with filters or search. */
const MAX_PAGE = 10_000;

const STATUSES: readonly string[] = ["draft", "published", "changes_in_draft", "archived"];

const ORIGINS: readonly string[] = ["custom", "prebuilt"];

/** Endpoints that return a collection under `data` must return an array. */
async function collection<T>(request: Promise<NexiomResult<T[]>>): Promise<NexiomResult<T[]>> {
  const result = await request;

  if (result.error || Array.isArray(result.data)) {
    return result;
  }

  return {
    data: null,
    error: new NexiomError(
      "API returned an invalid collection",
      "protocol",
      result.response.status,
      null,
      result.response.requestId,
    ),
    response: result.response,
  };
}

export class Templates {
  constructor(private readonly client: Client) {}

  /** Lists templates, most recently updated first. */
  list(params: ListTemplatesParams = {}, options?: RequestOptions) {
    if (params.page !== undefined) {
      integer(params.page, "page", 1, MAX_PAGE);
    }
    if (params.limit !== undefined) {
      integer(params.limit, "limit", 1, 100);
    }

    oneOf(params.status, "status", STATUSES);
    oneOf(params.origin, "origin", ORIGINS);
    optionalString(params.search, "search");
    optionalString(params.category, "category");

    const { page, limit, status, search, origin, category } = params;
    const query = queryString({ page, limit, status, search, origin, category });

    return this.client.request<ListTemplatesResponse>("GET", `${PATH}${query}`, undefined, options);
  }

  /** Fetches a template with its draft and published versions. */
  get(templateId: string, options?: RequestOptions) {
    return this.client.request<Template>(
      "GET",
      `${PATH}/${resourceId(templateId)}`,
      undefined,
      options,
    );
  }

  /** Lists the variables of the draft when one exists, otherwise of the published version. */
  variables(templateId: string, options?: RequestOptions): Promise<NexiomResult<TemplateVariable[]>> {
    const path = `${PATH}/${resourceId(templateId)}/variables`;

    return collection(this.client.request<TemplateVariable[]>("GET", path, undefined, options));
  }

  /** Lists versions, newest first. Pass the last version_number as beforeVersion for older ones. */
  versions(
    templateId: string,
    params: ListTemplateVersionsParams = {},
    options?: RequestOptions,
  ): Promise<NexiomResult<TemplateVersion[]>> {
    const path = `${PATH}/${resourceId(templateId)}/versions`;

    if (params.limit !== undefined) {
      integer(params.limit, "limit", 1, 100);
    }
    if (params.beforeVersion !== undefined) {
      integer(params.beforeVersion, "beforeVersion", 1, Number.MAX_SAFE_INTEGER);
    }

    const { limit, beforeVersion } = params;
    const query = queryString({ limit, beforeVersion });

    return collection(
      this.client.request<TemplateVersion[]>("GET", `${path}${query}`, undefined, options),
    );
  }
}
