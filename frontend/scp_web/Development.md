# SCP Web — Development Progress & Phase Documentation

Dokumen ini adalah catatan resmi riwayat pengembangan (*living document*) untuk aplikasi Front-End Website **School Class Project (SCP)** di direktori `frontend/scp_web`. Dokumen ini mencatat detail arsitektur, keputusan teknis, daftar komponen, file yang dibangun, serta hasil verifikasi dari setiap fase pengerjaan.

---

## Ringkasan Status Proyek

| Fase | Nama Fase / Milestone | Status | Verifikasi (Lint & Build) |
|:---:|:---|:---:|:---:|
| **Fase 0** | Persiapan Fondasi, Standardisasi Desain & Arsitektur | **SELESAI** | 0 Error / 0 Warning |
| **Fase 1** | Autentikasi, Profil Pengguna, Sesi Sanctum, Layout Shell, & Route Guarding | **SELESAI** | 0 Error / 0 Warning (Build: 723ms) |
| **Fase 2** | Master Data Akademik & Siklus Promosi (Modul Waka Kurikulum) | **SELESAI** | 0 Error / 0 Warning (Build: 893ms) |
| **Fase 3** | Pengelolaan Jadwal Terpusat & Import Jadwal PDF FET | **SELESAI** | 0 Error / 0 Warning (Build: 830ms) |
| **Fase 4** | Kalender Mengajar KBM, Jurnal Harian & Presensi Siswa/Guru | **SELESAI** | 0 Error / 0 Warning (Build: 675ms) |
| **Fase 5** | Modul Perizinan Siswa & Monitoring Kehadiran Sekolah | *Menunggu Rencana Kerja* | - |
| **Fase 6** | Sistem Kuis Berbantuan AI & Evaluasi Submisi Otomatis | *Pending* | - |

---

## Fase 0: Persiapan Fondasi, Standardisasi Desain & Arsitektur

### 1. Tujuan & Ruang Lingkup
Mempersiapkan lingkungan kerja Front-End React + Vite yang bersih, modular, dan terstandardisasi dengan mengadopsi seluruh token desain, tipografi, warna, dan komponen dasar dari prototype (`frontend/_Prototype/akademik-prototype`), serta menyingkirkan kode boilerplate yang tidak relevan.

### 2. Pekerjaan yang Telah Diselesaikan
1. **Pembersihan Boilerplate:**
   - Menghapus styling default bawaan template Vite (`App.css` dan default `index.css`).
   - Membersihkan `App.jsx` untuk persiapan struktur router dan layout.
2. **Standardisasi Sistem Desain & CSS Tokens:**
   - Membuat sistem variabel CSS modern berbasis token di `src/styles/tokens.css` (warna primer, netral, feedback, radius, shadow, font family, z-index, spacing).
   - Menyusun aturan reset dan base styling di `src/styles/base.css`.
   - Mengabstraksi komponen styling global di `src/styles/components.css` (form, badge, card, modal, typography).
   - Menyusun utility classes di `src/styles/utilities.css` dan file entry point `src/styles/index.css`.
3. **Pengaturan Tipografi & Ikonografi:**
   - Mengintegrasikan font `Inter` dan `Plus Jakarta Sans` di `index.html`.
   - Menginstal dan mengonfigurasi pustaka ikon `lucide-react` untuk konsistensi seluruh UI.
4. **Pembangunan Komponen Dasar Reusable (UI Foundation):**
   - `Button`: Variasi `primary`, `secondary`, `outline`, `ghost`, `danger`, state `loading`, dan ukuran `sm`, `md`, `lg`.
   - `Input`: Form input terstandar dengan label, hint, error message, ikon prefix/suffix, dan state disabled.
   - `Badge`: Label status dengan ragam warna (`primary`, `success`, `warning`, `danger`, `info`, `neutral`).
   - `Card`: Wadah konten serbaguna dengan header, body, dan footer.
   - `Modal`: Dialog pop-up responsif dengan trap focus, backdrop blur, dan animasi smooth.
   - `Table`: Komponen tabel data terstruktur dengan header styling dan responsive wrapper.
   - `Toast`: Notifikasi pop-up feedback (success, error, warning, info).
   - `Dropdown`: Menu kontekstual interaktif.
   - `EmptyState`: Komponen tampilan status kosong bila tidak ada data.
   - `LoadingSpinner`: Indikator loading visual dan skeleton placeholder.
5. **Utilitas Pembantu (Helpers & Formatters):**
   - `src/utils/formatters.js`: Format tanggal Indonesia (`DD MMMM YYYY`), format jam, dan format mata uang/angka.
   - `src/utils/helpers.js`: Sanitasi string, pemetaan warna role, dan generator inisial nama.

### 3. Struktur Berkas yang Dihasilkan pada Fase 0
```
frontend/scp_web/
├── src/
│   ├── components/
│   │   └── ui/              # Komponen atom & molekul UI dasar
│   │       ├── Button.jsx
│   │       ├── Input.jsx
│   │       ├── Badge.jsx
│   │       ├── Card.jsx
│   │       ├── Modal.jsx
│   │       ├── Table.jsx
│   │       ├── Toast.jsx
│   │       ├── Dropdown.jsx
│   │       ├── EmptyState.jsx
│   │       ├── LoadingSpinner.jsx
│   │       └── index.js
│   ├── styles/              # Design tokens dan CSS global
│   │   ├── tokens.css
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── utilities.css
│   │   └── index.css
│   └── utils/               # Fungsi formatters dan helpers
│       ├── formatters.js
│       └── helpers.js
```

