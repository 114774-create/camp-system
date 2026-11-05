/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Google Apps Script Web App，回傳學生 JSON 陣列 */
  readonly VITE_STUDENT_SHEET_API_URL?: string
  /** Google 試算表網址或 ID；會自動轉成 gviz CSV（sheet=Students） */
  readonly VITE_GOOGLE_SHEET_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
