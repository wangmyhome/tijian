-- Run once in the Supabase SQL Editor. Safe to run again.
-- The admin account itself is created in Authentication > Users.
create table if not exists public.tijian_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.tijian_workspaces enable row level security;
revoke all on public.tijian_workspaces from anon, authenticated;
grant select on public.tijian_workspaces to authenticated;
drop policy if exists "Read own study workspace" on public.tijian_workspaces;
create policy "Read own study workspace"
on public.tijian_workspaces for select to authenticated
using ((select auth.uid()) = user_id
  and (select auth.jwt() ->> 'email') = 'admin@tijian.local');

-- Writes use an atomic revision check, so a stale device cannot silently
-- overwrite work uploaded by another device. The owner comes from Auth,
-- never from a user_id supplied by the browser.
create or replace function public.tijian_save_workspace(
  expected_revision bigint,
  workspace_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  current_row public.tijian_workspaces%rowtype;
begin
  if owner_id is null or coalesce(auth.jwt() ->> 'email', '') <> 'admin@tijian.local' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if expected_revision is null or expected_revision < 0
    or workspace_payload is null
    or jsonb_typeof(workspace_payload) <> 'object'
    or workspace_payload ->> 'version' is distinct from '1'
    or jsonb_typeof(workspace_payload -> 'banks') is distinct from 'array'
    or jsonb_typeof(workspace_payload -> 'records') is distinct from 'object' then
    raise exception 'Invalid workspace' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
  select * into current_row from public.tijian_workspaces where user_id = owner_id for update;
  if coalesce(current_row.revision, 0) <> expected_revision then
    return jsonb_build_object('ok', false, 'revision', current_row.revision,
      'payload', current_row.payload, 'updated_at', current_row.updated_at);
  end if;

  insert into public.tijian_workspaces(user_id, revision, payload, updated_at)
  values (owner_id, expected_revision + 1, workspace_payload, now())
  on conflict (user_id) do update set
    revision = excluded.revision, payload = excluded.payload, updated_at = excluded.updated_at
  returning * into current_row;
  return jsonb_build_object('ok', true, 'revision', current_row.revision,
    'updated_at', current_row.updated_at);
end;
$$;

revoke all on function public.tijian_save_workspace(bigint, jsonb) from public, anon;
grant execute on function public.tijian_save_workspace(bigint, jsonb) to authenticated;
