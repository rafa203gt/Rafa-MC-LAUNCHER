import React, { useState, useEffect } from 'react';
import {
  Play,
  User,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Layers,
  Box,
  Sparkles,
  ChevronDown,
  Flame,
  KeyRound,
  Users
} from 'lucide-react';
import { ProgressEventPayload, MinecraftInstance, UserAccount } from '../types';
import { AccountManagerModal } from './AccountManagerModal';

interface PlayControlsProps {
  username: string;
  setUsername: (name: string) => void;
  maxRam: number;
  onRamChange?: (ram: number) => void;
  activeInstance: MinecraftInstance | null;
  instances: MinecraftInstance[];
  onSwitchInstance: (instanceId: string) => void;
  isLaunching: boolean;
  progress: ProgressEventPayload | null;
  onLaunch: () => void;
}

export const PlayControls: React.FC<PlayControlsProps> = ({
  username,
  setUsername,
  maxRam,
  onRamChange,
  activeInstance,
  instances,
  onSwitchInstance,
  isLaunching,
  progress,
  onLaunch
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [activeAccount, setActiveAccount] = useState<UserAccount | null>(null);

  const loadActiveAccount = async () => {
    if (window.launcherAPI?.getActiveAccount) {
      try {
        const acc = await window.launcherAPI.getActiveAccount();
        if (acc) {
          setActiveAccount(acc);
          if (acc.username && acc.username !== username) {
            setUsername(acc.username);
          }
        }
      } catch {}
    }
  };

  useEffect(() => {
    loadActiveAccount();
  }, []);

  const currentUsername = username.trim() || 'Steve';
  const avatarUrl =
    activeAccount?.type === 'microsoft' && activeAccount?.uuid
      ? `https://mc-heads.net/avatar/${encodeURIComponent(activeAccount.uuid)}/64`
      : `https://mc-heads.net/avatar/${encodeURIComponent(currentUsername)}/64`;

  const isAtm10 = activeInstance?.id === 'atm10';
  const isVanilla = activeInstance?.modLoader === 'vanilla';
  const isMicrosoft = activeAccount?.type === 'microsoft';

  return (
    <div className="bg-gradient-to-b from-mc-card to-[#0d1017] border border-mc-border/80 rounded-3xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Ambient Lights */}
      <div className="absolute top-0 right-1/4 w-96 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Account Manager Modal */}
      <AccountManagerModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currentUsername={username}
        onAccountSwitched={(acc) => {
          setActiveAccount(acc);
          setUsername(acc.username);
        }}
      />

      {/* Main Grid: Player Profile + Active Instance Station */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* User Card (Cols: 5) */}
        <div className="lg:col-span-5 bg-mc-darker/80 border border-mc-border/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-md relative group">
          <div className="relative shrink-0 cursor-pointer" onClick={() => setIsAccountModalOpen(true)}>
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-13 h-13 rounded-2xl bg-black/40 border border-mc-border p-0.5 shadow-inner transition-transform hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/64.png';
              }}
            />
            {isMicrosoft ? (
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full border-2 border-mc-card flex items-center justify-center shadow"
                title="Cuenta Oficial Microsoft (Premium)"
              >
                <ShieldCheck className="w-3 h-3 text-white" />
              </div>
            ) : (
              <div
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-mc-card flex items-center justify-center shadow"
                title="Cuenta No-Premium"
              >
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                {isMicrosoft ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-blue-400" />
                    <span className="text-blue-400">Microsoft Official</span>
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3 text-emerald-400" />
                    <span>Jugador No-Premium</span>
                  </>
                )}
              </label>

              <button
                type="button"
                onClick={() => setIsAccountModalOpen(true)}
                className="text-[10px] font-bold text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-lg border border-mc-border/50"
              >
                <Users className="w-3 h-3" />
                Cuentas
              </button>
            </div>

            {isMicrosoft ? (
              <div
                onClick={() => setIsAccountModalOpen(true)}
                className="w-full bg-black/40 border border-blue-500/40 rounded-xl px-3 py-1.5 text-sm font-bold text-white flex items-center justify-between cursor-pointer hover:border-blue-400 transition-all shadow-inner"
              >
                <span className="truncate">{username}</span>
                <span className="text-[10px] text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded font-mono">Premium</span>
              </div>
            ) : (
              <input
                type="text"
                value={username}
                disabled={isLaunching}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={(e) => {
                  const clean = e.target.value.trim() || 'Jugador';
                  setUsername(clean);
                  if (window.launcherAPI?.addOfflineAccount) {
                    window.launcherAPI.addOfflineAccount(clean);
                  }
                }}
                placeholder="Ingresa tu apodo..."
                maxLength={20}
                className="w-full bg-black/40 border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-1.5 text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
              />
            )}
          </div>
        </div>

        {/* Active Instance Selector (Cols: 7) */}
        <div className="lg:col-span-7 bg-mc-darker/80 border border-mc-border/80 rounded-2xl p-4 relative shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-slate-900 border border-mc-border flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                {isAtm10 ? (
                  <Flame className="w-6 h-6 text-amber-400 animate-pulse" />
                ) : isVanilla ? (
                  <Box className="w-6 h-6 text-emerald-400" />
                ) : (
                  <Layers className="w-6 h-6 text-cyan-400" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Instancia Activa
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.2 bg-emerald-500/15 text-emerald-300 rounded border border-emerald-500/20 font-bold">
                    MC {activeInstance?.minecraftVersion || '1.21.1'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white truncate">
                  {activeInstance?.name || 'All the Mods 10'}
                </h3>
              </div>
            </div>

            {/* Quick Switch Button */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={isLaunching}
                className="flex items-center gap-1.5 px-3 py-2 bg-mc-card hover:bg-slate-800 border border-mc-border hover:border-emerald-500/50 rounded-xl text-xs font-bold text-slate-200 transition-all active:scale-95 shrink-0"
              >
                <span>Cambiar</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-mc-card border border-mc-border rounded-2xl shadow-2xl z-30 p-2 space-y-1 animate-fadeIn">
                  <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1">
                    Seleccionar Perfil
                  </div>
                  {instances.map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => {
                        onSwitchInstance(inst.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all ${
                        inst.id === activeInstance?.id
                          ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="truncate">
                        <div className="truncate">{inst.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          MC {inst.minecraftVersion} • {inst.modLoader.toUpperCase()}
                        </div>
                      </div>
                      {inst.id === activeInstance?.id && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RAM & Hardware Tuning Bar */}
      <div className="bg-mc-darker/60 border border-mc-border/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">Asignación de Memoria RAM</div>
            <div className="text-[11px] text-slate-400">
              Recomendado: 8 GB para All The Mods 10, 4 GB para Vanilla
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-72 justify-end">
          <input
            type="range"
            min={2048}
            max={16384}
            step={1024}
            value={maxRam}
            disabled={isLaunching}
            onChange={(e) => onRamChange && onRamChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="text-xs font-mono font-extrabold text-emerald-400 bg-black/40 px-2.5 py-1 rounded-lg border border-emerald-500/30 shrink-0">
            {(maxRam / 1024).toFixed(1)} GB
          </span>
        </div>
      </div>

      {/* Progress Bar (when launching / downloading) */}
      {isLaunching && progress && (
        <div className="space-y-2.5 bg-mc-darker/90 p-4 rounded-2xl border border-mc-border/80 shadow-lg animate-fadeIn">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {progress.task}
            </span>
            <span className="font-mono font-extrabold text-white text-sm">
              {progress.percent}%
            </span>
          </div>

          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Massive Launch Button */}
      <div>
        <button
          onClick={onLaunch}
          disabled={isLaunching}
          className={`w-full py-4 rounded-2xl font-black text-base uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-300 shadow-2xl relative overflow-hidden group ${
            isLaunching
              ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50 hover:shadow-[0_10px_35px_rgba(16,185,129,0.4)] active:scale-[0.99] border border-emerald-400/30'
          }`}
        >
          {/* Button Ambient Glow */}
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {isLaunching ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Iniciando Entorno de Juego...</span>
            </>
          ) : (
            <>
              <Play className="w-6 h-6 fill-current stroke-none group-hover:scale-110 transition-transform" />
              <span>JUGAR AHORA</span>
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
