create table public.forge_chat_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null,
  actions jsonb not null default '[]'::jsonb,
  usage jsonb,
  created_at timestamptz not null default now()
);

create index forge_chat_messages_owner_created_idx
  on public.forge_chat_messages(owner_id, created_at desc);

alter table public.forge_chat_messages enable row level security;

create policy "owners manage their Forge chat memory"
  on public.forge_chat_messages for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
