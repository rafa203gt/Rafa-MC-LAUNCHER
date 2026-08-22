import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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

export interface RemoteInstance {
  id: string;
  name: string;
  description: string;
  minecraft_version: string;
  mod_loader: 'fabric' | 'forge' | 'neoforge' | 'vanilla';
  mod_loader_version: string;
  modpack_manifest_url: string;
  server_ip: string;
  server_port: number;
  custom_ram: number;
  icon: string;
  banner_url?: string;
  is_official: boolean;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
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

export interface ModpackMod {
  id: string;
  instance_id: string;
  mod_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  sha1: string;
  download_url: string;
  is_enabled: boolean;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Shaderpack {
  id: string;
  name: string;
  description: string;
  performance_tier: 'fast' | 'balanced' | 'ultra';
  download_url: string;
  file_name: string;
  file_size: number;
  preview_image?: string;
  is_active: boolean;
  created_at: string;
}

export interface CrashReport {
  id: string;
  username: string;
  minecraft_version: string;
  launcher_version: string;
  ram_allocated: number;
  os_info?: string;
  error_message?: string;
  crash_log?: string;
  resolved: boolean;
  created_at: string;
}

export interface LauncherUser {
  client_id: string;
  device_name: string;
  player_username?: string;
  os_platform?: string;
  total_ram_gb?: number;
  launcher_version?: string;
  last_instance_played?: string;
  launch_count: number;
  first_seen: string;
  last_seen: string;
  is_online?: boolean;
  ip_address?: string;
}
