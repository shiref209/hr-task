import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // @hr/types ships CommonJS for the API; the web app compiles its TS source directly.
      '@hr/types': fileURLToPath(new URL('../../types/src/index.ts', import.meta.url)),
    },
  },
})
