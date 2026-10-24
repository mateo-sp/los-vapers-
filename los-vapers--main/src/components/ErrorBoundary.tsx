import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error bound and recovered:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070b19] flex items-center justify-center p-4 relative overflow-hidden text-slate-100 font-sans">
          <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-rose-500/10 blur-[120px] pointer-events-none" />
          
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/25 p-6 rounded-2xl shadow-2xl relative text-center space-y-5">
            <span className="p-4 bg-rose-500/10 text-rose-400 rounded-full inline-block">
              <AlertCircle className="w-10 h-10 animate-pulse" />
            </span>
            
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">¡Ups! Ocurrió un error inesperado</h2>
              <p className="text-xs text-slate-400 leading-normal font-medium max-w-sm mx-auto">
                El sistema detectó un inconveniente al renderizar la pantalla anterior. La aplicación ha sido protegida para evitar cierres totales.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-rose-950/20 border border-rose-500/10 text-left rounded-xl max-h-36 overflow-y-auto">
                <span className="text-[9px] font-bold text-rose-300 font-mono block uppercase">Error Info</span>
                <p className="text-[10px] text-rose-200 font-mono mt-1 leading-normal break-all select-text">
                  {this.state.error.stack || this.state.error.message}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Reiniciar</span>
              </button>
              
              <button
                onClick={this.handleRetry}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/15"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
