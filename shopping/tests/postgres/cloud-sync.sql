set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false) as ignored \gset
select public.shopping_create_household('הבית הראשון') as household \gset
select public.shopping_invite() as invitation \gset
select set_config('test.household',:'household',false) as ignored \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false) as ignored \gset
select public.test_assert(public.shopping_join_household(:'invitation')=:'household'::uuid,'second user joins same household');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false) as ignored \gset
select public.test_assert(jsonb_array_length((public.shopping_commit('{"type":"list","value":{"id":"10000000-0000-4000-8000-000000000001","name":"חמישי שלנו","date":"2026-11-12","version":1}}',:'household'))->'lists')=1,'commit response reads back the persisted lists');
select public.test_assert(jsonb_array_length((public.shopping_commit('{"type":"item","value":{"id":"20000000-0000-4000-8000-000000000001","list_id":"10000000-0000-4000-8000-000000000001","product_id":"starter-0-0","name":"מלפפונים","category":"ירקות","emoji":"🥒","quantity":1.5,"unit":"קילוגרמים","checked":false}}',:'household'))->'items')=1,'commit response reads back the persisted items');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false) as ignored \gset
select public.test_assert((select count(*)=1 from public.shopping_lists),'partner SELECT sees committed list under RLS');
select public.test_assert((select count(*)=1 from public.shopping_items where quantity=1.5),'partner SELECT sees committed item under RLS');
select public.shopping_commit('{"type":"item","expected":1,"value":{"id":"20000000-0000-4000-8000-000000000001","list_id":"10000000-0000-4000-8000-000000000001","name":"מלפפונים","quantity":2,"unit":"קילוגרמים","checked":true}}',:'household') as ignored \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false) as ignored \gset
select public.test_assert((public.shopping_snapshot(:'household')->'items'->0->>'checked')::boolean,'first user reads partner update');
do $$begin
 begin perform public.shopping_commit('{"type":"item","expected":1,"value":{"id":"20000000-0000-4000-8000-000000000001","list_id":"10000000-0000-4000-8000-000000000001","name":"מלפפונים","quantity":9,"unit":"קילוגרמים","checked":false}}',current_setting('test.household')::uuid);raise exception 'missing conflict';exception when raise_exception then if sqlerrm<>'conflict' then raise;end if;end;
 perform public.test_assert((select quantity=2 and version=2 from public.shopping_items limit 1),'stale edit rejected without overwriting partner');
 begin insert into public.shopping_lists(id,household_id,name,date) values(gen_random_uuid(),current_setting('test.household')::uuid,'forbidden',current_date);raise exception 'insert allowed';exception when insufficient_privilege then null;end;
 begin update public.shopping_items set checked=false;raise exception 'update allowed';exception when insufficient_privilege then null;end;
 begin delete from public.shopping_items;raise exception 'delete allowed';exception when insufficient_privilege then null;end;
 perform public.test_assert(true,'direct INSERT UPDATE DELETE remain forbidden; RPC is required');
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false) as ignored \gset
select public.shopping_create_household('בית אחר') as other_household \gset
select public.test_assert((select count(*)=0 from public.shopping_lists) and (select count(*)=0 from public.shopping_items),'unrelated user cannot SELECT household data');
do $$begin
 begin perform public.shopping_snapshot(current_setting('test.household')::uuid);raise exception 'snapshot allowed';exception when insufficient_privilege then null;end;
 begin perform public.shopping_commit('{"type":"list","value":{"id":"10000000-0000-4000-8000-000000000001","name":"attacker","date":"2026-11-12","version":1}}',current_setting('test.household')::uuid);raise exception 'cross household write allowed';exception when insufficient_privilege then null;end;
 perform public.test_assert(true,'snapshot and commit reject unrelated household even with known IDs');
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false) as ignored \gset
select '{"lists":[{"id":"10000000-0000-4000-8000-000000000002","name":"המקומית שלנו","date":"2026-11-12","status":"planned","created_at":"2026-11-08T10:00:00Z"}],"items":[{"id":"20000000-0000-4000-8000-000000000002","list_id":"10000000-0000-4000-8000-000000000002","product_id":"starter-0-0","name":"מלפפונים","category":"ירקות","emoji":"🥒","quantity":3,"unit":"קילוגרמים","checked":true}],"products":[]}' as payload \gset
select public.shopping_import_local(:'payload',:'household') as ignored \gset
select public.shopping_import_local(:'payload',:'household') as ignored \gset
select public.test_assert((select count(*)=2 from public.shopping_lists) and (select count(*)=2 from public.shopping_items),'repeated import does not duplicate lists or items');
select public.shopping_commit('{"type":"item","expected":1,"value":{"id":"20000000-0000-4000-8000-000000000002","list_id":"10000000-0000-4000-8000-000000000002","name":"מלפפונים","quantity":4,"unit":"קילוגרמים","checked":false}}',:'household') as ignored \gset
select public.shopping_import_local(:'payload',:'household') as ignored \gset
select public.test_assert((select quantity=4 and not checked from public.shopping_items where id='20000000-0000-4000-8000-000000000002'),'repeated import preserves subsequent cloud edits');
select version as before_delete from public.shopping_lists where id='10000000-0000-4000-8000-000000000002' \gset
select public.shopping_commit('{"type":"deleteItem","id":"20000000-0000-4000-8000-000000000002","expected":2}',:'household') as ignored \gset
select public.test_assert((select version=(:'before_delete')::integer+1 from public.shopping_lists where id='10000000-0000-4000-8000-000000000002'),'DELETE emits parent UPDATE for filtered Realtime subscribers');
select public.shopping_import_local(:'payload',:'household') as ignored \gset
select public.test_assert(not exists(select 1 from public.shopping_items where id='20000000-0000-4000-8000-000000000002'),'repeated import does not resurrect deleted items');
do $$begin
 begin perform public.shopping_import_local('{"lists":[{"id":"10000000-0000-4000-8000-000000000003","name":"rollback","date":"2026-11-12","status":"planned","created_at":"2026-11-08T10:00:00Z"}],"items":[{"id":"20000000-0000-4000-8000-000000000003","list_id":"10000000-0000-4000-8000-000000000003","product_id":"starter-0-0","name":"invalid","category":"ירקות","emoji":"🥒","quantity":0,"unit":"קילוגרמים","checked":false}],"products":[]}',current_setting('test.household')::uuid);raise exception 'invalid import accepted';exception when check_violation then null;end;
 perform public.test_assert(not exists(select 1 from public.shopping_lists where id='10000000-0000-4000-8000-000000000003'),'failed import rolls back every row atomically');
end$$;
select public.test_assert((select count(*)=4 from pg_publication_tables where pubname='supabase_realtime' and tablename in ('shopping_lists','shopping_items','shopping_products','shopping_receipts')),'all shopping tables published for Realtime');
reset role;
