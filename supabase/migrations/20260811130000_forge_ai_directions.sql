create table public.forge_ai_directions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  title text not null,
  reason text not null,
  minutes integer not null check (minutes between 5 and 480),
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forge_ai_directions enable row level security;

create policy "owners manage their Forge AI direction"
  on public.forge_ai_directions for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
