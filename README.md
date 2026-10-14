# Nexiom Connect Node.js SDK

The official Node.js SDK for Nexiom Connect. Send emails, manage contacts, and read templates, sending domains, and suppressions with TypeScript support, ESM and CommonJS builds, and no runtime dependencies.

## Install

```sh
npm install @nexiom/connect
```

Requires Node.js 22 or later. Keep your API key on the server.

## Initialize

```ts
import { NexiomConnect } from "@nexiom/connect";

const nexiomConnect = new NexiomConnect({
  apiKey: "nc_your_api_key_here",
});

// Optional custom host:
// const nexiomConnect = new NexiomConnect({
//   apiKey: "nc_...",
//   baseUrl: "https://api-connect.nxiom.com/api",
// });
```

CommonJS is also supported:

```js
const { NexiomConnect } = require("@nexiom/connect");
```

## Send email

Use a verified sending domain and an API key with email-send or full-access permission.

```ts
const { data, error } = await nexiomConnect.emails.send({
  from: "hello@your-verified-domain.com",
  fromName: "Your team",
  to: "customer@example.com",
  subject: "Welcome",
  html: "<p>Thanks for joining us.</p>",
  text: "Thanks for joining us.",
});

if (error) {
  throw error;
}

console.log(data.messageId);
```

Use a bare email address for `from` and `fromName` for the display name. A successful response means the email is queued and includes `messageId`, `deliveryIds`, and `totalQueued`.

You can also send a published template with `templateId` and `templateVariables`. Optional fields include `replyTo`, `cc`, `bcc`, and `metadata`. Recipients can be one address or an array of up to 100 addresses; CC and BCC require one primary recipient.

### Idempotency

For retries across separate calls or jobs, use the same key and payload:

```ts
await nexiomConnect.emails.send(
  {
    from: "orders@your-verified-domain.com",
    to: "customer@example.com",
    subject: "Order received",
    text: "We received your order.",
  },
  { idempotencyKey: "order-123-confirmation" },
);
```

Otherwise, the SDK generates a key for each call and reuses it for automatic retries. Keys contain 1–128 printable ASCII characters without whitespace. The key is available as `result.response.idempotencyKey`, including after a timeout.

### Scheduled emails

Pass `scheduledAt` (a `Date` or an ISO 8601 timestamp with an offset, at most 30 days ahead) to send later. Use the returned `messageId` to move or cancel it before it is sent.

```ts
const { data, error } = await nexiomConnect.emails.send({
  from: "hello@your-verified-domain.com",
  to: "customer@example.com",
  subject: "Your trial ends tomorrow",
  text: "Your trial ends tomorrow.",
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
});

if (error) {
  throw error;
}

await nexiomConnect.emails.reschedule(data.messageId, {
  scheduledAt: "2026-10-06T09:00:00+01:00",
});

await nexiomConnect.emails.cancel(data.messageId);
```

## Email logs

| Method | Description |
| --- | --- |
| `list(params?)` | List recipient deliveries, newest first |
| `get(deliveryId)` | Get one delivery with its content and history |

Both require a full-access API key.

```ts
const { data, error } = await nexiomConnect.emails.list({ status: "bounced", limit: 50 });

if (error) {
  throw error;
}

for (const delivery of data.items) {
  console.log(delivery.id, delivery.recipient, delivery.status);
}

// Next page: pass data.nextCursor as cursor while data.hasMore is true.
```

`list()` also accepts `source`, `recipient`, `search`, `contactId`, `templateId`, `startDate`, and `endDate`. `get()` takes a delivery ID from `deliveryIds` or `list()`, not a message ID.

## Email suppressions

| Method | Description |
| --- | --- |
| `suppressions.list(params?)` | List addresses your project does not send to, and why |

Requires a full-access API key.

```ts
const { data, error } = await nexiomConnect.emails.suppressions.list({ search: "example.com" });

if (error) {
  throw error;
}

for (const suppression of data.items) {
  console.log(suppression.email, suppression.reason);
}

// Next page: pass data.nextCursor as cursor while data.hasMore is true.
```

`list()` accepts `search` (part of an address, 1–255 characters), `limit` (1–100, default 50), and `cursor`. Addresses are listed alphabetically. `reason` is `hard_bounce`, `complaint`, `unsubscribed`, `invalid`, `manual`, or `temporary_failure`.

## Contacts

Contact methods require a full-access API key.