---

## Fase 1: Autentikasi, Profil Pengguna, Sesi Sanctum, Layout Shell, & Route Guarding

### 1. Tujuan & Ruang Lingkup
Membangun infrastruktur komunikasi API backend, manajemen state sesi autentikasi Laravel Sanctum, sistem otorisasi berbasis peran (RBAC), layout shell dashboard (*Sidebar* & *TopBar*), proteksi rute berlapis, serta antarmuka visual halaman login, ganti password wajib, dan profil pengguna.

### 2. Rincian Pekerjaan Teknis (Sub-Tugas 1.1 - 1.6)

#### A. Sub-Tugas 1.1: Klien API HTTP & Environment
- Dibuat berkas `.env` dan `.env.example` dengan variabel `VITE_API_BASE_URL=http://localhost:8000/api`.
- Dibuat `src/services/api.js` menggunakan Axios:
  - Timeout 15 detik dengan header default `Accept: application/json`.
  - Request Interceptor: Otomatis menyematkan `Authorization: Bearer <token>` dari `localStorage`.
  - Response Interceptor: Menangani status `401 Unauthorized` dengan membersihkan storage lokal dan mengarahkan pengguna ke `/login`.
  - Penanganan error validasi `422 Unprocessable Entity` secara terstruktur.
  - Modul layanan `authApi` mencakup: `login`, `logout`, `getMe`, `changePassword`, `sendPhoneOtp`, `verifyPhoneOtp`, `sendEmailOtp`, `verifyEmailOtp`, dan `getGoogleRedirectUrl`.

#### B. Sub-Tugas 1.2: State Management Autentikasi & Sesi Sanctum
- Dibuat `src/context/authConstants.js`:
  - Definisi peran sistem: `admin`, `principal`, `vice_principal`, `teacher`, `homeroom_teacher`, `student`.
  - Definisi 6 profil mock (*Demo Mode*) untuk kebutuhan pengujian mandiri dan demo evaluasi UKK.
- Dibuat `src/context/authContextInstance.js` & `src/context/AuthContext.jsx`:
  - Lifecycle sesi lengkap: `login`, `logout`, `changePassword`, `updateUserProfile`, dan `loginWithDemo`.
  - Normalisasi role: Helper `hasRole('waka')` mengenali alias `vice_principal` dan `waka`.
  - Helper khusus: `isKesiswaan()` dan `isWaliKelas()`.
  - Dynamic redirect route resolver via `getHomeRoute(user)`.
- Dibuat `src/hooks/useAuth.js`:
  - Custom hook untuk konsumsi data autentikasi di seluruh komponen dengan validasi error bila digunakan di luar Provider.

#### C. Sub-Tugas 1.3: Mekanisme Proteksi Rute (Route Guarding)
- `ProtectedRoute.jsx`:
  - Memverifikasi token autentikasi. Menampilkan loading skeleton saat sesi diverifikasi.
  - Mengarahkan paksa pengguna ke `/change-password` jika memiliki flag `must_change_password: true`.
- `PublicRoute.jsx`:
  - Mencegah pengguna yang telah login untuk mengakses rute login publik; otomatis dialihkan ke halaman dashboard yang sesuai.
- `RoleRoute.jsx`:
  - Memverifikasi hak akses berdasarkan array peran yang diizinkan (`allowedRoles`) serta syarat penugasan khusus (`requireHomeroom`, `requireKesiswaan`).
  - Menampilkan antarmuka elegan **403 Forbidden Access** jika pengguna tidak memiliki wewenang.

#### D. Sub-Tugas 1.4: Layout Shell Terpadu (Shell Dashboard)
- `Sidebar.jsx` & `Sidebar.css`:
  - Menampilkan brand logo SCP dan badge peran pengguna aktif.
  - Menyaring daftar menu navigasi secara dinamis sesuai peran pengguna (menu Master Data hanya tampil untuk Admin/Pimpinan; menu Jadwal/Mengajar hanya tampil untuk Guru/Wali Kelas; menu Siswa hanya tampil untuk Siswa).
  - Mendukung expandable accordion menu groups dan drawer navigasi responsif di layar mobile.
- `TopBar.jsx` & `TopBar.css`:
  - Header sticky dengan breadcrumbs dinamis berdasarkan path aktif.
  - Indikator status koneksi API (Online/Offline).
  - Quick Role-Switcher khusus mode UKK untuk kemudahan simulasi berbagai peran tanpa perlu re-login manual.
  - Menu profil dengan avatar inisial nama, badge peran, tombol menuju profil, dan modal konfirmasi logout.
- `WebLayout.jsx` & `WebLayout.css`:
  - Wrapper shell utama yang mengintegrasikan Sidebar, TopBar, backdrop mobile, dan area rendering `<Outlet />`.

#### E. Sub-Tugas 1.5: Halaman Login & Ganti Password Wajib
- `LoginPage.jsx` & `Login.css`:
  - Desain kartu elegan berpresisi tinggi dengan ilustrasi branding SCP.
  - Dilengkapi selector preset demo untuk 6 peran (Admin, Kepsek, Waka, Guru, Wali Kelas, Siswa) agar evaluator UKK dapat menguji aplikasi secara instan.
  - Validasi form inline, toggle intip password, penanganan error 422, dan deteksi otomatis identifier perangkat (`device_name`).
- `ChangePasswordPage.jsx` & `ChangePassword.css`:
  - Halaman isolasi keamanan untuk pengguna dengan status ganti password wajib (*first login*).
  - Dilengkapi indikator checklist syarat keamanan password (minimal 8 karakter dan konfirmasi kecocokan).

