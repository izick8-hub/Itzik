-- Run AFTER 202611050001_shopping.sql, in the existing project's SQL Editor.
-- Additive and repeatable. No existing shopping data or local browser data is deleted.
begin;
create or replace function public.shopping_snapshot(expected_household uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare hid uuid;
begin
 select household_id into hid from public.shopping_members where user_id=auth.uid();
 if hid is null or hid is distinct from expected_household then raise exception 'unauthorized' using errcode='42501';end if;
 return jsonb_build_object('household_id',hid,
 'lists',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at,l.id) from public.shopping_lists l where l.household_id=hid),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.shopping_items i where i.household_id=hid),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(p.data order by p.id) from public.shopping_products p where p.household_id=hid),'[]'::jsonb),
 'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from public.shopping_receipts r where r.household_id=hid),'[]'::jsonb));
end$$;
create or replace function public.shopping_commit(action jsonb,expected_household uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 -- Bind this operation to the household the client actually loaded, even if its
 -- session changes while the request is in flight. Never infer a different target.
 perform 1 from public.shopping_members where user_id=auth.uid() and household_id=expected_household for share;
 if not found then raise exception 'unauthorized' using errcode='42501';end if;
 perform public.shopping_mutate(action);
 -- Database readback in the SAME transaction. A rejected write never returns success.
 return public.shopping_snapshot(expected_household);
end$$;
create table if not exists public.shopping_local_imports(
 household_id uuid not null references public.shopping_households(id),
 source_kind text not null check(source_kind in ('list','item','product')),
 source_id uuid not null,
 imported_at timestamptz not null default now(),
 primary key(household_id,source_kind,source_id)
);
alter table public.shopping_local_imports enable row level security;
revoke all on public.shopping_local_imports from public,anon,authenticated;
create or replace function public.shopping_import_local(payload jsonb,expected_household uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hid uuid; v jsonb; sid uuid; lid uuid;
begin
 select household_id into hid from public.shopping_members where user_id=auth.uid();
 if hid is null or hid is distinct from expected_household then raise exception 'unauthorized' using errcode='42501';end if;
 -- Serialize concurrent imports, including imports from both partners.
 perform 1 from public.shopping_households where id=hid for update;
 if jsonb_typeof(payload->'lists') is distinct from 'array' or jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_typeof(payload->'products') is distinct from 'array' then raise exception 'invalid import';end if;
 if jsonb_array_length(payload->'lists') not between 1 and 2000 or jsonb_array_length(payload->'items')>20000 or jsonb_array_length(payload->'products')>5000 then raise exception 'import too large';end if;
 for v in select * from jsonb_array_elements(payload->'products') loop
  sid:=(v->>'id')::uuid;
  if exists(select 1 from public.shopping_products where id=sid and household_id<>hid) then raise exception 'conflict';end if;
  if exists(select 1 from public.shopping_local_imports where household_id=hid and source_kind='product' and source_id=sid) then continue;end if;
  if jsonb_typeof(v->'name') is distinct from 'string' or length(v->>'name') not between 1 and 120 or jsonb_typeof(v->'category') is distinct from 'string' or length(v->>'category') not between 1 and 100 or coalesce(v->>'source','') not in ('personal','import') or coalesce(v->>'unit','') not in ('יחידות','גרמים','קילוגרמים','ליטרים','מיליליטרים','אריזות') then raise exception 'invalid product';end if;
  insert into public.shopping_products values(sid,hid,v) on conflict(id) do nothing;
  insert into public.shopping_local_imports(household_id,source_kind,source_id) values(hid,'product',sid);
 end loop;
 for v in select * from jsonb_array_elements(payload->'lists') loop
  sid:=(v->>'id')::uuid;
  if exists(select 1 from public.shopping_lists where id=sid and household_id<>hid) then raise exception 'conflict';end if;
  if exists(select 1 from public.shopping_local_imports where household_id=hid and source_kind='list' and source_id=sid) then continue;end if;
  insert into public.shopping_lists(id,household_id,name,date,status,created_at) values(sid,hid,v->>'name',(v->>'date')::date,v->>'status',(v->>'created_at')::timestamptz) on conflict(id) do nothing;
  insert into public.shopping_local_imports(household_id,source_kind,source_id) values(hid,'list',sid);
 end loop;
 for v in select * from jsonb_array_elements(payload->'items') loop
  sid:=(v->>'id')::uuid;lid:=(v->>'list_id')::uuid;
  if not exists(select 1 from jsonb_array_elements(payload->'lists') l where (l->>'id')::uuid=lid) or not exists(select 1 from public.shopping_lists where id=lid and household_id=hid) then raise exception 'invalid list';end if;
  if exists(select 1 from public.shopping_items where id=sid and (household_id<>hid or list_id<>lid)) then raise exception 'conflict';end if;
  if exists(select 1 from public.shopping_local_imports where household_id=hid and source_kind='item' and source_id=sid) then continue;end if;
  insert into public.shopping_items(id,household_id,list_id,product_id,name,category,emoji,quantity,unit,checked) values(sid,hid,lid,v->>'product_id',v->>'name',v->>'category',v->>'emoji',(v->>'quantity')::numeric,v->>'unit',(v->>'checked')::boolean) on conflict(id) do nothing;
  insert into public.shopping_local_imports(household_id,source_kind,source_id) values(hid,'item',sid);
 end loop;
 -- Receipts and their photos are intentionally not imported here; the untouched
 -- browser backup still contains them. Never invent cloud paths for local images.
 return public.shopping_snapshot(hid);
end$$;
-- Do NOT open INSERT/UPDATE/DELETE policies. Writes must go through validated RPCs.
grant usage on schema public to authenticated;
grant select on public.shopping_members,public.shopping_lists,public.shopping_items,public.shopping_products,public.shopping_receipts to authenticated;
revoke insert,update,delete on public.shopping_lists,public.shopping_items,public.shopping_products,public.shopping_receipts from anon,authenticated;
revoke all on function public.shopping_snapshot(uuid),public.shopping_commit(jsonb,uuid),public.shopping_import_local(jsonb,uuid) from public,anon;
grant execute on function public.shopping_snapshot(uuid),public.shopping_commit(jsonb,uuid),public.shopping_import_local(jsonb,uuid) to authenticated;
-- Supabase does not support household-filtered DELETE events reliably. A deletion
-- touches its parent list, producing an authorized, filterable UPDATE event.
create or replace function public.shopping_item_deleted() returns trigger
language plpgsql security definer set search_path='' as $$begin
 update public.shopping_lists set version=version+1 where id=old.list_id and household_id=old.household_id;
 return old;
end$$;
revoke all on function public.shopping_item_deleted() from public,anon,authenticated;
drop trigger if exists shopping_item_deleted on public.shopping_items;
create trigger shopping_item_deleted after delete on public.shopping_items for each row execute function public.shopping_item_deleted();
do $$declare t text;begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['shopping_lists','shopping_items','shopping_products','shopping_receipts'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
  end loop;
 end if;
end$$;
notify pgrst,'reload schema';
commit;
