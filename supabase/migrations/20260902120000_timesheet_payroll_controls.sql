create table public.time_timesheet_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  period_start date not null,
  hourly_rate numeric(12, 4) not null default 0 check (hourly_rate >= 0),
  wise_link text not null default '',
  wise_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, project_id, period_start)
);

create table public.time_timesheet_overrides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  entry_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, project_id, entry_date)
);

create index time_timesheet_periods_owner_project_idx
on public.time_timesheet_periods(owner_id, project_id, period_start);

create index time_timesheet_overrides_owner_project_date_idx
on public.time_timesheet_overrides(owner_id, project_id, entry_date);

create trigger time_timesheet_periods_set_updated_at
before update on public.time_timesheet_periods
for each row execute function public.set_updated_at();

create trigger time_timesheet_overrides_set_updated_at
before update on public.time_timesheet_overrides
for each row execute function public.set_updated_at();

alter table public.time_timesheet_periods enable row level security;
alter table public.time_timesheet_overrides enable row level security;

create policy "owners manage timesheet periods"
on public.time_timesheet_periods for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owners manage timesheet overrides"
on public.time_timesheet_overrides for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
