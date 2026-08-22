import React, { useState, useEffect } from 'react';
import {
  Flame,
  Server,
  ShieldAlert,
  Megaphone,
  Newspaper,
  Layers,
  Bug,
  Activity,
  Lock,
  Mail,
  LogOut,
  ExternalLink,
  Box,
  UserCheck,
  AlertCircle,
  Sparkles,
  Cloud,
  Users
} from 'lucide-react';
import {
  supabase,
  LauncherConfig,
  NewsAnnouncement,
  ModpackMod,
  CrashReport,
  RemoteInstance,
  Shaderpack,
  LauncherUser
} from './supabase';
import { ConfigEditor } from './components/ConfigEditor';
import { MaintenanceToggle } from './components/MaintenanceToggle';
import { BannerAlertManager } from './components/BannerAlertManager';
import { NewsManager } from './components/NewsManager';
import { ModpackManager } from './components/ModpackManager';
import { InstancesManager } from './components/InstancesManager';
import { ShadersManager } from './components/ShadersManager';
import { CrashAnalytics } from './components/CrashAnalytics';
import { LiveServerMonitor } from './components/LiveServerMonitor';
import { CloudAssetManager } from './components/CloudAssetManager';
import { UsersAnalytics } from './components/UsersAnalytics';

export const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'cloud_assets' | 'instances' | 'users' | 'mods' | 'shaders' | 'config' | 'maintenance' | 'banner' | 'news' | 'crashes' | 'monitor'
  >('cloud_assets');
  const [config, setConfig] = useState<LauncherConfig | null>(null);
  const [instances, setInstances] = useState<RemoteInstance[]>([]);
  const [users, setUsers] = useState<LauncherUser[]>([]);
  const [news, setNews] = useState<NewsAnnouncement[]>([]);
  const [mods, setMods] = useState<ModpackMod[]>([]);
  const [shaders, setShaders] = useState<Shaderpack[]>([]);
  const [crashes, setCrashes] = useState<CrashReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Supabase Auth Session Management
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;
        if (data.session) {
          setSession(data.session);
        } else {
          setAuthSuccess('¡Cuenta creada! Revisa tu correo si requiere confirmación o inicia sesión.');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        setSession(data.session);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error durante la autenticación');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const fetchData = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      // 1. Config
      const { data: configData } = await supabase
        .from('launcher_config')
        .select('*')
        .eq('id', 'global')
        .single();
      if (configData) setConfig(configData as LauncherConfig);

      // 2. Instances
      let { data: instData, error: instErr } = await supabase
        .from('instances')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (instErr || !instData || instData.length === 0) {
        const alt = await supabase
          .from('remote_instances')
          .select('*')
          .order('is_default', { ascending: false })
          .order('name', { ascending: true });
        if (!alt.error && alt.data) instData = alt.data;
      }
      if (instData) setInstances(instData as RemoteInstance[]);

      // 3. News
      const { data: newsData } = await supabase
        .from('news_announcements')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (newsData) setNews(newsData as NewsAnnouncement[]);

      // 4. Mods
      const { data: modsData } = await supabase
        .from('modpack_mods')
        .select('*')
        .order('mod_name', { ascending: true });
      if (modsData) setMods(modsData as ModpackMod[]);

      // 5. Shaders
      const { data: shadersData } = await supabase
        .from('shaderpacks')
        .select('*')
        .order('name', { ascending: true });
      if (shadersData) setShaders(shadersData as Shaderpack[]);

      // 6. Crashes
      const { data: crashData } = await supabase
        .from('crash_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (crashData) setCrashes(crashData as CrashReport[]);

      // 7. Users / Telemetry
      const { data: usersData } = await supabase
        .from('launcher_users')
        .select('*')
        .order('last_seen', { ascending: false });
      if (usersData) setUsers(usersData as LauncherUser[]);
    } catch (err) {
      console.error('Error fetching Supabase data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    fetchData();

    // Supabase Realtime subscriptions
    const channel = supabase
      .channel('admin-realtime-full-instances')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'launcher_config' },
        (payload) => {
          if (payload.new) setConfig(payload.new as LauncherConfig);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instances' },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'launcher_users' },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shaderpacks' },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'news_announcements' },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'modpack_mods' },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crash_reports' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080a0f] text-slate-400 text-xs">
        <div className="flex flex-col items-center gap-3">
          <Flame className="w-8 h-8 text-emerald-400 animate-pulse" />
          <span>Verificando sesión segura de Supabase Auth...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#080a0f]">
        <div className="w-full max-w-md bg-admin-card border border-admin-border rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <Flame className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-extrabold text-white">Panel de Administración</h1>
            <p className="text-xs text-slate-400">Acceso Seguro mediante Supabase Authentication</p>
          </div>

          {authError && (
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs animate-fadeIn">
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Correo Electrónico</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="admin@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-extrabold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isSignUp ? 'Crear Cuenta de Administrador' : 'Iniciar Sesión con Supabase'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-admin-border/50">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
                setAuthSuccess(null);
              }}
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
            >
              {isSignUp
                ? '¿Ya tienes cuenta de Supabase? Inicia sesión'
                : '¿Nuevo administrador? Crear cuenta'}
            </button>
          </div>
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
                {session?.user?.email || 'Autenticado'}
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
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto px-6 py-8 flex-1 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-admin-border">
          <button
            onClick={() => setActiveTab('cloud_assets')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'cloud_assets'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Cloud className="w-4 h-4" />
            Nube & Modpacks ZIP (Ilimitado)
          </button>

          <button
            onClick={() => setActiveTab('instances')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'instances'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Box className="w-4 h-4" />
            Instancias ({instances.length})
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Users className="w-4 h-4" />
            Jugadores & Equipos ({users.length})
          </button>

          <button
            onClick={() => setActiveTab('mods')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'mods'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Layers className="w-4 h-4" />
            Gestor de Mods ({mods.length})
          </button>

          <button
            onClick={() => setActiveTab('shaders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'shaders'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Shaders ({shaders.length})
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'config'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Server className="w-4 h-4" />
            Ajustes Globales
          </button>

          <button
            onClick={() => setActiveTab('crashes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'crashes'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Bug className="w-4 h-4" />
            Crashes & Logs
            {crashes.filter((c) => !c.resolved).length > 0 && (
              <span className="bg-rose-500/30 text-rose-300 text-[10px] px-1.5 py-0.2 rounded-full border border-rose-500/40">
                {crashes.filter((c) => !c.resolved).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'maintenance'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
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
            Alerta en Barra
          </button>

          <button
            onClick={() => setActiveTab('news')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'news'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : 'text-slate-400 hover:text-white hover:bg-admin-card'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            Noticias ({news.length})
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
            Monitor Servidor
          </button>
        </div>

        {/* Content Views */}
        {config ? (
          <div className="space-y-6">
            {activeTab === 'cloud_assets' && (
              <CloudAssetManager />
            )}

            {activeTab === 'instances' && (
              <InstancesManager instances={instances} onRefresh={fetchData} />
            )}

            {activeTab === 'users' && (
              <UsersAnalytics users={users} onRefresh={fetchData} isLoading={isLoading} />
            )}

            {activeTab === 'mods' && (
              <ModpackManager mods={mods} instances={instances} onRefresh={fetchData} />
            )}

            {activeTab === 'shaders' && (
              <ShadersManager shaders={shaders} onRefresh={fetchData} />
            )}

            {activeTab === 'config' && (
              <ConfigEditor config={config} onUpdated={(c) => setConfig(c)} />
            )}

            {activeTab === 'crashes' && (
              <CrashAnalytics reports={crashes} onRefresh={fetchData} />
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
