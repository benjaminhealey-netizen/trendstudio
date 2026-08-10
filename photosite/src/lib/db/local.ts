import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AuditLog,
  Client,
  Deployment,
  Domain,
  Site,
  SiteDraft,
  SiteVersion,
} from "../types";
import { newId, type Repo } from "./repo";

interface Db {
  clients: Client[];
  sites: Site[];
  drafts: SiteDraft[];
  versions: SiteVersion[];
  deployments: Deployment[];
  domains: Domain[];
  audit: AuditLog[];
}

const EMPTY: Db = {
  clients: [],
  sites: [],
  drafts: [],
  versions: [],
  deployments: [],
  domains: [],
  audit: [],
};

export const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

/**
 * JSON-file repository. Deliberately unsophisticated: it exists so the whole
 * dashboard is usable before any Supabase project exists. Writes are
 * serialised through a promise chain so concurrent requests cannot interleave
 * a read-modify-write.
 */
export class LocalRepo implements Repo {
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Db> {
    try {
      const raw = await fs.readFile(DB_FILE, "utf8");
      return { ...EMPTY, ...(JSON.parse(raw) as Partial<Db>) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY);
      throw err;
    }
  }

  private async write(db: Db): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, DB_FILE);
  }

  /** Serialises a read-modify-write against the file. */
  private tx<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.read();
      const result = await fn(db);
      await this.write(db);
      return result;
    });
    // Keep the chain alive even if this transaction rejects.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private query<T>(fn: (db: Db) => T): Promise<T> {
    return this.queue.then(async () => fn(await this.read()));
  }

  // --- clients -------------------------------------------------------------
  listClients() {
    return this.query((db) => [...db.clients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
  getClient(id: string) {
    return this.query((db) => db.clients.find((c) => c.id === id) ?? null);
  }
  createClient(input: Omit<Client, "id" | "createdAt">) {
    return this.tx((db) => {
      const row: Client = { ...input, id: newId("cli"), createdAt: new Date().toISOString() };
      db.clients.push(row);
      return row;
    });
  }
  updateClient(id: string, patch: Partial<Omit<Client, "id">>) {
    return this.tx((db) => {
      const row = db.clients.find((c) => c.id === id);
      if (!row) throw new Error(`client ${id} not found`);
      Object.assign(row, patch);
      return row;
    });
  }
  deleteClient(id: string) {
    return this.tx<void>((db) => {
      const sites = db.sites.filter((s) => s.clientId === id).map((s) => s.id);
      db.clients = db.clients.filter((c) => c.id !== id);
      db.sites = db.sites.filter((s) => s.clientId !== id);
      db.drafts = db.drafts.filter((d) => !sites.includes(d.siteId));
      db.versions = db.versions.filter((v) => !sites.includes(v.siteId));
      db.deployments = db.deployments.filter((d) => !sites.includes(d.siteId));
      db.domains = db.domains.filter((d) => !sites.includes(d.siteId));
    });
  }

  // --- sites ---------------------------------------------------------------
  listSites() {
    return this.query((db) => [...db.sites]);
  }
  getSite(id: string) {
    return this.query((db) => db.sites.find((s) => s.id === id) ?? null);
  }
  getSiteByClient(clientId: string) {
    return this.query((db) => db.sites.find((s) => s.clientId === clientId) ?? null);
  }
  createSite(input: Omit<Site, "id" | "createdAt">) {
    return this.tx((db) => {
      const row: Site = { ...input, id: newId("site"), createdAt: new Date().toISOString() };
      db.sites.push(row);
      return row;
    });
  }
  updateSite(id: string, patch: Partial<Omit<Site, "id">>) {
    return this.tx((db) => {
      const row = db.sites.find((s) => s.id === id);
      if (!row) throw new Error(`site ${id} not found`);
      Object.assign(row, patch);
      return row;
    });
  }

  // --- drafts --------------------------------------------------------------
  getDraft(siteId: string) {
    return this.query((db) => db.drafts.find((d) => d.siteId === siteId) ?? null);
  }
  saveDraft(draft: SiteDraft) {
    return this.tx((db) => {
      const idx = db.drafts.findIndex((d) => d.siteId === draft.siteId);
      const row = { ...draft, updatedAt: new Date().toISOString() };
      if (idx >= 0) db.drafts[idx] = row;
      else db.drafts.push(row);
      return row;
    });
  }

  // --- versions ------------------------------------------------------------
  createVersion(input: Omit<SiteVersion, "id" | "createdAt">) {
    return this.tx((db) => {
      const row: SiteVersion = { ...input, id: newId("ver"), createdAt: new Date().toISOString() };
      db.versions.push(row);
      return row;
    });
  }
  getVersion(id: string) {
    return this.query((db) => db.versions.find((v) => v.id === id) ?? null);
  }
  listVersions(siteId: string) {
    return this.query((db) =>
      db.versions.filter((v) => v.siteId === siteId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }

  // --- deployments ---------------------------------------------------------
  listDeployments(siteId?: string) {
    return this.query((db) =>
      db.deployments
        .filter((d) => !siteId || d.siteId === siteId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }
  getDeployment(id: string) {
    return this.query((db) => db.deployments.find((d) => d.id === id) ?? null);
  }
  findDeploymentByKey(key: string) {
    return this.query((db) => db.deployments.find((d) => d.idempotencyKey === key) ?? null);
  }
  createDeployment(input: Omit<Deployment, "id" | "createdAt">) {
    return this.tx((db) => {
      const existing = db.deployments.find((d) => d.idempotencyKey === input.idempotencyKey);
      if (existing) return existing;
      const row: Deployment = { ...input, id: newId("dep"), createdAt: new Date().toISOString() };
      db.deployments.push(row);
      return row;
    });
  }
  updateDeployment(id: string, patch: Partial<Omit<Deployment, "id">>) {
    return this.tx((db) => {
      const row = db.deployments.find((d) => d.id === id);
      if (!row) throw new Error(`deployment ${id} not found`);
      Object.assign(row, patch);
      return row;
    });
  }

  // --- domains -------------------------------------------------------------
  listDomains(siteId?: string) {
    return this.query((db) => db.domains.filter((d) => !siteId || d.siteId === siteId));
  }
  getDomain(id: string) {
    return this.query((db) => db.domains.find((d) => d.id === id) ?? null);
  }
  findDomainByHostname(hostname: string) {
    return this.query((db) => db.domains.find((d) => d.hostname === hostname) ?? null);
  }
  createDomain(input: Omit<Domain, "id" | "createdAt">) {
    return this.tx((db) => {
      if (db.domains.some((d) => d.hostname === input.hostname)) {
        throw new Error(`${input.hostname} is already attached to another site`);
      }
      const row: Domain = { ...input, id: newId("dom"), createdAt: new Date().toISOString() };
      db.domains.push(row);
      return row;
    });
  }
  updateDomain(id: string, patch: Partial<Omit<Domain, "id">>) {
    return this.tx((db) => {
      const row = db.domains.find((d) => d.id === id);
      if (!row) throw new Error(`domain ${id} not found`);
      Object.assign(row, patch);
      return row;
    });
  }
  deleteDomain(id: string) {
    return this.tx<void>((db) => {
      db.domains = db.domains.filter((d) => d.id !== id);
    });
  }

  // --- audit ---------------------------------------------------------------
  listAudit(limit = 100) {
    return this.query((db) =>
      [...db.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
    );
  }
  appendAudit(input: Omit<AuditLog, "id" | "createdAt">) {
    return this.tx((db) => {
      const row: AuditLog = { ...input, id: newId("log"), createdAt: new Date().toISOString() };
      db.audit.push(row);
      if (db.audit.length > 2000) db.audit = db.audit.slice(-2000);
      return row;
    });
  }
}
