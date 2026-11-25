-- 003：夏令營六年級防線改以「營隊類型 season」為準（可重複執行）
-- 修正：假日營的「檔期名稱」若剛好含「夏令營」三個字，六年級會被誤擋。
-- 同時確保觸發器讀的是 v6 的 snapshot_student_id（舊版讀 student_id 會讓所有報名失敗）。
create or replace function camp_block_graduating() returns trigger language plpgsql as $$
declare
  d jsonb;
begin
  if new.status in ('enrolled', 'waitlisted') and (tg_op = 'INSERT' or old.status = 'cancelled') then
    select data into d from camp_camps where id = new.camp_id;
    if left(coalesce(new.snapshot_student_id, ''), 1) = '6'
       and (coalesce(d->>'season', '') = 'summer'
            or (coalesce(d->>'season', '') = '' and coalesce(d->>'term', '') like '%夏令營%')) then
      raise exception 'GRADUATING_BLOCKED';
    end if;
  end if;
  return new;
end $$;
