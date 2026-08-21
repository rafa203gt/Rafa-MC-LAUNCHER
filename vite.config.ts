import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'electron',
                'minecraft-launcher-core',
                'minecraft-server-util',
                'adm-zip',
                'axios',
                'child_process',
                'fs',
                'path',
                'crypto',
                'os',
                'https',
                'http',
                'net'
              ]
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'src/main/preload.ts'),
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      },
      renderer: {}
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
