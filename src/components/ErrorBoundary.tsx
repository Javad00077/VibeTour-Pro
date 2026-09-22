import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('vbt_persisted_properties_v1');
      localStorage.removeItem('vbt_persisted_config_v1');
    } catch {
      // safe
    }
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090a0f] text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#12141d] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[#c5a880] mx-auto flex items-center justify-center shadow-lg">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white font-serif">
                خطا در بارگذاری اولیه وب‌تور
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                متأسفانه مشکلی در بارگذاری اسکریپت یا داده‌های ذخیره‌شده رخ داده است. با کلیک روی دکمه زیر می‌توانید صفحه را مجدداً لود کنید.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#c5a880] to-[#b3956d] text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>بارگذاری مجدد وب‌تور</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-amber-400" />
                <span>بازیابی تنظیمات اولیه و پاک‌سازی کش</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
