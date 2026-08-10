-- PhotoSite Manager — initial schema.
-- Run in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- Clients ------------------------------------------------------------------
create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  business_name text not null,
  status        text not null default 'draft'
                check (status in ('draft','provisioning','live','suspended')),
  created_at    timestamptz not null default now()
);
create index if not exists clients_status_idx on clients (status);

-- Sites --------------------------------------------------------------------
create table if not exists sites (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references clients (id) on delete cascade,
  template_id          text not null,
  project_name         text not null unique,
  status               text not null default 'draft'
                       check (status in ('draft','published','unpublished')),
  live_url             text,
  published_at         timestamptz,
  published_version_id uuid,
  created_at           timestamptz not null default now()
);
create index if not exists sites_client_idx on sites (client_id);

-- Draft content: one mutable working copy per site --------------------------
create table if not exists site_drafts (
  site_id    uuid primary key references sites (id) on delete cascade,
  content    jsonb not null,
  updated_at timestamptz not null default now()
);

-- Versions: immutable snapshots taken at publish time -----------------------
create table if not exists site_versions (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites (id) on delete cascade,
  content    jsonb not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists site_versions_site_idx on site_versions (site_id, created_at desc);

alter table sites
  drop constraint if exists sites_published_version_fk;
alter table sites
  add constraint sites_published_version_fk
  foreign key (published_version_id) references site_versions (id) on delete set null;

-- Deployments --------------------------------------------------------------
create table if not exists deployments (
  id                 uuid primary key default gen_random_uuid(),
  site_id            uuid not null references sites (id) on delete cascade,
  version_id         uuid not null references site_versions (id) on delete cascade,
  status             text not null default 'queued'
                     check (status in ('queued','building','success','failed')),
  host_deployment_id text,
  url                text,
  error_message      text,
  -- Deterministic per (site, version, attempt): a retried request reuses the
  -- existing row instead of deploying twice.
  idempotency_key    text not null unique,
  created_at         timestamptz not null default now(),
  finished_at        timestamptz
);
create index if not exists deployments_site_idx on deployments (site_id, created_at desc);

-- Domains ------------------------------------------------------------------
create table if not exists domains (
  id                        uuid primary key default gen_random_uuid(),
  site_id                   uuid not null references sites (id) on delete cascade,
  hostname                  text not null unique,
  is_apex                   boolean not null default false,
  mode                      text not null default 'delegated_ns'
                            check (mode in ('delegated_ns','external_dns')),
  state                     text not null default 'snapshot_pending'
                            check (state in ('snapshot_pending','snapshot_taken',
                                             'awaiting_dns_change','dns_detected',
                                             'attached','live','failed')),
  expected_nameservers      text[] not null default '{}',
  -- Their nameservers before we changed anything, so a cutover is reversible.
  rollback_nameservers      text[] not null default '{}',
  snapshot                  jsonb,
  host_domain_id            text,
  email_safety_acknowledged boolean not null default false,
  last_checked_at           timestamptz,
  last_error                text,
  created_at                timestamptz not null default now()
);
create index if not exists domains_site_idx on domains (site_id);

-- Subscriptions (table created now; Stripe wiring is a later phase) ---------
create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid not null references clients (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  plan                   text,
  status                 text not null default 'incomplete'
                         check (status in ('active','past_due','canceled','incomplete')),
  current_period_end     timestamptz,
  created_at             timestamptz not null default now()
);
create index if not exists subscriptions_client_idx on subscriptions (client_id);

-- Audit --------------------------------------------------------------------
create table if not exists audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor         text not null,
  action        text not null,
  resource_type text not null,
  resource_id   text not null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs (created_at desc);

-- Row level security -------------------------------------------------------
-- The dashboard talks to Postgres with the service-role key, which bypasses
-- RLS. Enabling it with no policies means the anon key can read nothing, so a
-- leaked publishable key is worthless.
alter table clients        enable row level security;
alter table sites          enable row level security;
alter table site_drafts    enable row level security;
alter table site_versions  enable row level security;
alter table deployments    enable row level security;
alter table domains        enable row level security;
alter table subscriptions  enable row level security;
alter table audit_logs     enable row level security;
