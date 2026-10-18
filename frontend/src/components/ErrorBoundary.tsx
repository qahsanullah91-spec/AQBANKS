import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AQ Companies Portal ErrorBoundary Caught Anomaly]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('aq_token');
      localStorage.removeItem('aq_user');
      localStorage.removeItem('aq_standalone_db_v1');
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800">
                  SYSTEM RECOVERY GATEWAY
                </span>
                <h1 className="text-xl font-bold text-white mt-2">
                  Portal Display Anomaly Recovered
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  An isolated rendering error was captured by the safety runtime. Financial records and session state remain secured.
                </p>
              </div>

              {this.state.error && (
                <div className="w-full text-left p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 max-h-36 overflow-y-auto space-y-1">
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{this.state.error.name}: {this.state.error.message}</span>
                  </div>
                  {this.state.error.stack && (
                    <pre className="text-[10px] text-slate-500 overflow-x-auto whitespace-pre-wrap leading-tight">
                      {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reload Application</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Reset Cache & Re-login</span>
                </button>
              </div>

              <div className="text-[10px] text-slate-500 font-mono pt-2">
                AQ Companies • Sky Ariana Ltd • 256-Bit TLS Protected
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
