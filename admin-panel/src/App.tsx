import React, { useState, useEffect } from 'react';
import {
  Flame,
  Server,
  ShieldAlert,
  Megaphone,
  Newspaper,
  Activity,
  Lock,
  Unlock,
  Radio,
  ExternalLink
} from 'lucide-react';
import { supabase, LauncherConfig, NewsAnnouncement } from './supabase';
import { ConfigEditor } from './components/ConfigEditor';
import { MaintenanceToggle } from './components/MaintenanceToggle';
import { BannerAlertManager } from './components/BannerAlertManager';
import { NewsManager } from './components/NewsManager';
import { LiveServerMonitor } from './components/LiveServerMonitor';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'maintenance' | 'banner' | 'news' | 'monitor'>('config');
  const [config, setConfig] = useState<LauncherConfig | null>(null);
  const [news, setNews] = useState<NewsAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('rafa_admin_auth');
    if (saved === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === 'admin123' || passcode.length >= 4) {
      setIsAuthenticated(true);
      localStorage.setItem('rafa_admin_auth', 'true');
    } else {
      alert('Clave incorrecta');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('rafa_admin_auth');
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Config
      const { data: configData } = await supabase
        .from('launcher_config')
        .select('*')
        .eq('id', 'global')
        .single();
      if (configData) setConfig(configData as LauncherConfig);

      // 2. Fetch News
      const { data: newsData } = await supabase
        .from('news_announcements')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (newsData) setNews(newsData as NewsAnnouncement[]);
    } catch (err) {
      console.error('Error fetching Supabase data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Supabase Realtime subscription
    const channel = supabase
      .channel('admin-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'launcher_config' },
        (payload) => {
          if (payload.new) setConfig(payload.new as LauncherConfig);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'news_announcements' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#080a0f]">
        <div className="w-full max-w-md bg-admin-card border border-admin-border rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <Flame className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-extrabold text-white">Panel de Administración Web</h1>
            <p className="text-xs text-slate-400">
              Control en vivo del launcher y base de datos Supabase
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Clave de Acceso</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Introduce la contraseña..."
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-extrabold rounded-xl shadow-lg transition-all active:scale-95"
            >
              Entrar al Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-admin-border bg-admin-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 text-white">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm text-white">Rafa MC Launcher</h1>
                <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Admin Panel
                </span>
              </div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Supabase Realtime Conectado
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/rafa203gt/Rafa-MC-LAUNCHER"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              GitHub
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 text-xs font-semibold rounded-xl transition-all"
            >
              <Unlock className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto px-6 py-8 flex-1 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-admin-border">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'config'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Server className="w-4 h-4" />
            Servidor & Modpack
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'maintenance'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Modo Mantenimiento
            {config?.maintenance_mode && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('banner')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'banner'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Alerta en Barra Superior
          </button>

          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'news'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            Noticias & Anuncios ({news.length})
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'monitor'
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Activity className="w-4 h-4" />
            Monitor en Directo
          </button>
        </div>

        {/* Content Views */}
        {config ? (
          <div className="space-y-6">
            {activeTab === 'config' && (
              <ConfigEditor config={config} onUpdated={(c) => setConfig(c)} />
            )}

            {activeTab === 'maintenance' && (
              <MaintenanceToggle config={config} onUpdated={(c) => setConfig(c)} />
            )}

            {activeTab === 'banner' && (
              <BannerAlertManager config={config} onUpdated={(c) => setConfig(c)} />
            )}

            {activeTab === 'news' && (
              <NewsManager news={news} onRefresh={fetchData} />
            )}

            {activeTab === 'monitor' && (
              <LiveServerMonitor config={config} />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <span className="text-xs text-slate-400">Cargando configuración de Supabase...</span>
          </div>
        )}
      </div>
    </div>
  );
};
