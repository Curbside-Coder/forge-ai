create table if not exists public.calendar_event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) > 0),
  created_at timestamptz not null default now()
);

create index if not exists calendar_event_comments_event_created_idx
  on public.calendar_event_comments(event_id, created_at);

alter table public.calendar_event_comments enable row level security;

create policy "owners manage calendar event comments"
  on public.calendar_event_comments for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
