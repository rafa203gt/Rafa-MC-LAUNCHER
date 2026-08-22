import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { BrowserWindow } from 'electron';
import WebSocket from 'ws';
import os from 'node:os';
import { ENV } from './env';

// Polyfill globalThis.WebSocket for Electron Node.js environment
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

const SUPABASE_URL = ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY;

export interface RemoteLauncherConfig {
  id: string;
  server_name: string;
  server_ip: string;
  server_port: number;
  auto_connect: boolean;
  minecraft_version: string;
  mod_loader: string;
  mod_loader_version: string;
  modpack_manifest_url: string;
  news_feed_url: string;
  maintenance_mode: boolean;
  maintenance_message: string;
  banner_alert: string | null;
  banner_alert_type: 'info' | 'warning' | 'error' | 'success';
  discord_url: string;
  min_launcher_version: string;
}

export interface NewsAnnouncement {
  id: string;
  title: string;
  content: string;
  category: 'update' | 'event' | 'server' | 'maintenance';
  image_url?: string;
  pinned: boolean;
  is_active: boolean;
  created_at: string;
}

export class RemoteConfigManager {
  private supabase: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private cachedConfig: RemoteLauncherConfig | null = null;
  private cachedNews: NewsAnnouncement[] = [];
  private getMainWindow: (() => BrowserWindow | null) | null = null;

