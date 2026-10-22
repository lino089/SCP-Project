# Master Roadmap Implementasi Front-End Website SCP

**School Class Progress (SCP) — Production-Ready Implementation Plan**  
**Acuan Utama:** PRD v4.4, Master Plan Backend Fase 0–8, Dokumen Analisis `frontend/scp_website/`, dan Kode Prototype `frontend/_Prototype/akademik-prototype`  
**Target Workspace:** `frontend/scp_web/`  
**Target Platform:** Web Desktop & Tablet (Prioritas Tahap 1)  
**Versi Dokumen:** 1.0 (Final Architecture Roadmap)  

---

## 1. Ringkasan Eksekutif & Ruang Lingkup Proyek

### 1.1 Tujuan Proyek
Tujuan dari implementasi ini adalah membangun aplikasi **Front-End Website School Class Progress (SCP)** yang stabil, aman, responsif, berkinerja tinggi, dan siap digunakan di lingkungan *production* (khususnya untuk Uji Kompetensi Keahlian / UKK SMK Negeri 1 Bantul). Aplikasi web ini bertindak sebagai antarmuka pengguna tunggal bagi Waka Kurikulum, Guru (termasuk Guru Piket Kesiswaan & Wali Kelas), Siswa, dan Orang Tua dalam mengelola siklus operasional akademik sekolah.

### 1.2 Kondisi Awal Sistem (Baseline State)
1. **Backend API (`scp/`):**
   - Dibangun dengan Laravel 13, PostgreSQL, dan antrean worker Python (pustaka `pdfplumber` untuk FET parser dan evaluasi kuis AI).
   - Telah menyelesaikan Fase 0 hingga Fase 8 dengan status **100% lulus seluruh unit & feature automated tests**.
   - Menyediakan 40+ endpoint RESTful terotentikasi via Laravel Sanctum (kuota rate limit 60 request/menit).
2. **Prototype UI/UX (`frontend/_Prototype/akademik-prototype/`):**
   - Telah menyediakan desain visual bergaya modern-institusional (Exness-inspired theme) menggunakan React 19, Tailwind CSS v4, Lucide React, dan token desain rapi.
   - Menyediakan 14 komponen UI bersama (`components/shared`) dan 12 halaman web per peran.
   - *Status fungsional:* Masih menggunakan mock dataset lokal (`dummyData.js`) dan belum terhubung ke API backend riil. Modul kuis AI masih memiliki kesenjangan besar (belum ada form 3 mode pembuatan soal, preview edit butir soal, dan review submission siswa).
3. **Workspace Target (`frontend/scp_web/`):**
   - Saat ini masih berupa inisialisasi awal (*Vite starter template*) dengan dependensi dasar `react` dan `react-dom`.
   - Seluruh infrastruktur build, Tailwind CSS v4, routing, Axios client, context state, dan komponen akan dimigrasikan dan dibangun di folder ini.

### 1.3 Asumsi dan Prinsip Kerja
1. **Zero Guesswork:** Setiap tugas memiliki referensi endpoint, payload request/response, lokasi berkas, dan kriteria keberhasilan yang terukur.
2. **Strict Incremental Execution:** Pengerjaan wajib mengikuti urutan dari Fase 0 hingga Fase 9. Tidak melompati fase karena layer di atasnya bergantung langsung pada kestabilan layer fondasi di bawahnya.
3. **Preservasi Logika Backend:** Front-End wajib mematuhi aturan bisnis yang telah ditegakkan backend:
   - Sentralisasi mutlak jadwal di Waka Kurikulum (guru bersifat *read-only*).
   - Presensi bersifat *exception-based* (hanya mengirim siswa tidak hadir).
   - Hak eksklusif pengganti mengajar hanya dipegang Guru Kesiswaan (`substitute_teacher_id`).
   - Step-up authentication (verifikasi ulang password akun Waka pada aksi sensitif).
   - Kuis AI melalui tahap *draft review* sebelum dipublikasikan dan hasil hanya dapat dilihat setelah status `published_result`.

---

## 2. Peta Jalan Tahapan (Phased Roadmap Overview)

Pengembangan Front-End dibagi ke dalam 10 fase terstruktur:

```
┌────────────────────────────────────────────────────────────────────────┐
│               ROADMAP IMPLEMENTASI FRONT-END WEBSITE SCP               │
└────────────────────────────────────────────────────────────────────────┘

 [Fase 0: Fondasi Proyek, Konfigurasi Lingkungan, & Setup Design System]
   ├── Migrasi Tailwind v4, Design Tokens, & Instalasi Dependensi Inti
   └── Standardisasi Komponen Bersama (Button, Input, Table, Modal, dsb.)
        │
 [Fase 1: Autentikasi, Profil Pengguna, Sesi Sanctum, & Route Guarding]
   ├── Axios Interceptor (Bearer Token, 401 Redirect, 429 Retry-After)
   ├── Login Form, Google SSO, must_change_password Flow, & Logout
   ├── Profil Mandiri: OTP Email, OTP WhatsApp Twilio, Google Link
   └── Route Guarding Dinamis berbasis user.role & user.assignments
        │
 [Fase 2: Modul Waka — Master Data Akademik & Siklus Promosi]
   ├── CRUD Kelas, Ruang, Mapel, Guru (+ fet_staff_id), dan Siswa
   ├── Modal Tampilan Kredensial Awal Akun Baru (Initial Password Modal)
   ├── Manajemen Penugasan Guru (Kesiswaan & Wali Kelas)
   └── Kenaikan Kelas Massal, Siswa Tinggal Kelas (Hold-back), & Kelulusan
        │
 [Fase 3: Modul Waka — Pengelolaan Jadwal Terpusat & Import PDF FET]
   ├── Pengecekan Prasyarat Master Data (Pre-condition Gate 422)
   ├── Matriks Jadwal Mingguan + Resolusi Jam Riil Dinamis (Period Templates)
   ├── Mutasi Jadwal Manual + Password Re-confirmation (Step-Up Auth)
   ├── Alur Import PDF: Upload 2 Berkas -> Polling Status Asinkron (202)
   └── Review Import Dinamis (/web/review-import/:id): Resolusi, Exclude, Commit
        │
 [Fase 4: Modul Guru & Kesiswaan — Kalender KBM, Jurnal & Presensi]
   ├── Kalender Mengajar Guru (Read-Only) + Alert Keterlambatan Jurnal (30 Menit)
   ├── Buka Sesi KBM Ongoing + Auto-Prefill Siswa Izin (meta.approved_leaves)
   ├── Penyelesaian Jurnal Atomik: Kompresi Foto ~800px + Presensi Exception-Based
   └── Penanganan Guru Izin: Hak Eksklusif Pengganti Kesiswaan & Tandai Absent
        │
 [Fase 5: Modul Perizinan Siswa & Monitoring Kehadiran Sekolah]
   ├── Pengajuan Izin Siswa (2 Tipe x 2 Kategori + Upload Dokumen Bukti)
   ├── Edit Izin Siswa Selama Status Pending & Pembatalan Izin
   ├── Verifikasi Persetujuan Izin (Approve/Reject) Khusus Guru Kesiswaan
   └── Rekapitulasi Presensi Multi-Role (Waka, Kesiswaan, Wali Kelas, Siswa, Ortu)
        │
 [Fase 6: Modul Kuis Berbantuan AI & Workflow Evaluasi Asinkron]
   ├── Inisialisasi Kuis Guru (draft_review)
   ├── Metode 1: Form Prompt AI dengan Validasi Komposisi Soal Ketat (202)
   ├── Metode 2: Ekstraksi Dokumen Materi (PDF/TXT maks 5MB) + Penanda Ambigu
   ├── Metode 3: Tambah / Edit / Hapus Butir Soal Manual pada Tahap Preview
   ├── Publikasi Kuis (published) & Pengerjaan Siswa (Multi-Attempt & Deadline)
   └── Review Submissions Guru, Override Nilai/Feedback AI, & Rilis Hasil
        │
 [Fase 7: Modul Portal Siswa & Monitoring Orang Tua]
   ├── Beranda Siswa: Rekap Presensi Mandiri, Jadwal Hari Ini, Kuis Aktif
   ├── Riwayat Perizinan & Hasil Nilai Kuis Siswa
   └── Monitoring Orang Tua: Rekap Absensi Anak, Izin, & Capaian Kuis (published_result)
        │
 [Fase 8: Penyempurnaan UI/UX, Aksesibilitas, & Keamanan Klien]
   ├── Penerapan Skeleton Loading & Empty State Berkonteks di Seluruh Halaman
   ├── Halaman Akses Ditolak (403 Forbidden State) & Global Error Boundary
   ├── Debounce Search Input (300ms) & Filter Cascading Dinamis
   └── Sanitasi Input, Penanganan XSS, & Audit Kontras Warna WCAG AA
        │
 [Fase 9: Pengujian Terpadu End-to-End & Kesiapan Production]
   ├── Pengujian Integrasi Seluruh Peran (Waka, Guru, Kesiswaan, Wali Kelas, Siswa, Ortu)
   ├── Verifikasi Acceptance Criteria UKK (PRD Bagian 10)
   ├── Optimasi Bundle Build Vite, Konfigurasi Server (Nginx SPA Fallback)
   └── Checklist Kesiapan Go-Live / Production Deployment
```

