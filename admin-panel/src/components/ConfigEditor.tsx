import React, { useState } from 'react';
import { Server, Save, Globe, Cpu, Layers, Link as LinkIcon, CheckCircle2, RefreshCw } from 'lucide-react';
import { LauncherConfig, supabase } from '../supabase';

interface ConfigEditorProps {
  config: LauncherConfig;
  onUpdated: (newConfig: LauncherConfig) => void;
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({ config, onUpdated }) => {
  const [formData, setFormData] = useState<LauncherConfig>({ ...config });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('launcher_config')
        .update({
          server_name: formData.server_name,
          server_ip: formData.server_ip,
          server_port: Number(formData.server_port),
          auto_connect: formData.auto_connect,
          minecraft_version: formData.minecraft_version,
          mod_loader: formData.mod_loader,
          mod_loader_version: formData.mod_loader_version,
          modpack_manifest_url: formData.modpack_manifest_url,
          discord_url: formData.discord_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global')
        .select()
        .single();

      if (error) throw error;
      if (data) {
        onUpdated(data as LauncherConfig);
        setToast('¡Configuración guardada y sincronizada en vivo con todos los launchers!');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-admin-card border border-admin-border rounded-3xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-admin-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Configuración del Servidor y Modpack</h3>
            <p className="text-xs text-slate-400">Modifica los parámetros en vivo sin necesidad de recompilar la app</p>
          </div>
        </div>

        {toast && (
          <div className="flex items-center gap-2 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-xs px-3.5 py-1.5 rounded-full shadow-lg animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {toast}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nombre del Servidor */}
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Nombre del Servidor</label>
          <input
            type="text"
            required
            value={formData.server_name}
            onChange={(e) => setFormData({ ...formData, server_name: e.target.value })}
            className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none transition-colors"
          />
        </div>

        {/* Dirección IP */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-300 block mb-1.5">IP o Dominio</label>
            <input
              type="text"
              required
              value={formData.server_ip}
              onChange={(e) => setFormData({ ...formData, server_ip: e.target.value })}
              className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Puerto</label>
            <input
              type="number"
              required
              value={formData.server_port}
              onChange={(e) => setFormData({ ...formData, server_port: Number(e.target.value) })}
              className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Versión de Minecraft */}
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Versión de Minecraft</label>
          <input
            type="text"
            required
            value={formData.minecraft_version}
            onChange={(e) => setFormData({ ...formData, minecraft_version: e.target.value })}
            className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none transition-colors"
          />
        </div>

        {/* Cargador de Mods & Versión */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Mod Loader</label>
            <select
              value={formData.mod_loader}
              onChange={(e) => setFormData({ ...formData, mod_loader: e.target.value })}
              className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition-colors"
            >
              <option value="neoforge">NeoForge</option>
              <option value="fabric">Fabric</option>
              <option value="forge">Forge</option>
              <option value="vanilla">Vanilla</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Versión del Loader</label>
            <input
              type="text"
              value={formData.mod_loader_version}
              onChange={(e) => setFormData({ ...formData, mod_loader_version: e.target.value })}
              className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* URL Manifiesto de Mods */}
        <div className="md:col-span-2">
          <label className="text-xs font-bold text-slate-300 block mb-1.5">URL del Manifiesto Remoto (`manifest.json`)</label>
          <input
            type="url"
            required
            value={formData.modpack_manifest_url}
            onChange={(e) => setFormData({ ...formData, modpack_manifest_url: e.target.value })}
            className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
          />
        </div>

        {/* Discord URL */}
        <div className="md:col-span-2">
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Enlace a la Comunidad / Discord</label>
          <input
            type="url"
            value={formData.discord_url}
            onChange={(e) => setFormData({ ...formData, discord_url: e.target.value })}
            placeholder="https://discord.gg/tu-comunidad"
            className="w-full bg-[#0a0d14] border border-admin-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex justify-end pt-3">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar Cambios en Vivo
        </button>
      </div>
    </form>
  );
};
