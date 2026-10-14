import {
  NexiomConnect,
  type SendEmailParams,
  type NexiomResult,
  type SendEmailResponse,
  type Domain,
  type DeleteResponse,
  type EmailSuppressionReason,
  type ListDomainsResponse,
  type ListTemplatesResponse,
  type Template,
  type TemplateVariable,
  type TemplateVersion,
  type WebhookEvent,
  type WhatsAppMessage,
  type WhatsAppMessageDetails,
  NexiomWebhookVerificationError,
} from "@nexiom/connect";
const sdk = new NexiomConnect({ apiKey: "nc_test" });
const result: NexiomResult<SendEmailResponse> = await sdk.emails.send({
  from: "a@b.com",
  to: "c@d.com",
  subject: "Hello",
  text: "Hello",
});
if (result.error === null) {
  const id: string = result.data.messageId;
  void id;
} else {
  const code: string | null = result.error.code;
  void code;
}
await sdk.emails.send({ from: "a@b.com", to: "c@d.com", templateId: "tpl_1" });
await sdk.contacts.update("ct_1", { email: "a@b.com", userId: null });
await sdk.contacts.properties.update("p_1", { fallbackValue: null });
// @ts-expect-error email content is required
const missingContent: SendEmailParams = { from: "a@b.com", to: "c@d.com", subject: "Hello" };
// @ts-expect-error tenant IDs are not public parameters
sdk.contacts.create({ email: "a@b.com", projectId: "project_1" });
// @ts-expect-error update requires email under the current API contract
sdk.contacts.update("ct_1", { firstName: "Ada" });
// @ts-expect-error unsupported resource
sdk.broadcasts;
// @ts-expect-error properties support string, number and date
sdk.contacts.properties.create({ name: "active", type: "boolean" });
const scheduled = await sdk.emails.send({
  from: "a@b.com",
  to: "c@d.com",
  subject: "Hello",
  text: "Hello",
  scheduledAt: new Date(),
});
if (scheduled.data) {
  const at: string | null = scheduled.data.scheduledAt;
  await sdk.emails.reschedule(scheduled.data.messageId, { scheduledAt: "2026-10-06T09:00:00Z" });
  await sdk.emails.cancel(scheduled.data.messageId);
  void at;
}
const logs = await sdk.emails.list({ status: "delivered", limit: 10 });
if (logs.data?.nextCursor) {
  await sdk.emails.list({ cursor: logs.data.nextCursor });
}
const delivery = await sdk.emails.get("del_1");
if (delivery.data) {
  const opens: number = delivery.data.open_count;
  void opens;
}
// Optional fields accept explicit undefined under exactOptionalPropertyTypes.
const maybeName: string | undefined = undefined;
await sdk.emails.send({ from: "a@b.com", fromName: maybeName, to: "c@d.com", templateId: "t" });
await sdk.contacts.properties.update("p_1", { name: "company_name" });
// @ts-expect-error unknown email status
sdk.emails.list({ status: "opened" });
const suppressed = await sdk.emails.suppressions.list({ search: "example.com", limit: 50 });
if (suppressed.data) {
  const reason: EmailSuppressionReason | undefined = suppressed.data.items[0]?.reason;
  if (suppressed.data.hasMore && suppressed.data.nextCursor) {
    await sdk.emails.suppressions.list({ cursor: suppressed.data.nextCursor });
  }
  void reason;
}
await sdk.emails.suppressions.list();
const templates: NexiomResult<ListTemplatesResponse> = await sdk.templates.list({
  status: "published",
  origin: "custom",
  category: "onboarding",
  search: "welcome",
  page: 1,
  limit: 50,
});
void templates;
const template: NexiomResult<Template> = await sdk.templates.get("tpl_1");
if (template.data?.published_version) {
  const keys: string[] = template.data.published_version.variables.map((v) => v.key);
  void keys;
}
const variables: NexiomResult<TemplateVariable[]> = await sdk.templates.variables("tpl_1");
const versions: NexiomResult<TemplateVersion[]> = await sdk.templates.versions("tpl_1", {
  limit: 10,
  beforeVersion: 3,
});
if (versions.data) {
  const status: "draft" | "published" | "saved" | undefined = versions.data[0]?.status;
  void status;
}
void variables;
const created: NexiomResult<Domain> = await sdk.domains.create({
  domain: "mail.example.com",
  openTracking: maybeName === undefined ? undefined : true,
});
if (created.data) {
  const records = created.data.dns_records ?? [];
  const verified = await sdk.domains.verify(created.data.id);
  const state: "pending" | "verified" | "failed" | undefined = verified.data?.status;
  void records;
  void state;
}
const domains: NexiomResult<ListDomainsResponse> = await sdk.domains.list({ status: "verified" });
await sdk.domains.get("dom_1");
const removed: NexiomResult<DeleteResponse> = await sdk.domains.delete("dom_1");
void domains;
void removed;
// @ts-expect-error unknown template status
sdk.templates.list({ status: "saved" });
// @ts-expect-error unknown template origin
sdk.templates.list({ origin: "shared" });
// @ts-expect-error unknown domain status
sdk.domains.list({ status: "active" });
// @ts-expect-error domain is required
sdk.domains.create({ openTracking: true });
// @ts-expect-error tenant IDs are not public parameters
sdk.domains.create({ domain: "mail.example.com", projectId: "project_1" });
// @ts-expect-error suppressions are listed only
sdk.emails.suppressions.create;
// @ts-expect-error templates are read-only
sdk.templates.create;
void missingContent;
const whatsapp: NexiomResult<WhatsAppMessage> = await sdk.whatsapp.messages.send(
  { sender: "+213555000111", to: "+213555123456", templateId: "wat_1", variables: { body: { "1": "Ada" } } },
  { idempotencyKey: "order-1" },
);
if (whatsapp.data) {
  const status: "sending" | "accepted" | "sent" | "delivered" | "read" | "failed" | "uncertain" =
    whatsapp.data.status;
  const read: NexiomResult<WhatsAppMessageDetails> = await sdk.whatsapp.messages.get(whatsapp.data.id);
  const segments = read.data?.content?.body ?? [];
  void status;
  void segments;
}
// @ts-expect-error the sender is named by phone number, not by ID
sdk.whatsapp.messages.send({ senderId: "was_1", to: "+213555123456", templateId: "wat_1" });
// @ts-expect-error variable values are strings
sdk.whatsapp.messages.send({ sender: "+1", to: "+2", templateId: "t", variables: { body: { "1": 2 } } });
const event: WebhookEvent = await sdk.webhooks.constructEventAsync("{}", new Headers(), "whsec_test", {
  tolerance: 600,
});
switch (event.type) {
  case "email.scheduled": {
    const at: string = event.data.scheduled_at;
    void at;
    break;
  }
  case "contact.unsubscribed": {
    const email: string | null = event.data.email;
    void email;
    break;
  }
  case "whatsapp.message.failed": {
    const code: string = event.data.failure_code;
    void code;
    break;
  }
  case "whatsapp.message.read": {
    // @ts-expect-error only failed WhatsApp events carry a failure code
    void event.data.failure_code;
    break;
  }
}
await sdk.webhooks.constructEventAsync(new TextEncoder().encode("{}"), { "x-nexiom-signature": ["a"] }, "whsec_test");
try {
  await sdk.webhooks.constructEventAsync("{}", {}, "whsec_test");
} catch (error) {
  if (error instanceof NexiomWebhookVerificationError) {
    const reason:
      | "missing_headers"
      | "invalid_timestamp"
      | "timestamp_out_of_tolerance"
      | "invalid_signature"
      | "invalid_payload" = error.reason;
    void reason;
  }
}
// @ts-expect-error verification is asynchronous; there is no synchronous constructEvent
sdk.webhooks.constructEvent;
