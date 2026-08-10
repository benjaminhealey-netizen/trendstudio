import type { SiteFile } from "../templates/types";

export interface PublishResult {
  hostDeploymentId: string;
  url: string;
}

export type HostDomainStatus = "pending" | "active" | "failed";

export interface HostDomain {
  id: string;
  hostname: string;
  status: HostDomainStatus;
  detail: string;
}

/**
 * The seam between the control plane and wherever client sites actually live.
 * LocalHost makes the whole dashboard usable with no Cloudflare account;
 * CloudflarePagesHost is the production implementation. Nothing above this
 * interface knows which one is in play.
 */
export interface SiteHost {
  readonly id: string;
  ensureProject(projectName: string): Promise<void>;
  publish(projectName: string, files: SiteFile[]): Promise<PublishResult>;
  attachDomain(projectName: string, hostname: string): Promise<HostDomain>;
  domainStatus(projectName: string, hostname: string): Promise<HostDomain | null>;
  removeDomain(projectName: string, hostname: string): Promise<void>;
}
