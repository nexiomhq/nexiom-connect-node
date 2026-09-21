import {
  NexiomConnect,
  type SendEmailParams,
  type NexiomResult,
  type SendEmailResponse,
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
// @ts-expect-error no read email endpoint in this release
sdk.emails.get("msg_1");
void missingContent;
