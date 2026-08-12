alter table public.meetings
  add column if not exists work_item_id uuid references public.work_items(id) on delete set null;

create index if not exists meetings_work_item_idx on public.meetings(work_item_id);
