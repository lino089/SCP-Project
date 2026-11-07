# Dokumentasi Pengembangan — SCP Mobile (`frontend/scp_mobile`)

Dokumen ini merangkum arsitektur teknis, fondasi desain, struktur direktori, konfigurasi layanan API, sistem autentikasi & routing, implementasi modul profil & keamanan, pustaka komponen UI mobile, kalender akademik & komponen jadwal KBM, serta laporan pengujian untuk **School Class Progress (SCP) Mobile**.

---

## 1. Teknologi yang Digunakan (Tech Stack)

Aplikasi `scp_mobile` dibangun menggunakan stack modern yang selaras dengan website (`scp_web`) dan mematuhi master plan:

| Kategori | Teknologi | Versi | Keterangan |
| :--- | :--- | :--- | :--- |
| **Core UI Library** | React & React DOM | `^19.2.8` | Mendukung React 19 concurrent rendering & hooks modern |
| **Build Tool & Bundler** | Vite | `^8.3.0` | Konfigurasi dev server cepat (`port: 5174`) & optimasi bundle produksi |
| **Styling Engine** | Tailwind CSS v4 + CSS Tokens | `^4.3.3` | Menggunakan `@tailwindcss/vite` + variabel CSS *Exness Precision Fintech* |
| **Client-Side Routing** | React Router DOM | `^7.18.4` | Mendukung nested layout routes, auth guards, dan proteksi role/assignment |
| **HTTP Client** | Axios | `^1.20.0` | Dilengkapi interceptor Bearer token (`scp_token`) dan standardized error unwrapping |
| **SSO Authentication** | Google Identity Services (GIS) | SDK Client | Login & linking akun Google resmi via JWT ID Token |
| **Iconography** | Lucide React | `^0.511.0` | Ikon konsisten (`strokeWidth: 1.75`) dengan identitas visual website |
| **Spreadsheet Export** | SheetJS (`xlsx`) | `^0.18.5` | Mendukung fitur ekspor laporan `.xlsx` pada halaman Monitoring Mobile |
| **Code Quality** | ESLint 9 (Flat Config) | `^9.39.4` | Validasi statis kode React Hooks dan React Refresh |

---

## 2. Struktur Direktori Terkini (`frontend/scp_mobile/`)

```text
frontend/scp_mobile/
├── public/
│   ├── favicon.svg                 # Ikon vektor identitas SCP (Slate-900 & Exness Yellow)
│   └── manifest.json               # Web App Manifest untuk instalasi PWA / Add to Home Screen
├── src/
│   ├── components/
│   │   ├── calendar/               # [FASE 3] Komponen kalender akademik mobile
│   │   │   ├── AcademicEventDetailSheet.jsx # Bottom sheet rincian agenda
│   │   │   ├── MobileCalendarView.jsx/.css  # Grid bulanan mobile & status KBM guru
│   │   │   ├── UpcomingEventsList.jsx/.css  # Daftar kartu agenda vertikal
│   │   │   └── index.js
│   │   ├── feedback/               # Komponen umpan balik status & error handling
│   │   │   ├── EmptyState.jsx/.css
│   │   │   ├── ErrorBoundary.jsx/.css
│   │   │   ├── ErrorState.jsx/.css
│   │   │   ├── ForbiddenState.jsx/.css
│   │   │   ├── LoadingOverlay.jsx/.css
│   │   │   ├── SkeletonCard.jsx
│   │   │   └── index.js
│   │   ├── layout/                 # Shell navigasi khusus perangkat mobile
│   │   │   ├── MobileBottomNav.jsx/.css
│   │   │   ├── MobileLayout.jsx/.css
│   │   │   ├── MobileMoreDrawer.jsx/.css
│   │   │   ├── MobileTopBar.jsx/.css
│   │   │   └── index.js
│   │   ├── schedule/               # [FASE 3] Komponen jadwal KBM reusable mobile
│   │   │   ├── MobileScheduleTimeline.jsx/.css # Timeline vertikal harian (Sen-Jum)
│   │   │   ├── ScheduleMatrixCompact.jsx/.css  # Matriks mingguan 5-hari horizontal scroll
│   │   │   └── index.js
│   │   └── shared/                 # Komponen UI reusable berorientasi sentuh (touch-first)
│   │       ├── Badge.jsx/.css
│   │       ├── BottomSheetModal.jsx/.css
│   │       ├── Button.jsx/.css
│   │       ├── Card.jsx/.css
│   │       ├── ConfirmSheet.jsx/.css
│   │       ├── ExportButton.jsx/.css
│   │       ├── FileUpload.jsx/.css
│   │       ├── FilterSheet.jsx
│   │       ├── FullScreenSheet.jsx/.css
│   │       ├── Input.jsx/.css
│   │       ├── MobileRecordCard.jsx/.css
│   │       ├── PaginationBar.jsx/.css
│   │       ├── PasswordSheet.jsx/.css
│   │       ├── ProgressBar.jsx/.css
│   │       ├── SearchInput.jsx/.css
│   │       ├── SegmentedTabs.jsx/.css
│   │       ├── Select.jsx/.css
│   │       ├── StatCard.jsx/.css
│   │       └── index.js
│   ├── context/                    # State global autentikasi & otorisasi role
│   │   ├── authConstants.js
│   │   ├── authContextInstance.js
│   │   └── AuthContext.jsx
│   ├── hooks/                      # Custom React Hooks
│   │   ├── useAuth.js
│   │   ├── useDebounce.js
│   │   └── useGoogleAuth.js
│   ├── pages/                      # Halaman UI Modul Mobile
│   │   ├── auth/                   # [FASE 2]
│   │   │   ├── ChangePasswordPage.jsx
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   └── LoginPage.jsx
│   │   ├── parent/                 # [FASE 3]
│   │   │   └── ParentCalendarPage.jsx  # Kalender akademik & agenda anak orang tua
│   │   ├── profile/                # [FASE 2]
│   │   │   └── ProfilePage.jsx
│   │   ├── student/                # [FASE 3]
│   │   │   └── StudentCalendarPage.jsx # Kalender akademik terlingkup kelas siswa
│   │   └── teacher/                # [FASE 3]
│   │       └── TeacherCalendarPage.jsx # Kalender akademik & dampak KBM guru
│   ├── routes/                     # Konfigurasi routing & route guards
│   │   ├── AppRouter.jsx
│   │   ├── Phase1RouteShell.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── PublicRoute.jsx
│   │   └── RoleRoute.jsx
│   ├── services/                   # Komunikasi REST API ke Backend Laravel
│   │   ├── academicEventApi.js     # [FASE 3 Diperbarui]
│   │   ├── api.js                  # Axios core instance + authApi
│   │   ├── forgotPasswordApi.js
│   │   ├── journalApi.js
│   │   ├── leaveApi.js
│   │   ├── masterDataApi.js
│   │   ├── quizApi.js
│   │   └── scheduleApi.js          # [FASE 3 Diperbarui]
│   ├── styles/                     # Design system tokens & global styles
│   │   ├── global.css
│   │   └── tokens.css
│   ├── utils/                      # Fungsi utilitas murni
│   │   ├── cn.js
│   │   ├── formatters.js
│   │   ├── imageCompressor.js
│   │   ├── prerequisiteHelper.js
│   │   └── timetableHelper.js      # [FASE 3 Diperbarui]
│   ├── App.jsx
│   └── main.jsx
├── .env
├── .env.example
├── .gitignore
├── DEVELOPMENT.md
├── eslint.config.js
├── index.html
├── package.json
└── vite.config.js
```

