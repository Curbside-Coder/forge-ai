create table public.active_time_trackers (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  started_at timestamptz not null,
  description text not null default '',
  custom_fields jsonb not null default '{}'::jsonb,
  page_url text,
  page_title text,
  updated_at timestamptz not null default now()
);

create table public.time_tracker_extension_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Chrome extension',
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index time_tracker_extension_tokens_owner_idx
on public.time_tracker_extension_tokens(owner_id);

create trigger active_time_trackers_set_updated_at
before update on public.active_time_trackers
for each row execute function public.set_updated_at();

alter table public.active_time_trackers enable row level security;
alter table public.time_tracker_extension_tokens enable row level security;

create policy "owners manage active time tracker"
on public.active_time_trackers for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owners manage extension tokens"
on public.time_tracker_extension_tokens for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