---

## 3. Rincian Pelaksanaan per Fase

---

### FASE 0: Fondasi Proyek, Konfigurasi Lingkungan, & Setup Design System

#### 1. Tujuan Fase
Menyiapkan *environment* pengembangan di folder `frontend/scp_web/`, menginstal seluruh dependensi esensial, memigrasikan token desain Tailwind CSS v4 dari prototype, serta menstandarisasi 14 komponen UI bersama (*shared components*) yang siap menerima props data riil dan status penanganan kesalahan.

#### 2. Kondisi Awal
- `frontend/scp_web/` hanya memiliki template Vite standar tanpa pustaka UI, routing, atau HTTP client.
- Aset styling, warna tokens (`tokens.css`), reset global (`global.css`), dan komponen atomik telah teruji secara visual di `frontend/_Prototype/akademik-prototype/`.

#### 3. Daftar Pekerjaan
1. **Instalasi Dependensi Inti (`package.json`):**
   - Pasang: `react-router-dom@^7.0.0`, `@tailwindcss/vite@^4.0.0`, `tailwindcss@^4.0.0`, `lucide-react@^0.511.0`, `axios@^1.7.0`.
   - Konfigurasi `vite.config.js` untuk mendukung plugin Tailwind CSS v4.
2. **Penyusunan Arsitektur Direktori:**
   - Bentuk folder: `src/api/`, `src/components/common/`, `src/components/layout/`, `src/components/feedback/`, `src/components/modals/`, `src/context/`, `src/hooks/`, `src/pages/`, `src/routes/`, `src/utils/`, `src/styles/`.
3. **Migrasi Design Tokens & Styling:**
   - Salin dan selaraskan `tokens.css` dan `global.css` ke `src/styles/`.
   - Pastikan variabel warna tema Exness-inspired (neutral, slate, emerald, amber, rose, indigo) aktif.
4. **Standardisasi Komponen Bersama (`src/components/common/`):**
   - `Button.jsx`: Dukung varian primary, secondary, danger, ghost, loading spinner, disabled state.
   - `Input.jsx`: Tambahkan toggle visibilitas password (eye icon), error text inline dari validasi 422.
   - `Select.jsx`: Opsi disabled, hint text, error styling.
   - `Table.jsx`: Sesuaikan agar menerima prop `meta` paginasi backend (`current_page`, `last_page`, `total`, `per_page`) serta callback `onPageChange(page)`.
   - `Modal.jsx` & `PasswordModal.jsx`: Trap focus keyboard, pencegahan body scroll, handling pesan error password salah (422).
   - `Badge.jsx`: Variabel varian lengkap (success, warning, error, neutral, default) + varian dot animasi pulse.
   - `Tabs.jsx`: Tab dengan badge counter angka, layout scroll responsif horizontal.
   - `FileUpload.jsx`: Drag-and-drop, validasi tipe ekstensi & batas ukuran berkas (2MB/5MB/10MB), tombol hapus berkas terpilih.
   - `SearchInput.jsx`: Terintegrasi internal debounce (300ms) agar tidak memicu fetch berlebihan.
   - `ProgressBar.jsx`: Indikator persentase linier untuk proses parsing.
5. **Standardisasi Komponen Status (`src/components/feedback/`):**
   - `SkeletonRow.jsx` & `SkeletonCard.jsx`: Animasi loading placeholder berbentuk kerangka tabel dan kartu metrik.
   - `EmptyState.jsx`: Pembeda kondisi "Data Kosong" vs "Hasil Filter Tidak Ditemukan" dengan tombol CTA.
   - `ErrorState.jsx`: Kartu kesalahan dengan tombol aksi "Coba Muat Ulang".
   - `ForbiddenState.jsx`: Halaman peringatan HTTP 403 jika hak akses tidak terpenuhi.

#### 4. Prioritas Pekerjaan
- **Wajib:** Instalasi dependensi, integrasi Tailwind v4, Table dengan paginasi backend, Input dengan pesan error inline, Modal, PasswordModal.
- **Penting:** Skeleton loader, SearchInput debounce, FileUpload batas ukuran.
- **Tambahan:** Animasi transisi tabs, sound effect opsional (diabaikan).

#### 5. Dependensi
Tidak ada (tahap awal).

#### 6. Hasil yang Diharapkan
Proyek `frontend/scp_web/` dapat dijalankan via `npm run dev` tanpa error, seluruh komponen UI atomik tersedia dan terisolasi dengan dokumentasi props yang jelas.

#### 7. Kriteria Keberhasilan (Acceptance Criteria)
- [ ] `npm run build` di `frontend/scp_web` sukses menghasilkan aset distribusi tanpa peringatan sintaks.
- [ ] Seluruh komponen atomik merender visual yang identik dengan prototype.
- [ ] Komponen `Table` dapat menerima array data kosong dan merender `EmptyState` secara rapi.

#### 8. Pengujian dan Validasi
- Uji responsivitas komponen pada resolusi Desktop (1440px), Laptop (1024px), dan Tablet (768px).
- Verifikasi bahwa input password dapat menampilkan/menyembunyikan karakter saat ikon mata diklik.

#### 9. Risiko dan Kendala
- *Risiko:* Perubahan sintaks konfigurasi Tailwind CSS v4 dibanding v3.
- *Mitigasi:* Menggunakan `@tailwindcss/vite` resmi dan mendeklarasikan theme variables di CSS file utama.

---

### FASE 1: Autentikasi, Profil Pengguna, Sesi Sanctum, & Route Guarding

#### 1. Tujuan Fase
Membangun fondasi komunikasi API, sesi pengguna berbasis token Sanctum, proteksi rute halaman per peran, halaman login dengan Single Sign-On (Google), alur wajib ganti password pertama kali, dan verifikasi kontak mandiri.

#### 2. Kondisi Awal
- Komponen UI bersama telah siap dari Fase 0.
- Endpoint backend autentikasi telah aktif: `POST /api/login`, `POST /api/auth/google`, `GET /api/me`, `POST /api/logout`, kontak OTP endpoints (`/api/me/email`, `/api/me/phone`), dan endpoint baru ganti password `PATCH /api/me/password`.

#### 3. Daftar Pekerjaan
1. **Konfigurasi HTTP Client (`src/api/axiosClient.js`):**
   - Konfigurasi `baseURL` membaca `import.meta.env.VITE_API_BASE_URL`.
   - Request Interceptor: Menyematkan header `Authorization: Bearer <token>`.
   - Response Interceptor: Tangani global error (401 redirect login, 429 toast cooldown, 422 parsing field errors).
2. **State Global Autentikasi (`src/context/AuthContext.jsx`):**
   - State: `user` (data profil dari `/api/me`), `token`, `isAuthenticated`, `isLoading`.
   - Helper Methods:
     - `hasRole(role)`: Memeriksa `user.role === role`.
     - `isKesiswaan()`: Memeriksa apakah `user.assignments.some(a => a.type === 'kesiswaan')`.
     - `isWaliKelas(classId?)`: Memeriksa apakah guru memiliki penugasan `wali_kelas`.
     - `login(credentials)`, `logout()`, `updateUserProfile(data)`.
3. **Shell Tata Letak (`src/components/layout/WebLayout.jsx`):**
   - `Sidebar.jsx`: Menu dinamis yang merender rute sesuai peran dan penugasan guru secara kondisional.
   - `TopBar.jsx`: Profil dropdown, indikator peran aktif, tombol logout, notifikasi.
4. **Halaman Login Terpadu (`src/pages/auth/LoginPage.jsx`):**
   - Form input ID Pengguna (`username` / `nis_nip`), password, auto-detect `device_name`.
   - Tombol Google SSO (integrasi Google Identity Services SDK `id_token` -> `POST /api/auth/google`).
   - Penanganan respons: jika `must_change_password === true`, tampilkan form penggantian kata sandi pertama kali sebelum masuk ke dashboard.
