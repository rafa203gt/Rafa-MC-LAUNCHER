import path from 'node:path';
import fs from 'node:fs';
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

    try {
      // 1. JAVA PHASE
      let javaPath: string;
      if (settings.autoJava || !settings.customJavaPath) {
        onProgress({
          stage: 'java',
          task: 'Verificando entorno de Java 17...',
          total: 100,
          current: 0,
          percent: 0
        });
        javaPath = await javaManager.ensureJava((p) => {
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

      onLog(`[Launcher] Java 17 seleccionado: ${javaPath}`);

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

      // 3. MINECRAFT ASSETS & LIBRARIES DOWNLOAD (MCLC)
      onProgress({
        stage: 'assets',
        task: 'Preparando descarga de Minecraft 1.20.1 y librerías...',
        total: 100,
        current: 0,
        percent: 0
      });

      // Non-Premium offline authentication
      const cleanUsername = (options.username || settings.username || 'Jugador').trim();
      const auth = Authenticator.getAuth(cleanUsername);

      const minMemory = `${options.minRam || settings.minRam || 2048}M`;
      const maxMemory = `${options.maxRam || settings.maxRam || 4096}M`;

      // Quick-play / Direct connect arguments
      const customArgs: string[] = [...(settings.jvmArgs || [])];
      const shouldAutoConnect = options.autoConnect ?? settings.autoConnect;
      if (shouldAutoConnect && settings.serverIp) {
        customArgs.push('--quickPlayMultiplayer', `${settings.serverIp}:${settings.serverPort || 25565}`);
        onLog(`[Launcher] Auto-conexión habilitada a ${settings.serverIp}:${settings.serverPort || 25565}`);
      }

      let customVersion: any = {
        number: settings.minecraftVersion || '1.20.1',
        type: 'release'
      };

      if (settings.modLoader === 'fabric') {
        customVersion = {
          number: settings.minecraftVersion || '1.20.1',
          type: 'release',
          custom: 'fabric'
        };
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
        customArgs: customArgs
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

      onLog(`[Launcher] Lanzando Minecraft ${settings.minecraftVersion} para ${cleanUsername} con RAM: ${minMemory} - ${maxMemory}`);

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