#### F. Sub-Tugas 1.6: Halaman Profil Pengguna & Registry Router
- `ProfilePage.jsx` & `Profile.css`:
  - Kartu identitas utama dengan avatar besar, NIP/NISN, nama lengkap, role badge, dan tanggal bergabung.
  - Tab navigasi internal: Data Profil Dasar, Keamanan Akun (Ganti Password), dan Verifikasi Kontak (OTP WhatsApp, OTP Email, Tautan Akun Google).
- `AppRouter.jsx`:
  - Merakit seluruh pohon rute:
    - Rute Publik: `/login` (dilindungi `PublicRoute`).
    - Rute Wajib: `/change-password` (dilindungi token).
    - Rute Terproteksi (`WebLayout`):
      - `/profile`, `/dashboard` (seluruh role).
      - `/users`, `/academic-years`, `/subjects`, `/classes`, `/teachers`, `/students` (Admin/Pimpinan).
      - `/schedules`, `/curriculum` (Admin/Pimpinan/Guru).
      - `/teaching`, `/rfid-scanner` (Guru).
      - `/homeroom` (Wali Kelas).
      - `/student/my-attendance`, `/student/my-grades`, `/student/my-class` (Siswa).
      - `/reports` (Admin/Pimpinan/Guru/Wali Kelas).
      - Wildcard `*` dengan tampilan antarmuka **404 Not Found**.

### 3. Struktur Berkas yang Dihasilkan pada Fase 1
```
frontend/scp_web/
├── .env
├── .env.example
├── src/
│   ├── components/
│   │   └── layout/
│   │       ├── Sidebar.jsx
│   │       ├── Sidebar.css
│   │       ├── TopBar.jsx
│   │       ├── TopBar.css
│   │       ├── WebLayout.jsx
│   │       ├── WebLayout.css
│   │       └── index.js
│   ├── context/
│   │   ├── authConstants.js
│   │   ├── authContextInstance.js
│   │   └── AuthContext.jsx
│   ├── hooks/
│   │   └── useAuth.js
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── Login.css
│   │   │   ├── ChangePasswordPage.jsx
│   │   │   └── ChangePassword.css
│   │   └── profile/
│   │       ├── ProfilePage.jsx
│   │       └── Profile.css
│   ├── routes/
│   │   ├── AppRouter.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── PublicRoute.jsx
│   │   └── RoleRoute.jsx
│   └── services/
│       └── api.js
```

### 4. Hasil Verifikasi Kualitas Fase 1
1. **ESLint (`npm run lint`):**
   ```
   > scp_web@0.0.0 lint
   > eslint .
   [Result]: 0 errors, 0 warnings (Lolos)
   ```
2. **Kompilasi Produksi (`npm run build`):**
   ```
   > scp_web@0.0.0 build
   > vite build
   ✓ 1747 modules transformed.
   dist/index.html                   0.81 kB │ gzip:   0.43 kB
   dist/assets/index-DmHncEcu.css   54.13 kB │ gzip:  10.30 kB
   dist/assets/index-Cm0bT6rj.js   363.85 kB │ gzip: 114.45 kB
   ✓ built in 723ms (Lolos)
   ```

---

## Fase 3: Pengelolaan Jadwal Terpusat & Import Jadwal PDF FET

### 1. Tujuan & Ruang Lingkup
Mengimplementasikan modul inti kurikulum untuk Waka Kurikulum:
- Dashboard Akademik Waka untuk mengontrol putaran aktif, upacara Senin, dan kepatuhan jurnal KBM harian.
- Matriks jadwal mingguan dengan resolusi jam dinamis (08:00 vs 07:15) dan deteksi bentrok visual.
- Mutasi jadwal manual (tambah/edit/hapus) berbasis Step-Up Authentication (`PasswordModal`).
- Pre-condition gate yang memvalidasi ketersediaan 4 pilar Master Data (Kelas, Ruang, Mapel, Guru FET ID) sebelum penyusunan jadwal.
- Alur lengkap import 2 berkas PDF FET (Upload multipart -> Respon HTTP 202 -> Polling status -> Metrik ekstraksi -> Resolusi manual per baris -> Final commit berpassword).

### 2. Pekerjaan yang Diselesaikan
1. **Service Layer Client:**
   - [`src/services/scheduleApi.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/scheduleApi.js): Menghubungkan endpoint `/api/academic-settings`, `/api/academic-settings/monday-status`, `/api/cycle-history`, dan `/api/schedules` CRUD.
   - [`src/services/scheduleImportApi.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/scheduleImportApi.js): Menghubungkan endpoint `/api/schedule-imports` upload multipart, detail batch, resolve row, confirm commit, dan cancel.
2. **Utilitas & Helpers:**
   - [`src/utils/timetableHelper.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/timetableHelper.js): Konversi ISO Day integer (1-5), pemetaan template slot waktu Senin upacara (mulai 08:00) vs reguler (07:15) vs Jumat (8 JP), resolusi rentang jam riil KBM, serta algoritma deteksi bentrok jadwal lokal.
   - [`src/utils/prerequisiteHelper.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/prerequisiteHelper.js): Pemeriksaan kelayakan 4 pilar Master Data (Kelas, Ruang, Mapel, Guru FET).
