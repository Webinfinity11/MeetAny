-- Local stand-in for the parts of Neon that db/schema.sql relies on.
-- ONLY for the throwaway test database created by db/tests/run.sh (and local PostgREST E2E).
-- Never run this on a real Neon database (Neon Auth and the Data API already provide these).
--
-- Imitates:
--   * the Data API roles: anonymous (JWT without a user / role claim 'anonymous') and
--     authenticated (Neon Auth user JWT, role claim 'authenticated'); neither has BYPASSRLS.
--     authenticator = the login role a local PostgREST connects as (not used by Neon itself).
--   * worst-case default privileges in schema public (ALL to anonymous/authenticated, i.e. as if
--     "Grant public schema access" had been ticked), so the tests prove schema.sql revokes what it must
--   * pg_session_jwt in its fallback mode: auth.session(), auth.jwt(), auth.user_id(), auth.uid()
--     reading the PostgREST-compatible request.jwt.claims setting
--   * neon_auth."user" (the Neon Auth user table; columns as documented by Neon)

\set ON_ERROR_STOP 1

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anonymous') then
    create role anonymous nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end $$;
grant anonymous, authenticated to authenticator;

grant usage on schema public to anonymous, authenticated;
alter default privileges in schema public grant all on tables to anonymous, authenticated;
alter default privileges in schema public grant all on sequences to anonymous, authenticated;
alter default privileges in schema public grant all on functions to anonymous, authenticated;

-- ---------------------------------------------------------------- pg_session_jwt (fallback mode)
create schema if not exists auth;
grant usage on schema auth to public;

create or replace function auth.session() returns jsonb
language plpgsql stable as $$
begin
  return nullif(current_setting('request.jwt.claims', true), '')::jsonb;
exception when others then
  return null;
end
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$ select auth.session() $$;

create or replace function auth.user_id() returns text
language sql stable as $$ select auth.session() ->> 'sub' $$;

create or replace function auth.uid() returns uuid
language plpgsql stable as $$
begin
  return (auth.session() ->> 'sub')::uuid;
exception when others then
  return null;
end
$$;

grant execute on function auth.session(), auth.jwt(), auth.user_id(), auth.uid() to public;

-- ---------------------------------------------------------------- Neon Auth
create schema if not exists neon_auth;
revoke all on schema neon_auth from public;

create table if not exists neon_auth."user" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null constraint user_email_key unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp,
  role text,
  banned boolean,
  "banReason" text,
  "banExpires" timestamptz
);
