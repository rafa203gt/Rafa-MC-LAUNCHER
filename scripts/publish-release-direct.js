import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawn } from 'node:child_process';

const REPO_OWNER = 'rafa203gt';
const REPO_NAME = 'Rafa-MC-LAUNCHER';
const VERSION = '1.0.23';
const TAG = `v${VERSION}`;

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
          resolve({ statusCode: res.statusCode, headers: res.headers, data: body ? JSON.parse(body) : null });
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function uploadAsset(uploadUrlTemplate, token, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const cleanUrl = uploadUrlTemplate.split('{')[0] + `?name=${encodeURIComponent(fileName)}`;
    const urlObj = new URL(cleanUrl);
    const stat = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);

    const req = https.request(
      {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'User-Agent': 'Rafa-MC-Launcher',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': stat.size,
          Accept: 'application/vnd.github+json'
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 201 || res.statusCode === 200) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Error subiendo ${fileName}: HTTP ${res.statusCode} - ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    fileStream.pipe(req);
  });
}

async function main() {
  console.log(`\n🚀 Publicando GitHub Release ${TAG} con binarios precompilados...`);

  const token = await getGitHubToken();
  if (!token) {
    console.error('❌ Token no encontrado en git credentials');
    process.exit(1);
  }

  const releaseDir = path.join(process.cwd(), 'release');
  const filesToUpload = [
    {
      path: path.join(releaseDir, `Rafa-MC-LAUNCHER Setup ${VERSION}.exe`),
      name: `Rafa-MC-LAUNCHER Setup ${VERSION}.exe`
    },
    {
      path: path.join(releaseDir, `Rafa-MC-LAUNCHER ${VERSION}.exe`),
      name: `Rafa-MC-LAUNCHER ${VERSION}.exe`
    }
  ].filter((f) => fs.existsSync(f.path));

  console.log(`Archivos listos para subir:`, filesToUpload.map((f) => f.name));

  const releaseDescription = `## 🚀 Rafa MC Launcher ${TAG}

### ⚡ Correcciones y Mejoras en v${VERSION}:
- 🛡️ **Fix Sincronizador de Modpacks:**
  - Filtrado estricto de URLs para omitir archivos sin descarga directa válida y prevenir bloqueos.
  - Implementado timeout estricto de 10s con Axios streams para garantizar que la descarga nunca se quede congelada al 0%.
  - Contador de progreso resiliente que siempre avanza y permite el arranque inmediato del juego.
- ⚡ **Modo Rendimiento Extremo (System Tray & Cero Consumo):**
  - El launcher se oculta a la bandeja del sistema durante la partida para liberar el 100% de CPU y GPU a Minecraft.
- 🛡️ **Asistente Anti-Crash Inteligente:**
  - Diagnóstico post-mortem automático y botón de auto-reparación en 1 clic.
- 🎨 **Estudio WebGL 3D Oficial (\`skinview3d\`):**
  - Animaciones fluidas, capas volumétricas y catálogo categorizado.

---
### 📦 Archivos Disponibles para Descarga:
1. 🎮 **Ejecutable Portable:** \`Rafa-MC-LAUNCHER ${VERSION}.exe\` (Sin instalación previa)
2. 📦 **Instalador de Windows:** \`Rafa-MC-LAUNCHER Setup ${VERSION}.exe\` (Con accesos directos)
`;

  // 1. Check if release already exists
  const existingReleaseRes = await githubRequest({
    hostname: 'api.github.com',
    path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${TAG}`,
    method: 'GET',
    headers: {
      'User-Agent': 'Rafa-MC-Launcher',
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });

  let uploadUrl = '';

  if (existingReleaseRes.statusCode === 200 && existingReleaseRes.data.upload_url) {
    console.log(`ℹ️ La release ${TAG} ya existía. Subiendo archivos...`);
    uploadUrl = existingReleaseRes.data.upload_url;

    // Delete duplicate assets if already present
    const existingAssets = existingReleaseRes.data.assets || [];
    for (const file of filesToUpload) {
      const match = existingAssets.find((a) => a.name === file.name);
      if (match) {
        console.log(`🗑️ Eliminando asset previo ${match.name}...`);
        await githubRequest({
          hostname: 'api.github.com',
          path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${match.id}`,
          method: 'DELETE',
          headers: {
            'User-Agent': 'Rafa-MC-Launcher',
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
          }
        });
      }
    }
  } else {
    const createRes = await githubRequest(
      {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
        method: 'POST',
        headers: {
          'User-Agent': 'Rafa-MC-Launcher',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json'
        }
      },
      JSON.stringify({
        tag_name: TAG,
        name: `v${VERSION}: ⚡ Fix Sincronizador, 🚀 Rendimiento Extremo & 🛡️ Anti-Crash`,
        body: releaseDescription,
        draft: false,
        prerelease: false
      })
    );

    if (createRes.statusCode !== 201 && createRes.statusCode !== 200) {
      console.error('❌ Error creando release:', createRes.data);
      process.exit(1);
    }
    uploadUrl = createRes.data.upload_url;
  }

  console.log(`✅ Release lista. Subiendo binarios...`);

  for (const file of filesToUpload) {
    console.log(`⬆️ Subiendo ${file.name}...`);
    try {
      await uploadAsset(uploadUrl, token, file.path, file.name);
      console.log(`✅ ${file.name} subido exitosamente.`);
    } catch (uploadErr) {
      console.error(`⚠️ Error al subir ${file.name}:`, uploadErr.message);
    }
  }

  console.log('\n========================================================');
  console.log(`🎉 ¡RELEASE v${VERSION} PUBLICADA EXITOSAMENTE EN GITHUB!`);
  console.log(`🔗 https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/${TAG}`);
  console.log('========================================================');
}

main().catch(console.error);
