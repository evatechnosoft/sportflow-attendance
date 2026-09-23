import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  // jsdom + React testleri yük altındaki Windows makinesinde 5 sn'yi aşabiliyor.
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/testing/setup.ts'],
      testTimeout: 20000,
    },
  }),
)
