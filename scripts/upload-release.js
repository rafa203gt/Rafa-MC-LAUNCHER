import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawn } from 'node:child_process';

const REPO_OWNER = 'rafa203gt';
const REPO_NAME = 'Rafa-MC-LAUNCHER';
const TAG_NAME = 'v1.0.0';
const RELEASE_NAME = 'All the Mods 10 - ATM10 Initial Pack';
const ZIP_FILE = path.join(process.cwd(), 'modpack', 'atm10-bundle.zip');

function getGitHubToken() {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['credential', 'fill'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Git credential helper falló: ${stderr}`));
      }
      const lines = stdout.split('\n');
      const passLine = lines.find((l) => l.startsWith('password='));
      if (!passLine) {
        return reject(new Error('No se encontró el token en Git Credential Manager.'));
      }
      resolve(passLine.replace('password=', '').trim());
    });

    proc.stdin.write('protocol=https\nhost=github.com\n\n');
    proc.stdin.end();
  });
}

function githubApiRequest(token, method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: apiPath,
        method: method,
        headers: {
          'User-Agent': 'Rafa-Launcher-Release-Uploader',
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let resData = '';
        res.on('data', (c) => (resData += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(resData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(`GitHub API ${res.statusCode}: ${json.message || resData}`));
            }
          } catch (e) {
            resolve(resData);
          }
        });
      }
    );

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function uploadReleaseAsset(token, uploadUrlTemplate, filePath) {
  const uploadUrl = uploadUrlTemplate.replace(/\{.*?\}/, `?name=${encodeURIComponent(path.basename(filePath))}`);
  const urlObj = new URL(uploadUrl);
  const fileSize = fs.statSync(filePath).size;

  console.log(`\n🚀 Subiendo ${path.basename(filePath)} (${(fileSize / 1024 / 1024).toFixed(1)} MB) a GitHub Releases...`);

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    let uploaded = 0;
    let lastPercent = -1;

    fileStream.on('data', (chunk) => {
      uploaded += chunk.length;
      const percent = Math.floor((uploaded / fileSize) * 100);
      if (percent % 10 === 0 && percent !== lastPercent) {
        lastPercent = percent;
        console.log(`⏳ Progreso de subida: ${percent}% (${(uploaded / 1024 / 1024).toFixed(1)} MB / ${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
      }
    });

    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'User-Agent': 'Rafa-Launcher-Release-Uploader',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/zip',
          'Content-Length': fileSize,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      },
      (res) => {
        let resData = '';
        res.on('data', (c) => (resData += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ ¡Subida completada con éxito!');
            resolve(JSON.parse(resData));
          } else {
            reject(new Error(`Error de subida (${res.statusCode}): ${resData}`));
          }
        });
      }
    );

    req.on('error', reject);
    fileStream.pipe(req);
  });
}

async function main() {
  console.log('========================================================');
  console.log('🚀 SUBIENDO MODPACK ALL THE MODS 10 A GITHUB RELEASES   ');
  console.log('========================================================\n');

  if (!fs.existsSync(ZIP_FILE)) {
    console.error(`❌ No se encontró el archivo: ${ZIP_FILE}`);
    process.exit(1);
  }

  console.log('🔑 Obteniendo token de autenticación de GitHub...');
  const token = await getGitHubToken();
  console.log('✅ Token obtenido correctamente.');

  // 1. Check if release already exists
  let release;
  try {
    console.log(`🔍 Comprobando si la release ${TAG_NAME} ya existe...`);
    release = await githubApiRequest(token, 'GET', `/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${TAG_NAME}`);
    console.log(`ℹ️ La release ${TAG_NAME} ya existe (ID: ${release.id}).`);
  } catch {
    console.log(`📦 Creando nueva release en GitHub (${TAG_NAME})...`);
    release = await githubApiRequest(token, 'POST', `/repos/${REPO_OWNER}/${REPO_NAME}/releases`, {
      tag_name: TAG_NAME,
      name: RELEASE_NAME,
      body: 'Modpack oficial All the Mods 10 (ATM10) para Minecraft 1.21.1 NeoForge. Auto-descarga por Rafa Launcher.',
      draft: false,
      prerelease: false
    });
    console.log(`✅ Release creada (ID: ${release.id}).`);
  }

  // 2. Check if asset is already attached and delete if needed
  if (release.assets && release.assets.length > 0) {
    const existingAsset = release.assets.find((a) => a.name === path.basename(ZIP_FILE));
    if (existingAsset) {
      console.log(`🗑️ Eliminando asset anterior para reemplazarlo (ID: ${existingAsset.id})...`);
      await githubApiRequest(token, 'DELETE', `/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${existingAsset.id}`);
    }
  }

  // 3. Upload asset
  await uploadReleaseAsset(token, release.upload_url, ZIP_FILE);

  console.log('\n========================================================');
  console.log('🎉 ¡MODPACK PUBLICADO EN LA NUBE CON ÉXITO!            ');
  console.log('========================================================');
  console.log(`🌐 Enlace de descarga directa del modpack:`);
  console.log(`https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG_NAME}/atm10-bundle.zip`);
  console.log(`\nCualquier usuario que abra el launcher descargará el modpack automáticamente.`);
}

main().catch(console.error);
