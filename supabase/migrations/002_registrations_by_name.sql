-- 002：報名與點名紀錄改以「學生姓名」為鍵（學號回收也不會讓新生看到舊生紀錄）
-- 前置條件：① 已執行 001；② 已以管理員登入過一次（讓 camp_roster 有「學號→姓名」對照）。可重複執行。
-- 無法對應姓名的舊紀錄（名單已無該學號）不會被刪掉：整列備份到 camp_registrations_unmapped / camp_attendance_unmapped。
do $$
begin
  -- A) 報名表：student_id → student_name + snapshot_student_id
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'camp_registrations' and column_name = 'student_id') then
    alter table camp_registrations add column if not exists student_name text;
    alter table camp_registrations add column if not exists snapshot_student_id text;
    update camp_registrations set snapshot_student_id = student_id where snapshot_student_id is null;
    update camp_registrations r set student_name = ro.student_name
      from camp_roster ro where ro.student_id = r.student_id and r.student_name is null;

    create table if not exists camp_registrations_unmapped as select * from camp_registrations where false;
    insert into camp_registrations_unmapped select * from camp_registrations where student_name is null;
    delete from camp_registrations where student_name is null;

    alter table camp_registrations drop column student_id;      -- 連帶移除舊的 (student_id, camp_id) 唯一索引
    alter table camp_registrations alter column student_name set not null;
  end if;

  -- B) 點名紀錄：同樣改以姓名為鍵（透過報名表的 snapshot_student_id 對應）
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'camp_attendance' and column_name = 'student_id') then
    alter table camp_attendance add column if not exists student_name text;
    update camp_attendance a set student_name = r.student_name
      from camp_registrations r
      where r.camp_id = a.camp_id and r.snapshot_student_id = a.student_id and a.student_name is null;

    create table if not exists camp_attendance_unmapped as select * from camp_attendance where false;
    insert into camp_attendance_unmapped select * from camp_attendance where student_name is null;
    delete from camp_attendance where student_name is null;

    alter table camp_attendance drop column student_id;         -- 連帶移除舊主鍵
    alter table camp_attendance alter column student_name set not null;
    alter table camp_attendance add primary key (camp_id, student_name, attend_date);
  end if;

  -- C) 外鍵需要對應的帳號列：替「有報名紀錄、但還沒登入過」的學生補一筆預設帳號（預設密碼、無聯絡人）
  insert into camp_student_profiles (student_name, password_hash, has_custom_password)
  select distinct on (r.student_name) r.student_name,
         camp_hash_password(coalesce(r.snapshot_student_id, r.student_name)), false
  from camp_registrations r
  where not exists (select 1 from camp_student_profiles p where p.student_name = r.student_name)
  order by r.student_name, r.created_at desc
  on conflict (student_name) do nothing;

  if not exists (select 1 from pg_constraint where conname = 'camp_registrations_student_name_fkey') then
    alter table camp_registrations
      add constraint camp_registrations_student_name_fkey
      foreign key (student_name) references camp_student_profiles(student_name) on update cascade;
  end if;
end $$;

-- 每位學生對同一營隊只能有 1 筆有效報名（以姓名判斷）
create unique index if not exists camp_one_live_per_camp
  on camp_registrations(student_name, camp_id) where status in ('enrolled', 'waitlisted');
create index if not exists camp_registrations_student on camp_registrations(student_name);

-- 寫入前一律把姓名去除所有空白
create or replace function camp_norm_reg_name() returns trigger language plpgsql as $$
begin
  new.student_name := camp_norm_name(new.student_name);
  return new;
end $$;
drop trigger if exists trg_camp_norm_reg_name on camp_registrations;
create trigger trg_camp_norm_reg_name before insert or update of student_name on camp_registrations
  for each row execute function camp_norm_reg_name();
