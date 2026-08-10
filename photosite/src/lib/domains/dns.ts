import type { DnsSnapshot } from "../types";

const DOH = "https://cloudflare-dns.com/dns-query";
const RDAP = "https://rdap.org/domain";

/**
 * Everything here is read-only reconnaissance over public endpoints: no
 * credentials, no account, no cost. It runs before we ask a client to change
 * anything, which is what turns "change your nameservers" into instructions
 * specific to their setup — and what stops us from silently destroying their
 * email.
 */

interface DohAnswer {
  name: string;
  type: number;
  data: string;
}

async function query(name: string, type: string): Promise<string[]> {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
    // A stuck DNS lookup must not hold a request open.
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`DNS ${type} lookup failed with ${res.status}`);
  const body = (await res.json()) as { Answer?: DohAnswer[]; Authority?: DohAnswer[] };
  const records = [...(body.Answer ?? []), ...(body.Authority ?? [])];
  return records.map((r) => r.data.trim().replace(/\.$/, "")).filter(Boolean);
}

/** Multi-label public suffixes common enough to matter for apex detection. */
const MULTI_LABEL_SUFFIXES = [
  "co.uk", "org.uk", "me.uk", "ac.uk", "gov.uk", "co.nz", "co.za", "com.au", "net.au",
  "org.au", "co.jp", "com.br", "co.in", "com.mx", "com.sg", "co.kr",
];

export function isApex(hostname: string): boolean {
  const labels = hostname.toLowerCase().split(".");
  if (labels.length <= 2) return true;
  const lastTwo = labels.slice(-2).join(".");
  return labels.length === 3 && MULTI_LABEL_SUFFIXES.includes(lastTwo);
}

/** The registrable domain — the name whose nameservers actually matter. */
export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split(".");
  const lastTwo = labels.slice(-2).join(".");
  const take = MULTI_LABEL_SUFFIXES.includes(lastTwo) ? 3 : 2;
  return labels.slice(-take).join(".");
}

export function normaliseHostname(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

export function isValidHostname(hostname: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname);
}

async function rdap(domain: string): Promise<{ registrar: string | null; expiresAt: string | null }> {
  try {
    const res = await fetch(`${RDAP}/${encodeURIComponent(domain)}`, {
      headers: { accept: "application/rdap+json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { registrar: null, expiresAt: null };
    const body = (await res.json()) as {
      events?: { eventAction: string; eventDate: string }[];
      entities?: { roles?: string[]; vcardArray?: unknown[] }[];
    };
    const expiry = body.events?.find((e) => e.eventAction === "expiration")?.eventDate ?? null;
    const registrarEntity = body.entities?.find((e) => e.roles?.includes("registrar"));
    let registrar: string | null = null;
    const vcard = registrarEntity?.vcardArray?.[1];
    if (Array.isArray(vcard)) {
      const fn = (vcard as unknown[][]).find((entry) => entry[0] === "fn");
      if (fn && typeof fn[3] === "string") registrar = fn[3];
    }
    return { registrar, expiresAt: expiry };
  } catch {
    return { registrar: null, expiresAt: null };
  }
}

/**
 * Look at a domain from the outside before touching it. Individual lookups are
 * allowed to fail — a partial snapshot with recorded errors is far more useful
 * than none at all.
 */
export async function takeSnapshot(hostname: string): Promise<DnsSnapshot> {
  const root = registrableDomain(hostname);
  const errors: string[] = [];

  const safe = async (label: string, fn: () => Promise<string[]>): Promise<string[]> => {
    try {
      return await fn();
    } catch (err) {
      errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  };

  const [nameservers, a, aaaa, cname, mx, txt, registration] = await Promise.all([
    safe("NS", () => query(root, "NS")),
    safe("A", () => query(hostname, "A")),
    safe("AAAA", () => query(hostname, "AAAA")),
    safe("CNAME", () => query(hostname, "CNAME")),
    safe("MX", () => query(root, "MX")),
    safe("TXT", () => query(root, "TXT")),
    rdap(root),
  ]);

  const mailish = txt.filter((t) => /v=spf1|v=DMARC1|google-site-verification|MS=/i.test(t));

  return {
    takenAt: new Date().toISOString(),
    // NS answers can arrive as "ns1.example.com" or with SOA noise; keep only
    // things that look like hostnames.
    nameservers: nameservers.filter((n) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(n)).map((n) => n.toLowerCase()),
    a,
    aaaa,
    cname,
    mx,
    txt,
    registrar: registration.registrar,
    expiresAt: registration.expiresAt,
    hasEmail: mx.length > 0 || mailish.length > 0,
    errors,
  };
}

/** Have they actually pointed the domain at the nameservers we gave them? */
export function nameserversMatch(observed: string[], expected: string[]): boolean {
  if (!expected.length || !observed.length) return false;
  const obs = new Set(observed.map((n) => n.toLowerCase().replace(/\.$/, "")));
  return expected.every((e) => obs.has(e.toLowerCase().replace(/\.$/, "")));
}

/** Have they added the CNAME we gave them (external-DNS mode)? */
export function cnameMatches(observed: string[], target: string): boolean {
  const wanted = target.toLowerCase().replace(/\.$/, "");
  return observed.some((c) => c.toLowerCase().replace(/\.$/, "") === wanted);
}
