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
