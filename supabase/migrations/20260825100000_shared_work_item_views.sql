create table public.shared_work_item_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  token uuid not null unique default gen_random_uuid(),
  filter_definition jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_work_item_views enable row level security;

create policy "owners manage shared work item views"
  on public.shared_work_item_views for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create trigger shared_work_item_views_set_updated_at
  before update on public.shared_work_item_views
  for each row execute function public.set_updated_at();

create or replace function public.get_shared_work_item_view(share_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'name', name,
    'createdAt', created_at,
    'items', items
  )
  from public.shared_work_item_views
  where token = share_token;
$$;

grant execute on function public.get_shared_work_item_view(uuid) to anon, authenticated;
