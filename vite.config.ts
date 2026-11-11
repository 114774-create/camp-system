import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // 單元測試勿載入 .env.local 的正式 Supabase／Sheets 連線
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      VITE_STUDENT_SHEET_API_URL: '',
      VITE_GOOGLE_SHEET_URL: '',
      VITEST: 'true',
    },
  },
})