---

## 3. Konfigurasi Environment (`.env`)

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_STORAGE_BASE_URL=https://xwawwxwfkaexcwrbegzx.supabase.co/storage/v1/object/public/scp-storage
VITE_GOOGLE_CLIENT_ID=517786684277-4fh8cd7pg4rpk3r3daned77ksj5pgpu1.apps.googleusercontent.com
```

---

## 4. Implementasi Fase 2: Autentikasi, Keamanan Sesi, & Profil

- **LoginPage.jsx (`/login`):** Login kredensial reguler dan Google GIS SSO dengan validasi role dan deteksi `must_change_password`.
- **ForgotPasswordPage.jsx (`/forgot-password`):** Alur pemulihan kata sandi 4-tahap (Cek Identitas, Kirim OTP Email, Verifikasi OTP, Reset Password).
- **ChangePasswordPage.jsx (`/change-password`):** Shell mandiri wajib ganti kata sandi tanpa navigasi aplikasi.
- **ProfilePage.jsx (`/profile`):** Identitas lengkap, verifikasi OTP email, verifikasi OTP WhatsApp, Google Account Linking/Unlinking via Step-Up Auth (`PasswordSheet`), ubah kata sandi, dan logout via `ConfirmSheet`.

---

## 5. Implementasi Fase 3: Shared Kalender Akademik & Komponen Jadwal Mobile

### A. Komponen Bersama Kalender Akademik (`src/components/calendar/`)

1. **`MobileCalendarView.jsx` & `MobileCalendarView.css`:**
   - Tampilan kalender grid bulanan 7 kolom (`Sen - Min`) yang dioptimalkan untuk sentuhan mobile (touch target minimal `44x44px`).
   - Navigasi bulan (Sebelumnya / Selanjutnya) dan tombol cepat "Hari Ini" (`JetBrains Mono`).
   - Sorotan visual tanggal hari ini (`#FFDE00` Exness Gold) dan tanggal terpilih (`#0F172A` Slate Dark).
   - Indikator penanda titik (*dot markers*) warna berdasarkan tipe agenda:
     - Merah (`#EF4444`): Libur Resmi (`holiday`).
     - Amber (`#F59E0B`): Kegiatan Sekolah (`school_event`).
     - Ungu (`#8B5CF6`): Kegiatan Khusus (`class_event`).
     - Biru (`#3B82F6`): Masa Ujian / Asesmen (`exam`).
   - Penanda status mengajar guru harian (*teacher teaching status badge*):
     - `Bebas KBM`: Indikator hijau (`#D1FAE5`).
     - `KBM Parsial`: Indikator amber (`#FEF3C7`).
   - Bar keterangan warna (*legend bar*) di bagian bawah grid.

