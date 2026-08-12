create table if not exists public.forge_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forge_chat_sessions_owner_updated_idx
  on public.forge_chat_sessions(owner_id, updated_at desc);

alter table public.forge_chat_sessions enable row level security;
create policy "owners manage Forge chat sessions"
  on public.forge_chat_sessions for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter table public.forge_chat_messages
  add column if not exists session_id uuid references public.forge_chat_sessions(id) on delete cascade;

insert into public.forge_chat_sessions (owner_id, title)
select distinct messages.owner_id, 'General'
from public.forge_chat_messages messages
where not exists (
  select 1 from public.forge_chat_sessions sessions where sessions.owner_id = messages.owner_id
);

update public.forge_chat_messages messages
set session_id = sessions.id
from public.forge_chat_sessions sessions
where messages.session_id is null
  and sessions.owner_id = messages.owner_id
  and sessions.title = 'General';

create index if not exists forge_chat_messages_session_created_idx
  on public.forge_chat_messages(session_id, created_at desc);
