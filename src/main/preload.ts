import { contextBridge, ipcRenderer } from 'electron';

export const API = {
  // Game Actions
  launchGame: (options: { username: string; minRam?: number; maxRam?: number; autoConnect?: boolean }) =>
    ipcRenderer.invoke('launcher:launch', options),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),

  // Modpack & Server
  getServerStatus: () => ipcRenderer.invoke('server:status'),
  syncModpack: () => ipcRenderer.invoke('modpack:sync'),
  reinstallModpack: () => ipcRenderer.invoke('modpack:reinstall'),
  getInstalledMods: () => ipcRenderer.invoke('modpack:installed-mods'),
  openFolder: (type: 'instance' | 'mods' | 'logs' | 'runtime') => ipcRenderer.invoke('system:open-folder', type),

  // Instances Management
  getInstances: () => ipcRenderer.invoke('instances:list'),
  getActiveInstance: () => ipcRenderer.invoke('instances:active'),
  switchInstance: (instanceId: string) => ipcRenderer.invoke('instances:switch', instanceId),
  createInstance: (data: any) => ipcRenderer.invoke('instances:create', data),
  deleteInstance: (instanceId: string) => ipcRenderer.invoke('instances:delete', instanceId),

  // Remote Live Config & News (Supabase)
  getRemoteConfig: () => ipcRenderer.invoke('remote:config'),
  getNews: () => ipcRenderer.invoke('remote:news'),
  onRemoteConfig: (callback: (config: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('remote:config-updated', handler);
    return () => ipcRenderer.removeListener('remote:config-updated', handler);
  },
  onRemoteNews: (callback: (news: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('remote:news-updated', handler);
    return () => ipcRenderer.removeListener('remote:news-updated', handler);
  },

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // App Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadAppUpdate: (downloadUrl: string, fileName: string) =>
    ipcRenderer.invoke('updater:download', downloadUrl, fileName),
  onUpdateProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('updater:progress', handler);
    return () => ipcRenderer.removeListener('updater:progress', handler);
  },

  // Event Listeners
  onProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('launcher:progress', handler);
    return () => ipcRenderer.removeListener('launcher:progress', handler);
  },
  onLog: (callback: (log: string) => void) => {
    const handler = (_event: any, log: string) => callback(log);
    ipcRenderer.on('launcher:log', handler);
    return () => ipcRenderer.removeListener('launcher:log', handler);
  },
  onGameClosed: (callback: (code: number) => void) => {
    const handler = (_event: any, code: number) => callback(code);
    ipcRenderer.on('launcher:closed', handler);
    return () => ipcRenderer.removeListener('launcher:closed', handler);
  }
};

contextBridge.exposeInMainWorld('launcherAPI', API);
