import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';
import { spawn } from 'node:child_process';
import axios from 'axios';
import { createRequire } from 'node:module';
import { configStore, AppSettings } from './config-store';
import { javaManager, DownloadProgress } from './java-manager';
import { modSynchronizer } from './mod-sync';
import { ProgressTracker } from './progress-tracker';

const require = createRequire(import.meta.url);
const { Client, Authenticator } = require('minecraft-launcher-core');

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 128,
  maxFreeSockets: 64,
  timeout: 60000,
  family: 4,
  noDelay: true
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 128,
  maxFreeSockets: 64,
  timeout: 60000,
  family: 4,
  noDelay: true
});

export interface LaunchOptions {
  username: string;
  minRam?: number;
  maxRam?: number;
  autoConnect?: boolean;
}

export type LaunchStage = 'idle' | 'java' | 'mods' | 'assets' | 'starting' | 'running' | 'error';

export interface ProgressEventPayload {
  stage: LaunchStage;
  task: string;
  total: number;
  current: number;
  percent: number;
}

export class MinecraftLauncher {
  private launcher: any;
  private isLaunching = false;

  constructor() {
    this.launcher = new Client();
  }

  public getIsLaunching(): boolean {
    return this.isLaunching;
  }

  private getRequiredJavaVersion(mcVersion: string): number {
    const parts = mcVersion.split('.').map((p) => parseInt(p, 10));
    const major = parts[0] || 1;
    const minor = parts[1] || 20;
    const patch = parts[2] || 0;

    if (minor > 20 || (minor === 20 && patch >= 5)) {
      return 21; // 1.20.5+ and 1.21+ require Java 21
    } else if (minor >= 18) {
      return 17; // 1.18 - 1.20.4 require Java 17
    }
    return 8; // 1.16.5 and older
  }

  private async ensureNeoForgeVersionJson(
    instanceDir: string,
    mcVersion: string,
    neoForgeVersion = '21.1.247',
    javaPath?: string,
    onLog?: (line: string) => void,
    onProgress?: (payload: ProgressEventPayload) => void
  ): Promise<string> {
    const versionId = `neoforge-${neoForgeVersion}`;
    const versionDir = path.join(instanceDir, 'versions', versionId);
    const versionJsonPath = path.join(versionDir, `${versionId}.json`);
    const patchedClientJar = path.join(
      instanceDir,
      'libraries',
      'net',
      'neoforged',
      'neoforge',
      neoForgeVersion,
      `neoforge-${neoForgeVersion}-client.jar`
    );

    if (fs.existsSync(versionJsonPath) && fs.existsSync(patchedClientJar)) {
      return versionId;
    }

    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }

    if (onLog) {
      onLog(`[Launcher] Configurando binarios de NeoForge ${neoForgeVersion} y Minecraft ${mcVersion}...`);
    }

    // 1. Ensure launcher_profiles.json
    const profilesPath = path.join(instanceDir, 'launcher_profiles.json');
    if (!fs.existsSync(profilesPath)) {
      fs.writeFileSync(
        profilesPath,
        JSON.stringify(
          {
            profiles: {
              [mcVersion]: { name: mcVersion, lastVersionId: mcVersion }
            },
            clientToken: '88888888-8888-8888-8888-888888888888'
          },
          null,
          2
        ),
        'utf-8'
      );
    }

    // 2. Ensure vanilla version files
    const vanillaDir = path.join(instanceDir, 'versions', mcVersion);
    const vanillaJsonPath = path.join(vanillaDir, `${mcVersion}.json`);
    const vanillaJarPath = path.join(vanillaDir, `${mcVersion}.jar`);

