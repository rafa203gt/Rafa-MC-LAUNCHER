import React, { useState } from 'react';
import { Bug, CheckCircle2, Trash2, Calendar, User, Cpu, AlertTriangle, RefreshCw, Terminal } from 'lucide-react';
import { CrashReport, supabase } from '../supabase';

interface CrashAnalyticsProps {
  reports: CrashReport[];
  onRefresh: () => void;
}

export const CrashAnalytics: React.FC<CrashAnalyticsProps> = ({ reports, onRefresh }) => {
  const [selectedReport, setSelectedReport] = useState<CrashReport | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleResolved = async (report: CrashReport) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('crash_reports')
        .update({ resolved: !report.resolved })
        .eq('id', report.id);
      if (error) throw error;
      onRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Deseas eliminar este reporte de error?')) return;
    try {
      const { error } = await supabase.from('crash_reports').delete().eq('id', id);
      if (error) throw error;
      if (selectedReport?.id === id) setSelectedReport(null);
      onRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const unresolvedCount = reports.filter((r) => !r.resolved).length;

  return (
    <div className="bg-admin-card border border-admin-border rounded-3xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-admin-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
            <Bug className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Telemetría y Reportes de Crashes</h3>
            <p className="text-xs text-slate-400">
              Registros automáticos de errores enviados por los launchers de los jugadores
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[#0a0d14] border border-admin-border">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Reportes</span>
          <span className="text-xl font-extrabold text-white">{reports.length}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0a0d14] border border-admin-border">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Sin Resolver</span>
          <span className="text-xl font-extrabold text-rose-400">{unresolvedCount}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0a0d14] border border-admin-border">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Resueltos</span>
          <span className="text-xl font-extrabold text-emerald-400">{reports.length - unresolvedCount}</span>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-admin-border rounded-2xl bg-[#0a0d14]/40 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h4 className="text-sm font-bold text-white">¡No hay reportes de error pendientes!</h4>
          <p className="text-xs text-slate-400">Todos los launchers están funcionando de forma óptima.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                report.resolved
                  ? 'bg-[#080a0f] border-slate-900 opacity-60'
                  : 'bg-[#0a0d14] border-rose-500/30 hover:border-rose-500/60'
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {report.username}
                  </span>
                  <span className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-slate-300">
                    MC {report.minecraft_version} • Launcher {report.launcher_version} • {report.ram_allocated}MB RAM
                  </span>
                </div>
                <p className="text-xs text-rose-300 font-mono line-clamp-1">
                  {report.error_message || 'El proceso de Minecraft finalizó inesperadamente.'}
                </p>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(report.created_at).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {report.crash_log && (
                  <button
                    type="button"
                    onClick={() => setSelectedReport(report)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all"
                  >
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    Ver Log
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleToggleResolved(report)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    report.resolved
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {report.resolved ? 'Reabrir' : 'Resolver'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(report.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-admin-card border border-admin-border rounded-3xl p-6 w-full max-w-3xl max-h-[80vh] flex flex-col gap-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-admin-border pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                Crash Log de {selectedReport.username} ({new Date(selectedReport.created_at).toLocaleString()})
              </h3>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#080a0f] border border-admin-border rounded-2xl p-4 font-mono text-xs text-rose-300 whitespace-pre-wrap leading-relaxed">
              {selectedReport.crash_log || 'No hay log disponible para este reporte.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