2. **`UpcomingEventsList.jsx` & `UpcomingEventsList.css`:**
   - Kartu vertikal daftar agenda kegiatan kronologis.
   - Menampilkan tanggal Bahasa Indonesia (`Senin, 10 Nov 2026` atau rentang tanggal), judul agenda, tipe agenda, dan cakupan (Seluruh Sekolah, Tingkat, Rombel).
   - Penanda status KBM: `KBM Ditiadakan` (badge merah) vs `KBM Normal` (badge hijau).
   - Badge khusus Guru: Menampilkan peringatan bila agenda berdampak pada jadwal mengajar (`affects_my_teaching`) beserta daftar rombel terkait (`affected_my_classes`).
   - Badge khusus Orang Tua: Menampilkan tag nama anak yang tercakup dalam agenda (`applicable_children`).
   - State interaktif: Filter tanggal spesifik dengan banner reset, skeleton loading, dan empty state ramah pengguna.

3. **`AcademicEventDetailSheet.jsx`:**
   - Bottom sheet dialog berbasis `BottomSheetModal` untuk menampilkan rincian komprehensif agenda kalender:
     - Badge kategori agenda dan status KBM reguler.
     - Banner keterangan dampak KBM (ditiadakan / berjalan normal).
     - Panduan kehadiran (*attendance guidance*).
     - Rentang tanggal dan jam pelaksanaan riil (format WIB).
     - Target cakupan (Sekolah, Tingkat, Rombel).
     - Informasi pembuat agenda (Waka Kurikulum).
     - Penjelasan dampak mengajar bagi Guru dan relevansi anak bagi Orang Tua.

### B. Komponen Bersama Jadwal Pelajaran (`src/components/schedule/`)

1. **`MobileScheduleTimeline.jsx` & `MobileScheduleTimeline.css`:**
   - Timeline vertikal harian dengan tab bar 5 hari sekolah: `Sen | Sel | Rab | Kam | Jum`.
   - Default otomatis ke hari aktif berjalan (Senin-Jumat) atau Senin bila diakses saat akhir pekan (Sabtu/Minggu).
   - Indikator "Hari Ini" pada tab aktif.
   - Banner Pembiasaan Pagi / Upacara pukul 07:00 WIB:
     - Senin Upacara: `07:00 - 08:00 WIB Upacara Bendera (KBM Mulai 08:00 WIB)`.
     - Selasa: `07:00 - 07:30 WIB Gerakan Literasi Sekolah (KBM Mulai 07:30 WIB)`.
     - Rabu - Jumat: `07:00 - 07:15 WIB Tadarus & Pembiasaan Karakter (KBM Mulai 07:15 WIB)`.
   - Resolusi dinamis slot KBM K1 s/d K10 (K1 s/d K8 pada hari Jumat) menggunakan data `period_templates` backend dengan fallback tabel resmi SMKN 1 Bantul.
   - Penggabungan blok multi-JP pelajaran bersambung (tidak berulang per JP).
   - Banner waktu istirahat resmi:
     - Istirahat I (setelah JP 3, durasi 15 menit).
     - Istirahat II (Ishoma / Sholat Jumat setelah JP 6).
   - Kartu sesi pelajaran: Nama mapel, kelas (untuk Guru), guru pengampu (untuk Siswa/Ortu/Waka), rentang jam riil monospace, durasi JP, ruang kelas, dan badge bentrok jika terdeteksi konflik.
   - Slot kosong / jam bebas dengan penanda jelas.
   - Banner perkiraan jam pulang KBM aktual per hari.

2. **`ScheduleMatrixCompact.jsx` & `ScheduleMatrixCompact.css`:**
   - Tampilan matriks 5-hari horizontal scrollable tanpa menyebabkan overflow horizontal pada tingkat halaman window.
   - Kolom kiri *sticky* untuk nomor JP dan jam riil.
   - Pemetaan sel KBM per hari dengan dukungan multi-JP rowSpan dan baris istirahat lintas kolom.

### C. Halaman Kalender Berbasis Role

1. **`TeacherCalendarPage.jsx` (`/teacher/calendar`):**
   - Terintegrasi dengan endpoint `GET /api/academic-events/my-calendar`.
   - Kartu KPI: Total Agenda, Hari Libur, Kegiatan Khusus, dan Agenda Berdampak KBM.
   - Filter cepat: Mode Kalender vs Mode Daftar, Toggle "Dampak KBM" (`only_affects_my_teaching`), dan filter chip tipe agenda.
   - Menampilkan status mengajar harian guru (*Bebas KBM / KBM Parsial*).
   - Rincian agenda melalui `AcademicEventDetailSheet`.

2. **`StudentCalendarPage.jsx` (`/student/calendar`):**
   - Terintegrasi dengan `GET /api/academic-events/my-calendar` terlingkup rombel kelas siswa.
   - Header profil siswa: Nama kelas aktif dan NIS.
   - Kartu KPI: Total Agenda, Hari Libur, Kegiatan Rombel, dan Ujian/Asesmen.
   - Mode Kalender & Mode Daftar dengan filter tipe agenda.

