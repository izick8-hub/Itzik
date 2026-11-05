-- Optional cloud mode. Execute in a new Supabase project's SQL editor.
-- This migration does not touch the fitness application.
create extension if not exists pgcrypto with schema extensions;
create table public.shopping_households(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100));
create table public.shopping_members(user_id uuid primary key references auth.users(id) on delete cascade,household_id uuid not null references public.shopping_households(id));
create index on public.shopping_members(household_id);
create table public.shopping_invites(token_hash text primary key,household_id uuid not null references public.shopping_households(id),expires_at timestamptz not null);
create or replace function public.shopping_member(hid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.shopping_members where household_id=hid and user_id=auth.uid())$$;
create table public.shopping_lists(id uuid primary key,household_id uuid not null references public.shopping_households(id),name text not null check(length(name) between 1 and 100),date date not null,status text not null default 'planned' check(status in ('planned','shopping','completed')),version integer not null default 1 check(version>0),created_at timestamptz not null default now(),unique(id,household_id));
create table public.shopping_items(id uuid primary key,household_id uuid not null,list_id uuid not null,product_id text not null check(length(product_id) between 1 and 200),name text not null check(length(name) between 1 and 200),category text not null check(length(category) between 1 and 100),emoji text not null default '🛍️' check(length(emoji)<=16),quantity numeric not null check(quantity>0 and quantity<=100000),unit text not null check(unit in ('יחידות','גרמים','קילוגרמים','ליטרים','מיליליטרים','אריזות')),checked boolean not null default false,version integer not null default 1,foreign key(list_id,household_id) references public.shopping_lists(id,household_id) on delete cascade);
create index on public.shopping_lists(household_id); create index on public.shopping_items(household_id,list_id);
create table public.shopping_products(id uuid primary key,household_id uuid not null references public.shopping_households(id),data jsonb not null check(jsonb_typeof(data)='object'));
create table public.shopping_receipts(version integer not null default 1,id uuid primary key,household_id uuid not null,list_id uuid not null,date date not null,store text not null check(length(store) between 1 and 100),total numeric not null check(total>=0 and total<=1000000),status text not null default 'draft' check(status in ('draft','confirmed')),lines jsonb not null default '[]' check(jsonb_typeof(lines)='array' and jsonb_array_length(lines)<=300),image_path text,created_at timestamptz not null default now(),foreign key(list_id,household_id) references public.shopping_lists(id,household_id));
create index on public.shopping_receipts(household_id,list_id);
alter table public.shopping_households enable row level security;alter table public.shopping_members enable row level security;alter table public.shopping_invites enable row level security;alter table public.shopping_lists enable row level security;alter table public.shopping_items enable row level security;alter table public.shopping_products enable row level security;alter table public.shopping_receipts enable row level security;
create policy household_read on public.shopping_households for select to authenticated using(public.shopping_member(id));
create policy members_read on public.shopping_members for select to authenticated using(public.shopping_member(household_id));
create policy lists_read on public.shopping_lists for select to authenticated using(public.shopping_member(household_id));
create policy items_read on public.shopping_items for select to authenticated using(public.shopping_member(household_id));
create policy products_read on public.shopping_products for select to authenticated using(public.shopping_member(household_id));
create policy receipts_read on public.shopping_receipts for select to authenticated using(public.shopping_member(household_id));
-- Direct writes are forbidden. RPCs enforce household, conflicts and immutable confirmation.
revoke all on public.shopping_invites from anon, authenticated;
revoke insert,update,delete on public.shopping_households,public.shopping_members,public.shopping_lists,public.shopping_items,public.shopping_products,public.shopping_receipts from anon,authenticated;
grant select on public.shopping_households,public.shopping_members,public.shopping_lists,public.shopping_items,public.shopping_products,public.shopping_receipts to authenticated;
create or replace function public.shopping_create_household(label text) returns uuid language plpgsql security definer set search_path='' as $$declare hid uuid; begin if auth.uid() is null then raise exception 'unauthorized';end if; if exists(select 1 from public.shopping_members where user_id=auth.uid()) then raise exception 'already member';end if;insert into public.shopping_households(name) values(label) returning id into hid;insert into public.shopping_members values(auth.uid(),hid);return hid;end$$;
create or replace function public.shopping_invite() returns text language plpgsql security definer set search_path='' as $$declare hid uuid;token text;begin select household_id into hid from public.shopping_members where user_id=auth.uid();if hid is null then raise exception 'unauthorized';end if;perform 1 from public.shopping_households where id=hid for update;if (select count(*) from public.shopping_members where household_id=hid)>=2 then raise exception 'full';end if;token:=encode(extensions.gen_random_bytes(24),'hex');delete from public.shopping_invites where household_id=hid;insert into public.shopping_invites values(encode(extensions.digest(token,'sha256'),'hex'),hid,now()+interval '24 hours');return token;end$$;
create or replace function public.shopping_join_household(invite text) returns uuid language plpgsql security definer set search_path='' as $$declare hid uuid;begin if auth.uid() is null then raise exception 'unauthorized';end if;select household_id into hid from public.shopping_invites where token_hash=encode(extensions.digest(invite,'sha256'),'hex') and expires_at>now();if hid is null then raise exception 'invalid invitation';end if;perform 1 from public.shopping_households where id=hid for update;if not exists(select 1 from public.shopping_invites where token_hash=encode(extensions.digest(invite,'sha256'),'hex') and expires_at>now()) or (select count(*) from public.shopping_members where household_id=hid)>=2 then raise exception 'full or expired';end if;insert into public.shopping_members values(auth.uid(),hid);delete from public.shopping_invites where household_id=hid;return hid;end$$;
create or replace function public.shopping_mutate(action jsonb) returns void language plpgsql security definer set search_path='' as $$
declare hid uuid;v jsonb:=action->'value';kind text:=action->>'type';lid uuid; rid uuid; expected integer;old_receipt public.shopping_receipts;line jsonb;line_sum numeric:=0;original public.shopping_lists;new_id uuid;
begin
select household_id into hid from public.shopping_members where user_id=auth.uid();if hid is null then raise exception 'unauthorized';end if;
if kind='list' then
  if exists(select 1 from public.shopping_lists where id=(v->>'id')::uuid) then
    update public.shopping_lists set name=v->>'name',date=(v->>'date')::date,version=version+1 where id=(v->>'id')::uuid and household_id=hid and version=(v->>'version')::integer;
    if not found then raise exception 'conflict';end if;
  else
    insert into public.shopping_lists(id,household_id,name,date) values((v->>'id')::uuid,hid,v->>'name',(v->>'date')::date);
  end if;
