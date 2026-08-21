import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import axios from 'axios';
import { createRequire } from 'node:module';
import { configStore } from './config-store';
import { ProgressTracker } from './progress-tracker';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

// Ultra-fast HTTP/HTTPS Agents with Keep-Alive, TCP noDelay, IPv4 forced and 256 connection pooling
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 256,
  maxFreeSockets: 128,
  timeout: 60000,
  family: 4,
  noDelay: true
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 256,
  maxFreeSockets: 128,
  timeout: 60000,
  family: 4,
  noDelay: true
});

export interface ModpackFile {
  path: string; // Relative to instance root (e.g. 'mods/mekanism.jar', 'config/forge.cfg')
  sha1: string;
  size?: number;
  downloadUrl: string;
}

export interface ModpackManifest {
  name: string;
  version: string;
  minecraftVersion: string;
  modLoader: 'fabric' | 'forge' | 'neoforge' | 'vanilla';
  modLoaderVersion: string;
  updatedAt?: string;
  bundleUrl?: string; // Direct URL to full .zip package for fast 1-click initial install
  bundleSha1?: string;
  files: ModpackFile[];
}

export interface SyncProgress {
  stage: string;
  task: string;
  total: number;
  current: number;
  percent: number;
}

export class ModSynchronizer {
  private concurrency = 64; // 64 simultaneous parallel download streams

  private getInstanceDir(): string {
    return configStore.getInstanceDir();
  }

  public calculateSha1(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha1').update(fileBuffer).digest('hex').toLowerCase();
  }

  public async fetchManifest(manifestUrl: string): Promise<ModpackManifest | null> {
    if (!manifestUrl || manifestUrl.trim() === '') return null;
    try {
      const response = await axios.get<ModpackManifest>(manifestUrl, {
        timeout: 10000,
        headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Rafa-MC-Launcher' }
      });
      return response.data;
    } catch (err: any) {
      console.warn(`[ModSync] No se pudo obtener el manifiesto remoto (${manifestUrl}):`, err.message);
      return null;
    }
  }

  public async reinstallModpack(
    manifestUrl: string,
    onProgress?: (p: SyncProgress) => void
  ): Promise<{ synced: number; deleted: number; total: number }> {
    const instanceDir = this.getInstanceDir();

    if (onProgress) {
      onProgress({
        stage: 'mods',
        task: 'Limpiando archivos para reinstalación limpia (preservando mundos guardados)...',
        total: 100,
        current: 10,
        percent: 10
      });
    }

    // Folders to clean safely
    const dirsToClean = ['mods', 'config', 'defaultconfigs', 'kubejs', 'local', 'versions', 'temp_chunks'];
    for (const dirName of dirsToClean) {
      const fullDir = path.join(instanceDir, dirName);
      if (fs.existsSync(fullDir)) {
        try {
          fs.rmSync(fullDir, { recursive: true, force: true });
        } catch (err) {
          console.warn(`[ModSync] No se pudo limpiar carpeta ${dirName}:`, err);
        }
      }
    }

    if (onProgress) {
      onProgress({
        stage: 'mods',
        task: 'Iniciando descarga completa de alta velocidad...',
        total: 100,
        current: 25,
        percent: 25
      });
    }

    return this.syncModpack(manifestUrl, onProgress);
  }

