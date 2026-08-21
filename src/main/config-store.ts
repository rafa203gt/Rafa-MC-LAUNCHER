import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export interface AppSettings {
  username: string;
  minRam: number; // in MB
  maxRam: number; // in MB
  customJavaPath: string;
  autoJava: boolean;
  autoConnect: boolean;
  serverIp: string;
  serverPort: number;
  serverName: string;
  minecraftVersion: string;
  modLoader: 'fabric' | 'forge' | 'neoforge' | 'vanilla';
  modLoaderVersion: string;
  modpackManifestUrl: string;
  fullscreen: boolean;
  width: number;
  height: number;
  jvmArgs: string[];
}

export class ConfigStore {
  private baseDir: string;
  private settingsFile: string;
  private defaultConfigFile: string;
  private cachedSettings: AppSettings | null = null;

  constructor() {
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
    this.baseDir = path.join(appData, '.rafa-mc-launcher');
    this.settingsFile = path.join(this.baseDir, 'settings.json');
    this.defaultConfigFile = path.join(process.cwd(), 'default-config.json');

    this.ensureDirs();
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  public getInstanceDir(): string {
    const dir = path.join(this.baseDir, 'instances', 'default');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public getRuntimeDir(): string {
    const dir = path.join(this.baseDir, 'runtime');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private ensureDirs(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    this.getInstanceDir();
    this.getRuntimeDir();
  }

  private getDefaultConfig(): Partial<AppSettings> {
    try {
      if (fs.existsSync(this.defaultConfigFile)) {
        const raw = fs.readFileSync(this.defaultConfigFile, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          serverName: parsed.serverName,
          serverIp: parsed.serverIp,
          serverPort: parsed.serverPort,
          autoConnect: parsed.autoConnect,
          minecraftVersion: parsed.minecraftVersion,
          modLoader: parsed.modLoader,
          modLoaderVersion: parsed.modLoaderVersion,
          modpackManifestUrl: parsed.modpackManifestUrl,
          minRam: parsed.client?.minRam || 2048,
          maxRam: parsed.client?.maxRam || 4096,
          autoJava: parsed.java?.autoDownload ?? true,
          fullscreen: parsed.client?.fullscreen ?? false,
          width: parsed.client?.width || 1280,
          height: parsed.client?.height || 720,
          jvmArgs: parsed.client?.jvmArgs || []
        };
      }
    } catch (e) {
      console.warn('Could not read default-config.json, using defaults', e);
    }

    return {
      serverName: 'Rafa Server',
      serverIp: 'play.tuserver.com',
      serverPort: 25565,
      autoConnect: true,
      minecraftVersion: '1.20.1',
      modLoader: 'fabric',
      modLoaderVersion: '0.15.11',
      modpackManifestUrl: 'https://raw.githubusercontent.com/rafa203gt/Rafa-MC-LAUNCHER/main/modpack/manifest.json',
      minRam: 2048,
      maxRam: 4096,
      autoJava: true,
      fullscreen: false,
      width: 1280,
      height: 720,
      jvmArgs: []
    };
  }

  public getSettings(): AppSettings {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    const defaults: AppSettings = {
      username: 'Jugador',
      minRam: 2048,
      maxRam: 4096,
      customJavaPath: '',
      autoJava: true,
      autoConnect: true,
      serverIp: 'play.tuserver.com',
      serverPort: 25565,
      serverName: 'Rafa Server',
      minecraftVersion: '1.20.1',
      modLoader: 'fabric',
      modLoaderVersion: '0.15.11',
      modpackManifestUrl: 'https://raw.githubusercontent.com/rafa203gt/Rafa-MC-LAUNCHER/main/modpack/manifest.json',
      fullscreen: false,
      width: 1280,
      height: 720,
      jvmArgs: [],
      ...this.getDefaultConfig()
    };

    if (fs.existsSync(this.settingsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.settingsFile, 'utf-8'));
        this.cachedSettings = { ...defaults, ...data };
        return this.cachedSettings!;
      } catch (e) {
        console.error('Error reading settings.json, returning defaults', e);
      }
    }

    this.cachedSettings = defaults;
    this.saveSettings(defaults);
    return defaults;
  }

  public saveSettings(newSettings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    fs.writeFileSync(this.settingsFile, JSON.stringify(updated, null, 2), 'utf-8');
    this.cachedSettings = updated;
    return updated;
  }
}

export const configStore = new ConfigStore();
