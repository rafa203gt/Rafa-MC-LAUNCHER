import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI component:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-mc-darker text-white p-6 select-none">
          <div className="bg-mc-card border border-rose-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-rose-300">Algo salió mal en la interfaz</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ocurrió un error inesperado al renderizar la vista. Los datos de tu juego y mods están a salvo.
            </p>
            {this.state.error && (
              <div className="bg-black/50 p-3 rounded-lg text-left text-[11px] font-mono text-rose-300/80 overflow-x-auto max-h-28 border border-rose-950">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Recargar Launcher
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