3. **`ParentCalendarPage.jsx` (`/parent/calendar`):**
   - Terintegrasi dengan `GET /api/academic-events/my-calendar` untuk akun orang tua.
   - Selektor multi-anak: Menampilkan pilihan "Semua Anak" atau memfilter agenda khusus per anak (`child_id`).
   - Kartu KPI terpadu agenda akademik seluruh anak.
   - Chip penanda anak yang relevan pada setiap kartu kegiatan.

---

## 6. Ringkasan Endpoint API Terintegrasi

| Endpoint | Method | Keterangan | Status Integrasi |
| :--- | :--- | :--- | :--- |
| `/api/login` | `POST` | Login reguler dengan username/nis_nip, password, device_name | Terintegrasi & Teruji |
| `/api/auth/google` | `POST` | Login SSO dengan Google ID Token | Terintegrasi |
| `/api/me` | `GET` | Mengambil profil pengguna, penugasan, dan tahun ajaran | Terintegrasi & Teruji |
| `/api/logout` | `POST` | Menghapus token sesi aktif di Sanctum | Terintegrasi & Teruji |
| `/api/auth/forgot-password/check-identity` | `POST` | Verifikasi identitas dan ketersediaan email akun | Terintegrasi & Teruji |
| `/api/auth/forgot-password/send-otp` | `POST` | Pengiriman OTP pemulihan kata sandi ke email | Terintegrasi |
| `/api/auth/forgot-password/verify-otp` | `POST` | Validasi OTP dan penerbitan `reset_token` | Terintegrasi |
| `/api/auth/forgot-password/reset-password` | `POST` | Pembaruan kata sandi menggunakan `reset_token` | Terintegrasi |
| `/api/me/password` | `PATCH` | Ganti kata sandi (wajib atau mandiri) | Terintegrasi |
| `/api/me/verify-password` | `POST` | Step-Up Authentication untuk tindakan sensitif | Terintegrasi & Teruji |
| `/api/me/email` | `POST` | Permintaan OTP verifikasi email akun | Terintegrasi |
| `/api/me/email/verify` | `POST` | Verifikasi OTP email | Terintegrasi |
| `/api/me/phone` | `POST` | Permintaan OTP verifikasi WhatsApp | Terintegrasi |
| `/api/me/phone/verify` | `POST` | Verifikasi OTP WhatsApp | Terintegrasi |
| `/api/me/google-link` | `POST` | Menautkan akun Google ke user | Terintegrasi |
| `/api/me/google-unlink` | `POST` | Melepas tautan Google dengan konfirmasi sandi | Terintegrasi |
| `/api/academic-events/my-calendar` | `GET` | Personalisasi agenda kalender akademik multi-role | Terintegrasi & Teruji (Fase 3) |
| `/api/academic-events` | `GET` | Daftar agenda kalender sekolah lengkap | Terintegrasi (Fase 3) |
| `/api/academic-events/check-exemption` | `GET` | Validasi pengecualian KBM pada tanggal tertentu | Terintegrasi (Fase 3) |
| `/api/period-templates` | `GET` | Data template slot jam KBM dinamis | Terintegrasi (Fase 3) |
| `/api/academic-settings` | `GET` | Status siklus putaran dan status upacara Senin | Terintegrasi (Fase 3) |
| `/api/schedules` | `GET` | Daftar jadwal pelajaran multi-role | Terintegrasi (Fase 3) |

---

## 7. Hasil Pengujian Teknis Fase 3

Seluruh pengujian fungsionalitas dan kompilasi pada Fase 3 telah dijalankan dengan status **LULUS**:

1. **Static Code Analysis (`npm run lint`):**
   - Hasil: `0 errors, 0 warnings` pada seluruh berkas `.js` dan `.jsx`.
   - Mengikuti pola rendering asinkron React 19 tanpa cascading renders dalam `useEffect`.
2. **Production Build (`npm run build`):**
   - Hasil: Berhasil dikompilasi dalam `635ms` tanpa error.
   - Output bundle:
     - `dist/index.html` (1.27 kB)
     - `dist/assets/index-CLbA0N3E.css` (73.09 kB)
     - `dist/assets/index-B6Jx9LJ9.js` (452.80 kB)
3. **Integritas Workspace Eksisting:**
   - Direktori `frontend/scp_web/` dan backend `scp/` diverifikasi berstatus **100% untouched** (read-only) sesuai ketentuan batasan proyek.
4. **Kepatuhan Navigasi & Scope:**
   - Seluruh fitur import data Waka tetap dikeluarkan dari cakupan mobile (*Out of Scope*).
   - Halaman jadwal spesifik masing-masing role dan manajemen Waka tidak dimodifikasi pada fase ini, siap dilanjutkan pada fase berikutnya.

---

## 8. Ringkasan Implementasi Fase 4 & Fase 5 (Waka Kurikulum, Guru, & Kesiswaan)

### A. Modul Waka Kurikulum (Fase 4)
1. **`WakaDashboardPage.jsx` (`/web/dashboard`):**
   - Ringkasan Tahun Ajaran aktif, Semester, dan Siklus KBM.
   - Sakelar putaran Siklus 1/2 dengan verifikasi sandi Waka (`PasswordSheet`).
   - Alert jurnal KBM terlambat (`/api/schedules?status=missing_journal`).
   - Statistik ringkas data master (rombel, guru, mapel, siswa, ruang).
