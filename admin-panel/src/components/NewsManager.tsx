import React, { useState } from 'react';
import { Newspaper, Plus, Trash2, Pin, Calendar, CheckCircle2, RefreshCw } from 'lucide-react';
import { NewsAnnouncement, supabase } from '../supabase';

interface NewsManagerProps {
  news: NewsAnnouncement[];
  onRefresh: () => void;
}

export const NewsManager: React.FC<NewsManagerProps> = ({ news, onRefresh }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NewsAnnouncement['category']>('update');
  const [pinned, setPinned] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('news_announcements').insert({
        title: title.trim(),
        content: content.trim(),
        category,
        pinned,
        is_active: true
      });

      if (error) throw error;

      setTitle('');
      setContent('');
      setIsCreating(false);
      onRefresh();
    } catch (err: any) {
      alert(`Error creando noticia: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Deseas eliminar este anuncio?')) return;
    try {
      const { error } = await supabase.from('news_announcements').delete().eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(`Error eliminando noticia: ${err.message}`);
    }
  };

  const handleTogglePin = async (id: string, currentPin: boolean) => {
    try {
      const { error } = await supabase
        .from('news_announcements')
        .update({ pinned: !currentPin })
        .eq('id', id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="bg-admin-card border border-admin-border rounded-3xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-admin-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Noticias y Comunicados de la Comunidad</h3>
            <p className="text-xs text-slate-400">Publica avisos que se verán directamente en el Dashboard del launcher</p>
          </div>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          {isCreating ? 'Cancelar' : 'Nueva Noticia'}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateNews} className="bg-[#0a0d14] border border-admin-border rounded-2xl p-5 space-y-4 animate-fadeIn">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Redactar Comunicado</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-300 block mb-1">Título</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Lanzamiento del nuevo mundo y misiones"
                className="w-full bg-[#111622] border border-admin-border focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-[#111622] border border-admin-border focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="update">Actualización (Verde)</option>
                <option value="event">Evento (Ámbar)</option>
                <option value="server">Servidor (Cyan)</option>
                <option value="maintenance">Mantenimiento (Rojo)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Contenido</label>
            <textarea
              required
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe los detalles del anuncio..."
              className="w-full bg-[#111622] border border-admin-border focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="w-4 h-4 rounded border-admin-border bg-[#111622] text-emerald-500 focus:ring-0"
              />
              Fijar este anuncio en la parte superior
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Publicar Noticia
            </button>
          </div>
        </form>
      )}

      {/* News List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {news.map((item) => (
          <div
            key={item.id}
            className="bg-[#0a0d14] border border-admin-border hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300">
                  {item.category}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleTogglePin(item.id, item.pinned)}
                    title="Fijar / Desfijar"
                    className={`p-1.5 rounded-lg transition-colors ${
                      item.pinned ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Eliminar Noticia"
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h4 className="font-bold text-white text-sm leading-snug">{item.title}</h4>
              <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{item.content}</p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-white/5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
