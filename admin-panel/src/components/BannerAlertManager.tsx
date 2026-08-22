import React, { useState } from 'react';
import { Megaphone, Save, Trash2, CheckCircle2, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { LauncherConfig, supabase } from '../supabase';

interface BannerAlertManagerProps {
  config: LauncherConfig;
  onUpdated: (newConfig: LauncherConfig) => void;
}

export const BannerAlertManager: React.FC<BannerAlertManagerProps> = ({ config, onUpdated }) => {
  const [alertText, setAlertText] = useState(config.banner_alert || '');
  const [alertType, setAlertType] = useState<LauncherConfig['banner_alert_type']>(config.banner_alert_type || 'info');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('launcher_config')
        .update({
          banner_alert: alertText.trim() ? alertText.trim() : null,
          banner_alert_type: alertType,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global')
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onUpdated(data as LauncherConfig);
        setToast('✅ ¡Alerta de banner actualizada en vivo!');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setAlertText('');
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('launcher_config')
        .update({
          banner_alert: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global')
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onUpdated(data as LauncherConfig);
        setToast('🗑️ Alerta de banner eliminada');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-admin-card border border-admin-border rounded-3xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-admin-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Alerta Global en Barra Superior (Banner Alert)</h3>
            <p className="text-xs text-slate-400">Transmite un aviso en vivo a todos los jugadores que tengan el launcher abierto</p>
          </div>
        </div>

        {toast && (
          <div className="flex items-center gap-2 bg-slate-900 border border-admin-border text-xs px-3.5 py-1.5 rounded-full shadow-lg text-emerald-400">
            {toast}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3">
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Texto del Anuncio / Alerta</label>
          <input
            type="text"
            value={alertText}
            onChange={(e) => setAlertText(e.target.value)}
            placeholder="Ej: ¡Este fin de semana tenemos x2 de experiencia y evento de jefes!"
            className="w-full bg-[#0a0d14] border border-admin-border focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Tipo de Alerta</label>
          <select
            value={alertType}
            onChange={(e) => setAlertType(e.target.value as any)}
            className="w-full bg-[#0a0d14] border border-admin-border focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition-colors"
          >
            <option value="info">Información (Azul / Cyan)</option>
            <option value="warning">Advertencia (Ámbar / Naranja)</option>
            <option value="error">Urgente / Error (Rojo)</option>
            <option value="success">Éxito / Celebración (Verde)</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {config.banner_alert && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-bold rounded-xl transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar Banner
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Publicar Alerta
        </button>
      </div>
    </div>
  );
};
