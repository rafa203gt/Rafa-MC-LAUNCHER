import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

const REPO_OWNER = 'rafa203gt';
const REPO_NAME = 'Rafa-MC-LAUNCHER';
const TAG_VERSION = 'v1.0.0';

const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
const INSTANCE_DIR = path.join(appData, '.rafa-mc-launcher', 'instances', 'default');
const OUTPUT_DIR = path.join(process.cwd(), 'modpack');
const OUTPUT_MANIFEST = path.join(OUTPUT_DIR, 'manifest.json');
const OUTPUT_ZIP = path.join(OUTPUT_DIR, 'atm10-bundle.zip');

function calculateSha1(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha1').update(buffer).digest('hex').toLowerCase();
}

function scanDirectory(baseDir, subDir = '') {
  const currentPath = subDir ? path.join(baseDir, subDir) : baseDir;
  if (!fs.existsSync(currentPath)) return [];

  const results = [];
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const relPath = subDir ? path.join(subDir, entry.name) : entry.name;
    const fullPath = path.join(baseDir, relPath);

    if (entry.isDirectory()) {
      results.push(...scanDirectory(baseDir, relPath));
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.tmp') || entry.name === '.DS_Store') continue;

      const stats = fs.statSync(fullPath);
      const sha1 = calculateSha1(fullPath);
      const cleanRel = relPath.replace(/\\/g, '/');
      const releaseDownloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG_VERSION}/${encodeURIComponent(entry.name)}`;

      results.push({
        path: cleanRel,
        sha1: sha1,
        size: stats.size,
        downloadUrl: releaseDownloadUrl
      });
    }
  }

  return results;
}

async function main() {
  console.log('========================================================');
  console.log('🚀 SINCRONIZACIÓN EXACTA 1:1 DE ALL THE MODS 10 (ATM10) ');
  console.log('========================================================\n');

  if (!fs.existsSync(INSTANCE_DIR)) {
    console.error(`❌ No se encontró la carpeta de la instancia: ${INSTANCE_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const itemsToInclude = [
    'config',
    'datapacks',
    'defaultconfigs',
    'kubejs',
    'local',
    'mods',
    'resourcepacks',
    'saves',
    'shaderpacks',
    'versions',
    'manifest.json',
    'minecraftinstance.json'
  ];

  const allFiles = [];
  const zip = new AdmZip();

  for (const item of itemsToInclude) {
    const fullPath = path.join(INSTANCE_DIR, item);
    if (!fs.existsSync(fullPath)) {
      if (['resourcepacks', 'saves', 'datapacks'].includes(item)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }

    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        console.log(`📁 Incluyendo carpeta: ${item}/`);
        const files = scanDirectory(INSTANCE_DIR, item);
        allFiles.push(...files);
        zip.addLocalFolder(fullPath, item);
      } else if (stats.isFile()) {
        console.log(`📄 Incluyendo archivo: ${item}`);
        const sha1 = calculateSha1(fullPath);
        allFiles.push({
          path: item,
          sha1: sha1,
          size: stats.size,
          downloadUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG_VERSION}/${encodeURIComponent(item)}`
        });
        zip.addLocalFile(fullPath);
      }
    }
  }

  const bundleUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG_VERSION}/atm10-bundle.zip`;

  const manifest = {
    name: 'All the Mods 10 (ATM10)',
    version: '1.0.0',
    minecraftVersion: '1.21.1',
    modLoader: 'neoforge',
    modLoaderVersion: '21.1.247',
    updatedAt: new Date().toISOString(),
    bundleUrl: bundleUrl,
    files: allFiles
  };

  fs.writeFileSync(OUTPUT_MANIFEST, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\n✅ Manifiesto 1:1 generado en: ${OUTPUT_MANIFEST}`);
  console.log(`📊 Total de archivos catalogados: ${allFiles.length}`);

  console.log('\n📦 Generando paquete comprimido 1:1 (atm10-bundle.zip)...');
  zip.writeZip(OUTPUT_ZIP);
  const zipStats = fs.statSync(OUTPUT_ZIP);
  console.log(`✅ Archivo zip generado: ${OUTPUT_ZIP} (${(zipStats.size / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch(console.error);
