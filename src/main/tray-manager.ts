import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;

  public init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Create a 16x16 / 32x32 transparent or icon buffer for system tray
    const possiblePaths = [
      path.join(app.getAppPath(), 'public', 'favicon.ico'),
      path.join(app.getAppPath(), 'build', 'icon.ico'),
      path.join(app.getAppPath(), 'public', 'icon.png'),
      path.join(app.getAppPath(), 'build', 'icon.png')
    ];
    const iconPath = possiblePaths.find((p) => fs.existsSync(p)) || '';
    let trayIcon: Electron.NativeImage;

    if (iconPath) {
      trayIcon = nativeImage.createFromPath(iconPath);
    } else {
      // Fallback 16x16 bitmap icon
      trayIcon = nativeImage.createFromBuffer(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA7SURBVDhPY2AYBeMAMDYw/P//n5GBgRFdBq6A4f///4yMDAzUcwEmhrpBwB8ZgJ8dGIbQAYM3DB4yDAwAAO+vHwU1a/10AAAAAElFTkSuQmCC',
          'base64'
        )
      );
    }

    try {
      this.tray = new Tray(trayIcon);
      this.tray.setToolTip('Rafa Launcher');

      this.updateContextMenu('Listo para jugar');

      this.tray.on('double-click', () => {
        this.restoreFromTray();
      });
    } catch (err) {
      console.warn('[TrayManager] No se pudo inicializar System Tray:', err);
    }
  }

  public updateContextMenu(statusText: string): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      { label: `🟢 Rafa Launcher: ${statusText}`, enabled: false },
      { type: 'separator' },
      {
        label: 'Abrir Launcher',
        click: () => this.restoreFromTray()
      },
      {
        label: 'Salir',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  public hideToTray(statusText = 'Minecraft en ejecución...'): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.hide();
      this.updateContextMenu(statusText);
    }
  }

  public restoreFromTray(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.show();
      this.mainWindow.focus();
      this.updateContextMenu('Listo');
    }
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

export const trayManager = new TrayManager();
