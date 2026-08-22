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
  discordRpc?: boolean;
  jvmProfile?: 'auto' | 'zgc_turbo' | 'zgc' | 'aikar' | 'low_end' | 'custom';
  launcherBehavior?: 'tray' | 'keep' | 'close';
}

export interface CrashDiagnosis {
  exitCode: number;
  type: 'out_of_memory' | 'graphics_driver' | 'corrupt_mod' | 'java_version' | 'generic';
  title: string;
  description: string;
  culpritFile?: string;
  recommendedAction: 'increase_ram' | 'force_gpu' | 'reinstall_modpack' | 'repair_java' | 'view_logs';
  actionButtonText: string;
  rawLogSnippet: string;
  timestamp: string;
}

export interface SystemHardwareInfo {
  cpuModel: string;
  cpuCores: number;
  cpuSpeedMhz: number;
  totalRamGb: number;
  freeRamGb: number;
  gpus: string[];
  dedicatedGpu?: string;
  isHighEnd: boolean;
  osPlatform: string;
  osRelease: string;
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

export interface AppUpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  fileName?: string;
}

export interface UpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  speed?: string;
  speedBytes?: number;
}

export interface MinecraftInstance {
  id: string;
  name: string;
  description: string;
  minecraftVersion: string;
  modLoader: 'fabric' | 'forge' | 'neoforge' | 'vanilla';
  modLoaderVersion: string;
  modpackManifestUrl: string;
  bannerUrl?: string;
  icon?: string;
  author?: string;
  customRam?: number;
  serverIp?: string;
  serverPort?: number;
  totalMods?: number;
  isDefault?: boolean;
  isActive?: boolean;
  isLocalOnly?: boolean;
  createdAt: string;
  lastPlayed?: string;
}

export interface RemoteLauncherConfig {
  id: string;
  server_name: string;
  server_ip: string;
  server_port: number;
  auto_connect: boolean;
  minecraft_version: string;
  mod_loader: string;
  mod_loader_version: string;
  modpack_manifest_url: string;
  news_feed_url: string;
  maintenance_mode: boolean;
  maintenance_message: string;
  banner_alert: string | null;
  banner_alert_type: 'info' | 'warning' | 'error' | 'success';
  discord_url: string;
  min_launcher_version: string;
}

export interface NewsAnnouncement {
  id: string;
  title: string;
  content: string;
  category: 'update' | 'event' | 'server' | 'maintenance';
  image_url?: string;
  pinned: boolean;
  is_active: boolean;
  created_at: string;
}

export interface LauncherAPI {
  launchGame: (options: { username: string; minRam?: number; maxRam?: number; autoConnect?: boolean }) => Promise<void>;
  getAppVersion?: () => Promise<string>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  getServerStatus: () => Promise<ServerStatusResult>;
  syncModpack: () => Promise<{ synced: number; deleted: number; total: number }>;
  reinstallModpack: () => Promise<{ synced: number; deleted: number; total: number }>;
  getInstalledMods: () => Promise<InstalledMod[]>;
  openFolder: (type: 'instance' | 'mods' | 'logs' | 'runtime' | 'screenshots' | 'saves') => Promise<boolean>;
  getInstances: () => Promise<MinecraftInstance[]>;
  getActiveInstance: () => Promise<MinecraftInstance>;
  switchInstance: (instanceId: string) => Promise<MinecraftInstance>;
  createInstance: (data: Partial<MinecraftInstance>) => Promise<MinecraftInstance>;
  deleteInstance: (instanceId: string) => Promise<boolean>;
  getRemoteConfig: () => Promise<RemoteLauncherConfig | null>;
  getNews: () => Promise<NewsAnnouncement[]>;
  onRemoteConfig: (callback: (config: RemoteLauncherConfig) => void) => () => void;
  onRemoteNews: (callback: (news: NewsAnnouncement[]) => void) => () => void;
  checkForUpdates: () => Promise<AppUpdateInfo>;
  downloadAppUpdate: (downloadUrl: string, fileName: string) => Promise<void>;
  onUpdateProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void;
  getHardwareInfo?: () => Promise<SystemHardwareInfo>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  onProgress: (callback: (data: ProgressEventPayload) => void) => () => void;
  onLog: (callback: (log: string) => void) => () => void;
  onGameClosed: (callback: (code: number) => void) => () => void;
  diagnoseLastCrash?: () => Promise<CrashDiagnosis>;
  onCrashDiagnosis?: (callback: (data: CrashDiagnosis) => void) => () => void;
}

declare global {
  interface Window {
    launcherAPI: LauncherAPI;
  }
}
