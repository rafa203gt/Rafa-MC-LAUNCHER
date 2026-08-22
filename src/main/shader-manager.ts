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
    const installed = this.getInstalledShaders(instanceId);
    let remoteShaders: any[] = [];

    try {
      if ((remoteConfigManager as any).supabase) {
        const { data } = await (remoteConfigManager as any).supabase
          .from('shaderpacks')
          .select('*')
          .eq('is_active', true);
        if (data) remoteShaders = data;
      }
    } catch {
      // Fallback
    }

    if (remoteShaders.length === 0) {
      // Hardcoded defaults if offline
      remoteShaders = [
        {
          id: 'complementary-reimagined',
          name: 'Complementary Reimagined',
          description: 'El shader más equilibrado y optimizado con agua y luz realista.',
          performance_tier: 'balanced',
          download_url:
            'https://github.com/rafa203gt/Rafa-MC-LAUNCHER/releases/download/v1.0.0/ComplementaryReimagined_r5.4.zip',
          file_name: 'ComplementaryReimagined_r5.4.zip',
          file_size: 5242880,
          preview_image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80'
        },
        {
          id: 'bsl-shaders',
          name: 'BSL Shaders v8.2',
          description: 'Sombras atmosféricas y gráficos cálidos con alto rendimiento.',
          performance_tier: 'balanced',
          download_url:
            'https://github.com/rafa203gt/Rafa-MC-LAUNCHER/releases/download/v1.0.0/BSL_v8.2.09.zip',
          file_name: 'BSL_v8.2.09.zip',
          file_size: 3145728,
          preview_image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80'
        },
        {
          id: 'makeup-ultrafast',
          name: 'MakeUp - Ultra Fast',
          description: 'Máximos FPS para portátiles y tarjetas integradas.',
          performance_tier: 'fast',
          download_url:
            'https://github.com/rafa203gt/Rafa-MC-LAUNCHER/releases/download/v1.0.0/MakeUp-UltraFast-9.0.zip',
          file_name: 'MakeUp-UltraFast-9.0.zip',
          file_size: 1048576,
          preview_image: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=800&auto=format&fit=crop&q=80'
        }
      ];
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
