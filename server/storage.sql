-- Run once in your own Supabase SQL Editor. No client can read the Guest bearer tokens.
create table if not exists public.ro_world (
  id text primary key check (id = 'main'),
  revision bigint not null default 0,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.ro_world add column if not exists last_write text;
alter table public.ro_world enable row level security;
revoke all on public.ro_world from public, anon, authenticated, service_role;
grant select, update on public.ro_world to service_role;
insert into public.ro_world (id, snapshot) values ('main', '{"version":1,"data":{}}'::jsonb) on conflict (id) do nothing;

create or replace function public.ro_world_save(expected_revision bigint, new_snapshot jsonb, operation_id text)
returns bigint language plpgsql security invoker set search_path = public as $$
declare result bigint;
begin
  if new_snapshot->>'version' is distinct from '1' or jsonb_typeof(new_snapshot->'data') is distinct from 'object' or operation_id is null or length(operation_id) > 80 then
    raise exception 'Invalid game snapshot';
  end if;
  select revision into result from public.ro_world where id='main' and last_write=operation_id;
  if result is not null then return result; end if;
  update public.ro_world set snapshot = new_snapshot, revision = revision + 1, updated_at = now(),last_write=operation_id
    where id = 'main' and revision = expected_revision returning revision into result;
  if result is null then
    select revision into result from public.ro_world where id='main' and last_write=operation_id;
    if result is null then raise exception 'Stale game writer; refusing overwrite'; end if;
  end if;
  return result;
end;
$$;
revoke all on function public.ro_world_save(bigint,jsonb,text) from public, anon, authenticated;
grant execute on function public.ro_world_save(bigint,jsonb,text) to service_role;
