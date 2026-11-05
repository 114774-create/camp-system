-- 青山國小營隊報名系統 Schema
-- 敏感資料（密碼、緊急聯絡人電話）僅能透過 SECURITY DEFINER RPC 存取

-- Supabase 預設把擴充套件放在 extensions schema
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ─── 資料表 ───────────────────────────────────────────────

create table if not exists camp_camps (
  id text primary key,
  data jsonb not null
);

create table if not exists camp_registrations (
  id text primary key,
  student_id text not null,
  camp_id text not null references camp_camps(id) on delete cascade,
  status text not null check (status in ('enrolled','cancelled')),
  assigned_sub_class text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  leave_dates text[] not null default '{}',
  leave_reason text
);

create unique index if not exists camp_one_active_per_camp
  on camp_registrations(student_id, camp_id) where status = 'enrolled';

create or replace function camp_enforce_capacity() returns trigger language plpgsql as $$
begin
  if new.status = 'enrolled' and (tg_op = 'INSERT' or old.status <> 'enrolled') then
    if (select count(*) from camp_registrations where camp_id = new.camp_id and status = 'enrolled' and id <> new.id)
       >= (select (data->>'max_capacity')::int from camp_camps where id = new.camp_id) then
      raise exception 'CAMP_FULL';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_camp_capacity on camp_registrations;
create trigger trg_camp_capacity
  before insert or update on camp_registrations
  for each row execute function camp_enforce_capacity();

