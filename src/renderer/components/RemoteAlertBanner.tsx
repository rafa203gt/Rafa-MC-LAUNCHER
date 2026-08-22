import React from 'react';
import { AlertTriangle, Info, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { RemoteLauncherConfig } from '../types';

interface RemoteAlertBannerProps {
  remoteConfig: RemoteLauncherConfig | null;
}

export const RemoteAlertBanner: React.FC<RemoteAlertBannerProps> = ({ remoteConfig }) => {
  const [dismissed, setDismissed] = React.useState(false);

  if (!remoteConfig || dismissed) return null;

  if (remoteConfig.maintenance_mode) {
    return (
      <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-amber-950 border-b border-rose-500/40 px-4 py-3 shadow-xl animate-fadeIn">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-rose-500/20 rounded-xl text-rose-300 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-white uppercase tracking-wider block">
                MODO MANTENIMIENTO ACTIVO
              </span>
              <p className="text-rose-200/90 text-[11px]">
                {remoteConfig.maintenance_message || 'El servidor y launcher se encuentran en mantenimiento.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!remoteConfig.banner_alert) return null;

  const getAlertStyles = (type: string) => {
    switch (type) {
      case 'warning':
        return {
          bg: 'from-amber-950/90 via-orange-950/90 to-amber-900/90 border-amber-500/40 text-amber-200',
          icon: <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
        };
      case 'error':
        return {
          bg: 'from-rose-950/90 via-red-950/90 to-rose-900/90 border-rose-500/40 text-rose-200',
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />
        };
      case 'success':
        return {
          bg: 'from-emerald-950/90 via-teal-950/90 to-emerald-900/90 border-emerald-500/40 text-emerald-200',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        };
      default:
        return {
          bg: 'from-indigo-950/90 via-blue-950/90 to-cyan-950/90 border-cyan-500/40 text-cyan-200',
          icon: <Info className="w-4 h-4 text-cyan-400" />
        };
    }
  };

  const style = getAlertStyles(remoteConfig.banner_alert_type || 'info');

  return (
    <div className={`bg-gradient-to-r ${style.bg} border-b px-4 py-2.5 shadow-lg animate-fadeIn text-xs`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded-lg bg-black/20 shrink-0">{style.icon}</div>
          <span className="font-medium text-white truncate">{remoteConfig.banner_alert}</span>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
