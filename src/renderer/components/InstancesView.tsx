import React, { useState, useEffect } from 'react';
import { Plus, Check, Play, FolderOpen, Trash2, Layers, Search, Sparkles, Cpu, Box, Flame } from 'lucide-react';
import { MinecraftInstance } from '../types';
import { CreateInstanceModal } from './CreateInstanceModal';

interface InstancesViewProps {
  onInstanceActivated: (instance: MinecraftInstance) => void;
  onLaunchInstance: () => void;
}

export const InstancesView: React.FC<InstancesViewProps> = ({
  onInstanceActivated,
  onLaunchInstance
}) => {
  const [instances, setInstances] = useState<MinecraftInstance[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadInstances = async () => {
    try {
      if (window.launcherAPI?.getInstances) {
        const list = await window.launcherAPI.getInstances();
        setInstances(list);
      }
    } catch (err) {
      console.error('Error cargando instancias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const handleActivate = async (instance: MinecraftInstance) => {
    try {
      if (window.launcherAPI?.switchInstance) {
        const updated = await window.launcherAPI.switchInstance(instance.id);
        onInstanceActivated(updated);
        loadInstances();
      }
    } catch (err) {
      console.error('Error activando instancia:', err);
    }
  };

  const handleDelete = async (instance: MinecraftInstance, e: React.MouseEvent) => {
    e.stopPropagation();
    if (instance.isDefault || instance.id === 'atm10') return;

    if (confirm(`¿Estás seguro de eliminar la instancia "${instance.name}"? Se borrarán sus mods y partidas.`)) {
      try {
        if (window.launcherAPI?.deleteInstance) {
          await window.launcherAPI.deleteInstance(instance.id);
          loadInstances();
        }
      } catch (err) {
        console.error('Error eliminando instancia:', err);
      }
    }
  };

  const handleOpenFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.launcherAPI?.openFolder) {
      window.launcherAPI.openFolder('instance');
    }
  };

  const filtered = instances.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.minecraftVersion.includes(search) ||
    i.modLoader.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn text-slate-200">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-mc-card border border-mc-border p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">Catálogo de Instancias & Modpacks</h2>
            <p className="text-xs text-slate-400">Elige el modpack que deseas jugar o crea perfiles personalizados</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modpacks..."
              className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none transition-all"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nueva Instancia
          </button>
        </div>
      </div>

      {/* Grid of Instances */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Cargando instancias...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((inst) => {
            const isActive = inst.isActive;

            return (
              <div
                key={inst.id}
                onClick={() => handleActivate(inst)}
                className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'bg-gradient-to-b from-emerald-950/40 via-mc-card to-mc-darker border-emerald-500/60 shadow-emerald-950/30 shadow-2xl ring-1 ring-emerald-500/40'
                    : 'bg-mc-card border-mc-border hover:border-slate-600 hover:shadow-xl'
                }`}
              >
                {/* Banner / Header Image */}
                <div className="h-32 relative bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 flex items-center justify-center overflow-hidden border-b border-mc-border/50">
                  {inst.id === 'atm10' ? (
                    <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-r from-amber-950/40 via-slate-900 to-rose-950/40 p-3 overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 group-hover:scale-110 group-hover:border-amber-400/50 transition-all duration-300 shadow-lg">
                        <Flame className="w-8 h-8 stroke-[2.2] animate-pulse" />
                      </div>
                      <span className="text-[11px] font-bold text-amber-300 font-mono tracking-wider mt-1.5 uppercase">
                        All The Mods 10
                      </span>
                    </div>
                  ) : inst.modLoader === 'vanilla' ? (
                    <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-emerald-900/40 via-slate-900 to-amber-950/30 p-3">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 group-hover:scale-110 group-hover:border-emerald-400/50 transition-all duration-300 shadow-lg">
                        <Box className="w-8 h-8 stroke-[2.2]" />
                      </div>
                      <span className="text-[11px] font-bold text-emerald-300 font-mono tracking-wider mt-1.5 uppercase">
                        Minecraft Vanilla
                      </span>
                    </div>
                  ) : inst.bannerUrl ? (
                    <img
                      src={inst.bannerUrl}
                      alt={inst.name}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-500">
                      <Layers className="w-8 h-8 opacity-60" />
                      <span className="text-[10px] font-mono uppercase tracking-widest">{inst.modLoader}</span>
                    </div>
                  )}

                  {/* Active Badge */}
                  {isActive && (
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 z-10">
                      <Check className="w-3 h-3 stroke-[3]" />
                      ACTIVO
                    </div>
                  )}

                  {/* Version Tag */}
                  <div className="absolute bottom-2 left-3 flex items-center gap-1.5 z-10">
                    <span className="bg-black/70 backdrop-blur-md text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
                      MC {inst.minecraftVersion}
                    </span>
                    <span className="bg-black/70 backdrop-blur-md text-cyan-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border border-cyan-500/30 uppercase">
                      {inst.modLoader}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                      {inst.name}
                      {inst.id === 'atm10' && <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {inst.description}
                    </p>
                  </div>

                  {/* Meta Specs */}
                  <div className="pt-3 border-t border-mc-border/60 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                      <span>RAM: <strong className="text-slate-200">{((inst.customRam || 4096) / 1024).toFixed(1)} GB</strong></span>
                    </div>

                    <div>
                      Mods: <strong className="text-slate-200">{inst.totalMods ?? (inst.modLoader === 'vanilla' ? 0 : '470+')}</strong>
                    </div>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="flex items-center gap-2 pt-2">
                    {isActive ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaunchInstance();
                        }}
                        className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-2 px-3 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        JUGAR ESTA INSTANCIA
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(inst)}
                        className="flex-1 bg-mc-darker hover:bg-slate-800 text-slate-200 font-semibold py-2 px-3 rounded-xl text-xs border border-mc-border transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        Activar Perfil
                      </button>
                    )}

                    <button
                      onClick={handleOpenFolder}
                      title="Abrir carpeta de esta instancia"
                      className="p-2 bg-mc-darker hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-mc-border transition-all"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>

                    {!inst.isDefault && inst.id !== 'atm10' && (
                      <button
                        onClick={(e) => handleDelete(inst, e)}
                        title="Eliminar instancia"
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl border border-red-500/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <CreateInstanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(newInst) => {
          handleActivate(newInst);
          loadInstances();
        }}
      />
    </div>
  );
};
