import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { LauncherConfig, supabase } from '../supabase';

interface MaintenanceToggleProps {
  config: LauncherConfig;
  onUpdated: (newConfig: LauncherConfig) => void;
}

export const MaintenanceToggle: React.FC<MaintenanceToggleProps> = ({ config, onUpdated }) => {
  const [maintenance, setMaintenance] = useState(config.maintenance_mode);
  const [message, setMessage] = useState(config.maintenance_message || '');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleToggle = async () => {
    setIsSaving(true);
    const newStatus = !maintenance;
    try {
      const { data, error } = await supabase
        .from('launcher_config')
        .update({
          maintenance_mode: newStatus,
          maintenance_message: message,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global')
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setMaintenance(newStatus);
        onUpdated(data as LauncherConfig);
        setToast(newStatus ? '🔴 ¡Modo mantenimiento ACTIVADO en vivo!' : '🟢 Modo mantenimiento DESACTIVADO');
        setTimeout(() => setToast(null), 3500);
      }
    } catch (err: any) {
      alert(`Error al actualizar modo mantenimiento: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMessage = async () => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('launcher_config')
        .update({
          maintenance_message: message,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global')
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onUpdated(data as LauncherConfig);
        setToast('✅ Mensaje de mantenimiento actualizado');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err: any) {
      alert(`Error al guardar mensaje: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`bg-admin-card border ${maintenance ? 'border-rose-500/50' : 'border-admin-border'} rounded-3xl p-6 shadow-xl space-y-5 transition-all duration-300`}>
      <div className="flex items-center justify-between border-b border-admin-border pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${maintenance ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400'}`}>
            <ShieldAlert className={`w-5 h-5 ${maintenance ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Modo Mantenimiento y Bloqueo de Lanzamiento</h3>
            <p className="text-xs text-slate-400">Impide que los jugadores inicien sesión durante tareas técnicas o migraciones</p>
          </div>
        </div>

        {toast && (
          <div className="flex items-center gap-2 bg-slate-900 border border-admin-border text-xs px-3.5 py-1.5 rounded-full shadow-lg animate-fadeIn text-white">
            {toast}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0a0d14] border border-admin-border">
        <div>
          <span className="text-sm font-bold text-white block">Estado del Mantenimiento</span>
          <span className="text-xs text-slate-400">
            {maintenance ? '🔴 Los jugadores NO pueden iniciar el juego' : '🟢 El juego está disponible para todos'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
            maintenance
              ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-900/30'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/30'
          }`}
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : maintenance ? (
            'Desactivar Mantenimiento'
          ) : (
            'Activar Modo Mantenimiento'
          )}
        </button>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-300 block mb-1.5">Mensaje visible para los jugadores</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ej: Estamos aplicando una actualización importante en el modpack. Regresamos a las 20:00."
            className="flex-1 bg-[#0a0d14] border border-admin-border focus:border-rose-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none transition-colors"
          />
          <button
            type="button"
            onClick={handleSaveMessage}
            disabled={isSaving}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all"
          >
            Actualizar Texto
          </button>
        </div>
      </div>
    </div>
  );
};