3. **Komponen Halaman Waka Kurikulum:**
   - [`src/pages/waka/DashboardWakaPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx) & `DashboardWaka.css`: 3 kartu metrik flat, saklar putaran & status upacara berproteksi `PasswordModal`, kartu peringatan jurnal terlambat (>30 menit), dan tabel log riwayat putaran.
   - [`src/pages/waka/ScheduleManagementPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx) & `ScheduleManagement.css`: Matriks visual mingguan, baris upacara Senin, kartu KBM berwarna bentrok, modal tambah/edit/hapus jadwal berbasis password Waka, dan banner pre-condition gate.
   - [`src/pages/waka/UploadImportPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/UploadImportPage.jsx) & `UploadImport.css`: Pemilihan putaran target, dropzone 2 PDF (`Jadwal_Kelas.pdf` & `Jadwal_Ruangan.pdf`), penanganan HTTP 202 Accepted, progress bar ekstraksi, dan navigasi otomatis ke `/web/review-import/:id`.
   - [`src/pages/waka/ReviewImportPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx) & `ReviewImport.css`: Polling status ekstraksi (`preview_ready`), 4 kartu metrik (Total, Matched, Unmatched, Conflict), tabel baris hasil ekstraksi, modal resolusi manual per baris (`PATCH .../rows/:row_id`), tombol exclude baris, proteksi commit jika `matched === 0`, dan commit final berpassword.
4. **Integrasi Routing:**
   - Mendaftarkan rute baru di [`src/routes/AppRouter.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/routes/AppRouter.jsx) dan memperbarui breadcrumb matching di [`src/components/layout/TopBar.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx).

### 3. Struktur Berkas yang Dihasilkan pada Fase 3
```
frontend/scp_web/
├── src/
│   ├── pages/
│   │   └── waka/
│   │       ├── DashboardWaka.css
│   │       ├── DashboardWakaPage.jsx
│   │       ├── ScheduleManagement.css
│   │       ├── ScheduleManagementPage.jsx
│   │       ├── UploadImport.css
│   │       ├── UploadImportPage.jsx
│   │       ├── ReviewImport.css
│   │       └── ReviewImportPage.jsx
│   ├── services/
│   │   ├── scheduleApi.js
│   │   └── scheduleImportApi.js
│   └── utils/
│       ├── prerequisiteHelper.js
│       └── timetableHelper.js
```

### 4. Hasil Verifikasi Kualitas Fase 3
1. **ESLint (`npm run lint`):**
   ```
   > scp_web@0.0.0 lint
   > eslint .
   [Result]: 0 errors, 0 warnings (Lolos)
   ```
2. **Kompilasi Produksi (`npm run build`):**
   ```
   > scp_web@0.0.0 build
   > vite build
   ✓ 1769 modules transformed.
   dist/index.html                   0.80 kB │ gzip:   0.43 kB
   dist/assets/index-CGezjO9L.css   83.23 kB │ gzip:  13.98 kB
   dist/assets/index-twoJf9hj.js   483.05 kB │ gzip: 141.36 kB
   ✓ built in 830ms (Lolos)
   ```

---

## Penyelarasan Desain & Penghapusan Logo SCP Sesuai Prototipe

Sebagai tindak lanjut penyesuaian visual agar 100% konsisten dengan prototipe (`frontend/_Prototype/akademik-prototype`), telah dilakukan pembersihan dan harmonisasi visual:
1. **Penghapusan Logo "SCP":**
   - Menghapus badge logo kotak biru bertuliskan `"SCP"` pada [TopBar.jsx](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx) dan menggantikannya dengan teks brand tipografi bersih `"School Class Progress"` sesuai prototipe.
   - Menghapus badge `"SCP ACADEMIC"` pada [LoginPage.jsx](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx) dan menggantikannya dengan teks brand `"School Class Progress"`.
   - Mengubah judul mobile sidebar pada [Sidebar.jsx](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/Sidebar.jsx) dari `"Navigasi SCP"` menjadi `"Menu Navigasi"`.
   - Menyelaraskan teks judul halaman pada [index.html](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/index.html) dan subtitle placeholder pada [AppRouter.jsx](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/routes/AppRouter.jsx) menjadi `"School Class Progress"`.
   - Menghapus prefix string `"SCP"` pada format salinan kredensial akun dan generator password acak di master data.
2. **Standardisasi Palet Warna Sesuai Prototipe (Exness Precision Fintech Palette):**
   - **Primary Accent:** `#FFDE02` (Exness Yellow), hover `#F0CF00`, teks `#0F172A`. Digunakan pada tombol utama interaktif dan focus visible.
   - **Dark / Indicators:** `#0F172A` (Text primary, active border indicator, focus ring, avatar header, pill aktif).
   - **Netral & Permukaan:** `#FFFFFF` (Surface), `#F9FAFB` (Page background), `#F3F4F6` (Surface hover & secondary buttons), `#E5E7EB` (Borders).
   - **Badges:** Varian default/netral menggunakan latar `#F3F4F6` dan teks `#374151` tanpa border (border-0). Varian status: Sukses (`#ECFDF5`/`#047857`), Error (`#FEF2F2`/`#DC2626`), Warning (`#FFFBEB`/`#B45309`).
   - **Eliminasi Warna Arbitrer:** Menghilangkan seluruh warna biru royal arbitrer (`bg-blue-800`, `text-blue-600`, `bg-blue-50`, `text-primary-700`, `bg-primary-50`) dari TopBar, MasterDataPage, GradePromotionPage, Modal Kredensial, dan ProfilePage sehingga seluruh elemen UI sepenuhnya selaras dengan prototipe.

---

## Panduan Menjalankan & Menguji Proyek

### 1. Menjalankan Server Development
```bash
# Pindah ke direktori front-end
cd frontend/scp_web

# Jalankan dev server Vite
npm run dev
```
Aplikasi dapat diakses melalui browser di `http://localhost:5173`.

