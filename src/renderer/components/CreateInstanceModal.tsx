import React, { useState } from 'react';
import { X, Plus, Box, Layers, Cpu, Globe } from 'lucide-react';
import { MinecraftInstance } from '../types';

interface CreateInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (instance: MinecraftInstance) => void;
}

export const CreateInstanceModal: React.FC<CreateInstanceModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minecraftVersion, setMinecraftVersion] = useState('1.21.1');
  const [modLoader, setModLoader] = useState<'neoforge' | 'fabric' | 'forge' | 'vanilla'>('neoforge');
  const [modLoaderVersion, setModLoaderVersion] = useState('21.1.247');
  const [modpackManifestUrl, setModpackManifestUrl] = useState('');
  const [customRam, setCustomRam] = useState(4096);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (window.launcherAPI?.createInstance) {
        const created = await window.launcherAPI.createInstance({
          name: name.trim(),
          description: description.trim() || 'Instancia personalizada de Minecraft.',
          minecraftVersion,
          modLoader,
          modLoaderVersion: modLoader === 'vanilla' ? '' : modLoaderVersion,
          modpackManifestUrl: modpackManifestUrl.trim(),
          customRam
        });
        onCreated(created);
        onClose();
      }
    } catch (err) {
      console.error('Error creando instancia:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-mc-card border border-mc-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mc-border/80 bg-mc-darker/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Crear Nueva Instancia / Modpack</h3>
              <p className="text-xs text-slate-400">Configura un perfil aislado de Minecraft o añade un modpack</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-emerald-400" />
              Nombre de la Instancia *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cobblemon Adventure, Vanilla 1.21..."
              className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Descripción Corta
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Modpack de aventuras con amigos"
              className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Versión de Minecraft
              </label>
              <select
                value={minecraftVersion}
                onChange={(e) => setMinecraftVersion(e.target.value)}
                className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="1.21.1">1.21.1 (Última recomendada)</option>
                <option value="1.20.1">1.20.1</option>
                <option value="1.19.2">1.19.2</option>
                <option value="1.16.5">1.16.5</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Cargador de Mods
              </label>
              <select
                value={modLoader}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setModLoader(val);
                  if (val === 'neoforge') setModLoaderVersion('21.1.247');
                  else if (val === 'fabric') setModLoaderVersion('0.16.9');
                  else if (val === 'forge') setModLoaderVersion('51.0.33');
                }}
                className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="neoforge">NeoForge</option>
                <option value="fabric">Fabric</option>
                <option value="forge">Forge</option>
                <option value="vanilla">Vanilla (Sin Mods)</option>
              </select>
            </div>
          </div>

          {modLoader !== 'vanilla' && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                URL del Manifiesto Remoto (Opcional para Auto-Sincronización)
              </label>
              <input
                type="url"
                value={modpackManifestUrl}
                onChange={(e) => setModpackManifestUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/.../manifest.json"
                className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-300 focus:outline-none"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                RAM Asignada a esta Instancia
              </span>
              <span className="font-mono text-emerald-400 font-bold">{(customRam / 1024).toFixed(1)} GB</span>
            </div>
            <input
              type="range"
              min={2048}
              max={16384}
              step={1024}
              value={customRam}
              onChange={(e) => setCustomRam(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-mc-border/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Crear Instancia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
