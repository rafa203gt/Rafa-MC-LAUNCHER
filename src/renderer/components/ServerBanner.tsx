import React from 'react';
import { Wifi, WifiOff, Users, Server, Zap, RefreshCw } from 'lucide-react';
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
  const isOnline = serverStatus?.online ?? false;
  const playersOnline = serverStatus?.players?.online ?? 0;
  const playersMax = serverStatus?.players?.max ?? 0;
  const latency = serverStatus?.latency ?? 0;
  const motd = serverStatus?.motd?.clean || 'Servidor Oficial con Modpack Personalizado';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-mc-border bg-gradient-to-r from-mc-card to-[#121622] p-6 shadow-xl">
      {/* Background Glow */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Server Info */}
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {isOnline ? 'Online' : 'Offline'}
            </span>

            {autoConnect && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Zap className="w-3 h-3 text-indigo-400" />
                Auto-Conexión Directa
              </span>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            {serverName || 'Rafa Server'}
          </h2>

          <p className="text-xs text-slate-400 font-mono tracking-tight flex items-center gap-1.5">
            <span className="text-slate-300 font-bold">{serverIp}</span>
            <span className="text-slate-500">:{serverPort || 25565}</span>
          </p>

          <p className="text-xs text-slate-400 line-clamp-1 italic mt-1 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
            "{motd}"
          </p>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-3 self-end md:self-center">
          {/* Players Badge */}
          <div className="bg-mc-darker/80 border border-mc-border px-4 py-2.5 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Jugadores</div>
              <div className="text-sm font-bold text-white">
                {isOnline ? `${playersOnline} / ${playersMax}` : '- / -'}
              </div>
            </div>
          </div>

          {/* Latency Badge */}
          <div className="bg-mc-darker/80 border border-mc-border px-4 py-2.5 rounded-xl flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}
            >
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Ping</div>
              <div className="text-sm font-bold text-white">
                {isOnline ? `${latency} ms` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 bg-mc-darker/80 border border-mc-border hover:border-slate-600 rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-50"
            title="Refrescar estado"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
