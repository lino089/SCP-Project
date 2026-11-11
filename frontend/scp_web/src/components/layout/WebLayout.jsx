import { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import './WebLayout.css';

/**
 * Master Shell Layout for authenticated pages
 */
export default function WebLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  // Route Guard Focus Mode: Jika siswa memiliki sesi pengerjaan kuis aktif,
  // tahan siswa agar tetap berada di lembar ujian (blokir akses ke rute reguler).
  if (user?.role === 'student' && typeof window !== 'undefined') {
    try {
      const activeRaw = sessionStorage.getItem('scp_active_quiz_attempt');
      if (activeRaw) {
        const active = JSON.parse(activeRaw);
        if (active?.quizId && active?.expiresAt) {
          const expiresTime = new Date(active.expiresAt).getTime();
          if (expiresTime > Date.now()) {
            if (!location.pathname.includes(`/student/quiz/${active.quizId}/attempt`)) {
              return <Navigate to={`/student/quiz/${active.quizId}/attempt`} replace />;
            }
          } else {
            sessionStorage.removeItem('scp_active_quiz_attempt');
          }
        }
      }
    } catch {
      // Abaikan bila parsing JSON invalid
    }
  }

  // Lock body scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileSidebarOpen]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileSidebarOpen) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen]);

  return (
    <div className="web-app-shell">
      <TopBar
        isSidebarOpen={mobileSidebarOpen}
        onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
      />

      <div className="web-app-body">
        {mobileSidebarOpen && (
          <div
            className="web-app-backdrop"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <Sidebar
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        <main className="web-app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
