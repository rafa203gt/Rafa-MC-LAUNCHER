import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

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
  private cachedConfig: RemoteLauncherConfig | null = null;
  private cachedNews: NewsAnnouncement[] = [];

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
  }

  public async fetchRemoteConfig(): Promise<RemoteLauncherConfig | null> {
    try {
      const { data, error } = await this.supabase
        .from('launcher_config')
        .select('*')
        .eq('id', 'global')
        .single();

      if (error) {
        console.warn(`[RemoteConfig] Error de consulta en Supabase: ${error.message}`);
        return this.cachedConfig;
      }

      if (data) {
        this.cachedConfig = data as RemoteLauncherConfig;
        console.log(`[RemoteConfig] ✅ Configuración remota sincronizada desde Supabase (${data.server_name} - ${data.server_ip})`);
        return this.cachedConfig;
      }
    } catch (err: any) {
      console.warn(`[RemoteConfig] No se pudo conectar con Supabase: ${err.message}`);
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
        console.warn(`[RemoteConfig] Error obteniendo noticias de Supabase: ${error.message}`);
        return this.cachedNews;
      }

      if (data) {
        this.cachedNews = data as NewsAnnouncement[];
        return this.cachedNews;
      }
    } catch (err: any) {
      console.warn(`[RemoteConfig] No se pudieron obtener noticias remotas: ${err.message}`);
    }
    return this.cachedNews;
  }

  public getCachedConfig(): RemoteLauncherConfig | null {
    return this.cachedConfig;
  }
}

export const remoteConfigManager = new RemoteConfigManager();
