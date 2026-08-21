import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';
import { spawn } from 'node:child_process';
import axios from 'axios';
import { ProgressTracker } from './progress-tracker';

const REPO_OWNER = 'rafa203gt';
const REPO_NAME = 'Rafa-MC-LAUNCHER';

// Extreme performance network agent with TCP low-latency tuning
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 128,
  maxFreeSockets: 64,
  timeout: 60000,
  family: 4,
  noDelay: true
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 128,
  maxFreeSockets: 64,
  timeout: 60000,
  family: 4,
  noDelay: true
});

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
    // In electron-builder portable builds, PORTABLE_EXECUTABLE_FILE points to the real .exe file
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
    if (this.isDownloading) return;
    this.isDownloading = true;

    try {
      const tempDir = os.tmpdir();
      const targetDownloadedPath = path.join(
        tempDir,
        `update_${Date.now()}_${fileName || 'Rafa-Launcher-Update.exe'}`
      );

      console.log(`[AppUpdater] ⚡ Descargando actualización de alta velocidad: ${downloadUrl}`);

      // Fast, non-blocking stream download with 8MB buffer and EMA speed tracking
      await this.downloadHighSpeedStream(downloadUrl, targetDownloadedPath, (loaded, total, speed, speedBytes) => {
        if (onProgress) {
          const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
          onProgress({ percent, transferred: loaded, total, speed, speedBytes });
        }
      });

      const realExecPath = this.getRealExecutablePath();
      const realExecDir = this.getRealExecutableDir();
      const pid = process.pid;
      const isInstaller = fileName.toLowerCase().includes('setup') || !this.isRunningPortable();

      console.log(`[AppUpdater] Actualización descargada con éxito.`);
      console.log(`[AppUpdater] Tipo de ejecutable: ${isInstaller ? 'Instalador Setup' : 'Portable'}`);
      console.log(`[AppUpdater] Ruta ejecutable actual: ${realExecPath}`);
      console.log(`[AppUpdater] Directorio de destino: ${realExecDir}`);

      if (process.platform === 'win32') {
        const logFile = path.join(tempDir, 'rafa_updater.log');

        if (isInstaller) {
          // Launch NSIS Setup Installer with ShellExecute / UAC Elevation Support
          const psInstallerScript = `
            $log = '${logFile.replace(/'/g, "''")}';
            "Starting Setup Installer update at $(Get-Date)" | Out-File $log;
            
            $oldPid = ${pid};
            $installerPath = '${targetDownloadedPath.replace(/'/g, "''")}';
            
            "Terminating old launcher process $oldPid..." | Out-File $log -Append;
            try {
              Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue;
            } catch {}
            
            Start-Sleep -Milliseconds 800;
            
            "Executing Setup Installer via ShellExecute: $installerPath" | Out-File $log -Append;
            try {
              Start-Process -FilePath $installerPath -ErrorAction Stop;
              "Setup Installer launched successfully!" | Out-File $log -Append;
            } catch {
              "Error starting Setup Installer: $_" | Out-File $log -Append;
            }
          `.trim().replace(/\r?\n\s*/g, ' ');

          const helper = spawn(
            'powershell.exe',
            ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psInstallerScript],
            {
              detached: true,
              stdio: 'ignore',
              windowsHide: true
            }
          );
          helper.unref();
        } else {
          // Robust PowerShell Updater with process release and instant hot-swap for Portable
          const newFileNameInDir = path.join(realExecDir, fileName || 'Rafa-MC-LAUNCHER.exe');

          const psScript = `
            $log = '${logFile.replace(/'/g, "''")}';
            "Starting portable update hot-swap at $(Get-Date)" | Out-File $log;
            
            $oldPid = ${pid};
            $newExe = '${targetDownloadedPath.replace(/'/g, "''")}';
            $currExe = '${realExecPath.replace(/'/g, "''")}';
            $destNamedExe = '${newFileNameInDir.replace(/'/g, "''")}';
            
            "Terminating any lingering launcher processes..." | Out-File $log -Append;
            try {
              Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue;
            } catch {}
            
            Start-Sleep -Milliseconds 600;
            
            $copied = $false;
            for ($i = 0; $i -lt 30; $i++) {
              try {
                "Attempt $($i+1): Copying $newExe to $currExe" | Out-File $log -Append;
                Copy-Item -Path $newExe -Destination $currExe -Force -ErrorAction Stop;
                if ($currExe -ne $destNamedExe) {
                  Copy-Item -Path $newExe -Destination $destNamedExe -Force -ErrorAction SilentlyContinue;
                }
                $copied = $true;
                "Copy successful!" | Out-File $log -Append;
                break;
              } catch {
                "Copy locked ($($_)): retrying..." | Out-File $log -Append;
                Start-Sleep -Milliseconds 400;
              }
            }
            
            if ($copied) {
              "Starting updated executable: $currExe" | Out-File $log -Append;
              Start-Process -FilePath $currExe;
            } else {
              "Starting fallback new named executable: $destNamedExe" | Out-File $log -Append;
              Start-Process -FilePath $newExe;
            }
          `.trim().replace(/\r?\n\s*/g, ' ');

          const helper = spawn(
            'powershell.exe',
            ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psScript],
            {
              detached: true,
              stdio: 'ignore',
              windowsHide: true
            }
          );
          helper.unref();
        }
      } else {
        await shell.openPath(targetDownloadedPath);
      }

      // Terminate immediately to release Windows file locks
      setTimeout(() => {
        app.quit();
        setTimeout(() => app.exit(0), 300);
      }, 400);
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
      httpsAgent,
      httpAgent,
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