  public async syncModpack(
    manifestUrl: string,
    onProgress?: (p: SyncProgress) => void
  ): Promise<{ synced: number; deleted: number; total: number }> {
    if (!manifestUrl) {
      return { synced: 0, deleted: 0, total: 0 };
    }

    const instanceDir = this.getInstanceDir();

    if (onProgress) {
      onProgress({
        stage: 'mods',
        task: 'Verificando actualizaciones del modpack en la nube...',
        total: 100,
        current: 0,
        percent: 0
      });
    }

    const manifest = await this.fetchManifest(manifestUrl);
    if (!manifest) {
      if (onProgress) {
        onProgress({
          stage: 'mods',
          task: 'Modpack verificado (sin conexión a servidor de actualizaciones)',
          total: 100,
          current: 100,
          percent: 100
        });
      }
      return { synced: 0, deleted: 0, total: 0 };
    }

    const modsDir = path.join(instanceDir, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }

    const localModFiles = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar'));

    // 1. TURBO MULTI-SEGMENT BOOTSTRAP: If local instance is fresh (<10 mods) and bundleUrl is provided
    if (localModFiles.length < 10 && manifest.bundleUrl) {
      if (onProgress) {
        onProgress({
          stage: 'mods',
          task: '⚡ Conectando al acelerador multi-segmento (16 hilos paralelos)...',
          total: 100,
          current: 0,
          percent: 0
        });
      }

      const tempZip = path.join(instanceDir, 'temp_bundle.zip');

      await this.downloadMultiSegmentFile(manifest.bundleUrl, tempZip, onProgress);

      if (onProgress) {
        onProgress({
          stage: 'mods',
          task: 'Extrayendo modpack y configuraciones...',
          total: 100,
          current: 100,
          percent: 100
        });
      }

      const zip = new AdmZip(tempZip);
      zip.extractAllTo(instanceDir, true);

      try {
        fs.unlinkSync(tempZip);
      } catch {}

      if (onProgress) {
        onProgress({
          stage: 'mods',
          task: '¡Modpack instalado con éxito a máxima velocidad!',
          total: 100,
          current: 100,
          percent: 100
        });
      }

      return { synced: manifest.files?.length || 1, deleted: 0, total: manifest.files?.length || 1 };
    }

    // 2. ULTRA-FAST 64-THREAD PARALLEL INCREMENTAL SYNC
    if (!manifest.files || !Array.isArray(manifest.files)) {
      return { synced: 0, deleted: 0, total: 0 };
    }

    const remoteFiles = manifest.files;
    const toDownload: ModpackFile[] = [];

    for (const file of remoteFiles) {
      const localFilePath = path.join(instanceDir, file.path);
      if (!fs.existsSync(localFilePath)) {
        toDownload.push(file);
      } else {
        const localHash = this.calculateSha1(localFilePath);
        if (file.sha1 && localHash !== file.sha1.toLowerCase()) {
          toDownload.push(file);
        }
      }
    }

    let downloadedCount = 0;
    const totalToDownload = toDownload.length;

    if (totalToDownload > 0) {
      console.log(`[ModSync] Descargando ${totalToDownload} archivos en paralelo (${this.concurrency} hilos)...`);

      let activeIndex = 0;
      const downloadWorker = async () => {
        while (activeIndex < toDownload.length) {
          const index = activeIndex++;
          const file = toDownload[index];
          const targetPath = path.join(instanceDir, file.path);
          const parentDir = path.dirname(targetPath);

          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }

          try {
            await this.downloadFile(file.downloadUrl, targetPath);
            downloadedCount++;
          } catch (err: any) {
            console.warn(`[ModSync] Aviso: No se pudo descargar ${file.path} (${err.message}).`);
          }

          if (onProgress) {
            const percent = Math.round((downloadedCount / totalToDownload) * 100);
            onProgress({
              stage: 'mods',
              task: `⚡ Actualizando (${downloadedCount}/${totalToDownload}): ${path.basename(file.path)}`,
              total: totalToDownload,
              current: downloadedCount,
              percent
            });
          }
        }
      };

      const workers = Array.from({ length: Math.min(this.concurrency, totalToDownload) }, () => downloadWorker());
      await Promise.all(workers);
    }

    // 3. CLEAN UP OBSOLETE MODS
    let deletedCount = 0;
    if (fs.existsSync(modsDir)) {
      const currentMods = fs.readdirSync(modsDir);
      const remoteModNames = new Set(
        remoteFiles
          .filter((f) => f.path.startsWith('mods/'))
          .map((f) => path.basename(f.path))
      );

      for (const modFile of currentMods) {
        if (modFile.endsWith('.jar')) {
          if (!remoteModNames.has(modFile) && remoteFiles.length > 0) {
            try {
              fs.unlinkSync(path.join(modsDir, modFile));
              deletedCount++;
              console.log(`[ModSync] Eliminado mod obsoleto: ${modFile}`);
            } catch (err) {
              console.warn(`[ModSync] No se pudo eliminar mod obsoleto: ${modFile}`, err);
            }
          }
        }
      }
    }

    if (onProgress) {
      const msg =
        downloadedCount > 0 || deletedCount > 0
          ? `Modpack sincronizado: ${downloadedCount} actualizados, ${deletedCount} eliminados`
          : 'Modpack al día con la última versión del servidor';
      onProgress({
        stage: 'mods',
        task: msg,
        total: 100,
        current: 100,
        percent: 100
      });
    }

