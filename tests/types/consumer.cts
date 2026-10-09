import {
  NexiomConnect,
  type Domain,
  type ListEmailSuppressionsResponse,
  type NexiomResult,
  type SendEmailResponse,
  type Template,
} from "@nexiom/connect";
const sdk = new NexiomConnect({ apiKey: "nc_test" });
const result: Promise<NexiomResult<SendEmailResponse>> = sdk.emails.send({
  from: "a@b.com",
  to: "c@d.com",
  subject: "Hello",
  html: "<p>Hello</p>",
});
void result;
const domain: Promise<NexiomResult<Domain>> = sdk.domains.get("dom_1");
const template: Promise<NexiomResult<Template>> = sdk.templates.get("tpl_1");
const suppressions: Promise<NexiomResult<ListEmailSuppressionsResponse>> =
  sdk.emails.suppressions.list();
void domain;
void template;
void suppressions;
