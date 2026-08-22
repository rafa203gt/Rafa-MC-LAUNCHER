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
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { gitHubStorage, GitHubAsset } from '../github-storage';
import { supabase } from '../supabase';

interface ModEntry {
  name: string;
  url: string;
  size: number;
  sha1: string;
  side?: 'client' | 'server' | 'both';
  path: string;
}

export const CloudAssetManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mods' | 'modpack_zip' | 'configs' | 'shaders'>('mods');
  const [token, setToken] = useState(gitHubStorage.getToken());
  const [repo, setRepo] = useState(gitHubStorage.getRepo());
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [assets, setAssets] = useState<GitHubAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ [key: string]: { percent: number; status: string } }>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Modpack .ZIP Extractor state
  const [zipFiles, setZipFiles] = useState<{ name: string; path: string; size: number; file: JSZip.JSZipObject }[]>([]);
  const [zipTotalSize, setZipTotalSize] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentFile: '' });

  // Config Editor state
  const [configsList, setConfigsList] = useState<{ name: string; content: string }[]>([
    { name: 'config/jei-client.ini', content: '# Just Enough Items Configuration\n[advanced]\ncheatItemsEnabled = false\n' },
    { name: 'config/apotheosis.cfg', content: '# Apotheosis balance and module settings\n[general]\nworld_tier = 1\n' }
  ]);
  const [activeConfigIndex, setActiveConfigIndex] = useState(0);
  const [configDraft, setConfigDraft] = useState('');
  const [configSavedNotice, setConfigSavedNotice] = useState(false);

  // Load assets from GitHub Releases on mount
  useEffect(() => {
    if (token) {
      loadAssets();
    }
  }, [token]);

  useEffect(() => {
    if (configsList[activeConfigIndex]) {
      setConfigDraft(configsList[activeConfigIndex].content);
    }
  }, [activeConfigIndex, configsList]);

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      const list = await gitHubStorage.listAssets();
      setAssets(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToken = () => {
    gitHubStorage.setToken(token);
    gitHubStorage.setRepo(repo);
    setShowTokenModal(false);
    loadAssets();
  };

  // Upload single / bulk .jar mods or shaders
  const handleFileUpload = async (files: FileList | null, folderPrefix = 'mods/') => {
    if (!files || files.length === 0) return;

    if (!token) {
      setShowTokenModal(true);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = file.name;

      try {
        setUploadStatus((prev) => ({
          ...prev,
          [key]: { percent: 10, status: 'Iniciando subida...' }
        }));

        await gitHubStorage.uploadAsset(file, (fileName, percent, status) => {
          setUploadStatus((prev) => ({
            ...prev,
            [key]: { percent, status }
          }));
        });

        setTimeout(() => {
          setUploadStatus((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }, 3000);
      } catch (err: any) {
        setUploadStatus((prev) => ({
          ...prev,
          [key]: { percent: 0, status: `Error: ${err.message}` }
        }));
      }
    }

    await loadAssets();
  };

  // Process .ZIP Modpack
  const handleZipDrop = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      alert('Por favor selecciona un archivo .zip válido.');
      return;
    }

    setIsExtracting(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const extracted: { name: string; path: string; size: number; file: JSZip.JSZipObject }[] = [];
      let total = 0;

      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && (relativePath.startsWith('mods/') || relativePath.startsWith('config/') || relativePath.startsWith('shaderpacks/'))) {
          extracted.push({
            name: relativePath.split('/').pop() || relativePath,
            path: relativePath,
            size: (zipEntry as any)._data?.uncompressedSize || 0,
            file: zipEntry
          });
          total += (zipEntry as any)._data?.uncompressedSize || 0;
        }
      });

      setZipFiles(extracted);
      setZipTotalSize(total);
    } catch (err: any) {
      alert(`Error descomprimiendo el archivo .zip: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Upload all extracted ZIP assets and publish manifest to Supabase
  const handleUploadAllZipAssets = async () => {
    if (!token) {
      setShowTokenModal(true);
      return;
    }

    setIsBatchUploading(true);
    setBatchProgress({ current: 0, total: zipFiles.length, currentFile: '' });

    const modManifestEntries: ModEntry[] = [];

    try {
      for (let i = 0; i < zipFiles.length; i++) {
        const item = zipFiles[i];
        setBatchProgress({ current: i + 1, total: zipFiles.length, currentFile: item.name });

        const arrayBuffer = await item.file.async('arraybuffer');
        const uploaded = await gitHubStorage.uploadAsset({
          name: item.name,
          buffer: arrayBuffer
        });

        modManifestEntries.push({
          name: item.name,
          url: uploaded.url,
          size: uploaded.size,
          sha1: uploaded.sha1,
          path: item.path,
          side: 'both'
        });
      }

      // Generate complete manifest and push to Supabase
      const generatedManifest = {
        name: 'Modpack Oficial (GitHub CDN)',
        version: '1.0.0',
        minecraftVersion: '1.21.1',
        loader: 'neoforge',
        files: modManifestEntries
      };

      await supabase
        .from('remote_config')
        .update({
          manifest_json: generatedManifest,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      alert(`✅ ¡${zipFiles.length} archivos subidos con éxito a GitHub Releases y manifiesto actualizado en Supabase!`);
      setZipFiles([]);
      await loadAssets();
    } catch (err: any) {
      alert(`Error durante la subida masiva: ${err.message}`);
    } finally {
      setIsBatchUploading(false);
    }
  };

  // Delete an asset
  const handleDeleteAsset = async (assetId: number, assetName: string) => {
    if (!confirm(`¿Eliminar el archivo "${assetName}" de GitHub Releases?`)) return;

    try {
      await gitHubStorage.deleteAssetById(assetId);
      await loadAssets();
    } catch (err: any) {
      alert(`Error eliminando archivo: ${err.message}`);
    }
  };

  // Broadcast Realtime Update Signal to all player launchers
  const handleBroadcastSync = async () => {
    try {
      await supabase.from('remote_config').update({
        updated_at: new Date().toISOString()
      }).eq('id', 1);

      alert('🚀 ¡Señal de sincronización enviada en tiempo real! Todos los launchers de los jugadores actualizarán sus archivos.');
    } catch (err: any) {
      alert(`Error notificando: ${err.message}`);
    }
  };

  const filteredAssets = assets.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Token Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">Almacenamiento Ilimitado de Modpacks</h2>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> GitHub CDN 100% Gratis
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Repositorio vinculado: <code className="text-indigo-300 font-mono">{repo}</code> • Tag: <code className="text-indigo-300 font-mono">modpack-assets</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {gitHubStorage.hasEnvToken() ? (
            <div className="px-3.5 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2 shadow-inner">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Token Seguro (.env Activo)</span>
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
              {token ? 'Token Configurado' : '⚠️ Configurar Token de GitHub'}
            </button>
          )}

          <button
            onClick={handleBroadcastSync}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-glow flex items-center gap-2 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Publicar y Sincronizar en Vivo
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('mods')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'mods'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Mods (.JAR)
        </button>

        <button
          onClick={() => setActiveTab('modpack_zip')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'modpack_zip'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          Auto-Extractor de Modpack (.ZIP)
        </button>

        <button
          onClick={() => setActiveTab('configs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'configs'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-4 h-4" />
          Editor de Configs en Vivo
        </button>

        <button
          onClick={() => setActiveTab('shaders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'shaders'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Shaders & Texturas (.ZIP)
        </button>
      </div>

      {/* TAB 1: MODS (.JAR) */}
      {activeTab === 'mods' && (
        <div className="space-y-4">
          {/* Upload Dropzone */}
          <label className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all">
            <Upload className="w-8 h-8 text-indigo-400 animate-bounce" />
            <div className="text-center">
              <span className="text-sm font-black text-white block">Arrastra archivos .jar aquí o haz clic para subir</span>
              <span className="text-xs text-slate-400">Subida multihilo con auto-cálculo de SHA-1 a GitHub Releases</span>
            </div>
            <input
              type="file"
              multiple
              accept=".jar"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files, 'mods/')}
            />
          </label>

          {/* Active Uploads Progress */}
          {Object.keys(uploadStatus).length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-300">Subidas en curso:</h4>
              {Object.entries(uploadStatus).map(([name, status]) => (
                <div key={name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-mono">{name}</span>
                    <span className="text-indigo-400 font-bold">{status.status} ({status.percent}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${status.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search & List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar mod en la nube..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500"
                />
              </div>
              <button
                onClick={loadAssets}
                disabled={isLoading}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Assets Table */}
            <div className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto pr-1">
              {filteredAssets.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No hay mods subidos todavía o no coinciden con la búsqueda.
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <div key={asset.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-200 truncate">{asset.name}</h4>
                        <span className="text-[11px] text-slate-400">
                          {(asset.size / (1024 * 1024)).toFixed(2)} MB • Subido el {new Date(asset.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={asset.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                        title="Descargar archivo"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteAsset(asset.id, asset.name)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                        title="Eliminar de la nube"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MODPACK .ZIP EXTRACTOR */}
      {activeTab === 'modpack_zip' && (
        <div className="space-y-4">
          <label className="border-2 border-dashed border-teal-500/30 hover:border-teal-500/60 bg-teal-500/5 hover:bg-teal-500/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all">
            <FolderArchive className="w-10 h-10 text-teal-400" />
            <div className="text-center">
              <span className="text-sm font-black text-white block">
                Arrastra aquí el archivo .ZIP completo de tu Modpack (CurseForge / Modrinth)
              </span>
              <span className="text-xs text-slate-400">
                El panel extraerá automáticamente mods, configs y scripts, los subirá a GitHub Releases y generará el manifest.json
              </span>
            </div>
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleZipDrop(e.target.files[0])}
            />
          </label>

          {isExtracting && (
            <div className="text-center py-6 text-xs text-teal-400 font-bold animate-pulse">
              Descomprimiendo e inspeccionando estructura del modpack...
            </div>
          )}

          {zipFiles.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Archivos detectados en el Modpack</h3>
                  <span className="text-xs text-slate-400">
                    {zipFiles.length} elementos • Total: {(zipTotalSize / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>

                <button
                  onClick={handleUploadAllZipAssets}
                  disabled={isBatchUploading}
                  className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-xl text-xs font-black shadow-glow flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {isBatchUploading ? `Subiendo (${batchProgress.current}/${batchProgress.total})...` : '🚀 Subir Todo a GitHub y Actualizar Manifiesto'}
                </button>
              </div>

              {isBatchUploading && (
                <div className="space-y-1.5 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-teal-300 font-mono truncate max-w-md">{batchProgress.currentFile}</span>
                    <span className="text-slate-400 font-bold">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-400 transition-all duration-300"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60 pr-1">
                {zipFiles.map((file, i) => (
                  <div key={i} className="py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-mono">{file.path}</span>
                    <span className="text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: IN-BROWSER CONFIGS & SCRIPTS EDITOR */}
      {activeTab === 'configs' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Configs File List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Archivos de Configuración</h3>
            {configsList.map((cfg, idx) => (
              <button
                key={idx}
                onClick={() => setActiveConfigIndex(idx)}
                className={`w-full text-left p-3 rounded-2xl text-xs font-mono transition-all flex items-center gap-2 ${
                  activeConfigIndex === idx
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-200'
                    : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0 text-indigo-400" />
                <span className="truncate">{cfg.name}</span>
              </button>
            ))}
          </div>

          {/* Code Editor */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-indigo-300">
                {configsList[activeConfigIndex]?.name || 'config.json'}
              </span>

              <button
                onClick={() => {
                  const updated = [...configsList];
                  updated[activeConfigIndex].content = configDraft;
                  setConfigsList(updated);
                  setConfigSavedNotice(true);
                  setTimeout(() => setConfigSavedNotice(false), 2000);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
              >
                <Save className="w-3.5 h-3.5" />
                {configSavedNotice ? '¡Guardado!' : 'Guardar Cambios'}
              </button>
            </div>

            <textarea
              value={configDraft}
              onChange={(e) => setConfigDraft(e.target.value)}
              className="w-full flex-1 min-h-[340px] bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-emerald-300/90 focus:border-indigo-500 outline-none resize-none leading-relaxed"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* TAB 4: SHADERS & RESOURCE PACKS */}
      {activeTab === 'shaders' && (
        <div className="space-y-4">
          <label className="border-2 border-dashed border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all">
            <Sparkles className="w-8 h-8 text-amber-400" />
            <div className="text-center">
              <span className="text-sm font-black text-white block">
                Arrastra paquetes de Shaders o Texturas (.ZIP)
              </span>
              <span className="text-xs text-slate-400">
                Alojamiento en GitHub Releases CDN para descarga instantánea en 1 clic
              </span>
            </div>
            <input
              type="file"
              multiple
              accept=".zip"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files, 'shaderpacks/')}
            />
          </label>
        </div>
      )}

      {/* GITHUB PAT CONFIGURATION MODAL */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Configurar Token de GitHub (PAT)</h3>
                <p className="text-xs text-slate-400">Para subir archivos ilimitados a GitHub Releases</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Repositorio (Owner/Repo)</label>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="rafa203gt/Rafa-MC-LAUNCHER"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Personal Access Token (PAT)</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Genera un token clásico en GitHub con permisos <code className="text-indigo-300">repo</code>. Se guarda únicamente en tu navegador.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTokenModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveToken}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                Guardar Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
