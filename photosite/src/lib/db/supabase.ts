import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditLog,
  Client,
  Deployment,
  Domain,
  Site,
  SiteDraft,
  SiteVersion,
} from "../types";
import type { Repo } from "./repo";

/**
 * Supabase implementation. Uses the service-role key and therefore must only
 * ever be constructed on the server. RLS is deny-all in the migration, so a
 * leaked anon key grants nothing.
 */
export class SupabaseRepo implements Repo {
  private sb: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.sb = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async one<T>(promise: PromiseLike<{ data: unknown; error: { message: string } | null }>, map: (row: never) => T): Promise<T> {
    const { data, error } = await promise;
    if (error) throw new Error(error.message);
    if (!data) throw new Error("no row returned");
    return map(data as never);
  }

  private async maybe<T>(promise: PromiseLike<{ data: unknown; error: { message: string } | null }>, map: (row: never) => T): Promise<T | null> {
    const { data, error } = await promise;
    if (error) throw new Error(error.message);
    return data ? map(data as never) : null;
  }

  private async many<T>(promise: PromiseLike<{ data: unknown; error: { message: string } | null }>, map: (row: never) => T): Promise<T[]> {
    const { data, error } = await promise;
    if (error) throw new Error(error.message);
    return ((data ?? []) as never[]).map(map);
  }

