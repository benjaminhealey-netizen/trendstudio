import "server-only";

function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export const config = {
  dataBackend: (env("DATA_BACKEND", "local") === "supabase" ? "supabase" : "local") as
    | "local"
    | "supabase",
  siteHost: (env("SITE_HOST", "local") === "cloudflare" ? "cloudflare" : "local") as
    | "local"
    | "cloudflare",

  adminEmail: env("ADMIN_EMAIL", "admin@localhost"),
  adminPassword: env("ADMIN_PASSWORD", "photosite"),
  sessionSecret: env("SESSION_SECRET", "insecure-dev-secret-change-me"),

  supabaseUrl: env("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),

  cloudflareAccountId: env("CLOUDFLARE_ACCOUNT_ID"),
  cloudflareApiToken: env("CLOUDFLARE_API_TOKEN"),

  expectedNameservers: env("EXPECTED_NAMESERVERS")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};

/** Surfaced in the UI so it is always obvious which backends are live. */
export function configWarnings(): string[] {
  const warnings: string[] = [];
  if (config.dataBackend === "local") {
    warnings.push("Data is stored in .data/db.json — set DATA_BACKEND=supabase for production.");
  } else if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    warnings.push("DATA_BACKEND=supabase but Supabase URL or service-role key is missing.");
  }
  if (config.siteHost === "local") {
    warnings.push("Publishing writes to .data/published and serves at /host — set SITE_HOST=cloudflare to deploy for real.");
  } else if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
    warnings.push("SITE_HOST=cloudflare but CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing.");
  }
  if (config.sessionSecret === "insecure-dev-secret-change-me") {
    warnings.push("SESSION_SECRET is the default value. Set a long random string before deploying.");
  }
  if (!config.expectedNameservers.length) {
    warnings.push("EXPECTED_NAMESERVERS is unset — delegated-nameserver instructions will be incomplete.");
  }
  return warnings;
}