### 2. Menjalankan Audit Kode & Build
```bash
# Pengecekan linter
npm run lint

# Pengujian kompilasi produksi
npm run build
```

### 3. Menguji Akun Demo UKK
Pada halaman login (`/login`), klik tombol preset pada baris **"Akun Demo Cepat (Pengujian Mandiri)"**:
- **Admin**: Akses penuh ke seluruh konfigurasi, master data, dan pengelolaan akun.
- **Kepala Sekolah**: Akses monitoring seluruh kelas, kehadiran, jadwal, dan laporan.
- **Waka Kurikulum**: Akses manajemen kurikulum, pembagian jadwal, dan master data.
- **Guru**: Akses jadwal mengajar, presensi siswa per jam pelajaran, nilai, dan RFID scanner.
- **Wali Kelas**: Akses data siswa binaan, rekap absensi kelas, dan catatan wali kelas.
- **Siswa**: Akses presensi pribadi, kartu jadwal belajar, dan catatan nilai semester.

---

## Fase 2: Master Data Akademik & Siklus Promosi (Modul Waka Kurikulum)

### 1. Tujuan & Ruang Lingkup
Mengimplementasikan modul operasional Master Data sekolah (Kelas, Ruangan, Mata Pelajaran, Guru, dan Siswa) serta alur kenaikan kelas dan kelulusan siswa massal untuk peran Waka Kurikulum dan Administrator, terhubung ke backend API Laravel dan mendukung mode evaluasi offline UKK.

### 2. Pekerjaan yang Telah Diselesaikan
1. **API Service Layer Master Data (`src/services/masterDataApi.js`):**
   - CRUD Kelas (`classApi`): `getClasses`, `createClass`, `updateClass`, `deleteClass`, `promoteClasses`.
   - CRUD Ruangan (`roomApi`): `getRooms`, `createRoom`, `updateRoom`, `deleteRoom`.
   - CRUD Mata Pelajaran (`subjectApi`): `getSubjects`, `createSubject`, `updateSubject`, `deleteSubject`.
   - CRUD Guru (`teacherApi`): `getTeachers`, `createTeacher`, `updateTeacher`, `deleteTeacher`, `assignRole`, `revokeRole`.
   - CRUD Siswa (`studentApi`): `getStudents`, `createStudent`, `updateStudent`, `deleteStudent`, `holdBack`.
2. **Komponen Modal Khusus (`src/pages/waka/components/`):**
   - `InitialCredentialModal.jsx` & `InitialCredentialModal.css`: Menampilkan username & password acak hasil auto-provisioning backend saat pendaftaran guru atau siswa (termasuk akun orang tua `P-NIS`) dengan tombol salin instan satu klik dan proteksi penutupan tidak sengaja.
   - `TeacherAssignmentModal.jsx` & `TeacherAssignmentModal.css`: Menugaskan guru sebagai Guru Piket Kesiswaan atau Wali Kelas (dengan seleksi rombel dan validasi 1 kelas hanya 1 wali kelas).
   - `DeleteConflictDialog.jsx`: Menangani respon HTTP 409 Conflict secara anggun dengan informasi keterikatan jadwal dan panduan solutif.
3. **Halaman Master Data Terpadu (`src/pages/waka/MasterDataPage.jsx` & `MasterData.css`):**
   - 5 Tab navigasi dengan badge counter data aktual: Kelas, Ruang, Mata Pelajaran, Guru, Siswa.
   - Filter pencarian terintegrasi dan filter tingkat rombel (10, 11, 12).
   - Dialog form tambah & edit terstandar dengan pesan error inline (422) dan konfirmasi hapus data.
4. **Halaman Kenaikan Kelas & Kelulusan (`src/pages/waka/GradePromotionPage.jsx` & `GradePromotion.css`):**
   - Bagian 1: Konfigurasi pemetaan rombel tujuan (`next_class_id`) dengan modal ubah pemetaan.
   - Bagian 2: Daftar siswa dengan tombol toggle penanda tinggal kelas (*Hold-Back*) via `POST /api/students/{id}/hold-back`.
   - Bagian 3: Eksekusi promosi massal akhir tahun ajaran (`POST /api/class-promotions`) dengan konfirmasi bertingkat dan kartu ringkasan hasil promosi (Siswa Naik Kelas, Tinggal Kelas, Lulus).
5. **Integrasi Routing (`src/routes/AppRouter.jsx`):**
   - Menghubungkan rute `/web/master-data` dan `/web/grade-promotion` ke komponen riil yang dilindungi oleh `RoleRoute allowedRoles={['waka']}`.

### 3. Struktur Berkas yang Dihasilkan pada Fase 2
```
frontend/scp_web/
├── src/
│   ├── pages/
│   │   └── waka/
│   │       ├── components/
│   │       │   ├── DeleteConflictDialog.jsx
│   │       │   ├── InitialCredentialModal.css
│   │       │   ├── InitialCredentialModal.jsx
│   │       │   ├── TeacherAssignmentModal.css
│   │       │   └── TeacherAssignmentModal.jsx
│   │       ├── GradePromotion.css
│   │       ├── GradePromotionPage.jsx
│   │       ├── MasterData.css
│   │       └── MasterDataPage.jsx
│   └── services/
│       └── masterDataApi.js
```

### 4. Hasil Verifikasi Kualitas Fase 2
1. **ESLint (`npm run lint`):**
   ```
   > scp_web@0.0.0 lint
   > eslint .
   [Result]: 0 errors, 0 warnings (Lolos)
   ```
