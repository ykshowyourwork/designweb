-- =============================================================================
-- DesiWeb Network: every business DesiWeb reaches out to, on the site
-- (desiweb.org/admin/network, owner only). Same idea as The Set's and YKE's
-- Network. Replaces the Notion "Website Cold Call List" and "DesignWeb Inbound
-- Leads": cold-call leads, the daily routine's finds, website form requests
-- (warm) and anyone added by hand all live here.
--
--   stage: warm (came in from the website) | lead (to email) | call (no email,
--          call them) | messaged (sent) | follow_up (follow-up due) |
--          followed_up | replied | yes | pass
--
-- Paste this whole file into Supabase → SQL Editor → Run. Safe to re-run.
-- Only the website's server (service role key) can read or write it: RLS is on
-- and there are no public policies.
-- =============================================================================
create extension if not exists pgcrypto;

create table if not exists public.network (
  id               uuid primary key default gen_random_uuid(),
  business         text not null,
  stage            text not null default 'lead'
                   check (stage in ('warm', 'lead', 'call', 'messaged', 'follow_up', 'followed_up', 'replied', 'yes', 'pass')),
  category         text,
  contact_name     text,
  email            text,
  phone            text,
  website          text,
  google_maps      text,
  google_cid       text unique,
  area             text,
  rating           numeric(2, 1),
  reviews          integer,
  no_website       boolean not null default false,
  unclaimed_google boolean not null default false,
  package          text,
  budget           text,
  opener           text,
  why_fit          text,
  heads_up         text,
  email_subject    text,
  email_draft      text,
  followup_subject text,
  followup_draft   text,
  deck_url         text,
  demo_url         text,
  notes            text,
  source           text,
  tags             text[] not null default '{}',
  followups        integer not null default 0,
  sent_on          date,
  follow_up_on     date,
  last_contact_at  timestamptz,
  log              text,
  notion_page_id   text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists network_email_key on public.network (lower(email)) where email is not null;
create index if not exists network_stage_idx on public.network (stage);
create index if not exists network_follow_up_idx on public.network (follow_up_on) where stage = 'messaged';

create or replace function public.network_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists network_touch on public.network;
create trigger network_touch before update on public.network for each row execute function public.network_touch();

alter table public.network enable row level security;

-- One row of settings for the outreach machine.
--   auto_send:    false = Jordan reviews and presses "Send today's batch";
--                 true  = the daily routine sends the batch on its own.
--   auto_send_on: the day automatic sending turns on by itself (first week is review).
--   batch_size:   new businesses emailed per day.
create table if not exists public.network_settings (
  id           integer primary key default 1 check (id = 1),
  auto_send    boolean not null default false,
  auto_send_on date,
  batch_size   integer not null default 10 check (batch_size between 1 and 50),
  updated_at   timestamptz not null default now()
);
insert into public.network_settings (id, auto_send, auto_send_on, batch_size)
values (1, false, current_date + 7, 10)
on conflict (id) do nothing;
alter table public.network_settings enable row level security;
