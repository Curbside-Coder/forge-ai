create table public.work_item_saved_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  filter_definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.work_item_saved_views enable row level security;

create policy "owners manage saved work item views"
  on public.work_item_saved_views for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create trigger work_item_saved_views_set_updated_at
  before update on public.work_item_saved_views
  for each row execute function public.set_updated_at();