  // --- clients -------------------------------------------------------------
  listClients() {
    return this.many(
      this.sb.from("clients").select("*").order("created_at", { ascending: false }),
      toClient
    );
  }
  getClient(id: string) {
    return this.maybe(this.sb.from("clients").select("*").eq("id", id).maybeSingle(), toClient);
  }
  createClient(input: Omit<Client, "id" | "createdAt">) {
    return this.one(
      this.sb
        .from("clients")
        .insert({
          name: input.name,
          email: input.email,
          business_name: input.businessName,
          status: input.status,
        })
        .select()
        .single(),
      toClient
    );
  }
  updateClient(id: string, patch: Partial<Omit<Client, "id">>) {
    return this.one(
      this.sb.from("clients").update(fromClient(patch)).eq("id", id).select().single(),
      toClient
    );
  }
  async deleteClient(id: string) {
    const { error } = await this.sb.from("clients").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  // --- sites ---------------------------------------------------------------
  listSites() {
    return this.many(this.sb.from("sites").select("*"), toSite);
  }
  getSite(id: string) {
    return this.maybe(this.sb.from("sites").select("*").eq("id", id).maybeSingle(), toSite);
  }
  getSiteByClient(clientId: string) {
    return this.maybe(
      this.sb.from("sites").select("*").eq("client_id", clientId).maybeSingle(),
      toSite
    );
  }
  createSite(input: Omit<Site, "id" | "createdAt">) {
    return this.one(this.sb.from("sites").insert(fromSite(input)).select().single(), toSite);
  }
  updateSite(id: string, patch: Partial<Omit<Site, "id">>) {
    return this.one(
      this.sb.from("sites").update(fromSite(patch)).eq("id", id).select().single(),
      toSite
    );
  }

  // --- drafts --------------------------------------------------------------
  getDraft(siteId: string) {
    return this.maybe(
      this.sb.from("site_drafts").select("*").eq("site_id", siteId).maybeSingle(),
      toDraft
    );
  }
  saveDraft(draft: SiteDraft) {
    return this.one(
      this.sb
        .from("site_drafts")
        .upsert(
          { site_id: draft.siteId, content: draft.content, updated_at: new Date().toISOString() },
          { onConflict: "site_id" }
        )
        .select()
        .single(),
      toDraft
    );
  }

  // --- versions ------------------------------------------------------------
  createVersion(input: Omit<SiteVersion, "id" | "createdAt">) {
    return this.one(
      this.sb
        .from("site_versions")
        .insert({ site_id: input.siteId, content: input.content, note: input.note })
        .select()
        .single(),
      toVersion
    );
  }
  getVersion(id: string) {
    return this.maybe(
      this.sb.from("site_versions").select("*").eq("id", id).maybeSingle(),
      toVersion
    );
  }
  listVersions(siteId: string) {
    return this.many(
      this.sb
        .from("site_versions")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false }),
      toVersion
    );
  }

  // --- deployments ---------------------------------------------------------
  listDeployments(siteId?: string) {
    let q = this.sb.from("deployments").select("*").order("created_at", { ascending: false });
    if (siteId) q = q.eq("site_id", siteId);
    return this.many(q, toDeployment);
  }
  getDeployment(id: string) {
    return this.maybe(
      this.sb.from("deployments").select("*").eq("id", id).maybeSingle(),
      toDeployment
    );
  }
  findDeploymentByKey(key: string) {
    return this.maybe(
      this.sb.from("deployments").select("*").eq("idempotency_key", key).maybeSingle(),
      toDeployment
    );
  }
  async createDeployment(input: Omit<Deployment, "id" | "createdAt">) {
    const existing = await this.findDeploymentByKey(input.idempotencyKey);
    if (existing) return existing;
    return this.one(
      this.sb.from("deployments").insert(fromDeployment(input)).select().single(),
      toDeployment
    );
  }
  updateDeployment(id: string, patch: Partial<Omit<Deployment, "id">>) {
    return this.one(
      this.sb.from("deployments").update(fromDeployment(patch)).eq("id", id).select().single(),
      toDeployment
    );
  }

  // --- domains -------------------------------------------------------------
  listDomains(siteId?: string) {
    let q = this.sb.from("domains").select("*");
    if (siteId) q = q.eq("site_id", siteId);
    return this.many(q, toDomain);
  }
  getDomain(id: string) {
    return this.maybe(this.sb.from("domains").select("*").eq("id", id).maybeSingle(), toDomain);
  }
  findDomainByHostname(hostname: string) {
    return this.maybe(
      this.sb.from("domains").select("*").eq("hostname", hostname).maybeSingle(),
      toDomain
    );
  }
  createDomain(input: Omit<Domain, "id" | "createdAt">) {
    return this.one(this.sb.from("domains").insert(fromDomain(input)).select().single(), toDomain);
  }
  updateDomain(id: string, patch: Partial<Omit<Domain, "id">>) {
    return this.one(
      this.sb.from("domains").update(fromDomain(patch)).eq("id", id).select().single(),
      toDomain
    );
  }
  async deleteDomain(id: string) {
    const { error } = await this.sb.from("domains").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  // --- audit ---------------------------------------------------------------
  listAudit(limit = 100) {
    return this.many(
      this.sb
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
      toAudit
    );
  }
  appendAudit(input: Omit<AuditLog, "id" | "createdAt">) {
    return this.one(
      this.sb
        .from("audit_logs")
        .insert({
          actor: input.actor,
          action: input.action,
          resource_type: input.resourceType,
          resource_id: input.resourceId,
          metadata: input.metadata,
        })
        .select()
        .single(),
      toAudit
    );
  }
}

// --- row mapping -----------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */

function toClient(r: any): Client {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    businessName: r.business_name,
    status: r.status,
    createdAt: r.created_at,
  };
}
function fromClient(p: Partial<Client>) {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.email !== undefined) out.email = p.email;
  if (p.businessName !== undefined) out.business_name = p.businessName;
  if (p.status !== undefined) out.status = p.status;
  return out;
}

