import type { NexiomError } from "./errors.js";

export interface NexiomConnectOptions {
  apiKey: string;

  /** API root without a version prefix. Default: https://api-connect.nxiom.com/api. */
  baseUrl?: string | undefined;

  /** Total request deadline, including retries, in milliseconds. Default: 30,000. */
  timeout?: number | undefined;

  /** Additional attempts for reads, idempotent email sends, cancels, and domain verification only. Default: 2. */
  maxRetries?: number | undefined;

  /** A Fetch-compatible implementation for instrumentation or testing. */
  fetch?: typeof globalThis.fetch | undefined;
}

export interface RequestOptions {
  signal?: AbortSignal | undefined;
  timeout?: number | undefined;
  maxRetries?: number | undefined;
}

export interface SendEmailOptions extends RequestOptions {
  /** Reuse a stable key when retrying the same logical email across SDK calls. */
  idempotencyKey?: string | undefined;
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
