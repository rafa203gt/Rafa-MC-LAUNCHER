import React, { useState, useMemo } from 'react';
import {
  Layers,
  Upload,
  Search,
  CheckCircle2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  FileCode,
  HardDrive,
  RefreshCw,
  Plus,
  AlertCircle,
  Box
} from 'lucide-react';
import { ModpackMod, RemoteInstance, supabase } from '../supabase';

interface ModpackManagerProps {
  mods: ModpackMod[];
  instances: RemoteInstance[];
  onRefresh: () => void;
}

export const ModpackManager: React.FC<ModpackManagerProps> = ({ mods, instances, onRefresh }) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('atm10');
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Form for new/updated mod
  const [newModName, setNewModName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileSize, setNewFileSize] = useState<number>(0);
  const [newSha1, setNewSha1] = useState('');
  const [newDownloadUrl, setNewDownloadUrl] = useState('');
  const [detectedOldMod, setDetectedOldMod] = useState<ModpackMod | null>(null);

  const calculateSha1 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>) => {
    let file: File | null = null;
    if ('dataTransfer' in e && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0];
    } else if ('target' in e && e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    }

    if (!file || !file.name.endsWith('.jar')) {
      alert('Por favor selecciona un archivo .jar de Minecraft');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Calculando SHA-1 del mod...');

    try {
      const sha1 = await calculateSha1(file);
      const fileName = file.name;
      const baseModName = fileName
        .replace(/\.jar$/i, '')
        .replace(/[-_](\d+\.\d+|v\d+|neoforge|forge|fabric).*/i, '')
        .replace(/[-_]/g, ' ')
        .trim();

      setNewFileName(fileName);
      setNewModName(baseModName || fileName);
      setNewFileSize(file.size);
      setNewSha1(sha1);
      setNewDownloadUrl(
        `https://github.com/rafa203gt/Rafa-MC-LAUNCHER/releases/download/v1.0.0/${encodeURIComponent(fileName)}`
      );

      // Intelligent detection of older versions within this instance
      const existing = mods.find((m) => {
        if ((m.instance_id || 'atm10') !== selectedInstanceId) return false;
        const mBase = m.file_name
          .replace(/\.jar$/i, '')
          .replace(/[-_](\d+\.\d+|v\d+|neoforge|forge|fabric).*/i, '')
          .toLowerCase();
        return mBase.length > 3 && baseModName.toLowerCase().startsWith(mBase);
      });

      if (existing && existing.file_name !== fileName) {
        setDetectedOldMod(existing);
      } else {
        setDetectedOldMod(null);
      }

      setUploadProgress(null);
    } catch (err: any) {
      alert(`Error procesando archivo: ${err.message}`);
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveMod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName || !newSha1) return;

    try {
      setIsUploading(true);
      // If replacing an old version, remove old mod record first
      if (detectedOldMod) {
        await supabase.from('modpack_mods').delete().eq('id', detectedOldMod.id);
      }

      // Check if file_name already exists in this instance
      const { data: existing } = await supabase
        .from('modpack_mods')
        .select('id')
        .eq('instance_id', selectedInstanceId)
        .eq('file_name', newFileName)
        .single();

      if (existing) {
        await supabase
          .from('modpack_mods')
          .update({
            mod_name: newModName,
            file_size: newFileSize,
            sha1: newSha1,
            download_url: newDownloadUrl,
            is_enabled: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('modpack_mods').insert({
          instance_id: selectedInstanceId,
          mod_name: newModName,
          file_name: newFileName,
          file_path: `mods/${newFileName}`,
          file_size: newFileSize,
          sha1: newSha1,
          download_url: newDownloadUrl,
          is_enabled: true,
          category: 'mod'
        });
      }

      const activeInstName = instances.find((i) => i.id === selectedInstanceId)?.name || selectedInstanceId;
      setToast(
        detectedOldMod
          ? `✅ Mod actualizado en ${activeInstName} (Reemplazada versión antigua: ${detectedOldMod.file_name})`
          : `✅ Mod ${newFileName} añadido a ${activeInstName} con éxito`
      );
      setTimeout(() => setToast(null), 3500);

      // Reset form
      setNewFileName('');
      setNewModName('');
      setNewSha1('');
      setNewDownloadUrl('');
      setDetectedOldMod(null);
      onRefresh();
    } catch (err: any) {
      alert(`Error al guardar mod: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleMod = async (mod: ModpackMod) => {
    try {
      const updatedStatus = !mod.is_enabled;
      const { error } = await supabase
        .from('modpack_mods')
        .update({ is_enabled: updatedStatus, updated_at: new Date().toISOString() })
        .eq('id', mod.id);

      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteMod = async (mod: ModpackMod) => {
    if (!confirm(`¿Estás seguro de eliminar el mod "${mod.file_name}" de esta instancia?`)) return;
    try {
      const { error } = await supabase.from('modpack_mods').delete().eq('id', mod.id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(`Error eliminando mod: ${err.message}`);
    }
  };

  // Filtered mods list for selected instance
  const instanceMods = useMemo(() => {
    return mods.filter((m) => (m.instance_id || 'atm10') === selectedInstanceId);
  }, [mods, selectedInstanceId]);

  const filteredMods = useMemo(() => {
    if (!search.trim()) return instanceMods;
    const q = search.toLowerCase();
    return instanceMods.filter(
      (m) => m.mod_name.toLowerCase().includes(q) || m.file_name.toLowerCase().includes(q)
    );
  }, [instanceMods, search]);

  const activeCount = useMemo(() => instanceMods.filter((m) => m.is_enabled).length, [instanceMods]);
  const totalSizeBytes = useMemo(() => instanceMods.reduce((acc, m) => acc + (m.file_size || 0), 0), [instanceMods]);
  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="bg-admin-card border border-admin-border rounded-3xl p-6 shadow-xl space-y-6">
      {/* Header & Instance Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-admin-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Gestor de Mods por Instancia</h3>
            <p className="text-xs text-slate-400">
              Selecciona la instancia para administrar o subir sus archivos .jar independientes
            </p>
          </div>
        </div>

        {/* Dropdown Selector */}
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-purple-400" />
          <select
            value={selectedInstanceId}
            onChange={(e) => setSelectedInstanceId(e.target.value)}
            className="bg-[#0a0d14] border border-purple-500/40 focus:border-purple-400 text-white font-bold text-xs rounded-xl px-3 py-2 focus:outline-none shadow-lg"
          >
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} ({inst.mod_loader} {inst.minecraft_version})
              </option>
            ))}
          </select>
        </div>
      </div>

      {toast && (
        <div className="flex items-center gap-2 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-xs px-3.5 py-2 rounded-xl shadow-lg animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#0a0d14] border border-admin-border">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Mods en Instancia</span>
          <span className="text-xl font-extrabold text-white">{instanceMods.length}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0a0d14] border border-admin-border">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Mods Activos</span>
          <span className="text-xl font-extrabold text-emerald-400">{activeCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0a0d14] border border-admin-border">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Deshabilitados</span>
          <span className="text-xl font-extrabold text-slate-500">{instanceMods.length - activeCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0a0d14] border border-admin-border">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tamaño Total</span>
          <span className="text-xl font-extrabold text-cyan-400">{totalSizeMB} MB</span>
        </div>
      </div>

      {/* Drag and Drop Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        className="border-2 border-dashed border-admin-border hover:border-purple-500/60 rounded-2xl p-6 text-center transition-all bg-[#0a0d14]/50 cursor-pointer relative group"
      >
        <input
          type="file"
          accept=".jar"
          onChange={handleFileDrop}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-white">
            Arrastra un archivo .jar para subirlo a la instancia seleccionada
          </span>
          <span className="text-xs text-slate-500">
            Calcula automáticamente el SHA-1 y detecta si es una versión más reciente
          </span>
          {uploadProgress && (
            <span className="text-xs font-bold text-cyan-400 animate-pulse mt-2">{uploadProgress}</span>
          )}
        </div>
      </div>

      {/* Upload Confirmation Form */}
      {newFileName && (
        <form onSubmit={handleSaveMod} className="bg-[#0a0d14] border border-purple-500/40 rounded-2xl p-5 space-y-4 animate-fadeIn shadow-2xl">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              Detalles del Mod para {instances.find((i) => i.id === selectedInstanceId)?.name}
            </h4>
            <button
              type="button"
              onClick={() => setNewFileName('')}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancelar
            </button>
          </div>

          {detectedOldMod && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>¡Versión anterior detectada en esta instancia!</strong> Se reemplazará:{' '}
                <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono">{detectedOldMod.file_name}</code>
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Nombre del Mod</label>
              <input
                type="text"
                required
                value={newModName}
                onChange={(e) => setNewModName(e.target.value)}
                className="w-full bg-[#111622] border border-admin-border focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Archivo (.jar)</label>
              <input
                type="text"
                readOnly
                value={newFileName}
                className="w-full bg-[#111622] border border-admin-border rounded-xl px-3 py-2 text-sm text-slate-400 font-mono focus:outline-none cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Hash SHA-1</label>
              <input
                type="text"
                readOnly
                value={newSha1}
                className="w-full bg-[#111622] border border-admin-border rounded-xl px-3 py-2 text-xs text-slate-400 font-mono focus:outline-none cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">URL de Descarga (CDN / GitHub Releases)</label>
              <input
                type="url"
                required
                value={newDownloadUrl}
                onChange={(e) => setNewDownloadUrl(e.target.value)}
                className="w-full bg-[#111622] border border-admin-border focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Guardar Mod en Instancia
            </button>
          </div>
        </form>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar entre los ${instanceMods.length} mods de esta instancia...`}
          className="w-full bg-[#0a0d14] border border-admin-border focus:border-purple-500 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
      </div>

      {/* Mods List */}
      <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
        {filteredMods.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-admin-border rounded-2xl bg-[#0a0d14]/40 space-y-2">
            <Layers className="w-8 h-8 text-purple-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">No hay mods registrados en esta instancia</h4>
            <p className="text-xs text-slate-400">Arrastra archivos .jar arriba para añadir mods a esta instancia.</p>
          </div>
        ) : (
          filteredMods.slice(0, 100).map((mod) => (
            <div
              key={mod.id}
              className={`flex items-center justify-between gap-4 p-3.5 rounded-2xl border transition-all ${
                mod.is_enabled
                  ? 'bg-[#0a0d14] border-admin-border hover:border-slate-700'
                  : 'bg-[#080a0f] border-slate-900 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => handleToggleMod(mod)}
                  title={mod.is_enabled ? 'Mod Activo (Clic para desactivar)' : 'Mod Desactivado (Clic para activar)'}
                  className="text-slate-400 hover:text-white transition-colors shrink-0"
                >
                  {mod.is_enabled ? (
                    <ToggleRight className="w-7 h-7 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-slate-600" />
                  )}
                </button>

                <div className="min-w-0">
                  <span className="font-bold text-white text-xs block truncate">{mod.mod_name}</span>
                  <span className="text-[11px] text-slate-500 font-mono block truncate">{mod.file_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  {((mod.file_size || 0) / (1024 * 1024)).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteMod(mod)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Eliminar Mod"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
