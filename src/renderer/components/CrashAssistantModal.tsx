import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Wrench,
  Copy,
  Check,
  FolderOpen,
  Terminal,
  Cpu,
  Zap,
  Sparkles
} from 'lucide-react';
import { CrashDiagnosis } from '../types';

interface CrashAssistantModalProps {
  diagnosis: CrashDiagnosis | null;
  isOpen: boolean;
  onClose: () => void;
  onAutoFix: (action: string) => Promise<void>;
  onOpenLogsFolder: () => void;
}

export const CrashAssistantModal: React.FC<CrashAssistantModalProps> = ({
  diagnosis,
  isOpen,
  onClose,
  onAutoFix,
  onOpenLogsFolder
}) => {
  const [copied, setCopied] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [showRawLog, setShowRawLog] = useState(false);

  if (!isOpen || !diagnosis) return null;

  const handleCopyReport = () => {
    const reportText = `🚨 **Reporte de Crash - Rafa MC Launcher**
📅 **Fecha:** ${new Date().toLocaleString()}
⚠️ **Tipo de Fallo:** ${diagnosis.title}
🔢 **Código de Salida:** ${diagnosis.exitCode}
📝 **Diagnóstico:** ${diagnosis.description}
${diagnosis.culpritFile ? `📦 **Archivo/Mod Culpable:** \`${diagnosis.culpritFile}\`\n` : ''}
\`\`\`log
${diagnosis.rawLogSnippet || 'Sin registro adicional.'}
\`\`\``;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFixClick = async () => {
    setIsFixing(true);
    try {
      await onAutoFix(diagnosis.recommendedAction);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#0f131f] border border-rose-500/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Top Glow Accent */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-rose-400">
                Asistente Anti-Crash Inteligente
              </span>
              <h3 className="text-lg font-black text-white">{diagnosis.title}</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic Explanation Card */}
        <div className="bg-mc-card/90 border border-mc-border/80 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-slate-200 leading-relaxed">{diagnosis.description}</p>

          {diagnosis.culpritFile && (
            <div className="bg-rose-500/10 border border-rose-500/25 p-2.5 rounded-xl flex items-center gap-2 text-xs text-rose-300">
              <span className="font-bold">Archivo detectado:</span>
              <code className="bg-black/40 px-2 py-0.5 rounded text-[11px] font-mono text-rose-200">
                {diagnosis.culpritFile}
              </code>
            </div>
          )}

          {/* Raw Log Toggle */}
          <div className="pt-1">
            <button
              onClick={() => setShowRawLog(!showRawLog)}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              {showRawLog ? 'Ocultar registro técnico' : 'Ver registro de error técnico'}
            </button>

            {showRawLog && (
              <pre className="mt-2 p-3 bg-black/60 border border-white/10 rounded-xl text-[10px] font-mono text-rose-300/90 overflow-x-auto max-h-36 scrollbar-thin">
                {diagnosis.rawLogSnippet}
              </pre>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleFixClick}
            disabled={isFixing}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-glow flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
          >
            <Wrench className="w-4 h-4" />
            {isFixing ? 'Aplicando reparación...' : diagnosis.actionButtonText}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyReport}
              className="py-2.5 px-3 bg-mc-darker hover:bg-mc-card border border-mc-border text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              {copied ? '¡Reporte Copiado!' : 'Copiar para Discord'}
            </button>

            <button
              onClick={onOpenLogsFolder}
              className="py-2.5 px-3 bg-mc-darker hover:bg-mc-card border border-mc-border text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
              Abrir Carpeta Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
