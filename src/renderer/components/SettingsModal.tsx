import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cpu,
  Coffee,
  Server,
  Monitor,
  Save,
  Folder,
  CheckCircle,
  Sparkles,
  Zap,
  ShieldCheck,
  Activity,
  Flame,
  Info
} from 'lucide-react';
import { AppSettings, SystemHardwareInfo } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (newSettings: Partial<AppSettings>) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave }) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [savedStatus, setSavedStatus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hardware, setHardware] = useState<SystemHardwareInfo | null>(null);
  const [isLoadingHw, setIsLoadingHw] = useState(true);

  useEffect(() => {
    if (window.launcherAPI?.getHardwareInfo) {
      window.launcherAPI
        .getHardwareInfo()
        .then((info) => {
          setHardware(info);
          setIsLoadingHw(false);
        })
        .catch(() => setIsLoadingHw(false));
    } else {
      setIsLoadingHw(false);
    }
  }, []);

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
  const maxAvailableGb = hardware?.totalRamGb ? Math.floor(hardware.totalRamGb) : 16;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div className="flex items-center justify-between bg-mc-card border border-mc-border p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            Configuración y Rendimiento
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Personaliza el rendimiento, optimización JVM, GPU dedicada, RAM y servidor.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-glow transition-all disabled:opacity-50 active:scale-95"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {savedStatus && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          ¡Configuración guardada correctamente!
        </div>
      )}

      {/* Grid: 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hardware & GPU Diagnostic Card */}
        <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between border-b border-mc-border/60 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Diagnóstico de Hardware y Aceleración de GPU
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              Forzado de GPU Dedicada Activo
            </span>
          </div>

          {isLoadingHw ? (
            <div className="text-xs text-slate-400 py-3">Analizando hardware del sistema...</div>
          ) : hardware ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-[#0a0d14] p-3.5 rounded-xl border border-mc-border/60 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Procesador (CPU)</span>
                <p className="font-bold text-slate-200 truncate">{hardware.cpuModel}</p>
                <span className="text-[10px] text-slate-500 font-mono">{hardware.cpuCores} núcleos lógicos</span>
              </div>

              <div className="bg-[#0a0d14] p-3.5 rounded-xl border border-mc-border/60 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Tarjeta Gráfica (GPU)</span>
                <p className="font-bold text-emerald-400 truncate">{hardware.dedicatedGpu || hardware.gpus[0]}</p>
                <span className="text-[10px] text-slate-500 font-mono">{hardware.gpus.length > 1 ? `${hardware.gpus.length} GPUs detectadas` : 'GPU Principal'}</span>
              </div>

              <div className="bg-[#0a0d14] p-3.5 rounded-xl border border-mc-border/60 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Memoria RAM del PC</span>
                <p className="font-bold text-cyan-400">{hardware.totalRamGb} GB Total</p>
                <span className="text-[10px] text-slate-500 font-mono">{hardware.freeRamGb} GB Disponible</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">No se pudo obtener el diagnóstico del hardware.</div>
          )}
        </div>

        {/* JVM Optimizer Card */}
        <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            Optimizador de JVM (Garbage Collector)
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                Perfil de Rendimiento y Memoria
              </label>
              <select
                value={formData.jvmProfile || 'auto'}
                onChange={(e: any) => setFormData({ ...formData, jvmProfile: e.target.value })}
                className="w-full bg-mc-darker border border-mc-border focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="auto">🤖 Automático Inteligente (Recomendado)</option>
                <option value="aikar">🚀 Aikar's Flags (G1GC - Máxima Estabilidad en Modpacks)</option>
                <option value="zgc">⚡ Generational ZGC (Java 21+ Zero-Lag Latency)</option>
                <option value="low_end">🔋 Modo Ahorro / Portátil (Gama Baja)</option>
                <option value="custom">🛠️ Flags Personalizados</option>
              </select>
            </div>

            <p className="text-[11px] text-slate-400">
              {formData.jvmProfile === 'zgc'
                ? 'ZGC reduce las pausas de recolección de memoria a menos de 1 ms. Recomendado para PCs con 8GB+ de RAM.'
                : formData.jvmProfile === 'low_end'
                ? 'Optimizado para portátiles y equipos con recursos limitados para minimizar uso de CPU.'
                : 'Ajusta dinámicamente la recolección de basura para eliminar tirones de FPS (micro-stuttering).'}
            </p>
          </div>
        </div>

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
              max={Math.max(16, Math.min(32, maxAvailableGb - 2))}
              step={1}
              value={maxRamGb}
              onChange={(e) => handleRamChange(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-mc-darker rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>4 GB</span>
              <span>6 GB</span>
              <span className="text-emerald-400 font-bold">8 GB (Recomendado ATM10)</span>
              <span>{Math.max(16, Math.min(32, maxAvailableGb - 2))} GB</span>
            </div>

            <p className="text-[11px] text-slate-400">
              Para modpacks grandes como All the Mods 10 (1.21.1), se recomienda asignar de 6 GB a 8 GB de RAM.
            </p>
          </div>
        </div>

        {/* Java Runtime Card */}
        <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-400" />
            Entorno Java 17 / 21
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
                Auto-gestión inteligente de Java (OpenJDK)
              </span>
            </label>
            <p className="text-[11px] text-slate-400">
              El launcher detectará y aprovisionará automáticamente Java 21 para Minecraft 1.21 o Java 17 para versiones anteriores.
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

        {/* Discord Rich Presence Card */}
        <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Discord Rich Presence (RPC)
          </h3>

          <div className="space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.discordRpc !== false}
                onChange={(e) => {
                  const val = e.target.checked;
                  setFormData({ ...formData, discordRpc: val });
                  if ((window as any).launcherAPI?.setDiscordRpcEnabled) {
                    (window as any).launcherAPI.setDiscordRpcEnabled(val);
                  }
                }}
                className="w-4 h-4 rounded bg-mc-darker border-mc-border text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-slate-200 font-semibold">
                Mostrar estado y tiempo de juego en Discord
              </span>
            </label>
            <p className="text-[11px] text-slate-400">
              Muestra a tus amigos de Discord el modpack que estás jugando y el tiempo de sesión en vivo.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
};
