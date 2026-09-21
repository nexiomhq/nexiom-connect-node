import { NexiomConnect } from "@nexiom/connect";

const nexiomConnect = new NexiomConnect({
  apiKey: process.env.NEXIOM_API_KEY,
});

const { data, error } = await nexiomConnect.emails.send({
  from: "hello@your-verified-domain.com",
  fromName: "Your team",
  to: "customer@example.com",
  subject: "Welcome",
  html: "<p>Thanks for joining us.</p>",
  text: "Thanks for joining us.",
});

if (error) {
  console.error(error.message);
  process.exitCode = 1;
} else {
  console.log(data.messageId);
}
