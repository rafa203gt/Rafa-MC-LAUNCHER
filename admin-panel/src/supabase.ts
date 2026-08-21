import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://wukhkwwstsfvqcnyqoqu.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1a2hrd3dzdHNmdnFjbnlxb3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDk5NDUsImV4cCI6MjEwMjkyNTk0NX0.2NfFdLXOH4LHNJyAAqAeeUxtWsGnt6mcrT1VhQ22qzg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface LauncherConfig {
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
  updated_at: string;
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