5. **Halaman Profil & Keamanan (`src/pages/profile/ProfilePage.jsx`):**
   - Tab 1: Ringkasan Identitas (Nama, NIP/NIS, Email, No HP, Penugasan Tambahan).
   - Tab 2: Verifikasi Kontak Mandiri:
     - Email OTP (`POST /api/me/email` & `POST /api/me/email/verify`).
     - WhatsApp OTP via Twilio (`POST /api/me/phone` & `POST /api/me/phone/verify`).
     - Google Link (`POST /api/me/google-link`).
   - Tab 3: Ubah Kata Sandi (`PATCH /api/me/password`): old_password, new_password (min 8 char), confirm_password.
6. **Pelindung Rute (`src/routes/ProtectedRoute.jsx`):**
   - Blokir akses tanpa token -> redirect ke `/login`.
   - Blokir akses beda peran -> render `ForbiddenState (403)` dengan pesan informatif.

#### 4. Prioritas Pekerjaan
- **Wajib:** Axios client, AuthContext, ProtectedRoute, Halaman Login, Alur must_change_password, Logout.
- **Penting:** Ubah kata sandi profil, Verifikasi OTP Email & WA, Sidebar dinamis multi-role.
- **Tambahan:** Google SSO OAuth callback client.

#### 5. Dependensi
- Bergantung pada penyelesaian **Fase 0**.
- Bergantung pada ketersediaan endpoint backend `PATCH /api/me/password`.

#### 6. Hasil yang Diharapkan
Pengguna dapat login dengan akun Waka, Guru, Siswa, atau Orang Tua; token tersimpan aman; pengguna diarahkan ke beranda sesuai perannya; menu sidebar hanya menampilkan fitur yang diizinkan; rute terlindungi penuh dari akses ilegal.

#### 7. Kriteria Keberhasilan (Acceptance Criteria)
- [ ] Login sukses mengembalikan token Bearer, disimpan di storage lokal, dan memuat data `GET /api/me`.
- [ ] Pengguna dengan `must_change_password = true` dipaksa mengubah kata sandi sebelum dapat mengakses fitur lain.
- [ ] Siswa yang mencoba mengetikkan URL `/web/dashboard` di address bar langsung dicegah dan disajikan layar 403 Forbidden.
- [ ] Logout berhasil menghapus token lokal dan membatalkan token di server via `POST /api/logout`.

#### 8. Pengujian dan Validasi
- Uji coba login dengan masing-masing dari 4 peran default (Waka, Guru, Siswa, Orang Tua).
- Uji coba memasukkan password salah pada form ganti password -> pastikan pesan error 422 muncul di bawah field input yang tepat.

#### 9. Risiko dan Kendala
- *Risiko:* Token kedaluwarsa saat pengguna sedang mengisi form panjang.
- *Mitigasi:* Interceptor 401 menyimpan draft data ke local cache sementara sebelum redirect ke login.

---

### FASE 2: Modul Waka Kurikulum — Master Data Akademik & Siklus Promosi

#### 1. Tujuan Fase
Mengimplementasikan modul pengelolaan Master Data institusi (Kelas, Ruangan, Mata Pelajaran, Guru beserta `fet_staff_id`, dan Siswa beserta auto-provisioning akun orang tua) serta alur kenaikan kelas dan kelulusan siswa.

#### 2. Kondisi Awal
- Fase 1 selesai (Waka telah dapat login dan mengakses rute khusus role `vice_principal`).
- Endpoint backend Master Data telah siap: `/api/classes`, `/api/rooms`, `/api/subjects`, `/api/teachers`, `/api/students`, `/api/class-promotions`, dan `/api/students/{id}/hold-back`.

#### 3. Daftar Pekerjaan
1. **API Service Master Data (`src/api/masterDataApi.js`):**
   - Fungsi CRUD untuk 5 pilar master data: classes, rooms, subjects, teachers, students.
   - Fungsi penugasan guru (`assignRole`, `revokeRole`).
   - Fungsi promosi (`holdBackStudent`, `executePromotions`).
2. **Halaman Master Data Terpadu (`src/pages/waka/MasterDataPage.jsx`):**
   - **Tab 1: Kelas (`classes`):**
     - Tabel daftar kelas (Tingkat 10/11/12, Nama Rombel, Kelas Kenaikan).
     - Modal Tambah & Edit Kelas (`name`, `level`).
     - Modal Hapus Kelas (Soft-delete dengan proteksi 409 jika terikat jadwal aktif).
   - **Tab 2: Ruangan (`rooms`):**
     - Tabel ruangan (Nama Ruang, Kapasitas Siswa).
     - Modal Tambah, Edit, dan Hapus Ruangan (Proteksi 409 jika terikat jadwal).
   - **Tab 3: Mata Pelajaran (`subjects`):**
     - Tabel mata pelajaran.
     - Modal Tambah, Edit, dan Hapus Mapel (Proteksi 409 jika terikat jadwal).
   - **Tab 4: Guru (`teachers`):**
     - Tabel guru (Nama, NIP/NISN, Email, `fet_staff_id`, Badge Penugasan Tambahan).
     - Modal Tambah Guru: Wajib menyertakan input field `fet_staff_id` (kunci pencocokan FET).
     - **Modal Tampilan Kredensial Awal (Initial Password Modal):** Menampilkan username & random password 8-karakter yang dikembalikan respons `POST /api/teachers` dengan tombol salin.
     - Modal Penugasan Tambahan Guru: Toggle Kesiswaan dan Wali Kelas (pilih `class_id`).
   - **Tab 5: Siswa (`students`):**
     - Tabel siswa (Nama, NIS, Kelas, Nama Akun Wali/Orang Tua).
     - Filter tingkat kelas dan rombel kelas.
     - Modal Tambah Siswa: Memilih kelas siswa. Menampilkan modal kredensial akun siswa dan akun orang tua (`P-NIS`) beserta kata sandinya.
3. **Halaman Kenaikan Kelas & Kelulusan (`src/pages/waka/GradePromotionPage.jsx`):**
   - Bagian 1: Konfigurasi Pemetaan Kelas Tujuan (`next_class_id`) per rombel.
   - Bagian 2: Tabel Siswa dengan Penanda Tinggal Kelas (*Hold-Back*).
     - Tombol toggle status tinggal kelas (`POST /api/students/{id}/hold-back`).
   - Bagian 3: Tombol Eksekusi Promosi Massal (`POST /api/class-promotions`).
     - Modal konfirmasi bertingkat sebelum eksekusi.
     - Tampilan rekapitulasi hasil promosi (Jumlah naik kelas, tinggal kelas, dan lulus).

#### 4. Prioritas Pekerjaan
- **Wajib:** CRUD Kelas, Ruang, Mapel, Guru (+ fet_staff_id), Siswa, Initial Password Modal, Penugasan Guru.
- **Penting:** Pemetaan next_class_id, penandaan hold-back, eksekusi promosi massal.
- **Tambahan:** Filter cascading jurusan/tingkat pada tab siswa.

#### 5. Dependensi
Bergantung pada penyelesaian **Fase 1** (Otorisasi Waka).

#### 6. Hasil yang Diharapkan
Waka Kurikulum dapat mengelola seluruh data master sekolah, mendaftarkan guru beserta ID FET, mendaftarkan siswa dan memperoleh kredensial akun awal, serta mengeksekusi siklus akhir tahun ajaran secara aman.

#### 7. Kriteria Keberhasilan (Acceptance Criteria)
- [ ] Pembuatan akun guru baru menampilkan modal kata sandi acak yang dapat disalin satu klik.
- [ ] Atribut `fet_staff_id` berhasil tersimpan di server dan muncul pada tabel guru.
- [ ] Penghapusan kelas yang sedang digunakan pada jadwal aktif menampilkan modal peringatan konflik HTTP 409 tanpa crash.
- [ ] Promosi kelas massal berhasil memindahkan siswa kelas 10 dan 11 ke kelas berikutnya serta menandai kelulusan kelas 12.

#### 8. Pengujian dan Validasi
- Buat entitas baru pada kelima tab master data dan verifikasi kemunculannya di tabel dengan paginasi.
- Uji coba menghapus data yang terikat jadwal aktif untuk memvalidasi penanganan pesan 409.

#### 9. Risiko dan Kendala
- *Risiko:* Password acak pengguna hilang jika Waka tidak sengaja menutup modal tanpa menyalin.
- *Mitigasi:* Berikan tombol konfirmasi eksplisit "Saya telah menyalin kata sandi ini" sebelum modal dapat ditutup.

---

### FASE 3: Modul Waka Kurikulum — Pengelolaan Jadwal Terpusat & Import Jadwal PDF FET

#### 1. Tujuan Fase
Mengimplementasikan modul inti kurikulum: kalender matriks jadwal mingguan Waka, resolusi jam pelajaran dinamis, mutasi jadwal manual berbasis kata sandi, validasi prasyarat master data, serta alur komprehensif import otomatis 2 berkas PDF FET (Upload -> Polling Status -> Review/Resolusi -> Commit).

