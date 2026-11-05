# 寒暑令營報名系統
## 架構
- 鎖定層（邏輯）：src/lib、src/hooks、src/data、src/services、src/types.ts、src/App.tsx、src/components/reports
- 外觀層（可交給 Manus）：src/components/ui、src/index.css
## 啟動
用 `npm create vite@latest`（react-ts）建立專案後，將本資料夾內容覆蓋進去、安裝 Tailwind，再 `npm i && npm test && npm run dev`。
## 設定
- 學生名單：src/services/studentService.ts 填入 SHEET_ID（試算表需「知道連結者可檢視」），失敗自動使用 Mock。
- Supabase：在 SQL Editor 執行 supabase/schema.sql，並在 .env 設定 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY；未設定時自動使用 localStorage 示範模式。
- 名額以資料庫 trigger 做最終把關，前端檢核僅用於即時提示。
- 範例 RLS 政策為全開放，上線前請收緊，後台建議加上 Supabase Auth。
