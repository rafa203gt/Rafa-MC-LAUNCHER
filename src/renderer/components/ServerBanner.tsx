import React, { useState } from 'react';
import { Wifi, WifiOff, Users, Server, Zap, RefreshCw, Copy, Check } from 'lucide-react';
import { ServerStatusResult } from '../types';

interface ServerBannerProps {
  serverStatus: ServerStatusResult | null;
  serverName: string;
  serverIp: string;
  serverPort: number;
  autoConnect: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}

export const ServerBanner: React.FC<ServerBannerProps> = ({
  serverStatus,
  serverName,
  serverIp,
  serverPort,
  autoConnect,
  isLoading,
  onRefresh
}) => {
  const [copied, setCopied] = useState(false);
  const isOnline = serverStatus?.online ?? false;
  const playersOnline = serverStatus?.players?.online ?? 0;
  const playersMax = serverStatus?.players?.max ?? 0;
  const latency = serverStatus?.latency ?? 0;
  const motd = serverStatus?.motd?.clean || 'Servidor Oficial con Modpack Personalizado';

  const fullAddress = `${serverIp}${serverPort && serverPort !== 25565 ? `:${serverPort}` : ''}`;

  const handleCopyIp = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLatencyColor = (ms: number) => {
    if (ms <= 0) return 'text-slate-400';
    if (ms < 60) return 'text-emerald-400';
    if (ms < 120) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getLatencyLabel = (ms: number) => {
    if (ms <= 0) return '-';
    if (ms < 60) return `${ms}ms (Excelente)`;
    if (ms < 120) return `${ms}ms (Buena)`;
    return `${ms}ms (Alta)`;
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-mc-border/80 bg-gradient-to-r from-mc-card via-[#111522] to-mc-darker p-6 shadow-2xl transition-all duration-300">
      {/* Ambient Glow */}
      <div className="absolute -right-16 -top-16 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        {/* Server Info */}
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {isOnline ? 'Servidor En Línea' : 'Servidor Offline'}
            </span>

            {autoConnect && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Zap className="w-3 h-3 text-indigo-400" />
                Auto-Conexión Directa
              </span>
            )}

            <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <Zap className="w-3 h-3 text-amber-400" />
              Aceleración GPU Activa
            </span>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Actualizar estado del servidor"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Server className="w-6 h-6 text-emerald-400" />
            {serverName || 'Rafa Server'}
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyIp}
              className="group flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-mc-border/80 hover:border-emerald-500/50 px-3.5 py-1.5 rounded-xl text-xs font-mono text-slate-300 hover:text-white transition-all shadow-inner active:scale-95"
              title="Copiar dirección IP al portapapeles"
            >
              <span className="font-bold text-white group-hover:text-emerald-300 transition-colors">
                {serverIp}
              </span>
              <span className="text-slate-500">:{serverPort || 25565}</span>
              {copied ? (
                <span className="flex items-center gap-1 text-[11px] font-sans font-bold text-emerald-400 ml-1.5 animate-fadeIn">
                  <Check className="w-3.5 h-3.5" />
                  ¡Copiado!
                </span>
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors ml-1" />
              )}
            </button>
          </div>

          <p className="text-xs text-slate-400 line-clamp-1 italic mt-1.5 bg-black/25 px-3.5 py-2 rounded-xl border border-white/5">
            "{motd}"
          </p>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-3.5 self-stretch lg:self-center justify-end">
          {/* Players Badge */}
          <div className="bg-mc-darker/90 border border-mc-border/80 px-4 py-3 rounded-2xl flex items-center gap-3.5 shadow-lg flex-1 lg:flex-initial">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Jugadores</div>
              <div className="text-sm font-extrabold text-white font-mono">
                {isOnline ? `${playersOnline} / ${playersMax}` : '- / -'}
              </div>
            </div>
          </div>

          {/* Latency Badge */}
          <div className="bg-mc-darker/90 border border-mc-border/80 px-4 py-3 rounded-2xl flex items-center gap-3.5 shadow-lg flex-1 lg:flex-initial">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Latencia</div>
              <div className={`text-xs font-extrabold font-mono ${getLatencyColor(latency)}`}>
                {isOnline ? getLatencyLabel(latency) : 'Inaccesible'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
