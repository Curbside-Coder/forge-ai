-- Autopilot keeps internal plans and focus sessions, but removes unused manual-program features.
drop table if exists public.ideas;
drop table if exists public.compass_goals;
drop type if exists public.life_area;

alter table public.work_items
  drop column if exists effort_minutes,
  drop column if exists due_at,
  drop column if exists leverage,
  drop column if exists importance;
