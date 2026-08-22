import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  Upload,
  Cloud,
  FolderArchive,
  FileCode,
  Sparkles,
  Trash2,
  Download,
  Key,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Layers,
  FileText,
  Save,
  Search,
  ShieldCheck,
  Server,
  Settings,
  Plus,
  Copy,
  ToggleLeft,
  ToggleRight,
  Check,
  Edit3
} from 'lucide-react';
import { gitHubStorage, GitHubAsset } from '../github-storage';
import { supabase, RemoteInstance, ModpackMod } from '../supabase';

interface ModEntry {
  name: string;
  url: string;
  size: number;
  sha1: string;
  side?: 'client' | 'server' | 'both';
  path: string;
}

export const CloudAssetManager: React.FC = () => {
  // Navigation & Instances state
  const [instances, setInstances] = useState<RemoteInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('atm10');
  const [selectedInstance, setSelectedInstance] = useState<RemoteInstance | null>(null);
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [instanceParamsDraft, setInstanceParamsDraft] = useState<Partial<RemoteInstance>>({});

  // Tabs & Security state
  const [activeTab, setActiveTab] = useState<'mods' | 'modpack_zip' | 'configs' | 'shaders' | 'manifest'>('mods');
  const [token, setToken] = useState(gitHubStorage.getToken());
  const [repo, setRepo] = useState(gitHubStorage.getRepo());
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Mods list state (from Supabase & GitHub)
  const [mods, setMods] = useState<ModpackMod[]>([]);
  const [uploadStatus, setUploadStatus] = useState<{ [key: string]: { percent: number; status: string } }>({});

  // Modpack .ZIP Extractor state
  const [zipFiles, setZipFiles] = useState<{ name: string; path: string; size: number; file: JSZip.JSZipObject }[]>([]);
  const [zipTotalSize, setZipTotalSize] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentFile: '' });

  // Config Editor state
  const [configsList, setConfigsList] = useState<{ name: string; content: string }[]>([
    { name: 'config/jei-client.ini', content: '# Just Enough Items Configuration\n[advanced]\ncheatItemsEnabled = false\n' },
    { name: 'config/apotheosis.cfg', content: '# Apotheosis balance and module settings\n[general]\nworld_tier = 1\n' },
    { name: 'defaultconfigs/ftbquests/client.snbt', content: '{\n  show_chapter_arrows: true,\n  theme: "dark"\n}' }
  ]);
  const [activeConfigIndex, setActiveConfigIndex] = useState(0);
  const [configDraft, setConfigDraft] = useState('');
  const [configSavedNotice, setConfigSavedNotice] = useState(false);

  // Load instances from Supabase
  const loadInstances = async () => {
    try {
      const { data, error } = await supabase.from('remote_instances').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        setInstances(data);
        const current = data.find((inst) => inst.id === selectedInstanceId) || data[0];
        setSelectedInstanceId(current.id);
        setSelectedInstance(current);
        setInstanceParamsDraft(current);
      }
    } catch (err: any) {
      console.warn('Error cargando instancias:', err.message);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  // When instance changes, reload its assets and mods
  useEffect(() => {
    if (selectedInstanceId) {
      const inst = instances.find((i) => i.id === selectedInstanceId);
      if (inst) {
        setSelectedInstance(inst);
        setInstanceParamsDraft(inst);
        loadInstanceData(inst.id);
      }
    }
  }, [selectedInstanceId]);

  useEffect(() => {
    if (configsList[activeConfigIndex]) {
      setConfigDraft(configsList[activeConfigIndex].content);
    }
  }, [activeConfigIndex, configsList]);

  // Load mods and github assets for the selected instance
  const loadInstanceData = async (instanceId: string) => {
    setIsLoading(true);
    try {
      // 1. Fetch mods from Supabase modpack_mods table
      const { data: modsData, error: modsError } = await supabase
        .from('modpack_mods')
        .select('*')
        .eq('instance_id', instanceId)
        .order('mod_name', { ascending: true });

      if (!modsError && modsData) {
        setMods(modsData);
      }
    } catch (err) {
      console.warn(`Error cargando datos para ${instanceId}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  // Save instance parameters
  const handleSaveInstanceParams = async () => {
    if (!selectedInstance) return;
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('remote_instances')
        .update({
          name: instanceParamsDraft.name,
          description: instanceParamsDraft.description,
          minecraft_version: instanceParamsDraft.minecraft_version,
          mod_loader: instanceParamsDraft.mod_loader,
          mod_loader_version: instanceParamsDraft.mod_loader_version,
          custom_ram: Number(instanceParamsDraft.custom_ram) || 8192,
          server_ip: instanceParamsDraft.server_ip,
          server_port: Number(instanceParamsDraft.server_port) || 25565,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInstance.id);

      if (error) throw error;
      alert(`✅ ¡Parámetros de la instancia "${instanceParamsDraft.name}" actualizados con éxito!`);
      setIsEditingParams(false);
      await loadInstances();
    } catch (err: any) {
      alert(`Error actualizando parámetros: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload single / bulk .jar mods to GitHub CDN + Supabase
  const handleFileUpload = async (files: FileList | null, category = 'mods') => {
    if (!files || files.length === 0 || !selectedInstance) return;
    const releaseTag = `modpack-${selectedInstance.id}-assets`;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      setUploadStatus((prev) => ({ ...prev, [fileName]: { percent: 5, status: 'Iniciando subida...' } }));

      try {
        const uploaded = await gitHubStorage.uploadAsset(
          file,
          (fName, percent, status) => {
            setUploadStatus((prev) => ({ ...prev, [fName]: { percent, status } }));
          },
          releaseTag
        );

        // Register in Supabase modpack_mods table
        const modName = fileName.replace(/\.jar$/i, '').replace(/[-_]/g, ' ');
        const { error } = await supabase.from('modpack_mods').upsert(
          {
            instance_id: selectedInstance.id,
            mod_name: modName,
            file_name: fileName,
            file_path: category === 'shaders' ? `shaderpacks/${fileName}` : `mods/${fileName}`,
            file_size: uploaded.size,
            sha1: uploaded.sha1,
            download_url: uploaded.url,
            is_enabled: true,
            category: category
          },
          { onConflict: 'instance_id,file_name' }
        );

        if (error) console.warn('Aviso registrando mod en Supabase:', error.message);
      } catch (err: any) {
        setUploadStatus((prev) => ({
          ...prev,
          [fileName]: { percent: 0, status: `❌ Error: ${err.message}` }
        }));
      }
    }

    await loadInstanceData(selectedInstance.id);
  };

  // Toggle mod enabled/disabled
  const handleToggleMod = async (mod: ModpackMod) => {
    try {
      const nextState = !mod.is_enabled;
      const { error } = await supabase
        .from('modpack_mods')
        .update({ is_enabled: nextState })
        .eq('id', mod.id);

      if (error) throw error;
      setMods((prev) => prev.map((m) => (m.id === mod.id ? { ...m, is_enabled: nextState } : m)));
    } catch (err: any) {
      alert(`Error cambiando estado del mod: ${err.message}`);
    }
  };

  // Delete a mod from Supabase and GitHub
  const handleDeleteMod = async (mod: ModpackMod) => {
    if (!confirm(`¿Estás seguro de eliminar el mod "${mod.file_name}" de esta instancia?`)) return;
    const releaseTag = `modpack-${selectedInstanceId}-assets`;

    try {
      await supabase.from('modpack_mods').delete().eq('id', mod.id);
      await gitHubStorage.deleteAssetIfExists(mod.file_name, releaseTag);
      setMods((prev) => prev.filter((m) => m.id !== mod.id));
    } catch (err: any) {
      alert(`Error eliminando mod: ${err.message}`);
    }
  };

  // Process .ZIP Modpack drop
  const handleZipFileDrop = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      alert('Por favor, selecciona un archivo comprimido .ZIP válido.');
      return;
    }

    setIsExtracting(true);
    setZipFiles([]);

    try {
      const zip = new JSZip();
      const zipData = await zip.loadAsync(file);
      const extracted: { name: string; path: string; size: number; file: JSZip.JSZipObject }[] = [];
      let totalBytes = 0;

      for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
        if (!zipEntry.dir) {
          const isEligible =
            relativePath.startsWith('mods/') ||
            relativePath.startsWith('config/') ||
            relativePath.startsWith('defaultconfigs/') ||
            relativePath.startsWith('kubejs/') ||
            relativePath.startsWith('shaderpacks/') ||
            relativePath.endsWith('.jar') ||
            relativePath.endsWith('.json') ||
            relativePath.endsWith('.toml') ||
            relativePath.endsWith('.snbt');

          if (isEligible) {
            const fileName = relativePath.split('/').pop() || relativePath;
            extracted.push({
              name: fileName,
              path: relativePath,
              size: 50000,
              file: zipEntry
            });
            totalBytes += 50000;
          }
        }
      }

      setZipFiles(extracted);
      setZipTotalSize(totalBytes);
    } catch (err: any) {
      alert(`Error leyendo el archivo ZIP: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Upload Extracted ZIP contents to GitHub CDN + Supabase
  const handleUploadZipContents = async () => {
    if (!zipFiles.length || !selectedInstance) return;
    setIsBatchUploading(true);
    setBatchProgress({ current: 0, total: zipFiles.length, currentFile: '' });
    const releaseTag = `modpack-${selectedInstance.id}-assets`;

    try {
      for (let i = 0; i < zipFiles.length; i++) {
        const item = zipFiles[i];
        setBatchProgress({ current: i + 1, total: zipFiles.length, currentFile: item.name });

        const arrayBuffer = await item.file.async('arraybuffer');
        const uploaded = await gitHubStorage.uploadAsset(
          { name: item.name, buffer: arrayBuffer },
          undefined,
          releaseTag
        );

        // Insert into modpack_mods table if it's a jar
        if (item.name.endsWith('.jar')) {
          await supabase.from('modpack_mods').upsert(
            {
              instance_id: selectedInstance.id,
              mod_name: item.name.replace(/\.jar$/i, '').replace(/[-_]/g, ' '),
              file_name: item.name,
              file_path: item.path,
              file_size: uploaded.size,
              sha1: uploaded.sha1,
              download_url: uploaded.url,
              is_enabled: true,
              category: 'mods'
            },
            { onConflict: 'instance_id,file_name' }
          );
        }
      }

      alert(`✅ ¡${zipFiles.length} archivos subidos con éxito a la instancia "${selectedInstance.name}"!`);
      setZipFiles([]);
      await loadInstanceData(selectedInstance.id);
    } catch (err: any) {
      alert(`Error durante la subida masiva: ${err.message}`);
    } finally {
      setIsBatchUploading(false);
    }
  };

  // Broadcast Realtime Update Signal & Save Generated Manifest
  const handleBroadcastSync = async () => {
    if (!selectedInstance) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('remote_instances')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInstance.id);

      if (error) throw error;

      await supabase.from('remote_config').update({
        updated_at: new Date().toISOString()
      }).eq('id', 1);

      alert(`🚀 ¡Instancia "${selectedInstance.name}" sincronizada en tiempo real!`);
    } catch (err: any) {
      alert(`Error sincronizando: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Clone instance
  const handleCloneInstance = async () => {
    if (!selectedInstance) return;
    const newId = prompt('Introduce el ID para la nueva instancia clonada (ej: atm10-test):', `${selectedInstance.id}-copia`);
    if (!newId || newId.trim() === '') return;

    try {
      setIsLoading(true);
      const cleanId = newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const { error } = await supabase.from('remote_instances').insert({
        id: cleanId,
        name: `${selectedInstance.name} (Copia)`,
        description: selectedInstance.description,
        minecraft_version: selectedInstance.minecraft_version,
        mod_loader: selectedInstance.mod_loader,
        mod_loader_version: selectedInstance.mod_loader_version,
        custom_ram: selectedInstance.custom_ram,
        server_ip: selectedInstance.server_ip,
        server_port: selectedInstance.server_port,
        icon: selectedInstance.icon,
        is_official: false,
        is_default: false,
        is_active: true
      });

      if (error) throw error;

      if (mods.length > 0) {
        const clonedMods = mods.map((m) => ({
          instance_id: cleanId,
          mod_name: m.mod_name,
          file_name: m.file_name,
          file_path: m.file_path,
          file_size: m.file_size,
          sha1: m.sha1,
          download_url: m.download_url,
          is_enabled: m.is_enabled,
          category: m.category
        }));
        await supabase.from('modpack_mods').insert(clonedMods);
      }

      alert(`🎉 ¡Instancia clonada exitosamente como "${cleanId}"!`);
      await loadInstances();
      setSelectedInstanceId(cleanId);
    } catch (err: any) {
      alert(`Error clonando instancia: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMods = mods.filter(
    (m) =>
      m.mod_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Cloud className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-white">Almacenamiento Ilimitado de Modpacks</h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> GitHub Releases CDN (100% Gratis)
                </span>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/30 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> Multi-Instancia
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Gestiona, edita archivos y sincroniza cada modpack de forma 100% independiente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
            {gitHubStorage.hasEnvToken() ? (
              <div className="px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Token Seguro (.env)</span>
              </div>
            ) : (
              <button
                onClick={() => setShowTokenModal(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                  token
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                }`}
              >
                <Key className="w-4 h-4" />
                {token ? 'Token Configurado' : '⚠️ Configurar Token'}
              </button>
            )}

            <button
              onClick={handleCloneInstance}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md"
              title="Duplicar este modpack y crear una nueva instancia"
            >
              <Copy className="w-4 h-4 text-purple-400" />
              Clonar Instancia
            </button>

            <button
              onClick={handleBroadcastSync}
              disabled={isLoading}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-glow flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Publicar y Sincronizar en Vivo
            </button>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" /> Instancia Activa:
            </span>
            <select
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="bg-slate-950 border border-indigo-500/40 text-white font-bold text-sm rounded-xl px-3.5 py-2 outline-none focus:border-indigo-400 transition-all cursor-pointer shadow-inner"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.mod_loader.toUpperCase()} {inst.minecraft_version})
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsEditingParams(!isEditingParams)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                isEditingParams
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingParams ? 'Cerrar Parámetros' : 'Editar Parámetros'}
            </button>
          </div>

          {selectedInstance && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-mono">
                Minecraft: <strong className="text-indigo-400">{selectedInstance.minecraft_version}</strong>
              </span>
              <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-mono">
                Loader: <strong className="text-purple-400">{selectedInstance.mod_loader} {selectedInstance.mod_loader_version}</strong>
              </span>
              <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-mono">
                RAM: <strong className="text-teal-400">{selectedInstance.custom_ram || 8192} MB</strong>
              </span>
            </div>
          )}
        </div>

        {isEditingParams && selectedInstance && (
          <div className="mt-5 p-5 bg-slate-950 border border-indigo-500/30 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                Configurar Parámetros de la Instancia "{selectedInstance.name}"
              </h3>
              <button
                onClick={handleSaveInstanceParams}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar Cambios
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre del Modpack</label>
                <input
                  type="text"
                  value={instanceParamsDraft.name || ''}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Versión de Minecraft</label>
                <input
                  type="text"
                  value={instanceParamsDraft.minecraft_version || ''}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, minecraft_version: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mod Loader</label>
                <select
                  value={instanceParamsDraft.mod_loader || 'neoforge'}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, mod_loader: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="neoforge">NeoForge</option>
                  <option value="forge">Forge</option>
                  <option value="fabric">Fabric</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Versión del Loader</label>
                <input
                  type="text"
                  value={instanceParamsDraft.mod_loader_version || ''}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, mod_loader_version: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">RAM Recomendada (MB)</label>
                <input
                  type="number"
                  value={instanceParamsDraft.custom_ram || 8192}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, custom_ram: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">IP del Servidor</label>
                <input
                  type="text"
                  value={instanceParamsDraft.server_ip || ''}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, server_ip: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Puerto</label>
                <input
                  type="number"
                  value={instanceParamsDraft.server_port || 25565}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, server_port: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descripción</label>
                <input
                  type="text"
                  value={instanceParamsDraft.description || ''}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('mods')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'mods' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" /> Mods ({mods.length})
        </button>
        <button
          onClick={() => setActiveTab('modpack_zip')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'modpack_zip' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderArchive className="w-4 h-4" /> Extractor .ZIP
        </button>
        <button
          onClick={() => setActiveTab('configs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'configs' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-4 h-4" /> Editor de Configs
        </button>
        <button
          onClick={() => setActiveTab('shaders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'shaders' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Shaders y Texturas
        </button>
        <button
          onClick={() => setActiveTab('manifest')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'manifest' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" /> Manifiesto JSON
        </button>
      </div>

      {activeTab === 'mods' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border-2 border-dashed border-indigo-500/30 rounded-3xl p-8 text-center transition-all group">
            <input type="file" multiple accept=".jar" id="mod-upload-input" className="hidden" onChange={(e) => handleFileUpload(e.target.files, 'mods')} />
            <label htmlFor="mod-upload-input" className="cursor-pointer flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400"><Upload className="w-8 h-8" /></div>
              <h3 className="text-base font-black text-white">Arrastra mods (.JAR) para {selectedInstance?.name}</h3>
              <span className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md">Examinar Archivos .JAR</span>
            </label>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase">
                <tr><th className="px-6 py-4">Estado</th><th className="px-6 py-4">Nombre</th><th className="px-6 py-4">Archivo</th><th className="px-6 py-4 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMods.map((mod) => (
                  <tr key={mod.id}>
                    <td className="px-6 py-4"><button onClick={() => handleToggleMod(mod)} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-bold border ${mod.is_enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{mod.is_enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />} {mod.is_enabled ? 'Activo' : 'Desactivado'}</button></td>
                    <td className="px-6 py-4 font-bold text-white">{mod.mod_name}</td>
                    <td className="px-6 py-4 font-mono text-slate-300">{mod.file_name}</td>
                    <td className="px-6 py-4 text-right"><button onClick={() => handleDeleteMod(mod)} className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'modpack_zip' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="bg-slate-950 border-2 border-dashed border-indigo-500/30 rounded-2xl p-8 text-center">
            <input type="file" accept=".zip" id="zip-upload-input" className="hidden" onChange={(e) => e.target.files?.[0] && handleZipFileDrop(e.target.files[0])} />
            <label htmlFor="zip-upload-input" className="cursor-pointer">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3"><FolderArchive className="w-8 h-8" /></div>
              <h4 className="text-sm font-bold text-white">Selecciona tu archivo modpack.zip</h4>
              <span className="inline-block mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Cargar Archivo .ZIP</span>
            </label>
          </div>
          {zipFiles.length > 0 && (
            <button onClick={handleUploadZipContents} disabled={isBatchUploading} className="w-full px-5 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold">{isBatchUploading ? 'Subiendo...' : 'Subir contenido a la Instancia'}</button>
          )}
        </div>
      )}

      {activeTab === 'configs' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Archivos</h4>
            {configsList.map((cfg, idx) => (
              <button key={idx} onClick={() => setActiveConfigIndex(idx)} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono truncate ${activeConfigIndex === idx ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400'}`}>{cfg.name}</button>
            ))}
          </div>
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col space-y-4">
            <textarea value={configDraft} onChange={(e) => setConfigDraft(e.target.value)} className="w-full flex-1 min-h-[420px] bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-200" />
            <button onClick={() => { const updated = [...configsList]; updated[activeConfigIndex].content = configDraft; setConfigsList(updated); setConfigSavedNotice(true); setTimeout(() => setConfigSavedNotice(false), 2500); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold w-max">{configSavedNotice ? 'Guardado' : 'Guardar Archivo'}</button>
          </div>
        </div>
      )}

      {/* TAB 4: SHADERS */}
      {activeTab === 'shaders' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border-2 border-dashed border-purple-500/30 rounded-3xl p-8 text-center transition-all group">
            <input type="file" multiple accept=".zip" id="shader-upload-input" className="hidden" onChange={(e) => handleFileUpload(e.target.files, 'shaders')} />
            <label htmlFor="shader-upload-input" className="cursor-pointer flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400"><Sparkles className="w-8 h-8" /></div>
              <h3 className="text-base font-black text-white">Subir Paquetes de Shaders (.ZIP) para {selectedInstance?.name}</h3>
              <span className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold shadow-md">Examinar Shaders .ZIP</span>
            </label>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase">
                <tr><th className="px-6 py-4">Nombre del Shader</th><th className="px-6 py-4">Ruta</th><th className="px-6 py-4 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {mods.filter((m) => m.category === 'shaders').length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">No hay shaders asignados a esta instancia.</td></tr>
                ) : (
                  mods.filter((m) => m.category === 'shaders').map((shader) => (
                    <tr key={shader.id}>
                      <td className="px-6 py-4 font-bold text-white">{shader.mod_name}</td>
                      <td className="px-6 py-4 font-mono text-purple-300">{shader.file_path}</td>
                      <td className="px-6 py-4 text-right"><button onClick={() => handleDeleteMod(shader)} className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: MANIFEST JSON */}
      {activeTab === 'manifest' && selectedInstance && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Manifiesto Generado de "{selectedInstance.name}"
              </h3>
              <p className="text-xs text-slate-400">
                Estructura JSON exacta que el launcher descargará para actualizar los {mods.filter((m) => m.is_enabled).length} mods activos.
              </p>
            </div>
            <button
              onClick={() => {
                const manifestData = {
                  name: selectedInstance.name,
                  version: '1.0.0',
                  minecraftVersion: selectedInstance.minecraft_version || '1.21.1',
                  modLoader: selectedInstance.mod_loader || 'neoforge',
                  modLoaderVersion: selectedInstance.mod_loader_version || '21.1.247',
                  files: mods.filter((m) => m.is_enabled).map((m) => ({
                    path: m.file_path || `mods/${m.file_name}`,
                    sha1: m.sha1,
                    size: m.file_size,
                    downloadUrl: m.download_url
                  }))
                };
                const blob = new Blob([JSON.stringify(manifestData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `manifest-${selectedInstance.id}.json`;
                a.click();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              Descargar manifest.json
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[460px]">
            {JSON.stringify(
              {
                name: selectedInstance.name,
                version: '1.0.0',
                minecraftVersion: selectedInstance.minecraft_version || '1.21.1',
                modLoader: selectedInstance.mod_loader || 'neoforge',
                modLoaderVersion: selectedInstance.mod_loader_version || '21.1.247',
                files: mods.filter((m) => m.is_enabled).map((m) => ({
                  path: m.file_path || `mods/${m.file_name}`,
                  sha1: m.sha1,
                  size: m.file_size,
                  downloadUrl: m.download_url
                }))
              },
              null,
              2
            )}
          </pre>
        </div>
      )}

      {showTokenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Configurar Token de GitHub</h3>
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white" />
            <button onClick={() => { gitHubStorage.setToken(token); gitHubStorage.setRepo(repo); setShowTokenModal(false); loadInstanceData(selectedInstanceId); }} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold">Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
};
