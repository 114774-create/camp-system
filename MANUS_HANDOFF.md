# 交給 Manus 的外觀設計任務

## 專案背景
這是「國小寒令營／夏令營報名及行政管理系統」，技術棧為 React + TypeScript + Tailwind CSS（Vite）。
**所有商業邏輯（報名檢核、衝堂、單日擇一、名額、分班、資料存取）已完成並有測試。你的任務只有「外觀」。**

## 你可以修改（僅限這些檔案）
- `src/components/ui/AppShell.tsx`　整體版型、導覽列
- `src/components/ui/FrontPage.tsx`　學生報名頁（選班級/學生、營隊卡片、我的報名、提示訊息）
- `src/components/ui/CampList.tsx`　後台營隊清單與分班介面
- `src/components/ui/CampForm.tsx`　營隊新增/編輯表單
- `src/index.css`、`tailwind.config.js`（可加入字體、色彩 token）

允許：改 className、調整 JSX 結構與排版、加入圖示/插圖、加入動畫、拆分子元件（放在 `components/ui/` 內）、RWD（學生端以手機為主）。
學生端請做得友善、明亮、適合國小家長使用；後台則偏簡潔高效。

## 絕對不可修改
- `src/lib/**`、`src/hooks/**`、`src/data/**`、`src/services/**`、`src/types.ts`、`src/App.tsx`
- `src/components/reports/**`（三大報表）與 `src/print.css`：這是 A4 行政表單，版面已校正，**不要動**
- 每個元件的 **props 介面（`export interface ...Props`）**：名稱、型別、必填與否都不得更動
- 不得新增或更換資料來源、不得在元件內直接呼叫 API／Supabase／localStorage

## 必須保留的行為與 class
- 標有 `no-print` 的元素必須保留該 class（列印時隱藏）
- `FrontPage` 中：按鈕的 `disabled` 與文字完全來自 `buttonState()`，不要自行判斷；錯誤訊息直接顯示 `onEnroll` 回傳的 `message`（含「請先取消 11/4 的報名後再重新選擇」這類提示）
- 訊息提示區保留 `role="alert"`，且要醒目（建議 Modal 或置頂 Toast）
- 刪除營隊仍須有二次確認
- 所有互動元件需有可及性標籤與足夠的點擊範圍

## 驗收（完成後必須執行）
1. `npm test` 全部通過（驗證邏輯沒被破壞）
2. `npm run build` 無 TypeScript 錯誤
3. `git diff --stat` 顯示變動檔案**只在上方「可以修改」清單內**
4. 切到「班級簽到表／總簽到表／報名通知單」並按列印預覽，版面與修改前相同

## 交付
請回報：修改了哪些檔案、新增了哪些子元件、是否新增套件（盡量不要；若需要請說明理由）。

---
## 第三階段更新（候補、分頁重構、前後台互斥）

**新增可改外觀的元件**（同樣只能改樣式與版面，不可動 props／邏輯）：
`components/ui/GuideCard.tsx`（使用教學）、`ProfilePage.tsx` + `PasswordForm.tsx`（聯絡人資料與設定）、`StatusPage.tsx`（我的報名狀態）、`Notice.tsx`（提示訊息）。

**新增鎖定檔案（不可修改）**：`lib/waitlist.ts`、`lib/session.ts`、`lib/assign.ts`（S 型分班）、`components/smoke.test.tsx`。

**外觀注意事項**
- 候補按鈕文字／可否點擊一律來自 `buttonState()`（`kind === 'waitlist'` 時用醒目但不同於「報名」的顏色，目前為琥珀色）。
- 「候補中」與「報名成功」必須用不同顏色與文字區分（StatusPage）。
- 後台候補名單的「遞補轉正」按鈕 disabled 狀態來自 `canPromote()`，不可移除。
- 驗收新增：`npm test` 需 35 個以上測試通過（含 `smoke.test.tsx` 渲染測試）。

---
## v3.1：單日擇一自動拆場次
- 新增鎖定檔案：`lib/sessions.ts`（`buildCamps`）。`CampForm` 的 `onSave` 現在傳出 `Camp[]`（單日擇一會拆成每天一筆），props 簽章不可再改。
- 單日擇一時，表單的「每一場次人數上限」文字與下方「將建立 N 個場次」預覽必須保留。

---
## v3.2
- 新增鎖定檔案：`lib/phone.ts`（電話檢核：手機 09 開頭 10 碼／市話 7 碼）。聯絡人表單的電話錯誤提示、「清空所有聯絡人」按鈕必須保留。
- `components/reports/R3Notice.tsx` 版面已調整為「上半家長留存 + 裁切線 + 下半簽收回條」，維持鎖定，不可更動。
- 營隊類型新增「假日營」(`season: 'holiday'`)；後台學生管理新增「清空聯絡人」「取消全部報名」。
- 驗收：`npm test` 需 48 個以上測試通過。

---
## v4（解除鎖定層的七項進階功能）
新增檔案（邏輯，不可更動）：`lib/phone.ts`（姓名／電話嚴格正則）、`lib/pin.ts`、`lib/route.ts`、`lib/rollcall.ts`、`lib/siblings.ts`、`data/repo.test.ts`。
新增 UI（可改外觀，不可動 props／邏輯）：`ui/AlertBanner.tsx`、`ui/SiblingBar.tsx`、`ui/ForgotPasswordPanel.tsx`、`teacher/TeacherRollCall.tsx`（手機直式，簽到／缺席按鈕維持超大尺寸）。
驗收：`npm test` ≥ 84 個測試通過、`npm run build` 無錯誤。

---
## v5（密碼與聯絡人改以「學生姓名」為鍵）
- 新增鎖定檔案：`lib/name.ts`（`normName`：去除所有全形／半形空白）、`lib/siblings.ts`（工作階段以姓名為鍵）。
- `SiblingBar` 的 props 改為 `items: {key, label}[]` + `activeKey`（key 是正規化姓名）。外觀可改，props 不可動。
- `StudentAdmin` 新增 `duplicateNames` 警告區塊，需保留。
- 驗收：`npm test` ≥ 94 個測試通過、`npm run build` 無錯誤。

---
## v6（倒數計時器／預設密碼跟著學號／報名跟著姓名）
- 新增鎖定檔案（邏輯，不可更動）：`hooks/useCountdown.ts`、`lib/time.ts`（時間一律以絕對時間點比對，顯示才轉 Asia/Taipei）、`supabase/tests/*`。
- 新增 UI（可改外觀，不可動 props／邏輯）：`ui/RegistrationCountdown.tsx`。三種狀態的文字（⏳ 距離報名開放還有／🔥 距離報名截止剩餘／🚫 本期報名已全面截止）、
  「最後 24 小時＝紅色＋呼吸閃爍（`camp-breath`）」、`role="timer"` 必須保留；已截止時不得顯示跳動數字。
- `FrontPage`／`StatusPage` 以 `useNow()` 的同一個時鐘決定按鈕是否 disabled，不可改成只在載入時計算（否則截止瞬間不會自動鎖定）。
- `ForgotPasswordPanel`：新密碼為「選填」，留空＝重設回預設密碼（目前學號）。
- 驗收：`npm test` ≥ 125 個測試通過、`npm run build` 無錯誤。
