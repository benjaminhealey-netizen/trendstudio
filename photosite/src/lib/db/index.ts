import "server-only";
import { config } from "../config";
import { LocalRepo } from "./local";
import type { Repo } from "./repo";
import { SupabaseRepo } from "./supabase";

// Next dev reloads modules; keep one instance so the local repo's write queue
// is actually shared across requests.
const globalForRepo = globalThis as unknown as { __photositeRepo?: Repo };

export function getRepo(): Repo {
  if (!globalForRepo.__photositeRepo) {
    if (config.dataBackend === "supabase") {
      if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
        throw new Error(
          "DATA_BACKEND=supabase requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        );
      }
      globalForRepo.__photositeRepo = new SupabaseRepo(
        config.supabaseUrl,
        config.supabaseServiceRoleKey
      );
    } else {
      globalForRepo.__photositeRepo = new LocalRepo();
    }
  }
  return globalForRepo.__photositeRepo;
}

export type { Repo };
