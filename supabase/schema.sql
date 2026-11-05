create table camps (id text primary key, data jsonb not null);
create table registrations (
  id text primary key, student_id text not null,
  camp_id text not null references camps(id) on delete cascade,
  status text not null check (status in ('enrolled','cancelled')),
  assigned_sub_class text, created_at timestamptz not null default now(), cancelled_at timestamptz);
-- 每位學生對同一營隊只能有 1 筆有效報名
create unique index one_active_per_camp on registrations(student_id, camp_id) where status = 'enrolled';
-- 伺服器端名額檢核，避免多人同時搶最後一個名額
create function enforce_capacity() returns trigger language plpgsql as $$
begin
  if new.status = 'enrolled' and (tg_op = 'INSERT' or old.status <> 'enrolled') then
    if (select count(*) from registrations where camp_id = new.camp_id and status = 'enrolled' and id <> new.id)
       >= (select (data->>'max_capacity')::int from camps where id = new.camp_id) then
      raise exception 'CAMP_FULL';
    end if;
  end if;
  return new;
end $$;
create trigger trg_capacity before insert or update on registrations for each row execute function enforce_capacity();
alter table camps enable row level security; alter table registrations enable row level security;
-- 範例政策（學生端免登入）：請依實際需求收緊；後台建議改用 Supabase Auth
create policy "public rw camps" on camps for all using (true) with check (true);
create policy "public rw regs" on registrations for all using (true) with check (true);