#### 2. Kondisi Awal
- Master Data telah tersedia dari Fase 2.
- Backend menyediakan: `/api/academic-settings`, `/api/academic-settings/monday-status`, `/api/cycle-history`, `/api/schedules`, dan `/api/schedule-imports` endpoints.

#### 3. Daftar Pekerjaan
1. **API Service Jadwal & Import (`src/api/scheduleApi.js` & `importApi.js`):**
   - Fungsi setting akademik (active_cycle, monday-status dengan password).
   - Fungsi schedules (list dengan query cycle & day integer, store, update, destroy dengan password).
   - Fungsi schedule-imports (upload multipart, show detail, resolve row, confirm commit, cancel import).
2. **Dashboard Kurikulum Waka (`src/pages/waka/DashboardWakaPage.jsx`):**
   - Saklar Putaran Aktif (Putaran 1 vs Putaran 2) dilindungi `PasswordModal`.
   - Saklar Status Upacara Hari Senin (Aktif/Nonaktif) dilindungi `PasswordModal`.
   - Tabel Log Riwayat Putaran (`cycle_history`) berpaginasi.
   - Widget Peringatan Keterlambatan Jurnal (`missing_journal` > 30 menit).
3. **Pemeriksaan Prasyarat Master Data (Pre-condition Gate):**
   - Service helper untuk memeriksa ketersediaan Classes, Rooms, Subjects, Teachers, dan Guru dengan `fet_staff_id`.
   - Menampilkan banner peringatan di bagian atas halaman jadwal jika terdapat master data yang kosong, serta menonaktifkan tombol tambah/import.
4. **Halaman Manajemen Jadwal Pelajaran (`src/pages/waka/ScheduleManagementPage.jsx`):**
   - Selektor Putaran (Putaran 1 & Putaran 2) dan Selektor Hari (Senin–Jumat).
     - *Konversi Data:* Mapping teks hari ke ISO Day integer (`Senin` = 1, `Jumat` = 5).
   - Matriks Visual Jadwal Mingguan:
     - Menampilkan nomor slot (`period_number`), durasi blok (`duration_periods`), serta **jam riil hasil resolusi** (`resolved_times.start_time` - `end_time`).
     - Kartu jadwal menampilkan: Nama Mapel, Guru Pengampu, Kelas, dan Ruangan.
   - Deteksi Bentrok Visual: Kartu jadwal berwarna merah jika terjadi tabrakan ruang/guru.
   - Modal Tambah & Edit Jadwal Manual: Dilindungi input kata sandi Waka (`password`).
   - Modal Hapus Jadwal: Dilindungi input kata sandi Waka (Ditolak 409 jika sudah ada jurnal).
5. **Halaman Unggah Berkas PDF FET (`src/pages/waka/UploadImportPage.jsx`):**
   - Form pemilihan target putaran (`cycle_type: 1|2`).
   - Area unggah 2 berkas PDF: `file_kelas` dan `file_ruangan` (maksimal 10MB per file).
   - Validasi kelayakan sebelum upload.
   - Pengiriman multipart -> menerima respons HTTP 202 Accepted beserta `data.id`.
   - Navigasi otomatis ke rute dinamis: `/web/review-import/:id`.
6. **Halaman Tinjauan & Resolusi Import Jadwal (`src/pages/waka/ReviewImportPage.jsx`):**
   - Membaca parameter ID dari URL (`useParams()`).
   - Polling status import berkala (interval 3 detik): `uploaded` -> `parsing` -> `preview_ready`.
     - Tampilkan progress bar interaktif selama status masih `parsing`.
   - Saat status `preview_ready`:
     - Tampilkan 4 Kartu Metrik: Total Baris, Baris Matched (Hijau), Unmatched (Merah), Conflict (Kuning).
     - Tabel daftar baris hasil ekstraksi.
     - Modal Resolusi Manual per Baris: Memetakan ulang ID Kelas, Guru (FET Staff ID), Ruang, atau Mapel (`PATCH /api/schedule-imports/{id}/rows/{row_id}`).
     - Tombol *Exclude / Abaikan Baris* untuk mengecualikan baris tertentu.
     - **Proteksi Commit Kosong:** Tombol *Terapkan Jadwal (Commit)* dinonaktifkan jika `matched_count === 0`.
     - Konfirmasi Final Commit: Memunculkan `PasswordModal`. Mengeksekusi soft-delete jadwal lama putaran terkait dan menerapkan jadwal baru.
     - Tombol Batalkan Import: Menghapus batch import dan membersihkan berkas via `DELETE /api/schedule-imports/{id}`.

#### 4. Prioritas Pekerjaan
- **Wajib:** Matriks jadwal mingguan, resolusi jam dinamis, mutasi jadwal + password, upload 2 PDF, review import dinamis, resolusi baris, commit final.
- **Penting:** Deteksi bentrok lokal, polling status asinkron, proteksi master data kosong.
- **Tambahan:** Filter pencarian teks guru/mapel pada matriks jadwal.

#### 5. Dependensi
Bergantung pada **Fase 1** dan **Fase 2** (Master data harus terisi).

#### 6. Hasil yang Diharapkan
Waka Kurikulum dapat menyusun jadwal secara manual dengan proteksi password serta dapat mengimpor berkas PDF jadwal FET secara mulus hingga terbit jadwal baru per putaran tanpa merusak riwayat jurnal lama.

#### 7. Kriteria Keberhasilan (Acceptance Criteria)
- [ ] Jadwal pada hari Senin dengan status upacara aktif menampilkan jam pelajaran pertama mulai pukul 08:00 WIB, sedangkan saat upacara nonaktif mulai 07:15 WIB.
- [ ] Input jadwal manual dengan password salah ditolak dengan status HTTP 422 dan pesan error yang jelas.
- [ ] Proses upload 2 PDF berpindah ke halaman `/web/review-import/:id`, melakukan polling hingga siap, dan memungkinkan resolusi baris tidak cocok.
- [ ] Tombol commit import PDF dinonaktifkan jika matched_count bernilai 0.
- [ ] Commit sukses meng-soft delete jadwal putaran terkait dan menggantikannya dengan baris baru berstatus `source: imported`.

#### 8. Pengujian dan Validasi
- Unggah sepasang PDF contoh FET dan pantau transisi status dari parsing hingga preview_ready.
- Lakukan resolusi manual pada 1 baris berstatus unmatched dan verifikasi statusnya berubah menjadi matched.
- Lakukan pengujian bentrok: Coba masukkan jadwal guru yang sama di slot dan hari yang sama.

#### 9. Risiko dan Kendala
- *Risiko:* Proses parsing PDF di queue worker memakan waktu lebih lama dari toleransi pengguna.
- *Mitigasi:* Tampilkan animasi skeleton dan indikator progress teks dinamis ("Memproses koordinat tabel FET...").

---

### FASE 4: Modul Guru & Kesiswaan — Kalender KBM, Jurnal Mengajar, & Presensi Exception-Based

#### 1. Tujuan Fase
Mengimplementasikan modul kegiatan belajar mengajar harian: kalender jadwal mengajar guru (read-only), pembukaan sesi kelas KBM, penanganan presensi berbasis pengecualian (*exception-based*), kompresi foto dokumentasi KBM, serta penegakan hak eksklusif Guru Kesiswaan sebagai satu-satunya guru pengganti yang sah.

#### 2. Kondisi Awal
- Jadwal pelajaran telah terisi dari Fase 3.
- Backend menyediakan: `GET /api/schedules` (auto-scoped guru), `GET /api/journals`, `POST /api/journals`, `PUT /api/journals/{id}`, dan `PATCH /api/journals/{id}`.

#### 3. Daftar Pekerjaan
1. **API Service Jurnal & Presensi (`src/api/journalApi.js`):**
   - Fungsi membuka jurnal (`openJournal` -> kembalikan `approved_leaves`).
   - Fungsi menyelesaikan jurnal (`completeJournal` multipart foto, topik, exceptions array).
   - Fungsi menandai absent (`markTeacherAbsent`).
2. **Halaman Kalender Jadwal Mengajar Guru (`src/pages/teacher/TeacherSchedulePage.jsx`):**
   - Kalender Harian & Mingguan ter-scoped pada jadwal guru yang sedang login.
   - Sifat kalender: **Read-Only murni** (tidak ada tombol tambah/edit/hapus jadwal).
   - Tampilan jam riil KBM (`resolved_times`).
   - Badge penanda status jurnal KBM hari ini: *Belum Diisi*, *Sedang Berlangsung*, atau *Selesai*.
   - Banner Peringatan Keterlambatan: Jika jadwal telah selesai > 30 menit namun jurnal belum diisi.
