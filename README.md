# 青山國小營隊報名系統
Qingshan Elementary School Camp Registration System

## 架構
- 邏輯層：`src/lib`、`src/hooks`、`src/data`、`src/services`、`src/types.ts`、`src/App.tsx`、`src/components/reports`
- 外觀層：`src/components/ui`、`src/index.css`

## 啟動
```bash
npm i && npm test && npm run dev
```

## 第二階段重點
- 學生密碼登入（預設學號 5 碼）、錯誤 5 次鎖定、姓名遮罩、緊急聯絡人強制攔截、多日營隊請假
- 後台密碼僅以 bcrypt／SHA-256 雜湊存在資料庫（前端原始碼不含明文）；`sessionStorage` 一次解鎖後續 RPC 仍需帶入密碼由 DB 二次核驗
- 學生／緊急聯絡人個資僅能透過 `SECURITY DEFINER` RPC 取得；RLS 禁止 `anon` 直接讀 `camp_student_profiles` / `camp_system_settings`
- 中英雙語切換、防 Google 翻譯白畫面（`translate="no"`）
- Date Picker 多日選擇、簽到表顯示主要緊急聯絡人與請假標記

## 設定
- 學生名單（`.env.local`）：
  - 優先：`VITE_STUDENT_SHEET_API_URL`（Google Apps Script `/exec`，回傳 JSON）
  - 備選：`VITE_GOOGLE_SHEET_URL`（試算表網址／ID，自動轉 `gviz/tq?tqx=out:csv&sheet=Students`）
  - 欄位：`id`、`grade`、`no`、`name`、`maskedName`、`ename`；失敗或未設定時退回 Mock
  - Apps Script 部署須：執行身分「我」、存取權「任何人」，否則會 HTTP 403 並自動退回 Mock
- Supabase：在 SQL Editor 執行 `supabase/schema.sql`，並在 `.env.local` 設定 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`；未設定時自動使用 localStorage RPC 模擬模式。
- 後台預設密碼寫入於 schema seed（雜湊），上線後請立刻於「系統設定」更換。
- 名額以資料庫 trigger 做最終把關，前端檢核僅用於即時提示。

## 第三階段（候補／分頁重構／互斥登入）部署注意
1. 既有 Supabase 資料庫請**重新執行 `supabase/schema.sql`**（已寫成可重複執行：放寬 status 檢查、改建唯一索引、新增 `camp_admin_promote_waitlist`）。
2. 前台分頁：營隊報名與首頁／聯絡人資料與設定／我的報名狀態。
3. 前後台登入互斥：後台登入會清除學生登入；學生登入會清除後台登入（`lib/session.ts`）。
4. v3.2：請再執行一次 `supabase/schema.sql`（新增 `camp_contacts_valid` 電話檢核，並套用於學生與後台儲存聯絡人）。

## v4 部署注意（務必閱讀）
1. **重新執行 `supabase/schema.sql`**（可重複執行）。新增：教師 PIN 與點名表、`camp_reset_student_password`、`camp_bind_sibling`、`camp_teacher_*`、公告欄位、聯絡人姓名／電話檢核、夏令營六年級資料庫備援（以學號首碼 `6` 判斷）。
2. 舊簽章的 `camp_admin_save_settings`／`camp_admin_save_camp` 會被自動移除並以新版取代。
3. **營隊表（`camp_camps`）現在只開放 `id`、`data` 兩欄給匿名使用者**，以隱藏 `teacher_pin`。程式請勿對該表使用 `select('*')`。
4. 教師點名連結：`https://你的網址/teacher-rollcall/<營隊ID>`（後台營隊卡片可一鍵複製），PIN 同樣顯示於卡片。單頁應用需要路由改寫：已附 `vercel.json`；Netlify 請加 `/* /index.html 200`。
5. 電話規則：手機 `09XX-XXXXXX`／`09XXXXXXXX`、市話 `0X-XXXXXXX`（區碼 2～8）。**不再接受單純 7 碼市話**；舊資料中不符者需重新填寫才能報名。

## v5：以「學生姓名」為鍵（學號每年會變）
1. **重新執行 `supabase/schema.sql`**。舊的 `camp_student_profiles`（以學號為鍵）會被**改名保留**為 `camp_student_profiles_legacy_by_id`，不會刪除；新表以姓名為主鍵，所以**既有學生的密碼與聯絡人需重新建立**（舊資料可由你在 SQL Editor 比對後自行搬移）。
2. 姓名比對前一律去除全形／半形空白（前端 `normName`、資料庫 `camp_norm_name`）。
3. 登入仍輸入「學號」；系統查出姓名後以姓名驗證。首次登入的預設密碼＝**當時的學號**。
4. **每學年換試算表名單後，請用管理員登入後台一次**：登入時會自動把名單同步進資料庫（`camp_roster`），首次登入才能驗證「學號↔姓名」。沒同步前，新生首次登入會提示洽行政人員（已有帳號者不受影響）。
5. 名單中若有同名同姓，後台會顯示警告，這些學生無法登入（避免互看對方資料）。
6. 後台「重設密碼」＝重設為該生**目前的學號**。
7. 注意：報名紀錄（`camp_registrations`）仍以學號記錄；升年級後請封存／刪除舊營隊，或確認舊營隊已過期，以免新學號沿用者看到舊紀錄。

## v6 部署步驟（請依序；會更動資料表結構）
1. **先用目前（v5）的網站以管理員身分登入一次**：這會把試算表名單同步進資料庫（`camp_roster`），遷移 002 要靠它把舊的「學號」對應到「姓名」。
2. 到 Supabase → SQL Editor，依序貼上並執行 `supabase/migrations/001_has_custom_password.sql`、`002_registrations_by_name.sql`（或直接重跑整份 `schema.sql`，兩者結果相同）。皆可重複執行。
3. **立刻部署新版網站。** 002 會把報名表的 `student_id` 改成 `student_name`，舊版網站的報名功能在這之後會失效。
4. 檢查 `camp_registrations_unmapped`、`camp_attendance_unmapped`：名單中已找不到對應姓名（例如已畢業／轉出）的舊紀錄不會被刪除，而是整列備份在這兩張表。
5. 之後每學年：更新試算表 → 用管理員登入後台一次（同步名單）→ 新學年的預設密碼就是新學號；沒改過密碼的家長不用做任何事。

### 行為說明
- **預設密碼**：`has_custom_password = false`（沒改過）→ 密碼就是「目前學號」，並且一定要與名單中的「學號↔姓名」相符才算數（否則任何人都能傳 id=password 登入）。家長改過密碼後（`true`）→ 以自訂密碼為準，升年級也不變。管理員重設、或家長以電話重設且新密碼留空，都會回到預設。
- **倒數與鎖定**：報名／取消按鈕以同一個每秒更新的時鐘判斷，跨過截止時間的那一秒自動鎖定。這是「畫面層」的防護；資料庫目前不檢查報名期間。裝置時鐘嚴重不準時，倒數與鎖定也會跟著不準。
- 資料庫測試：見 `supabase/tests/README.md`。