2. **Kompilasi Produksi (`npm run build`):**
   ```
   > scp_web@0.0.0 build
   > vite build
   ✓ 1757 modules transformed.
   dist/index.html                   0.81 kB │ gzip:   0.44 kB
   dist/assets/index-D3My3oxk.css   68.45 kB │ gzip:  12.16 kB
   dist/assets/index-C7GF3q91.js   421.04 kB │ gzip: 127.47 kB
   ✓ built in 893ms (Lolos)
   ```

---

## Fase 3: Pengelolaan Jadwal Terpusat & Import Jadwal PDF FET

### 1. Tujuan & Ruang Lingkup
Mengimplementasikan modul inti kurikulum untuk Waka Kurikulum:
- Dashboard Akademik Waka untuk mengontrol putaran aktif, upacara Senin, dan kepatuhan jurnal KBM harian.
- Matriks jadwal mingguan dengan resolusi jam dinamis (08:00 vs 07:15) dan deteksi bentrok visual.
- Mutasi jadwal manual (tambah/edit/hapus) berbasis Step-Up Authentication (`PasswordModal`).
- Pre-condition gate yang memvalidasi ketersediaan 4 pilar Master Data (Kelas, Ruang, Mapel, Guru FET ID) sebelum penyusunan jadwal.
- Alur lengkap import 2 berkas PDF FET (Upload multipart -> Respon HTTP 202 -> Polling status -> Metrik ekstraksi -> Resolusi manual per baris -> Final commit berpassword).

### 2. Pekerjaan yang Diselesaikan
1. **Service Layer Client:**
   - [`src/services/scheduleApi.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/scheduleApi.js): Menghubungkan endpoint `/api/academic-settings`, `/api/academic-settings/monday-status`, `/api/cycle-history`, dan `/api/schedules` CRUD.
   - [`src/services/scheduleImportApi.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/scheduleImportApi.js): Menghubungkan endpoint `/api/schedule-imports` upload multipart, detail batch, resolve row, confirm commit, dan cancel.
2. **Utilitas & Helpers:**
   - [`src/utils/timetableHelper.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/timetableHelper.js): Konversi ISO Day integer (1-5), pemetaan template slot waktu Senin upacara (mulai 08:00) vs reguler (07:15) vs Jumat (8 JP), resolusi rentang jam riil KBM, serta algoritma deteksi bentrok jadwal lokal.
   - [`src/utils/prerequisiteHelper.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/prerequisiteHelper.js): Pemeriksaan kelayakan 4 pilar Master Data (Kelas, Ruang, Mapel, Guru FET).
3. **Komponen Halaman Waka Kurikulum:**
   - [`src/pages/waka/DashboardWakaPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx) & `DashboardWaka.css`: 3 kartu metrik flat, saklar putaran & status upacara berproteksi `PasswordModal`, kartu peringatan jurnal terlambat (>30 menit), dan tabel log riwayat putaran.
   - [`src/pages/waka/ScheduleManagementPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx) & `ScheduleManagement.css`: Matriks visual mingguan, baris upacara Senin, kartu KBM berwarna bentrok, modal tambah/edit/hapus jadwal berbasis password Waka, dan banner pre-condition gate.
   - [`src/pages/waka/UploadImportPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/UploadImportPage.jsx) & `UploadImport.css`: Pemilihan putaran target, dropzone 2 PDF (`Jadwal_Kelas.pdf` & `Jadwal_Ruangan.pdf`), penanganan HTTP 202 Accepted, progress bar ekstraksi, dan navigasi otomatis ke `/web/review-import/:id`.
   - [`src/pages/waka/ReviewImportPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx) & `ReviewImport.css`: Polling status ekstraksi (`preview_ready`), 4 kartu metrik (Total, Matched, Unmatched, Conflict), tabel baris hasil ekstraksi, modal resolusi manual per baris (`PATCH .../rows/:row_id`), tombol exclude baris, proteksi commit jika `matched === 0`, dan commit final berpassword.
4. **Integrasi Routing:**
   - Mendaftarkan rute baru di [`src/routes/AppRouter.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/routes/AppRouter.jsx) dan memperbarui breadcrumb matching di [`src/components/layout/TopBar.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx).

### 3. Struktur Berkas yang Dihasilkan pada Fase 3
```
frontend/scp_web/
├── src/
│   ├── pages/
│   │   └── waka/
│   │       ├── DashboardWaka.css
│   │       ├── DashboardWakaPage.jsx
│   │       ├── ScheduleManagement.css
│   │       ├── ScheduleManagementPage.jsx
│   │       ├── UploadImport.css
│   │       ├── UploadImportPage.jsx
│   │       ├── ReviewImport.css
│   │       └── ReviewImportPage.jsx
│   ├── services/
│   │   ├── scheduleApi.js
│   │   └── scheduleImportApi.js
│   └── utils/
│       ├── prerequisiteHelper.js
│       └── timetableHelper.js
```

### 4. Hasil Verifikasi Kualitas Fase 3
1. **ESLint (`npm run lint`):**
   ```
   > scp_web@0.0.0 lint
   > eslint .
   [Result]: 0 errors, 0 warnings (Lolos)
   ```
2. **Kompilasi Produksi (`npm run build`):**
   ```
   > scp_web@0.0.0 build
   > vite build
   ✓ 1769 modules transformed.
   dist/index.html                   0.80 kB │ gzip:   0.43 kB
   dist/assets/index-CGezjO9L.css   83.23 kB │ gzip:  13.98 kB
   dist/assets/index-twoJf9hj.js   483.05 kB │ gzip: 141.36 kB
   ✓ built in 830ms (Lolos)
   ```

