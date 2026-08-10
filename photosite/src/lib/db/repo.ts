import type {
  AuditLog,
  Client,
  Deployment,
  Domain,
  Site,
  SiteDraft,
  SiteVersion,
} from "../types";

/**
 * Every read and write goes through this interface so the app can run with no
 * accounts at all (LocalRepo) and switch to Supabase with one env var.
 */
export interface Repo {
  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | null>;
  createClient(input: Omit<Client, "id" | "createdAt">): Promise<Client>;
  updateClient(id: string, patch: Partial<Omit<Client, "id">>): Promise<Client>;
  deleteClient(id: string): Promise<void>;

  listSites(): Promise<Site[]>;
  getSite(id: string): Promise<Site | null>;
  getSiteByClient(clientId: string): Promise<Site | null>;
  createSite(input: Omit<Site, "id" | "createdAt">): Promise<Site>;
  updateSite(id: string, patch: Partial<Omit<Site, "id">>): Promise<Site>;

  getDraft(siteId: string): Promise<SiteDraft | null>;
  saveDraft(draft: SiteDraft): Promise<SiteDraft>;

  createVersion(input: Omit<SiteVersion, "id" | "createdAt">): Promise<SiteVersion>;
  getVersion(id: string): Promise<SiteVersion | null>;
  listVersions(siteId: string): Promise<SiteVersion[]>;

  listDeployments(siteId?: string): Promise<Deployment[]>;
  getDeployment(id: string): Promise<Deployment | null>;
  findDeploymentByKey(key: string): Promise<Deployment | null>;
  createDeployment(input: Omit<Deployment, "id" | "createdAt">): Promise<Deployment>;
  updateDeployment(id: string, patch: Partial<Omit<Deployment, "id">>): Promise<Deployment>;

  listDomains(siteId?: string): Promise<Domain[]>;
  getDomain(id: string): Promise<Domain | null>;
  findDomainByHostname(hostname: string): Promise<Domain | null>;
  createDomain(input: Omit<Domain, "id" | "createdAt">): Promise<Domain>;
  updateDomain(id: string, patch: Partial<Omit<Domain, "id">>): Promise<Domain>;
  deleteDomain(id: string): Promise<void>;

  listAudit(limit?: number): Promise<AuditLog[]>;
  appendAudit(input: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog>;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
