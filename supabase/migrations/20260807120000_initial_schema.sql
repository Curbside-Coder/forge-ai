create extension if not exists "pgcrypto";

create type public.work_item_status as enum ('backlog', 'in_progress', 'in_review', 'done');
create type public.work_item_priority as enum ('critical', 'high', 'medium', 'low');
create type public.work_item_type as enum ('task', 'bug', 'feature', 'idea', 'research', 'improvement');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  status public.work_item_status not null default 'backlog',
  priority public.work_item_priority not null default 'medium',
  type public.work_item_type not null default 'task',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger work_items_set_updated_at before update on public.work_items for each row execute function public.set_updated_at();
create trigger meetings_set_updated_at before update on public.meetings for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.work_items enable row level security;
alter table public.meetings enable row level security;

create policy "owners manage projects" on public.projects for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "project owners manage work items" on public.work_items for all using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "meeting creators manage meetings" on public.meetings for all using (auth.uid() = created_by) with check (auth.uid() = created_by);