---

## Penyelarasan Desain & Penghapusan Logo SCP Sesuai Prototipe

Sebagai tindak lanjut penyesuaian visual agar 100% konsisten dengan prototipe (`frontend/_Prototype/akademik-prototype`), telah dilakukan pembersihan dan harmonisasi visual:
1. **Penghapusan Logo "SCP":**
   - Menghapus badge logo kotak biru bertuliskan `"SCP"` pada [TopBar.jsx](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx) dan menggantikannya dengan teks brand tipografi bersih `"School Class Progress"` sesuai prototipe.
   - Menghapus badge `"SCP ACADEMIC"` pada [LoginPage.jsx](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx) dan menggantikannya dengan teks brand `"School Class Progress"`.
   - Mengubah judul mobile sidebar pada [Sidebar.jsx](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/Sidebar.jsx) dari `"Navigasi SCP"` menjadi `"Menu Navigasi"`.
   - Menyelaraskan teks judul halaman pada [index.html](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/index.html) dan subtitle placeholder pada [AppRouter.jsx](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/routes/AppRouter.jsx) menjadi `"School Class Progress"`.
   - Menghapus prefix string `"SCP"` pada format salinan kredensial akun dan generator password acak di master data.
2. **Standardisasi Palet Warna Sesuai Prototipe (Exness Precision Fintech Palette):**
   - **Primary Accent:** `#FFDE02` (Exness Yellow), hover `#F0CF00`, teks `#0F172A`. Digunakan pada tombol utama interaktif dan focus visible.
   - **Dark / Indicators:** `#0F172A` (Text primary, active border indicator, focus ring, avatar header, pill aktif).
   - **Netral & Permukaan:** `#FFFFFF` (Surface), `#F9FAFB` (Page background), `#F3F4F6` (Surface hover & secondary buttons), `#E5E7EB` (Borders).
   - **Badges:** Varian default/netral menggunakan latar `#F3F4F6` dan teks `#374151` tanpa border (border-0). Varian status: Sukses (`#ECFDF5`/`#047857`), Error (`#FEF2F2`/`#DC2626`), Warning (`#FFFBEB`/`#B45309`).
   - **Eliminasi Warna Arbitrer:** Menghilangkan seluruh warna biru royal arbitrer (`bg-blue-800`, `text-blue-600`, `bg-blue-50`, `text-primary-700`, `bg-primary-50`) dari TopBar, MasterDataPage, GradePromotionPage, Modal Kredensial, dan ProfilePage sehingga seluruh elemen UI sepenuhnya selaras dengan prototipe.

---

## Fase 4: Modul Guru & Kesiswaan — Kalender Mengajar KBM, Jurnal Harian & Presensi Exception-Based

### 1. Tujuan & Ruang Lingkup
Mengimplementasikan modul kegiatan belajar mengajar (KBM) harian untuk peran Guru Mata Pelajaran dan Guru Kesiswaan (Piket):
- Kalender jadwal mengajar guru ter-scoped otomatis (*read-only*) dengan resolusi jam pelajaran dinamis.
- Deteksi dan alert keterlambatan pengisian jurnal (>30 menit sejak KBM selesai).
- Alur pengajuan izin mengajar guru berhalangan hadir beserta delegasi tugas titipan ke meja piket Kesiswaan.
- Pembukaan sesi kelas KBM dengan konsumsi otomatis data perizinan siswa yang disetujui (`meta.approved_leaves`).
- Tabel presensi *exception-based* (seluruh siswa default "Hadir", guru hanya menandai siswa yang absen/sakit/izin/alpa).
- Utilitas kompresi foto dokumentasi kelas berbasis kanvas browser sebelum diunggah melalui multipart `FormData`.
- Penegakan hak eksklusif Guru Kesiswaan sebagai satu-satunya guru pengganti yang sah (`substitute_teacher_id`), serta pencegahan akses ilegal guru lain (HTTP 403 Forbidden).

### 2. Pekerjaan yang Telah Diselesaikan
1. **API Service & Utilitas Kompresi Gambar:**
   - [`src/services/journalApi.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/journalApi.js): Menghubungkan client HTTP ke backend `/api/schedules` (auto-scoped guru), `/api/journals`, `/api/journals/{id}`, pembukaan sesi, penyelesaian atomik multipart `FormData`, dan fallback dataset offline.
   - [`src/utils/imageCompressor.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/imageCompressor.js): Helper fungsi kompresi gambar berbasis HTML5 Canvas untuk meresize foto kamera ponsel/laptop ke resolusi maksimum 1280px dan menghasilkan blob JPEG terkompresi (< 400KB).
