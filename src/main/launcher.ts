import path from 'node:path';
import fs from 'node:fs';
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
    onLog?: (line: string) => void
  ): Promise<void> {
    const versionsDir = path.join(instanceDir, 'versions', 'neoforge');
    const versionJsonPath = path.join(versionsDir, 'neoforge.json');

    if (fs.existsSync(versionJsonPath)) {
      return;
    }

    if (!fs.existsSync(versionsDir)) {
      fs.mkdirSync(versionsDir, { recursive: true });
    }

    // 1. Try reading from minecraftinstance.json if extracted from modpack
    const instanceMetaPath = path.join(instanceDir, 'minecraftinstance.json');
    if (fs.existsSync(instanceMetaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(instanceMetaPath, 'utf-8'));
        if (meta.baseModLoader?.versionJson) {
          const parsed = JSON.parse(meta.baseModLoader.versionJson);
          parsed.id = 'neoforge';
          fs.writeFileSync(versionJsonPath, JSON.stringify(parsed, null, 2), 'utf-8');
          if (onLog) {
            onLog(`[Launcher] Perfil NeoForge generado desde el modpack instalado.`);
          }
          return;
        }
      } catch (err) {
        console.warn('Could not parse minecraftinstance.json versionJson', err);
      }
    }

    if (onLog) {
      onLog(`[Launcher] Generando perfil base de NeoForge para Minecraft ${mcVersion}...`);
    }
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
        await this.ensureNeoForgeVersionJson(instanceDir, mcVersion, onLog);
        customVersion = {
          number: mcVersion,
          type: 'release',
          custom: 'neoforge'
        };
      }

      // Non-Premium offline authentication
      const cleanUsername = (options.username || settings.username || 'Jugador').trim();
      const auth = Authenticator.getAuth(cleanUsername);

      const minMemory = `${options.minRam || settings.minRam || 4096}M`;
      const maxMemory = `${options.maxRam || settings.maxRam || 8192}M`;

      // JVM Arguments (solo flags para Java VM)
      const customArgs: string[] = [...(settings.jvmArgs || [])];

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
