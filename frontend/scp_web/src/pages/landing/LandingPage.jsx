import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CalendarRange,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  FileUp,
  GraduationCap,
  HeartHandshake,
  KeyRound,
  Lock,
  Menu,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/shared/Button';
import './LandingPage.css';

/* ---------------------------------------------------------------------------
   Angka ringkas sekolah — statis (keputusan D-2), sumber: master data SCP
--------------------------------------------------------------------------- */
const SCHOOL_STATS = [
  { value: '90', label: 'Guru & tenaga pendidik' },
  { value: '1.711', label: 'Siswa aktif' },
  { value: '48', label: 'Rombongan belajar' },
  { value: '721', label: 'Sesi jadwal per putaran' },
];

const ROLES = [
  {
    id: 'guru',
    icon: GraduationCap,
    name: 'Guru',
    desc: 'Jurnal mengajar, presensi kelas, izin, dan kuis.',
    tone: 'success',
  },
  {
    id: 'siswa',
    icon: Users,
    name: 'Siswa',
    desc: 'Jadwal, rekap kehadiran, izin, dan kuis.',
    tone: 'info',
  },
  {
    id: 'orang-tua',
    icon: HeartHandshake,
    name: 'Orang Tua',
    desc: 'Kehadiran anak per jam pelajaran dan hasil kuis.',
    tone: 'warning',
  },
  {
    id: 'pengelola',
    icon: Building2,
    name: 'Pengelola Sekolah',
    desc: 'Jadwal, kalender akademik, izin, dan rekap.',
    tone: 'neutral',
  },
];

const WORKFLOW = [
  {
    title: 'Jadwal disusun',
    desc: 'Waka menyusun jadwal secara manual atau mengimpor dari PDF, lengkap dengan pemeriksaan bentrok ruang dan guru.',
  },
  {
    title: 'Guru mengajar & mencatat',
    desc: 'Presensi, materi, dan foto kegiatan masuk ke satu jurnal saat jam pelajaran selesai.',
  },
  {
    title: 'Siswa & orang tua melihat',
    desc: 'Jadwal, kehadiran, status izin, dan hasil kuis dapat dibuka kapan saja dari HP.',
  },
  {
    title: 'Rekap terbentuk otomatis',
    desc: 'Kehadiran dan jurnal terangkum per kelas dan per siswa, siap diekspor untuk laporan.',
  },
];

const SECURITY_QA = [
  {
    q: 'Siapa yang bisa melihat data anak saya?',
    a: 'Guru hanya melihat kelas yang diampu, Kesiswaan melihat izin dan rekap kehadiran, dan orang tua hanya melihat data anak yang tertaut ke akunnya.',
  },
  {
    q: 'Bagaimana akun dibuat?',
    a: 'Akun dibuat oleh sekolah saat data guru atau siswa dimasukkan. Siswa masuk dengan NIS, guru dengan NIP, dan kata sandi wajib diganti saat login pertama.',
  },
  {
    q: 'Kalau lupa kata sandi?',
    a: 'Pemulihan dilakukan lewat kode OTP yang dikirim ke email atau WhatsApp terdaftar, tanpa perlu menghubungi admin.',
  },
  {
    q: 'Apakah data bisa terhapus permanen?',
    a: 'Penghapusan data master masuk ke tempat sampah selama 30 hari dan masih bisa dipulihkan sebelum benar-benar dihapus.',
  },
];

const FAQ = [
  {
    q: 'Bagaimana cara mendapatkan akun SCP?',
    a: 'Akun tidak dibuat sendiri. Sekolah membuat akun otomatis saat data guru dan siswa dimasukkan, lalu membagikan NIS/NIP beserta kata sandi awal. Jika belum menerima akun, hubungi admin sekolah.',
  },
  {
    q: 'Apakah bisa dibuka dari HP?',
    a: 'Bisa. SCP tersedia sebagai aplikasi Android untuk guru, siswa, dan orang tua, dan juga dapat dibuka langsung lewat browser HP tanpa memasang apa pun.',
  },
  {
    q: 'Apa yang terjadi kalau guru berhalangan hadir?',
    a: 'Guru mengajukan izin, lalu Kesiswaan menunjuk guru pengganti. Guru pengganti mengisi jurnal dan presensi kelas tersebut, sehingga jam pelajaran tetap tercatat.',
  },
  {
    q: 'Apakah orang tua bisa melihat nilai kuis?',
    a: 'Bisa. Halaman monitoring orang tua menampilkan kehadiran per jam pelajaran, riwayat izin, dan capaian hasil kuis anak.',
  },
  {
    q: 'Bagaimana cara mengajukan izin?',
    a: 'Siswa mengajukan izin dari aplikasi — tidak masuk sekolah atau keluar sekolah — dengan lampiran surat berupa JPG, PNG, atau PDF maksimal 2 MB. Status verifikasi dapat dipantau langsung.',
  },
];

