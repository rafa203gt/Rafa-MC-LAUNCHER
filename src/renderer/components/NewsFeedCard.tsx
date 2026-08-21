import React from 'react';
import { Newspaper, Pin, Calendar, Tag, ExternalLink } from 'lucide-react';
import { NewsAnnouncement } from '../types';

interface NewsFeedCardProps {
  news: NewsAnnouncement[];
}

export const NewsFeedCard: React.FC<NewsFeedCardProps> = ({ news }) => {
  if (!news || news.length === 0) return null;

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'event':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'maintenance':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'server':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="bg-mc-card/80 border border-mc-border/80 rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Newspaper className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Noticias y Anuncios de la Comunidad
            </h3>
            <p className="text-[11px] text-slate-400">Actualizaciones oficiales sincronizadas en tiempo real</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {news.map((item) => (
          <div
            key={item.id}
            className="bg-mc-darker/80 border border-mc-border/60 hover:border-slate-600 rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between gap-3 shadow-md"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getCategoryBadge(
                    item.category
                  )}`}
                >
                  {item.category}
                </span>
                {item.pinned && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <Pin className="w-3 h-3" />
                    Fijado
                  </span>
                )}
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
