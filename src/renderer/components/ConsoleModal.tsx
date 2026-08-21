import React, { useRef, useEffect } from 'react';
import { Terminal, Trash2, Copy, Check } from 'lucide-react';

interface ConsoleModalProps {
  logs: string[];
  onClear: () => void;
}

export const ConsoleModal: React.FC<ConsoleModalProps> = ({ logs, onClear }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatLogLine = (line: string, index: number) => {
    let colorClass = 'text-slate-300';
    if (line.includes('[ERROR]') || line.includes('Exception') || line.includes('Error')) {
      colorClass = 'text-rose-400 font-semibold';
    } else if (line.includes('[WARN]') || line.includes('WARNING')) {
      colorClass = 'text-amber-400';
    } else if (line.includes('[MINECRAFT]')) {
      colorClass = 'text-emerald-400';
    } else if (line.includes('[DEBUG]')) {
      colorClass = 'text-slate-500';
    }

    return (
      <div key={index} className={`font-mono text-[11px] leading-relaxed break-all ${colorClass}`}>
        {line}
      </div>
    );
  };

  return (
    <div className="bg-mc-card border border-mc-border rounded-2xl p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            Consola de Registro en Vivo
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visualiza los registros de descarga, inicialización de Java y ejecución de Minecraft.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-mc-darker hover:bg-slate-800 border border-mc-border rounded-xl text-xs font-semibold text-slate-300 transition-all disabled:opacity-50"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>

          <button
            onClick={onClear}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar
          </button>
        </div>
      </div>

      {/* Terminal Box */}
      <div className="bg-mc-darker border border-mc-border/80 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs space-y-1 select-text">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic text-center py-20">
            No hay registros disponibles. Los logs aparecerán aquí cuando inicies el juego.
          </div>
        ) : (
          logs.map((line, idx) => formatLogLine(line, idx))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
