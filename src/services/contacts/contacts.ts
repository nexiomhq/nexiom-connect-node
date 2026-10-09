import type { Client } from "../../core/client.js";
import type { DeleteResponse, RequestOptions } from "../../core/types.js";
import { integer, nonEmpty, queryString, resourceId } from "../../core/validation.js";
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

/** The API bounds page offsets; narrow larger collections with filters or search. */
const MAX_PAGE = 10_000;

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
      integer(params.page, "page", 1, MAX_PAGE);
    }
    if (params.limit !== undefined) {
      integer(params.limit, "limit", 1, 100);
    }

    const { page, limit, search, emailStatus, segmentId, listId } = params;
    const query = queryString({ page, limit, search, emailStatus, segmentId, listId });

    return this.client.request<ListContactsResponse>("GET", `${PATH}${query}`, undefined, options);
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
