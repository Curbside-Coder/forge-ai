-- Forge Playbooks: spec-driven execution, focus, ideas, and personal direction.
alter table public.work_items
  add column if not exists spec_id uuid,
  add column if not exists effort_minutes integer check (effort_minutes is null or effort_minutes > 0),
  add column if not exists due_at timestamptz,
  add column if not exists leverage smallint not null default 3 check (leverage between 1 and 5),
  add column if not exists importance smallint not null default 3 check (importance between 1 and 5);

create type public.spec_status as enum ('draft', 'active', 'blocked', 'completed', 'archived');
create type public.spec_step_status as enum ('todo', 'in_progress', 'blocked', 'done');
create type public.life_area as enum ('work', 'family', 'health', 'learning', 'faith', 'finance', 'creative');

create table public.specs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 180),
  problem_statement text not null default '',
  desired_outcome text not null default '',
  in_scope text not null default '',
  out_of_scope text not null default '',
  technical_context text not null default '',
  edge_cases text not null default '',
  retrospective text not null default '',
  status public.spec_status not null default 'draft',
  priority public.work_item_priority not null default 'medium',
  active_position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.work_items
  add constraint work_items_spec_id_fkey foreign key (spec_id) references public.specs(id) on delete set null;

create table public.spec_steps (
  id uuid primary key default gen_random_uuid(),
  spec_id uuid not null references public.specs(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  notes text not null default '',
  status public.spec_step_status not null default 'todo',
  estimate_minutes integer not null default 15 check (estimate_minutes between 1 and 240),
  position integer not null default 0,
  work_item_id uuid references public.work_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  spec_step_id uuid references public.spec_steps(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  title text not null,
  planned_minutes integer not null default 25 check (planned_minutes between 1 and 240),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  interruption_note text
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  body text not null default '',
  life_area public.life_area not null default 'work',
  status text not null default 'seed' check (status in ('seed', 'exploring', 'experiment', 'incubating', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compass_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  life_area public.life_area not null default 'work',
  horizon text not null default 'quarter' check (horizon in ('week', 'quarter', 'year', 'long_term')),
  outcome text not null default '',
  next_action text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index specs_owner_status_idx on public.specs(owner_id, status, active_position);
create index spec_steps_spec_position_idx on public.spec_steps(spec_id, position);
create index focus_sessions_owner_started_idx on public.focus_sessions(owner_id, started_at desc);
create index ideas_owner_status_idx on public.ideas(owner_id, status, updated_at desc);
create index compass_goals_owner_active_idx on public.compass_goals(owner_id, active);

alter table public.specs enable row level security;
alter table public.spec_steps enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.ideas enable row level security;
alter table public.compass_goals enable row level security;

create policy "owners manage their specs" on public.specs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage their spec steps" on public.spec_steps for all using (exists (select 1 from public.specs where specs.id = spec_steps.spec_id and specs.owner_id = auth.uid())) with check (exists (select 1 from public.specs where specs.id = spec_steps.spec_id and specs.owner_id = auth.uid()));
create policy "owners manage their focus sessions" on public.focus_sessions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage their ideas" on public.ideas for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage their compass goals" on public.compass_goals for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
