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
  status text not null check (status in ('enrolled','waitlisted','cancelled')),
  assigned_sub_class text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  leave_dates text[] not null default '{}',
  leave_reason text
);

-- ─── v4：教師點名 PIN（營隊資料表為公開可讀，PIN 欄位以欄位層級權限隱藏，見檔尾）───
alter table camp_camps add column if not exists teacher_pin text;
alter table camp_camps add column if not exists teacher_pin_failed int not null default 0;
alter table camp_camps add column if not exists teacher_pin_locked_until timestamptz;
alter table camp_camps drop constraint if exists camp_camps_teacher_pin_check;
alter table camp_camps add constraint camp_camps_teacher_pin_check check (teacher_pin is null or teacher_pin ~ '^[0-9]{4}$');

-- 教師點名紀錄（僅能透過 camp_teacher_* RPC 讀寫）
create table if not exists camp_attendance (
  camp_id text not null references camp_camps(id) on delete cascade,
  student_id text not null,
  attend_date date not null,
  status text not null check (status in ('present','absent')),
  marked_at timestamptz not null default now(),
  primary key (camp_id, student_id, attend_date)
);

-- ─── 第三階段遷移（候補）：既有資料庫重跑本檔即可升級，可重複執行 ───
alter table camp_registrations drop constraint if exists camp_registrations_status_check;
alter table camp_registrations add constraint camp_registrations_status_check
  check (status in ('enrolled','waitlisted','cancelled'));

-- 每位學生對同一營隊只能有 1 筆有效報名（正取或候補）
drop index if exists camp_one_active_per_camp;
create unique index if not exists camp_one_live_per_camp
  on camp_registrations(student_id, camp_id) where status in ('enrolled','waitlisted');

-- 候補排序用索引
create index if not exists camp_waitlist_order
  on camp_registrations(camp_id, created_at) where status = 'waitlisted';

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

-- ═══ v5：學生密碼與緊急聯絡人改以「學生姓名」為鍵（學號每年會變，姓名不變）═══
-- 姓名比對前一律去除所有全形／半形空白；前端與資料庫都做同樣處理。
create or replace function camp_norm_name(p text) returns text
language sql immutable as $$
  select regexp_replace(coalesce(p, ''), '[\s\u00a0\u3000\ufeff]+', '', 'g')
$$;

-- 舊版（以學號為鍵）的資料表改名保留，不刪除；請自行比對後再決定是否清除
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'camp_student_profiles' and column_name = 'student_id') then
    alter table camp_student_profiles rename to camp_student_profiles_legacy_by_id;
  end if;
end $$;

-- 密碼雜湊與緊急聯絡人（禁止 anon 直接讀寫）
create table if not exists camp_student_profiles (
  student_name text primary key check (student_name <> '' and student_name = camp_norm_name(student_name)),
  password_hash text not null,
  failed_attempts int not null default 0,
  is_locked boolean not null default false,
  emergency_contacts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 學生名單快照（由後台登入時自動從 Google 試算表同步）：
-- 資料庫無法自己得知「學號↔姓名」，首次登入時以此驗證，避免有人搶先替他人建立帳號
create table if not exists camp_roster (
  student_id text primary key,
  student_name text not null check (student_name <> '' and student_name = camp_norm_name(student_name))
);
create index if not exists camp_roster_name on camp_roster(student_name);

-- 後台設定（admin_password 僅存 bcrypt 雜湊；禁止 anon 直接讀寫）
create table if not exists camp_system_settings (
  id text primary key default 'default',
  admin_password_hash text not null,
  registration_start_at timestamptz,
  registration_end_at timestamptz,
  term_name text not null default '115學年度夏令營',
  updated_at timestamptz not null default now()
);

-- v4：全站緊急公告
alter table camp_system_settings add column if not exists global_alert_message text not null default '';
alter table camp_system_settings add column if not exists global_alert_active boolean not null default false;
-- v4：忘記密碼（學號＋電話）專用的防暴力計數，與登入錯誤次數分開
alter table camp_student_profiles add column if not exists reset_failed_attempts int not null default 0;
alter table camp_student_profiles add column if not exists reset_locked_until timestamptz;

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
      'registration_end_at', null,
      'global_alert_message', '',
      'global_alert_active', false
    );
  end if;
  return jsonb_build_object(
    'id', r.id,
    'term_name', r.term_name,
    'registration_start_at', r.registration_start_at,
    'registration_end_at', r.registration_end_at,
    'global_alert_message', r.global_alert_message,
    'global_alert_active', r.global_alert_active
  );
