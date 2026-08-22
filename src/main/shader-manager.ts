import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import axios from 'axios';
import { shell } from 'electron';
import { configStore } from './config-store';
import { remoteConfigManager } from './remote-config';

export interface ShaderInfo {
  id: string;
  name: string;
  description: string;
  performanceTier: 'fast' | 'balanced' | 'ultra';
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  previewImage?: string;
  isInstalled?: boolean;
}

export class ShaderManager {
  private getShaderpacksDir(instanceId?: string): string {
    const base = configStore.getBaseDir();
    const id = instanceId || 'default';
    const folder = id === 'atm10' ? 'default' : id;
    const dir = path.join(base, 'instances', folder, 'shaderpacks');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public getInstalledShaders(instanceId?: string): string[] {
    const dir = this.getShaderpacksDir(instanceId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.zip'));
  }

  public async getAvailableShaders(instanceId?: string): Promise<ShaderInfo[]> {
    const targetInstance = instanceId || 'atm10';
    const installed = this.getInstalledShaders(targetInstance);
    let remoteShaders: any[] = [];

    try {
      if ((remoteConfigManager as any).supabase) {
        // 1. Fetch shaders registered in modpack_mods for this specific instance
        const { data: modsData } = await (remoteConfigManager as any).supabase
          .from('modpack_mods')
          .select('*')
          .eq('instance_id', targetInstance)
          .eq('is_enabled', true);

        if (modsData && modsData.length > 0) {
          const shadersFromMods = modsData.filter(
            (m: any) =>
              m.category === 'shaders' ||
              m.category === 'shader' ||
              m.file_path?.startsWith('shaderpacks/') ||
              (m.file_name?.endsWith('.zip') && !m.file_path?.startsWith('mods/'))
          );
          if (shadersFromMods.length > 0) {
            remoteShaders = shadersFromMods.map((s: any) => ({
              id: s.id,
              name: s.mod_name || s.file_name.replace(/\.zip$/i, ''),
              description: `Shaderpack optimizado para ${targetInstance}`,
              performance_tier: 'balanced',
              download_url: s.download_url,
              file_name: s.file_name,
              file_size: Number(s.file_size) || 0,
              is_active: s.is_enabled
            }));
          }
        }

        // 2. Also fetch from shaderpacks table strictly for this instance_id
        const { data: tableData } = await (remoteConfigManager as any).supabase
          .from('shaderpacks')
          .select('*')
          .eq('instance_id', targetInstance)
          .eq('is_active', true);

        if (tableData && tableData.length > 0) {
          tableData.forEach((st: any) => {
            if (!remoteShaders.some((r) => r.file_name === st.file_name)) {
              remoteShaders.push(st);
            }
          });
        }
      }
    } catch (err: any) {
      console.warn(`[ShaderManager] Error cargando shaders para ${targetInstance}:`, err.message);
    }

    return remoteShaders.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      performanceTier: s.performance_tier || 'balanced',
      downloadUrl: s.download_url,
      fileName: s.file_name,
      fileSize: s.file_size || 0,
      previewImage: s.preview_image,
      isInstalled: installed.includes(s.file_name)
    }));
  }

  public async downloadShader(
    downloadUrl: string,
    fileName: string,
    instanceId?: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    const dir = this.getShaderpacksDir(instanceId);
    const targetFile = path.join(dir, fileName);

    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 30000
    });

    const total = parseInt(String(response.headers['content-length'] || '0'), 10);
    let current = 0;

    const writer = fs.createWriteStream(targetFile);
    response.data.on('data', (chunk: Buffer) => {
      current += chunk.length;
      if (total > 0 && onProgress) {
        onProgress(Math.round((current / total) * 100));
      }
    });

    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', () => resolve(true));
      writer.on('error', reject);
    });
  }

  public deleteShader(fileName: string, instanceId?: string): boolean {
    const dir = this.getShaderpacksDir(instanceId);
    const targetFile = path.join(dir, fileName);
    if (fs.existsSync(targetFile)) {
      try {
        fs.unlinkSync(targetFile);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public openShaderFolder(instanceId?: string): void {
    const dir = this.getShaderpacksDir(instanceId);
    shell.openPath(dir);
  }
}

export const shaderManager = new ShaderManager();
