import { NexiomConnect } from "@nexiom/connect";

const nexiomConnect = new NexiomConnect({
  apiKey: process.env.NEXIOM_API_KEY,
});

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
  console.error(error.code, error.message);
  process.exitCode = 1;
} else {
  console.log(data.id, data.status);
}
