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
  X
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
        { data: modsData },
        { data: shadersData },
        { data: crashData }
      ] = await Promise.all([
        supabase.from('launcher_config').select('*').limit(1).single(),
        supabase.from('instances').select('*').order('created_at', { ascending: true }),
        supabase.from('launcher_users').select('*').order('last_seen', { ascending: false }),
        supabase.from('launcher_news').select('*').order('created_at', { ascending: false }),
        supabase.from('modpack_mods').select('*').order('file_name', { ascending: true }),
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

  // Auth Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#06080d] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-widest text-slate-500 uppercase">Conectando con Supabase...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#06080d] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl space-y-6 relative z-10">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25">
              <Flame className="w-8 h-8 text-white stroke-[2.2]" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">Rafa MC Admin Suite</h1>
            <p className="text-xs text-slate-400">Gestión en tiempo real de Modpacks, Telemetría e Instancias</p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Correo Electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@servidor.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {authLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isSignUp ? (
                'Crear Cuenta de Administrador'
              ) : (
                'Iniciar Sesión en el Panel'
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-800/60">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
                setAuthSuccess(null);
              }}
              className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
            >
              {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿Nuevo administrador? Crear cuenta'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Navigation Items Grouped Logically
  const navGroups = [
    {
      title: 'MODPACKS & CONTENIDO',
      items: [
        {
          key: 'cloud_assets' as TabKey,
          label: 'Nube Ilimitada & ZIP',
          icon: Cloud,
          color: 'text-indigo-400',
          badge: 'PRO',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
        },
        {
          key: 'instances' as TabKey,
          label: 'Instancias & Perfiles',
          icon: Box,
          color: 'text-blue-400',
          badge: instances.length.toString(),
          badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
        },
        {
          key: 'mods' as TabKey,
          label: 'Gestor de Mods .JAR',
          icon: Layers,
          color: 'text-purple-400',
          badge: mods.length.toString(),
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
        },
        {
          key: 'shaders' as TabKey,
          label: 'Shaders & Packs',
          icon: Sparkles,
          color: 'text-amber-400',
          badge: shaders.length.toString(),
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        }
      ]
    },
    {
      title: 'TELEMETRÍA & AUDITORÍA',
      items: [
        {
          key: 'users' as TabKey,
          label: 'Jugadores & Dispositivos',
          icon: Users,
          color: 'text-emerald-400',
          badge: users.length.toString(),
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        },
        {
          key: 'crashes' as TabKey,
          label: 'Crashes & Asistente IA',
          icon: Bug,
          color: 'text-rose-400',
          badge: crashes.filter((c) => !c.resolved).length > 0 ? crashes.filter((c) => !c.resolved).length.toString() : undefined,
          badgeColor: 'bg-rose-500/30 text-rose-300 border-rose-500/40 animate-pulse'
        },
        {
          key: 'monitor' as TabKey,
          label: 'Monitor en Vivo Servidor',
          icon: Activity,
          color: 'text-cyan-400',
          badge: 'LIVE',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
        }
      ]
    },
    {
      title: 'CONTROL & SISTEMA',
      items: [
        {
          key: 'config' as TabKey,
          label: 'Ajustes del Servidor',
          icon: Server,
          color: 'text-slate-400'
        },
        {
          key: 'maintenance' as TabKey,
          label: 'Modo Mantenimiento',
          icon: ShieldAlert,
          color: 'text-rose-400',
          badge: config?.maintenance_mode ? 'ACTIVO' : undefined,
          badgeColor: 'bg-rose-600 text-white animate-pulse'
        },
        {
          key: 'banner' as TabKey,
          label: 'Alertas y Banner',
          icon: Megaphone,
          color: 'text-amber-400'
        },
        {
          key: 'news' as TabKey,
          label: 'Noticias y Anuncios',
          icon: Newspaper,
          color: 'text-teal-400',
          badge: news.length.toString(),
          badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30'
        }
      ]
    }
  ];

  // Active Tab Title Metadata
  const getTabMetadata = () => {
    switch (activeTab) {
      case 'cloud_assets':
        return {
          title: 'Almacenamiento Ilimitado de Modpacks',
          subtitle: 'Sube modpacks enteros en .ZIP, sincroniza mods, configs, kubejs y shaders sin límite.',
          icon: Cloud,
          color: 'from-indigo-500 to-purple-600'
        };
      case 'instances':
        return {
          title: 'Catálogo de Instancias & Modpacks',
          subtitle: 'Crea, edita y administra los perfiles de juego visibles para los usuarios.',
          icon: Box,
          color: 'from-blue-500 to-indigo-600'
        };
      case 'users':
        return {
          title: 'Telemetría de Jugadores & Dispositivos',
          subtitle: 'Historial de jugadores, computadoras, direcciones IP públicas, RAM y sesiones iniciadas.',
          icon: Users,
          color: 'from-emerald-500 to-teal-600'
        };
      case 'mods':
        return {
          title: 'Gestor de Mods .JAR',
          subtitle: 'Control individual de activación y eliminación de mods ejecutables.',
          icon: Layers,
          color: 'from-purple-500 to-pink-600'
        };
      case 'shaders':
        return {
          title: 'Shaders & Resourcepacks',
          subtitle: 'Packs gráficos recomendados y distribución remota a los clientes.',
          icon: Sparkles,
          color: 'from-amber-500 to-orange-600'
        };
      case 'config':
        return {
          title: 'Configuración Remota Global',
          subtitle: 'Ajustes de IP del servidor, URLs del modpack y parámetros del launcher.',
          icon: Server,
          color: 'from-slate-600 to-slate-800'
        };
      case 'crashes':
        return {
          title: 'Diagnóstico de Crashes & Asistente IA',
          subtitle: 'Análisis automatizado con IA de errores y registros de fallo de jugadores.',
          icon: Bug,
          color: 'from-rose-500 to-red-600'
        };
      case 'maintenance':
        return {
          title: 'Control de Modo Mantenimiento',
          subtitle: 'Bloquea el acceso al launcher y muestra pantallas personalizadas durante parches.',
          icon: ShieldAlert,
          color: 'from-rose-600 to-amber-600'
        };
      case 'banner':
        return {
          title: 'Alertas & Banners Promocionales',
          subtitle: 'Transmite avisos destacados en la barra superior de los launchers.',
          icon: Megaphone,
          color: 'from-amber-500 to-yellow-600'
        };
      case 'news':
        return {
          title: 'Noticias & Anuncios de la Comunidad',
          subtitle: 'Publica parches, eventos y notas de actualización con imágenes y enlaces.',
          icon: Newspaper,
          color: 'from-teal-500 to-emerald-600'
        };
      case 'monitor':
        return {
          title: 'Monitor en Tiempo Real del Servidor',
          subtitle: 'Ping en vivo, latencia, versión de Minecraft y jugadores conectados al servidor.',
          icon: Activity,
          color: 'from-cyan-500 to-blue-600'
        };
    }
  };

  const meta = getTabMetadata();

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex items-center justify-between z-40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white">
            <Flame className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-sm text-white">Rafa MC Admin</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`
          ${sidebarCollapsed ? 'w-20' : 'w-72'}
          bg-[#0a0d14] border-r border-slate-800/80 flex flex-col justify-between shrink-0 transition-all duration-300 z-30
          fixed md:relative inset-y-0 left-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Brand & Logo */}
        <div className="p-4 border-b border-slate-800/70 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/25 text-white shrink-0">
              <Flame className="w-6 h-6 stroke-[2.2]" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-sm text-white tracking-tight">RAFA MC</h1>
                  <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded-md">
                    ADMIN
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-slate-400 font-mono">Sync Activo</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title={sidebarCollapsed ? 'Expandir barra' : 'Colapsar barra'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-3 pb-1 text-[10px] font-black text-slate-300 uppercase tracking-wider font-mono">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setActiveTab(item.key);
                        setMobileMenuOpen(false);
                      }}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`
                        w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all
                        ${
                          isActive
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.color}`} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {!sidebarCollapsed && item.badge && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${
                            isActive ? 'bg-white/20 text-white border-white/30' : item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
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

        {/* Admin User Footer */}
        <div className="p-3 border-t border-slate-800/70 bg-slate-950/40 space-y-2">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-2 py-1">
              <div className="truncate">
                <span className="text-[11px] font-bold text-slate-200 block truncate">
                  {session?.user?.email?.split('@')[0] || 'Administrador'}
                </span>
                <span className="text-[10px] text-slate-300 font-mono block truncate">
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
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {!sidebarCollapsed && 'GitHub'}
            </a>
            <button
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="p-2 bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Metric Bar */}
        <header className="bg-slate-900/60 border-b border-slate-800/80 backdrop-blur-xl px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 z-20">
          <div className="flex items-center gap-3.5">
            <div className={`p-2.5 rounded-2xl bg-gradient-to-br ${meta.color} text-white shadow-lg shadow-indigo-500/20`}>
              <meta.icon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">{meta.title}</h2>
              <p className="text-xs text-slate-400">{meta.subtitle}</p>
            </div>
          </div>

          {/* Quick KPI Stats Bar */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="bg-slate-950/80 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-slate-400">Dispositivos:</span>
              <strong className="text-xs font-mono text-emerald-400 font-bold">{users.length}</strong>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] text-slate-400">Instancias:</span>
              <strong className="text-xs font-mono text-blue-400 font-bold">{instances.length}</strong>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] text-slate-400">Mods JAR:</span>
              <strong className="text-xs font-mono text-purple-400 font-bold">{mods.length}</strong>
            </div>

            <button
              onClick={fetchData}
              disabled={isLoading}
              title="Sincronizar datos con Supabase"
              className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Scrollable Content View */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
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
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">Cargando base de datos de Supabase...</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
