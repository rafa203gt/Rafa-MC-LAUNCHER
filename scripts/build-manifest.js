import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const REPO_OWNER = 'rafa203gt';
const REPO_NAME = 'Rafa-MC-LAUNCHER';
const TAG_VERSION = 'v1.0.0';

const MODS_DIR = path.join(process.cwd(), 'modpack', 'mods');
const CONFIG_DIR = path.join(process.cwd(), 'modpack', 'config');
const OUTPUT_FILE = path.join(process.cwd(), 'modpack', 'manifest.json');

function calculateSha1(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha1').update(buffer).digest('hex').toLowerCase();
}

function scanFiles(dir, baseRel = '') {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = baseRel ? `${baseRel}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      results.push(...scanFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      const stats = fs.statSync(fullPath);
      const sha1 = calculateSha1(fullPath);
      const rawGithubUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/modpack/${relPath.replace(/\\/g, '/')}`;
      const releaseDownloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG_VERSION}/${encodeURIComponent(entry.name)}`;

      results.push({
        path: relPath.replace(/\\/g, '/'),
        sha1: sha1,
        size: stats.size,
        downloadUrl: relPath.startsWith('mods/') ? releaseDownloadUrl : rawGithubUrl
      });
    }
  }
  return results;
}

console.log('--- 📦 Generador de Modpack Manifest ---');

if (!fs.existsSync(path.join(process.cwd(), 'modpack'))) {
  fs.mkdirSync(path.join(process.cwd(), 'modpack', 'mods'), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'modpack', 'config'), { recursive: true });
  console.log('Carpeta "modpack/mods" y "modpack/config" creadas. Coloca tus archivos .jar allí y vuelve a ejecutar este script.');
}

const modFiles = scanFiles(MODS_DIR, 'mods');
const configFiles = scanFiles(CONFIG_DIR, 'config');
const allFiles = [...modFiles, ...configFiles];

const manifest = {
  name: 'Rafa Server Modpack',
  version: '1.0.0',
  minecraftVersion: '1.20.1',
  modLoader: 'fabric',
  modLoaderVersion: '0.15.11',
  updatedAt: new Date().toISOString(),
  files: allFiles
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`✅ Manifiesto generado con éxito: ${OUTPUT_FILE}`);
console.log(`Total de archivos procesados: ${allFiles.length} (${modFiles.length} mods, ${configFiles.length} configs)`);
console.log('\nSiguientes pasos:');
console.log('1. Sube los archivos .jar a una Release en GitHub con el tag ' + TAG_VERSION);
console.log('2. Sube modpack/manifest.json al repositorio.');
