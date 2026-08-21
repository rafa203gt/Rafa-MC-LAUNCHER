import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configStore } from './config-store';
import { javaManager } from './java-manager';
import { modSynchronizer } from './mod-sync';
import { serverPinger } from './server-pinger';
import { minecraftLauncher } from './launcher';
import { appUpdater } from './app-updater';
import { instanceManager } from './instance-manager';

// Global error handlers to prevent sudden crashes
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled promise rejection:', reason);
});

// Hardware Acceleration & High-Performance Flags
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appPath = app.getAppPath();
process.env.DIST = app.isPackaged ? path.join(appPath, 'dist') : path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let mainWindow: BrowserWindow | null = null;
const preload = path.join(__dirname, fs.existsSync(path.join(__dirname, 'preload.mjs')) ? 'preload.mjs' : 'preload.js');
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = path.join(process.env.DIST, 'index.html');

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Rafa-MC-LAUNCHER',
    icon: path.join(process.env.VITE_PUBLIC || '', 'favicon.ico'),
    width: 1150,
    height: 720,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#090a0f',
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (url) {
    mainWindow.loadURL(url);
  } else {
    mainWindow.loadFile(indexHtml);
  }

  // Make all external links open with the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC HANDLERS

// 1. Settings
ipcMain.handle('settings:get', async () => {
  return configStore.getSettings();
});

ipcMain.handle('settings:save', async (_event, newSettings) => {
  return configStore.saveSettings(newSettings);
});

// 2. Server Status
ipcMain.handle('server:status', async () => {
  const settings = configStore.getSettings();
  return serverPinger.pingServer(settings.serverIp, settings.serverPort);
});

ipcMain.handle('modpack:sync', async () => {
  const settings = configStore.getSettings();
  return modSynchronizer.syncModpack(settings.modpackManifestUrl, (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('launcher:progress', progress);
    }
  });
});

ipcMain.handle('modpack:reinstall', async () => {
  const settings = configStore.getSettings();
  return modSynchronizer.reinstallModpack(settings.modpackManifestUrl, (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('launcher:progress', progress);
    }
  });
});

ipcMain.handle('modpack:installed-mods', async () => {
  return modSynchronizer.getInstalledMods();
});

// 4. Instance Manager IPC Handlers
ipcMain.handle('instances:list', async () => {
  return instanceManager.getInstances();
});

ipcMain.handle('instances:active', async () => {
  return instanceManager.getActiveInstance();
});

ipcMain.handle('instances:switch', async (_event, instanceId: string) => {
  return instanceManager.setActiveInstance(instanceId);
});

ipcMain.handle('instances:create', async (_event, data: any) => {
  return instanceManager.createInstance(data);
});

ipcMain.handle('instances:delete', async (_event, instanceId: string) => {
  return instanceManager.deleteInstance(instanceId);
});

// 4. Launcher execution
ipcMain.handle('launcher:launch', async (_event, options) => {
  if (!mainWindow) return;

  return minecraftLauncher.launch(
    options,
    (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('launcher:progress', progress);
      }
    },
    (log) => {
      if (mainWindow) {
        mainWindow.webContents.send('launcher:log', log);
      }
    },
    (code) => {
      if (mainWindow) {
        mainWindow.webContents.send('launcher:closed', code);
      }
    }
  );
});

// 5. System & Folder Explorer
ipcMain.handle('system:open-folder', async (_event, type: 'instance' | 'mods' | 'logs' | 'runtime') => {
  const base = configStore.getBaseDir();
  let target = base;

  if (type === 'instance') {
    target = configStore.getInstanceDir();
  } else if (type === 'mods') {
    target = path.join(configStore.getInstanceDir(), 'mods');
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  } else if (type === 'logs') {
    target = path.join(configStore.getInstanceDir(), 'logs');
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  } else if (type === 'runtime') {
    target = configStore.getRuntimeDir();
  }

  shell.openPath(target);
  return true;
});

// 6. App Auto-Updater
ipcMain.handle('updater:check', async () => {
  return appUpdater.checkForUpdates();
});

ipcMain.handle('updater:download', async (_event, downloadUrl: string, fileName: string) => {
  return appUpdater.downloadAndApplyUpdate(downloadUrl, fileName, (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('updater:progress', progress);
    }
  });
});

// 7. Window Controls
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});
