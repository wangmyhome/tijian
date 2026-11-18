-- Run in the Supabase SQL Editor. Safe to run again; existing study data is retained.
begin;

create table if not exists public.tijian_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);
create table if not exists public.tijian_shared_banks (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0 check (revision >= 0),
  banks jsonb not null default '[]'::jsonb check (jsonb_typeof(banks) = 'array'),
  updated_at timestamptz not null default now()
);

-- Adopt only the administrator's legacy banks, never their private study data.
insert into public.tijian_shared_banks(singleton, revision, banks)
select true, case when w.payload is null then 0 else 1 end,
  coalesce(w.payload -> 'banks', '[]'::jsonb)
from (select 1) seed
left join auth.users u on u.email = 'admin@tijian.local'
left join public.tijian_workspaces w on w.user_id = u.id
on conflict (singleton) do nothing;

alter table public.tijian_workspaces enable row level security;
alter table public.tijian_shared_banks enable row level security;
revoke all on public.tijian_workspaces from public, anon, authenticated;
revoke all on public.tijian_shared_banks from public, anon, authenticated;
grant select on public.tijian_workspaces, public.tijian_shared_banks to authenticated;
drop policy if exists "Read own study workspace" on public.tijian_workspaces;
create policy "Read own study workspace" on public.tijian_workspaces
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Read shared banks" on public.tijian_shared_banks;
create policy "Read shared banks" on public.tijian_shared_banks
for select to authenticated using ((select auth.uid()) is not null);

-- Private helper: callers cannot request another account's workspace.
create or replace function public.tijian_workspace_snapshot(owner_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'revision', coalesce(w.revision, 0),
    'bank_revision', b.revision,
    'updated_at', greatest(w.updated_at, b.updated_at),
    'payload', coalesce(w.payload - 'banks', jsonb_build_object(
      'version', 1, 'records', '{}'::jsonb, 'settings', '{}'::jsonb,
      'activity', '{}'::jsonb, 'session', null, 'exams', '[]'::jsonb,
      'activeExam', null, 'selectedBank', coalesce(b.banks -> 0 ->> 'id', '')
    )) || jsonb_build_object('banks', b.banks)
  )
  from public.tijian_shared_banks b
  left join public.tijian_workspaces w on w.user_id = owner_id
  where b.singleton;
$$;
revoke all on function public.tijian_workspace_snapshot(uuid) from public, anon, authenticated;

create or replace function public.tijian_read_workspace(
  known_revision bigint default -1,
  known_bank_revision bigint default -1
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  snapshot jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  snapshot := public.tijian_workspace_snapshot(owner_id);
  if (snapshot ->> 'revision')::bigint = known_revision
    and (snapshot ->> 'bank_revision')::bigint = known_bank_revision then
    return snapshot - 'payload';
  end if;
  return snapshot;
end;
$$;
revoke all on function public.tijian_read_workspace(bigint, bigint) from public, anon;
grant execute on function public.tijian_read_workspace(bigint, bigint) to authenticated;

create or replace function public.tijian_save_account_workspace(
  expected_revision bigint,
  expected_bank_revision bigint,
  workspace_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  administrator boolean;
  personal_revision bigint;
  shared public.tijian_shared_banks%rowtype;
  saved_at timestamptz := now();
  change_banks boolean;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- The trusted Auth record determines permissions, not browser/user metadata.
  select email = 'admin@tijian.local' into administrator from auth.users where id = owner_id;
  if expected_revision is null or expected_revision < 0
    or expected_bank_revision is null or expected_bank_revision < 0
    or workspace_payload is null
    or jsonb_typeof(workspace_payload) is distinct from 'object'
    or workspace_payload ->> 'version' is distinct from '1'
    or jsonb_typeof(workspace_payload -> 'records') is distinct from 'object'
    or jsonb_typeof(workspace_payload -> 'settings') is distinct from 'object' then
    raise exception 'Invalid workspace' using errcode = '22023';
  end if;
  if not coalesce(administrator, false) and workspace_payload ? 'banks' then
    raise exception 'Only the administrator can modify shared banks' using errcode = '42501';
  end if;
  if administrator and jsonb_typeof(workspace_payload -> 'banks') is distinct from 'array' then
    raise exception 'Invalid shared banks' using errcode = '22023';
  end if;

  -- One atomic transaction protects both revisions. Study writes cannot change banks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tijian-shared-workspace', 0));
  select * into shared from public.tijian_shared_banks where singleton for update;
  select revision into personal_revision from public.tijian_workspaces where user_id = owner_id for update;
  change_banks := coalesce(administrator, false) and workspace_payload -> 'banks' is distinct from shared.banks;
  if coalesce(personal_revision, 0) <> expected_revision
    or (change_banks and expected_bank_revision <> shared.revision) then
    return public.tijian_workspace_snapshot(owner_id) || jsonb_build_object('ok', false);
  end if;
  if change_banks then
    update public.tijian_shared_banks set banks = workspace_payload -> 'banks',
      revision = revision + 1, updated_at = saved_at where singleton
      returning * into shared;
  end if;
  insert into public.tijian_workspaces(user_id, revision, payload, updated_at)
    values (owner_id, expected_revision + 1, case when administrator then workspace_payload - 'accountId' else workspace_payload - 'banks' - 'accountId' end, saved_at)
  on conflict (user_id) do update set revision = excluded.revision,
    payload = excluded.payload, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true, 'revision', expected_revision + 1,
    'bank_revision', shared.revision, 'updated_at', saved_at);
end;
$$;
revoke all on function public.tijian_save_account_workspace(bigint, bigint, jsonb) from public, anon;
grant execute on function public.tijian_save_account_workspace(bigint, bigint, jsonb) to authenticated;

-- Keep the deployed administrator-only client working during the upgrade.
-- Its writes use the same canonical banks and personal revision check.
create or replace function public.tijian_save_workspace(
  expected_revision bigint, workspace_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  bank_revision bigint;
begin
  if not exists (select 1 from auth.users where id = auth.uid() and email = 'admin@tijian.local') then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  select revision into bank_revision from public.tijian_shared_banks where singleton;
  return public.tijian_save_account_workspace(expected_revision, bank_revision, workspace_payload);
end;
$$;
revoke all on function public.tijian_save_workspace(bigint, jsonb) from public, anon;
grant execute on function public.tijian_save_workspace(bigint, jsonb) to authenticated;
notify pgrst, 'reload schema';

commit;
