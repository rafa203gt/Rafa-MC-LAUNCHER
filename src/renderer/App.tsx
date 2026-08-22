import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { UpdateBanner } from './components/UpdateBanner';
import { RemoteAlertBanner } from './components/RemoteAlertBanner';
import { ServerBanner } from './components/ServerBanner';
import { PlayControls } from './components/PlayControls';
import { QuickToolsBar } from './components/QuickToolsBar';
import { NewsFeedCard } from './components/NewsFeedCard';
import { ModpackView } from './components/ModpackView';
import { InstancesView } from './components/InstancesView';
import { SettingsModal } from './components/SettingsModal';
import { ConsoleModal } from './components/ConsoleModal';
import { ShadersModal } from './components/ShadersModal';
import { Skin3DViewer } from './components/Skin3DViewer';
import {
  AppSettings,
  ServerStatusResult,
  ProgressEventPayload,
  MinecraftInstance,
  RemoteLauncherConfig,
  NewsAnnouncement
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'play' | 'instances' | 'mods' | 'settings' | 'console'>('play');
  const [activeInstance, setActiveInstance] = useState<MinecraftInstance | null>(null);
  const [instances, setInstances] = useState<MinecraftInstance[]>([]);
  const [remoteConfig, setRemoteConfig] = useState<RemoteLauncherConfig | null>(null);
  const [news, setNews] = useState<NewsAnnouncement[]>([]);
  const [isShadersOpen, setIsShadersOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    username: 'Jugador',
    minRam: 2048,
    maxRam: 4096,
    customJavaPath: '',
    autoJava: true,
    autoConnect: false,
    serverIp: 'play.tuserver.com',
    serverPort: 25565,
    serverName: 'All the Mods 10 (ATM10)',
    minecraftVersion: '1.21.1',
    modLoader: 'neoforge',
    modLoaderVersion: '21.1.247',
    modpackManifestUrl: 'https://raw.githubusercontent.com/rafa203gt/Rafa-MC-LAUNCHER/main/modpack/manifest.json',
    fullscreen: false,
    width: 1280,
    height: 720,
    jvmArgs: [],
    discordRpc: true
  });

  const [username, setUsername] = useState('Jugador');
  const [serverStatus, setServerStatus] = useState<ServerStatusResult | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [progress, setProgress] = useState<ProgressEventPayload | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Load instances
  const loadInstances = useCallback(async () => {
    try {
      if (window.launcherAPI?.getInstances) {
        const list = await window.launcherAPI.getInstances();
        setInstances(list);
        const active = list.find((i) => i.isActive) || list[0];
        if (active) {
          setActiveInstance(active);
          setSettings((prev) => ({
            ...prev,
            serverName: active.name,
            minecraftVersion: active.minecraftVersion,
            modLoader: active.modLoader,
            modLoaderVersion: active.modLoaderVersion,
            modpackManifestUrl: active.modpackManifestUrl,
            maxRam: active.customRam || prev.maxRam
          }));
        }
      }
    } catch (err) {
      console.error('Error loading instances:', err);
    }
  }, []);

  // Load Supabase remote config & news
  const loadRemoteData = useCallback(async () => {
    try {
      if (window.launcherAPI?.getRemoteConfig) {
        const remote = await window.launcherAPI.getRemoteConfig();
        if (remote) {
          setRemoteConfig(remote);
          setSettings((prev) => ({
            ...prev,
            serverName: remote.server_name || prev.serverName,
            serverIp: remote.server_ip || prev.serverIp,
            serverPort: remote.server_port || prev.serverPort
          }));
        }
      }
      if (window.launcherAPI?.getNews) {
        const newsList = await window.launcherAPI.getNews();
        if (newsList) setNews(newsList);
      }
    } catch (err) {
      console.warn('Error cargando datos remotos de Supabase:', err);
    }
  }, []);

  // Load initial settings & active instance & remote config
  useEffect(() => {
    if (window.launcherAPI?.getSettings) {
      window.launcherAPI.getSettings().then((loaded) => {
        if (loaded) {
          setSettings(loaded);
          setUsername(loaded.username || 'Jugador');
        }
      });
    }

    loadInstances();
    loadRemoteData();
  }, [loadInstances, loadRemoteData]);

  // Ping Server Status
  const checkServerStatus = useCallback(async () => {
    setIsPinging(true);
    try {
      if (window.launcherAPI?.getServerStatus) {
        const res = await window.launcherAPI.getServerStatus();
        setServerStatus(res);
      }
    } catch (err) {
      console.warn('Error pinging server:', err);
    } finally {
      setIsPinging(false);
    }
  }, []);

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, [checkServerStatus]);

  // IPC Event Subscriptions
  useEffect(() => {
    if (!window.launcherAPI) return;

    const unbindProgress = window.launcherAPI.onProgress((data) => {
      setProgress(data);
      if (data.stage === 'running' || data.stage === 'error') {
        setIsLaunching(false);
      }
    });

    const unbindLog = window.launcherAPI.onLog((log) => {
      setLogs((prev) => [...prev.slice(-300), log]);
    });

    const unbindClosed = window.launcherAPI.onGameClosed(() => {
      setIsLaunching(false);
      setProgress(null);
    });

    const unbindRemoteConfig = window.launcherAPI.onRemoteConfig?.((remote) => {
      console.log('[Renderer] ⚡ Configuración remota actualizada en vivo:', remote);
      if (remote) {
        setRemoteConfig(remote);
        setSettings((prev) => ({
          ...prev,
          serverName: remote.server_name || prev.serverName,
          serverIp: remote.server_ip || prev.serverIp,
          serverPort: remote.server_port || prev.serverPort
        }));
      }
    });

    const unbindRemoteNews = window.launcherAPI.onRemoteNews?.((newsList) => {
      console.log('[Renderer] 📰 Noticias remotas actualizadas:', newsList);
      if (newsList) setNews(newsList);
    });

    return () => {
      unbindProgress();
      unbindLog();
      unbindClosed();
      if (unbindRemoteConfig) unbindRemoteConfig();
      if (unbindRemoteNews) unbindRemoteNews();
    };
  }, []);

  const handleLaunch = async () => {
    if (isLaunching) return;

    if (remoteConfig?.maintenance_mode) {
      alert(remoteConfig.maintenance_message || 'El juego se encuentra en mantenimiento en este momento.');
      return;
    }

    setIsLaunching(true);
    setProgress({
      stage: 'java',
      task: 'Inicializando entorno de juego...',
      total: 100,
      current: 0,
      percent: 0
    });

    try {
      if (window.launcherAPI?.saveSettings) {
        await window.launcherAPI.saveSettings({ username, maxRam: settings.maxRam });
      }

      await window.launcherAPI.launchGame({
        username,
        minRam: settings.minRam,
        maxRam: settings.maxRam,
        autoConnect: settings.autoConnect
      });
    } catch (err: any) {
      console.error('Error lanzando Minecraft:', err);
      setIsLaunching(false);
      setProgress(null);
      alert(`Error al iniciar Minecraft: ${err.message}`);
    }
  };

  const handleSwitchInstance = async (instanceId: string) => {
    try {
      if (window.launcherAPI?.switchInstance) {
        const updated = await window.launcherAPI.switchInstance(instanceId);
        setActiveInstance(updated);
        setSettings((prev) => ({
          ...prev,
          serverName: updated.name,
          minecraftVersion: updated.minecraftVersion,
          modLoader: updated.modLoader,
          modLoaderVersion: updated.modLoaderVersion,
          modpackManifestUrl: updated.modpackManifestUrl,
          maxRam: updated.customRam || prev.maxRam
        }));
        await loadInstances();
      }
    } catch (err) {
      console.error('Error switching instance:', err);
    }
  };

  const handleRamChange = (ram: number) => {
    setSettings((prev) => ({ ...prev, maxRam: ram }));
    if (window.launcherAPI?.saveSettings) {
      window.launcherAPI.saveSettings({ maxRam: ram });
    }
  };

  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    if (window.launcherAPI?.saveSettings) {
      const updated = await window.launcherAPI.saveSettings(newSettings);
      setSettings(updated);
      checkServerStatus();
    }
  };

  const handleReinstallModpack = async () => {
    if (
      !confirm(
        '¿Deseas reparar y reinstalar el modpack? Esto restaurará cualquier archivo dañado o faltante sin borrar tus mundos.'
      )
    ) {
      return;
    }
    try {
      if (window.launcherAPI?.reinstallModpack) {
        setIsLaunching(true);
        await window.launcherAPI.reinstallModpack();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLaunching(false);
    }
  };

  const isModded = activeInstance?.modLoader !== 'vanilla';

  return (
    <div className="flex flex-col h-screen bg-mc-darker text-slate-100 overflow-hidden">
      {/* Custom Titlebar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        statusText={isLaunching ? 'Lanzando juego...' : 'Listo'}
        activeInstanceName={activeInstance?.name}
      />

      {/* App Auto-Update Notification */}
      <UpdateBanner />

      {/* Remote Live Alert & Maintenance Banner */}
      <RemoteAlertBanner remoteConfig={remoteConfig} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-6">
        {activeTab === 'play' && (
          <div className="space-y-6 animate-fadeIn">
            <ServerBanner
              serverStatus={serverStatus}
              serverName={settings.serverName}
              serverIp={settings.serverIp}
              serverPort={settings.serverPort}
              autoConnect={settings.autoConnect}
              isLoading={isPinging}
              onRefresh={checkServerStatus}
            />

            {/* Split Grid: Play Controls + 3D Skin Viewer */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-6">
                <PlayControls
                  username={username}
                  setUsername={setUsername}
                  maxRam={settings.maxRam}
                  onRamChange={handleRamChange}
                  activeInstance={activeInstance}
                  instances={instances}
                  onSwitchInstance={handleSwitchInstance}
                  isLaunching={isLaunching}
                  progress={progress}
                  onLaunch={handleLaunch}
                />

                <QuickToolsBar
                  onReinstallModpack={isModded ? handleReinstallModpack : undefined}
                  onOpenShaders={() => setIsShadersOpen(true)}
                  isModded={isModded}
                />
              </div>

              {/* 3D Skin Viewer Column */}
              <div className="flex flex-col items-center justify-center bg-mc-card/60 backdrop-blur-md border border-mc-border/80 rounded-3xl p-4 shadow-xl">
                <Skin3DViewer username={username} width={220} height={260} />
              </div>
            </div>

            {/* Live Community News from Supabase */}
            <NewsFeedCard news={news} />
          </div>
        )}

        {activeTab === 'instances' && (
          <InstancesView
            onInstanceActivated={(inst) => {
              setActiveInstance(inst);
              setSettings((prev) => ({
                ...prev,
                minecraftVersion: inst.minecraftVersion,
                modLoader: inst.modLoader,
                modLoaderVersion: inst.modLoaderVersion,
                modpackManifestUrl: inst.modpackManifestUrl,
                maxRam: inst.customRam || prev.maxRam
              }));
              loadInstances();
            }}
            onLaunchInstance={() => {
              setActiveTab('play');
              handleLaunch();
            }}
          />
        )}

        {activeTab === 'mods' && <ModpackView />}

        {activeTab === 'settings' && (
          <SettingsModal settings={settings} onSave={handleSaveSettings} />
        )}

        {activeTab === 'console' && (
          <ConsoleModal logs={logs} onClear={() => setLogs([])} />
        )}
      </main>

      {/* 1-Click Shaders Modal */}
      <ShadersModal
        isOpen={isShadersOpen}
        onClose={() => setIsShadersOpen(false)}
        instanceId={activeInstance?.id}
      />
    </div>
  );
};
