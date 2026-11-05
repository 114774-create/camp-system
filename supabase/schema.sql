-- 青山國小營隊報名系統 Schema（camp_ 前綴）

create table camp_camps (
  id text primary key,
  data jsonb not null
);

create table camp_registrations (
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

-- 每位學生對同一營隊只能有 1 筆有效報名
create unique index camp_one_active_per_camp
  on camp_registrations(student_id, camp_id) where status = 'enrolled';

-- 伺服器端名額檢核
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

create trigger trg_camp_capacity
  before insert or update on camp_registrations
  for each row execute function camp_enforce_capacity();

create table camp_student_profiles (
  student_id text primary key,
  password_hash text not null,
  failed_attempts int not null default 0,
  is_locked boolean not null default false,
  emergency_contacts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table camp_system_settings (
  id text primary key default 'default',
  admin_password text not null default '2026',
  registration_start_at timestamptz,
  registration_end_at timestamptz,
  term_name text not null default '115學年度夏令營',
  updated_at timestamptz not null default now()
);

insert into camp_system_settings (id, admin_password, registration_start_at, registration_end_at, term_name)
values (
  'default',
  '2026',
  '2026-01-01 00:00:00+08',
  '2026-12-31 23:59:00+08',
  '115學年度夏令營'
) on conflict (id) do nothing;

alter table camp_camps enable row level security;
alter table camp_registrations enable row level security;
alter table camp_student_profiles enable row level security;
alter table camp_system_settings enable row level security;

-- 範例政策（示範用全開放；上線前請收緊，後台建議改用 Supabase Auth）
create policy "public rw camp_camps" on camp_camps for all using (true) with check (true);
create policy "public rw camp_regs" on camp_registrations for all using (true) with check (true);
create policy "public rw camp_profiles" on camp_student_profiles for all using (true) with check (true);
create policy "public rw camp_settings" on camp_system_settings for all using (true) with check (true);
