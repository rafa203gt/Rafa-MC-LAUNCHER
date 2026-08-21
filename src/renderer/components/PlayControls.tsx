import React from 'react';
import { Play, User, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';
import { ProgressEventPayload } from '../types';

interface PlayControlsProps {
  username: string;
  setUsername: (name: string) => void;
  maxRam: number;
  isLaunching: boolean;
  progress: ProgressEventPayload | null;
  onLaunch: () => void;
}

export const PlayControls: React.FC<PlayControlsProps> = ({
  username,
  setUsername,
  maxRam,
  isLaunching,
  progress,
  onLaunch
}) => {
  const currentUsername = username.trim() || 'Steve';
  const avatarUrl = `https://minotar.net/helm/${encodeURIComponent(currentUsername)}/64.png`;

  const getStageLabel = (stage?: string) => {
    switch (stage) {
      case 'java':
        return 'Descargando Java 17';
      case 'mods':
        return 'Sincronizando Modpack';
      case 'assets':
        return 'Descargando Minecraft';
      case 'starting':
        return 'Iniciando Proceso';
      case 'running':
        return 'Juego en Ejecución';
      case 'error':
        return 'Error de Inicio';
      default:
        return 'Preparando';
    }
  };

  return (
    <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden">
      {/* Top row: Profile & System Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* User Card */}
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <div className="relative">
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-12 h-12 rounded-xl bg-mc-darker border border-mc-border p-0.5 shadow-md"
              onError={(e) => {
                // Fallback to Steve avatar if error
                (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/64.png';
              }}
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-mc-card flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
          </div>

          <div className="flex-1 sm:w-64">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <User className="w-3 h-3 text-emerald-400" />
              Nombre de Usuario (No-Premium)
            </label>
            <input
              type="text"
              value={username}
              disabled={isLaunching}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresa tu apodo..."
              maxLength={20}
              className="w-full bg-mc-darker/90 border border-mc-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* RAM & Safety Badges */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-2 px-3 py-2 bg-mc-darker rounded-xl border border-mc-border text-xs text-slate-300">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>RAM: <strong className="text-white">{(maxRam / 1024).toFixed(1)} GB</strong></span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Mods Seguros</span>
          </div>
        </div>
      </div>

      {/* Progress Bar (when active) */}
      {isLaunching && progress && (
        <div className="space-y-2 bg-mc-darker/60 p-4 rounded-xl border border-mc-border/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {getStageLabel(progress.stage)}
            </span>
            <span className="font-mono text-slate-300 font-bold">{progress.percent}%</span>
          </div>

          <div className="w-full h-3 bg-mc-darker rounded-full overflow-hidden border border-mc-border">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(3, progress.percent)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 font-mono truncate">
            {progress.task || 'Procesando archivos...'}
          </p>
        </div>
      )}

      {/* Big Launch Button */}
      <button
        onClick={onLaunch}
        disabled={isLaunching || !username.trim()}
        className={`w-full py-4 rounded-2xl font-black text-lg tracking-wide uppercase flex items-center justify-center gap-3 transition-all shadow-lg ${
          isLaunching
            ? 'bg-mc-card border border-emerald-500/40 text-emerald-400 cursor-not-allowed'
            : !username.trim()
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            : 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-glow hover:shadow-glow-lg hover:scale-[1.01] active:scale-[0.99]'
        }`}
      >
        {isLaunching ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Iniciando Minecraft...</span>
          </>
        ) : (
          <>
            <Play className="w-6 h-6 fill-white" />
            <span>JUGAR AHORA</span>
          </>
        )}
      </button>
    </div>
  );
};
