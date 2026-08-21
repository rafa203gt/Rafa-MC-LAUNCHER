import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import axios from 'axios';
import { createRequire } from 'node:module';
import { configStore, AppSettings } from './config-store';
import { javaManager, DownloadProgress } from './java-manager';
import { modSynchronizer } from './mod-sync';

const require = createRequire(import.meta.url);
const { Client, Authenticator } = require('minecraft-launcher-core');

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
    onLog?: (line: string) => void
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

      const manifestRes = await axios.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      const vInfo = manifestRes.data.versions.find((v: any) => v.id === mcVersion);
      if (vInfo) {
        const vJsonRes = await axios.get(vInfo.url);
        fs.writeFileSync(vanillaJsonPath, JSON.stringify(vJsonRes.data, null, 2), 'utf-8');
        const clientUrl = vJsonRes.data.downloads.client.url;
        const clientRes = await axios.get(clientUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(vanillaJarPath, Buffer.from(clientRes.data));
      }
    }

    // 3. Download and run installer if patched client jar is not ready
    if (!fs.existsSync(patchedClientJar)) {
      const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoForgeVersion}/neoforge-${neoForgeVersion}-installer.jar`;
      const tempInstaller = path.join(instanceDir, `installer-${neoForgeVersion}.jar`);

      if (onLog) onLog(`[Launcher] Descargando instalador de NeoForge ${neoForgeVersion}...`);
      const installerRes = await axios.get(installerUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(tempInstaller, Buffer.from(installerRes.data));

      if (javaPath && fs.existsSync(javaPath)) {
        if (onLog) onLog(`[Launcher] Ejecutando parchador binario oficial de NeoForge...`);
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(javaPath, ['-jar', tempInstaller, '--installClient', instanceDir], {
            stdio: 'ignore'
          });
          proc.on('close', (code: number | null) => {
            try {
              fs.unlinkSync(tempInstaller);
            } catch {}
            if (code === 0) resolve();
            else reject(new Error(`NeoForge installer falló con código: ${code}`));
          });
          proc.on('error', reject);
        });
      }
    }

    return versionId;
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
        const versionId = await this.ensureNeoForgeVersionJson(instanceDir, mcVersion, neoVer, javaPath, onLog);
        customVersion = {
          number: mcVersion,
          type: 'release',
          custom: versionId
        };
      }

      // Non-Premium offline authentication
      const cleanUsername = (options.username || settings.username || 'Jugador').trim();
      const auth = Authenticator.getAuth(cleanUsername);

      const minMemory = `${options.minRam || settings.minRam || 4096}M`;
      const maxMemory = `${options.maxRam || settings.maxRam || 8192}M`;

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

      // Flags obligatorios de acceso a módulos de Java 17/21 para NeoForge, Forge y Fabric
      const javaModuleArgs = [
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
      ];

      // JVM Arguments (solo flags para Java VM)
      const customArgs: string[] = [
        ...javaModuleArgs,
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

      // Hook MCLC events
      this.launcher.on('debug', (e: string) => {
        onLog(`[DEBUG] ${e}`);
      });

      this.launcher.on('data', (e: string) => {
        onLog(`[MINECRAFT] ${e}`);
      });

      this.launcher.on('progress', (e: any) => {
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

      this.launcher.on('download-status', (e: any) => {
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

      this.launcher.on('close', (code: number) => {
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
        current: 100,
        percent: 100
      });

      onLog(`[Launcher] Lanzando Minecraft ${mcVersion} (${settings.modLoader}) para ${cleanUsername} con RAM: ${minMemory} - ${maxMemory}`);

      await this.launcher.launch(launchOptions);

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
