import React, { useState, useMemo } from 'react';
import {
  Users,
  Monitor,
  Gamepad2,
  Search,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { supabase, LauncherUser } from '../supabase';

interface UsersAnalyticsProps {
  users: LauncherUser[];
  onRefresh: () => void;
  isLoading: boolean;
}

export const UsersAnalytics: React.FC<UsersAnalyticsProps> = ({ users, onRefresh, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick KPI calculations
  const totalUsers = users.length;

  const active24hCount = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return users.filter((u) => {
      const lastSeenTime = new Date(u.last_seen).getTime();
      return lastSeenTime >= oneDayAgo || u.is_online;
    }).length;
  }, [users]);

  const totalLaunches = useMemo(() => {
    return users.reduce((acc, u) => acc + (Number(u.launch_count) || 1), 0);
  }, [users]);

  const avgRam = useMemo(() => {
    if (!users.length) return '0 GB';
    const sum = users.reduce((acc, u) => acc + (Number(u.total_ram_gb) || 0), 0);
    return `${(sum / users.length).toFixed(1)} GB`;
  }, [users]);

  // Filtering
  const filteredUsers = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return users.filter((u) => {
      const matchesSearch =
        u.device_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.player_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.os_platform?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.last_instance_played?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.client_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.ip_address?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const isRecentlyActive = new Date(u.last_seen).getTime() >= oneDayAgo || u.is_online;
      if (filterStatus === 'online') return isRecentlyActive;
      if (filterStatus === 'offline') return !isRecentlyActive;
      return true;
    });
  }, [users, searchTerm, filterStatus]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteUser = async (user: LauncherUser) => {
    if (!confirm(`¿Eliminar el registro del dispositivo "${user.device_name}"?`)) return;
    try {
      const { error } = await supabase.from('launcher_users').delete().eq('client_id', user.client_id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(`Error al eliminar registro: ${err.message}`);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 60) return 'Hace unos segundos';
      if (diffMin < 60) return `Hace ${diffMin} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return 'Ayer';
      return `Hace ${diffDays} días`;
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 bg-indigo-500/20 border border-indigo-500/40 rounded-2xl text-indigo-400 shadow-inner">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-wide">
                  Registro y Telemetría de Jugadores
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> 100% Antivirus Seguro
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Monitorea en tiempo real quién usa tu software, nombres de equipos, cuentas de Minecraft y modpacks jugados.
              </p>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar Lista
          </button>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Equipos Únicos</span>
              <span className="text-xl font-black text-white">{totalUsers}</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Activos en 24h</span>
              <span className="text-xl font-black text-emerald-400">{active24hCount}</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Partidas Lanzadas</span>
              <span className="text-xl font-black text-purple-300">{totalLaunches}</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">RAM Promedio</span>
              <span className="text-xl font-black text-teal-300">{avgRam}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por equipo, usuario de Minecraft, SO o modpack..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              filterStatus === 'all' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            Todos ({totalUsers})
          </button>
          <button
            onClick={() => setFilterStatus('online')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              filterStatus === 'online' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            🟢 Activos Recientes ({active24hCount})
          </button>
          <button
            onClick={() => setFilterStatus('offline')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              filterStatus === 'offline' ? 'bg-slate-700 text-white shadow' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            Inactivos ({Math.max(0, totalUsers - active24hCount)})
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Equipo / Dispositivo</th>
                <th className="px-6 py-4">Usuario Minecraft</th>
                <th className="px-6 py-4">Dirección IP</th>
                <th className="px-6 py-4">Sistema & RAM</th>
                <th className="px-6 py-4">Versión</th>
                <th className="px-6 py-4">Último Modpack</th>
                <th className="px-6 py-4 text-center">Partidas</th>
                <th className="px-6 py-4">Última Conexión</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-slate-500">
                    <Users className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-60" />
                    <p className="text-sm font-bold text-slate-400">No se encontraron registros de usuarios</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Los usuarios se registran automáticamente en esta tabla en cuanto abren el launcher en sus computadoras o inician el juego.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                  const isRecent = new Date(user.last_seen).getTime() >= oneDayAgo || user.is_online;

                  return (
                    <tr key={user.client_id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Device Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isRecent ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-slate-600'
                            }`}
                            title={isRecent ? 'Activo / Reciente' : 'Desconectado'}
                          />
                          <div>
                            <span className="font-bold text-white block">{user.device_name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-500 font-mono">
                                ID: {user.client_id.slice(0, 14)}...
                              </span>
                              <button
                                onClick={() => handleCopyId(user.client_id)}
                                className="text-slate-500 hover:text-indigo-400 transition-colors"
                                title="Copiar ID de cliente"
                              >
                                {copiedId === user.client_id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Minecraft Username */}
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold font-mono">
                          {user.player_username || 'Jugador'}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 w-fit">
                          <span>{user.ip_address || 'Desconocida'}</span>
                          {user.ip_address && user.ip_address !== 'Desconocida' && (
                            <button
                              onClick={() => handleCopyId(user.ip_address!)}
                              className="text-emerald-400/60 hover:text-emerald-300 transition-colors"
                              title="Copiar IP pública"
                            >
                              {copiedId === user.ip_address ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* OS & RAM */}
                      <td className="px-6 py-4">
                        <div>
                          <span className="text-slate-300 font-mono text-[11px] block">
                            {user.os_platform || 'Windows'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            {user.total_ram_gb ? `${user.total_ram_gb} GB RAM` : 'N/D'}
                          </span>
                        </div>
                      </td>

                      {/* Launcher Version */}
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700">
                          v{user.launcher_version || '1.0.27'}
                        </span>
                      </td>

                      {/* Last Instance Played */}
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          {user.last_instance_played || 'All The Mods 10'}
                        </span>
                      </td>

                      {/* Launch Count */}
                      <td className="px-6 py-4 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-black font-mono">
                          {user.launch_count || 1}
                        </span>
                      </td>

                      {/* Last Seen */}
                      <td className="px-6 py-4">
                        <div>
                          <span className="text-slate-200 font-bold block">{formatRelativeTime(user.last_seen)}</span>
                          <span className="text-[10px] text-slate-500">{formatDate(user.last_seen)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                          title="Eliminar Registro de este Dispositivo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
