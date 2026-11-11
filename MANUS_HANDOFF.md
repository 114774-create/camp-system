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
`components/ui/GuideCard.tsx`（使用教學）、`ProfilePage.tsx` + `PasswordForm.tsx`（個人資料與設定）、`StatusPage.tsx`（我的報名狀態）、`Notice.tsx`（提示訊息）。

**新增鎖定檔案（不可修改）**：`lib/waitlist.ts`、`lib/session.ts`、`lib/assign.ts`（S 型分班）、`components/smoke.test.tsx`。

**外觀注意事項**
- 候補按鈕文字／可否點擊一律來自 `buttonState()`（`kind === 'waitlist'` 時用醒目但不同於「報名」的顏色，目前為琥珀色）。
- 「候補中」與「報名成功」必須用不同顏色與文字區分（StatusPage）。
- 後台候補名單的「遞補轉正」按鈕 disabled 狀態來自 `canPromote()`，不可移除。
- 驗收新增：`npm test` 需 35 個以上測試通過（含 `smoke.test.tsx` 渲染測試）。