| Method | Description |
| --- | --- |
| `create(params)` | Create a contact |
| `list(params?)` | List or search contacts |
| `get(id)` | Get a contact |
| `update(id, params)` | Update a contact |
| `delete(id)` | Delete a contact |

```ts
const { data, error } = await nexiomConnect.contacts.create({
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  properties: { company: "Example" },
});

if (error) {
  throw error;
}

console.log(data.id);
```

Creation also accepts `userId` and `phoneNumber`. Updates require `email` and accept `emailStatus` (`subscribed` or `unsubscribed`); `userId: null` clears the external user ID.

`list()` accepts `page` (up to 10,000), `limit`, `search`, `emailStatus`, `listId`, and `segmentId`. It returns `{ items, total, page, limit }`, with a default page size of 50 and a maximum of 100.

Responses use snake_case fields such as `first_name` and `created_at`. Dates are ISO strings. `get(id)` also returns properties and activity.

## Contact properties

| Method | Description |
| --- | --- |
| `create({ name, type, fallbackValue? })` | Create a property |
| `list(params?)` | List or filter properties |
| `update(id, { name?, type?, fallbackValue? })` | Rename a property, change its type, or set its fallback |
| `delete(id)` | Delete a property |

```ts
const { data, error } = await nexiomConnect.contacts.properties.create({
  name: "company",
  type: "string",
  fallbackValue: "Unknown",
});

if (error) {
  throw error;
}

console.log(data.id, data.key);
```

Types are `string`, `number`, and `date`. A type can change only while no contact has a value for the property. Fallback values are strings or null. Responses use `key` and `fallback_value`. Optional `type` and case-insensitive `search` filters are applied locally to the complete property list.

## Templates

Template methods require a full-access API key.

| Method | Description |
| --- | --- |
| `list(params?)` | List or search templates |
| `get(templateId)` | Get a template with its draft and published versions |
| `variables(templateId)` | List the variables of the draft, or of the published version |
| `versions(templateId, params?)` | List versions, newest first |

```ts
const { data, error } = await nexiomConnect.templates.get("tpl_123");

if (error) {
  throw error;
}

for (const variable of data.published_version?.variables ?? []) {
  console.log(variable.key, variable.type, variable.required);
}
```

`list()` accepts `page` (up to 10,000), `limit` (1–100, default 50), `status` (`draft`, `published`, `changes_in_draft`, or `archived`), `search`, `origin` (`custom` or `prebuilt`), and `category`. It returns `{ items, total, page, limit }`, most recently updated first.

Sends use the published version, so `published_version.variables` lists exactly what a send needs. `variables()` returns the draft's variables while a draft exists. `versions()` accepts `limit` and `beforeVersion`: pass the last `version_number` to read older versions, until a response has fewer than `limit` versions.

## Domains

Domain methods require a full-access API key.

| Method | Description |
| --- | --- |
| `create({ domain, openTracking? })` | Add a sending subdomain |
| `list(params?)` | List or search domains |
| `get(domainId)` | Get a domain with its DNS records |
| `verify(domainId)` | Check the domain's DNS records |
| `delete(domainId)` | Delete a domain |

```ts
const { data, error } = await nexiomConnect.domains.create({ domain: "mail.example.com" });

if (error) {
  throw error;
}

for (const record of data.dns_records ?? []) {
  console.log(record.record_type, record.name, record.value);
}
```

Use a subdomain such as `mail.example.com`; root domains are not accepted. `openTracking` defaults to `true`. Publish the returned DNS records with your DNS provider, then call `verify(domainId)` and check `data.status` (`pending`, `verified`, or `failed`) before sending.

`list()` accepts `page` (up to 10,000), `limit` (1–100, default 50), `status`, and `search`, and returns `{ items, total, page, limit }`. Deleting a domain affects future sends that use it.

## WhatsApp

Send an approved WhatsApp template from a connected number. The API key needs the `whatsapp.send` or `whatsapp.full_access` permission.

| Method | Description |
| --- | --- |
| `messages.send(params, options?)` | Send a template message to one recipient |
| `messages.get(messageId)` | Get a message with its status, cost, and content |

```ts
const { data, error } = await nexiomConnect.whatsapp.messages.send(
  {
    sender: "+213555000111",
    to: "+213555123456",
    templateId: "wat_your_template_id",
    variables: {
      body: { 1: "Amina", 2: "A-1234" },
    },
  },
  { idempotencyKey: "order-A-1234-shipped" },
);

if (error) {
  throw error;
}

console.log(data.id, data.status);
```