    if (!fs.existsSync(vanillaJsonPath) || !fs.existsSync(vanillaJarPath)) {
      if (!fs.existsSync(vanillaDir)) fs.mkdirSync(vanillaDir, { recursive: true });
      if (onLog) onLog(`[Launcher] Descargando cliente base de Minecraft ${mcVersion}...`);

      const manifestRes = await axios.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', { timeout: 10000 });
      const vInfo = manifestRes.data.versions.find((v: any) => v.id === mcVersion);
      if (vInfo) {
        const vJsonRes = await axios.get(vInfo.url, { timeout: 10000 });
        fs.writeFileSync(vanillaJsonPath, JSON.stringify(vJsonRes.data, null, 2), 'utf-8');
        const clientUrl = vJsonRes.data.downloads.client.url;

        let tracker: ProgressTracker | null = null;
        await this.downloadFastStream(clientUrl, vanillaJarPath, (loaded, total) => {
          if (!tracker && total > 0) tracker = new ProgressTracker(total);
          if (onProgress && tracker) {
            const metrics = tracker.update(loaded);
            onProgress({
              stage: 'assets',
              task: `⚡ Descargando cliente Minecraft ${mcVersion}: ${metrics.loadedMB} / ${metrics.totalMB} MB — ${metrics.speedMBs} MB/s (${metrics.etaFormatted})`,
              total,
              current: loaded,
              percent: metrics.percent
            });
          }
        });
      }
    }

