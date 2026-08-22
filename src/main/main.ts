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
import { remoteConfigManager } from './remote-config';

// Global error handlers to prevent sudden crashes
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled promise rejection:', reason);
});

// Set process and application name for Task Manager and OS
app.setName('Rafa Launcher');

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
  const possibleIconPaths = [
    path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
    path.join(process.env.VITE_PUBLIC || '', 'favicon.ico'),
    path.join(appPath, 'build/icon.png'),
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../../build/icon.png')
  ];
  const appIcon = possibleIconPaths.find((p) => fs.existsSync(p)) || '';

  mainWindow = new BrowserWindow({
    title: 'Rafa Launcher',
    icon: appIcon || undefined,
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

app.whenReady().then(async () => {
  createWindow();

  // Auto-cleanup any older executable versions in user directory
  appUpdater.cleanupOldVersions();

  // Initialize Supabase Realtime live sync
  remoteConfigManager.initRealtime(() => mainWindow);

  // Safely register and track active user device
  try {
    const settings = configStore.getSettings();
    const activeInst = instanceManager.getActiveInstance();
    remoteConfigManager.trackUserActivity({
      playerUsername: settings.username || 'Jugador',
      lastInstancePlayed: activeInst?.name || 'All The Mods 10',
      isGameLaunch: false
    });
  } catch {}

  // Initialize System Tray for Extreme Performance Mode
  const { trayManager } = await import('./tray-manager');
  if (mainWindow) {
    trayManager.init(mainWindow);
  }

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

// 1. App Info & Settings
ipcMain.handle('app:version', () => {
  return app.getVersion();
});

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
  return instanceManager.syncRemoteInstances();
});

ipcMain.handle('instances:active', async () => {
  return instanceManager.getActiveInstance();
});

ipcMain.handle('instances:switch', async (_event, instanceId: string) => {
  const inst = instanceManager.setActiveInstance(instanceId);
  const { discordRPC } = await import('./discord-rpc');
  discordRPC.updateActivity({
    instanceName: inst.name,
    serverIp: inst.serverIp || configStore.getSettings().serverIp,
    isPlaying: false
  });
  return inst;
});

ipcMain.handle('instances:create', async (_event, data: any) => {
  return instanceManager.createInstance(data);
});

ipcMain.handle('instances:delete', async (_event, instanceId: string) => {
  return instanceManager.deleteInstance(instanceId);
});

// 4. Launcher execution with System Tray & Anti-Crash
ipcMain.handle('launcher:launch', async (_event, options) => {
  if (!mainWindow) return;

  const { discordRPC } = await import('./discord-rpc');
  const { trayManager } = await import('./tray-manager');
  const { crashAnalyzer } = await import('./crash-analyzer');

  const activeInst = instanceManager.getActiveInstance();
  const settings = configStore.getSettings();

  // Track game launch activity in Supabase
  remoteConfigManager.trackUserActivity({
    playerUsername: settings.username || options?.username || 'Jugador',
    lastInstancePlayed: activeInst?.name || 'All the Mods 10',
    isGameLaunch: true
  });

  discordRPC.updateActivity({
    instanceName: activeInst?.name || 'All the Mods 10',
    serverIp: activeInst?.serverIp || settings.serverIp,
    isPlaying: true,
    startTimestamp: Math.floor(Date.now() / 1000)
  });

  return minecraftLauncher.launch(
    options,
    (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('launcher:progress', progress);
      }

      // Extreme Performance Mode: Hide to system tray when game starts running
      if (progress.stage === 'running') {
        const behavior = (settings as any).launcherBehavior || 'tray';
        if (behavior === 'tray') {
          trayManager.hideToTray(`Jugando a ${activeInst?.name || 'Minecraft'}`);
        } else if (behavior === 'close') {
          app.quit();
        }
      }
    },
    (log) => {
      if (mainWindow) {
        mainWindow.webContents.send('launcher:log', log);
      }
    },
    async (code) => {
      // Restore window when game closes
      trayManager.restoreFromTray();

      discordRPC.updateActivity({
        instanceName: activeInst?.name || 'All the Mods 10',
        serverIp: activeInst?.serverIp || settings.serverIp,
        isPlaying: false
      });

      // Crash handling & post-mortem diagnosis
      if (code !== 0 && code !== null) {
        const diagnosis = crashAnalyzer.diagnose(configStore.getInstanceDir(), code);

        remoteConfigManager.reportCrash({
          username: options.username || 'Jugador',
          minecraftVersion: settings.minecraftVersion,
          launcherVersion: app.getVersion(),
          ramAllocated: options.maxRam || settings.maxRam,
          errorMessage: `[${diagnosis.type}] ${diagnosis.title}: ${diagnosis.description}`,
          crashLog: diagnosis.rawLogSnippet || diagnosis.description || ''
        });

        if (mainWindow) {
          mainWindow.webContents.send('launcher:crash-diagnosis', diagnosis);
        }
      }

      if (mainWindow) {
        mainWindow.webContents.send('launcher:closed', code);
      }
    }
  );
});

// Diagnostic IPC
ipcMain.handle('game:diagnose-crash', async () => {
  const { crashAnalyzer } = await import('./crash-analyzer');
  return crashAnalyzer.diagnose(configStore.getInstanceDir(), 1);
});

// 5. System & Folder Explorer
ipcMain.handle('system:open-folder', async (_event, type: 'instance' | 'mods' | 'logs' | 'runtime' | 'screenshots' | 'saves') => {
  const base = configStore.getBaseDir();
  let target = base;

  if (type === 'instance') {
    target = configStore.getInstanceDir();
  } else if (type === 'mods') {
    target = path.join(configStore.getInstanceDir(), 'mods');
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  } else if (type === 'screenshots') {
    target = path.join(configStore.getInstanceDir(), 'screenshots');
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  } else if (type === 'saves') {
    target = path.join(configStore.getInstanceDir(), 'saves');
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

// 7. Remote Live Config & News (Supabase)
ipcMain.handle('remote:config', async () => {
  return remoteConfigManager.fetchRemoteConfig();
});

ipcMain.handle('remote:news', async () => {
  return remoteConfigManager.fetchNews();
});

// 7. Shaders & Graphics Manager
ipcMain.handle('shaders:list', async (_event, instanceId?: string) => {
  const { shaderManager } = await import('./shader-manager');
  return shaderManager.getAvailableShaders(instanceId);
});

ipcMain.handle('shaders:download', async (_event, downloadUrl: string, fileName: string, instanceId?: string) => {
  const { shaderManager } = await import('./shader-manager');
  return shaderManager.downloadShader(downloadUrl, fileName, instanceId, (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('shaders:progress', { fileName, progress });
    }
  });
});

ipcMain.handle('shaders:delete', async (_event, fileName: string, instanceId?: string) => {
  const { shaderManager } = await import('./shader-manager');
  return shaderManager.deleteShader(fileName, instanceId);
});

ipcMain.handle('shaders:open-folder', async (_event, instanceId?: string) => {
  const { shaderManager } = await import('./shader-manager');
  shaderManager.openShaderFolder(instanceId);
  return true;
});

// 8. Discord Rich Presence
ipcMain.handle('discord-rpc:set-enabled', async (_event, enabled: boolean) => {
  const { discordRPC } = await import('./discord-rpc');
  discordRPC.setEnabled(enabled);
  return true;
});

// 9. Hardware & Performance Diagnostic
ipcMain.handle('hardware:get-info', async () => {
  const { hardwareDetector } = await import('./hardware-detector');
  return hardwareDetector.getHardwareInfo();
});

// 10. Window Controls
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

// 11. Custom Community Skins Management (Supabase & CustomSkinLoader)
ipcMain.handle('skins:get-user', async (_event, username: string) => {
  const { skinManager } = await import('./skin-manager');
  return skinManager.getUserSkin(username);
});

ipcMain.handle('skins:save-user', async (_event, data: any) => {
  const { skinManager } = await import('./skin-manager');
  return skinManager.saveUserSkin(data);
});

ipcMain.handle('skins:sync-community', async (_event, instanceDir?: string) => {
  const { skinManager } = await import('./skin-manager');
  const targetDir = instanceDir || configStore.getInstanceDir();
  return skinManager.syncCommunitySkinsToInstance(targetDir);
});

// 12. Microsoft / Mojang Authentication & Multi-Account Management
ipcMain.handle('auth:get-accounts', async () => {
  const { authManager } = await import('./auth-manager');
  return authManager.getAccounts();
});

ipcMain.handle('auth:get-active-account', async () => {
  const { authManager } = await import('./auth-manager');
  return authManager.getActiveAccount();
});

ipcMain.handle('auth:set-active-account', async (_event, accountId: string) => {
  const { authManager } = await import('./auth-manager');
  return authManager.setActiveAccount(accountId);
});

ipcMain.handle('auth:remove-account', async (_event, accountId: string) => {
  const { authManager } = await import('./auth-manager');
  return authManager.removeAccount(accountId);
});

ipcMain.handle('auth:add-offline-account', async (_event, username: string) => {
  const { authManager } = await import('./auth-manager');
  return authManager.addOfflineAccount(username);
});

ipcMain.handle('auth:login-microsoft', async () => {
  const { authManager } = await import('./auth-manager');
  return authManager.loginWithMicrosoft(mainWindow || undefined);
});

// Cosmetics & Shop System
ipcMain.handle('cosmetics:get-catalog', async () => {
  const { cosmeticsManager } = await import('./cosmetics-manager');
  return cosmeticsManager.getCatalog();
});

ipcMain.handle('cosmetics:get-inventory', async (_event, username: string) => {
  const { cosmeticsManager } = await import('./cosmetics-manager');
  return cosmeticsManager.getUserInventory(username);
});

ipcMain.handle('cosmetics:get-equipped', async (_event, username: string) => {
  const { cosmeticsManager } = await import('./cosmetics-manager');
  return cosmeticsManager.getUserEquipped(username);
});

ipcMain.handle('cosmetics:equip', async (_event, username: string, slot: 'cape' | 'wings' | 'hat' | 'bandana', cosmeticId: string | null, uuid?: string) => {
  const { cosmeticsManager } = await import('./cosmetics-manager');
  return cosmeticsManager.equipCosmetic(username, slot, cosmeticId, uuid);
});

ipcMain.handle('cosmetics:buy', async (_event, username: string, cosmeticId: string) => {
  const { cosmeticsManager } = await import('./cosmetics-manager');
  return cosmeticsManager.buyCosmetic(username, cosmeticId);
});

ipcMain.handle('cosmetics:get-economy', async (_event, username: string) => {
  const { cosmeticsManager } = await import('./cosmetics-manager');
  return cosmeticsManager.getUserEconomy(username);
});

ipcMain.handle('cosmetics:claim-daily', async (_event, username: string) => {
  const { cosmeticsManager } = await import('./cosmetics-manager');
  return cosmeticsManager.claimDailyCoins(username);
});



