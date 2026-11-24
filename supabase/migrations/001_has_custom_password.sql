-- 001：預設密碼自動跟著「目前學號」走（升年級 10101 → 20101 免重設）
-- 前置條件：已執行過 v5 的 schema（存在 camp_roster、camp_password_matches）。可重複執行。
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'camp_student_profiles'
                   and column_name = 'has_custom_password') then
    alter table camp_student_profiles add column has_custom_password boolean not null default false;

    -- 回填（只在第一次加欄位時做一次）：
    -- 既有帳號中，密碼雜湊「不等於」目前學號者，視為家長已自訂密碼；找不到名單對應者也保守視為已自訂，
    -- 避免把家長自訂的密碼誤判成「預設」而讓任何人都能用學號登入。
    update camp_student_profiles p set has_custom_password = true
    where not exists (
      select 1 from camp_roster ro
      where ro.student_name = p.student_name and camp_password_matches(ro.student_id, p.password_hash)
    );
  end if;
end $$;
