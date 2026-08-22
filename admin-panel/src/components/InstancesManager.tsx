import React, { useState } from 'react';
import {
  Box,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Server,
  Cpu,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Flame,
  Globe
} from 'lucide-react';
import { RemoteInstance, supabase } from '../supabase';

interface InstancesManagerProps {
  instances: RemoteInstance[];
  onRefresh: () => void;
}

export const InstancesManager: React.FC<InstancesManagerProps> = ({ instances, onRefresh }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<RemoteInstance | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Form fields
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMcVersion, setFormMcVersion] = useState('1.21.1');
  const [formModLoader, setFormModLoader] = useState<'neoforge' | 'fabric' | 'forge' | 'vanilla'>('neoforge');
  const [formLoaderVersion, setFormLoaderVersion] = useState('21.1.247');
  const [formServerIp, setFormServerIp] = useState('play.tuserver.com');
  const [formServerPort, setFormServerPort] = useState(25565);
  const [formRam, setFormRam] = useState(4096);
  const [formIcon, setFormIcon] = useState('flame');
  const [formIsOfficial, setFormIsOfficial] = useState(true);

  const handleOpenCreate = () => {
    setSelectedInstance(null);
    setFormId(`instance-${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormDescription('');
    setFormMcVersion('1.21.1');
    setFormModLoader('neoforge');
    setFormLoaderVersion('21.1.247');
    setFormServerIp('play.tuserver.com');
    setFormServerPort(25565);
    setFormRam(4096);
    setFormIcon('flame');
    setFormIsOfficial(true);
    setIsEditing(true);
  };

  const handleOpenEdit = (inst: RemoteInstance) => {
    setSelectedInstance(inst);
    setFormId(inst.id);
    setFormName(inst.name);
    setFormDescription(inst.description || '');
    setFormMcVersion(inst.minecraft_version);
    setFormModLoader(inst.mod_loader);
    setFormLoaderVersion(inst.mod_loader_version || '');
    setFormServerIp(inst.server_ip || 'play.tuserver.com');
    setFormServerPort(inst.server_port || 25565);
    setFormRam(inst.custom_ram || 4096);
    setFormIcon(inst.icon || 'flame');
    setFormIsOfficial(inst.is_official ?? true);
    setIsEditing(true);
  };

  const executeDbQuery = async (action: (tableName: string) => Promise<{ error: any }>) => {
    let res = await action('instances');
    if (res.error) {
      res = await action('remote_instances');
    }
    if (res.error) throw res.error;
  };

  const handleSetDefault = async (inst: RemoteInstance) => {
    try {
      // 1. Set all to is_default = false
      await executeDbQuery((tbl) => supabase.from(tbl).update({ is_default: false }).neq('id', ''));
      // 2. Set target to is_default = true, is_active = true
      await executeDbQuery((tbl) => supabase.from(tbl).update({ is_default: true, is_active: true, updated_at: new Date().toISOString() }).eq('id', inst.id));
      
      // 3. Notify realtime
      await supabase.from('launcher_config').update({ updated_at: new Date().toISOString() }).eq('id', 'global');

      setToast(`⭐ "${inst.name}" establecida como Instancia Principal`);
      setTimeout(() => setToast(null), 3000);
      onRefresh();
    } catch (err: any) {
      alert(`Error al activar instancia: ${err.message}`);
    }
  };

  const handleToggleActive = async (inst: RemoteInstance) => {
    try {
      const nextState = !inst.is_active;
      await executeDbQuery((tbl) => supabase.from(tbl).update({ is_active: nextState, updated_at: new Date().toISOString() }).eq('id', inst.id));
      setToast(nextState ? `🟢 "${inst.name}" activada` : `⚪ "${inst.name}" desactivada`);
      setTimeout(() => setToast(null), 3000);
      onRefresh();
    } catch (err: any) {
      alert(`Error cambiando visibilidad: ${err.message}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formName,
        description: formDescription,
        minecraft_version: formMcVersion,
        mod_loader: formModLoader,
        mod_loader_version: formLoaderVersion,
        server_ip: formServerIp,
        server_port: Number(formServerPort),
        custom_ram: Number(formRam),
        icon: formIcon,
        is_official: formIsOfficial,
        updated_at: new Date().toISOString()
      };

      if (selectedInstance) {
        // Update
        await executeDbQuery((tbl) => supabase.from(tbl).update(payload).eq('id', selectedInstance.id));
        setToast('✅ Instancia actualizada con éxito');
      } else {
        // Insert
        const cleanId = formId.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        await executeDbQuery((tbl) =>
          supabase.from(tbl).insert({
            id: cleanId,
            ...payload,
            is_default: false,
            is_active: true
          })
        );
        setToast('✅ Nueva instancia creada con éxito');
      }

      setTimeout(() => setToast(null), 3000);
      setIsEditing(false);
      onRefresh();
    } catch (err: any) {
      alert(`Error al guardar instancia: ${err.message}`);
    }
  };

  const handleDelete = async (inst: RemoteInstance) => {
    if (inst.is_default) {
      alert('La instancia por defecto no se puede eliminar.');
      return;
    }
    if (!confirm(`¿Estás seguro de eliminar la instancia "${inst.name}" y desvincular sus mods?`)) return;

    try {
      await executeDbQuery((tbl) => supabase.from(tbl).delete().eq('id', inst.id));
      onRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="bg-admin-card border border-admin-border rounded-3xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-admin-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Gestión de Instancias y Perfiles</h3>
            <p className="text-xs text-slate-400">
              Crea modpacks o versiones personalizadas con servidores y listas de mods independientes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {toast && (
            <div className="flex items-center gap-2 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-xs px-3.5 py-1.5 rounded-full shadow-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {toast}
            </div>
          )}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nueva Instancia
          </button>
        </div>
      </div>

      {/* Instances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {instances.map((inst) => (
          <div
            key={inst.id}
            className={`border rounded-2xl p-5 space-y-4 transition-all shadow-lg relative group ${
              inst.is_default
                ? 'bg-[#0e1424] border-indigo-500/60 shadow-indigo-500/10'
                : inst.is_active
                ? 'bg-[#0a0d14] border-admin-border hover:border-slate-700'
                : 'bg-[#080a0f] border-slate-900 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${inst.is_default ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-extrabold text-white">
                      {inst.name}
                    </h4>
                    {inst.is_default && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                        ⭐ Principal Activa
                      </span>
                    )}
                    {!inst.is_active && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-bold">
                        Oculta
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">ID: {inst.id}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(inst)}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Editar Parámetros"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {!inst.is_default && (
                  <button
                    type="button"
                    onClick={() => handleDelete(inst)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                    title="Eliminar Instancia"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400 line-clamp-2">{inst.description || 'Sin descripción.'}</p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-admin-border/50 text-[11px] font-mono text-slate-300">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{inst.server_ip}:{inst.server_port}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span className="capitalize">{inst.mod_loader} {inst.minecraft_version}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-500" />
                <span>{inst.custom_ram} MB RAM</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                <span>{inst.is_official ? 'Oficial' : 'Comunidad'}</span>
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-admin-border/40 gap-2">
              <button
                type="button"
                onClick={() => handleToggleActive(inst)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                  inst.is_active
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400'
                }`}
                title="Mostrar u ocultar esta instancia en los launchers"
              >
                {inst.is_active ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                {inst.is_active ? 'Visible en Launcher' : 'Oculta'}
              </button>

              {!inst.is_default && (
                <button
                  type="button"
                  onClick={() => handleSetDefault(inst)}
                  className="text-[11px] font-bold px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-xl transition-all active:scale-95 shadow-sm flex items-center gap-1"
                >
                  ⭐ Hacer Principal
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-admin-card border border-admin-border rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-admin-border pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-400" />
                {selectedInstance ? `Editar Instancia: ${selectedInstance.name}` : 'Crear Nueva Instancia Oficial'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">ID Único (Carpeta)</label>
                  <input
                    type="text"
                    required
                    disabled={!!selectedInstance}
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="ej. cobblemon-1-20"
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Nombre Visible</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="ej. Cobblemon Oficial"
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-300 block mb-1">Descripción</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe los mods principales o el propósito del modpack..."
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Versión de Minecraft</label>
                  <input
                    type="text"
                    required
                    value={formMcVersion}
                    onChange={(e) => setFormMcVersion(e.target.value)}
                    placeholder="1.21.1"
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Mod Loader</label>
                  <select
                    value={formModLoader}
                    onChange={(e: any) => setFormModLoader(e.target.value)}
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="neoforge">NeoForge</option>
                    <option value="fabric">Fabric</option>
                    <option value="forge">Forge</option>
                    <option value="vanilla">Vanilla</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">IP del Servidor</label>
                  <input
                    type="text"
                    required
                    value={formServerIp}
                    onChange={(e) => setFormServerIp(e.target.value)}
                    placeholder="play.tuserver.com"
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Puerto del Servidor</label>
                  <input
                    type="number"
                    required
                    value={formServerPort}
                    onChange={(e) => setFormServerPort(Number(e.target.value))}
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">RAM Recomendada (MB)</label>
                  <input
                    type="number"
                    step={512}
                    value={formRam}
                    onChange={(e) => setFormRam(Number(e.target.value))}
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Versión del Loader (Opcional)</label>
                  <input
                    type="text"
                    value={formLoaderVersion}
                    onChange={(e) => setFormLoaderVersion(e.target.value)}
                    placeholder="ej. 21.1.247"
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-admin-border">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95"
                >
                  Guardar Instancia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
