import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { BrowserWindow } from 'electron';

const SUPABASE_URL = 'https://wukhkwwstsfvqcnyqoqu.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1a2hrd3dzdHNmdnFjbnlxb3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDk5NDUsImV4cCI6MjEwMjkyNTk0NX0.2NfFdLXOH4LHNJyAAqAeeUxtWsGnt6mcrT1VhQ22qzg';

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
  private supabase: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private cachedConfig: RemoteLauncherConfig | null = null;
  private cachedNews: NewsAnnouncement[] = [];
  private getMainWindow: (() => BrowserWindow | null) | null = null;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
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

    // 2. Realtime WebSocket Listener
    try {
      this.channel = this.supabase
        .channel('launcher-client-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'launcher_config' },
          (payload) => {
            console.log('[RemoteConfig] ⚡ Cambio en vivo recibido de Supabase Realtime!');
            if (payload.new) {
              this.cachedConfig = payload.new as RemoteLauncherConfig;
              this.broadcastConfig(this.cachedConfig);
            } else {
              this.fetchRemoteConfig().then((cfg) => {
                if (cfg) this.broadcastConfig(cfg);
              });
            }
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
      const cfg = await this.fetchRemoteConfig();
      if (cfg) this.broadcastConfig(cfg);
      const news = await this.fetchNews();
      this.broadcastNews(news);
    }, 10000);
  }

  private broadcastConfig(config: RemoteLauncherConfig): void {
    const win = this.getMainWindow?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send('remote:config-updated', config);
    }
  }

  private broadcastNews(news: NewsAnnouncement[]): void {
    const win = this.getMainWindow?.();
    if (win && !win.isDestroyed()) {
      win.webContents.send('remote:news-updated', news);
    }
  }

  public async fetchRemoteConfig(): Promise<RemoteLauncherConfig | null> {
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

  public getCachedConfig(): RemoteLauncherConfig | null {
    return this.cachedConfig;
  }
}

export const remoteConfigManager = new RemoteConfigManager();
