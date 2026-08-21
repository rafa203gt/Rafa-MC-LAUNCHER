import React, { useState } from 'react';
import { Settings, Cpu, Coffee, Server, Monitor, Save, Folder, CheckCircle } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (newSettings: Partial<AppSettings>) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave }) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [savedStatus, setSavedStatus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleRamChange = (gb: number) => {
    const mb = gb * 1024;
    setFormData((prev) => ({
      ...prev,
      maxRam: mb,
      minRam: Math.min(prev.minRam, mb)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const maxRamGb = Math.round(formData.maxRam / 1024);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between bg-mc-card border border-mc-border p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            Configuración del Launcher
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Personaliza el rendimiento, asignación de RAM, Java y datos del servidor.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-glow transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {savedStatus && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          ¡Configuración guardada correctamente!
        </div>
      )}

      {/* Grid: 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RAM & Performance Card */}
        <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Memoria RAM Asignada
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">RAM Máxima:</span>
              <span className="font-extrabold text-emerald-400 text-base">{maxRamGb} GB</span>
            </div>

            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={maxRamGb}
              onChange={(e) => handleRamChange(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-mc-darker rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>2 GB</span>
              <span className="text-emerald-400 font-bold">4 GB (Recomendado)</span>
              <span>8 GB</span>
              <span>16 GB</span>
            </div>

            <p className="text-[11px] text-slate-400">
              Para Minecraft 1.20.1 con mods, 4 GB a 6 GB es la configuración ideal.
            </p>
          </div>
        </div>

        {/* Java Runtime Card */}
        <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-400" />
            Entorno Java 17
          </h3>

          <div className="space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoJava}
                onChange={(e) => setFormData({ ...formData, autoJava: e.target.checked })}
                className="w-4 h-4 rounded bg-mc-darker border-mc-border text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-slate-200 font-semibold">
                Auto-descargar OpenJDK 17 (Adoptium)
              </span>
            </label>
            <p className="text-[11px] text-slate-400">
              El launcher descargará automáticamente Java 17 en su carpeta interna sin alterar tu sistema.
            </p>

            {!formData.autoJava && (
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Ruta de Java personalizada</label>
                <input
                  type="text"
                  value={formData.customJavaPath}
                  onChange={(e) => setFormData({ ...formData, customJavaPath: e.target.value })}
                  placeholder="C:\Program Files\Java\...\javaw.exe"
                  className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* Server & Auto-Connect Card */}
        <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            Servidor y Conexión
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nombre del Servidor</label>
              <input
                type="text"
                value={formData.serverName}
                onChange={(e) => setFormData({ ...formData, serverName: e.target.value })}
                className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">IP / Dominio</label>
                <input
                  type="text"
                  value={formData.serverIp}
                  onChange={(e) => setFormData({ ...formData, serverIp: e.target.value })}
                  className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Puerto</label>
                <input
                  type="number"
                  value={formData.serverPort}
                  onChange={(e) => setFormData({ ...formData, serverPort: parseInt(e.target.value, 10) || 25565 })}
                  className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={formData.autoConnect}
                onChange={(e) => setFormData({ ...formData, autoConnect: e.target.checked })}
                className="w-4 h-4 rounded bg-mc-darker border-mc-border text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-slate-200 font-semibold">
                Conectar automáticamente al servidor al hacer clic en JUGAR
              </span>
            </label>
          </div>
        </div>

        {/* Display & Resolution Card */}
        <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Monitor className="w-4 h-4 text-pink-400" />
            Pantalla y Resolución
          </h3>

          <div className="space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.fullscreen}
                onChange={(e) => setFormData({ ...formData, fullscreen: e.target.checked })}
                className="w-4 h-4 rounded bg-mc-darker border-mc-border text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-slate-200 font-semibold">Pantalla Completa</span>
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Ancho (px)</label>
                <input
                  type="number"
                  value={formData.width}
                  disabled={formData.fullscreen}
                  onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value, 10) || 1280 })}
                  className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Alto (px)</label>
                <input
                  type="number"
                  value={formData.height}
                  disabled={formData.fullscreen}
                  onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value, 10) || 720 })}
                  className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
