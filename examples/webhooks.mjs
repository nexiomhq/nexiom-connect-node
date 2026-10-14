import express from "express";
import { NexiomConnect, NexiomWebhookVerificationError } from "@nexiom/connect";

const nexiomConnect = new NexiomConnect({
  apiKey: process.env.NEXIOM_API_KEY,
});

const app = express();

// The raw body: parsed and re-serialized JSON no longer matches the signature.
app.post("/webhooks/nexiom", express.raw({ type: "application/json" }), async (request, response) => {
  let event;

  try {
    event = await nexiomConnect.webhooks.constructEventAsync(
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

  switch (event.type) {
    case "email.delivered":
      console.log(`Delivered to ${event.data.recipient}`);
      break;
    case "whatsapp.message.failed":
      console.log(`WhatsApp message ${event.data.id} failed: ${event.data.failure_code}`);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  response.sendStatus(204);
});

app.listen(3000);