2. **`AcademicCalendarPage.jsx` (`/web/academic-calendar`):**
   - Kalender akademik bulanan (`MobileCalendarView`).
   - CRUD agenda sekolah dengan sakelar `disables_teaching` untuk meliburkan KBM.
3. **`ScheduleManagementPage.jsx` (`/web/schedules`):**
   - Manajemen jadwal manual per siklus, hari, dan rombel.
   - Deteksi bentrok jadwal dan resolusi jam pelajaran dinamis.
   - Pengecualian total fitur import PDF jadwal FET sesuai batasan master plan.
4. **`MasterDataPage.jsx` (`/web/master-data`):**
   - Segmented tabs: Kelas, Ruang, Mapel, Guru, Siswa.
   - CRUD item master data dengan `MobileRecordCard` dan konfirmasi keamanan kata sandi Waka.
   - Pengecualian total fitur import Excel Guru dan Siswa.
5. **`GradePromotionPage.jsx` (`/web/grade-promotion`):**
   - Pemetaan kelas tujuan tingkat 10->11, 11->12, 12->Lulus.
   - Sakelar "Tandai Tinggal Kelas" per siswa (`studentApi.holdBack`).
   - Eksekusi kenaikan kelas massal berpassword (`classApi.promoteClasses`).
6. **`MonitoringPage.jsx` (`/web/monitoring`):**
   - Tab 1: Jurnal KBM Guru (rekapitulasi, foto bukti KBM, aksi tandai jam kosong).
   - Tab 2: Presensi Siswa per rombel dan tanggal.

### B. Modul Guru, Wali Kelas, & Kesiswaan/BK (Fase 5)
1. **`TeacherDashboardPage.jsx` (`/teacher/dashboard`):**
   - Lencana penugasan (Wali Kelas, Kesiswaan).
   - Progres beban mengajar mingguan & harian.
   - Alert jurnal belum terisi dan daftar jadwal hari ini.
2. **`TeacherSchedulePage.jsx` (`/teacher/schedule`):**
   - Sakelar jadwal pribadi vs jadwal kelas binaan (khusus Wali Kelas).
3. **`TeacherJournalPage.jsx` & `CameraModal.jsx` (`/teacher/journal`):**
   - Dual-capture camera (WebRTC live viewfinder + fallback file input).
   - Kompresi foto otomatis `<150KB` via canvas sebelum diunggah.
   - Presensi *exception-based* (`H/S/I/A`) dengan penguncian otomatis izin yang sudah disetujui.
   - Dukungan guru pengganti & pengiriman multipart dengan `_method: 'PUT'`.
4. **`TeacherLeavePage.jsx` (`/teacher/leave`):**
   - Pengajuan izin mengajar dengan pemilihan jadwal terdampak dinamis, unggah surat, dan tugas titipan.
5. **`PermissionVerifyPage.jsx` (`/teacher/permissions`):**
   - Verifikasi izin siswa (Wali Kelas & Kesiswaan) dan izin guru (Kesiswaan & Waka).
6. **`TeacherQuizPage.jsx` (`/teacher/quiz`):**
   - CRUD kuis, generator soal AI via Gemini API (`POST /api/quizzes/{id}/generate-prompt`), ekstraksi dokumen PDF/TXT, review & edit kunci jawaban, publikasi, dan koreksi/override skor.

---

## 9. Hasil Implementasi Fase 6 — Modul Role Siswa & Orang Tua

Fase 6 berhasil diselesaikan 100% tanpa menggunakan data tiruan (dummy data), terhubung langsung ke REST API Laravel aktual:

### A. Fitur Siswa (`src/pages/student/`)
1. **`StudentHomePage.jsx` (`/student/home`):**
   - **Profil Siswa:** Kartu identitas ringkas (Nama, NIS, Rombel, Tahun Ajaran) bersumber dari state autentikasi pengguna.
   - **Rekapitulasi Presensi:** 4 metrik kehadiran (Hadir, Sakit, Izin, Alpa) yang dihitung dari data riil `GET /api/attendances`.
   - **Bottom Sheet Riwayat Presensi:** Menampilkan daftar log presensi harian, materi pembelajaran, dan catatan guru (`notes`).
   - **Jadwal Hari Ini:** Mengambil jadwal aktif hari ini berdasarkan kelas siswa (`scheduleApi.getSchedules`), lengkap dengan resolusi waktu, guru pengampu, ruang kelas, dan status pelaksanaan KBM.
   - **Banner Kuis Aktif:** Menampilkan kuis kelas aktif berstatus `published` dengan durasi dan jumlah soal, serta tombol langsung menuju pengerjaan kuis.
   - **Banner Agenda Khusus:** Deteksi otomatis hari libur atau kegiatan yang meniadakan KBM (`academicEventApi.checkExemption`).
