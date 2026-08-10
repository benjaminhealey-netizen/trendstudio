import Link from "next/link";
import { createClientAction } from "@/app/actions";
import { StatusBadge, toneForClientStatus } from "@/components/StatusBadge";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const repo = getRepo();
  const clients = await repo.listClients();
  const sites = await repo.listSites();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-medium">Clients</h1>
        <p className="text-sm text-[var(--color-mist)]">
          Creating a client also creates their site and starter content.
        </p>
      </header>

      <section className="card">
        <h2 className="mb-4 text-sm font-medium">New client</h2>
        <form action={createClientAction} className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="name">
              Contact name
            </label>
            <input id="name" name="name" required className="field" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" required className="field" placeholder="jane@example.com" />
          </div>
          <div>
            <label className="label" htmlFor="businessName">
              Business name
            </label>
            <input id="businessName" name="businessName" className="field" placeholder="Jane Doe Photography" />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary">
              Create client and site
            </button>
          </div>
        </form>
      </section>

      <section>
        {clients.length ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-edge)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-panel)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Site</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const site = sites.find((s) => s.clientId === c.id);
                  return (
                    <tr key={c.id} className="border-t border-[var(--color-edge)]">
                      <td className="px-4 py-3">
                        <Link href={`/clients/${c.id}`} className="hover:text-[var(--color-brand)]">
                          {c.name}
                        </Link>
                        <div className="text-xs text-[var(--color-mist)]">{c.email}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-mist)]">{c.businessName}</td>
                      <td className="px-4 py-3">
                        <StatusBadge label={c.status} tone={toneForClientStatus(c.status)} />
                      </td>
                      <td className="px-4 py-3">
                        {site ? (
                          <Link href={`/sites/${site.id}`} className="text-[var(--color-brand)] hover:underline">
                            Edit site
                          </Link>
                        ) : (
                          <span className="text-[var(--color-mist)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-mist)]">No clients yet. Create the first one above.</p>
        )}
      </section>
    </div>
  );
}
