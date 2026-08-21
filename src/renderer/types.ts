export interface AppSettings {
  username: string;
  minRam: number;
  maxRam: number;
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

export interface ServerStatusResult {
  online: boolean;
  ip: string;
  port: number;
  latency?: number;
  players?: {
    online: number;
    max: number;
    sample?: { name: string; id: string }[];
  };
  motd?: {
    clean: string;
    raw?: any;
  };
  version?: string;
  favicon?: string;
  lastUpdated: number;
}

export interface ProgressEventPayload {
  stage: 'idle' | 'java' | 'mods' | 'assets' | 'starting' | 'running' | 'error';
  task: string;
  total: number;
  current: number;
  percent: number;
}

export interface InstalledMod {
  name: string;
  size: number;
  modified: string;
}

export interface LauncherAPI {
  launchGame: (options: { username: string; minRam?: number; maxRam?: number; autoConnect?: boolean }) => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  getServerStatus: () => Promise<ServerStatusResult>;
  syncModpack: () => Promise<{ synced: number; deleted: number; total: number }>;
  getInstalledMods: () => Promise<InstalledMod[]>;
  openFolder: (type: 'instance' | 'mods' | 'logs' | 'runtime') => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  onProgress: (callback: (data: ProgressEventPayload) => void) => () => void;
  onLog: (callback: (log: string) => void) => () => void;
  onGameClosed: (callback: (code: number) => void) => () => void;
}

declare global {
  interface Window {
    launcherAPI: LauncherAPI;
  }
}