/* ---------------------------------------------------------------------------
   Mockup tampilan per peran (HTML/CSS, bukan tangkapan layar — D-9)
--------------------------------------------------------------------------- */
function GuruPreview() {
  return (
    <div className="lp-pane">
      <div className="lp-pane__head">
        <span className="lp-pane__title">Rabu · Jadwal mengajar</span>
        <span className="lp-chip lp-chip--success">Jam ke-3 · 08:55</span>
      </div>

      <div className="lp-pane__card">
        <div className="lp-pane__row">
          <span className="lp-chip">XI TKJ 2</span>
          <span className="lp-pane__strong">Matematika</span>
          <span className="lp-pane__muted">Ruang R-12</span>
        </div>

        <div className="lp-attend">
          <span className="lp-attend__item lp-attend__item--ok">Hadir 34</span>
          <span className="lp-attend__item lp-attend__item--warn">Izin 1</span>
          <span className="lp-attend__item">Alfa 0</span>
        </div>

        <div className="lp-pane__row lp-pane__row--gap">
          <span className="lp-photo">
            <Camera size={15} />
            Foto KBM
          </span>
          <span className="lp-pane__muted lp-pane__muted--wrap">
            Materi: barisan &amp; deret — latihan 3
          </span>
        </div>

        <div className="lp-pane__foot">
          <span className="lp-chip lp-chip--success">
            <Check size={11} /> Jurnal terkirim
          </span>
          <span className="lp-btn lp-btn--dark lp-btn--sm">Selesaikan jurnal</span>
        </div>
      </div>
    </div>
  );
}

function SiswaPreview() {
  return (
    <div className="lp-pane">
      <div className="lp-pane__head">
        <span className="lp-pane__title">Rabu · 4 jam pelajaran</span>
        <span className="lp-chip lp-chip--info">Hadir</span>
      </div>

      <div className="lp-pane__card lp-pane__card--tight">
        <div className="lp-lesson">
          <span className="lp-lesson__time">07:15</span>
          <span className="lp-lesson__name">Pemrograman Web</span>
          <span className="lp-pane__muted">Lab RPL 2</span>
        </div>
        <div className="lp-lesson">
          <span className="lp-lesson__time">08:55</span>
          <span className="lp-lesson__name">Matematika</span>
          <span className="lp-pane__muted">R-12</span>
        </div>
        <div className="lp-lesson">
          <span className="lp-lesson__time">10:40</span>
          <span className="lp-lesson__name">Bahasa Indonesia</span>
          <span className="lp-pane__muted">R-08</span>
        </div>
      </div>

      <div className="lp-pane__foot lp-pane__foot--spread">
        <span className="lp-chip lp-chip--success">Hadir 42</span>
        <span className="lp-chip lp-chip--warning">Izin 2</span>
        <span className="lp-chip">Alfa 0</span>
      </div>
    </div>
  );
}

function OrtuPreview() {
  return (
    <div className="lp-pane">
      <div className="lp-pane__head">
        <span className="lp-pane__title">Nadia P. · XI TKJ 2</span>
        <span className="lp-chip lp-chip--success">Hadir hari ini</span>
      </div>

      <div className="lp-pane__card lp-pane__card--tight">
        <div className="lp-lesson">
          <span className="lp-lesson__time">07:15</span>
          <span className="lp-lesson__name">Upacara</span>
          <span className="lp-pane__muted">Hadir</span>
        </div>
        <div className="lp-lesson">
          <span className="lp-lesson__time">08:55</span>
          <span className="lp-lesson__name">Matematika</span>
          <span className="lp-pane__muted">Hadir</span>
        </div>
        <div className="lp-lesson lp-lesson--warn">
          <span className="lp-lesson__time">10:40</span>
          <span className="lp-lesson__name">Bahasa Indonesia</span>
          <span className="lp-pane__muted">Izin · surat disetujui</span>
        </div>
      </div>

      <div className="lp-pane__foot lp-pane__foot--spread">
        <span className="lp-pane__muted">Rekap bulan ini</span>
        <span className="lp-pane__strong">Hadir 96%</span>
      </div>
    </div>
  );
}