2. **`StudentSchedulePage.jsx` (`/student/schedule`):**
   - **Putaran Siklus:** Sakelar Siklus 1 dan Siklus 2.
   - **Navigasi Hari:** Tab Senin–Jumat dengan komponen `MobileScheduleTimeline`.
   - **Detail Sesi KBM:** Bottom Sheet rincian sesi pelajaran saat kartu ditekan (mapel, guru pengampu, ruang, jam ke-n, dan rentang waktu riil).
3. **`StudentPermissionPage.jsx` (`/student/permissions` & `/student/permission`):**
   - **Ringkasan Statistik:** Total, Menunggu (Pending), Disetujui (Approved), Ditolak (Rejected).
   - **Daftar Riwayat Izin:** Kartu perizinan lengkap dengan badge status persetujuan.
   - **Form Pengajuan Izin Baru (Multipart Form Data):**
     - Tipe *Tidak Masuk Sekolah* (`start_date`, `end_date`) atau *Dispensasi Keluar* (`date`, `departure_time`, `expected_return_time`).
     - Kategori *Sakit* (wajib lampiran berkas surat dokter/pemberitahuan) atau *Lainnya* (lampiran opsional).
     - Deteksi dini kalender libur/peniadaan KBM sebelum form dikirim.
     - Validasi berkas maksimal 2 MB format JPG, PNG, atau PDF.
   - **Edit & Batalkan Izin:** Siswa dapat mengedit atau membatalkan pengajuan selama berstatus `pending`.
   - **Pratinjau Bukti Surat:** Bottom Sheet gambar/PDF dengan penanganan *fallback URL* otomatis (`getFallbackStorageUrl`).
4. **`StudentQuizPage.jsx` (`/student/quiz` & `/student/quizzes`):**
   - **Tab Filter Kuis:** Semua, Tersedia, dan Dinilai.
   - **Daftar Kuis Terlingkup Kelas:** Menampilkan kuis berstatus `published` dan `published_result` yang ditujukan untuk kelas siswa.
   - **Layar Pengerjaan Kuis Layar Penuh (Focus Mode):**
     - Sticky Header dengan hitung mundur timer (JetBrains Mono) dan penanda warna merah jika waktu tersisa < 5 menit.
     - Horizontal slider nomor soal dengan status visual (aktif, terjawab, belum terjawab).
     - Kartu pertanyaan dengan badge tipe (Pilihan Ganda vs Esai) dan bobot poin.
     - Tombol kartu opsi pilihan ganda A–E yang ramah jempol (min 44px) dan textarea esai.
     - Auto-save jawaban ke `sessionStorage` dengan key aman per user (`quiz_draft_${user.id}_${quiz.id}`).
     - Dialog konfirmasi pengumpulan dengan peringatan jumlah soal yang belum terjawab.
     - Auto-submit otomatis jika timer habis.
   - **Review Nilai & Evaluasi AI:** Bottom Sheet yang menampilkan nilai akhir (skala 100) dan umpan balik personalisasi AI setelah kuis dirilis (`published_result`).

### B. Fitur Orang Tua (`src/pages/parent/`)
1. **`ParentMonitoringPage.jsx` (`/parent/monitoring` & `/parent/home`):**
   - **Kartu Profil Anak Tertaut:** Menampilkan identitas anak (`linked_student_id`), NIS, kelas, dan nama wali. Menyediakan tampilan informatif jika akun belum ditautkan.
   - **Peringatan Kehadiran Cerdas:**
     - Alert Bahaya merah jika terdapat catatan Alpa tanpa keterangan.
     - Alert Peringatan kuning jika akumulasi izin & sakit mencapai >= 5 hari.
   - **4 Tab Pemantauan:**
     1. *Presensi:* Riwayat log presensi harian anak beserta catatan guru pengampu.
     2. *Surat Izin:* Riwayat pengajuan izin anak beserta pratinjau surat bukti.
     3. *Nilai Kuis AI:* Capaian nilai kuis anak yang telah dirilis dan ulasan AI.
     4. *Jadwal Belajar Kelas:* Jadwal mingguan kelas anak per siklus menggunakan `MobileScheduleTimeline`.

### C. Normalisasi Rute Navigasi (`src/routes/AppRouter.jsx`)
- Mendaftarkan rute singular dan plural untuk mencegah error 404:
  - `/student/permission` dan `/student/permissions`
  - `/student/quiz` dan `/student/quizzes`
  - `/parent/home` dan `/parent/monitoring`
  - Redirect otomatis dari root `/student` ke `/student/home` dan `/parent` ke `/parent/monitoring`.

---

## 10. Hasil Pengujian Teknis Fase 6

1. **Static Code Analysis (`npm run lint`):**
   - Hasil: **`0 errors, 0 warnings`** pada seluruh berkas `.js` dan `.jsx`.
   - Pola rendering asinkron React 19 ditaati sepenuhnya (tidak ada state updates sinkron dalam body `useEffect`).
2. **Production Build (`npm run build`):**
   - Hasil: Berhasil dikompilasi dalam **`880ms`** dengan kode keluar `0`.
   - Output bundle:
     - `dist/index.html` (1.27 kB)
     - `dist/assets/index-By79rNZ0.css` (98.13 kB)
     - `dist/assets/index-I7XljPny.js` (676.26 kB)
3. **Integritas Workspace Eksisting:**
   - Direktori `frontend/scp_web/` dan backend `scp/` berstatus **100% untouched** (read-only).
