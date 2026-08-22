import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Zap,
  Cpu,
  Flame,
  Globe,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Shaderpack, supabase } from '../supabase';

interface ShadersManagerProps {
  shaders: Shaderpack[];
  onRefresh: () => void;
}

export const ShadersManager: React.FC<ShadersManagerProps> = ({ shaders, onRefresh }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTier, setFormTier] = useState<'fast' | 'balanced' | 'ultra'>('balanced');
  const [formDownloadUrl, setFormDownloadUrl] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [formSize, setFormSize] = useState<number>(3145728);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = formName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const { error } = await supabase.from('shaderpacks').insert({
        id: `${id}-${Date.now().toString().slice(-4)}`,
        name: formName,
        description: formDesc,
        performance_tier: formTier,
        download_url: formDownloadUrl,
        file_name: formFileName || `${id}.zip`,
        file_size: Number(formSize),
        is_active: true
      });

      if (error) throw error;
      setToast('✅ Shaderpack añadido con éxito');
      setTimeout(() => setToast(null), 3000);
      setIsAdding(false);
      setFormName('');
      setFormDesc('');
      setFormDownloadUrl('');
      setFormFileName('');
      onRefresh();
    } catch (err: any) {
      alert(`Error al guardar shaderpack: ${err.message}`);
    }
  };

  const handleToggleActive = async (shader: Shaderpack) => {
    try {
      const { error } = await supabase
        .from('shaderpacks')
        .update({ is_active: !shader.is_active })
        .eq('id', shader.id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Deseas eliminar este shader del catálogo de los launchers?')) return;
    try {
      const { error } = await supabase.from('shaderpacks').delete().eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="bg-admin-card border border-admin-border rounded-3xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-admin-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Catálogo de Shaders y Gráficos</h3>
            <p className="text-xs text-slate-400">
              Gestiona los paquetes de shaders recomendados descargables en 1 clic desde el launcher
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {toast && (
            <div className="flex items-center gap-2 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-xs px-3.5 py-1.5 rounded-full shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {toast}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Añadir Shader
          </button>
        </div>
      </div>

      {/* Shaders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shaders.map((shader) => (
          <div
            key={shader.id}
            className={`p-5 rounded-2xl border transition-all shadow-lg space-y-3 ${
              shader.is_active
                ? 'bg-[#0a0d14] border-admin-border hover:border-slate-700'
                : 'bg-[#080a0f] border-slate-900 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleActive(shader)}
                  className="text-slate-400 hover:text-white"
                >
                  {shader.is_active ? (
                    <ToggleRight className="w-7 h-7 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-slate-600" />
                  )}
                </button>
                <div>
                  <h4 className="text-sm font-extrabold text-white">{shader.name}</h4>
                  <span className="text-[10px] font-mono text-slate-500">{shader.file_name}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(shader.id)}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 line-clamp-2">{shader.description}</p>

            <div className="flex items-center justify-between pt-2 border-t border-admin-border/50 text-[11px] font-mono text-slate-400">
              <span className="capitalize">{shader.performance_tier}</span>
              <span>{((shader.file_size || 0) / (1024 * 1024)).toFixed(1)} MB</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-admin-card border border-admin-border rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-admin-border pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Añadir Shaderpack Recomendado
              </h3>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Nombre del Shader</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Sildurs Vibrant Shaders"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Describe los efectos visuales y rendimiento..."
                  className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Nivel de Rendimiento</label>
                  <select
                    value={formTier}
                    onChange={(e: any) => setFormTier(e.target.value)}
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="fast">Rápido (Gama Baja)</option>
                    <option value="balanced">Equilibrado (Recomendado)</option>
                    <option value="ultra">Ultra (Gama Alta)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Nombre de Archivo (.zip)</label>
                  <input
                    type="text"
                    required
                    placeholder="Sildurs.zip"
                    value={formFileName}
                    onChange={(e) => setFormFileName(e.target.value)}
                    className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">URL de Descarga (.zip directo)</label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/.../Shader.zip"
                  value={formDownloadUrl}
                  onChange={(e) => setFormDownloadUrl(e.target.value)}
                  className="w-full bg-[#0a0d14] border border-admin-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-admin-border">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95"
                >
                  Guardar Shader
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
