import type { Client } from "../../../core/client.js";
import { NexiomError, NexiomValidationError } from "../../../core/errors.js";
import type { DeleteResponse, NexiomResult, RequestOptions } from "../../../core/types.js";
import { nonEmpty, resourceId } from "../../../core/validation.js";
import type {
  ContactProperty,
  CreateContactPropertyParams,
  ListContactPropertiesParams,
  UpdateContactPropertyParams,
} from "./types.js";

const PATH = "/v1/emails/properties";

const TYPES: readonly string[] = ["string", "number", "date"];

function fallback(value: unknown) {
  if (value !== null && (typeof value !== "string" || value.length > 1000)) {
    throw new NexiomValidationError(
      "fallbackValue must be null or a string of at most 1000 characters",
    );
  }
}

function name(value: unknown) {
  nonEmpty(value, "name");

  if (value.trim().length > 255) {
    throw new NexiomValidationError("name must contain at most 255 characters");
  }
}

function type(value: unknown) {
  if (typeof value !== "string" || !TYPES.includes(value)) {
    throw new NexiomValidationError("type must be string, number, or date");
  }
}

export class ContactProperties {
  constructor(private readonly client: Client) {}

  create(params: CreateContactPropertyParams, options?: RequestOptions) {
    name(params?.name);
    type(params.type);

    if (params.fallbackValue !== undefined) {
      fallback(params.fallbackValue);
    }

    return this.client.request<ContactProperty>(
      "POST",
      PATH,
      { key: params.name, type: params.type, fallback_value: params.fallbackValue },
      options,
    );
  }

  async list(
    params: ListContactPropertiesParams = {},
    options?: RequestOptions,
  ): Promise<NexiomResult<ContactProperty[]>> {
    const result = await this.client.request<ContactProperty[]>("GET", PATH, undefined, options);

    if (result.error) {
      return result;
    }

    if (
      !Array.isArray(result.data) ||
      result.data.some((property) => !property || typeof property.key !== "string")
    ) {
      return {
        data: null,
        error: new NexiomError(
          "API returned an invalid property collection",
          "protocol",
          result.response.status,
          null,
          result.response.requestId,
        ),
        response: result.response,
      };
    }

    const search = params.search?.toLowerCase();

    return {
      ...result,
      data: result.data.filter(
        (property) =>
          (!params.type || property.type === params.type) &&
          (!search || property.key.toLowerCase().includes(search)),
      ),
    };
  }

  update(id: string, params: UpdateContactPropertyParams, options?: RequestOptions) {
    const path = `${PATH}/${resourceId(id)}`;

    if (
      params?.name === undefined &&
      params?.type === undefined &&
      params?.fallbackValue === undefined
    ) {
      throw new NexiomValidationError("name, type, or fallbackValue is required");
    }
    if (params.name !== undefined) {
      name(params.name);
    }
    if (params.type !== undefined) {
      type(params.type);
    }
    if (params.fallbackValue !== undefined) {
      fallback(params.fallbackValue);
    }

    return this.client.request<ContactProperty>(
      "PATCH",
      path,
      { key: params.name, type: params.type, fallback_value: params.fallbackValue },
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
