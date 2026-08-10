import { blake3 } from "@noble/hashes/blake3";
import { bytesToHex } from "@noble/hashes/utils";
import type { SiteFile } from "../templates/types";
import type { HostDomain, HostDomainStatus, PublishResult, SiteHost } from "./types";

const API = "https://api.cloudflare.com/client/v4";

interface CfEnvelope<T> {
  success: boolean;
  result: T;
  errors?: { code: number; message: string }[];
}

export class CloudflareApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CloudflareApiError";
  }
}

/**
 * Cloudflare Pages implementation.
 *
 * Project and custom-domain calls follow the documented Pages REST API.
 *
 * The asset upload path (upload-token -> check-missing -> upload -> create
 * deployment) mirrors what `wrangler pages deploy` does, including its content
 * hash: blake3 over the file bytes concatenated with the file extension,
 * truncated to 32 hex characters. That part is reproduced from wrangler's
 * behaviour rather than from a published spec, so it is the one piece here that
 * has NOT been verified against a live account. Spike it against a throwaway
 * Cloudflare project before relying on it — see README "Before going live".
 */
export class CloudflarePagesHost implements SiteHost {
  readonly id = "cloudflare";

  constructor(private accountId: string, private apiToken: string) {
    if (!accountId || !apiToken) {
      throw new Error("CloudflarePagesHost needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN");
    }
  }

  private async call<T>(pathname: string, init: RequestInit = {}, token?: string): Promise<T> {
    const res = await fetch(`${API}${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token ?? this.apiToken}`,
        ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: CfEnvelope<T> | null = null;
    try {
      body = JSON.parse(text) as CfEnvelope<T>;
    } catch {
      /* fall through to the raw-text error below */
    }
    if (!res.ok || !body?.success) {
      const detail = body?.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || text.slice(0, 400);
      throw new CloudflareApiError(`Cloudflare ${init.method ?? "GET"} ${pathname} failed — ${detail}`, res.status);
    }
    return body.result;
  }

  async ensureProject(projectName: string): Promise<void> {
    try {
      await this.call(`/accounts/${this.accountId}/pages/projects/${projectName}`);
      return;
    } catch (err) {
      if (!(err instanceof CloudflareApiError) || err.status !== 404) throw err;
    }
    await this.call(`/accounts/${this.accountId}/pages/projects`, {
      method: "POST",
      body: JSON.stringify({ name: projectName, production_branch: "main" }),
    });
  }

  async publish(projectName: string, files: SiteFile[]): Promise<PublishResult> {
    await this.ensureProject(projectName);

    const { jwt } = await this.call<{ jwt: string }>(
      `/accounts/${this.accountId}/pages/projects/${projectName}/upload-token`
    );

    const assets = files.map((file) => {
      const bytes = new TextEncoder().encode(file.content);
      const ext = file.path.includes(".") ? file.path.split(".").pop()! : "";
      const payload = new Uint8Array(bytes.length + ext.length);
      payload.set(bytes);
      payload.set(new TextEncoder().encode(ext), bytes.length);
      const hash = bytesToHex(blake3(payload, { dkLen: 16 })).slice(0, 32);
      return { file, hash, base64: base64Encode(bytes) };
    });

    const missing = await this.call<string[]>(
      `/pages/assets/check-missing`,
      { method: "POST", body: JSON.stringify({ hashes: assets.map((a) => a.hash) }) },
      jwt
    );
    const toUpload = assets.filter((a) => missing.includes(a.hash));

    if (toUpload.length) {
      await this.call(
        `/pages/assets/upload`,
        {
          method: "POST",
          body: JSON.stringify(
            toUpload.map((a) => ({
              key: a.hash,
              value: a.base64,
              metadata: { contentType: a.file.contentType },
              base64: true,
            }))
          ),
        },
        jwt
      );
    }

    const manifest: Record<string, string> = {};
    for (const a of assets) manifest[`/${a.file.path}`] = a.hash;

    const form = new FormData();
    form.append("manifest", JSON.stringify(manifest));
    const deployment = await this.call<{ id: string; url: string }>(
      `/accounts/${this.accountId}/pages/projects/${projectName}/deployments`,
      { method: "POST", body: form }
    );

    return { hostDeploymentId: deployment.id, url: deployment.url };
  }

  async attachDomain(projectName: string, hostname: string): Promise<HostDomain> {
    const result = await this.call<{ id: string; name: string; status: string }>(
      `/accounts/${this.accountId}/pages/projects/${projectName}/domains`,
      { method: "POST", body: JSON.stringify({ name: hostname }) }
    );
    return mapDomain(result);
  }

  async domainStatus(projectName: string, hostname: string): Promise<HostDomain | null> {
    try {
      const result = await this.call<{ id: string; name: string; status: string }>(
        `/accounts/${this.accountId}/pages/projects/${projectName}/domains/${hostname}`
      );
      return mapDomain(result);
    } catch (err) {
      if (err instanceof CloudflareApiError && err.status === 404) return null;
      throw err;
    }
  }

  async removeDomain(projectName: string, hostname: string): Promise<void> {
    await this.call(
      `/accounts/${this.accountId}/pages/projects/${projectName}/domains/${hostname}`,
      { method: "DELETE" }
    );
  }
}

function mapDomain(r: { id: string; name: string; status: string }): HostDomain {
  const status: HostDomainStatus =
    r.status === "active" ? "active" : /fail|error|blocked/i.test(r.status) ? "failed" : "pending";
  return { id: r.id, hostname: r.name, status, detail: r.status };
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
