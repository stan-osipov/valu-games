import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/valu-games/',
  plugins: [react()],
  server: {
    headers: {
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': '',
    },
  },
})