3. **Halaman Jurnal KBM & Presensi Kelas (`src/pages/teacher/TeacherJournalPage.jsx`):**
   - **Bagian 1: Pembukaan Sesi KBM (`POST /api/journals`):**
     - Guru jadwal mengklik tombol *"Buka Kelas (Mulai KBM)"*.
     - Tangkap respons `meta.approved_leaves`: Siswa yang memiliki izin tidak masuk resmi disetujui otomatis ter-prefill statusnya sebagai Sakit atau Izin.
   - **Bagian 2: Pengisian Presensi Exception-Based:**
     - Tampilkan daftar seluruh siswa kelas dengan status default **"Hadir"**.
     - Guru hanya perlu menandai siswa yang **TIDAK HADIR** (pilih: Sakit, Izin, atau Alpa).
     - Ringkasan statistik kehadiran instan di sisi atas (Hadir: X, Sakit: Y, Izin: Z, Alpa: W).
   - **Bagian 3: Materi & Unggah Dokumentasi KBM:**
     - Input deskripsi topik pembelajaran (validasi minimal 10 karakter).
     - Unggah foto dokumentasi kelas (dukungan kamera langsung / file picker).
   - **Bagian 4: Penyelesaian Jurnal Atomik (`PUT /api/journals/{id}`):**
     - Konstruksi payload: `topic_description`, berkas `photo`, dan array `exceptions: [{ student_id, status }]`.
     - Kirim request -> sistem menyimpan presensi dan mengompresi foto di backend.
4. **Penanganan Guru Berhalangan Hadir & Hak Eksklusif Kesiswaan:**
   - **Skenario Guru Izin:**
     - Form pengajuan izin mengajar guru di halaman kalender (mencatat alasan sakit/dinas luar).
   - **Skenario Delegasi Guru Piket Kesiswaan:**
     - Pada akun guru dengan `assignment: kesiswaan`, buka halaman jurnal kelas yang ditinggalkan.
     - Munculkan banner identitas: *"Mode Guru Pengganti (Kesiswaan) - Menggantikan [Nama Guru]"*.
     - Guru Kesiswaan berhak membuka sesi KBM (`substitute_teacher_id`), mengisi presensi, mengunggah foto, dan menyelesaikan jurnal.
     - *Penegakan Larangan:* Jika akun Wali Kelas atau guru non-kesiswaan mencoba membuka jurnal kelas guru lain, sistem menolak dan menampilkan pesan larangan 403 Forbidden.
   - **Skenario Jam Kosong (`teacher_absent`):**
     - Tombol khusus bagi Guru Kesiswaan atau Waka untuk menandai kelas tanpa guru pengganti (`PATCH /api/journals/{id}`).

#### 4. Prioritas Pekerjaan
- **Wajib:** Kalender mengajar guru read-only, buka jurnal KBM, presensi exception-based, upload foto, penyelesaian jurnal atomik.
- **Penting:** Konsumsi `meta.approved_leaves`, hak eksklusif pengganti kesiswaan, penandaan `teacher_absent`.
- **Tambahan:** Peringatan visual missing journal 30 menit.

#### 5. Dependensi
Bergantung pada **Fase 1** (Auth & Role Check) dan **Fase 3** (Data Jadwal Aktif).

#### 6. Hasil yang Diharapkan
Guru dapat memantau jadwal mengajarnya, membuka kelas KBM, mencatat materi dan presensi secara ringkas (hanya siswa absen), mengunggah foto, serta Tim Kesiswaan dapat mengambil alih kelas pengganti secara sah sesuai aturan bisnis PRD.

#### 7. Kriteria Keberhasilan (Acceptance Criteria)
- [ ] Payload penyelesaian jurnal ke endpoint `PUT /api/journals/{id}` hanya memuat siswa berstatus Sakit, Izin, atau Alpa pada array `exceptions`.
- [ ] Siswa dengan izin disetujui otomatis ter-prefill statusnya saat jurnal dibuka.
- [ ] Akun guru biasa tanpa penugasan kesiswaan ditolak (HTTP 403) saat mencoba membuka jurnal jadwal guru lain.
- [ ] Akun guru kesiswaan berhasil membuka dan menyelesaikan jurnal sebagai guru pengganti (`substitute_teacher_id` tercatat di server).

#### 8. Pengujian dan Validasi
- Buka kelas dengan akun guru pemilik jadwal -> isi 2 siswa sakit/izin -> submit -> verifikasi siswa lainnya otomatis tercatat Hadir di server.
- Coba buka kelas guru lain menggunakan akun Wali Kelas -> pastikan respons 403 Forbidden ditangani antarmuka dengan tepat.

#### 9. Risiko dan Kendala
- *Risiko:* Berkas foto KBM berukuran sangat besar dari kamera ponsel pengguna.
- *Mitigasi:* Berikan kompresi/resize kanvas sisi klien (canvas max width 1280px) sebelum dikirim ke backend untuk mempercepat unggahan.

---

### FASE 5: Modul Perizinan Siswa & Monitoring Kehadiran Sekolah

#### 1. Tujuan Fase
Mengimplementasikan modul perizinan siswa (pengajuan mandiri, unggah surat bukti, edit selama pending, dan pembatalan), verifikasi izin oleh Guru Kesiswaan, serta layar monitoring kehadiran komprehensif bagi Waka, Kesiswaan, dan Wali Kelas.

#### 2. Kondisi Awal
- Modul jurnal dan presensi telah siap dari Fase 4.
- Backend menyediakan: `/api/leave-requests` (CRUD & verifikasi) dan `/api/attendances` (auto-scoped multi-role).

#### 3. Daftar Pekerjaan
1. **API Service Perizinan & Presensi (`src/api/leaveApi.js`):**
   - Fungsi leave-requests (list, show, store multipart, update verifikasi / edit pending, destroy batal).
   - Fungsi attendances (list dengan filter tanggal, rentang tanggal, status, kelas).
2. **Halaman Pengajuan Perizinan Siswa / Orang Tua (`src/pages/student/StudentPermissionPage.jsx`):**
   - **Form Pengajuan Dinamis (2 Tipe x 2 Kategori):**
     - Pilihan Tipe: `tidak_masuk` (Multi-hari: input `start_date` & `end_date`) vs `keluar_sekolah` (Same-day: input `date`, `departure_time`, `expected_return_time`).
     - Pilihan Kategori: `sakit` (Wajib unggah surat dokter) vs `lainnya` (Surat izin opsional).
     - Unggah dokumen bukti (PDF / JPG / PNG, maks 2MB).
   - **Tabel Riwayat Perizinan Siswa:**
     - Menampilkan tanggal, tipe, kategori, status approval (`pending`, `approved`, `rejected`), dan tombol lihat surat lampiran.
   - **Fitur Edit Izin Pending:**
     - Modal edit permohonan izin (hanya aktif jika status masih `pending`).
   - **Fitur Batalkan Izin:**
     - Tombol pembatalan perizinan pending (`DELETE /api/leave-requests/{id}`).
3. **Halaman Verifikasi Perizinan Khusus Kesiswaan (`src/pages/teacher/PermissionVerifyPage.jsx`):**
   - Akses eksklusif: Terproteksi hanya untuk Guru dengan penugasan Kesiswaan atau Waka Kurikulum.
   - Filter tab: *Semua*, *Menunggu Persetujuan (Pending)*, *Disetujui*, *Ditolak*.
   - Modal Pratinjau Surat Bukti / Surat Dokter.
   - Aksi Verifikasi Cepat: Tombol *"Setujui (Approve)"* dan *"Tolak (Reject)"* (`PATCH /api/leave-requests/{id}`).
4. **Halaman Monitoring & Rekapitulasi Presensi (`src/pages/waka/MonitoringRecapPage.jsx`):**
   - Tab 1: Rekap Presensi Siswa (Tabel kehadiran, filter tanggal/rentang tanggal, filter kelas, filter status Hadir/Sakit/Izin/Alpa).
   - Tab 2: Rekap Jurnal Mengajar Sekolah (Tabel jurnal seluruh kelas, preview foto KBM, topik materi, filter guru & tanggal).
   - Kartu Metrik Kehadiran Sekolah: Persentase Kehadiran Total, Jumlah Sakit, Izin, dan Alpa hari ini.
   - Dukungan Scoping Wali Kelas: Jika diakses Wali Kelas, tabel otomatis terkunci hanya pada kelas binaannya.

#### 4. Prioritas Pekerjaan
- **Wajib:** Form pengajuan izin 2 tipe x 2 kategori, upload bukti surat sakit, verifikasi izin Kesiswaan, rekap presensi.
- **Penting:** Edit izin pending, pembatalan izin, filter tanggal dan kelas pada monitoring.
- **Tambahan:** Ekspor ringkasan presensi ke format CSV/Excel sisi klien.

