import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';

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
  private cachedSettings: AppSettings | null = null;
  private cachedClientId: string | null = null;

  constructor() {
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
    this.baseDir = path.join(appData, '.rafa-mc-launcher');
    this.settingsFile = path.join(this.baseDir, 'settings.json');

    this.ensureDirs();
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  public getClientId(): string {
    if (this.cachedClientId) return this.cachedClientId;
    const idFile = path.join(this.baseDir, 'client-id.txt');
    try {
      if (fs.existsSync(idFile)) {
        const id = fs.readFileSync(idFile, 'utf-8').trim();
        if (id.length >= 6) {
          this.cachedClientId = id;
          return id;
        }
      }
    } catch {}

    const rawHost = (os.hostname() || 'pc').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newId = `${rawHost}-${crypto.randomUUID().slice(0, 8)}`;
    try {
      fs.writeFileSync(idFile, newId, 'utf-8');
    } catch {}
    this.cachedClientId = newId;
    return newId;
  }

  private activeInstanceFolder: string = 'default';

  public setActiveInstanceFolder(folder: string): void {
    this.activeInstanceFolder = folder;
  }

  public getInstanceDir(): string {
    const dir = path.join(this.baseDir, 'instances', this.activeInstanceFolder);
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

  private findDefaultConfigFile(): string | null {
    const possiblePaths = [
      path.join(process.cwd(), 'default-config.json'),
      process.resourcesPath ? path.join(process.resourcesPath, 'default-config.json') : '',
      process.resourcesPath ? path.join(process.resourcesPath, 'app', 'default-config.json') : '',
      process.resourcesPath ? path.join(process.resourcesPath, 'app.asar', 'default-config.json') : ''
    ].filter(Boolean);

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  private getDefaultConfig(): Partial<AppSettings> {
    try {
      const configFile = this.findDefaultConfigFile();
      if (configFile) {
        const raw = fs.readFileSync(configFile, 'utf-8');
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
      console.warn('Could not read default-config.json, using fallback defaults', e);
    }

    return {
      serverName: 'Rafa Server',
      serverIp: 'play.tuserver.com',
      serverPort: 25565,
      autoConnect: false,
      minecraftVersion: '1.21.1',
      modLoader: 'neoforge',
      modLoaderVersion: '21.1.247',
      modpackManifestUrl: 'https://raw.githubusercontent.com/rafa203gt/Rafa-MC-LAUNCHER/main/modpack/manifest.json',
      minRam: 4096,
      maxRam: 8192,
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
      minRam: 4096,
      maxRam: 8192,
      customJavaPath: '',
      autoJava: true,
      autoConnect: false,
      serverIp: 'play.tuserver.com',
      serverPort: 25565,
      serverName: 'Rafa Server',
      minecraftVersion: '1.21.1',
      modLoader: 'neoforge',
      modLoaderVersion: '21.1.247',
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
