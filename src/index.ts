import { Client } from "./core/client.js";
import type { NexiomConnectOptions } from "./core/types.js";
import { Emails } from "./services/emails/emails.js";
import { Contacts } from "./services/contacts/contacts.js";

export class NexiomConnect {
  readonly emails: Emails;
  readonly contacts: Contacts;

  constructor(options: NexiomConnectOptions) {
    const client = new Client(options);
    this.emails = new Emails(client);
    this.contacts = new Contacts(client);
  }
}

export { NexiomError, NexiomValidationError } from "./core/errors.js";

export type { ErrorKind } from "./core/errors.js";

export type {
  NexiomConnectOptions,
  NexiomResult,
  RequestOptions,
  SendEmailOptions,
  ResponseMetadata,
  DeleteResponse,
} from "./core/types.js";

export type {
  SendEmailParams,
  SendEmailResponse,
  EmailAddresses,
} from "./services/emails/types.js";

export type {
  Contact,
  ContactDetails,
  ContactActivity,
  ContactListItem,
  ContactEmailStatus,
  ContactPropertyValue,
  CreateContactParams,
  UpdateContactParams,
  ListContactsParams,
  ListContactsResponse,
} from "./services/contacts/types.js";

export type {
  ContactProperty,
  ContactPropertyType,
  CreateContactPropertyParams,
  UpdateContactPropertyParams,
  ListContactPropertiesParams,
} from "./services/contacts/properties/types.js";
