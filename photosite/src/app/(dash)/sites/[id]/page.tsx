import Link from "next/link";
import { notFound } from "next/navigation";
import { addDomainAction, publishSiteAction } from "@/app/actions";
import { SiteEditor } from "@/components/SiteEditor";
import { StatusBadge, toneForDeployment } from "@/components/StatusBadge";
import { siteContentSchema, starterContent } from "@/lib/content/schema";
import { getRepo } from "@/lib/db";
import { STATE_COPY } from "@/lib/domains/service";

export const dynamic = "force-dynamic";

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  const site = await repo.getSite(id);
  if (!site) notFound();

  const [client, draft, versions, deployments, domains] = await Promise.all([
    repo.getClient(site.clientId),
    repo.getDraft(site.id),
    repo.listVersions(site.id),
    repo.listDeployments(site.id),
    repo.listDomains(site.id),
  ]);

  const parsed = siteContentSchema.safeParse(draft?.content);
  const content = parsed.success
    ? parsed.data
    : starterContent(client?.businessName ?? "New site", client?.email ?? "hello@example.com");
  const lastDeployment = deployments[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {client ? (
            <Link href={`/clients/${client.id}`} className="text-xs text-[var(--color-mist)] hover:text-white">
              ← {client.businessName}
            </Link>
          ) : null}
          <h1 className="mt-1 text-xl font-medium">Site editor</h1>
          <p className="font-mono text-xs text-[var(--color-mist)]">{site.projectName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lastDeployment ? (
            <StatusBadge label={`last deploy: ${lastDeployment.status}`} tone={toneForDeployment(lastDeployment.status)} />
          ) : null}
          {site.liveUrl ? (
            <a href={site.liveUrl} target="_blank" rel="noopener" className="btn-ghost">
              View live
            </a>
          ) : null}
          <form action={publishSiteAction}>
            <input type="hidden" name="siteId" value={site.id} />
            <button type="submit" className="btn-primary">
              Publish
            </button>
          </form>
        </div>
      </header>

      {lastDeployment?.status === "failed" && lastDeployment.errorMessage ? (
        <p className="rounded-md border border-[#5c2626] bg-[#2a1414] px-4 py-3 text-sm text-[#f19393]">
          Last publish failed: {lastDeployment.errorMessage}
        </p>
      ) : null}

      <SiteEditor siteId={site.id} initialContent={content} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-sm font-medium">Domain</h2>
          {domains.length ? (
            <ul className="mb-4 space-y-2 text-sm">
              {domains.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[13px]">{d.hostname}</span>
                  <StatusBadge label={STATE_COPY[d.state].label} tone={STATE_COPY[d.state].tone} />
                  <Link href="/domains" className="text-xs text-[var(--color-brand)] hover:underline">
                    Manage
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <form action={addDomainAction} className="space-y-3">
            <input type="hidden" name="siteId" value={site.id} />
            <div>
              <label className="label" htmlFor="hostname">
                Their domain
              </label>
              <input id="hostname" name="hostname" required className="field" placeholder="janedoe.com" />
            </div>
            <div>
              <label className="label" htmlFor="mode">
                How DNS will work
              </label>
              <select id="mode" name="mode" className="field" defaultValue="delegated_ns">
                <option value="delegated_ns">They point nameservers at us (works for apex)</option>
                <option value="external_dns">They keep DNS and add a CNAME (subdomain/www only)</option>
              </select>
            </div>
            <button type="submit" className="btn-ghost">
              Add domain and check DNS
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="mb-4 text-sm font-medium">Version history</h2>
          {versions.length ? (
            <ul className="space-y-2 text-sm">
              {versions.slice(0, 10).map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[var(--color-mist)]">
                    {new Date(v.createdAt).toLocaleString()}
                    {site.publishedVersionId === v.id ? (
                      <span className="ml-2 text-[#7ee2a0]">live</span>
                    ) : null}
                  </span>
                  {site.publishedVersionId === v.id ? null : (
                    <form action={publishSiteAction}>
                      <input type="hidden" name="siteId" value={site.id} />
                      <input type="hidden" name="versionId" value={v.id} />
                      <button type="submit" className="btn-ghost px-3 py-1 text-xs">
                        Roll back to this
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-mist)]">
              No versions yet. Publishing snapshots the draft into an immutable version you can roll back
              to.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