#### 5. Dependensi
Bergantung pada **Fase 1** (Auth) dan **Fase 4** (Jurnal & Presensi).

#### 6. Hasil yang Diharapkan
Siswa/Orang Tua dapat mengajukan izin resmi dengan bukti surat; Guru Kesiswaan dapat memverifikasi perizinan; presensi KBM sinkron otomatis dengan status izin; seluruh pihak berkepentingan dapat memantau data kehadiran.

#### 7. Kriteria Keberhasilan (Acceptance Criteria)
- [ ] Pengajuan izin tipe sakit mewajibkan unggah berkas surat, sedangkan tipe lainnya memperbolehkan tanpa berkas.
- [ ] Siswa dapat memperbarui tanggal dan berkas izin selama status masih pending.
- [ ] Izin yang telah di-approve oleh Kesiswaan tidak dapat diedit atau dibatalkan lagi oleh siswa.
- [ ] Izin tipe `tidak_masuk` yang approved otomatis muncul pada metadata pembukaan jurnal KBM guru di Fase 4.

#### 8. Pengujian dan Validasi
- Ajukan izin siswa -> Login sebagai Kesiswaan -> Setujui izin -> Login sebagai guru kelas terkait -> Buka jurnal -> Pastikan siswa tersebut berstatus Sakit/Izin secara otomatis.

#### 9. Risiko dan Kendala
- *Risiko:* Perbedaan zona waktu pada perbandingan rentang tanggal di peramban klien.
- *Mitigasi:* Mengunci seluruh perhitungan tanggal pada zona waktu `Asia/Jakarta` (WIB) menggunakan date-fns atau helper seragam.

---

### FASE 6: Modul Kuis Berbantuan AI & Workflow Evaluasi Asinkron

#### 1. Tujuan Fase
Mengimplementasikan modul kuis pembelajaran bertenaga AI secara menyeluruh: 3 metode pembuatan soal (Prompt AI dengan konfigurasi ketat, Ekstraksi Dokumen PDF/TXT, dan Manual), tahap preview dan penyuntingan soal, pengerjaan kuis siswa (multi-attempt), antrean koreksi hybrid asinkron, review submission guru, serta override nilai AI.

#### 2. Kondisi Awal
- Fase 1 dan Fase 2 telah selesai.
- Backend menyediakan API kuis lengkap: `/api/quizzes`, `/api/quizzes/{id}/generate-prompt`, `/api/quizzes/{id}/extract-document`, `/api/quizzes/{id}/questions`, `/api/quizzes/{id}/publish`, `/api/quizzes/{id}/submissions`, dan `/api/quiz-submissions/{id}`.

#### 3. Daftar Pekerjaan
1. **API Service Kuis AI (`src/api/quizApi.js`):**
   - Fungsi inisialisasi kuis (`createQuiz`), update metadata, publish kuis, rilis hasil.
   - Fungsi pembuat soal: `generatePrompt`, `extractDocument` (multipart), CRUD questions manual.
   - Fungsi pengerjaan siswa: `submitQuizAnswers`, `getMyQuizResult`.
   - Fungsi evaluasi guru: `getQuizSubmissions`, `overrideQuizSubmission`.
2. **Halaman Manajemen Kuis Guru (`src/pages/teacher/TeacherQuizPage.jsx`):**
   - Daftar kuis guru dengan tab status: *Semua*, *Dipublikasikan (Aktif)*, *Draft Review*.
   - Modal Inisialisasi Kuis Baru (`POST /api/quizzes`):
     - Input Judul Kuis, Pilihan Rombel Kelas, Tenggat Pengerjaan (*Due Date*), Batas Percobaan (*Max Attempts*).
     - Kuis tercipta dalam status awal `draft_review`.
3. **Implementasi Tiga Metode Pembuatan Soal:**
   - **Metode 1: Modal Prompt AI (`generate-prompt`):**
     - Input instruksi materi prompt teks.
     - Input Konfigurasi Wajib: Total Soal, Jenis Soal (`multiple_choice`, `essay`, `combination`).
     - Jika kombinasi: Input `mc_count` dan `essay_count` dengan validasi ketat di klien (`mc_count + essay_count === total_questions`).
     - Pilihan tingkat kesulitan (mudah/sedang/sulit) & catatan guru.
     - Kirim -> Respons 202 Accepted -> Polling status kuis hingga selesai generating.
   - **Metode 2: Modal Ekstraksi Dokumen (`extract-document`):**
     - Area drag-and-drop unggah berkas materi PDF / TXT (maksimal 5MB).
     - Kirim -> Respons 202 Accepted -> Polling status kuis hingga selesai.
   - **Metode 3: Form Penambahan Soal Manual:**
     - Input teks pertanyaan, tipe soal (PG / Esai), opsi A, B, C, D, dan kunci jawaban / rubrik esai.
4. **Halaman Tahap Preview & Penyuntingan Soal Kuis (`draft_review`):**
   - Daftar seluruh butir soal hasil AI / dokumen / manual.
   - Penanda visual butir soal ambigu (`needs_review: true` dengan catatan penjelasan AI).
   - Tombol *Edit Butir Soal*: Memperbarui teks, opsi, kunci, atau rubrik esai (`PUT /questions/{id}`).
   - Tombol *Hapus Butir Soal* (`DELETE /questions/{id}`).
   - Tombol Tambah Soal Manual ad-hoc.
   - **Tombol Konfirmasi Publikasi:** Mengubah status kuis menjadi `published` (`PATCH /api/quizzes/{id}/publish`).
5. **Halaman Pengerjaan Kuis Siswa (`src/pages/student/StudentQuizPage.jsx`):**
   - Informasi kuis: Judul, Kelas, Batas Waktu, Sisa Percobaan Pengerjaan.
   - Antarmuka pengerjaan: Navigasi nomor soal, pilihan opsi A-D untuk PG, dan area textarea untuk soal esai.
   - Pengiriman Jawaban (`POST /api/quizzes/{id}/submissions`):
     - Respons 202 Accepted -> Tampilkan status *"Jawaban sedang dinilai oleh evaluasi AI di latar belakang"*.
6. **Layar Review Pengumpulan Guru & Override Nilai:**
   - Tabel daftar siswa yang telah mengumpulkan kuis beserta status koreksi (`pending` / `graded`), skor AI, dan nomor percobaan.
   - Modal Detail Submission: Menampilkan jawaban siswa berdampingan dengan evaluasi semantik dan umpan balik AI.
   - **Form Override Nilai Guru (`PATCH /api/quiz-submissions/{id}`):**
     - Guru dapat mengganti skor dan menambahkan catatan umpan balik pribadi (mencatat audit trail).
   - **Tombol Rilis Hasil Kuis (`published_result`):**
     - Guru mengubah status kuis menjadi `published_result` agar nilai dan feedback dapat dilihat oleh siswa dan orang tua.
7. **Tampilan Hasil Kuis Siswa & Orang Tua:**
   - Tampilan skor akhir dan umpan balik hanya aktif jika status kuis sudah `published_result`. Jika belum, tampilkan pesan informatif: *"Hasil kuis masih dalam peninjauan guru"*.

#### 4. Prioritas Pekerjaan
- **Wajib:** Inisialisasi kuis, 3 metode pembuatan soal, preview/edit soal, publikasi kuis, pengerjaan kuis siswa (PG & esai), review submission guru, override nilai AI, rilis hasil.
- **Penting:** Validasi komposisi kombinasi soal di klien, penanda soal ambigu `needs_review`, batas percobaan kuis.
- **Tambahan:** Indikator timer hitung mundur pengerjaan kuis.

#### 5. Dependensi
Bergantung pada **Fase 1** (Auth) dan **Fase 2** (Data Kelas).

#### 6. Hasil yang Diharapkan
Guru dapat menyusun asesmen pembelajaran secara instan via prompt AI atau berkas PDF modul, meninjau butir soal sebelum diterbitkan, siswa dapat mengerjakan soal PG dan esai, sistem menilai secara otomatis di antrean latar belakang, dan guru memegang kendali penuh atas nilai akhir siswa.

#### 7. Kriteria Keberhasilan (Acceptance Criteria)
- [ ] Pengiriman form prompt AI dengan jumlah PG + Esai yang tidak cocok dengan total soal ditolak langsung oleh validasi form.
- [ ] Dokumen PDF soal yang diunggah diparsing oleh AI dan menghasilkan daftar soal berstatus draft review.
- [ ] Soal dengan flag `needs_review` menampilkan kotak peringatan kuning yang memandu guru mengoreksi kunci jawaban.
- [ ] Siswa mengirimkan jawaban kuis dan menerima status 202 Accepted; nilai kuis siswa tidak dapat dilihat sampai guru merilis kuis (`published_result`).
- [ ] Guru dapat meng-override nilai AI siswa, dan sistem menampilkan badge penanda *"Telah di-override oleh Guru"*.

