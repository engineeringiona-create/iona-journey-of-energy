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
