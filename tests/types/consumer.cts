import { NexiomConnect, type NexiomResult, type SendEmailResponse } from "@nexiom/connect";
const sdk = new NexiomConnect({ apiKey: "nc_test" });
const result: Promise<NexiomResult<SendEmailResponse>> = sdk.emails.send({
  from: "a@b.com",
  to: "c@d.com",
  subject: "Hello",
  html: "<p>Hello</p>",
});
void result;
