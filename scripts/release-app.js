import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawn, execSync } from 'node:child_process';

const REPO_OWNER = 'rafa203gt';
const REPO_NAME = 'Rafa-MC-LAUNCHER';

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
          'Content-Type': 'application/octet-stream',
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
            reject(new Error(`Error subiendo ${fileName}: HTTP ${res.statusCode} - ${body}`));
          }
        });
      }
    );
    req.on('error', reject);
    fileStream.pipe(req);
  });
}

async function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    console.log(`> ${cmd} ${args.join(' ')}`);
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${cmd} exited with code ${code}`));
    });
  });
}

function getRecentChanges() {
  try {
    const rawCommits = execSync('git log -n 5 --pretty=format:"- %s (%h)"', { encoding: 'utf8' });
    return rawCommits.trim();
  } catch {
    return '- Mejoras y optimizaciones generales del launcher.';
  }
}

async function main() {
  console.log('========================================================');
  console.log('🚀 PUBLICADOR DE NUEVA VERSIÓN DEL LAUNCHER (APP RELEASE)');
  console.log('========================================================\n');

  // 1. Leer versión actual
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;

  // Calcular nueva versión (ej: 1.0.13 -> 1.0.14)
  const parts = currentVersion.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  const newVersion = parts.join('.');

  console.log(`📦 Versión actual: v${currentVersion} ➔ Nueva versión: v${newVersion}`);

  // Actualizar package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // 2. Compilar binarios de Windows
  console.log('\n🔨 Compilando nueva versión de la aplicación...');
  await runCmd('npm', ['run', 'build']);
  await runCmd('npx', ['electron-builder', '--win']);

  const releaseDir = path.join(process.cwd(), 'release');
  const installerName = `Rafa-MC-LAUNCHER Setup ${newVersion}.exe`;
  const portableName = `Rafa-MC-LAUNCHER ${newVersion}.exe`;

  const filesToUpload = [
    { path: path.join(releaseDir, `Rafa-MC-LAUNCHER Setup ${newVersion}.exe`), name: installerName },
    { path: path.join(releaseDir, `Rafa-MC-LAUNCHER ${newVersion}.exe`), name: portableName }
  ].filter((f) => fs.existsSync(f.path));

  // Fallback si electron-builder usó nombres genéricos
  if (filesToUpload.length === 0) {
    for (const f of fs.readdirSync(releaseDir)) {
      if (f.endsWith('.exe')) {
        filesToUpload.push({ path: path.join(releaseDir, f), name: f });
      }
    }
  }

  // 3. Autenticar en GitHub
  console.log('\n🔑 Obteniendo credenciales de GitHub...');
  const token = await getGitHubToken();
  if (!token) {
    console.error('❌ Token no encontrado');
    process.exit(1);
  }

  // 4. Crear Release en GitHub con descripción detallada
  const tag = `v${newVersion}`;
  console.log(`\n🚀 Creando GitHub Release ${tag}...`);

  const recentCommits = getRecentChanges();

  const releaseDescription = `## 🚀 Rafa MC Launcher ${tag}

### ✨ Novedades y Mejoras en esta Versión:
- 🛠️ **Actualizador del Instalador de Windows (Setup.exe):** Soporte de elevación de permisos UAC mediante \`ShellExecuteExW\` y liberación forzada de procesos antiguos para una instalación limpia e interactiva.
- ⚡ **Descarga Ultra-Rápida de Actualizaciones:** Motor de streaming directo con Axios y buffer de 8 MB con medidor de velocidad (\`MB/s\`) y tamaño transferido en vivo.
- 🎮 **Hero Launch Station & Selector Rápido:** Cambio de instancias de juego (ATM 10, Vanilla, etc.) directamente desde la pantalla principal sin salir de la pestaña.
- 🧰 **Hub de Herramientas Rápidas (Quick Tools):** Acceso directo en 1 clic a capturas de pantalla (\`screenshots\`), mundos (\`saves\`), mods, registros y reparación.
- ⛏️ **Instancias Vanilla Multi-Versión:** Descarga automatizada oficial desde Mojang para cualquier versión (1.21.4, 1.20.1, 1.16.5, etc.).
- 🛡️ **Limpieza Total de Copyright & Avisos Legales:** Uso exclusivo de iconografía vectorial propia y cláusula oficial de Mojang Studios / Microsoft.

### 📝 Registro de Cambios Recientes:
${recentCommits}

---
### 📦 Archivos Disponibles para Descarga:
1. 🎮 **Ejecutable Portable (Recomendado):** \`${portableName}\` (No requiere instalación, actualizable en 1 clic)
2. 📦 **Instalador de Windows:** \`${installerName}\` (Crea accesos directos en el menú inicio y escritorio)
`;

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
      tag_name: tag,
      name: `Rafa MC Launcher ${tag}`,
      body: releaseDescription,
      draft: false,
      prerelease: false
    })
  );

  if (createRes.statusCode !== 201 && createRes.statusCode !== 200) {
    console.error('❌ Error creando release:', createRes.data);
    process.exit(1);
  }

  const uploadUrl = createRes.data.upload_url;
  console.log(`✅ Release creada con descripción detallada. Subiendo instaladores...`);

  for (const file of filesToUpload) {
    console.log(`⬆️ Subiendo ${file.name}...`);
    await uploadAsset(uploadUrl, token, file.path, file.name);
    console.log(`✅ ${file.name} subido.`);
  }

  // 5. Git commit y tag
  console.log('\n📌 Haciendo commit y push del bump de versión...');
  await runCmd('git', ['commit', '-am', `"chore(release): bump version to ${newVersion}"`]);
  await runCmd('git', ['push', 'origin', 'main']);

  console.log('\n========================================================');
  console.log(`🎉 ¡ACTUALIZACIÓN v${newVersion} PUBLICADA CON ÉXITO!`);
  console.log('Todos los usuarios recibirán la notificación de actualización en su launcher.');
  console.log('========================================================');
}

main().catch(console.error);
