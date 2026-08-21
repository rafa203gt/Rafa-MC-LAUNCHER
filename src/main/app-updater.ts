import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';
import axios from 'axios';
import { ProgressTracker } from './progress-tracker';

const REPO_OWNER = 'rafa203gt';
const REPO_NAME = 'Rafa-MC-LAUNCHER';

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

export class AppUpdater {
  private isDownloading = false;

  public isRunningPortable(): boolean {
    if (process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR) {
      return true;
    }
    const execLower = process.execPath.toLowerCase();
    if (execLower.includes('\\temp\\') || execLower.includes('\\tmp\\')) {
      return true;
    }
    return false;
  }

  public getRealExecutablePath(): string {
    if (process.env.PORTABLE_EXECUTABLE_FILE && fs.existsSync(process.env.PORTABLE_EXECUTABLE_FILE)) {
      return process.env.PORTABLE_EXECUTABLE_FILE;
    }
    return process.execPath;
  }

  public getRealExecutableDir(): string {
    if (process.env.PORTABLE_EXECUTABLE_DIR && fs.existsSync(process.env.PORTABLE_EXECUTABLE_DIR)) {
      return process.env.PORTABLE_EXECUTABLE_DIR;
    }
    const execPath = this.getRealExecutablePath();
    return path.dirname(execPath);
  }

  public async checkForUpdates(): Promise<AppUpdateInfo> {
    const currentVersion = app.getVersion();

    try {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Rafa-MC-Launcher',
          Accept: 'application/vnd.github+json'
        },
        timeout: 8000
      });

      const release = res.data;
      if (!release || !release.tag_name) {
        return { hasUpdate: false, currentVersion, latestVersion: currentVersion };
      }

      const rawTag = release.tag_name.replace(/^v/, '').trim();
      const hasUpdate = this.compareVersions(rawTag, currentVersion) > 0;

      if (!hasUpdate) {
        return { hasUpdate: false, currentVersion, latestVersion: rawTag };
      }

      const isPortable = this.isRunningPortable();

      // If running portable, prefer portable exe. Otherwise prefer Setup installer
      let targetAsset: any = null;
      if (isPortable) {
        targetAsset = release.assets?.find(
          (a: any) => a.name.endsWith('.exe') && !a.name.toLowerCase().includes('setup')
        );
      } else {
        targetAsset = release.assets?.find(
          (a: any) => a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup')
        );
      }

      // Fallback
      if (!targetAsset) {
        targetAsset =
          release.assets?.find(
            (a: any) =>
              a.name.endsWith('.exe') && (a.name.includes('Setup') || a.name.includes('LAUNCHER'))
          ) || release.assets?.[0];
      }

      return {
        hasUpdate: true,
        currentVersion,
        latestVersion: rawTag,
        releaseName: release.name || `Versión ${rawTag}`,
        releaseNotes: release.body || 'Nuevas mejoras y correcciones del launcher.',
        downloadUrl: targetAsset?.browser_download_url,
        fileName: targetAsset?.name || `Rafa-MC-LAUNCHER-${rawTag}.exe`
      };
    } catch (err: any) {
      console.warn(`[AppUpdater] No se pudo verificar actualizaciones: ${err.message}`);
      return { hasUpdate: false, currentVersion, latestVersion: currentVersion };
    }
  }

  public async downloadAndApplyUpdate(
    downloadUrl: string,
    fileName: string,
    onProgress?: (progress: UpdateDownloadProgress) => void
  ): Promise<void> {
    if (this.isDownloading) {
      console.log('[AppUpdater] Ya hay una descarga en progreso.');
      return;
    }
    this.isDownloading = true;

    try {
      const realExecDir = this.getRealExecutableDir();
      const realExecPath = this.getRealExecutablePath();
      const isPortable = this.isRunningPortable();
      const isInstaller = fileName.toLowerCase().includes('setup') || !isPortable;

      console.log(`[AppUpdater] Iniciando descarga de actualización: ${downloadUrl}`);
      console.log(`[AppUpdater] Modo: ${isInstaller ? 'Instalador Setup' : 'Portable'}`);

      // Destination path
      const targetPath = isInstaller
        ? path.join(os.tmpdir(), `update_${Date.now()}_${fileName}`)
        : path.join(realExecDir, fileName);

      // Download file with live speed tracker
      await this.downloadHighSpeedStream(downloadUrl, targetPath, (loaded, total, speed, speedBytes) => {
        if (onProgress) {
          const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
          onProgress({ percent, transferred: loaded, total, speed, speedBytes });
        }
      });

      console.log(`[AppUpdater] Descarga completada en: ${targetPath}`);

      if (process.platform === 'win32') {
        if (isInstaller) {
          // Launch installer directly via Windows ShellExecute (guarantees UAC prompt & GUI)
          console.log(`[AppUpdater] Ejecutando instalador Setup: ${targetPath}`);
          await shell.openPath(targetPath);
        } else {
          // Launch new portable version and replace
          console.log(`[AppUpdater] Abriendo nueva versión portable: ${targetPath}`);
          await shell.openPath(targetPath);
        }
      } else {
        await shell.openPath(targetPath);
      }

      // Exit old launcher cleanly after launching the new version / installer
      setTimeout(() => {
        app.quit();
        setTimeout(() => app.exit(0), 400);
      }, 800);
    } catch (err: any) {
      this.isDownloading = false;
      console.error(`[AppUpdater] Error aplicando actualización: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ultra-Fast Streaming Downloader with 8MB write buffer and EMA progress calculation
   */
  private async downloadHighSpeedStream(
    url: string,
    dest: string,
    onProgress: (loaded: number, total: number, speed: string, speedBytes: number) => void
  ): Promise<void> {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Rafa-MC-Launcher',
        Accept: 'application/octet-stream, */*'
      },
      maxRedirects: 10,
      timeout: 60000
    });

    const rawLen = response.headers['content-length'];
    const totalBytes = typeof rawLen === 'number' ? rawLen : parseInt(String(rawLen || '0'), 10);
    let loadedBytes = 0;

    const tracker = new ProgressTracker(totalBytes);
    const writeStream = fs.createWriteStream(dest, { highWaterMark: 8 * 1024 * 1024 });

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        loadedBytes += chunk.length;
        const stats = tracker.update(loadedBytes);
        onProgress(loadedBytes, totalBytes, `${stats.speedMBs} MB/s`, loadedBytes);
      });

      response.data.pipe(writeStream);

      writeStream.on('finish', () => {
        writeStream.close(() => resolve());
      });

      writeStream.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });

      response.data.on('error', (err: any) => {
        fs.unlink(dest, () => reject(err));
      });
    });
  }

  private compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }
}

export const appUpdater = new AppUpdater();
