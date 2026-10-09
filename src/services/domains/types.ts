export type DomainStatus = "pending" | "verified" | "failed";

export type DnsRecordStatus = "not_started" | "pending" | "verified" | "failed" | "temporary_failure";

export interface CreateDomainParams {
  /** A subdomain such as mail.example.com. Root domains are not accepted. */
  domain: string;

  /** Default: true. */
  openTracking?: boolean | undefined;
}

export interface ListDomainsParams {
  /** 1 to 10,000. Default: 1. */
  page?: number | undefined;

  /** 1 to 100. Default: 50. */
  limit?: number | undefined;
  status?: DomainStatus | undefined;

  /** Filters by domain name. */
  search?: string | undefined;
}

/** Response fields retain the API's snake_case names; dates are ISO strings. */
export interface DomainDnsRecord {
  id: string;
  purpose: string;
  record_type: string;
  name: string;
  value: string;
  priority: number | null;
  status: DnsRecordStatus;
  required_for_sending: boolean;
  last_checked_at: string | null;
  error_code: string | null;
  error_message: string | null;
}

export interface Domain {
  id: string;
  domain: string;
  status: DomainStatus;
  region: string;
  open_tracking: boolean;

  /** What still needs attention when the domain is not verified. */
  verification_error: string | null;
  verification_attempts: number;
  verification_attempted_at: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;

  /** The DNS records to publish, when the API includes them. */
  dns_records?: DomainDnsRecord[];
}

export interface ListDomainsResponse {
  items: Domain[];
  total: number;
  page: number;
  limit: number;
}
