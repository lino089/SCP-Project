import { useState, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import MobileTopBar from './MobileTopBar';
import MobileBottomNav from './MobileBottomNav';
import MobileMoreDrawer from './MobileMoreDrawer';
import './MobileLayout.css';

/**
 * MobileLayout — Primary Application Shell for SCP Mobile
 * Combines sticky MobileTopBar, scrollable viewport content,
 * fixed role-adaptive MobileBottomNav, and slide-up MobileMoreDrawer.
 */
export default function MobileLayout() {
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  return (
    <div className="mobile-layout">
      <div className="mobile-layout__frame">
        <MobileTopBar />

        <main className="mobile-layout__main">
          <div className="mobile-layout__content">
            <Suspense
              fallback={
                <div className="flex-1 flex flex-col items-center justify-center min-h-[40vh] gap-3">
                  <div
                    className="w-7 h-7 rounded-full animate-spin"
                    style={{
                      border: '2px solid var(--color-border-subtle)',
                      borderTopColor: 'var(--color-action)',
                    }}
                  />
                  <span className="text-caption font-medium">Memuat halaman…</span>
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>

        <MobileBottomNav
          isMoreOpen={moreDrawerOpen}
          onOpenMore={() => setMoreDrawerOpen(true)}
        />

        <MobileMoreDrawer
          isOpen={moreDrawerOpen}
          onClose={() => setMoreDrawerOpen(false)}
        />
      </div>
    </div>
  );
}
