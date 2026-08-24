alter table public.shared_work_item_views
  add column if not exists shared_by text not null default 'Forge user';

create or replace function public.get_shared_work_item_view(share_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'name', name,
    'sharedBy', shared_by,
    'createdAt', created_at,
    'items', items
  )
  from public.shared_work_item_views
  where token = share_token;
$$;