function toSite(r: any): Site {
  return {
    id: r.id,
    clientId: r.client_id,
    templateId: r.template_id,
    projectName: r.project_name,
    status: r.status,
    liveUrl: r.live_url,
    publishedAt: r.published_at,
    publishedVersionId: r.published_version_id,
    createdAt: r.created_at,
  };
}
function fromSite(p: Partial<Site>) {
  const out: Record<string, unknown> = {};
  if (p.clientId !== undefined) out.client_id = p.clientId;
  if (p.templateId !== undefined) out.template_id = p.templateId;
  if (p.projectName !== undefined) out.project_name = p.projectName;
  if (p.status !== undefined) out.status = p.status;
  if (p.liveUrl !== undefined) out.live_url = p.liveUrl;
  if (p.publishedAt !== undefined) out.published_at = p.publishedAt;
  if (p.publishedVersionId !== undefined) out.published_version_id = p.publishedVersionId;
  return out;
}

function toDraft(r: any): SiteDraft {
  return { siteId: r.site_id, content: r.content, updatedAt: r.updated_at };
}

function toVersion(r: any): SiteVersion {
  return {
    id: r.id,
    siteId: r.site_id,
    content: r.content,
    note: r.note ?? "",
    createdAt: r.created_at,
  };
}

function toDeployment(r: any): Deployment {
  return {
    id: r.id,
    siteId: r.site_id,
    versionId: r.version_id,
    status: r.status,
    hostDeploymentId: r.host_deployment_id,
    url: r.url,
    errorMessage: r.error_message,
    idempotencyKey: r.idempotency_key,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  };
}
function fromDeployment(p: Partial<Deployment>) {
  const out: Record<string, unknown> = {};
  if (p.siteId !== undefined) out.site_id = p.siteId;
  if (p.versionId !== undefined) out.version_id = p.versionId;
  if (p.status !== undefined) out.status = p.status;
  if (p.hostDeploymentId !== undefined) out.host_deployment_id = p.hostDeploymentId;
  if (p.url !== undefined) out.url = p.url;
  if (p.errorMessage !== undefined) out.error_message = p.errorMessage;
  if (p.idempotencyKey !== undefined) out.idempotency_key = p.idempotencyKey;
  if (p.finishedAt !== undefined) out.finished_at = p.finishedAt;
  return out;
}

function toDomain(r: any): Domain {
  return {
    id: r.id,
    siteId: r.site_id,
    hostname: r.hostname,
    isApex: r.is_apex,
    mode: r.mode,
    state: r.state,
    expectedNameservers: r.expected_nameservers ?? [],
    rollbackNameservers: r.rollback_nameservers ?? [],
    snapshot: r.snapshot,
    hostDomainId: r.host_domain_id,
    emailSafetyAcknowledged: r.email_safety_acknowledged,
    lastCheckedAt: r.last_checked_at,
    lastError: r.last_error,
    createdAt: r.created_at,
  };
}
function fromDomain(p: Partial<Domain>) {
  const out: Record<string, unknown> = {};
  if (p.siteId !== undefined) out.site_id = p.siteId;
  if (p.hostname !== undefined) out.hostname = p.hostname;
  if (p.isApex !== undefined) out.is_apex = p.isApex;
  if (p.mode !== undefined) out.mode = p.mode;
  if (p.state !== undefined) out.state = p.state;
  if (p.expectedNameservers !== undefined) out.expected_nameservers = p.expectedNameservers;
  if (p.rollbackNameservers !== undefined) out.rollback_nameservers = p.rollbackNameservers;
  if (p.snapshot !== undefined) out.snapshot = p.snapshot;
  if (p.hostDomainId !== undefined) out.host_domain_id = p.hostDomainId;
  if (p.emailSafetyAcknowledged !== undefined)
    out.email_safety_acknowledged = p.emailSafetyAcknowledged;
  if (p.lastCheckedAt !== undefined) out.last_checked_at = p.lastCheckedAt;
  if (p.lastError !== undefined) out.last_error = p.lastError;
  return out;
}

function toAudit(r: any): AuditLog {
  return {
    id: r.id,
    actor: r.actor,
    action: r.action,
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    metadata: r.metadata ?? {},
    createdAt: r.created_at,
  };
}
