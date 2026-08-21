import React, { useState, useEffect } from 'react';
import { Sparkles, Download, RefreshCw, X } from 'lucide-react';
import { AppUpdateInfo, UpdateDownloadProgress } from '../types';

export const UpdateBanner: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState<UpdateDownloadProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for updates automatically on launcher startup
    const checkUpdates = async () => {
      try {
        if (window.launcherAPI?.checkForUpdates) {
          const info = await window.launcherAPI.checkForUpdates();
          if (info.hasUpdate) {
            setUpdateInfo(info);
          }
        }
      } catch (err) {
        console.warn('Error comprobando actualizaciones:', err);
      }
    };

    checkUpdates();

    if (window.launcherAPI?.onUpdateProgress) {
      const unsub = window.launcherAPI.onUpdateProgress((p) => {
        setProgress(p);
      });
      return unsub;
    }
  }, []);

  if (!updateInfo || !updateInfo.hasUpdate || dismissed) {
    return null;
  }

  const handleUpdate = async () => {
    if (!updateInfo.downloadUrl) return;
    setIsUpdating(true);
    setError(null);

    try {
      await window.launcherAPI.downloadAppUpdate(updateInfo.downloadUrl, updateInfo.fileName || 'Rafa-Launcher-Update.exe');
    } catch (err: any) {
      setIsUpdating(false);
      setError('Error al descargar la actualización. Inténtalo de nuevo.');
    }
  };

  return (
    <div className="bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-blue-900/90 border-b border-indigo-500/30 px-4 py-2.5 backdrop-blur-md shadow-lg transition-all animate-fadeIn">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-400/30 text-indigo-300 shrink-0">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="truncate">
            <div className="font-semibold text-white flex items-center gap-2">
              <span>¡Nueva versión disponible: v{updateInfo.latestVersion}!</span>
              <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-400/20">
                Actual: v{updateInfo.currentVersion}
              </span>
            </div>
            <p className="text-indigo-200/80 text-[11px] truncate">
              {updateInfo.releaseName || 'Mejoras de rendimiento y sincronización de mods instantánea.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isUpdating ? (
            <div className="flex items-center gap-3 bg-indigo-950/60 border border-indigo-500/40 px-3 py-1.5 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <div className="w-24 bg-indigo-950 rounded-full h-1.5 overflow-hidden border border-indigo-500/20">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${progress?.percent || 0}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-indigo-200">{progress?.percent || 0}%</span>
            </div>
          ) : (
            <button
              onClick={handleUpdate}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium px-3 py-1.5 rounded-lg shadow-md transition-all active:scale-95 text-[11px]"
            >
              <Download className="w-3.5 h-3.5" />
              Actualizar Ahora
            </button>
          )}

          {!isUpdating && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 text-indigo-300/60 hover:text-white transition-colors rounded hover:bg-white/10"
              title="Cerrar notificación"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-[10px] text-red-400 text-center mt-1">{error}</div>}
    </div>
  );
};
