# SCP Web — Development Progress & Phase Documentation

Dokumen ini adalah catatan resmi riwayat pengembangan (*living document*) untuk aplikasi Front-End Website **School Class Project (SCP)** di direktori `frontend/scp_web`. Dokumen ini mencatat detail arsitektur, keputusan teknis, daftar komponen, file yang dibangun, serta hasil verifikasi dari setiap fase pengerjaan.

---

## Ringkasan Status Proyek

| Fase | Nama Fase / Milestone | Status | Verifikasi (Lint & Build) |
|:---:|:---|:---:|:---:|
| **Fase 0** | Persiapan Fondasi, Standardisasi Desain & Arsitektur | **SELESAI** | 0 Error / 0 Warning |
| **Fase 1** | Autentikasi, Profil Pengguna, Sesi Sanctum, Layout Shell, & Route Guarding | **SELESAI** | 0 Error / 0 Warning (Build: 723ms) |
| **Fase 2** | Master Data & Manajemen Pengguna (Admin & Pimpinan) | *Menunggu Rencana Kerja* | - |
| **Fase 3** | KBM, Jadwal Pelajaran, Presensi Siswa & Guru, RFID Scanner | *Pending* | - |
| **Fase 4** | Penilaian Akademik, Raport, Kurikulum, & Portal Siswa | *Pending* | - |
| **Fase 5** | Dashboard Khusus Per Role, Statistik Realtime, & Laporan Terpadu | *Pending* | - |
| **Fase 6** | Polish Akhir, Optimasi Performa, Aksesibilitas, & Kesiapan Produksi | *Pending* | - |

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

## Rencana Tahapan Berikutnya (Fase 2)

**Fokus Utama Fase 2: Master Data & Manajemen Pengguna**
1. **Tahun Ajaran & Semester:** Manajemen data tahun ajaran, set status aktif, dan semester ganjil/genap.
2. **Data Kelas:** Manajemen kelas, tingkat, jurusan, dan penetapan wali kelas.
3. **Mata Pelajaran:** Manajemen mata pelajaran, kode mapel, kelompok, dan KKM standar.
4. **Manajemen Pengguna & Guru:** Daftar guru, penetapan NIP, status kepegawaian, dan penetapan role tambahan (Kesiswaan / Wali Kelas).
5. **Manajemen Siswa:** Daftar siswa, penetapan NISN/NIS, kelas, kartu RFID ID, dan mutasi kelas.
