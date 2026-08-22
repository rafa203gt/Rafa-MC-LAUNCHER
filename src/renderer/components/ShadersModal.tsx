import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Download,
  Trash2,
  FolderOpen,
  CheckCircle2,
  Zap,
  Cpu,
  Flame,
  X,
  RefreshCw
} from 'lucide-react';

interface ShaderItem {
  id: string;
  name: string;
  description: string;
  performanceTier: 'fast' | 'balanced' | 'ultra';
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  previewImage?: string;
  isInstalled?: boolean;
}

interface ShadersModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId?: string;
}

export const ShadersModal: React.FC<ShadersModalProps> = ({ isOpen, onClose, instanceId }) => {
  const [shaders, setShaders] = useState<ShaderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  const loadShaders = async () => {
    setIsLoading(true);
    try {
      if ((window as any).launcherAPI?.getShaders) {
        const list = await (window as any).launcherAPI.getShaders(instanceId);
        setShaders(list || []);
      }
    } catch (err) {
      console.error('Error loading shaders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadShaders();
    }
  }, [isOpen, instanceId]);

  useEffect(() => {
    if (!(window as any).launcherAPI?.onShaderProgress) return;
    const unsub = (window as any).launcherAPI.onShaderProgress(
      (data: { fileName: string; progress: number }) => {
        setProgressMap((prev) => ({ ...prev, [data.fileName]: data.progress }));
      }
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handleDownload = async (shader: ShaderItem) => {
    setDownloadingId(shader.id);
    try {
      await (window as any).launcherAPI.downloadShader(
        shader.downloadUrl,
        shader.fileName,
        instanceId
      );
      await loadShaders();
    } catch (err: any) {
      alert(`Error al descargar shader: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (shader: ShaderItem) => {
    if (!confirm(`¿Deseas eliminar el shader "${shader.name}" de esta instancia?`)) return;
    try {
      await (window as any).launcherAPI.deleteShader(shader.fileName, instanceId);
      await loadShaders();
    } catch (err: any) {
      alert(`Error al eliminar shader: ${err.message}`);
    }
  };

  const handleOpenFolder = () => {
    if ((window as any).launcherAPI?.openShaderFolder) {
      (window as any).launcherAPI.openShaderFolder(instanceId);
    }
  };

  if (!isOpen) return null;

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'fast':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <Zap className="w-3 h-3 text-emerald-400" />
            Ultra Rápido (Gama Baja)
          </span>
        );
      case 'ultra':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
            <Flame className="w-3 h-3 text-amber-400" />
            Ultra Realismo (Gama Alta)
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
            <Cpu className="w-3 h-3 text-blue-400" />
            Equilibrado (Recomendado)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f131c] border border-slate-800/80 rounded-3xl p-6 w-full max-w-3xl shadow-2xl space-y-6 animate-fadeIn max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl text-white shadow-lg shadow-orange-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Shaders y Paquetes Gráficos</h3>
              <p className="text-xs text-slate-400">
                Instala y activa shaders ultra-optimizados en 1 clic para tu modpack
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
              title="Abrir Carpeta Shaderpacks"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Abrir Carpeta</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Shaders List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <div className="text-center py-16 space-y-3">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
              <span className="text-xs text-slate-400">Cargando catálogo de shaders...</span>
            </div>
          ) : shaders.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
              <span className="text-xs text-slate-400">No hay shaders disponibles en este momento.</span>
            </div>
          ) : (
            shaders.map((shader) => {
              const isDownloading = downloadingId === shader.id;
              const progress = progressMap[shader.fileName] || 0;

              return (
                <div
                  key={shader.id}
                  className="bg-[#0a0d14] border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-lg"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-extrabold text-white">{shader.name}</h4>
                      {getTierBadge(shader.performanceTier)}
                      {shader.isInstalled && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Instalado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{shader.description}</p>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {((shader.fileSize || 0) / (1024 * 1024)).toFixed(1)} MB • {shader.fileName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    {shader.isInstalled ? (
                      <button
                        onClick={() => handleDelete(shader)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                        title="Eliminar de la instancia"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownload(shader)}
                        disabled={isDownloading}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isDownloading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>{progress > 0 ? `${progress}%` : 'Descargando...'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Instalar en 1 Clic</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
