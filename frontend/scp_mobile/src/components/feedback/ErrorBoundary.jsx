import React from 'react';
import { AlertTriangle, RotateCcw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import './ErrorBoundary.css';

/**
 * Global React Error Boundary (SCP Mobile)
 * Menangkap runtime crash JavaScript/React di seluruh komponen anak
 * agar layar tidak blank putih dan pengguna dapat melakukan pemulihan mandiri.
 */
class ErrorBoundary extends React.Component {
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
    console.error('[SCP Mobile ErrorBoundary] Runtime Exception Caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;

      return (
        <div className="error-boundary-wrapper" role="alert">
          <div className="error-boundary-card">
            <div className="error-boundary-icon-box">
              <AlertTriangle size={28} strokeWidth={2} />
            </div>

            <h1 className="error-boundary-title">
              Terjadi Gangguan Teknis pada Antarmuka
            </h1>
            <p className="error-boundary-desc">
              Sistem mendeteksi kesalahan tak terduga saat memuat halaman ini. Data akademik Anda tetap aman di server. Silakan muat ulang halaman atau kembali ke beranda.
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

            {error && (
              <div className="error-boundary-details">
                <button
                  type="button"
                  className="error-boundary-toggle-btn"
                  onClick={this.toggleDetails}
                >
                  <span>Detail Diagnostik Teknis</span>
                  {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showDetails && (
                  <div className="error-boundary-code-box">
                    <div className="font-semibold text-red-400 mb-1">
                      {error.toString()}
                    </div>
                    {errorInfo?.componentStack && (
                      <pre className="whitespace-pre-wrap text-[11px] text-[var(--color-text-muted)]">
                        {errorInfo.componentStack.trim()}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