elsif kind='item' then
  lid:=(v->>'list_id')::uuid;if not exists(select 1 from public.shopping_lists where id=lid and household_id=hid) then raise exception 'unauthorized';end if;
  if exists(select 1 from public.shopping_items where id=(v->>'id')::uuid) then
    update public.shopping_items set name=v->>'name',quantity=(v->>'quantity')::numeric,unit=v->>'unit',checked=(v->>'checked')::boolean,version=version+1 where id=(v->>'id')::uuid and list_id=lid and household_id=hid and version=(action->>'expected')::integer;
    if not found then raise exception 'conflict';end if;
  else
    if action ? 'expected' then raise exception 'conflict';end if;
    insert into public.shopping_items(id,household_id,list_id,product_id,name,category,emoji,quantity,unit,checked) values((v->>'id')::uuid,hid,lid,v->>'product_id',v->>'name',v->>'category',v->>'emoji',(v->>'quantity')::numeric,v->>'unit',(v->>'checked')::boolean);
  end if;
elsif kind='deleteItem' then
  delete from public.shopping_items where id=(action->>'id')::uuid and household_id=hid and version=(action->>'expected')::integer;if not found then raise exception 'conflict';end if;
elsif kind='product' then
  if length(v->>'name') not between 1 and 120 or length(v->>'category') not between 1 and 100 or (v->>'source')<>'personal' or (v->>'unit') not in ('יחידות','גרמים','קילוגרמים','ליטרים','מיליליטרים','אריזות') then raise exception 'invalid product';end if;
  insert into public.shopping_products values((v->>'id')::uuid,hid,v);
elsif kind='duplicate' then
  select * into original from public.shopping_lists where id=(action->>'id')::uuid and household_id=hid;if not found then raise exception 'unauthorized';end if;
  new_id:=gen_random_uuid();insert into public.shopping_lists(id,household_id,name,date) values(new_id,hid,left(original.name||' · שוב ביחד',100),(action->>'date')::date);
  insert into public.shopping_items(id,household_id,list_id,product_id,name,category,emoji,quantity,unit) select gen_random_uuid(),hid,new_id,product_id,name,category,emoji,quantity,unit from public.shopping_items where list_id=original.id and household_id=hid;
