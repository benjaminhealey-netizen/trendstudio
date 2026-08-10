import type { SiteContent } from "./content/schema";

export type ClientStatus = "draft" | "provisioning" | "live" | "suspended";
export type SiteStatus = "draft" | "published" | "unpublished";
export type DeploymentStatus = "queued" | "building" | "success" | "failed";

/**
 * How a client's domain reaches us.
 *  - delegated_ns: they pointed their registrar at our nameservers; the zone
 *    lives in our Cloudflare account. Apex works. Default.
 *  - external_dns: they keep DNS where it is and add a CNAME. Subdomain/www
 *    only — apex CNAME is not portable across registrars.
 */
export type DomainMode = "delegated_ns" | "external_dns";

export type DomainState =
  | "snapshot_pending"
  | "snapshot_taken"
  | "awaiting_dns_change"
  | "dns_detected"
  | "attached"
  | "live"
  | "failed";

export interface Client {
  id: string;
  name: string;
  email: string;
  businessName: string;
  status: ClientStatus;
  createdAt: string;
}

export interface Site {
  id: string;
  clientId: string;
  templateId: string;
  projectName: string;
  status: SiteStatus;
  liveUrl: string | null;
  publishedAt: string | null;
  publishedVersionId: string | null;
  createdAt: string;
}

/** Working copy. Edited freely; never served directly. */
export interface SiteDraft {
  siteId: string;
  content: SiteContent;
  updatedAt: string;
}

/** Immutable snapshot taken at publish time. What a deployment points at. */
export interface SiteVersion {
  id: string;
  siteId: string;
  content: SiteContent;
  createdAt: string;
  note: string;
}

export interface Deployment {
  id: string;
  siteId: string;
  versionId: string;
  status: DeploymentStatus;
  hostDeploymentId: string | null;
  url: string | null;
  errorMessage: string | null;
  /** Deterministic per (site, version, attempt) so retries cannot double-deploy. */
  idempotencyKey: string;
  createdAt: string;
  finishedAt: string | null;
}

/** What we observed about a domain before asking anyone to change anything. */
export interface DnsSnapshot {
  takenAt: string;
  nameservers: string[];
  a: string[];
  aaaa: string[];
  cname: string[];
  mx: string[];
  txt: string[];
  registrar: string | null;
  expiresAt: string | null;
  /** True when MX or mail-related TXT records exist — nameserver moves are risky. */
  hasEmail: boolean;
  errors: string[];
}

export interface Domain {
  id: string;
  siteId: string;
  hostname: string;
  isApex: boolean;
  mode: DomainMode;
  state: DomainState;
  /** Nameservers we expect them to set (delegated_ns mode). */
  expectedNameservers: string[];
  /** Their nameservers before we touched anything, for rollback. */
  rollbackNameservers: string[];
  snapshot: DnsSnapshot | null;
  hostDomainId: string | null;
  emailSafetyAcknowledged: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
