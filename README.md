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
- 學生名單：`src/services/studentService.ts` 填入 `SHEET_ID`（試算表需「知道連結者可檢視」），失敗自動使用 Mock。
- Supabase：在 SQL Editor 執行 `supabase/schema.sql`，並在 `.env` 設定 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`；未設定時自動使用 localStorage RPC 模擬模式。
- 後台預設密碼寫入於 schema seed（雜湊），上線後請立刻於「系統設定」更換。
- 名額以資料庫 trigger 做最終把關，前端檢核僅用於即時提示。