`sender` is the phone number of a connected WhatsApp number and `to` the recipient, both in E.164 format. `variables.header` and `variables.body` give a string for every variable of the template, keyed by its number (`"1"`) or name (`"first_name"`). Omit `variables` for a template without variables.

Every send carries an idempotency key; the SDK generates one when you don't pass `idempotencyKey`, and returns it in `response.idempotencyKey`. Sends are retried with the same key, so a message is sent at most once. A retry with a key already used returns the original message as it is now.

A sent message usually has the status `accepted`: WhatsApp accepted it, which is not delivery yet. `uncertain` means WhatsApp did not confirm it; it is never resent automatically. Follow the status with `messages.get(messageId)` or the `whatsapp.message.*` webhooks.

## Webhooks

`webhooks.constructEvent(payload, headers, secret, options?)` checks a webhook request's signature and timestamp, then returns the event. It makes no network request.

```ts
import express from "express";
import { NexiomWebhookVerificationError } from "@nexiom/connect";

app.post("/webhooks/nexiom", express.raw({ type: "application/json" }), (request, response) => {
  let event;

  try {
    event = nexiomConnect.webhooks.constructEvent(
      request.body,
      request.headers,
      process.env.NEXIOM_WEBHOOK_SECRET,
    );
  } catch (error) {
    if (error instanceof NexiomWebhookVerificationError) {
      return response.status(400).send(error.reason);
    }

    throw error;
  }

  if (event.type === "email.bounced") {
    console.log(event.data.recipient);
  }

  response.sendStatus(204);
});
```

- `payload` is the raw request body as a string, Buffer, or `Uint8Array`, exactly as received. Parsed and re-serialized JSON does not match the signature.
- `headers` accepts Fetch API `Headers`, Node's `request.headers`, or a plain object; names are case-insensitive.
- `secret` is the endpoint's signing secret, starting with `whsec_`.
- `options.tolerance` is the allowed clock difference in seconds (default 300).

The result is a `WebhookEvent`: checking `event.type` narrows `event.data` to that event's fields. Event types added after your SDK version are still verified and returned, so keep a default branch.

A request that fails verification throws `NexiomWebhookVerificationError`, whose `reason` is `missing_headers`, `invalid_timestamp`, `timestamp_out_of_tolerance`, `invalid_signature`, or `invalid_payload`. Respond `400` and do not process it. Verification uses no runtime-specific APIs, so it also works in Bun, Deno, and edge runtimes.

## Request options

The default base URL is `https://api-connect.nxiom.com/api`. Custom URLs exclude `/v1` and use HTTPS, except for local development on loopback hosts.

Configure `timeout` (default 30,000 ms), `maxRetries` (default 2), or a Fetch-compatible `fetch` implementation when creating the client. Each method also accepts `{ signal, timeout, maxRetries }` as its final argument.

The timeout covers the entire request, including retries. Reads, email and WhatsApp sends, cancels, and domain verification retry network errors and HTTP 408, 429, 500, 502, 503, and 504, honoring `Retry-After`. When the wait would outlast the timeout, the SDK returns that API error at once. Reschedules, contact and property mutations, and domain creation and deletion are not automatically retried. Custom fetch implementations must honor `AbortSignal` and standard Fetch redirect behavior.

## Errors

All methods return `{ data, error, response }`. On success, `error` is null. On failure, `data` is null and `error` is a `NexiomError` with `kind`, `message`, `status`, `code`, `requestId`, and `details`.

Error kinds are `api`, `network`, `timeout`, `aborted`, and `protocol`. Invalid SDK configuration or locally validated arguments throw `NexiomValidationError`. Response metadata includes HTTP status, headers, request ID, and the send's idempotency key.

## Examples

- [Send an email](./examples/send.mjs)
- [Create a contact](./examples/contacts.mjs)
- [Create a contact property](./examples/contact-properties.mjs)
- [Add a sending domain](./examples/domains.mjs)
- [List published templates](./examples/templates.mjs)
- [Send a WhatsApp message](./examples/whatsapp.mjs)
- [Verify webhooks with Express](./examples/webhooks.mjs)

## Development

```sh
npm ci
npm run check
npm run build
```

## License

[Apache License 2.0](./LICENSE). Copyright 2026 Nexiom Technologies.
