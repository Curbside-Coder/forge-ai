alter table public.calendar_events
  add column if not exists recurrence text not null default 'none'
  check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));
