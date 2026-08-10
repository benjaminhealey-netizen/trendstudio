import { notFound } from "next/navigation";
import { getRepo } from "@/lib/db";
import { instructionsFor, STATE_COPY } from "@/lib/domains/service";

export const dynamic = "force-dynamic";

/**
 * The page you send the client. Public on purpose — it has no account data on
 * it beyond their own domain, and asking a photographer to log in to read DNS
 * instructions is how a five-minute task becomes a phone call.
 */
export default async function HandoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  const domain = await repo.getDomain(id);
  if (!domain) notFound();
  const site = await repo.getSite(domain.siteId);
  if (!site) notFound();

  const steps = instructionsFor(domain, site);
  const state = STATE_COPY[domain.state];
  const done = domain.state === "live";

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-mist)]">
        Connecting your domain
      </p>
      <h1 className="mt-2 font-mono text-2xl">{domain.hostname}</h1>

      <div
        className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
          done
            ? "border-[#2c5138] bg-[#132218] text-[#7ee2a0]"
            : "border-[#5c4a1c] bg-[#241d0c] text-[#e5c66b]"
        }`}
      >
        <strong className="font-medium">{state.label}.</strong>{" "}
        {done
          ? "Your website is live on your domain. Nothing else to do."
          : "Follow the steps below. This page updates itself when we can see the change."}
      </div>

      {!done ? (
        <ol className="mt-10 space-y-8">
          {steps.map((step, i) => (
            <li key={step.title} className="border-l border-[var(--color-edge)] pl-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-mist)]">
                Step {i + 1}
              </p>
              <h2 className="mt-1 text-base font-medium">{step.title}</h2>
              <p className="mt-1 text-sm text-[var(--color-mist)]">{step.detail}</p>
              {step.values?.length ? (
                <dl className="mt-3 space-y-2 rounded-md border border-[var(--color-edge)] bg-[var(--color-panel)] p-4">
                  {step.values.map((v) => (
                    <div key={v.label} className="flex flex-wrap items-baseline justify-between gap-2">
                      <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
                        {v.label}
                      </dt>
                      <dd className="font-mono text-sm select-all">{v.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <p className="mt-12 text-xs text-[var(--color-mist)]">
        Your domain stays registered in your own account and in your name. Nothing here transfers it,
        renews it or charges you for it.
      </p>
    </main>
  );
}
