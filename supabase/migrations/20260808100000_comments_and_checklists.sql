create table public.comments (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  body text not null check (char_length(body) > 0),
  completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comments enable row level security;
alter table public.checklists enable row level security;

create policy "work item creators manage comments" on public.comments for all using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "work item creators manage checklists" on public.checklists for all using (exists (select 1 from public.work_items where work_items.id = checklists.work_item_id and work_items.created_by = auth.uid())) with check (exists (select 1 from public.work_items where work_items.id = checklists.work_item_id and work_items.created_by = auth.uid()));

create trigger comments_set_updated_at before update on public.comments for each row execute function public.set_updated_at();
create trigger checklists_set_updated_at before update on public.checklists for each row execute function public.set_updated_at();
