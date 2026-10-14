import type { Client } from "../../core/client.js";
import { WhatsAppMessages } from "./messages.js";

export class WhatsApp {
  readonly messages: WhatsAppMessages;

  constructor(client: Client) {
    this.messages = new WhatsAppMessages(client);
  }
}
