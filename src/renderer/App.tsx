import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { UpdateBanner } from './components/UpdateBanner';
import { ServerBanner } from './components/ServerBanner';
import { PlayControls } from './components/PlayControls';
import { QuickToolsBar } from './components/QuickToolsBar';
import { ModpackView } from './components/ModpackView';
import { InstancesView } from './components/InstancesView';
import { SettingsModal } from './components/SettingsModal';
import { ConsoleModal } from './components/ConsoleModal';
import { AppSettings, ServerStatusResult, ProgressEventPayload, MinecraftInstance } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'play' | 'instances' | 'mods' | 'settings' | 'console'>('play');
  const [activeInstance, setActiveInstance] = useState<MinecraftInstance | null>(null);
  const [instances, setInstances] = useState<MinecraftInstance[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    username: 'Jugador',
    minRam: 2048,
    maxRam: 4096,
    customJavaPath: '',
    autoJava: true,
    autoConnect: false,
    serverIp: 'play.tuserver.com',
    serverPort: 25565,
    serverName: 'Rafa Server',
    minecraftVersion: '1.21.1',
    modLoader: 'neoforge',
    modLoaderVersion: '21.1.247',
    modpackManifestUrl: 'https://raw.githubusercontent.com/rafa203gt/Rafa-MC-LAUNCHER/main/modpack/manifest.json',
    fullscreen: false,
    width: 1280,
    height: 720,
    jvmArgs: []
  });

  const [username, setUsername] = useState('Jugador');
  const [serverStatus, setServerStatus] = useState<ServerStatusResult | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [progress, setProgress] = useState<ProgressEventPayload | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const loadInstances = useCallback(async () => {
    try {
      if (window.launcherAPI?.getInstances) {
        const list = await window.launcherAPI.getInstances();
        setInstances(list || []);
      }
      if (window.launcherAPI?.getActiveInstance) {
        const active = await window.launcherAPI.getActiveInstance();
        if (active) setActiveInstance(active);
      }
    } catch (err) {
      console.warn('Error cargando instancias:', err);
    }
  }, []);

  // Load initial settings & active instance
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
  }, [loadInstances]);

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
    const interval = setInterval(checkServerStatus, 30000); // refresh every 30s
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

    const unbindClosed = window.launcherAPI.onGameClosed((code) => {
      setIsLaunching(false);
      setProgress(null);
    });

    return () => {
      unbindProgress();
      unbindLog();
      unbindClosed();
    };
  }, []);

  const handleLaunch = async () => {
    if (isLaunching) return;

    setIsLaunching(true);
    setProgress({
      stage: 'java',
      task: 'Inicializando entorno de juego...',
      total: 100,
      current: 0,
      percent: 0
    });

    try {
      // Save current username
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
      setIsLaunching(false);
      console.error('Launch failed:', err);
    }
  };

  const handleSwitchInstance = async (instanceId: string) => {
    try {
      if (window.launcherAPI?.switchInstance) {
        const updated = await window.launcherAPI.switchInstance(instanceId);
        setActiveInstance(updated);
        setSettings((prev) => ({
          ...prev,
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
    if (!confirm('¿Deseas reparar y reinstalar el modpack? Esto restaurará cualquier archivo dañado o faltante sin borrar tus mundos.')) {
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
              isModded={isModded}
            />
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
    </div>
  );
};
