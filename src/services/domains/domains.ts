import type { Client } from "../../core/client.js";
import { NexiomValidationError } from "../../core/errors.js";
import type { DeleteResponse, RequestOptions } from "../../core/types.js";
import {
  integer,
  nonEmpty,
  oneOf,
  optionalString,
  queryString,
  resourceId,
} from "../../core/validation.js";
import type { CreateDomainParams, Domain, ListDomainsParams, ListDomainsResponse } from "./types.js";

const PATH = "/v1/emails/domains";

/** The API bounds page offsets; narrow larger collections with filters or search. */
const MAX_PAGE = 10_000;

const STATUSES: readonly string[] = ["pending", "verified", "failed"];

export class Domains {
  constructor(private readonly client: Client) {}

  /** Adds a sending subdomain. Publish the returned DNS records, then call verify. */
  create(params: CreateDomainParams, options?: RequestOptions) {
    nonEmpty(params?.domain, "domain");

    if (params.openTracking !== undefined && typeof params.openTracking !== "boolean") {
      throw new NexiomValidationError("openTracking must be a boolean");
    }

    const { domain, openTracking } = params;

    return this.client.request<Domain>("POST", PATH, { domain, openTracking }, options);
  }

  list(params: ListDomainsParams = {}, options?: RequestOptions) {
    if (params.page !== undefined) {
      integer(params.page, "page", 1, MAX_PAGE);
    }
    if (params.limit !== undefined) {
      integer(params.limit, "limit", 1, 100);
    }

    oneOf(params.status, "status", STATUSES);
    optionalString(params.search, "search");

    const { page, limit, status, search } = params;
    const query = queryString({ page, limit, status, search });

    return this.client.request<ListDomainsResponse>("GET", `${PATH}${query}`, undefined, options);
  }

  get(domainId: string, options?: RequestOptions) {
    return this.client.request<Domain>(
      "GET",
      `${PATH}/${resourceId(domainId)}`,
      undefined,
      options,
    );
  }

  /** Checks the published DNS records. Inspect status in the result before sending. */
  verify(domainId: string, options?: RequestOptions) {
    return this.client.request<Domain>(
      "POST",
      `${PATH}/${resourceId(domainId)}/verify`,
      undefined,
      options,
      { retryable: true },
    );
  }

  delete(domainId: string, options?: RequestOptions) {
    return this.client.request<DeleteResponse>(
      "DELETE",
      `${PATH}/${resourceId(domainId)}`,
      undefined,
      options,
    );
  }
}
