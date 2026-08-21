-- Run this in the Supabase SQL editor (Project → SQL Editor → New query).
-- One row = one page's full content override, keyed by page id (e.g. "home").
-- `content` is a JSON object shaped { [lang]: { [i18nKey]: value } }, e.g.
-- { "tr": { "home.hero.slide1_title": "..." }, "en": { ... } }.

create table if not exists site_content (
  id text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table site_content enable row level security;

-- Public read: every visitor's browser loads overrides anonymously
-- via the site's own i18n pipeline (src/i18n.js).
create policy "public read" on site_content
  for select using (true);

-- Public write: the /admin editor has NO real user auth yet (see
-- src/components/Admin/auth.js — a hardcoded, client-side-only
-- password gate). The anon key ships inside the public JS bundle, so
-- this policy means ANYONE who finds the anon key can write rows
-- directly via the Supabase REST API, bypassing the admin login
-- entirely. Fine for this prototype phase, NOT fine to leave open
-- once this is a real production site — swap this for Supabase Auth
-- (`auth.uid() is not null` or a role check) before then.
create policy "public write" on site_content
  for insert with check (true);

create policy "public update" on site_content
  for update using (true) with check (true);

-- Storage bucket for admin-uploaded images (Phase 32: image manager).
-- Public bucket: uploaded photos need to be viewable by every visitor
-- via a plain public URL, same trust model as site_content above (the
-- admin editor has no real auth yet — see src/components/Admin/auth.js).
-- Anyone with the anon key can upload arbitrary files to this bucket;
-- fine for this prototype phase, revisit alongside the site_content
-- RLS note above before this becomes a real production site.
insert into storage.buckets (id, name, public)
values ('site_assets', 'site_assets', true)
on conflict (id) do nothing;

create policy "public read site_assets" on storage.objects
  for select using (bucket_id = 'site_assets');

create policy "public upload site_assets" on storage.objects
  for insert with check (bucket_id = 'site_assets');

-- Phase 33: contact form submissions (iletisim.html "Teklif Al" form).
-- The form still opens a mailto: as its primary path (no backend to
-- actually deliver mail), but now also best-effort inserts a copy here
-- so the admin Inbox drawer has something to show even if the visitor's
-- mail client never sends. Same open-policy trust model as site_content
-- above — public insert so anonymous visitors can submit, public
-- select/update/delete so the no-auth-yet admin panel can manage them.
create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table contact_submissions enable row level security;

create policy "public insert contact_submissions" on contact_submissions
  for insert with check (true);

create policy "public read contact_submissions" on contact_submissions
  for select using (true);

create policy "public update contact_submissions" on contact_submissions
  for update using (true) with check (true);

create policy "public delete contact_submissions" on contact_submissions
  for delete using (true);

-- Phase 33: revision history. One row per save — a full snapshot of
-- that page's site_content.content at save time, so "Geri Al" is a
-- straight copy-back rather than trying to invert a diff. Grows
-- unbounded (no pruning yet); acceptable at this prototype's scale.
create table if not exists site_content_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

alter table site_content_revisions enable row level security;

create policy "public insert site_content_revisions" on site_content_revisions
  for insert with check (true);

create policy "public read site_content_revisions" on site_content_revisions
  for select using (true);

-- Phase 34: lightweight page-view analytics. One row per page load,
-- fired best-effort from src/i18n.js's initI18n() (every page). No
-- visitor identity captured, just path + timestamp — good enough for
-- the admin "İstatistikler" summary, not a real analytics pipeline.
create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  page_path text not null,
  created_at timestamptz not null default now()
);

alter table page_views enable row level security;

create policy "public insert page_views" on page_views
  for insert with check (true);

create policy "public read page_views" on page_views
  for select using (true);
