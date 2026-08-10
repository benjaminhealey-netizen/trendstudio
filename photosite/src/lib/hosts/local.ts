import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../db/local";
import type { SiteFile } from "../templates/types";
import type { HostDomain, PublishResult, SiteHost } from "./types";

export const PUBLISHED_DIR = path.join(DATA_DIR, "published");

/**
 * Writes the rendered bundle to disk and serves it from /host/<project>/.
 * This is what makes the full create → edit → publish → view loop testable
 * before any Cloudflare credentials exist, and it is also what the tests run
 * against.
 */
export class LocalHost implements SiteHost {
  readonly id = "local";

  async ensureProject(projectName: string): Promise<void> {
    await fs.mkdir(path.join(PUBLISHED_DIR, projectName), { recursive: true });
  }

  async publish(projectName: string, files: SiteFile[]): Promise<PublishResult> {
    const deploymentId = `local-${Date.now().toString(36)}`;
    const dir = path.join(PUBLISHED_DIR, projectName);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    for (const file of files) {
      const target = path.join(dir, file.path);
      // Defence in depth: a template must never write outside its own folder.
      if (!target.startsWith(dir + path.sep)) throw new Error(`unsafe path: ${file.path}`);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, "utf8");
    }
    await fs.writeFile(
      path.join(dir, ".deployment.json"),
      JSON.stringify({ deploymentId, at: new Date().toISOString() }, null, 2),
      "utf8"
    );
    return { hostDeploymentId: deploymentId, url: `/host/${projectName}/` };
  }

  async attachDomain(_projectName: string, hostname: string): Promise<HostDomain> {
    return {
      id: `local-domain-${hostname}`,
      hostname,
      status: "pending",
      detail: "Local host does not serve custom domains. Set SITE_HOST=cloudflare to attach for real.",
    };
  }

  async domainStatus(_projectName: string, hostname: string): Promise<HostDomain | null> {
    return {
      id: `local-domain-${hostname}`,
      hostname,
      status: "pending",
      detail: "Local host — no certificate is issued.",
    };
  }

  async removeDomain(): Promise<void> {
    /* nothing to do locally */
  }
}
