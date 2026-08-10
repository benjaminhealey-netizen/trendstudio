import "server-only";
import { config } from "../config";
import { CloudflarePagesHost } from "./cloudflare";
import { LocalHost } from "./local";
import type { SiteHost } from "./types";

let cached: SiteHost | null = null;

export function getSiteHost(): SiteHost {
  if (!cached) {
    cached =
      config.siteHost === "cloudflare"
        ? new CloudflarePagesHost(config.cloudflareAccountId, config.cloudflareApiToken)
        : new LocalHost();
  }
  return cached;
}

export type { SiteHost, HostDomain, PublishResult } from "./types";