end $$;

-- ─── 學生登入驗證（僅回傳該生 emergency_contacts）──────────

drop function if exists camp_verify_student_login(text, text);
drop function if exists camp_verify_student_login(text, text, text);
create or replace function camp_verify_student_login(p_student_name text, p_password text, p_student_id text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  n text := camp_norm_name(p_student_name);
  r camp_student_profiles%rowtype;
  ok boolean;
  attempts int;
  locked boolean;
  dup_msg constant text := '系統偵測到同名同姓的學生，為避免資料混淆暫時無法登入，請洽學校行政人員';
begin
  if n = '' then
    return jsonb_build_object('success', false, 'remaining_attempts', 0, 'is_locked', true, 'message', '無效的學生資料');
  end if;

  -- 名單中若有同名同姓者，一律拒絕（姓名是唯一鍵，同名會互相看到對方的資料）
  if (select count(*) from camp_roster where student_name = n) > 1 then
    return jsonb_build_object('success', false, 'remaining_attempts', 0, 'is_locked', false, 'message', dup_msg);
  end if;

  select * into r from camp_student_profiles where student_name = n;

  if not found then
    -- 首次登入：必須先通過名單驗證（學號與姓名相符），預設密碼 = 目前學號
    if p_student_id is null or not exists (select 1 from camp_roster where student_id = p_student_id and student_name = n) then
      return jsonb_build_object('success', false, 'remaining_attempts', 0, 'is_locked', false,
        'message', '查無此學生資料，請洽學校行政人員（學生名單可能尚未同步）');
    end if;
    if p_password = p_student_id then
      insert into camp_student_profiles (student_name, password_hash, failed_attempts, is_locked, emergency_contacts)
      values (n, camp_hash_password(p_password), 0, false, '[]'::jsonb)
      returning * into r;
      return jsonb_build_object('success', true, 'is_locked', false, 'remaining_attempts', 5,
        'emergency_contacts', coalesce(r.emergency_contacts, '[]'::jsonb));
    else
      insert into camp_student_profiles (student_name, password_hash, failed_attempts, is_locked, emergency_contacts)
      values (n, camp_hash_password(p_student_id), 1, false, '[]'::jsonb)
      returning * into r;
      return jsonb_build_object('success', false, 'remaining_attempts', 4, 'is_locked', false,
        'message', '密碼錯誤（尚可嘗試 4 次）');
    end if;
  end if;

  if r.is_locked then
    return jsonb_build_object('success', false, 'remaining_attempts', 0, 'is_locked', true,
      'message', '密碼錯誤已達 5 次，帳號已鎖定，請使用「忘記密碼／帳號解鎖」或聯繫學校行政人員');
  end if;

  ok := camp_password_matches(p_password, r.password_hash);

  if ok then
    update camp_student_profiles set failed_attempts = 0, updated_at = now()
      where student_name = n returning * into r;
    return jsonb_build_object('success', true, 'is_locked', false, 'remaining_attempts', 5,
      'emergency_contacts', coalesce(r.emergency_contacts, '[]'::jsonb));
  end if;

  attempts := r.failed_attempts + 1;
  locked := attempts >= 5;
  update camp_student_profiles set failed_attempts = attempts, is_locked = locked, updated_at = now()
    where student_name = n;

  return jsonb_build_object('success', false, 'remaining_attempts', greatest(0, 5 - attempts), 'is_locked', locked,
    'message', case when locked
      then '密碼錯誤已達 5 次，帳號已鎖定，請使用「忘記密碼／帳號解鎖」或聯繫學校行政人員'
      else format('密碼錯誤（尚可嘗試 %s 次）', 5 - attempts) end);
end $$;

-- 聯絡人檢核：姓名≥2字且僅中英文字母（英文名可含單一空格）；電話為 09XX-XXXXXX／09XXXXXXXX 或 0X-XXXXXXX
create or replace function camp_contacts_valid(p jsonb) returns boolean
language sql immutable as $$
  select coalesce(bool_and(
    char_length(replace(coalesce(c->>'name', ''), ' ', '')) >= 2
    and coalesce(c->>'name', '') ~ '^[\u3400-\u4dbf\u4e00-\u9fffA-Za-z]+( [\u3400-\u4dbf\u4e00-\u9fffA-Za-z]+)*$'
    and regexp_replace(coalesce(c->>'phone', ''), '\s', '', 'g') ~ '^(09[0-9]{2}-?[0-9]{6}|0[2-8]-?[0-9]{7})$'
  ), true)
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) c
$$;

