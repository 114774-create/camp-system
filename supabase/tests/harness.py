# Supabase 本機驗證用：以內建 Postgres 模擬 pgcrypto（crypt/gen_salt/gen_random_bytes）與 anon/authenticated 角色
import os, pgserver, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
SHIM = r"""
create schema if not exists extensions;
create or replace function extensions.gen_salt(t text) returns text language sql volatile as $$ select substr(md5(random()::text || clock_timestamp()::text), 1, 8) $$;
create or replace function extensions.crypt(p text, s text) returns text language sql immutable as $$ select left(s, 8) || md5(left(s, 8) || p) $$;
create or replace function extensions.gen_random_bytes(n int) returns bytea language sql volatile as $$ select substring(decode(md5(random()::text || clock_timestamp()::text), 'hex') from 1 for n) $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
"""
def server():
    s = pgserver.get_server(tempfile.mkdtemp()); s.psql(SHIM); return s
def schema_text():
    return open(os.path.join(HERE, '..', 'schema.sql'), encoding='utf8').read().replace("create extension if not exists pgcrypto with schema extensions;", "-- (shimmed)")
