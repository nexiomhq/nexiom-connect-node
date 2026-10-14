import type { Client } from "../../core/client.js";
import { NexiomValidationError } from "../../core/errors.js";
import type { RequestOptions, SendMessageOptions } from "../../core/types.js";
import { nonEmpty, resourceId } from "../../core/validation.js";
import type {
  Message,
  MessageChannel,
  MessageDetails,
  SendMessageParams,
  WhatsAppTemplateVariables,
} from "./types.js";

const PATH = "/v1/messaging/messages";
const CHANNELS: readonly MessageChannel[] = ["whatsapp"];
const E164 = /^\+[1-9]\d{6,14}$/;

function phoneNumber(value: unknown, name: string): string {
  if (typeof value !== "string" || !E164.test(value.trim())) {
    throw new NexiomValidationError(`${name} must be an E.164 phone number, such as +213555123456`);
  }

  return value.trim();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function variableValues(value: unknown, name: string): WhatsAppTemplateVariables | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isObject(value)) {
    throw new NexiomValidationError(`${name} must be an object of variable values`);
  }

  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_]{1,64}$/.test(key)) {
      throw new NexiomValidationError(`${name} keys must be variable numbers or names`);
    }
    if (typeof item !== "string" || item.length > 1024) {
      throw new NexiomValidationError(`${name}.${key} must be a string of at most 1024 characters`);
    }
  }

  return value as WhatsAppTemplateVariables;
}

/** Send messages on any messaging channel, and read them back. */
export class Messaging {
  constructor(private readonly client: Client) {}

  /**
   * Sends a message on the channel named by `channel`. Retries reuse the same idempotency key,
   * so a message is sent at most once.
   */
  send(params: SendMessageParams, options: SendMessageOptions = {}) {
    if (!isObject(params)) {
      throw new NexiomValidationError("params must be an object");
    }

    if (!CHANNELS.includes(params.channel)) {
      throw new NexiomValidationError(`channel must be one of: ${CHANNELS.join(", ")}`);
    }

    const from = phoneNumber(params.from, "from");
    const to = phoneNumber(params.to, "to");

    if (!isObject(params.template)) {
      throw new NexiomValidationError("template must be an object with an id and variables");
    }

    nonEmpty(params.template.id, "template.id");

    const variables = params.template.variables;
    if (variables !== undefined && !isObject(variables)) {
      throw new NexiomValidationError("template.variables must be an object with header and body values");
    }

    const header = variableValues(variables?.header, "template.variables.header");
    const body = variableValues(variables?.body, "template.variables.body");

    const key = options.idempotencyKey ?? globalThis.crypto.randomUUID();
    if (!/^[\x21-\x7e]{1,200}$/.test(key)) {
      throw new NexiomValidationError(
        "idempotencyKey must be 1 to 200 printable ASCII characters without whitespace",
      );
    }

    // Explicit allowlist prevents accidental tenant context or unsupported fields on the wire.
    return this.client.request<Message>(
      "POST",
      PATH,
      {
        channel: params.channel,
        from,
        to,
        template: {
          id: params.template.id,
          variables: variables === undefined ? undefined : { header, body },
        },
      },
      options,
      { idempotencyKey: key },
    );
  }

  /** Fetches one message with its current status and the content the recipient received. */
  get(messageId: string, options?: RequestOptions) {
    return this.client.request<MessageDetails>(
      "GET",
      `${PATH}/${resourceId(messageId)}`,
      undefined,
      options,
    );
  }
}
