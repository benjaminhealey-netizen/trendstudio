import Link from "next/link";
import { StatusBadge, toneForDeployment } from "@/components/StatusBadge";
import { getRepo } from "@/lib/db";
import { STATE_COPY } from "@/lib/domains/service";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const repo = getRepo();
  const [clients, sites, domains, deployments, audit] = await Promise.all([
    repo.listClients(),
    repo.listSites(),
    repo.listDomains(),
    repo.listDeployments(),
    repo.listAudit(8),
  ]);

  const liveSites = sites.filter((s) => s.status === "published").length;
  const failed = deployments.filter((d) => d.status === "failed").length;
  const liveDomains = domains.filter((d) => d.state === "live").length;
  const needsAttention = domains.filter((d) => d.state === "failed" || d.state === "awaiting_dns_change");

  const stats = [
    { label: "Clients", value: clients.length, href: "/clients" },
    { label: "Live sites", value: liveSites, href: "/clients" },
    { label: "Live domains", value: `${liveDomains}/${domains.length}`, href: "/domains" },
    { label: "Failed deploys", value: failed, href: "/deployments" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-medium">Overview</h1>
        <p className="text-sm text-[var(--color-mist)]">Everything across every client.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card transition-colors hover:border-[var(--color-mist)]">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mist)]">{s.label}</p>
            <p className="mt-2 text-2xl font-medium">{s.value}</p>
          </Link>
        ))}
      </div>

      {needsAttention.length ? (
        <section className="card border-[#5c4a1c]">
          <h2 className="mb-3 text-sm font-medium">Domains needing attention</h2>
          <ul className="space-y-2 text-sm">
            {needsAttention.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3">
                <Link href="/domains" className="font-mono text-[13px] hover:text-[var(--color-brand)]">
                  {d.hostname}
                </Link>
                <StatusBadge label={STATE_COPY[d.state].label} tone={STATE_COPY[d.state].tone} />
                {d.lastError ? <span className="text-xs text-[var(--color-mist)]">{d.lastError}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-sm font-medium">Recent deployments</h2>
          {deployments.length ? (
            <ul className="space-y-2 text-sm">
              {deployments.slice(0, 6).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-[var(--color-mist)]">
                    {new Date(d.createdAt).toLocaleString()}
                  </span>
                  <StatusBadge label={d.status} tone={toneForDeployment(d.status)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-mist)]">Nothing published yet.</p>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-medium">Activity</h2>
          {audit.length ? (
            <ul className="space-y-2 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    <span className="font-mono text-[12px] text-[var(--color-brand)]">{a.action}</span>{" "}
                    <span className="text-[var(--color-mist)]">{a.resourceType}</span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-mist)]">
                    {new Date(a.createdAt).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-mist)]">No activity yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