4. **Keamanan Scoping Data:**
   - Seluruh data siswa dan orang tua mengandalkan scoping bawaan controller Laravel (`where('student_id', ...)` dan `where('class_id', ...)`).
   - Draft pengerjaan kuis disimpan dengan key terpisah per `user.id` untuk mencegah kontaminasi data antar-akun pada perangkat yang sama.

---

## 11. Dokumentasi Fase 7 — End-to-End QA, Optimasi Performa Mobile, & Verifikasi Lintas Role

### A. Hasil Audit Menyeluruh Aplikasi (Tahap A)
Audit menyeluruh dilakukan terhadap implementasi Fase 1 hingga Fase 6:
1. **Prioritas P0 (Keamanan & Bug Kritis):**
   - *Status:* **0 Temuan.** Seluruh mutasi sensitif di role Waka dilindungi *step-up password sheet*, seluruh endpoint terproteksi token Sanctum, dan scoping data pada query backend diverifikasi aman.
2. **Prioritas P1 (Integrasi API & Fungsionalitas Utama):**
   - *Status:* **0 Temuan.** Seluruh 24 rute dan 12 endpoint API terhubung langsung ke REST API Laravel tanpa data tiruan/mock.
3. **Prioritas P2 (Performa & Optimasi Bundle):**
   - *Temuan:* Seluruh halaman sebelumnya diimpor secara statis pada `AppRouter.jsx`, menyebabkan ukuran bundle JavaScript awal membengkak hingga 676 kB dan memicu warning chunk Vite.
   - *Solusi:* Dioptimasi dengan **Dynamic Import & Route-Level Code Splitting** (`React.lazy` + `Suspense`). Ukuran bundle awal terpangkas menjadi 286 kB (gzip: 89 kB), dan setiap modul role dipecah menjadi chunk on-demand 4–20 kB.
4. **Prioritas P3 (Memory Leak & Lifecycle Hygiene):**
   - *Temuan:* URL objek berkas foto kamera pada `TeacherJournalPage` yang dibuat via `URL.createObjectURL` berpotensi menumpuk memori jika pengguna sering mengambil/menghapus foto sebelum disimpan.
   - *Solusi:* Ditambahkan mekanisme pelepasan memori otomatis (`URL.revokeObjectURL`) saat foto dihapus maupun saat komponen unmount.

### B. Pengujian Responsivitas Lintas Viewport (Tahap B)
Pengujian tata letak visual dilakukan pada 6 ukuran viewport mobile:
- **320px (Small Smartphone):**
  - KPI kehadiran 4-kolom beradaptasi proporsional tanpa teks terpotong.
  - Form perizinan dan slider nomor kuis tetap nyaman dijangkau.
  - Safe-area bottom padding mencegah bottom navigation menutupi tombol aksi.
- **360px & 390px (Standard / Modern Smartphone):**
  - Timeline jadwal KBM, kartu presensi, dan opsi kuis A–E memiliki tinggi sentuh $\ge 44\text{px}$.
  - Modal dan bottom sheet scrollable secara mandiri (`max-h-[85vh]`).
- **412px & 430px (Large Screen Smartphone):**
  - Tampilan proporsional, font konsisten (*Plus Jakarta Sans* & *JetBrains Mono*).
- **768px (Tablet / Desktop Preview):**
  - Kontainer aplikasi dibatasi otomatis pada `max-width: 480px; margin: 0 auto;` dengan frame mobile terpusat, menjaga ergonomi tampilan ponsel saat diakses pada layar lebar.

### C. Optimasi Performa Mobile (Tahap C)
- **Route-Level Code Splitting:**
  - `LoginPage`, `ForgotPasswordPage`, `ChangePasswordPage`, `ProfilePage` dimuat on-demand.
  - Seluruh halaman Waka, Guru, Siswa, dan Orang Tua diisolasi dalam chunk mandiri.
  - Ditambahkan fallback indikator loading elegan (`PageLoadingFallback`) di dalam `MobileLayout.jsx` dan `AppRouter.jsx`.
- **Pengambilan Data & Render State:**
  - Menggunakan `useCallback` dan inisialisasi state mandiri tanpa mutasi sinkron di dalam `useEffect`.
  - Pagination didukung pada seluruh daftar record besar (Presensi, Izin, Jadwal).

### D. Audit Memory Leak & Lifecycle (Tahap D)
1. **Kamera WebRTC (`CameraModal.jsx`):**
   - Seluruh `MediaStreamTrack` dipastikan berhenti (`track.stop()`) saat modal ditutup, saat foto berhasil dijepret, maupun saat komponen di-unmount.
2. **Pembersihan Object URL (`TeacherJournalPage.jsx`):**
   - URL sementara foto `blob:...` dibersihkan dengan `URL.revokeObjectURL()` ketika foto diganti, dibatalkan, atau halaman ditutup.
3. **Timer Kuis Siswa (`StudentQuizPage.jsx`):**
   - `clearInterval(timerRef.current)` dipanggil otomatis saat modal pengerjaan ditutup, saat submission berhasil, dan saat komponen di-unmount.
   - Tidak ada kebocoran state update asinkron setelah navigasi berpindah.

