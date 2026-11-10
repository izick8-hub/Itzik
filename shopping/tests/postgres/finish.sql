set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false) as ignored \gset
select household_id as household from public.shopping_members where user_id=auth.uid() \gset
select public.shopping_commit('{"type":"item","value":{"id":"20000000-0000-4000-8000-000000000004","list_id":"10000000-0000-4000-8000-000000000001","product_id":"starter-0-0","name":"מלפפונים","category":"ירקות","emoji":"🥒","quantity":3,"unit":"קילוגרמים","checked":false}}',:'household') as ignored \gset
select public.shopping_commit('{"type":"completeList","id":"10000000-0000-4000-8000-000000000001","expected":1}',:'household') as ignored \gset
select public.test_assert((select status='completed' from public.shopping_lists where id='10000000-0000-4000-8000-000000000001'),'purchase finishes without a receipt');
select public.test_assert((select quantity=3 and not checked from public.shopping_items where id='20000000-0000-4000-8000-000000000004'),'finish preserves quantities and uncollected status');
select public.test_assert((select count(*)=0 from public.shopping_receipts),'finish invents neither receipt nor price');
select public.shopping_commit('{"type":"completeList","id":"10000000-0000-4000-8000-000000000001","expected":1}',:'household') as ignored \gset
select public.test_assert((select version=2 from public.shopping_lists where id='10000000-0000-4000-8000-000000000001'),'repeated finish is idempotent');
select public.shopping_commit('{"type":"list","value":{"id":"10000000-0000-4000-8000-000000000004","name":"הקנייה הבאה","date":"2026-11-19","version":1}}',:'household') as ignored \gset
select public.shopping_commit('{"type":"confirmReceipt","value":{"id":"30000000-0000-4000-8000-000000000001","list_id":"10000000-0000-4000-8000-000000000001","date":"2026-11-12","store":"סופר","total":5,"lines":[{"id":"line1","product_id":"starter-0-0","name":"מלפפונים","quantity":1,"unit":"קילוגרמים","unit_price":5,"total":5,"discount":0,"uncertain":false}]}}',:'household') as ignored \gset
select public.test_assert((select list_id='10000000-0000-4000-8000-000000000001'::uuid and total=5 from public.shopping_receipts),'retroactive receipt belongs to the old completed purchase');
select public.test_assert((select status='planned' from public.shopping_lists where id='10000000-0000-4000-8000-000000000004'),'retroactive receipt does not complete the new list');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false) as ignored \gset
select public.shopping_commit('{"type":"completeList","id":"10000000-0000-4000-8000-000000000004","expected":1}',:'household') as ignored \gset
select public.test_assert((select status='completed' from public.shopping_lists where id='10000000-0000-4000-8000-000000000004'),'partner can finish a shared list');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false) as ignored \gset
select set_config('test.finish_household',:'household',false) as ignored \gset
do $$begin begin perform public.shopping_commit('{"type":"completeList","id":"10000000-0000-4000-8000-000000000004","expected":1}',current_setting('test.finish_household')::uuid);raise exception 'foreign finish allowed';exception when insufficient_privilege then null;end;perform public.test_assert(true,'outsider cannot finish the household purchase');end$$;
