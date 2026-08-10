"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { siteContentSchema, starterContent } from "@/lib/content/schema";
import { getRepo } from "@/lib/db";
import { addDomain, checkDomain } from "@/lib/domains/service";
import { getSiteHost } from "@/lib/hosts";
import { publishSite } from "@/lib/services/publish";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates";
import type { DomainMode } from "@/lib/types";

/**
 * Middleware already blocks unauthenticated navigation, but server actions are
 * their own entry point — so every one of them re-checks the session rather
 * than trusting that it was reached through a guarded page.
 */
async function requireActor(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, config.sessionSecret);
  if (!session) redirect("/login");
  return session.email;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "site";
}

export async function createClientAction(formData: FormData) {
  const actor = await requireActor();
  const repo = getRepo();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim() || name;
  if (!name || !email) throw new Error("name and email are required");

  const client = await repo.createClient({ name, email, businessName, status: "draft" });

  // Cloudflare Pages project names must be globally unique within the account,
  // so the client id suffix is not decoration.
  const projectName = `${slugify(businessName)}-${client.id.split("_")[1].slice(0, 6)}`;
  const site = await repo.createSite({
    clientId: client.id,
    templateId: DEFAULT_TEMPLATE_ID,
    projectName,
    status: "draft",
    liveUrl: null,
    publishedAt: null,
    publishedVersionId: null,
  });
  await repo.saveDraft({
    siteId: site.id,
    content: starterContent(businessName, email),
    updatedAt: new Date().toISOString(),
  });
  await repo.appendAudit({
    actor,
    action: "client.create",
    resourceType: "client",
    resourceId: client.id,
    metadata: { projectName },
  });

  revalidatePath("/clients");
  redirect(`/sites/${site.id}`);
}

export async function deleteClientAction(formData: FormData) {
  const actor = await requireActor();
  const id = String(formData.get("clientId") ?? "");
  const repo = getRepo();
  await repo.deleteClient(id);
  await repo.appendAudit({
    actor,
    action: "client.delete",
    resourceType: "client",
    resourceId: id,
    metadata: {},
  });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClientStatusAction(formData: FormData) {
  const actor = await requireActor();
  const id = String(formData.get("clientId") ?? "");
  const status = String(formData.get("status") ?? "draft") as
    | "draft"
    | "provisioning"
    | "live"
    | "suspended";
  const repo = getRepo();
  await repo.updateClient(id, { status });
  await repo.appendAudit({
    actor,
    action: "client.status",
    resourceType: "client",
    resourceId: id,
    metadata: { status },
  });
  revalidatePath(`/clients/${id}`);
}

export async function saveDraftAction(siteId: string, content: unknown) {
  const actor = await requireActor();
  const parsed = siteContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false as const,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "content"}: ${i.message}`),
    };
  }
  const repo = getRepo();
  await repo.saveDraft({
    siteId,
    content: parsed.data,
    updatedAt: new Date().toISOString(),
  });
  await repo.appendAudit({
    actor,
    action: "site.save_draft",
    resourceType: "site",
    resourceId: siteId,
    metadata: {},
  });
  revalidatePath(`/sites/${siteId}`);
  return { ok: true as const, errors: [] as string[] };
}

export async function publishSiteAction(formData: FormData) {
  const actor = await requireActor();
  const siteId = String(formData.get("siteId") ?? "");
  const note = String(formData.get("note") ?? "");
  const versionId = String(formData.get("versionId") ?? "") || undefined;
  await publishSite(siteId, { actor, note, versionId });
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/deployments");
  revalidatePath("/");
}

export async function addDomainAction(formData: FormData) {
  const actor = await requireActor();
  const siteId = String(formData.get("siteId") ?? "");
  const hostname = String(formData.get("hostname") ?? "");
  const mode = (String(formData.get("mode") ?? "delegated_ns") as DomainMode) ?? "delegated_ns";
  await addDomain({ siteId, hostname, mode, actor });
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/domains");
}

export async function checkDomainAction(formData: FormData) {
  const actor = await requireActor();
  const domainId = String(formData.get("domainId") ?? "");
  await checkDomain(domainId, actor);
  revalidatePath("/domains");
  revalidatePath("/");
}

export async function acknowledgeEmailRiskAction(formData: FormData) {
  const actor = await requireActor();
  const domainId = String(formData.get("domainId") ?? "");
  const repo = getRepo();
  await repo.updateDomain(domainId, { emailSafetyAcknowledged: true });
  await repo.appendAudit({
    actor,
    action: "domain.email_ack",
    resourceType: "domain",
    resourceId: domainId,
    metadata: {},
  });
  revalidatePath("/domains");
}

export async function removeDomainAction(formData: FormData) {
  const actor = await requireActor();
  const domainId = String(formData.get("domainId") ?? "");
  const repo = getRepo();
  const domain = await repo.getDomain(domainId);
  if (domain) {
    const site = await repo.getSite(domain.siteId);
    if (site && domain.hostDomainId) {
      try {
        await getSiteHost().removeDomain(site.projectName, domain.hostname);
      } catch {
        // Detaching locally is still the right outcome even if the host call
        // fails; the audit log records that it was attempted.
      }
    }
    await repo.deleteDomain(domainId);
    await repo.appendAudit({
      actor,
      action: "domain.remove",
      resourceType: "domain",
      resourceId: domainId,
      metadata: { hostname: domain.hostname },
    });
  }
  revalidatePath("/domains");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
