import React from 'react';
import { Minus, Square, X, Gamepad2, Settings, Box, Terminal, RefreshCw } from 'lucide-react';

interface HeaderProps {
  activeTab: 'play' | 'mods' | 'settings' | 'console';
  setActiveTab: (tab: 'play' | 'mods' | 'settings' | 'console') => void;
  statusText: string;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, statusText }) => {
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
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-glow">
          <Gamepad2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wider text-slate-100 uppercase">Rafa Launcher</h1>
          <span className="text-[10px] text-emerald-400 font-medium tracking-tight">v1.20.1 Fabric / Forge</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 titlebar-no-drag bg-mc-darker/60 p-1 rounded-xl border border-mc-border/50">
        <button
          onClick={() => setActiveTab('play')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'play'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-mc-card'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          Jugar
        </button>

        <button
          onClick={() => setActiveTab('mods')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
