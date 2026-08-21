import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { createRequire } from 'node:module';
import { configStore } from './config-store';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

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
        task: `Descargando Java ${version} OpenJDK (Adoptium)...`,
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

    await this.downloadWithRedirects(downloadUrl, zipPath, (loaded, total) => {
      if (onProgress && total > 0) {
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        onProgress({
          stage: 'java',
          task: `Descargando Java ${version} (${(loaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)...`,
          total,
          current: loaded,
          percent
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
    } catch {
      // Cleanup
    }

    const javaPath = this.getJavaExecutablePath(version);
    if (!javaPath) {
      throw new Error(`No se pudo encontrar javaw.exe tras la extracción de Java ${version}.`);
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
        client
          .get(currentUrl, { headers: { 'User-Agent': 'Rafa-MC-Launcher' } }, (res) => {
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
          })
          .on('error', (err) => {
            reject(err);
          });
      };

      makeRequest(url);
    });
  }
}

export const javaManager = new JavaManager();