-- 密碼雜湊與緊急聯絡人（禁止 anon 直接讀寫）
create table if not exists camp_student_profiles (
  student_id text primary key,
  password_hash text not null,
  failed_attempts int not null default 0,
  is_locked boolean not null default false,
  emergency_contacts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 後台設定（admin_password 僅存 bcrypt 雜湊；禁止 anon 直接讀寫）
create table if not exists camp_system_settings (
  id text primary key default 'default',
  admin_password_hash text not null,
  registration_start_at timestamptz,
  registration_end_at timestamptz,
  term_name text not null default '115學年度夏令營',
  updated_at timestamptz not null default now()
);

-- ─── 密碼工具 ─────────────────────────────────────────────

create or replace function camp_hash_password(p_plain text)
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select extensions.crypt(p_plain, extensions.gen_salt('bf'))
$$;

create or replace function camp_password_matches(p_plain text, p_hash text)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select coalesce(p_hash = extensions.crypt(p_plain, p_hash), false)
$$;

create or replace function camp_assert_admin(p_admin_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  h text;
begin
  select admin_password_hash into h from camp_system_settings where id = 'default';
  if h is null or not camp_password_matches(p_admin_password, h) then
    raise exception 'ADMIN_AUTH_FAILED' using errcode = '28000';
  end if;
end $$;

-- ─── 公開設定（不含任何密碼欄位）──────────────────────────

create or replace function camp_get_public_settings()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r camp_system_settings%rowtype;
begin
  select * into r from camp_system_settings where id = 'default';
  if not found then
    return jsonb_build_object(
      'id', 'default',
      'term_name', '115學年度夏令營',
      'registration_start_at', null,
      'registration_end_at', null
    );
  end if;
  return jsonb_build_object(
    'id', r.id,
    'term_name', r.term_name,
    'registration_start_at', r.registration_start_at,
    'registration_end_at', r.registration_end_at
  );
end $$;

-- ─── 學生登入驗證（僅回傳該生 emergency_contacts）──────────

create or replace function camp_verify_student_login(p_student_id text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r camp_student_profiles%rowtype;
  ok boolean;
  attempts int;
  locked boolean;
begin
  if p_student_id is null or length(trim(p_student_id)) = 0 then
    return jsonb_build_object('success', false, 'remaining_attempts', 0, 'is_locked', true, 'message', '無效的學號');
  end if;

  select * into r from camp_student_profiles where student_id = p_student_id;

  if not found then
    -- 尚未建檔：預設密碼 = 學號本身；首次正確登入時建立 profile
    if p_password = p_student_id then
      insert into camp_student_profiles (student_id, password_hash, failed_attempts, is_locked, emergency_contacts)
      values (p_student_id, camp_hash_password(p_password), 0, false, '[]'::jsonb)
      returning * into r;
      return jsonb_build_object(
        'success', true,
        'is_locked', false,
        'remaining_attempts', 5,
        'emergency_contacts', coalesce(r.emergency_contacts, '[]'::jsonb)
      );
    else
      -- 建立失敗紀錄列以便計次
      insert into camp_student_profiles (student_id, password_hash, failed_attempts, is_locked, emergency_contacts)
      values (p_student_id, camp_hash_password(p_student_id), 1, false, '[]'::jsonb)
      returning * into r;
      return jsonb_build_object(
        'success', false,
        'remaining_attempts', 4,
        'is_locked', false,
        'message', '密碼錯誤（尚可嘗試 4 次）'
      );
    end if;
  end if;

  if r.is_locked then
    return jsonb_build_object(
      'success', false,
      'remaining_attempts', 0,
      'is_locked', true,
      'message', '密碼錯誤已達 5 次，帳號已鎖定，請聯繫學校行政人員由後台解鎖'
    );
  end if;

  ok := camp_password_matches(p_password, r.password_hash);

  if ok then
    update camp_student_profiles
      set failed_attempts = 0, updated_at = now()
      where student_id = p_student_id
      returning * into r;
    return jsonb_build_object(
      'success', true,
      'is_locked', false,
      'remaining_attempts', 5,
      'emergency_contacts', coalesce(r.emergency_contacts, '[]'::jsonb)
    );
  end if;

  attempts := r.failed_attempts + 1;
  locked := attempts >= 5;
  update camp_student_profiles
    set failed_attempts = attempts, is_locked = locked, updated_at = now()
    where student_id = p_student_id;

  return jsonb_build_object(
    'success', false,
    'remaining_attempts', greatest(0, 5 - attempts),
    'is_locked', locked,
    'message', case when locked
      then '密碼錯誤已達 5 次，帳號已鎖定，請聯繫學校行政人員由後台解鎖'
      else format('密碼錯誤（尚可嘗試 %s 次）', 5 - attempts) end
  );
end $$;

-- ─── 學生更新密碼／緊急聯絡人（需驗證目前密碼）────────────

create or replace function camp_update_student_profile(
  p_student_id text,
  p_current_password text,
  p_new_password text default null,
  p_emergency_contacts jsonb default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r camp_student_profiles%rowtype;
  login jsonb;
begin
  login := camp_verify_student_login(p_student_id, p_current_password);
  if coalesce((login->>'success')::boolean, false) is not true then
    return login || jsonb_build_object('updated', false);
  end if;

  select * into r from camp_student_profiles where student_id = p_student_id;

  if p_new_password is not null and length(trim(p_new_password)) >= 4 then
    update camp_student_profiles
      set password_hash = camp_hash_password(p_new_password), failed_attempts = 0, updated_at = now()
      where student_id = p_student_id;
  end if;

  if p_emergency_contacts is not null then
    update camp_student_profiles
      set emergency_contacts = p_emergency_contacts, updated_at = now()
      where student_id = p_student_id;
  end if;

  select * into r from camp_student_profiles where student_id = p_student_id;
  return jsonb_build_object(
    'success', true,
    'updated', true,
    'emergency_contacts', coalesce(r.emergency_contacts, '[]'::jsonb)
  );
end $$;

-- ─── 後台驗證 + 取回全校聯絡人（不含密碼雜湊）────────────

create or replace function camp_verify_admin_and_fetch_all(p_admin_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  settings jsonb;
  profiles jsonb;
begin
  perform camp_assert_admin(p_admin_password);
  settings := camp_get_public_settings();
  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', student_id,
    'failed_attempts', failed_attempts,
    'is_locked', is_locked,
    'emergency_contacts', emergency_contacts
  ) order by student_id), '[]'::jsonb)
  into profiles
  from camp_student_profiles;

  return jsonb_build_object(
    'success', true,
    'settings', settings,
    'profiles', profiles
  );
end $$;

-- ─── 後台：解鎖／重設密碼／代編聯絡人／存設定／營隊 ───────

create or replace function camp_admin_unlock_student(p_admin_password text, p_student_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform camp_assert_admin(p_admin_password);
  insert into camp_student_profiles (student_id, password_hash, failed_attempts, is_locked, emergency_contacts)
  values (p_student_id, camp_hash_password(p_student_id), 0, false, '[]'::jsonb)
  on conflict (student_id) do update
    set is_locked = false, failed_attempts = 0, updated_at = now();
  return jsonb_build_object('success', true);
end $$;

create or replace function camp_admin_reset_student_password(p_admin_password text, p_student_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform camp_assert_admin(p_admin_password);
  insert into camp_student_profiles (student_id, password_hash, failed_attempts, is_locked, emergency_contacts)
  values (p_student_id, camp_hash_password(p_student_id), 0, false, '[]'::jsonb)
  on conflict (student_id) do update
    set password_hash = camp_hash_password(p_student_id),
        is_locked = false,
        failed_attempts = 0,
        updated_at = now();
  return jsonb_build_object('success', true);
end $$;

create or replace function camp_admin_set_contacts(
  p_admin_password text,
  p_student_id text,
  p_emergency_contacts jsonb
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform camp_assert_admin(p_admin_password);
  insert into camp_student_profiles (student_id, password_hash, failed_attempts, is_locked, emergency_contacts)
  values (p_student_id, camp_hash_password(p_student_id), 0, false, coalesce(p_emergency_contacts, '[]'::jsonb))
  on conflict (student_id) do update
    set emergency_contacts = coalesce(p_emergency_contacts, '[]'::jsonb), updated_at = now();
  return jsonb_build_object('success', true, 'emergency_contacts', coalesce(p_emergency_contacts, '[]'::jsonb));
end $$;

create or replace function camp_admin_save_settings(
  p_admin_password text,
  p_term_name text,
  p_registration_start_at timestamptz,
  p_registration_end_at timestamptz,
  p_new_admin_password text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform camp_assert_admin(p_admin_password);
  update camp_system_settings set
    term_name = coalesce(p_term_name, term_name),
    registration_start_at = p_registration_start_at,
    registration_end_at = p_registration_end_at,
    admin_password_hash = case
      when p_new_admin_password is not null and length(trim(p_new_admin_password)) >= 4
        then camp_hash_password(p_new_admin_password)
      else admin_password_hash
    end,
    updated_at = now()
  where id = 'default';
  return camp_get_public_settings() || jsonb_build_object('success', true);
end $$;

create or replace function camp_admin_save_camp(p_admin_password text, p_camp jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  cid text;
begin
  perform camp_assert_admin(p_admin_password);
  cid := p_camp->>'id';
  if cid is null or length(cid) = 0 then
    raise exception 'INVALID_CAMP';
  end if;
  insert into camp_camps (id, data) values (cid, p_camp)
  on conflict (id) do update set data = excluded.data;
  return jsonb_build_object('success', true, 'id', cid);
end $$;

create or replace function camp_admin_delete_camp(p_admin_password text, p_camp_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform camp_assert_admin(p_admin_password);
  delete from camp_camps where id = p_camp_id;
  return jsonb_build_object('success', true);
end $$;

-- ─── Seed（後台預設密碼僅以雜湊寫入資料庫；請勿把明文放到前端）──
-- 預設後台密碼：學年度西元四碼（與營隊檔期年份相同）。上線後請立刻於後台修改。
insert into camp_system_settings (id, admin_password_hash, registration_start_at, registration_end_at, term_name)
values (
  'default',
  extensions.crypt('2026', extensions.gen_salt('bf')),
  '2026-01-01 00:00:00+08',
  '2026-12-31 23:59:00+08',
  '115學年度夏令營'
) on conflict (id) do nothing;

-- ─── RLS：鎖死敏感表；營隊僅開放讀取；報名維持公開寫入 ───

alter table camp_camps enable row level security;
alter table camp_registrations enable row level security;
alter table camp_student_profiles enable row level security;
alter table camp_system_settings enable row level security;

-- 移除舊的全開政策（若存在）
drop policy if exists "public rw camp_camps" on camp_camps;
drop policy if exists "public rw camp_regs" on camp_registrations;
drop policy if exists "public rw camp_profiles" on camp_student_profiles;
drop policy if exists "public rw camp_settings" on camp_system_settings;
drop policy if exists "public read camps" on camp_camps;
drop policy if exists "public rw regs" on camp_registrations;

-- camp_student_profiles / camp_system_settings：不建立任何 anon policy → 直接存取一律拒絕
-- （僅 SECURITY DEFINER RPC 可讀寫）

create policy "public read camps" on camp_camps for select using (true);
-- 營隊寫入僅能透過 camp_admin_save_camp / camp_admin_delete_camp

create policy "public rw regs" on camp_registrations for all using (true) with check (true);

-- RPC 執行權限
grant execute on function camp_get_public_settings() to anon, authenticated;
grant execute on function camp_verify_student_login(text, text) to anon, authenticated;
grant execute on function camp_update_student_profile(text, text, text, jsonb) to anon, authenticated;
grant execute on function camp_verify_admin_and_fetch_all(text) to anon, authenticated;
grant execute on function camp_admin_unlock_student(text, text) to anon, authenticated;
grant execute on function camp_admin_reset_student_password(text, text) to anon, authenticated;
grant execute on function camp_admin_set_contacts(text, text, jsonb) to anon, authenticated;
grant execute on function camp_admin_save_settings(text, text, timestamptz, timestamptz, text) to anon, authenticated;
grant execute on function camp_admin_save_camp(text, jsonb) to anon, authenticated;
grant execute on function camp_admin_delete_camp(text, text) to anon, authenticated;

revoke all on table camp_student_profiles from anon, authenticated;
revoke all on table camp_system_settings from anon, authenticated;
revoke insert, update, delete on table camp_camps from anon, authenticated;
