import React, { useState, useEffect } from 'react';
import { Activity, Users, Signal, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { LauncherConfig } from '../supabase';

interface LiveServerMonitorProps {
  config: LauncherConfig;
}

export const LiveServerMonitor: React.FC<LiveServerMonitorProps> = ({ config }) => {
  const [online, setOnline] = useState<boolean | null>(null);
  const [players, setPlayers] = useState<{ online: number; max: number }>({ online: 0, max: 0 });
  const [motd, setMotd] = useState<string>('');
  const [ping, setPing] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const checkStatus = async () => {
    if (!config.server_ip) return;
    setIsLoading(true);
    const start = Date.now();
    try {
      const res = await axios.get(
        `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(config.server_ip)}:${config.server_port}`,
        { timeout: 6000 }
      );
      const elapsed = Date.now() - start;
      setPing(elapsed);
      if (res.data) {
        setOnline(res.data.online);
        if (res.data.online) {
          setPlayers({
            online: res.data.players?.online || 0,
            max: res.data.players?.max || 0
          });
          setMotd(res.data.motd?.clean || '');
        }
      }
    } catch {
      setOnline(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 20000);
    return () => clearInterval(interval);
  }, [config.server_ip, config.server_port]);

  return (
    <div className="bg-admin-card border border-admin-border rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-admin-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Monitor del Servidor en Vivo</h3>
            <p className="text-xs text-slate-400">Estado de conexión y jugadores conectados en tiempo real</p>
          </div>
        </div>

        <button
          onClick={checkStatus}
          disabled={isLoading}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0a0d14] border border-admin-border rounded-2xl p-4 flex items-center gap-3.5">
          <div className={`w-3 h-3 rounded-full ${online ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]' : 'bg-rose-500'}`} />
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Estado</span>
            <span className="text-sm font-extrabold text-white">{online ? 'En Línea' : 'Desconectado'}</span>
          </div>
        </div>

        <div className="bg-[#0a0d14] border border-admin-border rounded-2xl p-4 flex items-center gap-3.5">
          <Users className="w-5 h-5 text-indigo-400" />
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Jugadores</span>
            <span className="text-sm font-extrabold text-white">
              {online ? `${players.online} / ${players.max}` : '0 / 0'}
            </span>
          </div>
        </div>

        <div className="bg-[#0a0d14] border border-admin-border rounded-2xl p-4 flex items-center gap-3.5">
          <Signal className="w-5 h-5 text-cyan-400" />
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Latencia</span>
            <span className="text-sm font-extrabold text-white">{online ? `${ping} ms` : '—'}</span>
          </div>
        </div>
      </div>

      {motd && (
        <div className="p-3 bg-[#0a0d14] border border-admin-border rounded-xl text-xs text-slate-300 font-mono truncate">
          {motd}
        </div>
      )}
    </div>
  );
};