elsif kind in ('receipt','confirmReceipt') then
  lid:=(v->>'list_id')::uuid;rid:=(v->>'id')::uuid;
  -- Serialize new and existing receipts to prevent double confirmation and lost updates.
  perform 1 from public.shopping_lists where id=lid and household_id=hid for update;if not found then raise exception 'unauthorized';end if;
  select * into old_receipt from public.shopping_receipts where id=rid for update;
  if found then if old_receipt.household_id<>hid or old_receipt.list_id<>lid or old_receipt.status='confirmed' then raise exception 'receipt immutable';end if;if old_receipt.version<>coalesce((v->>'version')::integer,1) then raise exception 'conflict';end if;end if;
  if jsonb_typeof(v->'lines') is distinct from 'array' or jsonb_array_length(v->'lines')>300 then raise exception 'invalid lines';end if;
  if v->>'image_path' is not null and (split_part(v->>'image_path','/',1)<>hid::text or split_part(v->>'image_path','/',2)<>lid::text) then raise exception 'invalid image';end if;
  for line in select * from jsonb_array_elements(v->'lines') loop
    if jsonb_typeof(line->'id') is distinct from 'string' or jsonb_typeof(line->'name') is distinct from 'string' or jsonb_typeof(line->'quantity') is distinct from 'number' or jsonb_typeof(line->'unit') is distinct from 'string' or jsonb_typeof(line->'unit_price') is distinct from 'number' or jsonb_typeof(line->'total') is distinct from 'number' or jsonb_typeof(line->'discount') is distinct from 'number' or jsonb_typeof(line->'uncertain') is distinct from 'boolean' then raise exception 'invalid receipt types';end if;
    if not (line ?& array['id','name','quantity','unit','unit_price','total','discount','uncertain']) or length(line->>'name') not between 1 and 200 or (line->>'quantity')::numeric<=0 or (line->>'quantity')::numeric>100000 or (line->>'unit_price')::numeric<0 or (line->>'unit_price')::numeric>1000000 or (line->>'total')::numeric<0 or (line->>'total')::numeric>1000000 or (line->>'discount')::numeric<0 or (line->>'discount')::numeric>1000000 or (line->>'unit') not in ('יחידות','גרמים','קילוגרמים','ליטרים','מיליליטרים','אריזות') then raise exception 'invalid receipt line';end if;
    if kind='confirmReceipt' and (line->>'uncertain')::boolean is distinct from false then raise exception 'review required';end if;
    if line->>'product_id' is not null and not ((line->>'product_id') ~ '^starter-[0-9]+-[0-9]+$' or exists(select 1 from public.shopping_products where id::text=line->>'product_id' and household_id=hid)) then raise exception 'invalid product match';end if;
    line_sum:=line_sum+(line->>'total')::numeric;
  end loop;
  if kind='confirmReceipt' and (jsonb_array_length(v->'lines')=0 or abs(line_sum-(v->>'total')::numeric)>0.05) then raise exception 'total mismatch';end if;
  insert into public.shopping_receipts(id,household_id,list_id,date,store,total,status,lines,image_path) values(rid,hid,lid,(v->>'date')::date,v->>'store',(v->>'total')::numeric,case when kind='confirmReceipt' then 'confirmed' else 'draft' end,v->'lines',v->>'image_path') on conflict(id) do update set version=public.shopping_receipts.version+1,date=excluded.date,store=excluded.store,total=excluded.total,status=excluded.status,lines=excluded.lines,image_path=excluded.image_path;
  if kind='confirmReceipt' then update public.shopping_lists set status='completed',version=version+1 where id=lid and household_id=hid;end if;
else raise exception 'unknown action';end if;
end$$;
revoke all on function public.shopping_member(uuid),public.shopping_create_household(text),public.shopping_invite(),public.shopping_join_household(text),public.shopping_mutate(jsonb) from public,anon;
grant execute on function public.shopping_member(uuid),public.shopping_create_household(text),public.shopping_invite(),public.shopping_join_household(text),public.shopping_mutate(jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('shopping-receipts','shopping-receipts',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy shopping_photo_read on storage.objects for select to authenticated using(bucket_id='shopping-receipts' and exists(select 1 from public.shopping_members m where m.user_id=auth.uid() and m.household_id::text=(storage.foldername(name))[1]));
create policy shopping_photo_insert on storage.objects for insert to authenticated with check(bucket_id='shopping-receipts' and exists(select 1 from public.shopping_lists l where l.id::text=(storage.foldername(name))[2] and l.household_id::text=(storage.foldername(name))[1] and public.shopping_member(l.household_id)));
-- No update/delete policy for receipt images: confirmed evidence cannot be overwritten.
alter publication supabase_realtime add table public.shopping_lists,public.shopping_items,public.shopping_products,public.shopping_receipts;
-- Emit only primary keys on deletion; clients refetch under RLS on reconnect and every 30s.
-- Bound AI spending per household. Each authorized attempt consumes quota, even on failure.
create table public.shopping_ocr_usage(household_id uuid not null references public.shopping_households(id),called_at timestamptz not null default now());
create index on public.shopping_ocr_usage(household_id,called_at);
alter table public.shopping_ocr_usage enable row level security;
revoke all on public.shopping_ocr_usage from public,anon,authenticated;
create function public.shopping_claim_ocr(receipt_id uuid) returns void language plpgsql security definer set search_path='' as $$declare hid uuid;begin
select household_id into hid from public.shopping_receipts where id=receipt_id and status='draft' and public.shopping_member(household_id);
if hid is null then raise exception 'unauthorized';end if;
perform 1 from public.shopping_households where id=hid for update;
if (select count(*) from public.shopping_ocr_usage where household_id=hid and called_at>now()-interval '1 minute')>=3 or (select count(*) from public.shopping_ocr_usage where household_id=hid and called_at>now()-interval '1 day')>=30 then raise exception 'rate limit';end if;
insert into public.shopping_ocr_usage(household_id) values(hid);
delete from public.shopping_ocr_usage where household_id=hid and called_at<now()-interval '2 days';end$$;
revoke all on function public.shopping_claim_ocr(uuid) from public,anon;
grant execute on function public.shopping_claim_ocr(uuid) to authenticated;
