import type { NexiomError } from "./errors.js";

export interface NexiomConnectOptions {
  apiKey: string;

  /** API root without a version prefix. Default: https://api-connect.nxiom.com/api. */
  baseUrl?: string;

  /** Total request deadline, including retries, in milliseconds. Default: 30,000. */
  timeout?: number;

  /** Additional attempts for reads and idempotent email sends only. Default: 2. */
  maxRetries?: number;

  /** A Fetch-compatible implementation for instrumentation or testing. */
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  maxRetries?: number;
}

export interface SendEmailOptions extends RequestOptions {
  /** Reuse a stable key when retrying the same logical email across SDK calls. */
  idempotencyKey?: string;
}

export interface ResponseMetadata {
  status: number | null;
  headers: Headers;
  requestId: string | null;
  idempotencyKey: string | null;
}

export type NexiomResult<T> = ({ data: T; error: null } | { data: null; error: NexiomError }) & {
  response: ResponseMetadata;
};

export interface DeleteResponse {
  success: boolean;
}
