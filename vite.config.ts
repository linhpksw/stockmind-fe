import react from '@vitejs/plugin-react'
import { defineConfig, type UserConfigExport } from 'vite'
import type { InlineConfig as VitestConfig } from 'vitest'

const config = {
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
}

export default defineConfig(config as UserConfigExport & { test: VitestConfig })
