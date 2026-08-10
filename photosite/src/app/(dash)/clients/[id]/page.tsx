import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteClientAction, updateClientStatusAction } from "@/app/actions";
import { StatusBadge, toneForClientStatus, toneForDeployment } from "@/components/StatusBadge";
import { getRepo } from "@/lib/db";
import { STATE_COPY } from "@/lib/domains/service";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  const client = await repo.getClient(id);
  if (!client) notFound();

  const site = await repo.getSiteByClient(client.id);
  const [domains, deployments] = await Promise.all([
    site ? repo.listDomains(site.id) : Promise.resolve([]),
    site ? repo.listDeployments(site.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/clients" className="text-xs text-[var(--color-mist)] hover:text-white">
            ← Clients
          </Link>
          <h1 className="mt-1 text-xl font-medium">{client.businessName}</h1>
          <p className="text-sm text-[var(--color-mist)]">
            {client.name} · {client.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge label={client.status} tone={toneForClientStatus(client.status)} />
          {site ? (
            <Link href={`/sites/${site.id}`} className="btn-primary">
              Open site editor
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-sm font-medium">Site</h2>
          {site ? (
            <dl className="space-y-2 text-sm">
              <Row label="Template" value={site.templateId} />
              <Row label="Project name" value={site.projectName} mono />
              <Row label="Status" value={site.status} />
              <Row label="Live URL" value={site.liveUrl ?? "—"} link={site.liveUrl ?? undefined} />
              <Row
                label="Published"
                value={site.publishedAt ? new Date(site.publishedAt).toLocaleString() : "Never"}
              />
            </dl>
          ) : (
            <p className="text-sm text-[var(--color-mist)]">No site for this client.</p>
          )}
        </section>

        <section className="card">
          <h2 className="mb-4 text-sm font-medium">Account status</h2>
          <form action={updateClientStatusAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="clientId" value={client.id} />
            <div className="min-w-[10rem] flex-1">
              <label className="label" htmlFor="status">
                Status
              </label>
              <select id="status" name="status" defaultValue={client.status} className="field">
                <option value="draft">Draft</option>
                <option value="provisioning">Provisioning</option>
                <option value="live">Live</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <button type="submit" className="btn-ghost">
              Update
            </button>
          </form>
          <p className="mt-3 text-xs text-[var(--color-mist)]">
            Suspending is a record only right now — enforcement belongs with billing, which is a later
            phase.
          </p>
        </section>

        <section className="card">
          <h2 className="mb-4 text-sm font-medium">Domains</h2>
          {domains.length ? (
            <ul className="space-y-3 text-sm">
              {domains.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[13px]">{d.hostname}</span>
                  <StatusBadge label={STATE_COPY[d.state].label} tone={STATE_COPY[d.state].tone} />
                  <Link href={`/handoff/${d.id}`} className="text-xs text-[var(--color-brand)] hover:underline">
                    Client instructions
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-mist)]">
              No domain yet. Add one from the site editor.
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="mb-4 text-sm font-medium">Deployments</h2>
          {deployments.length ? (
            <ul className="space-y-2 text-sm">
              {deployments.slice(0, 6).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-mist)]">{new Date(d.createdAt).toLocaleString()}</span>
                  <StatusBadge label={d.status} tone={toneForDeployment(d.status)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-mist)]">Never deployed.</p>
          )}
        </section>
      </div>

      <section className="card border-[#5c2626]">
        <h2 className="mb-2 text-sm font-medium text-[#f19393]">Delete client</h2>
        <p className="mb-4 text-xs text-[var(--color-mist)]">
          Removes the client, their site, content, versions, deployments and domain records from this
          dashboard. It does not delete anything at Cloudflare and does not touch their registrar.
        </p>
        <form action={deleteClientAction}>
          <input type="hidden" name="clientId" value={client.id} />
          <button type="submit" className="btn-danger">
            Delete {client.businessName}
          </button>
        </form>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mist)]">{label}</dt>
      <dd className={`truncate text-right ${mono ? "font-mono text-[13px]" : ""}`}>
        {link ? (
          <a href={link} target="_blank" rel="noopener" className="text-[var(--color-brand)] hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
