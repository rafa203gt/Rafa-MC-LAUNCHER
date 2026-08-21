import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import axios from 'axios';
import { createRequire } from 'node:module';
import { configStore } from './config-store';
import { ProgressTracker } from './progress-tracker';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

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

export interface DownloadProgress {
  stage: string;
  task: string;
  total: number;
  current: number;
  percent: number;
}

export class JavaManager {
  private runtimeDir: string;

  constructor() {
    this.runtimeDir = configStore.getRuntimeDir();
  }

  public getJavaExecutablePath(version: number = 21): string | null {
    const javaDir = path.join(this.runtimeDir, `java${version}`);
    if (!fs.existsSync(javaDir)) return null;

    const findJava = (dir: string): string | null => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const res = findJava(fullPath);
          if (res) return res;
        } else if (file.toLowerCase() === 'javaw.exe' || file.toLowerCase() === 'java.exe' || file === 'java') {
          return fullPath;
        }
      }
      return null;
    };

    return findJava(javaDir);
  }

  public async ensureJava(
    version: number = 21,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<string> {
    const existing = this.getJavaExecutablePath(version);
    if (existing) {
      if (onProgress) {
        onProgress({
          stage: 'java',
          task: `Java ${version} verificado`,
          total: 100,
          current: 100,
          percent: 100
        });
      }
      return existing;
    }

    if (onProgress) {
      onProgress({
        stage: 'java',
        task: `⚡ Conectando al acelerador de descarga de Java ${version} OpenJDK (16 hilos)...`,
        total: 100,
        current: 0,
        percent: 0
      });
    }

    const javaDir = path.join(this.runtimeDir, `java${version}`);
    if (!fs.existsSync(javaDir)) {
      fs.mkdirSync(javaDir, { recursive: true });
    }

    const zipPath = path.join(this.runtimeDir, `temurin${version}.zip`);
    const downloadUrl = `https://api.adoptium.net/v3/binary/latest/${version}/ga/windows/x64/jdk/hotspot/normal/eclipse`;

    let tracker: ProgressTracker | null = null;
    await this.downloadMultiSegmentFile(downloadUrl, zipPath, (loaded, total) => {
      if (!tracker && total > 0) {
        tracker = new ProgressTracker(total);
      }
      if (onProgress && tracker) {
        const metrics = tracker.update(loaded);
        onProgress({
          stage: 'java',
          task: `⚡ Descargando Java ${version}: ${metrics.loadedMB} / ${metrics.totalMB} MB — ${metrics.speedMBs} MB/s (${metrics.etaFormatted})`,
          total,
          current: loaded,
          percent: metrics.percent
        });
      }
    });

    if (onProgress) {
      onProgress({
        stage: 'java',
        task: `Extrayendo Java ${version}...`,
        total: 100,
        current: 100,
        percent: 100
      });
    }

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(javaDir, true);

    try {
      fs.unlinkSync(zipPath);
    } catch {}

    const javaPath = this.getJavaExecutablePath(version);
    if (!javaPath) {
      throw new Error(`No se pudo encontrar javaw.exe tras la extracción de Java ${version}.`);
    }

    return javaPath;
  }

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

    const tempDir = path.join(this.runtimeDir, 'java_chunks_' + Date.now().toString(36));
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const chunkFiles: string[] = [];
    const chunkProgress: number[] = new Array(segmentsCount).fill(0);

    const updateCombined = () => {
      const loaded = chunkProgress.reduce((a, b) => a + b, 0);
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
            return reject(new Error(`Fallo descarga Java: HTTP ${res.statusCode}`));
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
}

export const javaManager = new JavaManager();
