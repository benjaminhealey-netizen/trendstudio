import "server-only";
import { siteContentSchema, type SiteContent } from "../content/schema";
import { getRepo } from "../db";
import { getSiteHost } from "../hosts";
import { getTemplate } from "../templates";
import type { Deployment, Site } from "../types";

export class PublishError extends Error {}

/**
 * Publishing is: snapshot the draft into an immutable version, render that
 * version, deploy it, record the result. Nothing renders from the draft, so
 * what is live is always exactly some version you can point at and roll back
 * to.
 */
export async function publishSite(
  siteId: string,
  opts: { actor: string; note?: string; versionId?: string } = { actor: "system" }
): Promise<{ deployment: Deployment; site: Site }> {
  const repo = getRepo();
  const host = getSiteHost();

  const site = await repo.getSite(siteId);
  if (!site) throw new PublishError(`site ${siteId} not found`);

  // Re-publishing an existing version is how rollback works.
  let version = opts.versionId ? await repo.getVersion(opts.versionId) : null;
  if (opts.versionId && !version) throw new PublishError(`version ${opts.versionId} not found`);

  if (!version) {
    const draft = await repo.getDraft(siteId);
    if (!draft) throw new PublishError("site has no draft content");
    const parsed = siteContentSchema.safeParse(draft.content);
    if (!parsed.success) {
      throw new PublishError(
        `content is not valid: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`
      );
    }
    version = await repo.createVersion({
      siteId,
      content: parsed.data,
      note: opts.note ?? "",
    });
  }

  const attempt = (await repo.listDeployments(siteId)).filter((d) => d.versionId === version.id).length;
  const idempotencyKey = `${siteId}:${version.id}:${attempt}`;

  const existing = await repo.findDeploymentByKey(idempotencyKey);
  if (existing && existing.status === "success") {
    return { deployment: existing, site };
  }

  const deployment =
    existing ??
    (await repo.createDeployment({
      siteId,
      versionId: version.id,
      status: "building",
      hostDeploymentId: null,
      url: null,
      errorMessage: null,
      idempotencyKey,
      finishedAt: null,
    }));

  try {
    const origin = await resolveOrigin(siteId, version.content);
    const files = getTemplate(site.templateId).render(version.content, { origin, preview: false });
    const result = await host.publish(site.projectName, files);

    const finished = await repo.updateDeployment(deployment.id, {
      status: "success",
      hostDeploymentId: result.hostDeploymentId,
      url: result.url,
      finishedAt: new Date().toISOString(),
    });
    const updatedSite = await repo.updateSite(siteId, {
      status: "published",
      liveUrl: origin || result.url,
      publishedAt: new Date().toISOString(),
      publishedVersionId: version.id,
    });
    await repo.appendAudit({
      actor: opts.actor,
      action: "site.publish",
      resourceType: "site",
      resourceId: siteId,
      metadata: { versionId: version.id, host: host.id, url: result.url },
    });
    return { deployment: finished, site: updatedSite };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await repo.updateDeployment(deployment.id, {
      status: "failed",
      errorMessage: message,
      finishedAt: new Date().toISOString(),
    });
    await repo.appendAudit({
      actor: opts.actor,
      action: "site.publish_failed",
      resourceType: "site",
      resourceId: siteId,
      metadata: { versionId: version.id, error: message },
    });
    return { deployment: failed, site };
  }
}

/** The live domain wins over whatever is typed into the SEO field. */
async function resolveOrigin(siteId: string, content: SiteContent): Promise<string> {
  const domains = await getRepo().listDomains(siteId);
  const live = domains.find((d) => d.state === "live") ?? domains.find((d) => d.state === "attached");
  if (live) return `https://${live.hostname}`;
  return content.seo.canonicalOrigin || "";
}

/** Renders the draft for the editor's preview pane — same renderer, noindex. */
export async function renderPreview(siteId: string): Promise<string> {
  const repo = getRepo();
  const site = await repo.getSite(siteId);
  if (!site) throw new PublishError(`site ${siteId} not found`);
  const draft = await repo.getDraft(siteId);
  if (!draft) throw new PublishError("site has no draft content");

  const parsed = siteContentSchema.safeParse(draft.content);
  if (!parsed.success) {
    return errorPage(
      parsed.error.issues.map((i) => `${i.path.join(".") || "content"}: ${i.message}`)
    );
  }
  const files = getTemplate(site.templateId).render(parsed.data, { origin: "", preview: true });
  return files.find((f) => f.path === "index.html")?.content ?? errorPage(["template produced no index.html"]);
}

function errorPage(problems: string[]): string {
  const items = problems
    .map((p) => `<li>${p.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</li>`)
    .join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Preview unavailable</title>
<style>body{font:16px/1.6 ui-sans-serif,system-ui,sans-serif;padding:3rem;color:#7f1d1d;background:#fef2f2}
h1{font-size:1.2rem}li{margin:.4rem 0}</style></head>
<body><h1>This content can't be rendered yet</h1><ul>${items}</ul></body></html>`;
}