    // 3. Download and run installer if patched client jar or version json is missing
    if (!fs.existsSync(patchedClientJar) || !fs.existsSync(versionJsonPath)) {
      const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoForgeVersion}/neoforge-${neoForgeVersion}-installer.jar`;
      const tempInstaller = path.join(instanceDir, `installer-${neoForgeVersion}.jar`);

      if (!fs.existsSync(tempInstaller)) {
        if (onLog) onLog(`[Launcher] Descargando instalador de NeoForge ${neoForgeVersion}...`);

        let tracker: ProgressTracker | null = null;
        await this.downloadFastStream(installerUrl, tempInstaller, (loaded, total) => {
          if (!tracker && total > 0) tracker = new ProgressTracker(total);
          if (onProgress && tracker) {
            const metrics = tracker.update(loaded);
            onProgress({
              stage: 'assets',
              task: `⚡ Descargando instalador NeoForge ${neoForgeVersion}: ${metrics.loadedMB} / ${metrics.totalMB} MB — ${metrics.speedMBs} MB/s (${metrics.etaFormatted})`,
              total,
              current: loaded,
              percent: metrics.percent
            });
          }
        });
      }

      // Extraer directamente el archivo version.json del installer jar si hace falta
      if (!fs.existsSync(versionJsonPath) && fs.existsSync(tempInstaller)) {
        try {
          const AdmZip = (await import('adm-zip')).default;
          const zip = new AdmZip(tempInstaller);
          const versionEntry = zip.getEntry('version.json');
          if (versionEntry) {
            const versionContent = zip.readAsText(versionEntry);
            const parsed = JSON.parse(versionContent);
            parsed.id = versionId;
            if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });
            fs.writeFileSync(versionJsonPath, JSON.stringify(parsed, null, 2), 'utf-8');
            if (onLog) onLog(`[Launcher] Manifiesto ${versionId}.json generado correctamente.`);
          }
        } catch (err: any) {
          if (onLog) onLog(`[Launcher] Nota extrayendo version.json: ${err.message}`);
        }
      }

      // Si aún no existe el cliente parchado, ejecutar el installer oficial de NeoForge
      if (!fs.existsSync(patchedClientJar) && javaPath && fs.existsSync(javaPath) && fs.existsSync(tempInstaller)) {
        if (onLog) onLog(`[Launcher] Ejecutando parchador binario oficial de NeoForge...`);
        if (onProgress) {
          onProgress({
            stage: 'assets',
            task: `⚙️ Instalando librerías y cliente NeoForge (primer inicio)...`,
            total: 100,
            current: 75,
            percent: 75
          });
        }

        await new Promise<void>((resolve, reject) => {
          const proc = spawn(javaPath, ['-jar', tempInstaller, '--installClient', instanceDir], {
            stdio: 'ignore'
          });
          proc.on('close', (code: number | null) => {
            try {
              if (fs.existsSync(tempInstaller)) fs.unlinkSync(tempInstaller);
            } catch {}
            if (code === 0) resolve();
            else reject(new Error(`NeoForge installer finalizó con código: ${code}`));
          });
          proc.on('error', reject);
        });
      }

      // Limpieza final de temp installer si quedó
      try {
        if (fs.existsSync(tempInstaller)) fs.unlinkSync(tempInstaller);
      } catch {}
    }

    // Verificación final de seguridad: Si por alguna razón el archivo JSON no está en versionJsonPath, buscarlo en versions/
    if (!fs.existsSync(versionJsonPath)) {
      const versionsBase = path.join(instanceDir, 'versions');
      if (fs.existsSync(versionsBase)) {
        const found = fs.readdirSync(versionsBase).find((d) => d.includes(neoForgeVersion));
        if (found) {
          const candidate = path.join(versionsBase, found, `${found}.json`);
          if (fs.existsSync(candidate)) {
            if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });
            fs.copyFileSync(candidate, versionJsonPath);
          }
        }
      }
    }

    return versionId;
  }

  private downloadFastStream(
    url: string,
    dest: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const agent = url.startsWith('https') ? httpsAgent : httpAgent;

      client
        .get(url, { agent, headers: { 'User-Agent': 'Rafa-MC-Launcher' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return this.downloadFastStream(res.headers.location, dest, onProgress).then(resolve).catch(reject);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Error descargando recurso: HTTP ${res.statusCode}`));
          }

          const rawLen = res.headers['content-length'];
          const total = typeof rawLen === 'number' ? rawLen : parseInt(String(rawLen || '0'), 10);
          let loaded = 0;
          const file = fs.createWriteStream(dest, { highWaterMark: 4 * 1024 * 1024 });

          res.on('data', (chunk) => {
            loaded += chunk.length;
            if (onProgress) onProgress(loaded, total);
          });

          res.pipe(file);

          file.on('finish', () => {
            file.close(() => resolve());
          });

          file.on('error', (err) => {
            fs.unlink(dest, () => reject(err));
          });
        })
        .on('error', reject);
    });
  }

  private async ensureFabricVersionJson(
    instanceDir: string,
    mcVersion: string,
    loaderVersion = '0.15.11',
    onLog?: (line: string) => void
  ): Promise<void> {
    const versionsDir = path.join(instanceDir, 'versions', 'fabric');
    const versionJsonPath = path.join(versionsDir, 'fabric.json');

    if (fs.existsSync(versionJsonPath)) {
      return;
    }

    if (!fs.existsSync(versionsDir)) {
      fs.mkdirSync(versionsDir, { recursive: true });
    }

    if (onLog) {
      onLog(`[Launcher] Descargando perfil de Fabric Loader ${loaderVersion} para Minecraft ${mcVersion}...`);
    }

    const url = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Rafa-MC-Launcher' }
    });

    const profileJson = response.data;
    profileJson.id = 'fabric';

    fs.writeFileSync(versionJsonPath, JSON.stringify(profileJson, null, 2), 'utf-8');

    if (onLog) {
      onLog(`[Launcher] Perfil de Fabric guardado correctamente en ${versionJsonPath}`);
    }
  }

  public async launch(
    options: LaunchOptions,
    onProgress: (payload: ProgressEventPayload) => void,
    onLog: (line: string) => void,
    onClose: (code: number) => void
  ): Promise<void> {
    if (this.isLaunching) {
      throw new Error('El juego ya se está iniciando.');
    }

    this.isLaunching = true;
    const settings = configStore.getSettings();
    const instanceDir = configStore.getInstanceDir();
    const mcVersion = settings.minecraftVersion || '1.21.1';
    const requiredJava = this.getRequiredJavaVersion(mcVersion);

    try {
      // 1. JAVA PHASE
      let javaPath: string;
      if (settings.autoJava || !settings.customJavaPath) {
        onProgress({
          stage: 'java',
          task: `Verificando entorno de Java ${requiredJava}...`,
          total: 100,
          current: 0,
          percent: 0
        });
        javaPath = await javaManager.ensureJava(requiredJava, (p) => {
          onProgress({
            stage: 'java',
            task: p.task,
            total: p.total,
            current: p.current,
            percent: p.percent
          });
        });
      } else {
        javaPath = settings.customJavaPath;
      }

      onLog(`[Launcher] Java ${requiredJava} seleccionado: ${javaPath}`);

      // 2. MODPACK SYNC PHASE
      if (settings.modpackManifestUrl) {
        onProgress({
          stage: 'mods',
          task: 'Comprobando sincronización del modpack...',
          total: 100,
          current: 0,
          percent: 0
        });

        await modSynchronizer.syncModpack(settings.modpackManifestUrl, (p) => {
          onProgress({
            stage: 'mods',
            task: p.task,
            total: p.total,
            current: p.current,
            percent: p.percent
          });
        });
      }

      // 3. MINECRAFT & MODLOADER PREPARATION
      onProgress({
        stage: 'assets',
        task: `Preparando descarga de Minecraft ${mcVersion} y dependencias...`,
        total: 100,
        current: 0,
        percent: 0
      });

      let customVersion: any = {
        number: mcVersion,
        type: 'release'
      };

      if (settings.modLoader === 'fabric') {
        await this.ensureFabricVersionJson(
          instanceDir,
          mcVersion,
          settings.modLoaderVersion || '0.15.11',
          onLog
        );
        customVersion = {
          number: mcVersion,
          type: 'release',
          custom: 'fabric'
        };
      } else if (settings.modLoader === 'neoforge') {
        const neoVer = settings.modLoaderVersion || '21.1.247';
        const versionId = await this.ensureNeoForgeVersionJson(instanceDir, mcVersion, neoVer, javaPath, onLog, onProgress);
        customVersion = {
          number: mcVersion,
          type: 'release',
          custom: versionId
        };
      }

      // Non-Premium offline authentication
      const cleanUsername = (options.username || settings.username || 'Jugador').trim();
      const auth = Authenticator.getAuth(cleanUsername);

      // Safe RAM Calculation: Prevent allocating more than physical memory & reserve at least 1.5GB for Windows/OS
      const totalSystemRamMB = Math.floor(os.totalmem() / 1024 / 1024);
      const safeMaxHostRamMB = Math.max(2048, totalSystemRamMB - 1536);
      const requestedMaxRam = options.maxRam || settings.maxRam || 8192;
      const finalMaxRam = Math.min(requestedMaxRam, safeMaxHostRamMB);
      const finalMinRam = Math.min(finalMaxRam, options.minRam || settings.minRam || 4096);

      const minMemory = `${finalMinRam}M`;
      const maxMemory = `${finalMaxRam}M`;
      onLog(`[Launcher] Memoria RAM asignada: Min=${minMemory}, Max=${maxMemory} (RAM total equipo: ${totalSystemRamMB}MB)`);

      // Dynamic JVM Module Arguments for NeoForge / Forge / Fabric
      const libDir = path.join(instanceDir, 'libraries');
      const separator = process.platform === 'win32' ? ';' : ':';

      let neoForgeJvmArgs: string[] = [];
      if (settings.modLoader === 'neoforge') {
        const neoVer = settings.modLoaderVersion || '21.1.247';
        const moduleJars = [
          path.join(libDir, 'cpw', 'mods', 'bootstraplauncher', '2.0.2', 'bootstraplauncher-2.0.2.jar'),
          path.join(libDir, 'cpw', 'mods', 'securejarhandler', '3.0.8', 'securejarhandler-3.0.8.jar'),
          path.join(libDir, 'org', 'ow2', 'asm', 'asm-commons', '9.10.1', 'asm-commons-9.10.1.jar'),
          path.join(libDir, 'org', 'ow2', 'asm', 'asm-util', '9.10.1', 'asm-util-9.10.1.jar'),
          path.join(libDir, 'org', 'ow2', 'asm', 'asm-analysis', '9.10.1', 'asm-analysis-9.10.1.jar'),
          path.join(libDir, 'org', 'ow2', 'asm', 'asm-tree', '9.10.1', 'asm-tree-9.10.1.jar'),
          path.join(libDir, 'org', 'ow2', 'asm', 'asm', '9.10.1', 'asm-9.10.1.jar'),
          path.join(libDir, 'net', 'neoforged', 'JarJarFileSystems', '0.4.1', 'JarJarFileSystems-0.4.1.jar')
        ].filter((f) => fs.existsSync(f));

        neoForgeJvmArgs = [
          '-Djava.net.preferIPv6Addresses=system',
          `-DignoreList=client-extra,${mcVersion}.jar,neoforge.jar,neoforge-${neoVer}.jar`,
          `-DlibraryDirectory=${libDir}`,
          '-Dneoforge.earlydisplay=false',
          '-Dfml.earlyprogresswindow=false',
          '-p',
          moduleJars.join(separator),
          '--add-modules',
          'ALL-MODULE-PATH'
        ];
      }

      // 6. Detección de Hardware y Optimización Inteligente de JVM y GPU
      const { JVMOptimizer } = await import('./jvm-optimizer');
      const { hardwareDetector } = await import('./hardware-detector');

      const hwInfo = await hardwareDetector.getHardwareInfo();
      onLog(`[Hardware] CPU: ${hwInfo.cpuModel} (${hwInfo.cpuCores} núcleos) | RAM Total: ${hwInfo.totalRamGb} GB (Libre: ${hwInfo.freeRamGb} GB)`);
      if (hwInfo.dedicatedGpu) {
        onLog(`[GPU] Aceleración de Alto Rendimiento activa en: ${hwInfo.dedicatedGpu}`);
      }

      // Inyectar variables de entorno de forzado de GPU dedicada
      const gpuEnv = hardwareDetector.getGpuForceEnv();
      Object.assign(process.env, gpuEnv);

      // Flags de Garbage Collection y Rendimiento según el perfil configurado
      const performanceGcArgs = JVMOptimizer.getOptimizedFlags(
        (settings as any).jvmProfile || 'auto',
        requiredJava,
        Number(maxMemory) || 4096,
        settings.jvmArgs || []
      );
      onLog(`[Optimizador] Perfil JVM aplicado: ${(settings as any).jvmProfile || 'auto'}`);

      // Flags obligatorios de acceso a módulos de Java 17/21 solo para NeoForge, Forge y Fabric
      const modLoaderModuleArgs =
        settings.modLoader !== 'vanilla'
          ? [
              ...neoForgeJvmArgs,
              '--add-opens=java.base/java.lang.invoke=cpw.mods.securejarhandler,ALL-UNNAMED',
              '--add-opens=java.base/java.util.jar=cpw.mods.securejarhandler,ALL-UNNAMED',
              '--add-opens=java.base/java.lang=ALL-UNNAMED',
              '--add-opens=java.base/java.util=ALL-UNNAMED',
              '--add-opens=java.base/java.nio.file=ALL-UNNAMED',
              '--add-opens=java.base/sun.security.util=cpw.mods.securejarhandler,ALL-UNNAMED',
              '--add-opens=java.base/sun.security.x509=ALL-UNNAMED',
              '--add-opens=java.base/sun.nio.ch=ALL-UNNAMED',
              '--add-exports=java.base/sun.security.util=cpw.mods.securejarhandler,ALL-UNNAMED',
              '--add-exports=jdk.naming.dns/com.sun.jndi.dns=java.naming'
            ]
          : [];

      // JVM Arguments (solo flags para Java VM)
      const customArgs: string[] = [
        ...performanceGcArgs,
        ...modLoaderModuleArgs,
        ...(settings.jvmArgs || [])
      ];

      // Quick-play / Direct connect (Argumento nativo de juego de Minecraft)
      const shouldAutoConnect = options.autoConnect ?? settings.autoConnect;
      let quickPlayOption: any = null;
      if (shouldAutoConnect && settings.serverIp) {
        quickPlayOption = {
          type: 'multiplayer',
          identifier: `${settings.serverIp}:${settings.serverPort || 25565}`
        };
        onLog(`[Launcher] Auto-conexión habilitada a ${settings.serverIp}:${settings.serverPort || 25565}`);
      }

      const launchOptions: any = {
        clientPackage: null,
        authorization: auth,
        root: instanceDir,
        javaPath: javaPath,
        version: customVersion,
        memory: {
          min: minMemory,
          max: maxMemory
        },
        window: {
          fullscreen: settings.fullscreen,
          width: settings.width || 1280,
          height: settings.height || 720
        },
        customArgs: customArgs,
        quickPlay: quickPlayOption
      };

      const launcher = new Client();
      this.launcher = launcher;

      // Hook MCLC events
      launcher.on('debug', (e: string) => {
        onLog(`[DEBUG] ${e}`);
        if (e.includes('Attempting to download assets')) {
          onProgress({
            stage: 'assets',
            task: 'Verificando librerías y recursos de Minecraft...',
            total: 100,
            current: 85,
            percent: 85
          });
        } else if (e.includes('Launching with arguments')) {
          onProgress({
            stage: 'starting',
            task: '🚀 Iniciando Java y cargando motor NeoForge...',
            total: 100,
            current: 92,
            percent: 92
          });
        }
      });

      launcher.on('data', (e: string) => {
        onLog(`[MINECRAFT] ${e}`);
        if (e.includes('MODLAUNCHER') || e.includes('ModLauncher')) {
          onProgress({
            stage: 'running',
            task: '⚡ Cargando mods de All The Mods 10 en memoria...',
            total: 100,
            current: 96,
            percent: 96
          });
        } else if (e.includes('ModDiscoverer') || e.includes('Found mod file')) {
          onProgress({
            stage: 'running',
            task: '⚡ Registrando 479 mods...',
            total: 100,
            current: 98,
            percent: 98
          });
        } else if (e.includes('ImmediateWindowHandler') || e.includes('EARLYDISPLAY') || e.includes('OpenGL')) {
          onProgress({
            stage: 'running',
            task: '🎮 ¡Minecraft 1.21.1 iniciado! Abriendo ventana...',
            total: 100,
            current: 100,
            percent: 100
          });
        }
      });

      launcher.on('progress', (e: any) => {
        const total = e.total || 100;
        const current = e.task || 0;
        const percent = Math.min(100, Math.round((current / total) * 100));
        onProgress({
          stage: 'assets',
          task: `Descargando assets y dependencias (${e.type || 'core'}): ${percent}%`,
          total,
          current,
          percent
        });
      });

      launcher.on('download-status', (e: any) => {
        if (e.total && e.current) {
          const percent = Math.round((e.current / e.total) * 100);
          onProgress({
            stage: 'assets',
            task: `Descargando archivos: ${e.name || ''} (${percent}%)`,
            total: e.total,
            current: e.current,
            percent
          });
        }
      });

      launcher.on('close', (code: number) => {
        this.isLaunching = false;
        onLog(`[Launcher] Minecraft cerrado con código de salida: ${code}`);
        onProgress({
          stage: 'idle',
          task: 'Listo para jugar',
          total: 100,
          current: 100,
          percent: 100
        });
        onClose(code);
      });

      onProgress({
        stage: 'starting',
        task: 'Iniciando Minecraft...',
        total: 100,
        current: 90,
        percent: 90
      });

      onLog(`[Launcher] Lanzando Minecraft ${mcVersion} (${settings.modLoader}) para ${cleanUsername} con RAM: ${minMemory} - ${maxMemory}`);

      await launcher.launch(launchOptions);

      onProgress({
        stage: 'running',
        task: 'Minecraft en ejecución',
        total: 100,
        current: 100,
        percent: 100
      });
    } catch (err: any) {
      this.isLaunching = false;
      onLog(`[ERROR] ${err.message || err}`);
      onProgress({
        stage: 'error',
        task: `Error al iniciar: ${err.message || err}`,
        total: 100,
        current: 0,
        percent: 0
      });
      throw err;
    }
  }
}

export const minecraftLauncher = new MinecraftLauncher();