#### 8. Pengujian dan Validasi
- Uji alur lengkap end-to-end: Buat kuis via prompt AI -> edit 1 butir soal -> publish kuis -> login sebagai siswa -> kerjakan kuis -> login sebagai guru -> override nilai esai -> rilis hasil -> login sebagai siswa/ortu -> pastikan nilai muncul.

#### 9. Risiko dan Kendala
- *Risiko:* Pemanggilan AI Gateway melalui antrean memakan waktu 10–20 detik.
- *Mitigasi:* Pasang polling berkala 3 detik dengan indikator animasi memuat interaktif dan batalkan polling setelah timeout 60 detik jika terjadi kendala jaringan.

---

### FASE 7: Modul Portal Siswa & Monitoring Orang Tua

#### 1. Tujuan Fase
Menuntaskan antarmuka khusus siswa dan orang tua: portal beranda siswa dengan rekap kehadiran mandiri, jadwal harian, serta dashboard monitoring orang tua dengan rekapitulasi kehadiran anak, riwayat izin, dan capaian kuis.

#### 2. Kondisi Awal
- Modul presensi, perizinan, dan kuis telah beroperasi dari Fase 4, 5, dan 6.
- Endpoint ter-scoped untuk role `student` dan `parent` telah aktif di backend.

#### 3. Daftar Pekerjaan
1. **Beranda Siswa (`src/pages/student/StudentHomePage.jsx`):**
   - Header identitas: Nama Siswa, NIS, NISN, Rombel Kelas, Tahun Ajaran Aktif.
   - 4 Kartu Metrik Kehadiran: Hari Masuk (Hadir), Izin Sakit, Izin Keperluan, Alpa/Tanpa Keterangan.
   - Jadwal Pelajaran Hari Ini (dengan jam dinamis KBM).
   - Daftar Kuis Aktif yang Perlu Dikerjakan (dengan deadline terdekat).
2. **Dashboard Monitoring Orang Tua (`src/pages/parent/ParentMonitoringPage.jsx`):**
   - Header Identitas Anak yang Terhubung (`linked_student_id`).
   - Tab 1: Rekapitulasi Kehadiran Anak (Tabel riwayat absen per tanggal KBM).
   - Tab 2: Riwayat Perizinan Anak (Status permohonan izin sakit / dinas).
   - Tab 3: Capaian Nilai Kuis Pembelajaran (Hanya kuis berstatus `published_result`).
   - Kartu Peringatan Kehadiran (*Attendance Alert*): Jika jumlah alpa/sakit anak melebihi ambang batas tertentu.

#### 4. Prioritas Pekerjaan
- **Wajib:** Beranda siswa, statistik kehadiran, jadwal hari ini, monitoring orang tua (kehadiran, izin, nilai kuis).
- **Penting:** Tombol cepat ajukan izin dan buka kuis dari beranda siswa.
- **Tambahan:** Kartu ucapan motivasi belajar siswa.

#### 5. Dependensi
Bergantung pada **Fase 4, 5, dan 6**.

#### 6. Hasil yang Diharapkan
Siswa memiliki portal mandiri yang informatif untuk memantau kehadiran dan tugas kuisnya; Orang tua memiliki transparansi penuh atas perkembangan anak di sekolah.

#### 7. Kriteria Keberhasilan (Acceptance Criteria)
- [ ] Akun orang tua otomatis ter-scoped hanya melihat data anaknya yang terhubung via `linked_student_id`.
- [ ] Kuis yang belum dirilis guru (`published`) tidak menampilkan rincian nilai pada akun orang tua atau siswa.
- [ ] Beranda siswa menampilkan jadwal KBM hari ini sesuai putaran aktif saat itu.

#### 8. Pengujian dan Validasi
- Login sebagai orang tua -> Periksa apakah tabel kehadiran dan nilai kuis benar-benar milik anak yang bersangkutan.

#### 9. Risiko dan Kendala
- *Risiko:* Akun orang tua belum terhubung ke data siswa manapun.
- *Mitigasi:* Tampilkan komponen `EmptyState` khusus: *"Akun Anda belum ditautkan ke data siswa. Silakan hubungi Waka Kurikulum."*

---

### FASE 8: Penyempurnaan UI/UX, Aksesibilitas, & Keamanan Klien

#### 1. Tujuan Fase
Melakukan audit dan penyempurnaan menyeluruh atas pengalaman pengguna: memastikan seluruh tabel dan kartu data menerapkan Skeleton Loading, Empty State yang informatif, Error Boundaries, penanganan responsivitas pada layar tablet/mobile, audit aksesibilitas kontras warna (WCAG AA), serta proteksi keamanan sisi klien.

#### 2. Kondisi Awal
- Seluruh modul fungsional dari Fase 1 s.d. Fase 7 telah selesai diimplementasikan.

#### 3. Daftar Pekerjaan
1. **Audit & Penyelarasan UI States di Seluruh Layar:**
   - Pasang `SkeletonRow` / `SkeletonCard` pada saat fetching data berlangsung (`isLoading = true`).
   - Pasang `EmptyState` dengan judul, ilustrasi ikon, dan tombol CTA yang kontekstual.
   - Pasang `ErrorState` jika request API gagal atau timeout dengan tombol "Coba Lagi".
2. **Global Error Boundary (`src/components/feedback/ErrorBoundary.jsx`):**
   - Menangkap unhandled JavaScript runtime error pada komponen React agar aplikasi tidak mengalami layar putih (*white screen of death*).
3. **Penyempurnaan Responsivitas Antarmuka:**
   - Uji coba tabel pada layar sempit: Gunakan pembungkus `overflow-x-auto` yang halus dengan scrollbar tipis.
   - Periksa perilaku sidebar drawer pada layar tablet (< 1024px) agar dapat membuka dan menutup dengan transisi mulus.
4. **Audit Aksesibilitas & Kontras:**
   - Periksa kontras rasio warna teks terhadap background (minimal 4.5:1 untuk teks biasa sesuai panduan Antislop).
   - Pastikan seluruh modal memiliki trap-focus dan dapat ditutup dengan tombol `Escape` pada keyboard.
   - Berikan atribut `aria-label` pada tombol icon-only (seperti tombol close modal, tombol mata password).
5. **Keamanan Sisi Klien (Client-Side Security):**
   - Sanitasi teks dari input sebelum dirender untuk mencegah injeksi XSS.
   - Pastikan token Sanctum tidak pernah dicatat (*logged*) ke dalam console log peramban pada mode production.
   - Pengecekan batas ukuran berkas di browser sebelum proses unggah dimulai (mencegah bandwidth terbuang).

#### 4. Prioritas Pekerjaan
- **Wajib:** Skeleton loaders di semua tabel, Empty states kontekstual, Error boundary, Escape modal, Sanitasi input.
- **Penting:** Responsivitas tabel di tablet, audit kontras teks.
- **Tambahan:** Micro-interactions animasi hover tombol.

#### 5. Dependensi
Bergantung pada penyelesaian **Fase 1 s.d. 7**.

#### 6. Hasil yang Diharapkan
Aplikasi web SCP memiliki kualitas visual kelas industri yang konsisten, tidak ada lonjakan tata letak saat memuat data, ramah keyboard, aman dari celah dasar web, dan nyaman diakses di berbagai ukuran layar.

#### 7. Kriteria Keberhasilan (Acceptance Criteria)
- [ ] Tidak ada satu pun layar data yang menampilkan halaman kosong saat memuat data (seluruhnya menggunakan skeleton placeholder).
- [ ] Terputusnya koneksi internet menampilkan pesan kesalahan yang ramah dengan opsi coba ulang.
- [ ] Seluruh tombol tanpa teks memiliki atribut aksesibilitas `aria-label`.
- [ ] Pengujian Lighthouse accessibility mencapai skor minimal 90.

#### 8. Pengujian dan Validasi
- Gunakan alat bantu DevTools throttling (Slow 3G) untuk memvalidasi tampilan skeleton loading.
- Matikan koneksi jaringan untuk menguji pemulihan antarmuka saat koneksi putus (*network disconnect*).

#### 9. Risiko dan Kendala
- *Risiko:* Tabel data kompleks meluap (*overflow*) di layar tablet.
- *Mitigasi:* Terapkan tata letak kartu lipat (*collapsible card view*) untuk tablet atau pertahankan horizontal scroll yang ergonomis.

---

### FASE 9: Pengujian Terpadu End-to-End & Kesiapan Production

