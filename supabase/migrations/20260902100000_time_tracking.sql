create table public.time_tracking_project_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  fields jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  description text not null default '',
  billing_status text not null default 'Billable',
  approval_status text not null default 'Not Submitted',
  custom_fields jsonb not null default '{}'::jsonb,
  source text not null default 'forge',
  page_url text,
  page_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index time_entries_owner_started_at_idx on public.time_entries(owner_id, started_at desc);
create index time_entries_project_started_at_idx on public.time_entries(project_id, started_at desc);

create trigger time_tracking_project_settings_set_updated_at
before update on public.time_tracking_project_settings
for each row execute function public.set_updated_at();

create trigger time_entries_set_updated_at
before update on public.time_entries
for each row execute function public.set_updated_at();

alter table public.time_tracking_project_settings enable row level security;
alter table public.time_entries enable row level security;

create policy "owners manage time tracking settings"
on public.time_tracking_project_settings for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owners manage time entries"
on public.time_entries for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
