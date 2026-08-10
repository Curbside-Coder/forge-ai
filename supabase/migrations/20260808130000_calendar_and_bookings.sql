create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  external_id text,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'forge',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, external_id)
);

create table public.booking_pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,64}$'),
  title text not null,
  duration_minutes integer not null default 30 check (duration_minutes between 15 and 240),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_page_id uuid not null references public.booking_pages(id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;
alter table public.booking_pages enable row level security;
alter table public.bookings enable row level security;
create policy "owners manage calendar events" on public.calendar_events for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners manage booking pages" on public.booking_pages for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners read bookings" on public.bookings for select using (exists (select 1 from public.booking_pages where booking_pages.id = bookings.booking_page_id and booking_pages.owner_id = auth.uid()));
create trigger calendar_events_set_updated_at before update on public.calendar_events for each row execute function public.set_updated_at();
create trigger booking_pages_set_updated_at before update on public.booking_pages for each row execute function public.set_updated_at();
