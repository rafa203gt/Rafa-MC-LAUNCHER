import axios from 'axios';

export interface GitHubAsset {
  id: number;
  name: string;
  size: number;
  download_url: string;
  created_at: string;
}

export interface UploadProgressCallback {
  (fileName: string, percent: number, status: string): void;
}

export class GitHubStorageService {
  private owner: string = 'rafa203gt';
  private repo: string = 'Rafa-MC-LAUNCHER';
  private releaseTag: string = 'modpack-assets';

  public getToken(): string {
    return localStorage.getItem('github_pat_token') || '';
  }

  public setToken(token: string): void {
    localStorage.setItem('github_pat_token', token.trim());
  }

  public getRepo(): string {
    return localStorage.getItem('github_repo_name') || `${this.owner}/${this.repo}`;
  }

  public setRepo(repo: string): void {
    localStorage.setItem('github_repo_name', repo.trim());
  }

  // Calculate SHA-1 hash of a file in the browser
  public async calculateSha1(fileOrBuffer: File | ArrayBuffer): Promise<string> {
    const buffer = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Get or Create the dedicated assets release
  public async getOrCreateRelease(): Promise<{ id: number; upload_url: string }> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Se requiere un Token Personal de GitHub (PAT) para subir archivos.');
    }

    const [owner, repo] = this.getRepo().split('/');

    try {
      // 1. Check if release already exists
      const res = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/releases/tags/${this.releaseTag}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      return { id: res.data.id, upload_url: res.data.upload_url };
    } catch (err: any) {
      if (err.response?.status === 404) {
        // 2. Create release if not exists
        const createRes = await axios.post(
          `https://api.github.com/repos/${owner}/${repo}/releases`,
          {
            tag_name: this.releaseTag,
            name: '📦 Modpack & Launcher Cloud Assets',
            body: 'Almacenamiento en la nube de alta velocidad con CDN ilimitado para mods, shaders, configs y paquetes de recursos.',
            draft: false,
            prerelease: false
          },
          {
            headers: {
              Authorization: `token ${token}`,
              Accept: 'application/vnd.github.v3+json'
            }
          }
        );
        return { id: createRes.data.id, upload_url: createRes.data.upload_url };
      }
      throw new Error(`Error conectando con GitHub: ${err.message}`);
    }
  }

  // Upload an asset to GitHub Release
  public async uploadAsset(
    file: File | { name: string; buffer: ArrayBuffer },
    onProgress?: UploadProgressCallback
  ): Promise<{ name: string; url: string; size: number; sha1: string }> {
    const token = this.getToken();
    if (!token) throw new Error('Token de GitHub no configurado');

    const fileName = file.name;
    const buffer = file instanceof File ? await file.arrayBuffer() : file.buffer;
    const size = buffer.byteLength;

    if (onProgress) onProgress(fileName, 10, 'Calculando hash SHA-1...');
    const sha1 = await this.calculateSha1(buffer);

    if (onProgress) onProgress(fileName, 25, 'Conectando con GitHub Releases...');
    const { upload_url } = await this.getOrCreateRelease();

    // Clean upload_url template: https://uploads.github.com/.../assets{?name,label}
    const cleanUploadUrl = upload_url.split('{')[0] + `?name=${encodeURIComponent(fileName)}`;

    if (onProgress) onProgress(fileName, 40, 'Subiendo a la red CDN de GitHub...');

    // If asset with same name already exists in release, delete it first to overwrite
    await this.deleteAssetIfExists(fileName);

    const uploadRes = await axios.post(cleanUploadUrl, buffer, {
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/octet-stream'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const p = 40 + Math.round((progressEvent.loaded / progressEvent.total) * 55);
          if (onProgress) onProgress(fileName, p, `Subiendo (${Math.round((progressEvent.loaded / (1024 * 1024)) * 10) / 10} MB)...`);
        }
      }
    });

    if (onProgress) onProgress(fileName, 100, '¡Subido con éxito!');

    return {
      name: fileName,
      url: uploadRes.data.browser_download_url,
      size: size,
      sha1: sha1
    };
  }

  // List existing assets in the release
  public async listAssets(): Promise<GitHubAsset[]> {
    const token = this.getToken();
    if (!token) return [];

    const [owner, repo] = this.getRepo().split('/');
    try {
      const res = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/releases/tags/${this.releaseTag}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );

      return (res.data.assets || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        size: a.size,
        download_url: a.browser_download_url,
        created_at: a.created_at
      }));
    } catch (err) {
      return [];
    }
  }

  // Delete an asset by name if it already exists
  public async deleteAssetIfExists(fileName: string): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    const assets = await this.listAssets();
    const existing = assets.find((a) => a.name.toLowerCase() === fileName.toLowerCase());
    if (!existing) return false;

    const [owner, repo] = this.getRepo().split('/');
    try {
      await axios.delete(
        `https://api.github.com/repos/${owner}/${repo}/releases/assets/${existing.id}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      return true;
    } catch (err) {
      console.warn('No se pudo borrar asset previo:', err);
      return false;
    }
  }

  // Delete an asset by ID
  public async deleteAssetById(assetId: number): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    const [owner, repo] = this.getRepo().split('/');
    try {
      await axios.delete(
        `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      return true;
    } catch (err) {
      console.warn('Error eliminando asset:', err);
      return false;
    }
  }
}

export const gitHubStorage = new GitHubStorageService();
