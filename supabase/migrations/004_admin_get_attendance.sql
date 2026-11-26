-- 004：後台「點名結果」用的讀取函式（可重複執行）
-- 後台：讀取全部營隊的點名紀錄（需管理員密碼；camp_attendance 資料表本身仍然鎖住，不對外開放）
create or replace function camp_admin_get_attendance(p_admin_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  perform camp_assert_admin(p_admin_password);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'camp_id', camp_id, 'student_name', student_name,
      'date', to_char(attend_date, 'YYYY-MM-DD'), 'status', status))
    from camp_attendance), '[]'::jsonb);
end $$;
grant execute on function camp_admin_get_attendance(text) to anon, authenticated;
