import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import AdmZip from 'adm-zip';
import { configStore } from './config-store';

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

  public getJavaExecutablePath(): string | null {
    const java17Dir = path.join(this.runtimeDir, 'java17');
    if (!fs.existsSync(java17Dir)) return null;

    // Search for javaw.exe or java executable recursively inside java17Dir
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

    return findJava(java17Dir);
  }

  public async ensureJava(onProgress?: (p: DownloadProgress) => void): Promise<string> {
    const existing = this.getJavaExecutablePath();
    if (existing) {
      if (onProgress) {
        onProgress({
          stage: 'java',
          task: 'Java 17 verificado',
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
        task: 'Descargando Java 17 OpenJDK (Adoptium)...',
        total: 100,
        current: 0,
        percent: 0
      });
    }

    const java17Dir = path.join(this.runtimeDir, 'java17');
    if (!fs.existsSync(java17Dir)) {
      fs.mkdirSync(java17Dir, { recursive: true });
    }

    const zipPath = path.join(this.runtimeDir, 'temurin17.zip');
    const downloadUrl = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse';

    await this.downloadWithRedirects(downloadUrl, zipPath, (loaded, total) => {
      if (onProgress && total > 0) {
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        onProgress({
          stage: 'java',
          task: `Descargando Java 17 (${(loaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)...`,
          total,
          current: loaded,
          percent
        });
      }
    });

    if (onProgress) {
      onProgress({
        stage: 'java',
        task: 'Extrayendo Java 17...',
        total: 100,
        current: 100,
        percent: 100
      });
    }

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(java17Dir, true);

    try {
      fs.unlinkSync(zipPath);
    } catch {
      // Ignore cleanup error
    }

    const javaPath = this.getJavaExecutablePath();
    if (!javaPath) {
      throw new Error('No se pudo encontrar javaw.exe tras la extracción de Java 17.');
    }

    return javaPath;
  }

  private downloadWithRedirects(
    url: string,
    dest: string,
    onProgress: (loaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const makeRequest = (currentUrl: string, depth = 0) => {
        if (depth > 5) {
          return reject(new Error('Demasiadas redirecciones al descargar Java.'));
        }

        const client = currentUrl.startsWith('https') ? https : http;
        client.get(currentUrl, { headers: { 'User-Agent': 'Rafa-MC-Launcher' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return makeRequest(res.headers.location, depth + 1);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Fallo en la descarga de Java. Código de estado: ${res.statusCode}`));
          }

          const total = parseInt(res.headers['content-length'] || '0', 10);
          let loaded = 0;
          const file = fs.createWriteStream(dest);

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
        }).on('error', (err) => {
          reject(err);
        });
      };

      makeRequest(url);
    });
  }
}

export const javaManager = new JavaManager();
