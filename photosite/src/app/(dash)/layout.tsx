import Link from "next/link";
import { logoutAction } from "../actions";
import { config, configWarnings } from "@/lib/config";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/clients", label: "Clients" },
  { href: "/domains", label: "Domains" },
  { href: "/deployments", label: "Deployments" },
  { href: "/billing", label: "Billing" },
];

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const warnings = configWarnings();
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--color-edge)] p-5 md:flex">
        <Link href="/" className="mb-8 block text-sm font-semibold tracking-[0.16em] uppercase">
          PhotoSite
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-[var(--color-mist)] hover:bg-[var(--color-panel)] hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 pt-6">
          <p className="px-3 text-[11px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
            data: {config.dataBackend} · host: {config.siteHost}
          </p>
          <form action={logoutAction}>
            <button type="submit" className="btn-ghost w-full text-xs">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {warnings.length ? (
          <div className="border-b border-[#4a3a12] bg-[#241d0c] px-6 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#e5c66b]">
              Running in development configuration
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-[#d8c89a]">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
