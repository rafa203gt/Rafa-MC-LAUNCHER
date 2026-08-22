import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''),
      'process.env.DEFAULT_SERVER_IP': JSON.stringify(env.DEFAULT_SERVER_IP || 'play.tuserver.com'),
      'process.env.DEFAULT_SERVER_PORT': JSON.stringify(env.DEFAULT_SERVER_PORT || '25565')
    },
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
                'node:child_process',
                'node:fs',
                'node:path',
                'node:crypto',
                'node:os',
                'node:https',
                'node:http',
                'node:net',
                'node:module'
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
  };
});

