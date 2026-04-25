import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 設定のエントリーポイント
export default defineConfig({
  plugins: [react()],
  base: '/hackthon_WEB/',
})
