import Link from "next/link";
import { publishSiteAction } from "@/app/actions";
import { StatusBadge, toneForDeployment } from "@/components/StatusBadge";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DeploymentsPage() {
  const repo = getRepo();
  const [deployments, sites, clients] = await Promise.all([
    repo.listDeployments(),
    repo.listSites(),
    repo.listClients(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-medium">Deployments</h1>
        <p className="text-sm text-[var(--color-mist)]">
          Every publish, what it deployed, and what went wrong when it failed.
        </p>
      </header>

      {deployments.length ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-edge)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-panel)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => {
                const site = sites.find((s) => s.id === d.siteId);
                const client = clients.find((c) => c.id === site?.clientId);
                return (
                  <tr key={d.id} className="border-t border-[var(--color-edge)] align-top">
                    <td className="px-4 py-3 text-[var(--color-mist)]">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {site ? (
                        <Link href={`/sites/${site.id}`} className="hover:text-[var(--color-brand)]">
                          {client?.businessName ?? site.projectName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={d.status} tone={toneForDeployment(d.status)} />
                    </td>
                    <td className="max-w-md px-4 py-3">
                      {d.errorMessage ? (
                        <span className="text-xs text-[#f19393]">{d.errorMessage}</span>
                      ) : d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener"
                          className="text-xs text-[var(--color-brand)] hover:underline"
                        >
                          {d.url}
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--color-mist)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {site ? (
                        <form action={publishSiteAction}>
                          <input type="hidden" name="siteId" value={site.id} />
                          <input type="hidden" name="versionId" value={d.versionId} />
                          <button type="submit" className="btn-ghost px-3 py-1 text-xs">
                            Re-deploy
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-mist)]">Nothing has been published yet.</p>
      )}
    </div>
  );
}
