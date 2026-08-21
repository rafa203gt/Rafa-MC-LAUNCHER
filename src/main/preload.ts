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
  getInstalledMods: () => ipcRenderer.invoke('modpack:installed-mods'),
  openFolder: (type: 'instance' | 'mods' | 'logs' | 'runtime') => ipcRenderer.invoke('system:open-folder', type),

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
