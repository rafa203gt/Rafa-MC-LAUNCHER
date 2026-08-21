import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import https from 'node:https';
import { spawn } from 'node:child_process';

const REPO_OWNER = 'rafa203gt';
const REPO_NAME = 'Rafa-MC-LAUNCHER';
const TAG_VERSION = 'v1.0.0';

const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
const INSTANCE_DIR = path.join(appData, '.rafa-mc-launcher', 'instances', 'default');
const MODS_DIR = path.join(INSTANCE_DIR, 'mods');
const MANIFEST_PATH = path.join(process.cwd(), 'modpack', 'manifest.json');

function calculateSha1(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha1').update(buffer).digest('hex').toLowerCase();
}

function getGitHubToken() {
  return new Promise((resolve) => {
    const proc = spawn('git', ['credential', 'fill'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.on('close', () => {
      const pass = stdout.split('\n').find((l) => l.startsWith('password='));
      resolve(pass ? pass.replace('password=', '').trim() : null);
    });
    proc.stdin.write('protocol=https\nhost=github.com\n\n');
    proc.stdin.end();
  });
}

function githubRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ statusCode: res.statusCode || 200, data: json });
        } catch {
          resolve({ statusCode: res.statusCode || 200, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function uploadAsset(uploadUrl, token, filePath, fileName) {
  const fileStats = fs.statSync(filePath);
  const fileStream = fs.createReadStream(filePath);
  const cleanUploadUrl = uploadUrl.split('{')[0] + `?name=${encodeURIComponent(fileName)}`;
  const urlObj = new URL(cleanUploadUrl);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'User-Agent': 'Rafa-MC-Launcher',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/java-archive',
          'Content-Length': fileStats.size
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 201 || res.statusCode === 200) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Error subiendo mod ${fileName}: HTTP ${res.statusCode} - ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    fileStream.pipe(req);
  });
}

async function main() {
  const modArg = process.argv[2];
  if (!modArg) {
    console.error('❌ Uso: node scripts/update-single-mod.js <ruta-al-archivo-mod.jar>');
    process.exit(1);
  }

  const modPath = path.resolve(modArg);
  if (!fs.existsSync(modPath) || !modPath.endsWith('.jar')) {
    console.error(`❌ Archivo inválido o no encontrado: ${modPath}`);
    process.exit(1);
  }

  const fileName = path.basename(modPath);
  console.log('========================================================');
  console.log(`🚀 ACTUALIZANDO MOD INDIVIDUAL: ${fileName}`);
  console.log('========================================================\n');

  // 1. Copiar mod a la carpeta local de mods
  if (!fs.existsSync(MODS_DIR)) fs.mkdirSync(MODS_DIR, { recursive: true });
  const localTarget = path.join(MODS_DIR, fileName);
  if (modPath !== localTarget) {
    fs.copyFileSync(modPath, localTarget);
    console.log(`✅ Mod copiado a la instancia local: ${localTarget}`);
  }

  const sha1 = calculateSha1(localTarget);
  const size = fs.statSync(localTarget).size;
  console.log(`📊 SHA-1: ${sha1} | Tamaño: ${(size / 1024 / 1024).toFixed(2)} MB`);

  // 2. Autenticar en GitHub
  console.log('\n🔑 Obteniendo credenciales de GitHub...');
  const token = await getGitHubToken();
  if (!token) {
    console.error('❌ No se encontró token de GitHub. Asegúrate de tener sesión iniciada en Git.');
    process.exit(1);
  }

  // 3. Obtener la release v1.0.0
  console.log(`🔍 Consultando release ${TAG_VERSION}...`);
  const releaseRes = await githubRequest({
    hostname: 'api.github.com',
    path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${TAG_VERSION}`,
    method: 'GET',
    headers: {
      'User-Agent': 'Rafa-MC-Launcher',
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });

  if (releaseRes.statusCode !== 200) {
    console.error(`❌ No se encontró la release ${TAG_VERSION}. Crea una release primero.`);
    process.exit(1);
  }

  const release = releaseRes.data;

  // 4. Si el asset ya existe en la release, eliminarlo para reemplazarlo
  const existingAsset = release.assets?.find((a) => a.name === fileName);
  if (existingAsset) {
    console.log(`🗑️ Reemplazando versión anterior en GitHub Releases (ID: ${existingAsset.id})...`);
    await githubRequest({
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${existingAsset.id}`,
      method: 'DELETE',
      headers: {
        'User-Agent': 'Rafa-MC-Launcher',
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    });
  }

  // 5. Subir el nuevo mod a GitHub Releases
  console.log(`🚀 Subiendo ${fileName} a GitHub Releases...`);
  await uploadAsset(release.upload_url, token, localTarget, fileName);
  console.log(`✅ ¡Mod subido con éxito!`);

  // 6. Actualizar modpack/manifest.json
  console.log('\n📝 Actualizando modpack/manifest.json...');
  let manifest = {
    name: 'All the Mods 10 (ATM10)',
    version: '1.0.0',
    minecraftVersion: '1.21.1',
    modLoader: 'neoforge',
    modLoaderVersion: '21.1.247',
    bundleUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG_VERSION}/atm10-bundle.zip`,
    files: []
  };

  if (fs.existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  }

  const relPath = `mods/${fileName}`;
  const downloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG_VERSION}/${encodeURIComponent(fileName)}`;

  const existingFileIdx = manifest.files.findIndex((f) => f.path === relPath || path.basename(f.path) === fileName);
  const fileEntry = {
    path: relPath,
    sha1: sha1,
    size: size,
    downloadUrl: downloadUrl
  };

  if (existingFileIdx >= 0) {
    manifest.files[existingFileIdx] = fileEntry;
  } else {
    manifest.files.push(fileEntry);
  }

  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`✅ Manifiesto actualizado.`);

  // 7. Git commit & push automático
  console.log('\n🚀 Publicando manifiesto en GitHub...');
  await new Promise((resolve) => {
    const gitProc = spawn('git', ['commit', '-am', `chore(modpack): update single mod ${fileName}`, '&&', 'git', 'push', 'origin', 'main'], {
      shell: true,
      stdio: 'inherit'
    });
    gitProc.on('close', resolve);
  });

  console.log('\n========================================================');
  console.log(`🎉 ¡MOD ${fileName} PUBLICADO CON ÉXITO!`);
  console.log('Todos tus jugadores descargarán únicamente este mod al abrir el launcher.');
  console.log('========================================================');
}

main().catch(console.error);
