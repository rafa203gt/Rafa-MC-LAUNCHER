import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import axios from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { configStore } from './config-store';
import { ENV } from './env';

export interface UserSkinData {
  username: string;
  skinUrl: string;
  skinData?: string; // base64 dataUrl or PNG buffer
  capeUrl?: string | null;
  model: 'default' | 'slim';
  updatedAt?: string;
}

export class SkinManager {
  private supabase: SupabaseClient | null = null;
  private memoryCache: Map<string, { skin: UserSkinData; fetchedAt: number }> = new Map();

  constructor() {
    this.initSupabase();
  }

  private initSupabase() {
    const supabaseUrl = ENV.SUPABASE_URL;
    const supabaseAnonKey = ENV.SUPABASE_ANON_KEY;

    try {
      if (supabaseUrl && supabaseAnonKey) {
        this.supabase = createClient(supabaseUrl, supabaseAnonKey);
      }
    } catch (err) {
      console.warn('[SkinManager] No se pudo inicializar cliente de Supabase:', err);
    }
  }

  /**
   * Obtiene la ruta base donde se almacenan las skins en el cliente local.
   */
  public getLocalSkinsDir(): string {
    const baseDir = path.join(configStore.getBaseDir(), 'skins');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  }

  /**
   * Guarda o actualiza la skin de un jugador en local y en la nube (Supabase user_skins).
   */
  public async saveUserSkin(data: UserSkinData): Promise<{ success: boolean; message?: string }> {
    const cleanUsername = (data.username || '').trim();
    if (!cleanUsername) {
      return { success: false, message: 'El nombre de usuario no es válido' };
    }

    const lowerUser = cleanUsername.toLowerCase();
    const model = data.model === 'slim' ? 'slim' : 'default';
    const skinsDir = this.getLocalSkinsDir();
    const localPngPath = path.join(skinsDir, `${lowerUser}.png`);
    const localMetaPath = path.join(skinsDir, `${lowerUser}.json`);

    try {
      // 1. Guardar archivo localmente
      if (data.skinData && data.skinData.startsWith('data:image/png;base64,')) {
        const base64Data = data.skinData.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(localPngPath, buffer);
      } else if (data.skinUrl && data.skinUrl.startsWith('http')) {
        // Descargar el PNG remoto al disco local
        await this.downloadSkinFile(data.skinUrl, localPngPath);
      }

      // Guardar metadata local
      fs.writeFileSync(
        localMetaPath,
        JSON.stringify(
          {
            username: cleanUsername,
            model,
            capeUrl: data.capeUrl || null,
            skinUrl: data.skinUrl || '',
            updatedAt: new Date().toISOString()
          },
          null,
          2
        )
      );

      // 2. Guardar en memoria caché
      this.memoryCache.set(lowerUser, {
        skin: {
          username: cleanUsername,
          skinUrl: data.skinUrl || '',
          skinData: data.skinData,
          capeUrl: data.capeUrl || null,
          model,
          updatedAt: new Date().toISOString()
        },
        fetchedAt: Date.now()
      });

      // 3. Sincronizar en la nube (Supabase user_skins)
      if (this.supabase) {
        await this.supabase.from('user_skins').upsert(
          {
            username: cleanUsername,
            skin_url: data.skinUrl || '',
            skin_data: data.skinData || null,
            cape_url: data.capeUrl || null,
            model,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'username' }
        );

        // También registrar en launcher_users para telemetría
        await this.supabase
          .from('launcher_users')
          .update({
            skin_url: data.skinUrl || null,
            skin_model: model
          })
          .ilike('username', cleanUsername);
      }

      // 4. Copiar a la instancia activa si existe CustomSkinLoader
      const instDir = configStore.getInstanceDir();
      this.writeSkinToCustomSkinLoader(instDir, cleanUsername, localPngPath, model, data.capeUrl);

      return { success: true };
    } catch (err: any) {
      console.error('[SkinManager] Error al guardar skin:', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Asegura que el archivo PNG de la skin de un jugador exista en local y sea válido.
   */
  public async ensureLocalSkinPng(username: string): Promise<string | null> {
    const cleanUsername = (username || '').trim();
    if (!cleanUsername) return null;
    const lowerUser = cleanUsername.toLowerCase();
    const skinsDir = this.getLocalSkinsDir();
    const localPngPath = path.join(skinsDir, `${lowerUser}.png`);

    if (fs.existsSync(localPngPath) && fs.statSync(localPngPath).size > 100) {
      return localPngPath;
    }

    // Si no existe, intentar obtenerla desde la caché/base de datos
    const skinData = await this.getUserSkin(cleanUsername);
    if (skinData?.skinData && skinData.skinData.startsWith('data:image/png;base64,')) {
      const base64Data = skinData.skinData.replace(/^data:image\/png;base64,/, '');
      const buf = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(localPngPath, buf);
      return localPngPath;
    } else if (skinData?.skinUrl && skinData.skinUrl.startsWith('http')) {
      try {
        await this.downloadSkinFile(skinData.skinUrl, localPngPath);
        return localPngPath;
      } catch {}
    }

    return fs.existsSync(localPngPath) ? localPngPath : null;
  }

  /**
   * Obtiene los datos de la skin de un jugador por su nombre de usuario.
   */
  public async getUserSkin(username: string): Promise<UserSkinData | null> {
    const cleanUsername = (username || '').trim();
    if (!cleanUsername) return null;
    const lowerUser = cleanUsername.toLowerCase();

    // 1. Revisar memoria caché (válida por 5 minutos)
    const cached = this.memoryCache.get(lowerUser);
    if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
      return cached.skin;
    }

    // 2. Revisar base de datos en la nube (Supabase)
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('user_skins')
          .select('*')
          .ilike('username', cleanUsername)
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          const skinObj: UserSkinData = {
            username: data.username,
            skinUrl: data.skin_url,
            skinData: data.skin_data,
            capeUrl: data.cape_url,
            model: data.model === 'slim' ? 'slim' : 'default',
            updatedAt: data.updated_at
          };

          this.memoryCache.set(lowerUser, { skin: skinObj, fetchedAt: Date.now() });
          return skinObj;
        }
      } catch (err) {
        console.warn('[SkinManager] Error al consultar Supabase:', err);
      }
    }

