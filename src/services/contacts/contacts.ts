import type { Client } from "../../core/client.js";
import type { DeleteResponse, RequestOptions } from "../../core/types.js";
import { integer, nonEmpty, resourceId } from "../../core/validation.js";
import { ContactProperties } from "./properties/properties.js";
import type {
  Contact,
  ContactDetails,
  CreateContactParams,
  ListContactsParams,
  ListContactsResponse,
  UpdateContactParams,
} from "./types.js";

const PATH = "/v1/emails/contacts";

function contactBody(params: CreateContactParams | UpdateContactParams) {
  nonEmpty(params?.email, "email");

  const { email, userId, firstName, lastName, phoneNumber, properties } = params;

  return { email, userId, firstName, lastName, phoneNumber, properties };
}

export class Contacts {
  readonly properties: ContactProperties;

  constructor(private readonly client: Client) {
    this.properties = new ContactProperties(client);
  }

  create(params: CreateContactParams, options?: RequestOptions) {
    return this.client.request<Contact>("POST", PATH, contactBody(params), options);
  }

  list(params: ListContactsParams = {}, options?: RequestOptions) {
    if (params.page !== undefined) {
      integer(params.page, "page", 1, Number.MAX_SAFE_INTEGER);
    }
    if (params.limit !== undefined) {
      integer(params.limit, "limit", 1, 100);
    }

    const { page, limit, search, emailStatus, segmentId, listId } = params;
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries({
      page,
      limit,
      search,
      emailStatus,
      segmentId,
      listId,
    })) {
      if (value !== undefined) {
        query.set(key, String(value));
      }
    }

    return this.client.request<ListContactsResponse>(
      "GET",
      `${PATH}${query.size ? `?${query}` : ""}`,
      undefined,
      options,
    );
  }

  get(id: string, options?: RequestOptions) {
    return this.client.request<ContactDetails>(
      "GET",
      `${PATH}/${resourceId(id)}`,
      undefined,
      options,
    );
  }

  update(id: string, params: UpdateContactParams, options?: RequestOptions) {
    return this.client.request<Contact>(
      "PUT",
      `${PATH}/${resourceId(id)}`,
      { ...contactBody(params), emailStatus: params.emailStatus },
      options,
    );
  }

  delete(id: string, options?: RequestOptions) {
    return this.client.request<DeleteResponse>(
      "DELETE",
      `${PATH}/${resourceId(id)}`,
      undefined,
      options,
    );
  }
}
