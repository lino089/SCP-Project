import React from 'react';
import { AlertTriangle, RotateCcw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import './ErrorBoundary.css';

/**
 * Global Error Boundary Component
 * Menangkap unhandled JavaScript runtime exception pada pohon komponen React
 * untuk mencegah terjadinya layar putih kosong (white screen of death).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Catat log error teknis tanpa mengekspos token
    console.error('Unhandled React Runtime Error caught by ErrorBoundary:', error?.message);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;
      const isDev = import.meta.env?.DEV;

      return (
        <div className="error-boundary-wrapper" role="alert">
          <div className="error-boundary-card">
            <div className="error-boundary-icon-box" aria-hidden="true">
              <AlertTriangle size={28} strokeWidth={2.2} />
            </div>

            <h1 className="error-boundary-title">
              Aplikasi Mengalami Kendala Tak Terduga
            </h1>

            <p className="error-boundary-desc">
              Terjadi kesalahan pada komponen antarmuka yang menyebabkan halaman tidak dapat dimuat secara normal. Anda dapat memuat ulang peramban atau kembali ke beranda sistem.
            </p>

            <div className="error-boundary-actions">
              <button
                type="button"
                className="error-boundary-btn error-boundary-btn--primary"
                onClick={this.handleReload}
              >
                <RotateCcw size={16} />
                <span>Muat Ulang Halaman</span>
              </button>

              <button
                type="button"
                className="error-boundary-btn error-boundary-btn--secondary"
                onClick={this.handleGoHome}
              >
                <Home size={16} />
                <span>Kembali ke Beranda</span>
              </button>
            </div>

            {/* Technical Error Details (Tersedia untuk diagnosis) */}
            <div className="error-boundary-details">
              <button
                type="button"
                className="error-boundary-toggle-btn"
                onClick={this.toggleDetails}
                aria-expanded={showDetails}
              >
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{showDetails ? 'Sembunyikan Informasi Teknis' : 'Lihat Informasi Teknis Diagnosis'}</span>
              </button>

              {showDetails && (
                <div className="error-boundary-code-box">
                  <div className="font-bold text-red-400 mb-1">
                    {error?.toString() || 'Unknown Runtime Error'}
                  </div>
                  {isDev && errorInfo?.componentStack && (
                    <pre className="whitespace-pre-wrap text-[10px] text-slate-400">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
