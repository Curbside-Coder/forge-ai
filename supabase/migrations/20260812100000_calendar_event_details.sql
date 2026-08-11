alter table public.calendar_events
  add column if not exists icon text not null default 'calendar',
  add column if not exists color text not null default 'slate',
  add column if not exists all_day boolean not null default false,
  add column if not exists preparation_note text not null default '';
