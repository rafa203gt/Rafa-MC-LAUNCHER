import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/preload.ts', 'src/main/main.ts', 'dist-electron/**', 'admin-panel/**']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
