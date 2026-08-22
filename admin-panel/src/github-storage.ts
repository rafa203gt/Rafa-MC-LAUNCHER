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
  private releaseCache: Map<string, { id: number; upload_url: string }> = new Map();

  public hasEnvToken(): boolean {
    return !!((import.meta as any).env?.VITE_GITHUB_PAT);
  }

  public getToken(): string {
    const envToken = (import.meta as any).env?.VITE_GITHUB_PAT;
    if (envToken && typeof envToken === 'string' && envToken.trim() !== '') {
      return envToken.trim();
    }
    return localStorage.getItem('github_pat_token') || '';
  }

  public setToken(token: string): void {
    localStorage.setItem('github_pat_token', token.trim());
  }

  public getRepo(): string {
    const envRepo = (import.meta as any).env?.VITE_GITHUB_REPO;
    if (envRepo && typeof envRepo === 'string' && envRepo.trim() !== '') {
      return envRepo.trim();
    }
    return localStorage.getItem('github_repo_name') || `${this.owner}/${this.repo}`;
  }

  public setRepo(repo: string): void {
    localStorage.setItem('github_repo_name', repo.trim());
  }

  // Calculate SHA-1 hash of a file in the browser
  public async calculateSha1(fileOrBuffer: File | ArrayBuffer | Blob): Promise<string> {
    const buffer =
      fileOrBuffer instanceof File || fileOrBuffer instanceof Blob
        ? await fileOrBuffer.arrayBuffer()
        : fileOrBuffer;
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Get or Create the dedicated assets release
  public async getOrCreateRelease(
    tag: string = this.releaseTag,
    releaseTitle?: string
  ): Promise<{ id: number; upload_url: string }> {
    if (this.releaseCache.has(tag)) {
      return this.releaseCache.get(tag)!;
    }

    const token = this.getToken();
    if (!token) {
      throw new Error('Se requiere un Token Personal de GitHub (PAT) para subir archivos.');
    }

    const [owner, repo] = this.getRepo().split('/');

    try {
      // 1. Check if release already exists
      const res = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      const data = { id: res.data.id, upload_url: res.data.upload_url };
      this.releaseCache.set(tag, data);
      return data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        // 2. Create release if not exists
        const createRes = await axios.post(
          `https://api.github.com/repos/${owner}/${repo}/releases`,
          {
            tag_name: tag,
            name: releaseTitle || `📦 ${tag} - Cloud Modpack Assets`,
            body: 'Almacenamiento en la nube de alta velocidad con CDN ilimitado para mods, shaders, configs y paquetes de recursos.',
            draft: false,
            prerelease: false
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json'
            }
          }
        );
        const data = { id: createRes.data.id, upload_url: createRes.data.upload_url };
        this.releaseCache.set(tag, data);
        return data;
      }
      throw new Error(`Error conectando con GitHub: ${err.message}`);
    }
  }

  // Upload an asset to GitHub Release with native fetch streaming & retries
  public async uploadAsset(
    file: File | { name: string; buffer: ArrayBuffer } | Blob & { name?: string },
    onProgress?: UploadProgressCallback,
    tag: string = this.releaseTag,
    existingAssetId?: number
  ): Promise<{ name: string; url: string; size: number; sha1: string }> {
    const token = this.getToken();
    if (!token) throw new Error('Token de GitHub no configurado');

    const fileName = (file as any).name || 'asset.bin';
    let blob: Blob;
    let size: number;

    if (file instanceof File || file instanceof Blob) {
      blob = file;
      size = file.size;
    } else {
      blob = new Blob([(file as any).buffer]);
      size = (file as any).buffer.byteLength;
    }

    if (onProgress) onProgress(fileName, 10, 'Calculando hash SHA-1...');
    const sha1 = await this.calculateSha1(blob);

    if (onProgress) onProgress(fileName, 25, 'Conectando con GitHub Releases...');
    const { upload_url } = await this.getOrCreateRelease(tag);

    // Delete previous asset if ID is provided or check if exists
    if (existingAssetId) {
      await this.deleteAssetById(existingAssetId);
    } else {
      await this.deleteAssetIfExists(fileName, tag);
    }

    // Clean upload_url template: https://uploads.github.com/.../assets{?name,label}
    const cleanUploadUrl = upload_url.split('{')[0] + `?name=${encodeURIComponent(fileName)}`;

    if (onProgress) onProgress(fileName, 50, 'Subiendo a la red CDN de GitHub...');

    // Perform upload with native fetch to prevent CORS/binary buffer serialization issues
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(cleanUploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
            Accept: 'application/vnd.github.v3+json'
          },
          body: blob
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`GitHub Upload Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        if (onProgress) onProgress(fileName, 100, '¡Subido con éxito!');

        return {
          name: fileName,
          url: data.browser_download_url,
          size: size,
          sha1: sha1
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[GitHubStorage] Reintento ${attempt}/3 para ${fileName}:`, err.message);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }

    throw lastError || new Error(`No se pudo subir ${fileName} a GitHub`);
  }

  // List existing assets in the release
  public async listAssets(tag: string = this.releaseTag): Promise<GitHubAsset[]> {
    const token = this.getToken();
    if (!token) return [];

    const [owner, repo] = this.getRepo().split('/');
    try {
      const res = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
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
  public async deleteAssetIfExists(fileName: string, tag: string = this.releaseTag): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    const assets = await this.listAssets(tag);
    const existing = assets.find((a) => a.name.toLowerCase() === fileName.toLowerCase());
    if (!existing) return false;

    return this.deleteAssetById(existing.id);
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
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      return true;
    } catch (err) {
      console.warn('Error eliminando asset previo:', err);
      return false;
    }
  }
}

export const gitHubStorage = new GitHubStorageService();
