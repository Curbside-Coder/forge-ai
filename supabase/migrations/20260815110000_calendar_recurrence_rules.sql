alter table public.calendar_events
  drop constraint if exists calendar_events_recurrence_check;

alter table public.calendar_events
  add column if not exists custom_days smallint[] not null default '{}',
  add column if not exists recurrence_until date,
  add column if not exists excluded_dates date[] not null default '{}';

alter table public.calendar_events
  add constraint calendar_events_recurrence_check
  check (recurrence in ('none', 'daily', 'weekly', 'weekdays', 'weekends', 'monthly', 'yearly', 'custom'));