### E. Verifikasi Hak Akses Lintas Role (Tahap E)
- **`waka`:** Memiliki akses penuh ke Dashboard, Jadwal, Master Data, Kenaikan Kelas, dan Monitoring. Bebas dari fitur import Excel/PDF Waka.
- **`teacher` (Guru Pengampu):** Terbatas pada jadwal pribadi, jurnal kelasnya, dan kuis miliknya.
- **`wali_kelas`:** Memperoleh akses khusus sakelar Jadwal Kelas Binaan dan verifikasi izin siswa kelas binaan.
- **`kesiswaan`:** Memperoleh akses monitoring sekolah dan verifikasi izin siswa/guru tingkat institusi.
- **`student`:** Ter-scoped otomatis ke data rombelnya, kuis kelasnya, dan presensi pribadinya.
- **`parent`:** Ter-scoped otomatis ke anak tertaut (`linked_student_id`). Tampilan gracefull jika akun belum ditautkan.
- **Route Guard:** Percobaan akses ilegal via URL langsung diarahkan ke `ForbiddenState` dengan tombol kembali ke rute beranda akun.

### F. Hasil Pengujian Build Produksi (Tahap H)
1. **Linter Analysis (`npm run lint`):**
   - **Hasil:** `0 errors, 0 warnings` (Exit code: 0).
2. **Production Compilation (`npm run build`):**
   - **Hasil:** Sukses dikompilasi dalam `935ms` (Exit code: 0).
   - **Chunk Size Breakdown:**
     - `index.html`: `1.42 kB` (gzip: `0.65 kB`)
     - `index-PxMRl6i7.js` (Core framework & router shell): `286.66 kB` (gzip: `89.85 kB`)
     - 24 On-demand page chunks: rata-rata `4 kB` s/d `21 kB` (gzip: `1.5 kB` s/d `5.5 kB`)
     - Total bundle terpecah efisien sesuai rekomendasi Vite.

---

## 12. Rekapitulasi Acceptance Criteria Master Plan

Berdasarkan Bagian 14 dokumen `SCP_MOBILE_DEVELOPMENT_PLAN.md`:

| No | Kriteria Penerimaan (*Acceptance Criteria*) | Status | Catatan Verifikasi |
|:---|:---|:---:|:---|
| 1 | Keempat role utama (`waka`, `teacher`, `student`, `parent`) dapat login dan mengakses menu sesuai hak akses. | **LULUS** | Divalidasi pada `AppRouter.jsx` & `RoleRoute.jsx`. |
| 2 | Penugasan khusus `wali_kelas` dan `kesiswaan` berjalan sesuai matriks kewenangan. | **LULUS** | Sakelar binaan, monitoring, dan verifikasi izin aktif sesuai assignment. |
| 3 | Pengecualian mutlak fitur import Waka (PDF FET & Excel). | **LULUS** | Tidak ada tombol, rute, atau modal import Waka pada aplikasi mobile. |
| 4 | Seluruh fitur Waka non-import berjalan sesuai scope. | **LULUS** | Dashboard, Kalender, Jadwal manual, Master Data manual, Kenaikan Kelas, dan Monitoring aktif. |
| 5 | Konsistensi visual *Exness Precision Clean*. | **LULUS** | Warna `#FFDE00`, `#0F172A`, font *Plus Jakarta Sans* & *JetBrains Mono* diterapkan konsisten. |
| 6 | Ergonomi navigasi mobile (Bottom Nav & Bottom Sheet). | **LULUS** | Bottom Nav adaptif per peran dan Bottom Sheet responsif dengan touch-dismiss. |
| 7 | Bebas dari *horizontal overflow* tidak disengaja. | **LULUS** | Diuji pada viewport 320px–768px. |
| 8 | Ukuran target sentuh ramah jempol ($\ge 42\text{--}44\text{px}$). | **LULUS** | Seluruh tombol, chip, opsi kuis, dan input form memenuhi standar ukuran sentuh. |
| 9 | Integrasi penuh backend REST API tanpa mock/dummy data. | **LULUS** | Seluruh pembacaan dan mutasi terhubung ke endpoint aktual Laravel `scp/`. |
| 10 | Step-up password confirmation untuk aksi sensitif. | **LULUS** | Diterapkan pada siklus, kenaikan kelas, hapus master data, dan lepas Google. |
| 11 | Kamera langsung WebRTC dan kompresi foto jurnal KBM $< 150\text{ KB}$. | **LULUS** | Dual-capture viewfinder + fallback file input + canvas compressor terpasang. |
| 12 | Pengajuan perizinan multipart (foto/PDF $\le 2\text{ MB}$). | **LULUS** | Form data multipart dengan validasi ukuran dan preview berkas. |
| 13 | Pembuatan dan pengerjaan kuis AI. | **LULUS** | Generator Prompt AI Gemini, ekstraksi PDF, timer mundur, auto-save, dan ulasan AI. |
| 14 | Kualitas kode & kelulusan build (`lint` & `build`). | **LULUS** | `npm run lint` 0 error; `npm run build` sukses tanpa warning ukuran chunk. |

