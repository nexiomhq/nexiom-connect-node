# Changelog

## 0.4.0 — 2026-10-14

- Add `webhooks.constructEventAsync(payload, headers, secret, { tolerance? })`. It verifies a webhook request's HMAC-SHA256 signature with the runtime's Web Crypto API and its timestamp (300 seconds by default), and resolves to a typed `WebhookEvent`, narrowed by `event.type`. Failures reject with `NexiomWebhookVerificationError` and a `reason`.
- Add `messaging.send(params, { idempotencyKey? })` and `messaging.get(messageId)`, one interface for every messaging channel. `channel` selects the fields: `{ channel: "whatsapp", from, to, template: { id, variables? } }` sends an approved WhatsApp template from a connected number, named by its phone number. Sends always carry an idempotency key and retry with it; reads retry.
- Export the message and webhook event types.

## 0.3.0 — 2026-10-10

- Add `templates.list(params?)`, `templates.get(templateId)`, `templates.variables(templateId)`, and `templates.versions(templateId, params?)`.
- Add `domains.create({ domain, openTracking? })`, `domains.list(params?)`, `domains.get(domainId)`, `domains.verify(domainId)`, and `domains.delete(domainId)`. Verify retries automatically because re-running a DNS check is safe; create and delete are not retried.
- Add `emails.suppressions.list(params?)` (cursor pagination over suppressed addresses and their reasons).
- Validate page, limit, status, origin, cursor, and search arguments for the new methods before making a request.

## 0.2.1 — Unreleased

- First npm release of the 0.2.0 changes below. Releases are now staged on npm and approved by a maintainer with 2FA.

## 0.2.0 — Not published

Tagged, but never published to npm. Install 0.2.1 instead.


- Add `scheduledAt` to `emails.send` (a `Date` or ISO 8601 timestamp); `SendEmailResponse` now includes `scheduledAt`.
- Add `emails.cancel(messageId)` and `emails.reschedule(messageId, { scheduledAt })` for scheduled sends. Cancel retries automatically because canceling twice is safe.
- Add `emails.list(params?)` (cursor pagination over recipient deliveries) and `emails.get(deliveryId)`.
- `contacts.properties.update` now also renames a property (`name`) and changes its `type`; every field is optional, but one is required.
- When `Retry-After` or backoff would outlast the request deadline, return the API error (for example the 429) at once instead of waiting and reporting a timeout.
- `contacts.list` rejects pages above 10,000 locally, matching the API.
- Optional parameters accept an explicit `undefined`, so they work with `exactOptionalPropertyTypes`.

## 0.1.0 — 2026-09-21

- Add `NexiomConnect` with email sending, contact CRUD, and contact property management.
- Include idempotent email retries, typed results/errors, cancellation, and total request deadlines.
- Ship ESM/CommonJS builds, TypeScript declarations, and Apache-2.0 licensing.
