# Nexiom Connect Node.js SDK

The official Node.js SDK for Nexiom Connect. Send emails and manage contacts with TypeScript support, ESM and CommonJS builds, and no runtime dependencies.

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

`list()` accepts `page`, `limit`, `search`, `emailStatus`, `listId`, and `segmentId`. It returns `{ items, total, page, limit }`, with a default page size of 50 and a maximum of 100.

Responses use snake_case fields such as `first_name` and `created_at`. Dates are ISO strings. `get(id)` also returns properties and activity.

## Contact properties

| Method | Description |
| --- | --- |
| `create({ name, type, fallbackValue? })` | Create a property |
| `list(params?)` | List or filter properties |
| `update(id, { fallbackValue })` | Update the fallback value |
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

Types are `string`, `number`, and `date`. Fallback values are strings or null. Responses use `key` and `fallback_value`. Optional `type` and case-insensitive `search` filters are applied locally to the complete property list.

## Request options

The default base URL is `https://api-connect.nxiom.com/api`. Custom URLs exclude `/v1` and use HTTPS, except for local development on loopback hosts.

Configure `timeout` (default 30,000 ms), `maxRetries` (default 2), or a Fetch-compatible `fetch` implementation when creating the client. Each method also accepts `{ signal, timeout, maxRetries }` as its final argument.

The timeout covers the entire request, including retries. Reads and email sends retry network errors and HTTP 408, 429, 500, 502, 503, and 504, honoring `Retry-After`. Contact and property mutations are not automatically retried. Custom fetch implementations must honor `AbortSignal` and standard Fetch redirect behavior.

## Errors

All methods return `{ data, error, response }`. On success, `error` is null. On failure, `data` is null and `error` is a `NexiomError` with `kind`, `message`, `status`, `code`, `requestId`, and `details`.

Error kinds are `api`, `network`, `timeout`, `aborted`, and `protocol`. Invalid SDK configuration or locally validated arguments throw `NexiomValidationError`. Response metadata includes HTTP status, headers, request ID, and the email idempotency key.

## Examples

- [Send an email](./examples/send.mjs)
- [Create a contact](./examples/contacts.mjs)
- [Create a contact property](./examples/contact-properties.mjs)

## Development

```sh
npm ci
npm run check
npm run build
```

## License

[Apache License 2.0](./LICENSE). Copyright 2026 Nexiom Technologies.
