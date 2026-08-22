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
  Users,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Menu,
  X,
  Zap,
  TrendingUp,
  Shield
} from 'lucide-react';
import {
  supabase,
  fetchAllRows,
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

type TabKey =
  | 'cloud_assets'
  | 'instances'
  | 'users'
  | 'mods'
  | 'shaders'
  | 'config'
  | 'maintenance'
  | 'banner'
  | 'news'
  | 'crashes'
  | 'monitor';

export const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('cloud_assets');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

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
      setAuthError(err.message || 'Error en la autenticación.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // 2. Data Fetching
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [
        { data: confData },
        { data: instData },
        { data: usersData },
        { data: newsData },
        modsData,
        { data: shadersData },
        { data: crashData }
      ] = await Promise.all([
        supabase.from('launcher_config').select('*').limit(1).single(),
        supabase.from('instances').select('*').order('created_at', { ascending: true }),
        supabase.from('launcher_users').select('*').order('last_seen', { ascending: false }),
        supabase.from('launcher_news').select('*').order('created_at', { ascending: false }),
        fetchAllRows<ModpackMod>('modpack_mods', undefined, 'file_name'),
        supabase.from('shaderpacks').select('*').order('name', { ascending: true }),
        supabase.from('crash_reports').select('*').order('created_at', { ascending: false })
      ]);

      if (confData) setConfig(confData);
      if (instData) setInstances(instData);
      if (usersData) setUsers(usersData);
      if (newsData) setNews(newsData);
      if (modsData) {
        const validJarMods = modsData.filter(
          (m) =>
            (m.category === 'mod' || m.category === 'mods' || !m.category) &&
            !m.file_path?.startsWith('config/') &&
            !m.file_path?.startsWith('defaultconfigs/') &&
            !m.file_path?.startsWith('shaderpacks/') &&
            (m.file_name?.endsWith('.jar') || m.file_path?.startsWith('mods/'))
        );
        setMods(validJarMods);
      }
      if (shadersData) setShaders(shadersData);
      if (crashData) setCrashes(crashData);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();

      // Realtime subscriptions
      const channels = supabase
        .channel('admin_realtime_all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'launcher_config' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'instances' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'launcher_users' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'launcher_news' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'modpack_mods' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shaderpacks' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crash_reports' }, () => fetchData())
        .subscribe();

      return () => {
        supabase.removeChannel(channels);
      };
    }
  }, [session]);

  // ═══════════════════════════════════════
  //  LOADING SCREEN
  // ═══════════════════════════════════════
  if (authLoading) {
    return (
      <div className="min-h-screen bg-obs-base bg-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-up">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 animate-float">
              <Flame className="w-8 h-8 text-white stroke-[2.5]" />
            </div>
            <div className="absolute -inset-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl blur-xl -z-10 animate-glow-pulse" />
          </div>
          <div className="text-center space-y-1.5">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <span className="text-[11px] font-mono tracking-[0.2em] text-obs-muted uppercase block">
              Conectando con Supabase
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  LOGIN SCREEN
  // ═══════════════════════════════════════
  if (!session) {
    return (
      <div className="min-h-screen bg-obs-base bg-mesh flex items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient light orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/[0.04] rounded-full blur-3xl pointer-events-none animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/[0.04] rounded-full blur-3xl pointer-events-none animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none animate-float" style={{ animationDelay: '4s' }} />

        <div className="max-w-[420px] w-full relative z-10 animate-fade-up">
          {/* Glass login card */}
          <div className="glass-card rounded-3xl p-8 space-y-7 shadow-2xl shadow-black/40">
            {/* Logo */}
            <div className="text-center space-y-3">
              <div className="relative inline-block">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/30">
                  <Flame className="w-9 h-9 text-white stroke-[2.2]" />
                </div>
                <div className="absolute -inset-1.5 bg-gradient-to-br from-indigo-500/25 to-purple-500/25 rounded-2xl blur-lg -z-10 animate-glow-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Rafa MC Admin</h1>
                <p className="text-xs text-obs-muted mt-1">Panel de control en tiempo real para Modpacks, Telemetría e Instancias</p>
              </div>
            </div>

            {/* Auth Alerts */}
            {authError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-2xl text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-emerald-300 text-xs flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{authSuccess}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-obs-muted uppercase tracking-wider">Correo Electrónico</label>
                <div className="relative group">
                  <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@servidor.com"
                    className="w-full bg-obs-base/80 border border-obs-border hover:border-obs-border-light focus:border-indigo-500/60 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-obs-muted uppercase tracking-wider">Contraseña</label>
                <div className="relative group">
                  <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-obs-base/80 border border-obs-border hover:border-obs-border-light focus:border-indigo-500/60 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-600 hover:from-indigo-400 hover:via-purple-400 hover:to-violet-500 text-white text-sm font-bold rounded-xl shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 flex items-center justify-center gap-2.5 disabled:opacity-50 active:scale-[0.98]"
              >
                {authLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    {isSignUp ? 'Crear Cuenta de Administrador' : 'Iniciar Sesión en el Panel'}
                  </>
                )}
              </button>
            </form>

            {/* Toggle auth mode */}
            <div className="text-center pt-3 border-t border-obs-border/60">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
                className="text-xs text-obs-muted hover:text-indigo-400 transition-colors duration-200"
              >
                {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿Nuevo administrador? Crear cuenta'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-slate-600 mt-5 font-mono">
            Rafa MC Launcher Admin Suite — Powered by Supabase
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  NAVIGATION DEFINITION
  // ═══════════════════════════════════════
  const unresolvedCrashes = crashes.filter((c) => !c.resolved).length;

  const navGroups = [
    {
      title: 'MODPACKS & CONTENIDO',
      emoji: '📦',
      items: [
        {
          key: 'cloud_assets' as TabKey,
          label: 'Nube Ilimitada & ZIP',
          icon: Cloud,
          accent: 'indigo',
          badge: 'PRO',
          badgeStyle: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25'
        },
        {
          key: 'instances' as TabKey,
          label: 'Instancias & Perfiles',
          icon: Box,
          accent: 'blue',
          badge: instances.length > 0 ? instances.length.toString() : undefined,
          badgeStyle: 'bg-blue-500/15 text-blue-300 border-blue-500/25'
        },
        {
          key: 'mods' as TabKey,
          label: 'Gestor de Mods .JAR',
          icon: Layers,
          accent: 'purple',
          badge: mods.length > 0 ? mods.length.toString() : undefined,
          badgeStyle: 'bg-purple-500/15 text-purple-300 border-purple-500/25'
        },
        {
          key: 'shaders' as TabKey,
          label: 'Shaders & Packs',
          icon: Sparkles,
          accent: 'amber',
          badge: shaders.length > 0 ? shaders.length.toString() : undefined,
          badgeStyle: 'bg-amber-500/15 text-amber-300 border-amber-500/25'
        }
      ]
    },
    {
      title: 'TELEMETRÍA & AUDITORÍA',
      emoji: '📊',
      items: [
        {
          key: 'users' as TabKey,
          label: 'Jugadores & Dispositivos',
          icon: Users,
          accent: 'emerald',
          badge: users.length > 0 ? users.length.toString() : undefined,
          badgeStyle: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
        },
        {
          key: 'crashes' as TabKey,
          label: 'Crashes & Asistente IA',
          icon: Bug,
          accent: 'rose',
          badge: unresolvedCrashes > 0 ? unresolvedCrashes.toString() : undefined,
          badgeStyle: unresolvedCrashes > 0
            ? 'bg-rose-500/25 text-rose-200 border-rose-500/40 animate-pulse'
            : 'bg-rose-500/15 text-rose-300 border-rose-500/25'
        },
        {
          key: 'monitor' as TabKey,
          label: 'Monitor en Vivo',
          icon: Activity,
          accent: 'cyan',
          badge: 'LIVE',
          badgeStyle: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
        }
      ]
    },
    {
      title: 'CONTROL & SISTEMA',
      emoji: '⚙️',
      items: [
        {
          key: 'config' as TabKey,
          label: 'Ajustes del Servidor',
          icon: Server,
          accent: 'slate'
        },
        {
          key: 'maintenance' as TabKey,
          label: 'Modo Mantenimiento',
          icon: ShieldAlert,
          accent: 'rose',
          badge: config?.maintenance_mode ? 'ACTIVO' : undefined,
          badgeStyle: 'bg-rose-600/80 text-white border-rose-500/60 animate-pulse'
        },
        {
          key: 'banner' as TabKey,
          label: 'Alertas y Banner',
          icon: Megaphone,
          accent: 'amber'
        },
        {
          key: 'news' as TabKey,
          label: 'Noticias y Anuncios',
          icon: Newspaper,
          accent: 'teal',
          badge: news.length > 0 ? news.length.toString() : undefined,
          badgeStyle: 'bg-teal-500/15 text-teal-300 border-teal-500/25'
        }
      ]
    }
  ];

  const accentColorMap: Record<string, string> = {
    indigo: 'text-indigo-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    cyan: 'text-cyan-400',
    slate: 'text-slate-400',
    teal: 'text-teal-400'
  };

  // Active tab metadata for the header
  const tabMeta: Record<TabKey, { title: string; subtitle: string; icon: any; gradient: string }> = {
    cloud_assets: { title: 'Almacenamiento Ilimitado de Modpacks', subtitle: 'Sube modpacks enteros en .ZIP, sincroniza mods, configs, kubejs y shaders sin límite.', icon: Cloud, gradient: 'from-indigo-500 to-purple-600' },
    instances: { title: 'Catálogo de Instancias & Modpacks', subtitle: 'Crea, edita y administra los perfiles de juego visibles para los usuarios.', icon: Box, gradient: 'from-blue-500 to-indigo-600' },
    users: { title: 'Telemetría de Jugadores & Dispositivos', subtitle: 'Historial de jugadores, computadoras, direcciones IP públicas, RAM y sesiones.', icon: Users, gradient: 'from-emerald-500 to-teal-600' },
    mods: { title: 'Gestor de Mods .JAR', subtitle: 'Control individual de activación y eliminación de mods ejecutables.', icon: Layers, gradient: 'from-purple-500 to-pink-600' },
    shaders: { title: 'Shaders & Resourcepacks', subtitle: 'Packs gráficos recomendados y distribución remota a los clientes.', icon: Sparkles, gradient: 'from-amber-500 to-orange-600' },
    config: { title: 'Configuración Remota Global', subtitle: 'Ajustes de IP del servidor, URLs del modpack y parámetros del launcher.', icon: Server, gradient: 'from-slate-500 to-slate-700' },
    crashes: { title: 'Diagnóstico de Crashes & Asistente IA', subtitle: 'Análisis automatizado con IA de errores y registros de fallo.', icon: Bug, gradient: 'from-rose-500 to-red-600' },
    maintenance: { title: 'Control de Modo Mantenimiento', subtitle: 'Bloquea el acceso al launcher y muestra pantallas personalizadas.', icon: ShieldAlert, gradient: 'from-rose-600 to-amber-600' },
    banner: { title: 'Alertas & Banners Promocionales', subtitle: 'Transmite avisos destacados en la barra superior de los launchers.', icon: Megaphone, gradient: 'from-amber-500 to-yellow-600' },
    news: { title: 'Noticias & Anuncios de la Comunidad', subtitle: 'Publica parches, eventos y notas de actualización.', icon: Newspaper, gradient: 'from-teal-500 to-emerald-600' },
    monitor: { title: 'Monitor en Tiempo Real del Servidor', subtitle: 'Ping en vivo, latencia, versión de Minecraft y jugadores conectados.', icon: Activity, gradient: 'from-cyan-500 to-blue-600' }
  };

  const meta = tabMeta[activeTab];
  const MetaIcon = meta.icon;

  // ═══════════════════════════════════════
  //  MAIN DASHBOARD LAYOUT
  // ═══════════════════════════════════════
  return (
    <div className="min-h-screen bg-obs-base text-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* ─── Mobile Top Bar ─── */}
      <div className="md:hidden bg-obs-surface/95 backdrop-blur-xl border-b border-obs-border px-4 py-3 flex items-center justify-between z-40 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <Flame className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="font-black text-sm text-white block leading-tight">Rafa MC</span>
            <span className="text-[9px] text-obs-muted font-mono">Admin Suite</span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2.5 text-slate-400 hover:text-white rounded-xl bg-obs-card border border-obs-border transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ─── Sidebar ─── */}
      <aside
        className={`
          ${sidebarCollapsed ? 'w-[72px]' : 'w-[280px]'}
          bg-gradient-to-b from-obs-surface to-obs-base border-r border-obs-border flex flex-col shrink-0 transition-all duration-300 ease-out z-30
          fixed md:relative inset-y-0 left-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Brand */}
        <div className="p-4 border-b border-obs-border/70 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative shrink-0">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 rounded-2xl shadow-xl shadow-indigo-500/25 text-white">
                <Flame className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl blur-md -z-10 animate-glow-pulse" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h1 className="font-black text-sm text-white tracking-tight">RAFA MC</h1>
                  <span className="text-[8px] font-black bg-gradient-to-r from-indigo-500/25 to-purple-500/25 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Admin
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
                  <span className="text-[10px] text-obs-muted font-mono tracking-wide">Sync en vivo</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-obs-elevated/60 transition-all duration-200"
            title={sidebarCollapsed ? 'Expandir barra' : 'Colapsar barra'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav Groups */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              {!sidebarCollapsed && (
                <>
                  <div className="px-3 pb-2 flex items-center gap-2">
                    <span className="text-xs">{group.emoji}</span>
                    <span className="text-[10px] font-black text-obs-muted uppercase tracking-[0.15em] font-mono">
                      {group.title}
                    </span>
                  </div>
                </>
              )}
              {sidebarCollapsed && idx > 0 && <div className="sidebar-divider mx-2 my-3" />}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  const iconColor = accentColorMap[item.accent] || 'text-slate-400';

                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setActiveTab(item.key);
                        setMobileMenuOpen(false);
                      }}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`
                        w-full flex items-center justify-between rounded-xl text-[13px] font-semibold transition-all duration-200
                        ${sidebarCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'}
                        ${
                          isActive
                            ? 'bg-gradient-to-r from-indigo-500/15 to-purple-500/10 text-white border border-indigo-500/20 shadow-lg shadow-indigo-500/[0.07] nav-glow'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-obs-elevated/40 border border-transparent'
                        }
                      `}
                    >
                      <div className={`flex items-center gap-2.5 truncate ${sidebarCollapsed ? 'justify-center' : ''}`}>
                        <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors duration-200 ${isActive ? 'text-indigo-400' : iconColor}`} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {!sidebarCollapsed && item.badge && (
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border shrink-0 ${
                            isActive ? 'bg-white/10 text-white/90 border-white/20' : item.badgeStyle || 'bg-obs-elevated text-slate-300 border-obs-border'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Admin Footer */}
        <div className="p-3 border-t border-obs-border/70 bg-obs-base/60 space-y-2.5">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              {/* Avatar circle from email initials */}
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-300 text-xs font-black shrink-0">
                {(session?.user?.email?.[0] || 'A').toUpperCase()}
              </div>
              <div className="truncate">
                <span className="text-[11px] font-bold text-slate-200 block truncate leading-tight">
                  {session?.user?.email?.split('@')[0] || 'Administrador'}
                </span>
                <span className="text-[10px] text-obs-muted font-mono block truncate">
                  {session?.user?.email || 'admin@servidor.com'}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <a
              href="https://github.com/rafa203gt/Rafa-MC-LAUNCHER"
              target="_blank"
              rel="noreferrer"
              title="Repositorio de GitHub"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-obs-card hover:bg-obs-elevated text-slate-400 hover:text-white text-xs font-semibold rounded-xl border border-obs-border hover:border-obs-border-light transition-all duration-200"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {!sidebarCollapsed && 'GitHub'}
            </a>
            <button
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="p-2.5 bg-obs-card hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 rounded-xl border border-obs-border hover:border-rose-500/30 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ─── Main Workspace ─── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-obs-surface/80 backdrop-blur-2xl border-b border-obs-border px-6 py-5 shrink-0 z-20">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Page Title */}
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl bg-gradient-to-br ${meta.gradient} text-white shadow-xl`}>
                <MetaIcon className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight leading-tight">{meta.title}</h2>
                <p className="text-xs text-obs-muted mt-0.5 max-w-lg">{meta.subtitle}</p>
              </div>
            </div>

            {/* KPI Stats */}
            <div className="flex items-center gap-2 flex-wrap stagger-children">
              <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 kpi-emerald">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-base font-black text-emerald-400 font-mono leading-none">{users.length}</div>
                  <div className="text-[10px] text-obs-muted mt-0.5">Dispositivos</div>
                </div>
              </div>

              <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 kpi-blue">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Box className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-base font-black text-blue-400 font-mono leading-none">{instances.length}</div>
                  <div className="text-[10px] text-obs-muted mt-0.5">Instancias</div>
                </div>
              </div>

              <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 kpi-purple">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="text-base font-black text-purple-400 font-mono leading-none">{mods.length}</div>
                  <div className="text-[10px] text-obs-muted mt-0.5">Mods JAR</div>
                </div>
              </div>

              {unresolvedCrashes > 0 && (
                <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 kpi-rose">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <Bug className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <div className="text-base font-black text-rose-400 font-mono leading-none animate-pulse">{unresolvedCrashes}</div>
                    <div className="text-[10px] text-obs-muted mt-0.5">Crashes</div>
                  </div>
                </div>
              )}

              <button
                onClick={fetchData}
                disabled={isLoading}
                title="Sincronizar con Supabase"
                className="p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/25 hover:border-indigo-500/40 rounded-xl transition-all duration-200 disabled:opacity-40 hover:shadow-lg hover:shadow-indigo-500/10"
              >
                <RefreshCw className={`w-4.5 h-4.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-mesh">
          {config ? (
            <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn">
              {activeTab === 'cloud_assets' && <CloudAssetManager />}
              {activeTab === 'instances' && <InstancesManager instances={instances} onRefresh={fetchData} />}
              {activeTab === 'users' && <UsersAnalytics users={users} onRefresh={fetchData} isLoading={isLoading} />}
              {activeTab === 'mods' && <ModpackManager mods={mods} instances={instances} onRefresh={fetchData} />}
              {activeTab === 'shaders' && <ShadersManager shaders={shaders} onRefresh={fetchData} />}
              {activeTab === 'config' && <ConfigEditor config={config} onUpdated={(c) => setConfig(c)} />}
              {activeTab === 'crashes' && <CrashAnalytics reports={crashes} onRefresh={fetchData} />}
              {activeTab === 'maintenance' && <MaintenanceToggle config={config} onUpdated={(c) => setConfig(c)} />}
              {activeTab === 'banner' && <BannerAlertManager config={config} onUpdated={(c) => setConfig(c)} />}
              {activeTab === 'news' && <NewsManager news={news} onRefresh={fetchData} />}
              {activeTab === 'monitor' && <LiveServerMonitor config={config} />}
            </div>
          ) : (
            <div className="flex items-center justify-center py-32">
              <div className="flex flex-col items-center gap-4 text-slate-500">
                <div className="w-10 h-10 border-2 border-indigo-500/60 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <span className="text-xs font-mono block text-obs-muted">Cargando base de datos</span>
                  <span className="text-[10px] font-mono block text-slate-600 mt-1">Supabase Realtime</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