  constructor() {
    try {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
      });
    } catch (err: any) {
      console.warn(`[RemoteConfig] No se pudo inicializar Supabase client: ${err.message}`);
    }
  }

  public initRealtime(getMainWindow: () => BrowserWindow | null): void {
    this.getMainWindow = getMainWindow;

    // 1. Initial fetch
    this.fetchRemoteConfig().then((cfg) => {
      if (cfg) this.broadcastConfig(cfg);
    });
    this.fetchNews().then((news) => {
      this.broadcastNews(news);
    });

    if (!this.supabase) return;

    // 2. Realtime WebSocket Listener
    try {
      this.channel = this.supabase
        .channel('launcher-client-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'launcher_config' },
          async (payload) => {
            console.log('[RemoteConfig] ⚡ Cambio en vivo recibido de Supabase Realtime (launcher_config)!');
            if (payload.new) {
              this.cachedConfig = payload.new as RemoteLauncherConfig;
              this.broadcastConfig(this.cachedConfig);
            } else {
              this.fetchRemoteConfig().then((cfg) => {
                if (cfg) this.broadcastConfig(cfg);
              });
            }
            try {
              const { instanceManager } = await import('./instance-manager');
              const list = await instanceManager.syncRemoteInstances();
              this.broadcastInstances(list);
            } catch {}
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'instances' },
          async () => {
            console.log('[RemoteConfig] 📦 Cambio en vivo de instancias recibido de Supabase!');
            try {
              const { instanceManager } = await import('./instance-manager');
              const list = await instanceManager.syncRemoteInstances();
              this.broadcastInstances(list);
            } catch {}
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'news_announcements' },
          () => {
            console.log('[RemoteConfig] 📰 Actualización de noticias recibida de Supabase!');
            this.fetchNews().then((news) => {
              this.broadcastNews(news);
            });
          }
        )
        .subscribe((status) => {
          console.log(`[RemoteConfig] Estado de conexión Supabase Realtime: ${status}`);
        });
    } catch (err: any) {
      console.warn(`[RemoteConfig] Error iniciando Realtime: ${err.message}`);
    }

    // 3. Fallback Periodic Polling every 10 seconds
    setInterval(async () => {
      try {
        const cfg = await this.fetchRemoteConfig();
        if (cfg) this.broadcastConfig(cfg);
        const news = await this.fetchNews();
        this.broadcastNews(news);
        const { instanceManager } = await import('./instance-manager');
        const list = await instanceManager.syncRemoteInstances();
        this.broadcastInstances(list);
      } catch {}
    }, 10000);
  }

  private broadcastInstances(instances: any[]): void {
    try {
      const win = this.getMainWindow?.();
      if (win && !win.isDestroyed()) {
        win.webContents.send('launcher:instances-updated', instances);
      }
    } catch {}
  }

  private broadcastConfig(config: RemoteLauncherConfig): void {
    try {
      const win = this.getMainWindow?.();
      if (win && !win.isDestroyed()) {
        win.webContents.send('remote:config-updated', config);
      }
    } catch {}
  }

  private broadcastNews(news: NewsAnnouncement[]): void {
    try {
      const win = this.getMainWindow?.();
      if (win && !win.isDestroyed()) {
        win.webContents.send('remote:news-updated', news);
      }
    } catch {}
  }

  public async fetchRemoteConfig(): Promise<RemoteLauncherConfig | null> {
    if (!this.supabase) return this.cachedConfig;
    try {
      const { data, error } = await this.supabase
        .from('launcher_config')
        .select('*')
        .eq('id', 'global')
        .single();

      if (error) {
        return this.cachedConfig;
      }

      if (data) {
        this.cachedConfig = data as RemoteLauncherConfig;
        return this.cachedConfig;
      }
    } catch {
      // Fallback to cache silently
    }
    return this.cachedConfig;
  }

  public async fetchNews(): Promise<NewsAnnouncement[]> {
    if (!this.supabase) return this.cachedNews;
    try {
      const { data, error } = await this.supabase
        .from('news_announcements')
        .select('*')
        .eq('is_active', true)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        return this.cachedNews;
      }

      if (data) {
        this.cachedNews = data as NewsAnnouncement[];
        return this.cachedNews;
      }
    } catch {
      // Fallback
    }
    return this.cachedNews;
  }

  public async fetchRemoteInstances(): Promise<{ active: any[]; allRemoteIds: string[] }> {
    if (!this.supabase) return { active: [], allRemoteIds: [] };
    try {
      let { data, error } = await this.supabase
        .from('instances')
        .select('*')
        .order('is_default', { ascending: false });

      if (error || !data || data.length === 0) {
        const alt = await this.supabase
          .from('remote_instances')
          .select('*')
          .order('is_default', { ascending: false });
        if (!alt.error && alt.data && alt.data.length > 0) {
          data = alt.data;
        }
      }

      if (data && data.length > 0) {
        const active = data.filter((i) => i.is_active === true || i.is_active === 'true' || i.is_active === undefined);
        const allRemoteIds = data.map((i) => i.id);
        return { active, allRemoteIds };
      }
      return { active: [], allRemoteIds: [] };
    } catch {
      return { active: [], allRemoteIds: [] };
    }
  }

  public async fetchRemoteMods(instanceId: string = 'atm10'): Promise<any[]> {
    if (!this.supabase) return [];
    try {
      const PAGE_SIZE = 1000;
      let allMods: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await this.supabase
          .from('modpack_mods')
          .select('*')
          .eq('instance_id', instanceId)
          .eq('is_enabled', true)
          .range(from, from + PAGE_SIZE - 1);

        if (error || !data || data.length === 0) {
          break;
        }
        allMods = allMods.concat(data);
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }
      return allMods;
    } catch {
      return [];
    }
  }

  public async reportCrash(data: {
    username: string;
    minecraftVersion: string;
    launcherVersion: string;
    ramAllocated: number;
    errorMessage?: string;
    crashLog?: string;
  }): Promise<boolean> {
    if (!this.supabase) return false;
    try {
      const { error } = await this.supabase.from('crash_reports').insert({
        username: data.username || 'Jugador',
        minecraft_version: data.minecraftVersion || '1.21.1',
        launcher_version: data.launcherVersion || '1.0.0',
        ram_allocated: data.ramAllocated || 4096,
        os_info: `${process.platform} ${process.arch}`,
        error_message: data.errorMessage || 'Minecraft finalizó de forma inesperada.',
        crash_log: data.crashLog || '',
        resolved: false
      });
      if (error) {
        console.warn(`[RemoteConfig] Error reportando crash a Supabase: ${error.message}`);
        return false;
      }
      console.log('[RemoteConfig] 🐞 Reporte de crash enviado con éxito a Supabase');
      return true;
    } catch (err: any) {
      console.warn(`[RemoteConfig] No se pudo enviar reporte de crash: ${err.message}`);
      return false;
    }
  }

  private async getPublicIp(): Promise<string> {
    try {
      const axios = (await import('axios')).default;
      const res = await axios.get('https://api.ipify.org?format=json', { timeout: 2500 });
      if (res.data && res.data.ip) {
        return String(res.data.ip).trim();
      }
    } catch {
      try {
        const axios = (await import('axios')).default;
        const res = await axios.get('https://icanhazip.com', { timeout: 2000 });
        if (res.data) {
          return String(res.data).trim();
        }
      } catch {}
    }
    return 'Desconocida';
  }

  public async trackUserActivity(data: {
    playerUsername?: string;
    lastInstancePlayed?: string;
    isGameLaunch?: boolean;
  }): Promise<boolean> {
    if (!this.supabase) return false;
    try {
      const { configStore } = await import('./config-store');
      const clientId = configStore.getClientId();
      const hostname = os.hostname() || 'PC';
      let username = 'Usuario';
      try {
        username = os.userInfo()?.username || 'Usuario';
      } catch {}
      const deviceName = `${hostname} (${username})`;
      const platform = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';
      const osPlatform = `${platform} (${process.arch}, ${os.release()})`;
      const totalRamGb = Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
      const ipAddress = await this.getPublicIp();

      // 1. Check existing record
      const { data: existing } = await this.supabase
        .from('launcher_users')
        .select('client_id, launch_count, first_seen')
        .eq('client_id', clientId)
        .maybeSingle();

      const currentLaunchCount = Number(existing?.launch_count) || 0;
      const nextLaunchCount = data.isGameLaunch ? currentLaunchCount + 1 : Math.max(1, currentLaunchCount);

      const payload = {
        client_id: clientId,
        device_name: deviceName,
        player_username: data.playerUsername || 'Jugador',
        os_platform: osPlatform,
        total_ram_gb: totalRamGb,
        launcher_version: '1.0.27',
        last_instance_played: data.lastInstancePlayed || 'atm10',
        launch_count: nextLaunchCount,
        last_seen: new Date().toISOString(),
        is_online: true,
        ip_address: ipAddress
      };

      const { error } = await this.supabase.from('launcher_users').upsert(payload, { onConflict: 'client_id' });
      if (error) {
        console.warn(`[RemoteConfig] Aviso registrando actividad de usuario: ${error.message}`);
        return false;
      }
      console.log(`[RemoteConfig] 👤 Registro de usuario sincronizado: ${deviceName} (IP: ${ipAddress})`);
      return true;
    } catch (err: any) {
      console.warn(`[RemoteConfig] Error en tracking de usuario: ${err.message}`);
      return false;
    }
  }

  public getCachedConfig(): RemoteLauncherConfig | null {
    return this.cachedConfig;
  }
}

export const remoteConfigManager = new RemoteConfigManager();

