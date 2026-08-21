import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import axios from 'axios';
import { createRequire } from 'node:module';
import { configStore } from './config-store';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

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
  bundleUrl?: string; // Optional direct URL to full .zip package for fast 1-click initial install
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
  private instanceDir: string;

  constructor() {
    this.instanceDir = configStore.getInstanceDir();
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

  public async syncModpack(
    manifestUrl: string,
    onProgress?: (p: SyncProgress) => void
  ): Promise<{ synced: number; deleted: number; total: number }> {
    if (!manifestUrl) {
      return { synced: 0, deleted: 0, total: 0 };
    }

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

    const modsDir = path.join(this.instanceDir, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }

    const localModFiles = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar'));

    // 1. FAST BOOTSTRAP: If local instance is fresh/empty and manifest provides a bundleUrl (.zip)
    if (localModFiles.length < 10 && manifest.bundleUrl) {
      if (onProgress) {
        onProgress({
          stage: 'mods',
          task: 'Descargando paquete completo del modpack...',
          total: 100,
          current: 0,
          percent: 0
        });
      }

      const tempZip = path.join(this.instanceDir, 'temp_bundle.zip');
      await this.downloadFileWithProgress(manifest.bundleUrl, tempZip, (loaded, total) => {
        if (onProgress && total > 0) {
          const percent = Math.min(100, Math.round((loaded / total) * 100));
          onProgress({
            stage: 'mods',
            task: `Descargando modpack completo (${(loaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)...`,
            total,
            current: loaded,
            percent
          });
        }
      });

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
      zip.extractAllTo(this.instanceDir, true);

      try {
        fs.unlinkSync(tempZip);
      } catch {}

      if (onProgress) {
        onProgress({
          stage: 'mods',
          task: '¡Modpack completo instalado con éxito!',
          total: 100,
          current: 100,
          percent: 100
        });
      }

      return { synced: manifest.files?.length || 1, deleted: 0, total: manifest.files?.length || 1 };
    }

    // 2. INCREMENTAL DIFFERENTIAL SYNC
    if (!manifest.files || !Array.isArray(manifest.files)) {
      return { synced: 0, deleted: 0, total: 0 };
    }

    const remoteFiles = manifest.files;
    const toDownload: ModpackFile[] = [];

    for (const file of remoteFiles) {
      const localFilePath = path.join(this.instanceDir, file.path);
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

    for (let i = 0; i < toDownload.length; i++) {
      const file = toDownload[i];
      const targetPath = path.join(this.instanceDir, file.path);
      const parentDir = path.dirname(targetPath);

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      if (onProgress) {
        const percent = Math.round(((i + 1) / totalToDownload) * 100);
        onProgress({
          stage: 'mods',
          task: `Actualizando archivos (${i + 1}/${totalToDownload}): ${path.basename(file.path)}`,
          total: totalToDownload,
          current: i + 1,
          percent
        });
      }

      try {
        await this.downloadFile(file.downloadUrl, targetPath);
        downloadedCount++;
      } catch (err: any) {
        console.warn(`[ModSync] Aviso: No se pudo descargar archivo individual ${file.path} (${err.message}). Continuando...`);
      }
    }

    // 3. CLEAN UP DEPRECATED MODS
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

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client
        .get(url, { headers: { 'User-Agent': 'Rafa-MC-Launcher' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return this.downloadFile(res.headers.location, dest).then(resolve).catch(reject);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Error descargando ${url}: HTTP ${res.statusCode}`));
          }

          const file = fs.createWriteStream(dest);
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
      const client = url.startsWith('https') ? https : http;
      client
        .get(url, { headers: { 'User-Agent': 'Rafa-MC-Launcher' } }, (res) => {
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
    });
  }

  public getInstalledMods(): { name: string; size: number; modified: Date }[] {
    const modsDir = path.join(this.instanceDir, 'mods');
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
