import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Stripe is a later phase on purpose: the dashboard has to be able to create,
 * edit, publish and connect a site before charging for it means anything. The
 * subscriptions table exists in the migration already so wiring it up later is
 * additive.
 */
export default async function BillingPage() {
  const clients = await getRepo().listClients();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-medium">Billing</h1>
        <p className="text-sm text-[var(--color-mist)]">Not wired up yet.</p>
      </header>

      <section className="card">
        <h2 className="mb-2 text-sm font-medium">What is left to do here</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-mist)]">
          <li>Stripe Checkout session per plan, with price IDs read from environment variables.</li>
          <li>Webhook endpoint with signature verification as the only source of subscription truth.</li>
          <li>
            Map <code className="font-mono text-xs">active / past_due / canceled / incomplete</code> onto
            client status.
          </li>
          <li>Decide what a suspended site actually serves before the first non-payment.</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-medium">Clients that would be billed</h2>
        {clients.length ? (
          <ul className="space-y-1 text-sm">
            {clients.map((c) => (
              <li key={c.id} className="flex justify-between gap-4">
                <span>{c.businessName}</span>
                <span className="text-[var(--color-mist)]">{c.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-mist)]">No clients yet.</p>
        )}
      </section>
    </div>
  );
}
