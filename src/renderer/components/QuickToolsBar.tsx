import React, { useState } from 'react';
import { FolderOpen, Camera, Save, Package, FileText, RefreshCw, CheckCircle2, Sparkles } from 'lucide-react';

interface QuickToolsBarProps {
  onReinstallModpack?: () => void;
  onOpenShaders?: () => void;
  isModded: boolean;
}

export const QuickToolsBar: React.FC<QuickToolsBarProps> = ({
  onReinstallModpack,
  onOpenShaders,
  isModded
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpen = (type: 'instance' | 'mods' | 'logs' | 'runtime' | 'screenshots' | 'saves', label: string) => {
    if (window.launcherAPI?.openFolder) {
      window.launcherAPI.openFolder(type);
      setToastMessage(`Carpeta de ${label} abierta`);
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  return (
    <div className="bg-mc-card/80 backdrop-blur-md border border-mc-border/80 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3 relative overflow-hidden">
      <div className="flex items-center gap-2.5 w-full md:w-auto">
        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Herramientas Rápidas</h4>
          <p className="text-[11px] text-slate-400">Acceso directo a carpetas del juego y utilidades</p>
        </div>
      </div>

      {toastMessage && (
        <div className="absolute top-2 right-4 bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg animate-fadeIn z-20">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Buttons Row */}
      <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
        {onOpenShaders && (
          <button
            onClick={onOpenShaders}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 rounded-xl text-xs text-amber-300 hover:text-white transition-all active:scale-95 shadow-md"
            title="Instalador y Gestor de Shaders"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Shaders 1-Clic</span>
          </button>
        )}
        <button
          onClick={() => handleOpen('instance', 'Instancia')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-mc-darker hover:bg-slate-800/80 border border-mc-border hover:border-slate-600 rounded-xl text-xs text-slate-300 hover:text-white transition-all active:scale-95"
          title="Abrir carpeta raíz de la instancia"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Carpeta Juego</span>
        </button>

        <button
          onClick={() => handleOpen('screenshots', 'Capturas')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-mc-darker hover:bg-slate-800/80 border border-mc-border hover:border-slate-600 rounded-xl text-xs text-slate-300 hover:text-white transition-all active:scale-95"
          title="Abrir carpeta de fotos y capturas de pantalla"
        >
          <Camera className="w-3.5 h-3.5 text-cyan-400" />
          <span>Capturas</span>
        </button>

        <button
          onClick={() => handleOpen('saves', 'Mundos Guardados')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-mc-darker hover:bg-slate-800/80 border border-mc-border hover:border-slate-600 rounded-xl text-xs text-slate-300 hover:text-white transition-all active:scale-95"
          title="Abrir carpeta de mundos guardados para copias de seguridad"
        >
          <Save className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mundos</span>
        </button>

        {isModded && (
          <button
            onClick={() => handleOpen('mods', 'Mods')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-mc-darker hover:bg-slate-800/80 border border-mc-border hover:border-slate-600 rounded-xl text-xs text-slate-300 hover:text-white transition-all active:scale-95"
            title="Abrir carpeta de mods"
          >
            <Package className="w-3.5 h-3.5 text-indigo-400" />
            <span>Mods</span>
          </button>
        )}

        <button
          onClick={() => handleOpen('logs', 'Registros')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-mc-darker hover:bg-slate-800/80 border border-mc-border hover:border-slate-600 rounded-xl text-xs text-slate-300 hover:text-white transition-all active:scale-95"
          title="Abrir carpeta de logs del juego"
        >
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          <span>Logs</span>
        </button>

        {isModded && onReinstallModpack && (
          <button
            onClick={onReinstallModpack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs text-rose-300 hover:text-rose-200 transition-all active:scale-95 ml-1"
            title="Reparar modpack y verificar archivos faltantes o corruptos"
          >
            <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
            <span>Reparar Mods</span>
          </button>
        )}
      </div>
    </div>
  );
};
