import Link from "next/link";
import {
  acknowledgeEmailRiskAction,
  checkDomainAction,
  removeDomainAction,
} from "@/app/actions";
import { StatusBadge } from "@/components/StatusBadge";
import { getRepo } from "@/lib/db";
import { cnameTarget, STATE_COPY } from "@/lib/domains/service";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  const repo = getRepo();
  const domains = await repo.listDomains();
  const sites = await repo.listSites();
  const clients = await repo.listClients();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-medium">Domains</h1>
        <p className="text-sm text-[var(--color-mist)]">
          Clients own their domains. We only ask them to point DNS at us — nothing here registers,
          renews or transfers anything.
        </p>
      </header>

      {domains.length === 0 ? (
        <p className="text-sm text-[var(--color-mist)]">
          No domains yet. Add one from a site editor.
        </p>
      ) : null}

      <div className="space-y-5">
        {domains.map((domain) => {
          const site = sites.find((s) => s.id === domain.siteId);
          const client = clients.find((c) => c.id === site?.clientId);
          const snap = domain.snapshot;
          const needsAck =
            domain.mode === "delegated_ns" && snap?.hasEmail && !domain.emailSafetyAcknowledged;

          return (
            <section key={domain.id} className="card space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-mono text-base">{domain.hostname}</h2>
                  <p className="text-xs text-[var(--color-mist)]">
                    {client?.businessName ?? "unknown client"} ·{" "}
                    {domain.mode === "delegated_ns" ? "nameserver delegation" : "external DNS"}
                    {domain.isApex ? " · apex" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={STATE_COPY[domain.state].label} tone={STATE_COPY[domain.state].tone} />
                  <Link href={`/handoff/${domain.id}`} className="btn-ghost px-3 py-1 text-xs">
                    Client instructions
                  </Link>
                  <form action={checkDomainAction}>
                    <input type="hidden" name="domainId" value={domain.id} />
                    <button type="submit" className="btn-ghost px-3 py-1 text-xs">
                      Check now
                    </button>
                  </form>
                </div>
              </div>

              {domain.lastError ? (
                <p className="rounded-md border border-[#5c4a1c] bg-[#241d0c] px-3 py-2 text-xs text-[#e5c66b]">
                  {domain.lastError}
                </p>
              ) : null}

              {needsAck ? (
                <div className="rounded-md border border-[#5c2626] bg-[#2a1414] p-4">
                  <h3 className="mb-1 text-sm font-medium text-[#f19393]">
                    This domain carries email — do not move nameservers yet
                  </h3>
                  <p className="mb-3 text-xs text-[var(--color-mist)]">
                    Moving nameservers without recreating these records will stop their mail from
                    arriving. Copy them into the new zone first, then confirm.
                  </p>
                  <ul className="mb-3 space-y-1 font-mono text-[11px] text-[#d8c89a]">
                    {snap?.mx.map((m) => (
                      <li key={m}>MX {m}</li>
                    ))}
                    {snap?.txt
                      .filter((t) => /v=spf1|v=DMARC1/i.test(t))
                      .map((t) => (
                        <li key={t}>TXT {t}</li>
                      ))}
                  </ul>
                  <form action={acknowledgeEmailRiskAction}>
                    <input type="hidden" name="domainId" value={domain.id} />
                    <button type="submit" className="btn-danger text-xs">
                      I have recreated these records — continue
                    </button>
                  </form>
                </div>
              ) : null}

              <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <Fact label="Registrar" value={snap?.registrar ?? "unknown"} />
                <Fact
                  label="Expires"
                  value={snap?.expiresAt ? new Date(snap.expiresAt).toLocaleDateString() : "unknown"}
                />
                <Fact label="Nameservers" value={snap?.nameservers.join(", ") || "—"} />
                <Fact
                  label={domain.mode === "delegated_ns" ? "Expected NS" : "CNAME target"}
                  value={
                    domain.mode === "delegated_ns"
                      ? domain.expectedNameservers.join(", ") || "not configured"
                      : site
                        ? cnameTarget(site)
                        : "—"
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[var(--color-edge)] pt-3">
                <span className="text-[11px] text-[var(--color-mist)]">
                  {domain.lastCheckedAt
                    ? `Last checked ${new Date(domain.lastCheckedAt).toLocaleString()}`
                    : "Never checked"}
                </span>
                <form action={removeDomainAction}>
                  <input type="hidden" name="domainId" value={domain.id} />
                  <button type="submit" className="btn-danger px-3 py-1 text-xs">
                    Detach
                  </button>
                </form>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label mb-0.5">{label}</p>
      <p className="break-words font-mono text-[11px] text-[#ececf1]">{value}</p>
    </div>
  );
}