2. **Halaman Kalender Jadwal Mengajar Guru:**
   - [`src/pages/teacher/TeacherSchedulePage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx) & [`TeacherSchedule.css`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherSchedule.css):
     - Mode Tampilan Harian: Selektor tab hari (Senin–Jumat) dengan counter jam KBM, penanda Upacara Bendera Senin (07:00–07:45), divider istirahat 1 & 2, serta kartu jadwal dengan badge rombel, mapel, ruangan, dan jam riil.
     - Mode Matriks Mingguan (*Weekly Matrix*): Tabel matriks 5 kolom x 10 slot jam pelajaran berdesain *read-only*.
     - Widget Peringatan Keterlambatan: Banner peringatan jika terdapat sesi KBM yang selesai >30 menit lalu tanpa jurnal selesai.
     - Modal Pengajuan Izin Mengajar: Pilihan alasan (dinas luar, sakit, keperluan pribadi), instruksi tugas titipan siswa, sinkronisasi delegasi piket, dan banner status izin aktif.
3. **Halaman Jurnal KBM & Presensi Siswa Exception-Based:**
   - [`src/pages/teacher/TeacherJournalPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx) & [`TeacherJournal.css`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherJournal.css):
     - Sesi Standby: Kartu ringkasan sesi kelas dengan indikator pulse hijau dan tombol *"Mulai & Buka Kelas Sekarang"*.
     - Integrasi Prefill Izin: Mengonsumsi `meta.approved_leaves` dari respons pembukaan kelas sehingga siswa yang memiliki surat izin resmi otomatis berstatus Sakit atau Izin lengkap dengan badge penanda.
     - Form Topik Pembelajaran: Textarea wajib diisi dengan validasi inline minimal 10 karakter dan indikator counter.
     - Dokumentasi Foto Kelas: Komponen `FileUpload` terhubung kompresi kanvas dengan pratinjau instan dan tombol hapus.
     - Presensi Exception-Based: Bar status kehadiran instan (Hadir, Sakit, Izin, Alpa), tabel siswa dengan segmented toggle button, dan penyaringan payload submission yang hanya memuat siswa non-hadir.
4. **Logika Hak Eksklusif Tim Kesiswaan & Penanganan Jam Kosong:**
   - Banner Mode Guru Pengganti (Kesiswaan) berlatar gelap `#0F172A` dengan aksen kuning `#FFDE02` saat guru Kesiswaan membuka jadwal guru lain yang berhalangan.
   - Kotak instruksi tugas titipan guru asli otomatis ditampilkan untuk dibacakan kepada siswa di kelas.
   - Topik pembelajaran menjadi opsional bagi Guru Kesiswaan.
   - Tombol penandaan kelas berhalangan hadir / jam kosong (*teacher_absent*) oleh Kesiswaan/Waka.
   - Proteksi tampilan 403 `ForbiddenState` jika guru non-kesiswaan mencoba membuka jurnal kelas guru lain.
5. **Navigasi & Routing:**
   - [`src/routes/AppRouter.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/routes/AppRouter.jsx): Menggantikan placeholder dengan halaman `TeacherSchedulePage` dan `TeacherJournalPage`.

### 3. Hasil Verifikasi & Validasi
- **ESLint:** Lulus uji audit kode (`0 errors, 0 warnings`).
- **Production Build:** `vite build` selesai sukses dalam 675ms tanpa peringatan kompilasi.
- **Konsistensi Desain:** 100% selaras dengan Exness Precision Fintech Palette, bersih dari kotak logo "SCP".

---

## Panduan Menjalankan & Menguji Proyek

### 1. Menjalankan Server Development
```bash
# Pindah ke direktori front-end
cd frontend/scp_web

# Jalankan dev server Vite
npm run dev
```
Aplikasi dapat diakses melalui browser di `http://localhost:5173`.

### 2. Menjalankan Audit Kode & Build
```bash
# Pengecekan linter
npm run lint

# Pengujian kompilasi produksi
npm run build
```

### 3. Menguji Akun Demo Multi-Role (Pengujian Mandiri)
Tersedia 1 akun pengujian per peran pengguna yang telah didaftarkan pada backend database dan preset login front-end. Dokumentasi lengkap akun dapat dilihat pada [TEST_ACCOUNTS.md](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/TEST_ACCOUNTS.md).

| Peran | Nama Akun | ID Pengguna (NIS/NIP) | Password | Penugasan |
|:---|:---|:---|:---|:---|
| **Waka Kurikulum** | Waka Kurikulum | `12345678` | `password` | Admin Kurikulum |
| **Guru Pengampu** | Drs. Ahmad Fauzi, M.Pd. | `197803122005011002` | `password123` | Wali Kelas X-RPL-1 |
| **Guru Kesiswaan** | Budi Santoso, M.Kom. | `198211102008011005` | `password123` | Tim Kesiswaan & Piket |
| **Siswa** | Aisyah Putri Ramadhani | `2024001` | `password123` | Siswa X-RPL-1 |
| **Orang Tua** | Bambang Sulistyo | `W-2024001` | `password123` | Wali Aisyah |

**Metode Pengujian:**
1. **Halaman Login (`/login`):** Pilih peran pada radio button preset, lalu klik *"Masuk ke Akun (API)"* atau *"Masuk Cepat (Demo Offline)"*.
2. **TopBar Quick Switcher:** Saat sudah login, buka dropdown profil di pojok kanan atas, lalu klik peran pada bagian *"Uji Cepat Peran (UKK)"* untuk berpindah peran tanpa logout.

---

## Rencana Tahapan Berikutnya (Fase 5)

**Fokus Utama Fase 5: Modul Perizinan Siswa & Monitoring Kehadiran Sekolah**
1. **API Service Perizinan (`leaveApi.js`):** Integrasi endpoint `/api/leave-requests` dan `/api/attendances`.
2. **Form Pengajuan Izin Siswa/Orang Tua:** Form dinamis dengan pilihan multi-hari (`tidak_masuk`) vs izin keluar di jam sekolah (`keluar_sekolah`).
3. **Pusat Verifikasi Izin Kesiswaan & Wali Kelas:** Layar persetujuan/penolakan surat izin siswa dengan preview bukti lampiran.
4. **Layar Monitoring Kehadiran Institusi:** Matriks pemantauan kehadiran harian/mingguan untuk Waka, Kesiswaan, dan Wali Kelas.