-- ─── 學生更新密碼／緊急聯絡人（需驗證目前密碼）────────────

drop function if exists camp_update_student_profile(text, text, text, jsonb);
drop function if exists camp_update_student_profile(text, text, text, jsonb, text);
create or replace function camp_update_student_profile(
  p_student_name text,
  p_current_password text,
  p_new_password text default null,
  p_emergency_contacts jsonb default null,
  p_student_id text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  n text := camp_norm_name(p_student_name);
  r camp_student_profiles%rowtype;
  login jsonb;
begin
  login := camp_verify_student_login(n, p_current_password, p_student_id);
  if coalesce((login->>'success')::boolean, false) is not true then
    return login || jsonb_build_object('updated', false);
  end if;

  if p_emergency_contacts is not null and not camp_contacts_valid(p_emergency_contacts) then
    raise exception 'INVALID_PHONE';
  end if;

  if p_new_password is not null and length(trim(p_new_password)) >= 4 then
    update camp_student_profiles
      set password_hash = camp_hash_password(p_new_password), failed_attempts = 0, updated_at = now()
      where student_name = n;
  end if;

  if p_emergency_contacts is not null then
    update camp_student_profiles set emergency_contacts = p_emergency_contacts, updated_at = now()
      where student_name = n;
  end if;

  select * into r from camp_student_profiles where student_name = n;
  return jsonb_build_object('success', true, 'updated', true,
    'emergency_contacts', coalesce(r.emergency_contacts, '[]'::jsonb));
end $$;

-- ─── 後台驗證 + 取回全校聯絡人（不含密碼雜湊）────────────

create or replace function camp_verify_admin_and_fetch_all(p_admin_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  settings jsonb;
  profiles jsonb;
  pins jsonb;
begin
  perform camp_assert_admin(p_admin_password);
  settings := camp_get_public_settings();
  select coalesce(jsonb_object_agg(id, teacher_pin), '{}'::jsonb) into pins from camp_camps where teacher_pin is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
    'student_name', student_name,
    'failed_attempts', failed_attempts,
    'is_locked', is_locked,
    'emergency_contacts', emergency_contacts
  ) order by student_name), '[]'::jsonb)
  into profiles
  from camp_student_profiles;

  return jsonb_build_object(
    'success', true,
    'settings', settings,
    'profiles', profiles,
    'teacher_pins', pins
  );
end $$;

-- ─── 後台：解鎖／重設密碼／代編聯絡人／存設定／營隊 ───────

