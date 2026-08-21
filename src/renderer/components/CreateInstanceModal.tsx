import React, { useState } from 'react';
import { X, Plus, Box, Layers, Cpu, Globe, Sparkles } from 'lucide-react';
import { MinecraftInstance } from '../types';

interface CreateInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (instance: MinecraftInstance) => void;
}

const VANILLA_VERSIONS = [
  '1.21.4',
  '1.21.3',
  '1.21.1',
  '1.21',
  '1.20.6',
  '1.20.4',
  '1.20.2',
  '1.20.1',
  '1.19.4',
  '1.19.2',
  '1.18.2',
  '1.17.1',
  '1.16.5',
  '1.12.2',
  '1.8.9',
  '1.7.10'
];

export const CreateInstanceModal: React.FC<CreateInstanceModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minecraftVersion, setMinecraftVersion] = useState('1.21.4');
  const [isCustomVersion, setIsCustomVersion] = useState(false);
  const [customVersionText, setCustomVersionText] = useState('');
  const [modLoader, setModLoader] = useState<'neoforge' | 'fabric' | 'forge' | 'vanilla'>('vanilla');
  const [modLoaderVersion, setModLoaderVersion] = useState('');
  const [modpackManifestUrl, setModpackManifestUrl] = useState('');
  const [customRam, setCustomRam] = useState(4096);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const effectiveVersion = isCustomVersion ? customVersionText.trim() || '1.21.4' : minecraftVersion;

  const handleLoaderChange = (loader: 'neoforge' | 'fabric' | 'forge' | 'vanilla') => {
    setModLoader(loader);
    if (loader === 'vanilla') {
      if (!name || name.startsWith('Minecraft Vanilla') || name.startsWith('All the Mods')) {
        setName(`Minecraft Vanilla ${effectiveVersion}`);
      }
      if (!description) {
        setDescription(`Instancia Vanilla de Minecraft ${effectiveVersion} limpia y oficial.`);
      }
    } else if (loader === 'neoforge') {
      setModLoaderVersion('21.1.247');
    } else if (loader === 'fabric') {
      setModLoaderVersion('0.16.9');
    } else if (loader === 'forge') {
      setModLoaderVersion('51.0.33');
    }
  };

  const handleVersionChange = (ver: string) => {
    if (ver === 'custom') {
      setIsCustomVersion(true);
    } else {
      setIsCustomVersion(false);
      setMinecraftVersion(ver);
      if (modLoader === 'vanilla') {
        setName(`Minecraft Vanilla ${ver}`);
        setDescription(`Instancia Vanilla de Minecraft ${ver} limpia y oficial.`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || (modLoader === 'vanilla' ? `Minecraft Vanilla ${effectiveVersion}` : 'Nueva Instancia');

    setIsSubmitting(true);
    try {
      if (window.launcherAPI?.createInstance) {
        const created = await window.launcherAPI.createInstance({
          name: finalName,
          description: description.trim() || (modLoader === 'vanilla' ? `Minecraft Vanilla ${effectiveVersion}` : 'Instancia personalizada de Minecraft.'),
          minecraftVersion: effectiveVersion,
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
              <h3 className="font-bold text-white text-base">Crear Nueva Instancia</h3>
              <p className="text-xs text-slate-400">Selecciona la versión de Minecraft Vanilla o añade un Modpack</p>
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
          {/* Tipo de Instancia */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Tipo de Experiencia
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleLoaderChange('vanilla')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                  modLoader === 'vanilla'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-mc-darker border-mc-border text-slate-400 hover:border-slate-600'
                }`}
              >
                <Box className="w-5 h-5" />
                <span className="text-xs font-bold">Minecraft Vanilla</span>
                <span className="text-[10px] text-slate-400">Juego oficial sin mods</span>
              </button>

              <button
                type="button"
                onClick={() => handleLoaderChange('neoforge')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                  modLoader !== 'vanilla'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-mc-darker border-mc-border text-slate-400 hover:border-slate-600'
                }`}
              >
                <Layers className="w-5 h-5" />
                <span className="text-xs font-bold">Con Mods / Modpack</span>
                <span className="text-[10px] text-slate-400">NeoForge, Fabric o Forge</span>
              </button>
            </div>
          </div>

          {/* Versión de Minecraft */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Versión de Minecraft Oficial *
            </label>
            <div className="space-y-2">
              <select
                value={isCustomVersion ? 'custom' : minecraftVersion}
                onChange={(e) => handleVersionChange(e.target.value)}
                className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              >
                {VANILLA_VERSIONS.map((v) => (
                  <option key={v} value={v}>
                    Minecraft {v} {v === '1.21.4' ? '(Última Versión Oficial)' : ''}
                  </option>
                ))}
                <option value="custom">Escribir otra versión específica...</option>
              </select>

              {isCustomVersion && (
                <input
                  type="text"
                  required
                  value={customVersionText}
                  onChange={(e) => {
                    setCustomVersionText(e.target.value);
                    if (modLoader === 'vanilla') {
                      setName(`Minecraft Vanilla ${e.target.value}`);
                    }
                  }}
                  placeholder="Ej: 1.20.5, 1.15.2, 24w14a..."
                  className="w-full bg-mc-darker border border-cyan-500/60 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Nombre de la Instancia */}
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
              placeholder={`Minecraft Vanilla ${effectiveVersion}`}
              className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          {/* Loader Selection if modded */}
          {modLoader !== 'vanilla' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Cargador de Mods
                </label>
                <select
                  value={modLoader}
                  onChange={(e) => handleLoaderChange(e.target.value as any)}
                  className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="neoforge">NeoForge</option>
                  <option value="fabric">Fabric</option>
                  <option value="forge">Forge</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Versión del Loader
                </label>
                <input
                  type="text"
                  value={modLoaderVersion}
                  onChange={(e) => setModLoaderVersion(e.target.value)}
                  placeholder="Ej: 21.1.247"
                  className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {modLoader !== 'vanilla' && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                URL del Manifiesto Remoto (Opcional)
              </label>
              <input
                type="url"
                value={modpackManifestUrl}
                onChange={(e) => setModpackManifestUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/.../manifest.json"
                className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none font-mono"
              />
            </div>
          )}

          {/* Info Badge */}
          {modLoader === 'vanilla' && (
            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300/90 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Al iniciar por primera vez, el launcher descargará automáticamente el cliente de Minecraft <strong>{effectiveVersion}</strong>, los assets oficiales de sonido y librerías desde los servidores de Mojang.
              </span>
            </div>
          )}

          {/* RAM Allocation */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                Memoria RAM para esta Instancia
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {(customRam / 1024).toFixed(1)} GB
              </span>
            </div>
            <input
              type="range"
              min={2048}
              max={16384}
              step={1024}
              value={customRam}
              onChange={(e) => setCustomRam(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-mc-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Creando...' : 'Crear y Descargar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
