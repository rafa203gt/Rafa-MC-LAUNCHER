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
}

export class AppUpdater {
  private isDownloading = false;

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

      const realExecPath = this.getRealExecutablePath().toLowerCase();
      const isInstalledNsis = realExecPath.includes('appdata\\local\\programs');

      // If running installed version, prefer Setup installer. Otherwise prefer standalone Portable .exe
      let targetAsset: any = null;
      if (isInstalledNsis) {
        targetAsset = release.assets?.find(
          (a: any) => a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup')
        );
      } else {
        targetAsset = release.assets?.find(
          (a: any) => a.name.endsWith('.exe') && !a.name.toLowerCase().includes('setup')
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
      const targetDownloadedPath = path.join(tempDir, `update_${Date.now()}_${fileName || 'Rafa-Launcher-Update.exe'}`);

      console.log(`[AppUpdater] ⚡ Descargando actualización acelerada (16 hilos): ${downloadUrl}`);

      await this.downloadMultiSegmentFile(downloadUrl, targetDownloadedPath, (loaded, total) => {
        if (onProgress) {
          const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
          onProgress({ percent, transferred: loaded, total });
        }
      });

      const realExecPath = this.getRealExecutablePath();
      const realExecDir = this.getRealExecutableDir();
      const pid = process.pid;
      const isInstaller = fileName.toLowerCase().includes('setup');

      console.log(`[AppUpdater] Actualización lista. Ruta real del ejecutable: ${realExecPath}`);
      console.log(`[AppUpdater] Directorio de guardado: ${realExecDir}`);

      if (process.platform === 'win32') {
        if (isInstaller) {
          // If it is NSIS Setup installer, execute it directly
          const child = spawn(targetDownloadedPath, [], {
            detached: true,
            stdio: 'ignore'
          });
          child.unref();
        } else {
          // Robust PowerShell Updater with retry loop and full logging
          const newFileNameInDir = path.join(realExecDir, fileName || 'Rafa-MC-LAUNCHER.exe');
          const logFile = path.join(tempDir, 'rafa_updater.log');

          const psScript = `
            $log = '${logFile.replace(/'/g, "''")}';
            "Starting update worker at $(Get-Date)" | Out-File $log;
            
            $oldPid = ${pid};
            $newExe = '${targetDownloadedPath.replace(/'/g, "''")}';
            $currExe = '${realExecPath.replace(/'/g, "''")}';
            $destNamedExe = '${newFileNameInDir.replace(/'/g, "''")}';
            
            "Waiting for process $oldPid to exit..." | Out-File $log -Append;
            try {
              $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue;
              if ($proc) {
                $proc.WaitForExit(10000);
              }
            } catch {
              "Process already exited or not found" | Out-File $log -Append;
            }
            
            Start-Sleep -Milliseconds 1000;
            
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
                "Copy failed: $_" | Out-File $log -Append;
                Start-Sleep -Milliseconds 500;
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

      // Terminate cleanly to release Windows file locks
      setTimeout(() => {
        app.quit();
        setTimeout(() => app.exit(0), 400);
      }, 500);
    } catch (err: any) {
      this.isDownloading = false;
      console.error(`[AppUpdater] Error aplicando actualización: ${err.message}`);
      throw err;
    }
  }

  /**
   * 16-Segment Turbo Parallel Downloader with HTTP Range
   */
  private async downloadMultiSegmentFile(
    url: string,
    dest: string,
    onProgress: (loaded: number, total: number) => void
  ): Promise<void> {
    const finalUrl = await this.resolveRedirects(url);

    let totalBytes = 0;
    try {
      const headRes = await axios.head(finalUrl, {
        headers: { 'User-Agent': 'Rafa-MC-Launcher' },
        timeout: 8000
      });
      const rawLen = headRes.headers['content-length'];
      totalBytes = typeof rawLen === 'number' ? rawLen : parseInt(String(rawLen || '0'), 10);
    } catch {}

    const segmentsCount = 16;
    const chunkSize = Math.ceil(totalBytes / segmentsCount);

    if (totalBytes <= 0 || chunkSize <= 0) {
      return this.downloadSingleStream(finalUrl, dest, onProgress);
    }

    const tempDir = path.join(path.dirname(dest), 'updater_chunks_' + Date.now().toString(36));
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const chunkFiles: string[] = [];
    const chunkProgress: number[] = new Array(segmentsCount).fill(0);
    const tracker = new ProgressTracker(totalBytes);

    const updateCombined = () => {
      const loaded = chunkProgress.reduce((a, b) => a + b, 0);
      tracker.update(loaded);
      onProgress(loaded, totalBytes);
    };

    const downloadSegment = (index: number): Promise<void> => {
      const start = index * chunkSize;
      const end = index === segmentsCount - 1 ? totalBytes - 1 : (index + 1) * chunkSize - 1;
      const chunkPath = path.join(tempDir, `chunk_${index}.part`);
      chunkFiles[index] = chunkPath;

      return new Promise((resolve, reject) => {
        const isHttps = finalUrl.startsWith('https');
        const client = isHttps ? https : http;
        const agent = isHttps ? httpsAgent : httpAgent;

        const req = client.get(
          finalUrl,
          {
            agent,
            headers: {
              'User-Agent': 'Rafa-MC-Launcher',
              Range: `bytes=${start}-${end}`
            }
          },
          (res) => {
            if (res.statusCode !== 206 && res.statusCode !== 200) {
              return reject(new Error(`Segment error: HTTP ${res.statusCode}`));
            }

            const writeStream = fs.createWriteStream(chunkPath, { highWaterMark: 4 * 1024 * 1024 });

            res.on('data', (chunk) => {
              chunkProgress[index] += chunk.length;
              updateCombined();
            });

            res.pipe(writeStream);

            writeStream.on('finish', () => {
              writeStream.close(() => resolve());
            });

            writeStream.on('error', (err) => {
              fs.unlink(chunkPath, () => reject(err));
            });
          }
        );

        req.on('error', reject);
      });
    };

    try {
      await Promise.all(Array.from({ length: segmentsCount }, (_, i) => downloadSegment(i)));

      const finalStream = fs.createWriteStream(dest, { highWaterMark: 4 * 1024 * 1024 });
      for (const chunkPath of chunkFiles) {
        if (fs.existsSync(chunkPath)) {
          const data = fs.readFileSync(chunkPath);
          finalStream.write(data);
          try {
            fs.unlinkSync(chunkPath);
          } catch {}
        }
      }
      finalStream.end();
      try {
        fs.rmdirSync(tempDir);
      } catch {}
    } catch {
      return this.downloadSingleStream(finalUrl, dest, onProgress);
    }
  }

  private resolveRedirects(url: string): Promise<string> {
    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      client
        .get(url, { headers: { 'User-Agent': 'Rafa-MC-Launcher' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            resolve(this.resolveRedirects(res.headers.location));
          } else {
            resolve(url);
          }
        })
        .on('error', () => resolve(url));
    });
  }

  private downloadSingleStream(
    url: string,
    dest: string,
    onProgress: (loaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https');
      const client = isHttps ? https : http;
      const agent = isHttps ? httpsAgent : httpAgent;

      client
        .get(url, { agent, headers: { 'User-Agent': 'Rafa-MC-Launcher' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return this.downloadSingleStream(res.headers.location, dest, onProgress).then(resolve).catch(reject);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Error HTTP ${res.statusCode}`));
          }

          const rawLen = res.headers['content-length'];
          const total = typeof rawLen === 'number' ? rawLen : parseInt(String(rawLen || '0'), 10);
          let loaded = 0;
          const file = fs.createWriteStream(dest, { highWaterMark: 4 * 1024 * 1024 });

          res.on('data', (chunk) => {
            loaded += chunk.length;
            onProgress(loaded, total);
          });

          res.pipe(file);

          file.on('finish', () => {
            file.close(() => resolve());
          });

          file.on('error', (err) => {
            fs.unlink(dest, () => reject(err));
          });
        })
        .on('error', reject);
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