    // 3. Revisar caché local en disco
    const skinsDir = this.getLocalSkinsDir();
    const localMetaPath = path.join(skinsDir, `${lowerUser}.json`);
    const localPngPath = path.join(skinsDir, `${lowerUser}.png`);

    if (fs.existsSync(localPngPath)) {
      let model: 'default' | 'slim' = 'default';
      let capeUrl: string | null = null;
      let skinUrl = `https://minotar.net/skin/${encodeURIComponent(cleanUsername)}`;

      if (fs.existsSync(localMetaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(localMetaPath, 'utf8'));
          if (meta.model) model = meta.model;
          if (meta.capeUrl) capeUrl = meta.capeUrl;
          if (meta.skinUrl) skinUrl = meta.skinUrl;
        } catch {}
      }

      const skinObj: UserSkinData = {
        username: cleanUsername,
        skinUrl,
        capeUrl,
        model
      };

      this.memoryCache.set(lowerUser, { skin: skinObj, fetchedAt: Date.now() });
      return skinObj;
    }

    return null;
  }

  /**
   * Sincroniza todas las skins de la comunidad en la carpeta de la instancia de Minecraft
   * para que CustomSkinLoader las cargue automáticamente en el juego multijugador.
   */
  public async syncCommunitySkinsToInstance(
    instanceDir: string,
    onLog?: (line: string) => void
  ): Promise<number> {
    if (!fs.existsSync(instanceDir)) return 0;

    const cslDir = path.join(instanceDir, 'CustomSkinLoader');
    const localSkinDir = path.join(cslDir, 'LocalSkin');
    const skinsDir = path.join(localSkinDir, 'skins');
    const capesDir = path.join(localSkinDir, 'capes');

    fs.mkdirSync(skinsDir, { recursive: true });
    fs.mkdirSync(capesDir, { recursive: true });

    // 1. Asegurar la configuración de CustomSkinLoader.json
    this.ensureCustomSkinLoaderConfig(cslDir);

    if (onLog) {
      onLog('[SkinSync] Sincronizando skins de la comunidad para la instancia...');
    }

    let syncedCount = 0;

    // 2. Obtener todas las skins de Supabase
    if (this.supabase) {
      try {
        const { data: communitySkins, error } = await this.supabase
          .from('user_skins')
          .select('username, skin_url, skin_data, model, cape_url, updated_at');

        if (!error && Array.isArray(communitySkins)) {
          for (const item of communitySkins) {
            if (!item.username) continue;
            const uName = item.username.trim();
            const lowerName = uName.toLowerCase();
            const skinFile = path.join(skinsDir, `${uName}.png`);
            const lowerSkinFile = path.join(skinsDir, `${lowerName}.png`);
            const jsonFile = path.join(skinsDir, `${uName}.json`);

            try {
              if (item.skin_data && item.skin_data.startsWith('data:image/png;base64,')) {
                const buf = Buffer.from(item.skin_data.replace(/^data:image\/png;base64,/, ''), 'base64');
                fs.writeFileSync(skinFile, buf);
                if (skinFile !== lowerSkinFile) fs.writeFileSync(lowerSkinFile, buf);
                syncedCount++;
              } else if (item.skin_url && item.skin_url.startsWith('http')) {
                // Descargar si no existe o ha cambiado
                if (!fs.existsSync(skinFile)) {
                  await this.downloadSkinFile(item.skin_url, skinFile);
                  if (skinFile !== lowerSkinFile && fs.existsSync(skinFile)) {
                    fs.copyFileSync(skinFile, lowerSkinFile);
                  }
                  syncedCount++;
                }
              }

              // Guardar modelo (slim / default)
              if (item.model === 'slim') {
                fs.writeFileSync(jsonFile, JSON.stringify({ model: 'slim' }));
              }
            } catch (err) {
              console.warn(`[SkinSync] Error al sincronizar skin de ${uName}:`, err);
            }
          }
        }
      } catch (err) {
        console.warn('[SkinSync] Error al obtener skins comunitarias de Supabase:', err);
      }
    }

    if (onLog) {
      onLog(`[SkinSync] ✅ ¡Sincronizadas ${syncedCount} skins comunitarias en el modpack!`);
    }

    return syncedCount;
  }

  /**
   * Escribe la skin de un jugador específico directamente en la carpeta de CustomSkinLoader.
   */
  private writeSkinToCustomSkinLoader(
    instanceDir: string,
    username: string,
    pngPath: string,
    model: string,
    capeUrl?: string | null
  ) {
    try {
      const skinsDir = path.join(instanceDir, 'CustomSkinLoader', 'LocalSkin', 'skins');
      if (!fs.existsSync(skinsDir)) {
        fs.mkdirSync(skinsDir, { recursive: true });
      }

      const destPng = path.join(skinsDir, `${username}.png`);
      const destLowerPng = path.join(skinsDir, `${username.toLowerCase()}.png`);
      if (fs.existsSync(pngPath)) {
        fs.copyFileSync(pngPath, destPng);
        if (destPng !== destLowerPng) {
          fs.copyFileSync(pngPath, destLowerPng);
        }
      }

      if (model === 'slim') {
        fs.writeFileSync(path.join(skinsDir, `${username}.json`), JSON.stringify({ model: 'slim' }));
      }
    } catch (err) {
      console.warn(`[SkinManager] Error escribiendo a CustomSkinLoader:`, err);
    }
  }

  /**
   * Crea la configuración oficial de CustomSkinLoader para que cargue LocalSkin en primer lugar.
   */
  private ensureCustomSkinLoaderConfig(cslDir: string) {
    const configPath = path.join(cslDir, 'CustomSkinLoader.json');
    const cslConfig = {
      enable: true,
      loadlist: [
        {
          name: 'LocalSkin',
          type: 'LocalSkin'
        },
        {
          name: 'Mojang',
          type: 'Mojang'
        },
        {
          name: 'ElyBy',
          type: 'ElyBy'
        }
      ]
    };

    try {
      fs.writeFileSync(configPath, JSON.stringify(cslConfig, null, 2), 'utf8');
    } catch (err) {
      console.warn('[SkinManager] Error escribiendo CustomSkinLoader.json:', err);
    }
  }

  /**
   * Descarga un archivo de imagen PNG desde una URL HTTP/HTTPS.
   */
  private downloadSkinFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client
        .get(url, { headers: { 'User-Agent': 'Rafa-MC-Launcher-SkinSync' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return this.downloadSkinFile(res.headers.location, dest).then(resolve).catch(reject);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          const file = fs.createWriteStream(dest);
          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
          file.on('error', (err) => {
            fs.unlink(dest, () => reject(err));
          });
        })
        .on('error', reject);
    });
  }
}

export const skinManager = new SkinManager();
