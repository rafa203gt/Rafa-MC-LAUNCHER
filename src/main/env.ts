import path from 'node:path';
import fs from 'node:fs';

/**
 * Carga variables de entorno desde un archivo .env si existen.
 */
function loadEnvFile(): void {
  const possiblePaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '..', '.env'),
    typeof __dirname !== 'undefined' ? path.join(__dirname, '..', '.env') : '',
    typeof __dirname !== 'undefined' ? path.join(__dirname, '..', '..', '.env') : '',
    (process as any).resourcesPath ? path.join((process as any).resourcesPath, '.env') : ''
  ].filter(Boolean);

  for (const envPath of possiblePaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
        break;
      }
    } catch {}
  }
}

// Cargar .env de inmediato al importar
loadEnvFile();

const DEFAULT_SUPABASE_URL = 'https://wukhkwwstsfvqcnyqoqu.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1a2hrd3dzdHNmdnFjbnlxb3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDk5NDUsImV4cCI6MjEwMjkyNTk0NX0.2NfFdLXOH4LHNJyAAqAeeUxtWsGnt6mcrT1VhQ22qzg';

export const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
  GITHUB_PAT: process.env.GITHUB_PAT || process.env.VITE_GITHUB_PAT || '',
  GITHUB_REPO: process.env.GITHUB_REPO || process.env.VITE_GITHUB_REPO || 'rafa203gt/Rafa-MC-LAUNCHER',
  DEFAULT_SERVER_IP: process.env.DEFAULT_SERVER_IP || 'play.tuserver.com',
  DEFAULT_SERVER_PORT: Number(process.env.DEFAULT_SERVER_PORT) || 25565
};

