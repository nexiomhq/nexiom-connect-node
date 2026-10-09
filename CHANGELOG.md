# Changelog

## 0.2.0 — Unreleased

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
