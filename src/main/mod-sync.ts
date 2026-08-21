import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import axios from 'axios';
import { configStore } from './config-store';

export interface ModpackFile {
  path: string;
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
    try {
      const response = await axios.get<ModpackManifest>(manifestUrl, {
        timeout: 10000,
        headers: { 'Cache-Control': 'no-cache' }
      });
      return response.data;
    } catch (err: any) {
      console.warn(`[ModSync] No se pudo obtener el manifiesto de ${manifestUrl}:`, err.message);
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
        task: 'Comprobando actualizaciones del modpack...',
        total: 100,
        current: 0,
        percent: 0
      });
    }

    const manifest = await this.fetchManifest(manifestUrl);
    if (!manifest || !manifest.files || !Array.isArray(manifest.files)) {
      if (onProgress) {
        onProgress({
          stage: 'mods',
          task: 'Modpack verificado (sin cambios remotos)',
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

    const remoteFiles = manifest.files;
    const toDownload: ModpackFile[] = [];

    // 1. Check which files need download
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

    // 2. Download missing/updated files
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
          task: `Descargando mods (${i + 1}/${totalToDownload}): ${path.basename(file.path)}`,
          total: totalToDownload,
          current: i + 1,
          percent
        });
      }

      await this.downloadFile(file.downloadUrl, targetPath);
      downloadedCount++;
    }

    // 3. Clean up deleted mods in mods/ folder
    let deletedCount = 0;
    if (fs.existsSync(modsDir)) {
      const localMods = fs.readdirSync(modsDir);
      const remoteModNames = new Set(
        remoteFiles
          .filter((f) => f.path.startsWith('mods/'))
          .map((f) => path.basename(f.path))
      );

      for (const modFile of localMods) {
        if (modFile.endsWith('.jar') || modFile.endsWith('.disabled')) {
          if (!remoteModNames.has(modFile) && remoteFiles.length > 0) {
            try {
              fs.unlinkSync(path.join(modsDir, modFile));
              deletedCount++;
            } catch (err) {
              console.warn(`[ModSync] No se pudo eliminar: ${modFile}`, err);
            }
          }
        }
      }
    }

    if (onProgress) {
      onProgress({
        stage: 'mods',
        task: `Modpack sincronizado correctamente (${downloadedCount} descargados, ${deletedCount} limpiados)`,
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
            return reject(new Error(`Error descargando archivo ${url}: HTTP ${res.statusCode}`));
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
