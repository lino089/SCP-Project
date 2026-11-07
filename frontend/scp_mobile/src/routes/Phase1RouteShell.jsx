import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Layers,
  Sliders,
  CheckCircle2,
  Lock,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import {
  Button,
  Badge,
  Input,
  Select,
  Card,
  StatCard,
  MobileRecordCard,
  SegmentedTabs,
  BottomSheetModal,
  FullScreenSheet,
  PasswordSheet,
  ConfirmSheet,
  FileUpload,
  SearchInput,
  PaginationBar,
  ProgressBar,
} from '../components/shared';
import { EmptyState, ErrorState } from '../components/feedback';

/**
 * Phase1LoginFoundation — Real API Authentication Gateway for Phase 1 Verification
 * Connects directly to Laravel `/api/login` and `/api/auth/google` via `AuthContext` (no dummy auth).
 * Full Login & Forgot Password OTP UI will be expanded in Phase 2.
 */
export function Phase1LoginFoundation() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, getHomeRoute } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { triggerGoogleLogin, isGoogleLoading } = useGoogleAuth({
    onSuccess: async (accessToken) => {
      setError('');
      try {
        const userData = await loginWithGoogle(accessToken);
        navigate(getHomeRoute(userData), { replace: true });
      } catch (err) {
        setError(err?.message || 'Gagal autentikasi dengan akun Google.');
      }
    },
    onError: (msg) => setError(msg),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Email/Username/NIP/NIS dan kata sandi wajib diisi.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const userData = await login({
        login: identifier.trim(),
        email: identifier.trim(),
        username: identifier.trim(),
        password,
      });
      navigate(getHomeRoute(userData), { replace: true });
    } catch (err) {
      setError(err?.message || 'Kredensial tidak valid atau gagal terhubung ke server API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-surface-subtle)] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] surface-card p-5 shadow-[var(--shadow-card)] space-y-5">
        <div className="flex items-center justify-between border-b border-[var(--color-border-light)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[var(--color-text-primary)] flex items-center justify-center">
              <span className="w-2.5 h-2.5 bg-[var(--color-brand)] rounded-[1px]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--color-text-primary)] leading-tight">
                School Class Progress
              </h1>
              <p className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                SCP MOBILE v1.0 — FONDASI FASE 1
              </p>
            </div>
          </div>
          <Badge variant="accent" size="sm" mono>
            FASE 1
          </Badge>
        </div>

        {error && (
          <div
            className="p-3 rounded bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-xs text-[var(--color-danger-fg)] font-medium"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Input
            id="mobile-login-id"
            label="Email / Username / NIP / NIS"
            placeholder="Masukkan identitas akun..."
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading || isGoogleLoading}
            required
          />

          <Input
            id="mobile-login-password"
            type="password"
            label="Kata Sandi"
            placeholder="Masukkan kata sandi..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || isGoogleLoading}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
          >
            Masuk ke Sistem
          </Button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="grow border-t border-[var(--color-border-subtle)]" />
          <span className="shrink mx-3 text-[11px] font-mono text-[var(--color-text-muted)] uppercase">
            Atau
          </span>
          <div className="grow border-t border-[var(--color-border-subtle)]" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="md"
          fullWidth
          loading={isGoogleLoading}
          disabled={loading}
          onClick={triggerGoogleLogin}
        >
          Masuk dengan Google (SSO Sekolah)
        </Button>
      </div>
    </div>
  );
}

/**
 * Phase1RouteShell — Foundation Route & UI Kit Verification View inside MobileLayout
 * Allows verifying role routing, guards, layout navigation, and all Phase 1 shared components
 * before Phase 2–6 feature pages are implemented.
 */
export function Phase1RouteShell({ title, phaseTarget = 'Fase 2–6' }) {
  const location = useLocation();
  const { user, hasRole, isKesiswaan, isWaliKelas } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDemoRole, setSelectedDemoRole] = useState('all');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [page, setPage] = useState(1);

  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [isPasswordSheetOpen, setIsPasswordSheetOpen] = useState(false);
  const [isConfirmSheetOpen, setIsConfirmSheetOpen] = useState(false);

  return (
    <div className="space-y-3.5">
      {/* Active Route & Session Verification Banner */}
      <Card
        title={title || 'Fondasi Halaman Mobile'}
        subtitle={`Route aktif: ${location.pathname}`}
        actions={
          <Badge variant="accent" size="sm" mono>
            {phaseTarget}
          </Badge>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Kerangka rute, guard otorisasi, <strong>MobileLayout</strong>,{' '}
            <strong>MobileTopBar</strong>, <strong>MobileBottomNav</strong>, dan{' '}
            <strong>MobileMoreDrawer</strong> telah aktif dan terhubung dengan{' '}
            <code className="font-mono text-[11px] bg-[var(--color-surface-subtle)] px-1 py-0.5 rounded">
              AuthContext
            </code>
            . Implementasi penuh halaman fitur ini dijadwalkan pada{' '}
            <strong>{phaseTarget}</strong>.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 rounded bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)]">
              <span className="text-[11px] font-mono uppercase text-[var(--color-text-muted)] block">
                Peran Aktif
              </span>
              <span className="text-xs font-semibold text-[var(--color-text-primary)] font-mono">
                {user?.role || '-'} {hasRole('waka') ? '(Waka)' : ''}
              </span>
            </div>
            <div className="p-2.5 rounded bg-[var(--color-bg-app)] border border-[var(--color-border-subtle)]">
              <span className="text-[11px] font-mono uppercase text-[var(--color-text-muted)] block">
                Tugas Tambahan
              </span>
              <span className="text-xs font-semibold text-[var(--color-text-primary)] font-mono">
                {isKesiswaan()
                  ? 'Kesiswaan'
                  : isWaliKelas()
                  ? 'Wali Kelas'
                  : 'Standar'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Segmented Tabs Switcher to test Phase 1 Shared & Feedback Kit */}
      <SegmentedTabs
        tabs={[
          { id: 'overview', label: 'Komponen Kartu', icon: Layers, count: 3 },
          { id: 'forms', label: 'Form & Input', icon: Sliders },
          { id: 'sheets', label: 'Sheet & Modal', icon: Sparkles, count: 4 },
          { id: 'feedback', label: 'State & Umpan Balik', icon: ShieldCheck },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              label="Kehadiran Hari Ini"
              value="96.4%"
              trend="+1.2%"
              subtext="32 Rombel Aktif"
              icon={CheckCircle2}
              variant="accent"
            />
            <StatCard
              label="Jurnal Masuk"
              value="118/124"
              subtext="Semester Ganjil"
              icon={FileText}
              variant="success"
            />
          </div>

          <ProgressBar
            label="Kelengkapan Fondasi Fase 1"
            value={100}
            color="success"
          />

          <MobileRecordCard
            code="XII-RPL-1"
            title="Pemrograman Web & Perangkat Bergerak"
            subtitle="Guru Pengampu: Budi Santoso, S.Kom."
            statusBadge="Terjadwal"
            statusVariant="success"
            accentBorder
            meta={[
              { label: 'Jam Pelajaran', value: 'JP 01 - 04 (07:00 - 10:00)', mono: true },
              { label: 'Ruang / Lab', value: 'Lab Komputer 2', mono: false },
            ]}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBottomSheetOpen(true)}
                >
                  Detail Sheet
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsFullScreenOpen(true)}
                >
                  Buka Full Sheet
                </Button>
              </>
            }
          />

          <PaginationBar
            currentPage={page}
            totalPages={4}
            totalItems={38}
            perPage={10}
            onPageChange={setPage}
          />
        </div>
      )}

      {activeTab === 'forms' && (
        <Card title="Komponen Form & Kontrol Sentuh" subtitle="Tinggi kontrol minimum 42px">
          <div className="space-y-3.5">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari siswa, NIP, atau mata pelajaran..."
            />

            <Select
              id="demo-select-role"
              label="Filter Tingkat Kelas"
              value={selectedDemoRole}
              onChange={(e) => setSelectedDemoRole(e.target.value)}
              options={[
                { value: 'all', label: 'Semua Tingkat (X, XI, XII)' },
                { value: '10', label: 'Kelas X (Sepuluh)' },
                { value: '11', label: 'Kelas XI (Sebelas)' },
                { value: '12', label: 'Kelas XII (Dua Belas)' },
              ]}
            />

            <FileUpload
              label="Unggah Bukti Surat / Dokumen Materi"
              accept="image/*,.pdf"
              file={uploadedFile}
              onChange={setUploadedFile}
              hint="Mendukung gambar kamera atau PDF maksimal 10MB"
            />
          </div>
        </Card>
      )}

      {activeTab === 'sheets' && (
        <Card
          title="Pengujian Sheet & Dialog Mobile"
          subtitle="Bottom Sheet, FullScreen Sheet, Password Sheet & Confirm Sheet"
        >
          <div className="grid grid-cols-1 gap-2.5">
            <Button
              variant="primary"
              fullWidth
              onClick={() => setIsBottomSheetOpen(true)}
            >
              Buka BottomSheetModal
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setIsFullScreenOpen(true)}
            >
              Buka FullScreenSheet
            </Button>
            <Button
              variant="outline"
               icon={Lock}
              fullWidth
              onClick={() => setIsPasswordSheetOpen(true)}
            >
              Buka PasswordSheet (Verifikasi Sandi)
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => setIsConfirmSheetOpen(true)}
            >
              Buka ConfirmSheet (Konfirmasi Hapus)
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'feedback' && (
        <div className="space-y-3">
          <EmptyState
            title="Belum Ada Data Ditambahkan"
            description="Contoh tampilan EmptyState standar Exness Precision Fintech pada layar mobile."
            actionLabel="Tambah Data Baru"
            onAction={() => setIsBottomSheetOpen(true)}
          />
          <ErrorState
            title="Contoh Tampilan Gangguan Jaringan"
            message="Komponen ErrorState digunakan saat pemanggilan endpoint API mengalami kendala."
            onRetry={() => {}}
          />
        </div>
      )}

      {/* Interactive Sheets */}
      <BottomSheetModal
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        title="Detail Informasi Rombel"
        subtitle="Contoh komponen BottomSheetModal pada SCP Mobile"
        footer={
          <Button
            variant="primary"
            fullWidth
            onClick={() => setIsBottomSheetOpen(false)}
          >
            Selesai & Tutup
          </Button>
        }
      >
        <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
          <p>
            Komponen <strong>BottomSheetModal</strong> menggantikan modal desktop agar
            mudah dijangkau dengan ibu jari pada perangkat mobile.
          </p>
        </div>
      </BottomSheetModal>

      <FullScreenSheet
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        title="Formulir Layar Penuh"
        subtitle="FullScreenSheet untuk form bertahap / kompleks"
        footer={
          <Button
            variant="primary"
            fullWidth
            onClick={() => setIsFullScreenOpen(false)}
          >
            Simpan & Kembali
          </Button>
        }
      >
        <Card title="Area Konten FullScreenSheet">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Digunakan untuk input Jurnal KBM & Presensi Siswa serta Editor Kuis AI pada
            fase berikutnya.
          </p>
        </Card>
      </FullScreenSheet>

      <PasswordSheet
        isOpen={isPasswordSheetOpen}
        onClose={() => setIsPasswordSheetOpen(false)}
        verifyWithBackend
        onConfirm={() => setIsPasswordSheetOpen(false)}
      />

      <ConfirmSheet
        isOpen={isConfirmSheetOpen}
        onClose={() => setIsConfirmSheetOpen(false)}
        onConfirm={() => setIsConfirmSheetOpen(false)}
        title="Konfirmasi Penghapusan Data"
        message="Tindakan ini akan menghapus item yang dipilih secara permanen. Lanjutkan?"
      />
    </div>
  );
}
