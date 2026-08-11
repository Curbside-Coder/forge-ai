create type public.forge_rhythm_kind as enum ('morning', 'eod', 'monday', 'friday');

create table public.forge_rhythm_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Manila',
  morning_hour smallint not null default 8 check (morning_hour between 0 and 23),
  eod_hour smallint not null default 18 check (eod_hour between 0 and 23),
  email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.forge_rhythm_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind public.forge_rhythm_kind not null,
  period_date date not null,
  title text not null,
  body text not null,
  facts jsonb not null default '{}'::jsonb,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_id, kind, period_date)
);

create index forge_rhythm_reports_owner_date_idx on public.forge_rhythm_reports(owner_id, period_date desc);
alter table public.forge_rhythm_preferences enable row level security;
alter table public.forge_rhythm_reports enable row level security;
create policy "owners manage their rhythm preferences" on public.forge_rhythm_preferences for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners read their rhythm reports" on public.forge_rhythm_reports for select using (owner_id = auth.uid());
