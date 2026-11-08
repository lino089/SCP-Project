import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightCircle,
  RefreshCcw,
  CalendarRange,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Binary,
  FileUp,
  Settings2,
  AlertTriangle,
  CheckCircle,
  Play,
  UploadCloud,
  FileText,
  Camera,
  Eye,
  Timer,
  AlertCircle,
  Sparkles,
  Lock,
  Database,
  Calendar,
  Layers,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/shared/Button';
import Badge from '../../components/shared/Badge';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, getHomeRoute } = useAuth();

  // State untuk demonstrasi interaktif pada dropzone / terminal
  const [terminalStep, setTerminalStep] = useState(3);
  const [activeTabAksara, setActiveTabAksara] = useState('latin'); // 'latin' | 'aksara'

  // Helper untuk scroll halus ke ID seksi
  const scrollToSection = useCallback((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Handler navigasi dinamis berbasis status autentikasi
  const handlePrimaryAction = useCallback(() => {
    if (isAuthenticated) {
      navigate(getHomeRoute());
    } else {
      navigate('/login');
    }
  }, [isAuthenticated, getHomeRoute, navigate]);

  return (
    <div className="landing-page">
      {/* Background Decorative Ambient Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[900px] radial-glow -z-10 pointer-events-none" />
      <div className="absolute top-[25%] -right-24 w-96 h-96 radial-glow-ambient rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* ===================================================================
          SECTION 0: STICKY GLASS NAVIGATION BAR
          =================================================================== */}
      <nav className="glass-nav" aria-label="Navigasi Utama">
        <div className="landing-container glass-nav__inner">
          {/* Logo & Identitas Brand (Murni Teks Plus Jakarta Sans, Tanpa Logo SCP) */}
          <div
            className="landing-nav__brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <span className="landing-nav__brand-name">
              School Class Progress
            </span>
          </div>

          {/* Navigasi Seksi Desktop */}
          <div className="landing-nav__links">
            <button
              type="button"
              className="landing-nav__link"
              onClick={() => scrollToSection('fondasi')}
            >
              Fondasi
            </button>
            <button
              type="button"
              className="landing-nav__link"
              onClick={() => scrollToSection('fitur')}
            >
              Fitur Utama
            </button>
            <button
              type="button"
              className="landing-nav__link"
              onClick={() => scrollToSection('keamanan')}
            >
              Keamanan
            </button>
          </div>

          {/* Tombol Akses Autentikasi */}
          <div className="landing-nav__actions">
            {isAuthenticated ? (
              <>
                <Badge variant="success" dot className="hidden sm:inline-flex">
                  {user?.name || 'Sesi Aktif'}
                </Badge>
                <Button variant="dark" size="sm" onClick={handlePrimaryAction}>
                  Buka Dashboard →
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/login')}
                className="flex items-center gap-1.5 font-semibold"
              >
                <span>Login</span>
                <ArrowRightCircle size={15} />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* ===================================================================
          SECTION 1: HERO SECTION & ELEVATED 3D APP WINDOW PREVIEW
          =================================================================== */}
      <header className="landing-hero">
        <div className="landing-container">
          {/* Headline H1 (Sesuai Permintaan Revisi Terakhir) */}
          <h1 className="landing-hero__title">
            Sistem Informasi KBM &amp; Akademik <span className="landing-hero__title-accent">SMK Negeri 1 Bantul</span>
          </h1>

          {/* Sub-headline Deskriptif (Sesuai Permintaan Revisi Terakhir) */}
          <p className="landing-hero__desc">
            Semua kebutuhan operasional belajar-mengajar kini terhubung dalam satu sistem yang rapi, akurat, dan mudah digunakan oleh seluruh warga sekolah.
          </p>

          {/* Elevated 3D Perspective App Window Frame */}
          <div className="hero-perspective-container">
            <div className="hero-perspective custom-card overflow-hidden bg-slate-50/70 backdrop-blur-xl">
              {/* App Window Header Bar (macOS Dots & Live Sync Badge) */}
              <div className="window-titlebar">
                <div className="flex items-center gap-2">
                  <div className="window-dots">
                    <span className="window-dot bg-rose-400" />
                    <span className="window-dot bg-amber-400" />
                    <span className="window-dot bg-emerald-400" />
                  </div>
                  <div className="window-url-pill ml-3 font-medium">
                    schoolclassprogress.my.id
                  </div>
                </div>

                <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 rounded-md text-emerald-700 text-[11px] font-semibold border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>LIVE SYNC: AKTIF</span>
                </div>
              </div>

              {/* App Internal Content Mockup (Grid 12-Kolom Realistis) */}
              <div className="p-6 text-left">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Sidebar 3-Kolom: Statistik Ringkas SCP */}
                  <div className="md:col-span-3 space-y-4">
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                        Statistik Utama
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1.5 font-medium">
                            <span className="text-slate-600">Matched Jadwal FET</span>
                            <span className="text-emerald-600 font-bold">102 / 102</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-full rounded-full" />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1.5 font-medium">
                            <span className="text-slate-600">Presensi Guru KBM</span>
                            <span className="text-slate-900 font-bold">98.4%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-900 w-[98.4%] rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                        Otoritas Kurikulum
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-800 border border-slate-200 shrink-0">
                          <UserCheck size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Drs. Siswanto</div>
                          <div className="text-[10.5px] text-slate-500">Waka Kurikulum Authed</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Panel 9-Kolom: Tabel KBM Berjalan Riil */}
                  <div className="md:col-span-9">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/80 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Kelas</th>
                              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Mata Pelajaran</th>
                              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Guru Pengampu</th>
                              <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Status KBM</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <tr className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-900">XII RPL 1</td>
                              <td className="px-4 py-3 text-slate-800">Pemrograman Web &amp; Perangkat Bergerak</td>
                              <td className="px-4 py-3 text-slate-600">Bambang S., S.Kom</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10.5px] font-bold border border-emerald-200/60">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  VERIFIED
                                </span>
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-900">XI TKJ 2</td>
                              <td className="px-4 py-3 text-slate-800">Administrasi Infrastruktur Jaringan</td>
                              <td className="px-4 py-3 text-slate-600">Nurul Hidayati, M.Pd</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10.5px] font-bold border border-amber-200/60">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  IN PROGRESS
                                </span>
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-900">X DKV 1</td>
                              <td className="px-4 py-3 text-slate-800">Dasar Desain Komunikasi Visual</td>
                              <td className="px-4 py-3 text-slate-600">Rahmat Hidayat, S.Pd</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10.5px] font-bold">
                                  SCHEDULED
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ===================================================================
          SECTION 2: METRIC STRIP RIBBON (4 PITA KARTU ROUNDED BADGE)
          =================================================================== */}
      <section className="metric-ribbon">
        <div className="landing-container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            <div className="flex items-start gap-3.5">
              <div className="metric-ribbon__icon-box bg-slate-100 text-slate-900">
                <RefreshCcw size={22} />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-base">Putaran 1 &amp; 2</div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Dual-Cycle Sync</div>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="metric-ribbon__icon-box bg-amber-50 text-amber-600">
                <CalendarRange size={22} />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-base">5 Tipe Hari</div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Dynamic Scheduling</div>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="metric-ribbon__icon-box bg-emerald-50 text-emerald-600">
                <Zap size={22} />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-base">Exception-Based</div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Atomic Monitoring</div>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="metric-ribbon__icon-box bg-slate-100 text-slate-700">
                <ShieldCheck size={22} />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-base">Step-Up Auth</div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Level 3 Security</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          SECTION 3: ASYMMETRIC SPLIT — 01 / FONDASI ARSITEKTUR
          =================================================================== */}
      <section id="fondasi" className="py-24 px-6 overflow-hidden">
        <div className="landing-container flex flex-col lg:flex-row gap-16 items-start">
          {/* Kolom Kiri: Sticky Editorial */}
          <div className="lg:w-1/2 lg:sticky lg:top-28 h-fit text-left">
            <span className="section-tag">01 / Fondasi Arsitektur</span>
            <h2 className="font-bold text-3xl md:text-5xl text-slate-900 mb-6 leading-tight">
              Menghilangkan fragmentasi data antara kurikulum, ruang kelas, dan orang tua.
            </h2>
            <p className="text-base text-slate-600 mb-8 leading-relaxed">
              Pengelolaan jadwal manual, rekapitulasi absen di kertas, dan grup pesan terpisah sering kali memicu ketidaksinkronan data operasional sekolah. SCP menyatukan seluruh proses tersebut ke dalam satu arsitektur terpusat untuk SMK Negeri 1 Bantul.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3.5 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                <span className="font-semibold text-sm text-slate-800">Sinkronisasi Izin Guru Otomatis ke Jurnal KBM</span>
              </div>
              <div className="flex items-center gap-3.5 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                <span className="font-semibold text-sm text-slate-800">Pemrosesan Asinkron Queue &amp; Analisis Kuis AI</span>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Engine Pipeline Visualizer (Dark Slate Card) */}
          <div className="lg:w-1/2 w-full text-left">
            <div className="engine-pipeline-card">
              <div className="flex items-center gap-2.5 mb-8">
                <Binary size={20} className="text-amber-400" />
                <h3 className="font-bold text-xl text-white">Cara Kerja Otomatisasi Jadwal</h3>
              </div>

              <div className="space-y-10 relative">
                <div className="engine-pipeline-line" />

                {/* Step 1 */}
                <div className="relative flex items-center gap-6 group">
                  <div className="engine-step-icon bg-slate-800 border border-slate-700 text-white shrink-0">
                    <FileUp size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">1. Unggah PDF Jadwal</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Tinggal masukkan file jadwal mentah dari tim kurikulum tanpa ketik ulang.
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative flex items-center gap-6 group">
                  <div className="engine-step-icon bg-slate-900 border border-amber-400/80 text-amber-400 shrink-0">
                    <Settings2 size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">2. Pembacaan Otomatis</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Sistem membaca tabel jadwal dan mencocokkan nama guru pengampu secara presisi.
                    </div>
                  </div>
                  <div className="ml-auto hidden sm:block shrink-0">
                    <span className="px-2 py-0.5 bg-amber-400/10 text-amber-400 text-[10px] font-bold rounded border border-amber-400/20">
                      PROCESSING
                    </span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative flex items-center gap-6 group">
                  <div className="engine-step-icon bg-slate-800 border border-slate-700 text-white shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">3. Cek Bentrok Ruang &amp; Guru</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Mencegah jadwal bertabrakan antara ruang teori, bengkel/lab, dan jam dinas guru.
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="relative flex items-center gap-6 group">
                  <div className="engine-step-icon bg-emerald-500 border border-emerald-400 text-white shadow-lg shadow-emerald-500/30 shrink-0">
                    <CheckCircle size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">4. Jadwal Siap &amp; Terhubung</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Jadwal langsung aktif dan otomatis masuk ke jurnal mengajar masing-masing guru.
                    </div>
                  </div>
                  <div className="ml-auto shrink-0">
                    <CheckCircle2 size={24} className="text-emerald-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          SECTION 4: DYNAMIC BENTO GRID — 02 / SOLUSI TERPADU SEKOLAH (12-KOLOM)
          =================================================================== */}
      <section id="fitur" className="py-24 bg-slate-50/70 border-t border-slate-200">
        <div className="landing-container text-left">
          <div className="mb-14">
            <span className="section-tag">02 / Solusi Terpadu Sekolah</span>
            <h2 className="font-bold text-3xl md:text-5xl text-slate-900 leading-tight">
              Satu Sistem yang Memudahkan Seluruh Warga Sekolah.
            </h2>
            <p className="text-base text-slate-600 mt-3 max-w-3xl leading-relaxed">
              Mulai dari Waka Kurikulum, Kesiswaan, Guru Pengampu, Wali Kelas, hingga Siswa dan Orang Tua di rumah—semua terhubung dalam alur kegiatan akademik yang rapi dan transparan.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm">
                Waka Kurikulum
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm">
                Kesiswaan
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm">
                Guru Pengampu
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm">
                Wali Kelas
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm">
                Siswa
              </span>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm">
                Orang Tua
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Bento 1: Col 7 — Penyusunan Jadwal Cepat & Bebas Bentrok */}
            <div className="md:col-span-7 custom-card p-7 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-xl md:text-2xl text-slate-900">
                      Penyusunan Jadwal Cepat &amp; Bebas Bentrok
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Untuk: Waka Kurikulum &amp; Guru
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTerminalStep((prev) => (prev >= 3 ? 1 : prev + 1))}
                    title="Jalankan ulang simulasi"
                    className="p-2.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    <Play size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Dropzone Pane */}
                  <div className="bento-dropzone">
                    <UploadCloud size={32} className="text-slate-400 mb-3" />
                    <div className="space-y-2.5 w-full">
                      <div className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <FileText size={18} className="text-rose-500 shrink-0" />
                        <span className="text-[11px] font-semibold text-slate-700 truncate">Jadwal_Pelajaran_Semester_Genap.pdf</span>
                      </div>
                      <div className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 shadow-sm opacity-75">
                        <FileText size={18} className="text-rose-500 shrink-0" />
                        <span className="text-[11px] font-semibold text-slate-700 truncate">Jadwal_Penggunaan_Bengkel_Lab.pdf</span>
                      </div>
                    </div>
                    <p className="text-[10.5px] text-slate-400 mt-3 font-medium">Tinggal pilih berkas jadwal sekolah dari kurikulum</p>
                  </div>

                  {/* Friendly Process Window Pane */}
                  <div className="terminal-window">
                    <div className="terminal-dots">
                      <span className="terminal-dot bg-rose-500/80" />
                      <span className="terminal-dot bg-amber-500/80" />
                      <span className="terminal-dot bg-emerald-500/80" />
                    </div>
                    <div className="space-y-2 text-[11px] leading-relaxed">
                      <div className="text-amber-400">&#9654; Memulai penataan jadwal sekolah...</div>
                      <div className="text-slate-300">&#10003; Membaca 142 jam pelajaran seluruh tingkatan kelas...</div>
                      {terminalStep >= 2 && (
                        <div className="text-slate-300">&#10003; Menghubungkan 78 guru pengampu ke mata pelajaran...</div>
                      )}
                      {terminalStep >= 3 && (
                        <div className="text-emerald-400 font-semibold">&#10003; 0 jadwal bentrok! Jadwal resmi siap digunakan.</div>
                      )}
                      <div className="text-slate-200 font-semibold pt-1">
                        Jadwal langsung aktif di jurnal guru <span className="terminal-cursor" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento 2: Col 5 — Jurnal Mengajar Praktis & Terpantau Orang Tua */}
            <div className="md:col-span-5 custom-card p-7 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-xl md:text-2xl text-slate-900">
                      Jurnal Mengajar Praktis &amp; Terpantau Orang Tua
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Untuk: Guru, Siswa &amp; Orang Tua
                    </span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                </div>

                <div className="space-y-4">
                  {/* Live KBM Item */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                        XII RPL 1
                      </span>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/60">
                        <Camera size={12} />
                        <span>SEDANG BELAJAR DI KELAS</span>
                      </div>
                    </div>

                    <div className="flex gap-3.5 items-center">
                      <div className="w-12 h-12 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0">
                        <Eye size={20} className="text-slate-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          Pemrograman Web &amp; Perangkat Bergerak
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                          <Timer size={13} className="text-slate-400" />
                          <span className="font-bold text-slate-800">Sisa waktu: 01:24:10</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 flex gap-2">
                      <span className="flex-1 py-1 text-center rounded bg-emerald-50 text-emerald-700 text-[10.5px] font-bold border border-emerald-200/60">
                        Hadir: 34
                      </span>
                      <span className="flex-1 py-1 text-center rounded bg-amber-50 text-amber-700 text-[10.5px] font-bold border border-amber-200/60">
                        Izin: 1
                      </span>
                      <span className="flex-1 py-1 text-center rounded bg-rose-50 text-rose-700 text-[10.5px] font-bold border border-rose-200/60">
                        Alfa: 0
                      </span>
                    </div>
                  </div>

                  {/* Progress Ring Indicator */}
                  <div className="flex items-center justify-center pt-2">
                    <div className="relative w-24 h-24 shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="#E2E8F0" strokeWidth="6" fill="transparent" />
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="#0F172A"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray="251.2"
                          strokeDashoffset="25"
                          className="transition-all"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-base font-extrabold text-slate-900">97%</span>
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider text-center px-1">Kehadiran Hari Ini</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento 3: Col 5 — Latihan Soal & Penilaian Berbantuan Cerdas */}
            <div className="md:col-span-5 custom-card p-7 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-xl md:text-2xl text-slate-900">
                      Latihan Soal &amp; Penilaian Berbantuan Cerdas
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Untuk: Guru, Siswa &amp; Wali Kelas
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setActiveTabAksara('latin')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                        activeTabAksara === 'latin' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      Nilai Siswa
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTabAksara('aksara')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                        activeTabAksara === 'aksara' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      Rubrik Jawaban
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jam Belajar Paling Aktif</div>
                      <div className="text-xl font-bold text-slate-900">
                        08:30 <span className="text-xs text-slate-400 font-normal ml-1">WIB</span>
                      </div>
                    </div>
                    <div className="flex gap-3 text-[10px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-900" /> Kelas Teori
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Bengkel / Lab
                      </div>
                    </div>
                  </div>

                  {/* SVG Sparkline Area Chart */}
                  <div className="relative h-28 bg-slate-50 rounded-xl overflow-hidden border border-slate-200/80">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                      <path d="M0 40 L0 35 Q10 20, 20 25 T40 10 T60 22 T80 15 T100 20 L100 40 Z" fill="#0F172A" className="opacity-15" />
                      <path d="M0 40 L0 30 Q10 35, 20 15 T40 5 T60 30 T80 10 T100 25 L100 40 Z" fill="#10B981" className="opacity-20" />
                      <path d="M0 35 Q10 20, 20 25 T40 10 T60 22 T80 15 T100 20" stroke="#0F172A" strokeWidth="1.5" fill="none" />
                      <path d="M0 30 Q10 35, 20 15 T40 5 T60 30 T80 10 T100 25" stroke="#10B981" strokeWidth="1.5" fill="none" />
                    </svg>
                    <div className="absolute bottom-1.5 left-0 right-0 flex justify-between px-3 text-[9px] font-semibold text-slate-400">
                      <span>07:00</span>
                      <span>09:00</span>
                      <span>11:00</span>
                      <span>13:00</span>
                      <span>15:00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento 4: Col 7 — Kelas Tetap Produktif & Surat Izin Teratur */}
            <div className="md:col-span-7 custom-card p-7 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-xl md:text-2xl text-slate-900">
                      Kelas Tetap Produktif &amp; Surat Izin Teratur
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Untuk: Kesiswaan, Wali Kelas &amp; Guru Inval
                    </span>
                  </div>
                  <Badge variant="warning" dot>
                    Kelas Terisi &amp; Siap
                  </Badge>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  {/* Gantt Strip Jam Pelajaran */}
                  <div className="mb-3 text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Calendar size={13} />
                    <span>JADWAL HARIAN: RABU (10 JAM PELAJARAN)</span>
                  </div>
                  <div className="grid grid-cols-10 gap-1.5">
                    <div className="h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10.5px] font-bold text-slate-700">J1</div>
                    <div className="h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10.5px] font-bold text-slate-700">J2</div>
                    <div className="h-11 rounded-lg bg-amber-100 border border-amber-300 flex flex-col items-center justify-center relative">
                      <span className="text-[10px] font-bold text-amber-800">J3</span>
                      <span className="text-[7.5px] text-amber-700 font-semibold">IZIN</span>
                    </div>
                    <div className="h-11 rounded-lg bg-amber-50 border border-amber-300 border-dashed flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-amber-700">J4</span>
                      <span className="px-1 py-0.2 rounded bg-amber-400 text-white text-[7px] font-bold">INVAL</span>
                    </div>
                    <div className="h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10.5px] font-bold text-slate-700">J5</div>
                    <div className="h-11 rounded-lg bg-slate-200/80 border border-slate-300 flex items-center justify-center text-[9.5px] font-semibold text-slate-500">IST</div>
                    <div className="h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10.5px] font-bold text-slate-700">J6</div>
                    <div className="h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10.5px] font-bold text-slate-700">J7</div>
                    <div className="h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10.5px] font-bold text-slate-700">J8</div>
                    <div className="h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10.5px] font-bold text-slate-700">J9</div>
                  </div>

                  {/* Auto Conflict Resolution Card */}
                  <div className="mt-5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-amber-500/20">
                      <AlertCircle size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900">Pengalihan Guru Pengganti (Inval)</div>
                      <div className="text-[10.5px] text-slate-500 truncate">
                        Guru Utama: Izin Dinas &rarr; Guru Inval: Drs. Budi Assign (Materi &amp; Tugas Siap Dikerjakan)
                      </div>
                    </div>
                    <Badge variant="success">Tugas Terisi</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          SECTION 5: KEANDALAN & KEAMANAN SISTEM (ANCHOR #KEAMANAN)
          =================================================================== */}
      <section id="keamanan" className="py-24 border-t border-slate-200 bg-white">
        <div className="landing-container text-left">
          <div className="mb-14">
            <span className="section-tag">03 / Keandalan &amp; Tata Kelola Data</span>
            <h2 className="font-bold text-3xl md:text-5xl text-slate-900 leading-tight">
              Kepatuhan regulasi pendidikan dan perlindungan data akademik terpadu.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="custom-card p-6">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-4">
                <Database size={20} />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Smart Delete 30 Hari</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mekanisme soft delete dengan retensi 30 hari di keranjang sampah sebelum penghapusan permanen.
              </p>
            </div>

            <div className="custom-card p-6">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-4">
                <Lock size={20} />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Google SSO &amp; Step-Up</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dukungan login aman akun belajar sekolah (@smkn1bantul.sch.id) serta verifikasi kata sandi bertingkat.
              </p>
            </div>

            <div className="custom-card p-6">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-4">
                <Layers size={20} />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Retensi Alumni 14 Hari</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pembersihan otomatis data alumni dan perpindahan kelas terstruktur tanpa membebani database utama.
              </p>
            </div>

            <div className="custom-card p-6">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 mb-4">
                <Sparkles size={20} />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">N+1 Query Cache</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Optimasi performa query database dengan eager loading dan indexing komprehensif pada jadwal KBM.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          SECTION 6: STRUCTURED FOOTER (MURNI TEKS BRAND, TANPA LOGO SCP)
          =================================================================== */}
      <footer className="landing-footer">
        <div className="landing-container text-left">
          <div className="landing-footer__grid">
            {/* Kolom 1: Brand & Profil Institusi */}
            <div className="flex flex-col gap-3">
              <span className="font-bold text-slate-900 text-lg">
                School Class Progress
              </span>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                Platform manajemen operasional kelas, jadwal pelajaran dinamis, presensi exception-based,
                dan evaluasi kuis berbantuan AI terintegrasi untuk SMK Negeri 1 Bantul.
              </p>
              <div className="text-[11px] text-slate-400 font-medium">
                Uji Kompetensi Keahlian (UKK) Rekayasa Perangkat Lunak
              </div>
            </div>

            {/* Kolom 2: Modul Operasional */}
            <div>
              <div className="landing-footer__col-title">Modul Sistem</div>
              <ul className="landing-footer__links">
                <li><a className="landing-footer__link" onClick={() => scrollToSection('fitur')}>Jadwal &amp; Import FET PDF</a></li>
                <li><a className="landing-footer__link" onClick={() => scrollToSection('fitur')}>Jurnal &amp; Presensi KBM</a></li>
                <li><a className="landing-footer__link" onClick={() => scrollToSection('fitur')}>Asesmen Kuis AI Gemini</a></li>
                <li><a className="landing-footer__link" onClick={() => scrollToSection('fitur')}>Kalender &amp; Perizinan</a></li>
                <li><a className="landing-footer__link" onClick={() => scrollToSection('keamanan')}>Promosi &amp; Tempat Sampah</a></li>
              </ul>
            </div>

            {/* Kolom 3: Portal Pengguna */}
            <div>
              <div className="landing-footer__col-title">Portal Pengguna</div>
              <ul className="landing-footer__links">
                <li><a className="landing-footer__link" onClick={handlePrimaryAction}>Portal Waka Kurikulum</a></li>
                <li><a className="landing-footer__link" onClick={handlePrimaryAction}>Portal Guru Pengampu</a></li>
                <li><a className="landing-footer__link" onClick={handlePrimaryAction}>Portal Wali Kelas &amp; Inval</a></li>
                <li><a className="landing-footer__link" onClick={handlePrimaryAction}>Portal Tim Kesiswaan / BK</a></li>
                <li><a className="landing-footer__link" onClick={handlePrimaryAction}>Portal Siswa &amp; Orang Tua</a></li>
              </ul>
            </div>

            {/* Kolom 4: Akses Akun */}
            <div>
              <div className="landing-footer__col-title">Akses Akun</div>
              <ul className="landing-footer__links">
                <li><a className="landing-footer__link" onClick={() => navigate('/login')}>Masuk ke Sistem</a></li>
                <li><a className="landing-footer__link" onClick={() => navigate('/forgot-password')}>Pemulihan Kata Sandi</a></li>
                <li><a className="landing-footer__link" onClick={() => navigate('/profile')}>Profil &amp; Tautan Akun</a></li>
                <li><a className="landing-footer__link" onClick={() => scrollToSection('keamanan')}>Kebijakan Keamanan</a></li>
              </ul>
            </div>
          </div>

          {/* Baris Bawah: Hak Cipta & Indikator Sistem */}
          <div className="landing-footer__bottom">
            <span>&copy; 2026 School Class Progress &mdash; SMK Negeri 1 Bantul. Seluruh hak cipta dilindungi.</span>
            <div className="landing-footer__status-badge">
              <span className="status-dot status-dot--success" />
              <span>Headless REST API v4.6 &bull; Asia/Jakarta (WIB)</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
