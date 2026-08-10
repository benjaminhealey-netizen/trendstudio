/**
 * End-to-end smoke test of the real product loop, against the local backends:
 * create client -> starter content -> edit -> publish -> read the published
 * HTML back off disk -> roll back to an earlier version.
 *
 *   npx tsx scripts/smoke.ts
 *
 * It also prints a signed session cookie so the dashboard can be curled.
 */
import { signSession } from "../src/lib/auth/session";
import { starterContent } from "../src/lib/content/schema";
import { LocalRepo } from "../src/lib/db/local";
import { LocalHost } from "../src/lib/hosts/local";
import { getTemplate } from "../src/lib/templates";

const repo = new LocalRepo();
const host = new LocalHost();

function check(label: string, condition: boolean) {
  console.log(`${condition ? "  ok  " : " FAIL "} ${label}`);
  if (!condition) process.exitCode = 1;
}

const client = await repo.createClient({
  name: "Smoke Test",
  email: "smoke@example.com",
  businessName: "Smoke Test Photography",
  status: "draft",
});
const site = await repo.createSite({
  clientId: client.id,
  templateId: "aperture",
  projectName: `smoke-${client.id.split("_")[1].slice(0, 6)}`,
  status: "draft",
  liveUrl: null,
  publishedAt: null,
  publishedVersionId: null,
});

const content = starterContent(client.businessName, client.email);
await repo.saveDraft({ siteId: site.id, content, updatedAt: new Date().toISOString() });
check("client, site and starter draft created", !!(await repo.getDraft(site.id)));

// First publish.
const v1 = await repo.createVersion({ siteId: site.id, content, note: "v1" });
const files1 = getTemplate(site.templateId).render(v1.content, {
  origin: "https://smoke.example",
  preview: false,
});
const pub1 = await host.publish(site.projectName, files1);
check("publish returned a url", pub1.url.startsWith("/host/"));

// Edit and publish again.
const edited = structuredClone(content);
edited.siteName = "Smoke Test Photography (edited)";
edited.seo.title = "Edited title";
const v2 = await repo.createVersion({ siteId: site.id, content: edited, note: "v2" });
const files2 = getTemplate(site.templateId).render(v2.content, {
  origin: "https://smoke.example",
  preview: false,
});
await host.publish(site.projectName, files2);

const { promises: fs } = await import("node:fs");
const path = await import("node:path");
const { PUBLISHED_DIR } = await import("../src/lib/hosts/local");
const published = await fs.readFile(path.join(PUBLISHED_DIR, site.projectName, "index.html"), "utf8");
check("published html reflects the edit", published.includes("Edited title"));
check("published html has a sitemap sibling", await exists(path.join(PUBLISHED_DIR, site.projectName, "sitemap.xml")));

// Roll back by re-publishing v1.
await host.publish(site.projectName, files1);
const rolledBack = await fs.readFile(path.join(PUBLISHED_DIR, site.projectName, "index.html"), "utf8");
check("rollback restored the earlier version", !rolledBack.includes("Edited title"));

const versions = await repo.listVersions(site.id);
check("both versions are retained", versions.length === 2);

// Clean up so a repeated run stays deterministic.
await repo.deleteClient(client.id);
await fs.rm(path.join(PUBLISHED_DIR, site.projectName), { recursive: true, force: true });

console.log("\nsession cookie for curling the dashboard:");
console.log(
  `photosite_session=${await signSession(
    process.env.ADMIN_EMAIL ?? "admin@localhost",
    process.env.SESSION_SECRET ?? "insecure-dev-secret-change-me"
  )}`
);

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
