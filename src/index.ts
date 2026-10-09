import { Client } from "./core/client.js";
import type { NexiomConnectOptions } from "./core/types.js";
import { Emails } from "./services/emails/emails.js";
import { Contacts } from "./services/contacts/contacts.js";
import { Templates } from "./services/templates/templates.js";
import { Domains } from "./services/domains/domains.js";

export class NexiomConnect {
  readonly emails: Emails;
  readonly contacts: Contacts;
  readonly templates: Templates;
  readonly domains: Domains;

  constructor(options: NexiomConnectOptions) {
    const client = new Client(options);
    this.emails = new Emails(client);
    this.contacts = new Contacts(client);
    this.templates = new Templates(client);
    this.domains = new Domains(client);
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
  RescheduleEmailParams,
  RescheduleEmailResponse,
  CancelEmailResponse,
  ListEmailsParams,
  ListEmailsResponse,
  EmailListItem,
  Email,
  EmailStatus,
  EmailSource,
  EmailDeliveryReason,
} from "./services/emails/types.js";

export type {
  EmailSuppression,
  EmailSuppressionReason,
  ListEmailSuppressionsParams,
  ListEmailSuppressionsResponse,
} from "./services/emails/suppressions/types.js";

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

export type {
  Template,
  TemplateVersion,
  TemplateVariable,
  TemplateListStatus,
  TemplateOrigin,
  TemplateVersionStatus,
  TemplateVariableType,
  ListTemplatesParams,
  ListTemplatesResponse,
  ListTemplateVersionsParams,
} from "./services/templates/types.js";

export type {
  Domain,
  DomainDnsRecord,
  DomainStatus,
  DnsRecordStatus,
  CreateDomainParams,
  ListDomainsParams,
  ListDomainsResponse,
} from "./services/domains/types.js";
