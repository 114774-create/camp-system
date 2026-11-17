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
