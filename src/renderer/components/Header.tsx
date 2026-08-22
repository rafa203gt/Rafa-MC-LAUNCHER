import React from 'react';
import { Minus, Square, X, Gamepad2, Settings, Box, Terminal, Layers, Palette } from 'lucide-react';

interface HeaderProps {
  activeTab: 'play' | 'instances' | 'skins' | 'mods' | 'settings' | 'console';
  setActiveTab: (tab: 'play' | 'instances' | 'skins' | 'mods' | 'settings' | 'console') => void;
  statusText: string;
  activeInstanceName?: string;
  appVersion?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  statusText,
  activeInstanceName,
  appVersion = '1.0.20'
}) => {
  const handleMinimize = () => {
    window.launcherAPI?.minimizeWindow();
  };

  const handleMaximize = () => {
    window.launcherAPI?.maximizeWindow();
  };

  const handleClose = () => {
    window.launcherAPI?.closeWindow();
  };

  return (
    <header className="h-14 bg-mc-card/80 backdrop-blur-md border-b border-mc-border flex items-center justify-between px-4 titlebar-drag-region sticky top-0 z-50">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <img
          src="/icon.png"
          alt="Rafa Launcher"
          className="w-8 h-8 rounded-lg shadow-glow object-cover border border-emerald-500/30"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm tracking-wider text-slate-100 uppercase">Rafa Launcher</h1>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
              v{appVersion}
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 font-medium tracking-tight">
            {activeInstanceName || 'All the Mods 10 (ATM10)'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 titlebar-no-drag bg-mc-darker/60 p-1 rounded-xl border border-mc-border/50">
        <button
          onClick={() => setActiveTab('play')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'play'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-mc-card'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          Jugar
        </button>

        <button
          onClick={() => setActiveTab('instances')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'instances'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-mc-card'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          Instancias
        </button>

        <button
          onClick={() => setActiveTab('skins')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'skins'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-mc-card'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-purple-400" />
          Skins 3D
        </button>

        <button
          onClick={() => setActiveTab('mods')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'mods'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-mc-card'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          Modpack
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'settings'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-mc-card'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Ajustes
        </button>

        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'console'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-mc-card'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          Consola
        </button>
      </nav>

      {/* Window Controls */}
      <div className="flex items-center gap-1 titlebar-no-drag">
        <button
          onClick={handleMinimize}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          title="Minimizar"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          title="Maximizar"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-rose-600 hover:text-white rounded-lg text-slate-400 transition-colors"
          title="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
