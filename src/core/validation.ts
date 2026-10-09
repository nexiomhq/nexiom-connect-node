import { NexiomValidationError } from "./errors.js";

export function nonEmpty(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new NexiomValidationError(`${name} must be a non-empty string`);
  }
}

export function resourceId(value: string): string {
  nonEmpty(value, "id");

  // URL parsers normalize dot segments, even when percent encoded.
  if (value === "." || value === "..") {
    throw new NexiomValidationError("id cannot be a dot segment");
  }

  return encodeURIComponent(value);
}

export function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new NexiomValidationError(`${name} must be an integer between ${min} and ${max}`);
  }

  return value;
}

export function jsonBody(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    throw new NexiomValidationError("Request body must be JSON serializable");
  }
}

/** Serializes a Date or timestamp string; the API checks the offset and allowed range. */
export function timestamp(value: unknown, name: string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new NexiomValidationError(`${name} must be a valid date`);
    }

    return value.toISOString();
  }

  nonEmpty(value, name);
  if (Number.isNaN(Date.parse(value))) {
    throw new NexiomValidationError(`${name} must be an ISO 8601 timestamp`);
  }

  return value;
}

/** Builds a query string from defined values only. */
export function queryString(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  }

  return query.size ? `?${query}` : "";
}
