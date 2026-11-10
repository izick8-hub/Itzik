-- Additive update for an existing project, AFTER both 20261105 and 20261108 migrations.
-- Completes a list without creating a receipt, price or payment record.
begin;
create or replace function public.shopping_commit(action jsonb,expected_household uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare selected public.shopping_lists;
begin
 perform 1 from public.shopping_members where user_id=auth.uid() and household_id=expected_household for share;
 if not found then raise exception 'unauthorized' using errcode='42501';end if;
 if action->>'type'='completeList' then
  select * into selected from public.shopping_lists where id=(action->>'id')::uuid and household_id=expected_household for update;
  if not found then raise exception 'unauthorized' using errcode='42501';end if;
  if selected.status<>'completed' then
   if selected.version is distinct from (action->>'expected')::integer then raise exception 'conflict';end if;
   update public.shopping_lists set status='completed',version=version+1 where id=selected.id and household_id=expected_household;
  end if;
 else
  perform public.shopping_mutate(action);
 end if;
 return public.shopping_snapshot(expected_household);
end$$;
revoke all on function public.shopping_commit(jsonb,uuid) from public,anon;
grant execute on function public.shopping_commit(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
