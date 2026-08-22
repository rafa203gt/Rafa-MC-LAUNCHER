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

export interface UserAccount {
  id: string;
  type: 'microsoft' | 'offline';
  username: string;
  uuid: string;
  skinUrl?: string;
  capeUrl?: string;
  skinModel?: 'default' | 'slim';
  hasGameOwnership: boolean;
  active: boolean;
  addedAt: string;
}

export interface DeviceCodeInfo {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
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
  getUserSkin?: (username: string) => Promise<{ username: string; skinUrl: string; skinData?: string; model: 'default' | 'slim'; capeUrl?: string | null } | null>;
  saveUserSkin?: (data: { username: string; skinUrl: string; skinData?: string; model?: 'default' | 'slim'; capeUrl?: string | null }) => Promise<{ success: boolean; message?: string }>;
  syncCommunitySkins?: (instanceDir?: string) => Promise<number>;

  // Microsoft / Mojang Auth & Multi-Account
  getAccounts?: () => Promise<UserAccount[]>;
  getActiveAccount?: () => Promise<UserAccount | null>;
  setActiveAccount?: (accountId: string) => Promise<boolean>;
  removeAccount?: (accountId: string) => Promise<boolean>;
  addOfflineAccount?: (username: string) => Promise<UserAccount>;
  loginMicrosoft?: () => Promise<UserAccount>;

  // Cosmetics & Shop System
  getCosmeticsCatalog?: () => Promise<ShopCosmetic[]>;
  getUserCosmeticsInventory?: (username: string) => Promise<string[]>;
  getUserEquippedCosmetics?: (username: string) => Promise<UserEquippedCosmetics>;
  equipCosmetic?: (username: string, slot: 'cape' | 'wings' | 'hat' | 'bandana', cosmeticId: string | null, uuid?: string) => Promise<UserEquippedCosmetics>;
  buyCosmetic?: (username: string, cosmeticId: string) => Promise<{ success: boolean; message: string; remainingCoins: number }>;
  getUserEconomy?: (username: string) => Promise<UserEconomy>;
  claimDailyCoins?: (username: string) => Promise<{ success: boolean; message: string; coinsAdded: number; newBalance: number }>;
}

export interface ShopCosmetic {
  id: string;
  name: string;
  description: string;
  category: 'cape' | 'wings' | 'hat' | 'bandana' | 'pet';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price: number;
  texture_url: string;
  model_type: string;
  is_animated: boolean;
  is_featured: boolean;
  is_active: boolean;
}

export interface UserEquippedCosmetics {
  username: string;
  uuid?: string;
  cape_id?: string | null;
  wings_id?: string | null;
  hat_id?: string | null;
  bandana_id?: string | null;
  updated_at?: string;
  cape?: ShopCosmetic | null;
  wings?: ShopCosmetic | null;
  hat?: ShopCosmetic | null;
  bandana?: ShopCosmetic | null;
}

export interface UserEconomy {
  username: string;
  coins: number;
  playtime_minutes: number;
  last_daily_reward: string;
  updated_at?: string;
}

declare global {
  interface Window {
    launcherAPI: LauncherAPI;
  }
}
