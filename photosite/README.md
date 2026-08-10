# PhotoSite Manager

An operator dashboard for building, publishing and maintaining photographer
portfolio sites. Create a client, edit their content, preview it, publish it,
and walk them through pointing their own domain at it — without touching the
Cloudflare dashboard or zipping anything.

Built from `photographer_site_platform_claude_build_spec.pdf`, with two
deliberate departures from it, both recorded in "Decisions" below: clients keep
ownership of their own domains (so there is no registrar integration), and
templates render to HTML strings rather than being Next apps (so publishing
needs no build machine).

---

## Run it right now

No accounts, no API keys, no database:

```bash
cd photosite
npm install
npm run dev
```

Open http://localhost:3000 and sign in with the defaults (`admin@localhost` /
`photosite`). Data goes to `.data/db.json`; published sites go to
`.data/published/` and are served back at `/host/<project>/`.

Copy `.env.example` to `.env.local` when you want to change any of that.

A banner across the top of the dashboard always states which backends are
live, so "am I hitting the real Cloudflare?" is never a guess.

### Checks

```bash
npm run typecheck
npm test                      # pure logic: schema, escaping, DNS helpers
npx tsx scripts/smoke.mts     # publish → edit → republish → roll back, on disk

npm start &                   # browser end-to-end, writes screenshots to .data/e2e
npx tsx scripts/e2e.mts
```

`scripts/e2e.mts` drives the real UI: sign in, create a client, edit the hero,
save, publish, then open the published page and assert the edit is on it.

---

## How it fits together

```
Dashboard (Next.js)          Template (pure render fn)      Host adapter
  clients / sites / content  ──►  SiteContent → HTML     ──►  LocalHost
  domains / deployments           + sitemap + robots          CloudflarePagesHost
        │                                                          │
        └── Repo adapter ── LocalRepo (JSON) | SupabaseRepo ────────┘
```

Three seams, each with a working fake so the whole thing runs offline:

| Seam | Local (default) | Production |
| --- | --- | --- |
| `Repo` | `.data/db.json` | Supabase Postgres |
| `SiteHost` | writes to `.data/published`, served at `/host` | Cloudflare Pages |
| Auth | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | same, or swap in Supabase Auth |

### Publishing

Draft → **immutable version** → render → deploy → deployment row pointing at
that version. Nothing ever renders from the draft, so what is live is always a
version you can point at, diff and roll back to. Retries reuse a deterministic
idempotency key (`site:version:attempt`) instead of deploying twice.

### Content

`src/lib/content/schema.ts` is the single source of truth: a Zod schema with a
version number, design tokens, and an ordered list of typed sections. Adding a
field is a change there plus the renderer — no migration, no form rewrite, and
the editor picks it up. Client-to-client variation is meant to live in tokens
and section order, which is what keeps one template serving everybody instead
of drifting into per-client CSS.

### Domains

Clients own their domains. The platform never registers, renews or transfers
anything. Two modes:

- **`delegated_ns`** — they point their registrar at your Cloudflare
  nameservers; the zone lives in your account. Works for apex. Default.
- **`external_dns`** — they keep DNS where it is and add a CNAME. Subdomain or
  `www` only; the app refuses this for an apex domain and explains why.

Before anyone changes anything, the app takes a read-only snapshot over public
endpoints (DNS-over-HTTPS for NS/A/MX/TXT, RDAP for registrar and expiry).
That drives registrar-specific instructions, an expiry warning, rollback
nameservers — and a **blocking confirmation when the domain carries email**,
because moving nameservers without recreating MX/SPF records kills a small
business's mail.

`/handoff/<domainId>` is a public page you send the client: their values, their
registrar, live status. It exists to turn a phone call into a link.

---

## Going to production

1. **Supabase** — create a project, run `supabase/migrations/0001_init.sql`,
   then set `DATA_BACKEND=supabase` plus the URL and service-role key. RLS is
   enabled with no policies, so the anon key can read nothing.
2. **Cloudflare** — API token scoped to `Pages:Edit`, set
   `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `SITE_HOST=cloudflare`.
   Add `Zone:Read` + `DNS:Edit` only when you start holding client zones.
3. **`EXPECTED_NAMESERVERS`** — the pair Cloudflare assigns your account. Read
   them off your first zone; the handoff page is incomplete without them.
4. **`SESSION_SECRET`** — a long random string.
5. Deploy the dashboard (Vercel is the least-friction option; the client sites
   are on Cloudflare either way).

### Before going live: one thing to spike

`CloudflarePagesHost.publish()` implements Cloudflare's direct-upload flow
(upload-token → check-missing → upload → create deployment), including
wrangler's content hash: blake3 over the file bytes plus the extension,
truncated to 32 hex characters. That hash comes from wrangler's behaviour
rather than a published spec, and **it has not been run against a live
Cloudflare account** — this environment has no outbound network access. Point
it at a throwaway project and confirm before a real client depends on it.
Everything else in that class (project create, custom domain add/status/remove)
follows the documented REST API.

Similarly, the DNS/RDAP snapshot code is unit-tested on its parsing and
matching logic, but the live lookups could not be exercised here for the same
reason.

---

## Decisions

- **Clients own their domains.** Removes the registrar API, billing setup,
  renewal tracking, transfer locks and irreversible purchases from the build
  entirely. Also means a client can leave with their domain, which is worth
  saying out loud on a sales page.
- **Templates are render functions, not apps.** A Next-app template would need
  `next build` per publish, which a serverless function cannot run — that means
  a build machine, a queue and minutes of latency. Rendering to HTML strings
  publishes in milliseconds and makes preview and publish literally the same
  code path.
- **One Pages project per client**, rather than one Worker serving everything
  from R2. The Worker approach is nicer when the zone is in your account, but
  `external_dns` clients have no zone with you, which would drag in Cloudflare
  for SaaS custom hostnames. Pages handles both DNS modes natively.
- **Images and a contact form are in scope**, though the spec defers both. For
  a photographer, slow images and no way to enquire are not polish items.
  The contact section renders a real form (or a mailto fallback); image
  hosting is still URL-based and wants an R2 upload path next.

## Not built yet

Stripe (tables exist, nothing wired), R2 image uploads and resizing, a cron for
polling domain state, client login, and a second template. The `Repo`,
`SiteHost` and section-schema seams are where each of those attaches.