#### 1. Tujuan Fase
Melakukan pengujian komprehensif seluruh alur pengguna (*end-to-end user journeys*), memvalidasi kesesuaian sistem terhadap Rubrik Penilaian UKK (PRD Bagian 10), mengoptimasi hasil build produksi (*tree shaking & code splitting*), serta menyiapkan konfigurasi server deployment (Nginx SPA rewrite).

#### 2. Kondisi Awal
- Seluruh kode Front-End telah lengkap dan dipoles dari Fase 0 s.d. Fase 8.

#### 3. Daftar Pekerjaan
1. **Pengujian Alur Pengguna Terpadu (End-to-End Journeys):**
   - **Skenario A (Waka Kurikulum):**
     - Login -> Cek Master Data -> Input Jadwal Manual (dengan password) -> Upload 2 PDF Jadwal -> Resolusi Baris -> Commit Final -> Ubah Status Upacara Senin -> Eksekusi Kenaikan Kelas.
   - **Skenario B (Guru & Kesiswaan):**
     - Guru izin -> Tim Kesiswaan mengambil alih kelas sebagai guru pengganti -> Buka sesi KBM -> Masukkan materi & foto -> Isi presensi exception-based -> Jurnal selesai.
   - **Skenario C (Perizinan Siswa):**
     - Siswa mengajukan izin sakit (upload surat) -> Kesiswaan verifikasi izin -> Status izin tersinkronisasi otomatis ke jurnal guru.
   - **Skenario D (Kuis AI):**
     - Guru generate kuis prompt AI -> Koreksi butir soal di preview -> Publish kuis -> Siswa mengerjakan kuis -> Guru override nilai esai -> Guru rilis hasil -> Siswa dan orang tua melihat nilai akhir.
2. **Verifikasi Rubrik Acceptance Criteria UKK (PRD Bagian 10):**
   - Checklist pemenuhan 11 kriteria kelulusan UKK pada antarmuka web.
3. **Optimasi Bundle Build Produksi:**
   - Jalankan `npm run build` di `frontend/scp_web/`.
   - Lakukan code splitting berbasis rute menggunakan `React.lazy()` dan `React.Suspense` agar ukuran bundle awal (*initial bundle chunk*) di bawah 300KB gzipped.
   - Periksa aset gambar agar teroptimasi.
4. **Konfigurasi Lingkungan Deployment Produksi:**
   - Penyiapan berkas `.env.production` (URL production API).
   - Penyiapan konfigurasi server web Nginx untuk penanganan Single Page Application (SPA Fallback Rewrite: `try_files $uri $uri/ /index.html;`).
5. **Checklist Kesiapan Go-Live (Production Readiness Sign-Off):**
   - Pemeriksaan akhir keamanan, variabel environment, dan integritas build.

#### 4. Prioritas Pekerjaan
- **Wajib:** Verifikasi 4 skenario E2E, pemenuhan kriteria UKK, build production sukses, Nginx SPA config.
- **Penting:** Code splitting rute, audit bundle size analyzer.
- **Tambahan:** PWA configuration (opsional).

#### 5. Dependensi
Bergantung pada seluruh fase sebelumnya (**Fase 0 s.d. 8**).

#### 6. Hasil yang Diharapkan
Aplikasi Front-End Website SCP terverifikasi 100% memenuhi kriteria kelulusan UKK dan PRD v4.4, siap di-deploy ke server staging/production tanpa cacat fungsional.

#### 7. Kriteria Keberhasilan (Acceptance Criteria)
- [ ] Seluruh 4 skenario alur pengguna teruji sukses tanpa error runtime.
- [ ] Perintah `npm run build` berhasil menghasilkan folder `dist/` tanpa error atau peringatan bundle besar.
- [ ] Pengujian manual pada server web Nginx memverifikasi bahwa refresh halaman pada rute dalam (seperti `/web/review-import/1`) tidak menghasilkan HTTP 404.

#### 8. Pengujian dan Validasi
- Jalankan simulasi penuh menggunakan browser incognito dengan akun baru.
- Lakukan pengujian performa peramban (*Lighthouse performance test*).

#### 9. Risiko dan Kendala
- *Risiko:* Rute SPA menghasilkan HTTP 404 pada server saat pengguna me-refresh halaman.
- *Mitigasi:* Dokumentasikan dan sediakan berkas konfigurasi Nginx rewrite rule secara eksplisit.

---

## 4. Matriks Dependensi & Urutan Pengerjaan Antar-Fase

Tabel berikut menggambarkan prasyarat teknis sebelum suatu fase dapat dimulai:

```
┌─────────┐
│ Fase 0  │ (Fondasi Proyek & Design System)
└────┬────┘
     ▼
┌─────────┐
│ Fase 1  │ (Autentikasi, Profil, & Route Guard)
└────┬────┘
     ▼
┌─────────┐
│ Fase 2  │ (Master Data & Promosi Kelas Waka)
└────┬────┘
     ▼
┌─────────┐
│ Fase 3  │ (Jadwal Terpusat & Import PDF FET Waka)
└────┬────┘
     ▼
┌─────────┐
│ Fase 4  │ (KBM, Jurnal, & Presensi Exception-Based)
└────┬────┘
     ▼
┌─────────┐
│ Fase 5  │ (Perizinan Siswa & Monitoring Sekolah)
└────┬────┘
     ▼
┌─────────┐
│ Fase 6  │ (Sistem Kuis Berbantuan AI Asinkron)
└────┬────┘
     ▼
┌─────────┐
│ Fase 7  │ (Portal Siswa & Monitoring Orang Tua)
└────┬────┘
     ▼
┌─────────┐
│ Fase 8  │ (UI/UX Polish, Aksesibilitas, & Keamanan)
└────┬────┘
     ▼
┌─────────┐
│ Fase 9  │ (Pengujian Terpadu E2E & Production Deploy)
└─────────┘
```

---

## 5. Koordinasi Kebutuhan Backend (Backend Tasks Integration)

Sebelum atau bersamaan dengan berjalannya **Fase 1**, terdapat satu pekerjaan sisi backend yang wajib dikoordinasikan:
- **Penambahan Endpoint Ganti Kata Sandi (`PATCH /api/me/password`):**
  - *Lokasi Controller:* `scp/app/Http/Controllers/API/ProfileController.php` (atau `AuthController.php`).
  - *Validasi:* `old_password` (wajib cocok dengan hash saat ini), `new_password` (string min 8 char), `new_password_confirmation` (cocok).
  - *Logika:* Perbarui hash password pengguna dan ubah status `must_change_password` menjadi `false`.
  - *Route:* Daftarkan di grup middleware auth `routes/api.php`.

---

## 6. Checklist Akhir Kesiapan Production (Production Readiness Checklist)

Sebelum aplikasi Front-End dinyatakan siap dipublikasikan atau diujikan pada rubrik UKK, tim pengembang wajib mencentang seluruh daftar periksa berikut:

### 6.1 Fungsional & Aturan Bisnis
- [ ] Pengelolaan jadwal 100% berada di Waka Kurikulum; Guru tidak memiliki akses mutasi jadwal.
- [ ] Pengubahan putaran, status upacara, mutasi jadwal, dan commit import PDF terlindungi verifikasi password.
- [ ] Import PDF berhasil mem-parsing berkas FET dan mengizinkan resolusi baris sebelum commit.
- [ ] Hak guru pengganti hanya dapat diakses oleh akun guru dengan penugasan Kesiswaan.
- [ ] Presensi KBM beroperasi secara exception-based (hanya siswa absen yang dikirim).
- [ ] Modul kuis AI mendukung pembuatan soal via Prompt AI, Dokumen PDF/TXT, dan Manual.
- [ ] Tahap preview kuis memungkinkan guru menyunting soal sebelum dipublikasikan.
- [ ] Evaluasi kuis siswa dinilai secara asinkron (hybrid PG otomatis + esai AI), dan guru dapat meng-override nilai.
- [ ] Nilai kuis hanya dapat dilihat siswa dan orang tua setelah status `published_result`.
- [ ] Kenaikan kelas massal dan penandaan tinggal kelas berfungsi sesuai rantai kelas.

### 6.2 Teknis & Kualitas Kode
- [ ] Seluruh endpoint menggunakan konstanta lingkungan `VITE_API_BASE_URL`.
- [ ] Axios interceptor menangani sesi 401 dan rate limit 429 secara terpusat.
- [ ] Seluruh tabel memiliki indikator Skeleton Loading saat proses memuat data.
- [ ] Seluruh kondisi data kosong memiliki Empty State yang informatif.
- [ ] Error Boundary aktif menangani runtime error peramban.
- [ ] Tidak ada token atau kredensial yang bocor pada console log production.
- [ ] Build produksi `npm run build` sukses menghasilkan bundel teroptimasi.
- [ ] Konfigurasi Nginx SPA rewrite rule terpasang dengan benar.
