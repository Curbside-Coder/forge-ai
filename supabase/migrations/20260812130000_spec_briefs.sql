alter table public.specs
  add column if not exists brief_markdown text not null default '';
