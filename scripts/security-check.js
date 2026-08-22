import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const IS_STAGED = process.argv.includes('--staged');
const IS_ALL_LOCAL = process.argv.includes('--all');

const FORBIDDEN_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /\.keystore$/i,
  /^id_rsa$/i,
  /^id_ed25519$/i,
  /^credentials\.json$/i,
  /^service-account.*\.json$/i,
  /^tokens?\.json$/i
];

const ALLOWED_FILES = [
  '.env.example'
];

const SECRET_PATTERNS = [
  {
    name: 'GitHub Personal Access Token',
    regex: /\b(ghp_[a-zA-Z0-9]{36,}|github_pat_[a-zA-Z0-9_]{40,}|gho_[a-zA-Z0-9]{36,}|ghu_[a-zA-Z0-9]{36,}|ghs_[a-zA-Z0-9]{36,})\b/
  },
  {
    name: 'Supabase Service Role Key / Access Token',
    regex: /\b(sbp_[a-zA-Z0-9]{40,})\b/
  },
  {
    name: 'OpenAI / Claude API Key',
    regex: /\b(sk-[a-zA-Z0-9]{20,}|sk-ant-[a-zA-Z0-9]{20,})\b/
  },
  {
    name: 'AWS Access Key ID',
    regex: /\b(AKIA[0-9A-Z]{16})\b/
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP|PRIVATE) KEY-----/
  }
];

function checkFileForSecrets(filePath, content) {
  const issues = [];
  const fileName = path.basename(filePath);

  // 1. Check file name
  if (!ALLOWED_FILES.includes(fileName)) {
    for (const pattern of FORBIDDEN_FILE_PATTERNS) {
      if (pattern.test(fileName)) {
        issues.push(`[ARCHIVO PROHIBIDO] Archivo sensible en control de versiones: ${filePath}`);
      }
    }
  }

  // 2. Check file content
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Ignore comments or placeholders
    if (
      line.includes('your-key-here') ||
      line.includes('ejemplo') ||
      line.includes('example') ||
      line.includes('VITE_SUPABASE_') && line.includes("process.env") ||
      line.includes('play.tuserver.com')
    ) {
      continue;
    }

    for (const rule of SECRET_PATTERNS) {
      if (rule.regex.test(line)) {
        issues.push(`[${rule.name}] en ${filePath}:${i + 1} -> "${line.trim().slice(0, 80)}"`);
      }
    }
  }

  return issues;
}

function runAudit() {
  console.log('\n🛡️  ======================================================');
  console.log('🔒  AUDITORÍA DE SEGURIDAD Y FILTRADO DE DATOS PRIVADOS   ');
  console.log('🛡️  ======================================================\n');

  const violations = [];

  if (IS_STAGED) {
    console.log('🔍 Analizando archivos preparados para commit (staged)...');
    try {
      const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' })
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      if (stagedFiles.length === 0) {
        console.log('ℹ️  No hay archivos en staging para analizar.');
        return;
      }

      for (const file of stagedFiles) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, 'utf-8');
        const fileIssues = checkFileForSecrets(file, content);
        violations.push(...fileIssues);
      }
    } catch (err) {
      console.warn('⚠️  No se pudo obtener la lista de git staged:', err.message);
    }
  } else if (!IS_ALL_LOCAL) {
    console.log('🔍 Analizando archivos registrados y trackeados en Git (git ls-files)...');
    try {
      const trackedFiles = execSync('git ls-files', { encoding: 'utf-8' })
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const file of trackedFiles) {
        if (!fs.existsSync(file)) continue;
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const fileIssues = checkFileForSecrets(file, content);
          violations.push(...fileIssues);
        } catch {
          // Skip binary files
        }
      }
    } catch (err) {
      console.warn('⚠️  No se pudo obtener la lista de git ls-files:', err.message);
    }
  } else {
    console.log('🔍 Analizando todo el sistema de archivos local...');
    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(process.cwd(), fullPath);

        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === 'dist-electron' ||
          entry.name === 'release'
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const issues = checkFileForSecrets(relPath, content);
            violations.push(...issues);
          } catch {}
        }
      }
    }
    scanDir(process.cwd());
  }

  if (violations.length > 0) {
    console.error('\n❌ ¡SE HAN DETECTADO DATOS SENSIBLES O ARCHIVOS PROHIBIDOS!');
    console.error('----------------------------------------------------------');
    violations.forEach((v) => console.error(` 🚨 ${v}`));
    console.error('----------------------------------------------------------');
    console.error('🛑 El commit o push ha sido BLOQUEADO para evitar fugas a GitHub.');
    console.error('💡 Revisa tu .gitignore o usa variables de entorno (.env).\n');
    process.exit(1);
  } else {
    console.log('✅ ¡Auditoría completada con éxito! No se encontraron secretos ni datos calientes en el repositorio.');
    console.log('🛡️  Tu código está completamente seguro para subir a GitHub.\n');
  }
}

runAudit();
