import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages alt yolu: https://<org>.github.io/sportflow-attendance/
  base: process.env.GITHUB_ACTIONS ? '/sportflow-attendance/' : '/',
  plugins: [react(), tailwindcss()],
})
