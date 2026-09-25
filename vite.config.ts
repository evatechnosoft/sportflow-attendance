import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages alt yolu: https://<org>.github.io/sportflow-attendance/
  // BASE_PATH: anadoluspor.web.app altında yol (/yoklama/).
  base: process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/sportflow-attendance/' : '/'),
  plugins: [react(), tailwindcss()],
})
