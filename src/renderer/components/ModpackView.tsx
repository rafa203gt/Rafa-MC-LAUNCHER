import React, { useState, useEffect } from 'react';
import { Box, FolderOpen, RefreshCw, Search, CheckCircle2, FileCode } from 'lucide-react';
import { InstalledMod } from '../types';

export const ModpackView: React.FC = () => {
  const [mods, setMods] = useState<InstalledMod[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const fetchMods = async () => {
    setIsLoading(true);
    try {
      if (window.launcherAPI?.getInstalledMods) {
        const list = await window.launcherAPI.getInstalledMods();
        setMods(list || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMods();
  }, []);

  const handleOpenFolder = () => {
    window.launcherAPI?.openFolder('mods');
  };

  const handleSync = async () => {
    setIsLoading(true);
    setSyncStatus('Sincronizando modpack...');
    try {
      const res = await window.launcherAPI?.syncModpack();
      setSyncStatus(`¡Sincronizado! ${res?.synced ?? 0} descargados, ${res?.deleted ?? 0} eliminados.`);
      await fetchMods();
    } catch (e: any) {
      setSyncStatus(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleReinstall = async () => {
    if (!confirm('¿Deseas reinstalar el modpack desde cero? Esto reparará cualquier mod corrupto o faltante. Tus mundos guardados NO se borrarán.')) {
      return;
    }

    setIsLoading(true);
    setSyncStatus('Reinstalando modpack desde la nube (descarga acelerada)...');
    try {
      const res = await window.launcherAPI?.reinstallModpack();
      setSyncStatus(`¡Reinstalación completada! ${res?.synced ?? 0} archivos restaurados.`);
      await fetchMods();
    } catch (e: any) {
      setSyncStatus(`Error en la reinstalación: ${e.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setSyncStatus(null), 7000);
    }
  };

  const filteredMods = mods.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-mc-card border border-mc-border p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Box className="w-5 h-5 text-emerald-400" />
            Mods del Servidor
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Los mods se sincronizan automáticamente con el servidor para que siempre tengas la versión exacta.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-mc-darker hover:bg-slate-800 border border-mc-border rounded-xl text-xs font-semibold text-slate-200 transition-all"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            Abrir Carpeta
          </button>

          <button
            onClick={handleReinstall}
            disabled={isLoading}
            title="Reparar y reinstalar todo el modpack desde cero"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${isLoading ? 'animate-spin' : ''}`} />
            Reinstalar / Reparar
          </button>

          <button
            onClick={handleSync}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {syncStatus}
        </div>
      )}

      {/* Search and List */}
      <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar entre los mods instalados..."
            className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 pl-10 pr-4 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filteredMods.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              {isLoading
                ? 'Cargando lista de mods...'
                : mods.length === 0
                ? 'No hay mods instalados aún. Pulsa en "Sincronizar" o "Jugar" para descargarlos.'
                : 'No se encontraron mods que coincidan con la búsqueda.'}
            </div>
          ) : (
            filteredMods.map((mod, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-mc-darker/60 hover:bg-mc-darker border border-mc-border/60 hover:border-mc-border rounded-xl transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{mod.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {(mod.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Activo
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
