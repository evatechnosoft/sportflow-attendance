import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages alt yolu: https://<org>.github.io/sportflow/
  base: process.env.GITHUB_ACTIONS ? '/sportflow/' : '/',
  plugins: [react(), tailwindcss()],
})
