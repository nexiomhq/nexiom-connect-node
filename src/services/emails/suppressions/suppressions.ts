import type { Client } from "../../../core/client.js";
import { NexiomValidationError } from "../../../core/errors.js";
import type { RequestOptions } from "../../../core/types.js";
import { integer, queryString } from "../../../core/validation.js";
import type { ListEmailSuppressionsParams, ListEmailSuppressionsResponse } from "./types.js";

const PATH = "/v1/emails/suppressions";

export class EmailSuppressions {
  constructor(private readonly client: Client) {}

  /** Lists suppressed addresses alphabetically. Pass nextCursor as cursor for the next page. */
  list(params: ListEmailSuppressionsParams = {}, options?: RequestOptions) {
    if (
      params.search !== undefined &&
      (typeof params.search !== "string" ||
        params.search.trim().length < 1 ||
        params.search.trim().length > 255)
    ) {
      throw new NexiomValidationError("search must contain 1 to 255 characters");
    }
    if (params.limit !== undefined) {
      integer(params.limit, "limit", 1, 100);
    }
    if (
      params.cursor !== undefined &&
      (typeof params.cursor !== "string" || params.cursor.length < 1 || params.cursor.length > 400)
    ) {
      throw new NexiomValidationError("cursor must contain 1 to 400 characters");
    }

    const { search, limit, cursor } = params;
    const query = queryString({ search, limit, cursor });

    return this.client.request<ListEmailSuppressionsResponse>(
      "GET",
      `${PATH}${query}`,
      undefined,
      options,
    );
  }
}
