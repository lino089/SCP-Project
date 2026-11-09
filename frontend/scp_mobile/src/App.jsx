import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/feedback/ErrorBoundary';
import AppRouter from './routes/AppRouter';
import UpdateNotification from './components/common/UpdateNotification';
import updaterService from './services/updaterService';

export default function App() {
  useEffect(() => {
    // 1. Beritahu native layer bahwa JS bundle boot dengan sukses (mencegah auto-rollback)
    updaterService.notifyAppReady();

    // 2. Jalankan pengecekan pembaruan OTA di background (silent mode)
    // Beri sedikit jeda agar tidak berebut bandwidth dengan initial auth/data request
    const timer = setTimeout(() => {
      updaterService.checkAndDownloadBackground();
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <UpdateNotification />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