    return { synced: downloadedCount, deleted: deletedCount, total: remoteFiles.length };
  }

  /**
   * 16-Segment Turbo Parallel Downloader with HTTP Range & TCP low latency
   */
  private async downloadMultiSegmentFile(
    url: string,
    dest: string,
    onProgress?: (p: SyncProgress) => void
  ): Promise<void> {
    const finalUrl = await this.resolveRedirects(url);

    // 1. Get file size
    const headRes = await axios.head(finalUrl, {
      headers: { 'User-Agent': 'Rafa-MC-Launcher' },
      timeout: 10000
    });

    const rawLength = headRes.headers['content-length'];
    const totalBytes = typeof rawLength === 'number' ? rawLength : parseInt(String(rawLength || '0'), 10);
    const acceptRanges = headRes.headers['accept-ranges'] === 'bytes' || totalBytes > 20 * 1024 * 1024;

    // Fallback to single stream if server doesn't support ranges or file is small
    if (!acceptRanges || totalBytes <= 0) {
      return this.downloadFileWithProgress(finalUrl, dest, (loaded, total) => {
        if (onProgress && total > 0) {
          const percent = Math.min(100, Math.round((loaded / total) * 100));
          onProgress({
            stage: 'mods',
            task: `⚡ Descargando modpack (${(loaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)...`,
            total,
            current: loaded,
            percent
          });
        }
      });
    }

    const segmentsCount = 16;
    const chunkSize = Math.ceil(totalBytes / segmentsCount);
    const tempDir = path.join(path.dirname(dest), 'temp_chunks');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const chunkFiles: string[] = [];
    const chunkProgress: number[] = new Array(segmentsCount).fill(0);
    const tracker = new ProgressTracker(totalBytes);

    const updateCombinedProgress = () => {
      if (!onProgress) return;
      const loaded = chunkProgress.reduce((a, b) => a + b, 0);
      const metrics = tracker.update(loaded);

      onProgress({
        stage: 'mods',
        task: `⚡ Descarga Turbo (${segmentsCount} hilos): ${metrics.loadedMB} / ${metrics.totalMB} MB — ${metrics.speedMBs} MB/s (${metrics.etaFormatted})`,
        total: totalBytes,
        current: loaded,
        percent: metrics.percent
      });
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
              return reject(new Error(`Error descargando segmento ${index}: HTTP ${res.statusCode}`));
            }

            const writeStream = fs.createWriteStream(chunkPath, { highWaterMark: 4 * 1024 * 1024 });

            res.on('data', (chunk) => {
              chunkProgress[index] += chunk.length;
              updateCombinedProgress();
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

    // Download all segments in parallel
    await Promise.all(Array.from({ length: segmentsCount }, (_, i) => downloadSegment(i)));

    // Assemble segments into final destination file
    if (onProgress) {
      onProgress({
        stage: 'mods',
        task: '⚡ Ensamblando bloques de datos en disco...',
        total: totalBytes,
        current: totalBytes,
        percent: 99
      });
    }

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

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https');
      const client = isHttps ? https : http;
      const agent = isHttps ? httpsAgent : httpAgent;

      client
        .get(url, { agent, headers: { 'User-Agent': 'Rafa-MC-Launcher' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return this.downloadFile(res.headers.location, dest).then(resolve).catch(reject);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Error descargando ${url}: HTTP ${res.statusCode}`));
          }

          const file = fs.createWriteStream(dest, { highWaterMark: 4 * 1024 * 1024 });
          res.pipe(file);

          file.on('finish', () => {
            file.close(() => resolve());
          });

          file.on('error', (err) => {
            fs.unlink(dest, () => reject(err));
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  private downloadFileWithProgress(
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
            return this.downloadFileWithProgress(res.headers.location, dest, onProgress)
              .then(resolve)
              .catch(reject);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Error descargando bundle ${url}: HTTP ${res.statusCode}`));
          }

          const total = parseInt(res.headers['content-length'] || '0', 10);
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
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  public getInstalledMods(): { name: string; size: number; modified: Date }[] {
    const modsDir = path.join(this.getInstanceDir(), 'mods');
    if (!fs.existsSync(modsDir)) return [];

    const files = fs.readdirSync(modsDir);
    return files
      .filter((f) => f.endsWith('.jar'))
      .map((f) => {
        const full = path.join(modsDir, f);
        const stat = fs.statSync(full);
        return {
          name: f,
          size: stat.size,
          modified: stat.mtime
        };
      });
  }
}

export const modSynchronizer = new ModSynchronizer();
