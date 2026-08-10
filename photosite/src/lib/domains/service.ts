import "server-only";
import { config } from "../config";
import { getRepo } from "../db";
import { getSiteHost } from "../hosts";
import type { Domain, DomainMode, Site } from "../types";
import {
  cnameMatches,
  isApex,
  isValidHostname,
  nameserversMatch,
  normaliseHostname,
  takeSnapshot,
} from "./dns";

export class DomainError extends Error {}

export interface AddDomainInput {
  siteId: string;
  hostname: string;
  mode: DomainMode;
  actor: string;
}

export async function addDomain(input: AddDomainInput): Promise<Domain> {
  const repo = getRepo();
  const hostname = normaliseHostname(input.hostname);

  if (!isValidHostname(hostname)) throw new DomainError(`"${input.hostname}" is not a valid hostname`);
  const site = await repo.getSite(input.siteId);
  if (!site) throw new DomainError("site not found");
  if (await repo.findDomainByHostname(hostname)) {
    throw new DomainError(`${hostname} is already attached to a site`);
  }

  const apex = isApex(hostname);
  if (apex && input.mode === "external_dns") {
    throw new DomainError(
      `${hostname} is an apex domain. Apex records cannot be a CNAME at most registrars, so external DNS will not work — ` +
        `either delegate nameservers to us, or use www.${hostname} and set an apex redirect at the registrar.`
    );
  }

  // Best-effort: never block adding a domain because a public lookup was slow.
  let snapshot = null;
  let state: Domain["state"] = "snapshot_pending";
  try {
    snapshot = await takeSnapshot(hostname);
    state = "snapshot_taken";
  } catch {
    /* leave state as snapshot_pending; the operator can re-run the check */
  }

  const domain = await repo.createDomain({
    siteId: input.siteId,
    hostname,
    isApex: apex,
    mode: input.mode,
    state,
    expectedNameservers: config.expectedNameservers,
    rollbackNameservers: snapshot?.nameservers ?? [],
    snapshot,
    hostDomainId: null,
    emailSafetyAcknowledged: false,
    lastCheckedAt: snapshot ? new Date().toISOString() : null,
    lastError: null,
  });

  await repo.appendAudit({
    actor: input.actor,
    action: "domain.add",
    resourceType: "domain",
    resourceId: domain.id,
    metadata: { hostname, mode: input.mode, hasEmail: snapshot?.hasEmail ?? null },
  });
  return domain;
}

/**
 * Re-observe DNS and move the domain along its state machine. Safe to call
 * repeatedly — this is what a cron would hit every few minutes.
 */
export async function checkDomain(domainId: string, actor = "system"): Promise<Domain> {
  const repo = getRepo();
  const domain = await repo.getDomain(domainId);
  if (!domain) throw new DomainError("domain not found");
  const site = await repo.getSite(domain.siteId);
  if (!site) throw new DomainError("site not found");

  let snapshot;
  try {
    snapshot = await takeSnapshot(domain.hostname);
  } catch (err) {
    return repo.updateDomain(domain.id, {
      lastCheckedAt: new Date().toISOString(),
      lastError: err instanceof Error ? err.message : String(err),
    });
  }

  const pointingAtUs =
    domain.mode === "delegated_ns"
      ? nameserversMatch(snapshot.nameservers, domain.expectedNameservers)
      : cnameMatches(snapshot.cname, cnameTarget(site));

  let state = domain.state;
  let hostDomainId = domain.hostDomainId;
  let lastError: string | null = null;

  if (!pointingAtUs) {
    state = domain.state === "live" ? "live" : "awaiting_dns_change";
  } else {
    if (state === "snapshot_pending" || state === "snapshot_taken" || state === "awaiting_dns_change") {
      state = "dns_detected";
    }

    // Only attach once the DNS actually points at us, and only once the email
    // question has been dealt with explicitly.
    const needsAck = domain.mode === "delegated_ns" && snapshot.hasEmail && !domain.emailSafetyAcknowledged;
    if (state === "dns_detected" && !needsAck) {
      try {
        const host = getSiteHost();
        const attached =
          (await host.domainStatus(site.projectName, domain.hostname)) ??
          (await host.attachDomain(site.projectName, domain.hostname));
        hostDomainId = attached.id;
        state = attached.status === "active" ? "live" : "attached";
        if (attached.status === "failed") {
          state = "failed";
          lastError = attached.detail;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        state = "failed";
      }
    } else if (needsAck) {
      lastError =
        "This domain has email records. Confirm the MX/SPF records have been carried over before attaching.";
    }

    if (state === "attached") {
      try {
        const status = await getSiteHost().domainStatus(site.projectName, domain.hostname);
        if (status?.status === "active") state = "live";
        if (status?.status === "failed") {
          state = "failed";
          lastError = status.detail;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  const updated = await repo.updateDomain(domain.id, {
    state,
    snapshot,
    hostDomainId,
    lastCheckedAt: new Date().toISOString(),
    lastError,
  });

  if (updated.state !== domain.state) {
    await repo.appendAudit({
      actor,
      action: "domain.state_change",
      resourceType: "domain",
      resourceId: domain.id,
      metadata: { from: domain.state, to: updated.state },
    });
  }
  return updated;
}

export function cnameTarget(site: Site): string {
  return `${site.projectName}.pages.dev`;
}

export interface DomainInstruction {
  title: string;
  detail: string;
  values?: { label: string; value: string }[];
}

/** What the client has to do, in their own registrar, in their own words. */
export function instructionsFor(domain: Domain, site: Site): DomainInstruction[] {
  const registrar = domain.snapshot?.registrar ?? "your registrar";
  if (domain.mode === "delegated_ns") {
    return [
      {
        title: `Sign in to ${registrar}`,
        detail: `Find ${domain.hostname} in your domain list and open its nameserver or DNS settings.`,
      },
      {
        title: "Replace the nameservers",
        detail:
          "Choose the 'custom nameservers' option and replace what is there with these two. Remove any others.",
        values: domain.expectedNameservers.length
          ? domain.expectedNameservers.map((ns, i) => ({ label: `Nameserver ${i + 1}`, value: ns }))
          : [{ label: "Nameservers", value: "Not configured yet — set EXPECTED_NAMESERVERS." }],
      },
      {
        title: "Save and wait",
        detail:
          "Changes usually take under two hours but can take up to 48. This page updates itself as soon as we can see the change.",
      },
    ];
  }
  return [
    {
      title: `Sign in to ${registrar}`,
      detail: `Open the DNS records for ${domain.hostname}.`,
    },
    {
      title: "Add a CNAME record",
      detail: "Add this record. If a record with the same name already exists, replace it.",
      values: [
        { label: "Type", value: "CNAME" },
        { label: "Name", value: domain.hostname.split(".")[0] },
        { label: "Target", value: cnameTarget(site) },
        { label: "TTL", value: "Automatic (or 300)" },
      ],
    },
    {
      title: "Save and wait",
      detail: "Usually live within minutes. This page updates itself once we can see the record.",
    },
  ];
}

export const STATE_COPY: Record<Domain["state"], { label: string; tone: "neutral" | "warn" | "good" | "bad" }> = {
  snapshot_pending: { label: "Checking domain", tone: "neutral" },
  snapshot_taken: { label: "Ready for DNS change", tone: "neutral" },
  awaiting_dns_change: { label: "Waiting on DNS change", tone: "warn" },
  dns_detected: { label: "DNS detected — attaching", tone: "warn" },
  attached: { label: "Attached, issuing certificate", tone: "warn" },
  live: { label: "Live", tone: "good" },
  failed: { label: "Failed", tone: "bad" },
};