const ROLE_PANES = {
  guru: { label: 'Guru', Component: GuruPreview },
  siswa: { label: 'Siswa', Component: SiswaPreview },
  ortu: { label: 'Orang Tua', Component: OrtuPreview },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, getHomeRoute } = useAuth();

  const [activeRole, setActiveRole] = useState('guru');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const scrollToSection = useCallback((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setIsMenuOpen(false);
  }, []);

  const handlePrimaryAction = useCallback(() => {
    setIsMenuOpen(false);
    navigate(isAuthenticated ? getHomeRoute() : '/login');
  }, [isAuthenticated, getHomeRoute, navigate]);

  // Tutup drawer mobile dengan tombol Escape
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen]);

  const ActivePane = ROLE_PANES[activeRole].Component;

  return (
    <div className="lp">
      {/* ================= S0 — NAVBAR ================= */}
      <header className="lp-nav">
        <div className="lp-container lp-nav__inner">
          <button
            type="button"
            className="lp-nav__brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            School Class Progress
          </button>

          <nav className="lp-nav__links" aria-label="Navigasi utama">
            <button type="button" className="lp-nav__link" onClick={() => scrollToSection('fitur')}>
              Fitur
            </button>
            <button type="button" className="lp-nav__link" onClick={() => scrollToSection('peran')}>
              Peran
            </button>
            <button type="button" className="lp-nav__link" onClick={() => scrollToSection('cara-kerja')}>
              Cara Kerja
            </button>
            <button type="button" className="lp-nav__link" onClick={() => scrollToSection('keamanan')}>
              Keamanan
            </button>
          </nav>

          <div className="lp-nav__actions">
            {isAuthenticated && <span className="lp-nav__user">{user?.name || 'Sesi aktif'}</span>}

            <Button variant="primary" size="sm" icon={ArrowRight} onClick={handlePrimaryAction}>
              {isAuthenticated ? 'Buka Dashboard' : 'Masuk'}
            </Button>

            <button
              type="button"
              className="lp-nav__burger"
              aria-label={isMenuOpen ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={isMenuOpen}
              aria-controls="lp-mobile-menu"
              onClick={() => setIsMenuOpen((prev) => !prev)}
            >
              {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Drawer mobile */}
        <div id="lp-mobile-menu" className="lp-drawer" hidden={!isMenuOpen}>
          <button type="button" className="lp-drawer__link" onClick={() => scrollToSection('fitur')}>
            Fitur
          </button>
          <button type="button" className="lp-drawer__link" onClick={() => scrollToSection('peran')}>
            Peran pengguna
          </button>
          <button type="button" className="lp-drawer__link" onClick={() => scrollToSection('cara-kerja')}>
            Cara kerja
          </button>
          <button type="button" className="lp-drawer__link" onClick={() => scrollToSection('keamanan')}>
            Keamanan &amp; akun
          </button>
          <button type="button" className="lp-drawer__link" onClick={() => scrollToSection('faq')}>
            Pertanyaan umum
          </button>
        </div>
      </header>

      <main>
        {/* ================= S1 — HERO ================= */}
        <section className="lp-hero">
          <div className="lp-container lp-hero__grid">
            <div className="lp-hero__copy">
              <span className="lp-eyebrow">SMK Negeri 1 Bantul · Tahun Ajaran 2025/2026</span>

              <h1 className="lp-hero__title">
                Jurnal, presensi, dan kabar kelas
                <span className="lp-hero__title-accent"> dalam satu sistem.</span>
              </h1>

              <p className="lp-hero__desc">
                Guru mengisi jurnal dalam hitungan detik, siswa melihat jadwal dan status izinnya,
                orang tua tahu anaknya sudah masuk kelas — semuanya dari satu aplikasi.
              </p>

              <div className="lp-hero__actions">
                <Button variant="primary" size="lg" onClick={handlePrimaryAction}>
                  {isAuthenticated ? 'Buka Dashboard' : 'Masuk ke SCP'}
                </Button>
                <button
                  type="button"
                  className="lp-btn lp-btn--outline lp-btn--lg"
                  onClick={() => scrollToSection('fitur')}
                >
                  Lihat fitur
                  <ArrowDown size={15} />
                </button>
              </div>

              <ul className="lp-hero__notes">
                <li>
                  <Smartphone size={14} />
                  Tersedia aplikasi Android — atau buka langsung dari browser HP
                </li>
                <li>
                  <KeyRound size={14} />
                  Akun dibuat oleh sekolah · masuk dengan NIS/NIP atau akun Google
                </li>
              </ul>
            </div>

            <div className="lp-hero__preview">
              <div className="lp-window">
                <div className="lp-window__bar">
                  <span className="lp-window__dots">
                    <i /> <i /> <i />
                  </span>
                  <span className="lp-window__url">schoolclassprogress.my.id</span>
                </div>

                <div className="lp-tabs" role="tablist" aria-label="Tampilan per peran">
                  {Object.entries(ROLE_PANES).map(([key, { label }]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={activeRole === key}
                      className={`lp-tab ${activeRole === key ? 'lp-tab--active' : ''}`}
                      onClick={() => setActiveRole(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="lp-window__body" role="tabpanel">
                  <ActivePane />
                </div>
              </div>
            </div>
          </div>

          <div className="lp-container">
            <div className="lp-stats">
              {SCHOOL_STATS.map((stat) => (
                <div key={stat.label} className="lp-stats__item">
                  <span className="lp-stats__value">{stat.value}</span>
                  <span className="lp-stats__label">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= S2 — PERAN ================= */}
        <section id="peran" className="lp-section lp-section--roles">
          <div className="lp-container">
            <div className="lp-section__head">
              <span className="lp-eyebrow">Siapa yang memakai SCP</span>
              <h2 className="lp-section__title">Satu sistem, empat pengguna.</h2>
              <p className="lp-section__desc">
                Setiap peran melihat hal yang berbeda sesuai kebutuhannya — tanpa harus bertanya
                lewat grup pesan.
              </p>
            </div>

            <div id="fitur" className="lp-roles">
              {ROLES.map(({ id, icon: Icon, name, desc, tone }) => (
                <button key={id} type="button" className="lp-role" onClick={() => scrollToSection(id)}>
                  <span className={`lp-role__icon lp-role__icon--${tone}`}>
                    <Icon size={17} />
                  </span>
                  <span className="lp-role__name">{name}</span>
                  <span className="lp-role__desc">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ================= 01 — GURU ================= */}
        <section id="guru" className="lp-section lp-section--guru">
          <div className="lp-container lp-split">
            <div className="lp-split__copy">
              <span className="lp-eyebrow lp-eyebrow--onDark">01 / Guru</span>
              <h2 className="lp-section__title lp-section__title--onDark">
                Kelas selesai, jurnal ikut selesai.
              </h2>
              <p className="lp-section__desc lp-section__desc--onDark">
                Buka kelas dari jadwal hari ini, tandai hanya siswa yang tidak hadir, unggah satu
                foto kegiatan — jurnal dan presensi langsung tercatat.
              </p>

              <ol className="lp-steps">
                <li className="lp-step">
                  <span className="lp-step__num">1</span>
                  <div>
                    <strong>Buka kelas dari jadwal hari ini</strong>
                    <p>Jam, ruang, dan daftar siswa sudah terisi otomatis.</p>
                  </div>
                </li>
                <li className="lp-step">
                  <span className="lp-step__num">2</span>
                  <div>
                    <strong>Tandai yang tidak hadir saja</strong>
                    <p>Sisanya otomatis Hadir, dan izin yang sudah disetujui ikut terisi.</p>
                  </div>
                </li>
                <li className="lp-step">
                  <span className="lp-step__num">3</span>
                  <div>
                    <strong>Unggah foto KBM, selesai</strong>
                    <p>Jurnal tersimpan dan langsung masuk rekap kehadiran.</p>
                  </div>
                </li>
              </ol>

              <p className="lp-links">
                <CalendarRange size={14} />
                Guru berhalangan? Ajukan izin, jam pelajaran dialihkan ke guru pengganti.
              </p>
            </div>

            <div className="lp-split__visual">
              <div className="lp-window lp-window--flat">
                <div className="lp-window__bar">
                  <span className="lp-window__dots">
                    <i /> <i /> <i />
                  </span>
                  <span className="lp-window__url">Jurnal mengajar</span>
                </div>
                <div className="lp-window__body">
                  <GuruPreview />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 02 — SISWA ================= */}
        <section id="siswa" className="lp-section">
          <div className="lp-container lp-split lp-split--reverse">
            <div className="lp-split__visual lp-split__visual--phone">
              <div className="lp-phone">
                <span className="lp-phone__notch" />
                <div className="lp-phone__screen">
                  <div className="lp-phone__head">
                    <span className="lp-phone__day">Rabu, 12 November</span>
                    <span className="lp-chip lp-chip--info">Hadir</span>
                  </div>

                  <div className="lp-phone__block">
                    <span className="lp-phone__label">Jadwal hari ini</span>
                    <div className="lp-lesson">
                      <span className="lp-lesson__time">07:15</span>
                      <span className="lp-lesson__name">Pemrograman Web</span>
                    </div>
                    <div className="lp-lesson">
                      <span className="lp-lesson__time">08:55</span>
                      <span className="lp-lesson__name">Matematika</span>
                    </div>
                    <div className="lp-lesson">
                      <span className="lp-lesson__time">10:40</span>
                      <span className="lp-lesson__name">Bahasa Indonesia</span>
                    </div>
                  </div>

                  <div className="lp-phone__block">
                    <span className="lp-phone__label">Rekap kehadiran</span>
                    <div className="lp-phone__chips">
                      <span className="lp-chip lp-chip--success">Hadir 42</span>
                      <span className="lp-chip lp-chip--warning">Izin 2</span>
                      <span className="lp-chip">Alfa 0</span>
                    </div>
                  </div>

                  <div className="lp-phone__actions">
                    <span className="lp-btn lp-btn--outline lp-btn--sm">
                      <FileText size={13} /> Ajukan izin
                    </span>
                    <span className="lp-btn lp-btn--dark lp-btn--sm">Kuis · 1 aktif</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-split__copy">
              <span className="lp-eyebrow">02 / Siswa</span>
              <h2 className="lp-section__title">Jadwal, izin, dan nilai di satu tempat.</h2>
              <p className="lp-section__desc">
                Tidak perlu lagi foto jadwal di papan pengumuman atau menanyakan tugas ke teman.
              </p>

              <ul className="lp-benefits">
                <li>
                  <Calendar size={16} />
                  <div>
                    <strong>Jadwal hari ini dan pekan ini</strong>
                    <p>Termasuk upacara Senin dan jam Jumat yang lebih singkat.</p>
                  </div>
                </li>
                <li>
                  <ClipboardCheck size={16} />
                  <div>
                    <strong>Rekap kehadiran sendiri</strong>
                    <p>Hadir, sakit, izin, dan alfa per sesi pembelajaran.</p>
                  </div>
                </li>
                <li>
                  <FileText size={16} />
                  <div>
                    <strong>Ajukan izin dengan lampiran surat</strong>
                    <p>Unggah JPG, PNG, atau PDF, lalu pantau status verifikasinya.</p>
                  </div>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <div>
                    <strong>Kerjakan kuis dan lihat hasilnya</strong>
                    <p>Skor dan evaluasi jawaban muncul setelah dinilai guru.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ================= 03 — ORANG TUA ================= */}
        <section id="orang-tua" className="lp-section lp-section--parents">
          <div className="lp-container">
            <div className="lp-section__head">
              <span className="lp-eyebrow">03 / Orang Tua</span>
              <h2 className="lp-section__title">Tahu anak sudah masuk kelas, tanpa harus bertanya.</h2>
              <p className="lp-section__desc">
                Kehadiran tercatat per jam pelajaran, bukan hanya per hari — lengkap dengan riwayat
                izin dan capaian kuis.
              </p>
            </div>

            <div className="lp-timeline" aria-label="Contoh kehadiran harian">
              <div className="lp-timeline__node lp-timeline__node--ok">
                <span className="lp-timeline__dot">
                  <Check size={10} />
                </span>
                <span className="lp-timeline__time">07:15</span>
                <span className="lp-timeline__label">Hadir · Upacara</span>
              </div>
              <div className="lp-timeline__node lp-timeline__node--ok">
                <span className="lp-timeline__dot">
                  <Check size={10} />
                </span>
                <span className="lp-timeline__time">08:55</span>
                <span className="lp-timeline__label">Hadir · Matematika</span>
              </div>
              <div className="lp-timeline__node lp-timeline__node--warn">
                <span className="lp-timeline__dot">i</span>
                <span className="lp-timeline__time">10:40</span>
                <span className="lp-timeline__label">Izin · Surat disetujui</span>
              </div>
              <div className="lp-timeline__node lp-timeline__node--ok">
                <span className="lp-timeline__dot">
                  <Check size={10} />
                </span>
                <span className="lp-timeline__time">13:00</span>
                <span className="lp-timeline__label">Hadir · Produktif</span>
              </div>
            </div>

            <div className="lp-parents__notes">
              <div>
                <strong>Riwayat kehadiran per sesi</strong>
                <p>Bukan hanya “masuk” atau “tidak masuk”, tetapi per jam pelajaran.</p>
              </div>
              <div>
                <strong>Riwayat izin dan surat</strong>
                <p>Status verifikasi Kesiswaan terlihat, termasuk lampiran suratnya.</p>
              </div>
              <div>
                <strong>Capaian hasil kuis</strong>
                <p>Nilai dan evaluasi anak dapat dibuka dari akun orang tua yang tertaut.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 04 — PENGELOLA SEKOLAH ================= */}
        <section id="pengelola" className="lp-section lp-section--admin">
          <div className="lp-container">
            <div className="lp-section__head lp-section__head--inline">
              <div>
                <span className="lp-eyebrow">04 / Pengelola Sekolah</span>
                <h2 className="lp-section__title lp-section__title--sm">
                  Untuk Waka Kurikulum dan Kesiswaan.
                </h2>
              </div>
              <p className="lp-section__desc lp-section__desc--right">
                Pengelolaan jadwal dan ketertiban administrasi tetap di satu tempat — cukup dibuka
                saat dibutuhkan.
              </p>
            </div>

            <div className="lp-admin">
              <div className="lp-admin__item">
                <FileUp size={17} />
                <div>
                  <strong>Import jadwal dari PDF</strong>
                  <p>Sekali unggah, bentrok ruang dan guru diperiksa otomatis.</p>
                </div>
              </div>
              <div className="lp-admin__item">
                <CalendarRange size={17} />
                <div>
                  <strong>Kalender akademik</strong>
                  <p>Libur, kegiatan sekolah, dan masa ujian dalam satu kalender.</p>
                </div>
              </div>
              <div className="lp-admin__item">
                <UserCheck size={17} />
                <div>
                  <strong>Verifikasi izin &amp; rekap</strong>
                  <p>Setujui surat izin dan unduh rekap kehadiran per kelas.</p>
                </div>
              </div>
              <div className="lp-admin__item">
                <BarChart3 size={17} />
                <div>
                  <strong>Kenaikan kelas &amp; kelulusan</strong>
                  <p>Proses akhir tahun tanpa rekap manual di kertas.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= S7 — CARA KERJA ================= */}
        <section id="cara-kerja" className="lp-section lp-section--workflow">
          <div className="lp-container">
            <div className="lp-section__head">
              <span className="lp-eyebrow">Cara kerja</span>
              <h2 className="lp-section__title">Empat langkah, dari jadwal sampai laporan.</h2>
            </div>

            <ol className="lp-workflow">
              {WORKFLOW.map((step, index) => (
                <li key={step.title} className="lp-workflow__step">
                  <span className="lp-workflow__num">{index + 1}</span>
                  <strong>{step.title}</strong>
                  <p>{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ================= S8 — KEAMANAN ================= */}
        <section id="keamanan" className="lp-section lp-section--security">
          <div className="lp-container lp-security">
            <div className="lp-security__copy">
              <span className="lp-eyebrow">Keamanan &amp; akun</span>
              <h2 className="lp-section__title">Data sekolah, aksesnya terbatas.</h2>

              <div className="lp-qa">
                {SECURITY_QA.map((item) => (
                  <div key={item.q} className="lp-qa__item">
                    <span className="lp-qa__icon">
                      <ShieldCheck size={14} />
                    </span>
                    <div>
                      <strong>{item.q}</strong>
                      <p>{item.a}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="lp-account">
              <span className="lp-account__icon">
                <Lock size={18} />
              </span>
              <h3>Akun Anda</h3>
              <ul className="lp-account__list">
                <li>
                  <Check size={14} /> Dibuat oleh sekolah, tanpa pendaftaran mandiri
                </li>
                <li>
                  <Check size={14} /> Masuk dengan NIS/NIP atau akun Google
                </li>
                <li>
                  <Check size={14} /> Pemulihan kata sandi lewat OTP email/WhatsApp
                </li>
                <li>
                  <Check size={14} /> Konfirmasi kata sandi untuk aksi sensitif
                </li>
              </ul>
              <Button variant="primary" size="md" fullWidth onClick={handlePrimaryAction}>
                {isAuthenticated ? 'Buka Dashboard' : 'Masuk ke SCP'}
              </Button>
              <button
                type="button"
                className="lp-account__link"
                onClick={() => navigate('/forgot-password')}
              >
                Lupa kata sandi?
              </button>
            </aside>
          </div>
        </section>

        {/* ================= S9 — FAQ ================= */}
        <section id="faq" className="lp-section lp-section--faq">
          <div className="lp-container lp-faq">
            <div className="lp-section__head">
              <span className="lp-eyebrow">Pertanyaan umum</span>
              <h2 className="lp-section__title lp-section__title--sm">
                Hal yang paling sering ditanyakan.
              </h2>
            </div>

            <div className="lp-accordion">
              {FAQ.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={item.q}
                    className={`lp-accordion__item ${isOpen ? 'lp-accordion__item--open' : ''}`}
                  >
                    <button
                      type="button"
                      className="lp-accordion__trigger"
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${index}`}
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                    >
                      <span>{item.q}</span>
                      <ChevronDown size={16} className="lp-accordion__chevron" />
                    </button>
                    {isOpen && (
                      <div id={`faq-panel-${index}`} className="lp-accordion__panel">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================= S10 — CTA PENUTUP ================= */}
        <section className="lp-section lp-section--cta">
          <div className="lp-container">
            <div className="lp-cta">
              <div>
                <h2 className="lp-cta__title">Siap masuk ke SCP?</h2>
                <p className="lp-cta__desc">
                  Gunakan NIS/NIP dan kata sandi dari sekolah. Belum punya akun? Hubungi admin
                  sekolah untuk dibuatkan.
                </p>
              </div>
              <Button variant="primary" size="lg" onClick={handlePrimaryAction}>
                {isAuthenticated ? 'Buka Dashboard' : 'Masuk ke SCP'}
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ================= S11 — FOOTER ================= */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer__grid">
          <div className="lp-footer__brand">
            <span className="lp-footer__name">School Class Progress</span>
            <p>
              Sistem informasi KBM dan akademik SMK Negeri 1 Bantul: jadwal, jurnal mengajar,
              presensi, perizinan, kuis, dan pemantauan orang tua.
            </p>
            <span className="lp-footer__note">Dikembangkan untuk UKK Rekayasa Perangkat Lunak</span>
          </div>

          <div>
            <div className="lp-footer__title">Fitur</div>
            <ul className="lp-footer__links">
              <li>
                <button type="button" onClick={() => scrollToSection('guru')}>
                  Jurnal &amp; presensi guru
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection('siswa')}>
                  Jadwal &amp; izin siswa
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection('orang-tua')}>
                  Pemantauan orang tua
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection('pengelola')}>
                  Jadwal &amp; kalender sekolah
                </button>
              </li>
            </ul>
          </div>

          <div>
            <div className="lp-footer__title">Untuk Peran</div>
            <ul className="lp-footer__links">
              <li>
                <button type="button" onClick={() => scrollToSection('guru')}>
                  Guru
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection('siswa')}>
                  Siswa
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection('orang-tua')}>
                  Orang Tua
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection('pengelola')}>
                  Waka &amp; Kesiswaan
                </button>
              </li>
            </ul>
          </div>

          <div>
            <div className="lp-footer__title">Akun</div>
            <ul className="lp-footer__links">
              <li>
                <button type="button" onClick={handlePrimaryAction}>
                  Masuk ke sistem
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/forgot-password')}>
                  Lupa kata sandi
                </button>
              </li>
              <li>
                <button type="button" onClick={() => scrollToSection('faq')}>
                  Pertanyaan umum
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="lp-container lp-footer__bottom">
          <span>&copy; 2026 School Class Progress — SMK Negeri 1 Bantul</span>
          <span className="lp-footer__status">
            <span className="status-dot status-dot--success" />
            Asia/Jakarta (WIB)
          </span>
        </div>
      </footer>
    </div>
  );
}
