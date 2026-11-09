import { useState, useEffect } from 'react';
import { ArrowUpCircle, RefreshCw, X } from 'lucide-react';
import updaterService from '../../services/updaterService';

export function UpdateNotification() {
  const [updateData, setUpdateData] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const unsubscribe = updaterService.onUpdateReady((data) => {
      setUpdateData(data);
    });
    return unsubscribe;
  }, []);

  if (!updateData) return null;

  const handleReload = async () => {
    setIsApplying(true);
    try {
      await updaterService.reloadImmediately(updateData.bundleId);
    } catch (err) {
      console.error('[UpdateNotification] Reload error:', err);
      setIsApplying(false);
    }
  };

  const handleDismiss = () => {
    setUpdateData(null);
  };

  return (
    <aside
      role="region"
      aria-label="Pembaruan Aplikasi Tersedia"
      className="fixed bottom-20 left-4 right-4 z-50 max-w-[420px] mx-auto animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className="surface-card p-3.5 rounded-[14px] border border-[var(--color-brand)] bg-[var(--color-surface)] shadow-lg flex items-start gap-3">
        <div className="p-2 rounded-[10px] bg-[var(--color-brand-subtle)] text-[var(--color-brand)] shrink-0 mt-0.5">
          <ArrowUpCircle size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-[var(--color-text-primary)] truncate">
              Pembaruan Siap (v{updateData.version})
            </h4>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-0.5 transition-colors"
              aria-label="Tutup"
            >
              <X size={15} />
            </button>
          </div>

          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 line-clamp-2 leading-relaxed">
            {updateData.releaseNotes || 'Pembaruan sistem telah diunduh dan siap diterapkan.'}
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              disabled={isApplying}
              onClick={handleReload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--color-brand)] text-white text-[11px] font-semibold hover:opacity-95 active:scale-95 transition-all"
            >
              <RefreshCw size={12} className={isApplying ? 'animate-spin' : ''} />
              {isApplying ? 'Memuat Ulang…' : 'Muat Ulang Sekarang'}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
            >
              Nanti Saja
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default UpdateNotification;