drop function if exists camp_admin_unlock_student(text, text);
drop function if exists camp_admin_unlock_student(text, text, text);
create or replace function camp_admin_unlock_student(p_admin_password text, p_student_name text, p_student_id text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  n text := camp_norm_name(p_student_name);
begin
  perform camp_assert_admin(p_admin_password);
  if n = '' then raise exception 'INVALID_NAME'; end if;
  insert into camp_student_profiles (student_name, password_hash, failed_attempts, is_locked, emergency_contacts)
  values (n, camp_hash_password(coalesce(p_student_id, n)), 0, false, '[]'::jsonb)
  on conflict (student_name) do update
    set is_locked = false, failed_attempts = 0, reset_failed_attempts = 0, reset_locked_until = null, updated_at = now();
  return jsonb_build_object('success', true);
end $$;

drop function if exists camp_admin_reset_student_password(text, text);
drop function if exists camp_admin_reset_student_password(text, text, text);
-- 重設為「預設密碼」＝該生「目前的學號」（必須帶 p_student_id）
create or replace function camp_admin_reset_student_password(p_admin_password text, p_student_name text, p_student_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  n text := camp_norm_name(p_student_name);
begin
  perform camp_assert_admin(p_admin_password);
  if n = '' or p_student_id is null or length(trim(p_student_id)) = 0 then raise exception 'INVALID_STUDENT'; end if;
  insert into camp_student_profiles (student_name, password_hash, failed_attempts, is_locked, emergency_contacts)
  values (n, camp_hash_password(p_student_id), 0, false, '[]'::jsonb)
  on conflict (student_name) do update
    set password_hash = camp_hash_password(p_student_id),
        is_locked = false, failed_attempts = 0, reset_failed_attempts = 0, reset_locked_until = null,
        updated_at = now();
  return jsonb_build_object('success', true);
end $$;

drop function if exists camp_admin_set_contacts(text, text, jsonb);
drop function if exists camp_admin_set_contacts(text, text, jsonb, text);
create or replace function camp_admin_set_contacts(
  p_admin_password text,
  p_student_name text,
  p_emergency_contacts jsonb,
  p_student_id text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  n text := camp_norm_name(p_student_name);
begin
  perform camp_assert_admin(p_admin_password);
  if n = '' then raise exception 'INVALID_NAME'; end if;
  if p_emergency_contacts is not null and not camp_contacts_valid(p_emergency_contacts) then
    raise exception 'INVALID_PHONE';
  end if;
  insert into camp_student_profiles (student_name, password_hash, failed_attempts, is_locked, emergency_contacts)
  values (n, camp_hash_password(coalesce(p_student_id, n)), 0, false, coalesce(p_emergency_contacts, '[]'::jsonb))
  on conflict (student_name) do update
    set emergency_contacts = coalesce(p_emergency_contacts, '[]'::jsonb), updated_at = now();
  return jsonb_build_object('success', true, 'emergency_contacts', coalesce(p_emergency_contacts, '[]'::jsonb));
end $$;

-- 後台登入時自動呼叫：把 Google 試算表的學生名單同步進資料庫（整批取代）
create or replace function camp_admin_sync_roster(p_admin_password text, p_students jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform camp_assert_admin(p_admin_password);
  if p_students is null or jsonb_typeof(p_students) <> 'array' then raise exception 'INVALID_ROSTER'; end if;
  delete from camp_roster where true;
  insert into camp_roster (student_id, student_name)
  select distinct on (trim(e->>'student_id')) trim(e->>'student_id'), camp_norm_name(e->>'student_name')
  from jsonb_array_elements(p_students) e
  where coalesce(trim(e->>'student_id'), '') <> '' and camp_norm_name(e->>'student_name') <> ''
  order by trim(e->>'student_id');
  return jsonb_build_object('success', true,
    'count', (select count(*) from camp_roster),
    'duplicates', (select coalesce(jsonb_agg(student_name), '[]'::jsonb)
                   from (select student_name from camp_roster group by student_name having count(*) > 1) d));
end $$;

drop function if exists camp_admin_save_settings(text, text, timestamptz, timestamptz, text);
create or replace function camp_admin_save_settings(
  p_admin_password text,
  p_term_name text,
  p_registration_start_at timestamptz,
  p_registration_end_at timestamptz,
  p_new_admin_password text default null,
  p_global_alert_message text default null,
  p_global_alert_active boolean default null
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
    global_alert_message = coalesce(left(p_global_alert_message, 300), global_alert_message),
    global_alert_active = coalesce(p_global_alert_active, global_alert_active),
    updated_at = now()
  where id = 'default';
  return camp_get_public_settings() || jsonb_build_object('success', true);
end $$;

create or replace function camp_random_pin() returns text
language sql volatile set search_path = public, extensions as $$
  select lpad(((get_byte(b, 0) * 256 + get_byte(b, 1)) % 10000)::text, 4, '0')
  from (select extensions.gen_random_bytes(2) as b) t
$$;

drop function if exists camp_admin_save_camp(text, jsonb);
create or replace function camp_admin_save_camp(p_admin_password text, p_camp jsonb, p_teacher_pin text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  cid text;
  pin text;
begin
  perform camp_assert_admin(p_admin_password);
  cid := p_camp->>'id';
  if cid is null or length(cid) = 0 then
    raise exception 'INVALID_CAMP';
  end if;
  if p_teacher_pin is not null and p_teacher_pin !~ '^[0-9]{4}$' then
    raise exception 'INVALID_PIN';
  end if;
  insert into camp_camps (id, data, teacher_pin)
  values (cid, p_camp - 'teacher_pin', coalesce(p_teacher_pin, camp_random_pin()))
  on conflict (id) do update
    set data = excluded.data,
        teacher_pin = coalesce(p_teacher_pin, camp_camps.teacher_pin, camp_random_pin());
  select teacher_pin into pin from camp_camps where id = cid;
  return jsonb_build_object('success', true, 'id', cid, 'teacher_pin', pin);
end $$;

create or replace function camp_admin_delete_camp(p_admin_password text, p_camp_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform camp_assert_admin(p_admin_password);
  delete from camp_camps where id = p_camp_id;
  return jsonb_build_object('success', true);
end $$;

-- 候補遞補轉正（後台）：名額已滿時拒絕；容量另有 trg_camp_capacity 最終把關
create or replace function camp_admin_promote_waitlist(p_admin_password text, p_reg_id text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r camp_registrations%rowtype;
begin
  perform camp_assert_admin(p_admin_password);
  select * into r from camp_registrations where id = p_reg_id for update;
  if not found or r.status <> 'waitlisted' then
    raise exception 'NOT_WAITLISTED';
  end if;
  update camp_registrations set status = 'enrolled' where id = p_reg_id;  -- 觸發 CAMP_FULL 檢核
  return jsonb_build_object('success', true);
end $$;

-- ═══ v4：忘記密碼（學號 + 主要聯絡人電話）══════════════════
-- 注意：失敗時用 return 而非 raise，這樣失敗計次才不會隨交易一起被回滾。
drop function if exists camp_reset_student_password(text, text, text);
create or replace function camp_reset_student_password(p_student_name text, p_phone text, p_new_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  n text := camp_norm_name(p_student_name);
  r camp_student_profiles%rowtype;
  ph text;
  fails int;
  generic constant text := '驗證失敗：學號或主要聯絡人電話不符。連續錯誤多次將暫停此功能 30 分鐘。';
begin
  if n = '' or p_new_password is null or length(trim(p_new_password)) < 4 then
    return jsonb_build_object('success', false, 'message', '請輸入學號與電話，且新密碼至少 4 碼');
  end if;
  if (select count(*) from camp_roster where student_name = n) > 1 then
    return jsonb_build_object('success', false, 'message', generic);   -- 同名同姓：拒絕
  end if;

  select * into r from camp_student_profiles where student_name = n for update;
  if not found then
    return jsonb_build_object('success', false, 'message', generic);  -- 不透露學生是否存在
  end if;

  if r.reset_locked_until is not null and r.reset_locked_until > now() then
    return jsonb_build_object('success', false, 'locked', true,
      'message', '嘗試次數過多，此功能暫停 30 分鐘，請稍後再試或洽學校行政人員');
  end if;

  select regexp_replace(coalesce(c->>'phone', ''), '[^0-9]', '', 'g') into ph
  from jsonb_array_elements(r.emergency_contacts) with ordinality as t(c, k)
  order by (case when c->>'is_primary' = 'true' then 0 else 1 end), k
  limit 1;

  if ph is not null and ph <> '' and ph = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') then
    update camp_student_profiles
      set password_hash = camp_hash_password(p_new_password),
          is_locked = false, failed_attempts = 0,
          reset_failed_attempts = 0, reset_locked_until = null, updated_at = now()
      where student_name = n;
    return jsonb_build_object('success', true, 'message', '密碼已重設，帳號已解鎖，請用新密碼登入');
  end if;

  fails := r.reset_failed_attempts + 1;
  if fails >= 5 then
    update camp_student_profiles set reset_failed_attempts = 0, reset_locked_until = now() + interval '30 minutes' where student_name = n;
  else
    update camp_student_profiles set reset_failed_attempts = fails where student_name = n;
  end if;
  return jsonb_build_object('success', false, 'message', generic);
end $$;

-- ═══ v4：手足帳號綁定（驗證兩個帳號；B 沒有聯絡人時，自動複製 A 的聯絡人）═══
drop function if exists camp_bind_sibling(text, text, text, text);
drop function if exists camp_bind_sibling(text, text, text, text, text, text);
create or replace function camp_bind_sibling(
  p_a_name text, p_a_password text, p_b_name text, p_b_password text,
  p_a_id text default null, p_b_id text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  na text := camp_norm_name(p_a_name);
  nb text := camp_norm_name(p_b_name);
  la jsonb; lb jsonb; ca jsonb; cb jsonb;
  copied boolean := false;
begin
  if na = '' or nb = '' or na = nb then
    return jsonb_build_object('success', false, 'message', '請輸入另一位學生的學號');
  end if;
  la := camp_verify_student_login(na, p_a_password, p_a_id);
  if coalesce((la->>'success')::boolean, false) is not true then
    return la || jsonb_build_object('who', 'A');
  end if;
  lb := camp_verify_student_login(nb, p_b_password, p_b_id);
  if coalesce((lb->>'success')::boolean, false) is not true then
    return lb || jsonb_build_object('who', 'B');
  end if;
  ca := coalesce(la->'emergency_contacts', '[]'::jsonb);
  cb := coalesce(lb->'emergency_contacts', '[]'::jsonb);
  if jsonb_array_length(cb) = 0 and jsonb_array_length(ca) > 0 and camp_contacts_valid(ca) then
    update camp_student_profiles set emergency_contacts = ca, updated_at = now() where student_name = nb;
    cb := ca;
    copied := true;
  end if;
  return jsonb_build_object('success', true, 'copied', copied, 'emergency_contacts', cb);
end $$;

-- ═══ v4：教師數位點名簿（以營隊 PIN 驗證；連續錯 8 次鎖 15 分鐘）═══
create or replace function camp_teacher_check(p_camp_id text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
begin
  select teacher_pin, teacher_pin_failed, teacher_pin_locked_until into r
    from camp_camps where id = p_camp_id for update;
  if not found or r.teacher_pin is null then
    return jsonb_build_object('ok', false, 'message', '查無此營隊，或尚未設定教師 PIN');
  end if;
  if r.teacher_pin_locked_until is not null and r.teacher_pin_locked_until > now() then
    return jsonb_build_object('ok', false, 'locked', true, 'message', 'PIN 錯誤次數過多，請 15 分鐘後再試');
  end if;
  if p_pin is not null and p_pin = r.teacher_pin then
    if r.teacher_pin_failed > 0 or r.teacher_pin_locked_until is not null then
      update camp_camps set teacher_pin_failed = 0, teacher_pin_locked_until = null where id = p_camp_id;
    end if;
    return jsonb_build_object('ok', true);
  end if;
  if r.teacher_pin_failed + 1 >= 8 then
    update camp_camps set teacher_pin_failed = 0, teacher_pin_locked_until = now() + interval '15 minutes' where id = p_camp_id;
    return jsonb_build_object('ok', false, 'locked', true, 'message', 'PIN 錯誤次數過多，已暫停 15 分鐘');
  end if;
  update camp_camps set teacher_pin_failed = teacher_pin_failed + 1 where id = p_camp_id;
  return jsonb_build_object('ok', false, 'message', format('PIN 錯誤（尚可嘗試 %s 次）', 8 - (r.teacher_pin_failed + 1)));
end $$;

create or replace function camp_teacher_get_roster(p_camp_id text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  chk jsonb; camp jsonb; roster jsonb; marks jsonb;
begin
  chk := camp_teacher_check(p_camp_id, p_pin);
  if coalesce((chk->>'ok')::boolean, false) is not true then
    return jsonb_build_object('success', false, 'message', chk->>'message', 'locked', coalesce((chk->>'locked')::boolean, false));
  end if;
  select data into camp from camp_camps where id = p_camp_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'student_id', student_id, 'assigned_sub_class', assigned_sub_class, 'leave_dates', to_jsonb(leave_dates)
    ) order by student_id), '[]'::jsonb) into roster
    from camp_registrations where camp_id = p_camp_id and status = 'enrolled';
  select coalesce(jsonb_agg(jsonb_build_object(
      'student_id', student_id, 'date', to_char(attend_date, 'YYYY-MM-DD'), 'status', status
    )), '[]'::jsonb) into marks
    from camp_attendance where camp_id = p_camp_id;
  return jsonb_build_object('success', true, 'camp', camp, 'roster', roster, 'marks', marks);
end $$;

-- p_status：'present' 簽到／'absent' 缺席／null 清除
create or replace function camp_teacher_mark(p_camp_id text, p_pin text, p_student_id text, p_date date, p_status text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  chk jsonb;
begin
  chk := camp_teacher_check(p_camp_id, p_pin);
  if coalesce((chk->>'ok')::boolean, false) is not true then
    return jsonb_build_object('success', false, 'message', chk->>'message');
  end if;
  if p_status is not null and p_status not in ('present', 'absent') then
    return jsonb_build_object('success', false, 'message', '無效的點名狀態');
  end if;
  if not exists (select 1 from camp_camps where id = p_camp_id and (data->'dates') ? to_char(p_date, 'YYYY-MM-DD')) then
    return jsonb_build_object('success', false, 'message', '此日期不在營隊上課日期內');
  end if;
  if not exists (select 1 from camp_registrations where camp_id = p_camp_id and student_id = p_student_id and status = 'enrolled') then
    return jsonb_build_object('success', false, 'message', '此學生不在報名名單中');
  end if;
  if p_status is null then
    delete from camp_attendance where camp_id = p_camp_id and student_id = p_student_id and attend_date = p_date;
  else
    insert into camp_attendance (camp_id, student_id, attend_date, status)
    values (p_camp_id, p_student_id, p_date, p_status)
    on conflict (camp_id, student_id, attend_date) do update set status = excluded.status, marked_at = now();
  end if;
  return jsonb_build_object('success', true);
end $$;

-- 既有營隊補上 PIN
update camp_camps set teacher_pin = camp_random_pin() where teacher_pin is null;

-- ═══ v4：夏令營六年級防線（以學號首碼＝年級判斷；前端 validateRegistration 為主、此為資料庫備援）═══
create or replace function camp_block_graduating() returns trigger language plpgsql as $$
declare
  d jsonb;
begin
  if new.status in ('enrolled', 'waitlisted') and (tg_op = 'INSERT' or old.status = 'cancelled') then
    select data into d from camp_camps where id = new.camp_id;
    if left(new.student_id, 1) = '6'
       and (coalesce(d->>'season', '') = 'summer' or coalesce(d->>'term', '') like '%夏令營%') then
      raise exception 'GRADUATING_BLOCKED';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_camp_block_graduating on camp_registrations;
create trigger trg_camp_block_graduating before insert or update on camp_registrations
  for each row execute function camp_block_graduating();

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
alter table camp_attendance enable row level security;
alter table camp_roster enable row level security;

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
grant execute on function camp_verify_student_login(text, text, text) to anon, authenticated;
grant execute on function camp_update_student_profile(text, text, text, jsonb, text) to anon, authenticated;
grant execute on function camp_verify_admin_and_fetch_all(text) to anon, authenticated;
grant execute on function camp_admin_unlock_student(text, text, text) to anon, authenticated;
grant execute on function camp_admin_reset_student_password(text, text, text) to anon, authenticated;
grant execute on function camp_admin_set_contacts(text, text, jsonb, text) to anon, authenticated;
grant execute on function camp_admin_sync_roster(text, jsonb) to anon, authenticated;
grant execute on function camp_admin_save_settings(text, text, timestamptz, timestamptz, text, text, boolean) to anon, authenticated;
grant execute on function camp_admin_save_camp(text, jsonb, text) to anon, authenticated;
grant execute on function camp_reset_student_password(text, text, text) to anon, authenticated;
grant execute on function camp_bind_sibling(text, text, text, text, text, text) to anon, authenticated;
grant execute on function camp_teacher_get_roster(text, text) to anon, authenticated;
grant execute on function camp_teacher_mark(text, text, text, date, text) to anon, authenticated;
-- 內部輔助函式不對外開放
revoke all on function camp_teacher_check(text, text) from public, anon, authenticated;
revoke all on function camp_random_pin() from public, anon, authenticated;
grant execute on function camp_norm_name(text) to anon, authenticated;
grant execute on function camp_admin_delete_camp(text, text) to anon, authenticated;

revoke all on table camp_student_profiles from anon, authenticated;
revoke all on table camp_system_settings from anon, authenticated;
revoke insert, update, delete on table camp_camps from anon, authenticated;
revoke all on table camp_attendance from anon, authenticated;
revoke all on table camp_roster from anon, authenticated;
do $$ begin
  if to_regclass('public.camp_student_profiles_legacy_by_id') is not null then
    execute 'alter table camp_student_profiles_legacy_by_id enable row level security';
    execute 'revoke all on table camp_student_profiles_legacy_by_id from anon, authenticated';
  end if;
end $$;
-- 營隊表公開可讀，但只開放 id、data 兩欄；teacher_pin 等欄位 anon 讀不到（前端請勿用 select('*')）
revoke select on table camp_camps from anon, authenticated;
grant select (id, data) on table camp_camps to anon, authenticated;
