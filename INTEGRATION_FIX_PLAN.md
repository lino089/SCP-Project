# Rencana Perbaikan & Integrasi Frontend–Backend SCP (v2.1)

> **Status Dokumen:** Terverifikasi & Diselaraskan per 31 Oktober 2026.  
> Dokumen ini merupakan **panduan implementasi resmi** untuk menyelaraskan antarmuka **Frontend (`frontend/scp_web/`)** dengan kapabilitas arsitektur **Backend SCP v4.5 (`scp/`)**.  
> **Keputusan Kebijakan:** Mode Demo & Mock Data diputuskan untuk **Dibersihkan Total (Opsi B)** demi memastikan sistem 100% beroperasi di atas basis data riil dan API Sanctum.

---

## Daftar Isi

1. [Daftar Referensi Dokumen Wajib](#1-daftar-referensi-dokumen-wajib)
2. [Matriks Status Komponen & Arsitektur Sistem](#2-matriks-status-komponen--arsitektur-sistem)
3. [Daftar Masalah, Kebutuhan & Prioritas](#3-daftar-masalah-kebutuhan--prioritas)
4. [Fase 1 — P0: Perbaikan Runtime Kritis & Integrasi Password](#fase-1--p0-perbaikan-runtime-kritis--integrasi-password)
5. [Fase 2 — P1: Integritas Data & Penyelarasan Prasyarat PDF (Zero-Manual v4.5)](#fase-2--p1-integritas-data--penyelarasan-prasyarat-pdf-zero-manual-v45)
6. [Fase 3 — P2: Modul Impor Excel Master Data & Pembersihan Initial State](#fase-3--p2-modul-impor-excel-master-data--pembersihan-initial-state)
7. [Fase 4 — P3: Integrasi Perizinan Guru, Multirole Wali Kelas/Kesiswaan & Polling](#fase-4--p3-integrasi-perizinan-guru-multirole-wali-kelaskesiswaan--polling)
8. [Fase 5 — P4: Pembersihan Total Infrastruktur Demo & Mock Data (Opsi B)](#fase-5--p4-pembersihan-total-infrastruktur-demo--mock-data-opsi-b)
9. [Roadmap & Diagram Ketergantungan Eksekusi](#9-roadmap--diagram-ketergantungan-eksekusi)
10. [Daftar Lengkap Berkas Terdampak & Verifikasi](#10-daftar-lengkap-berkas-terdampak--verifikasi)

---

## 1. Daftar Referensi Dokumen Wajib

Setiap pengembang atau agen pelaksana **WAJIB membaca dokumen spesifikasi teknis berikut** sebelum memulai pengerjaan pada fase terkait:

| Dokumen Sumber | Path Berkas | Pasal / Bab Terkait | Digunakan Pada | Fokus Panduan |
|---|---|---|:---:|---|
| **Product Requirements Document (PRD)** | [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) | Bab 5.1, 5.2, 5.4, 5.8, 5.10, 5.12, 5.13, 5.14, 9.1–9.8 | Semua Fase (1–5) | Kontrak bisnis utama: format response envelope, exception-based attendance, password re-confirmation, dan aturan otorisasi per-role. |
| **Spesifikasi Zero-Manual Master Data** | [`scp/MD/NewFeature.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/NewFeature.md) | Bab 1, 2, 3, 4, 5.1–5.3 | Fase 2, Fase 3 | Aturan prasyarat import PDF (hanya Siswa & Guru FET), kontrak template Excel (`.xlsx`), pra-registrasi ruangan (kapasitas 36) dan mata pelajaran. |
| **Arsitektur Multirole Guru & Perizinan** | [`scp/MD/SCP_MULTIKELAS_KESISWAAN_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/SCP_MULTIKELAS_KESISWAAN_PLAN.md) | Bab 1, 2, 3, 4.1–4.3, 5.1–5.4 | Fase 4 | Matriks hak akses Wali Kelas (read-only izin siswa, scope jadwal/jurnal binaan) vs Tim Kesiswaan/BK (approval izin guru/siswa, inval, status absent). |
| **Spesifikasi Alur Kerja KBM & Jurnal** | [`scp/MD/Flow.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/Flow.md) | Alur 1–6 | Fase 4, Fase 5 | Alur buka sesi KBM, upload dokumentasi foto, presensi exception-based (S/I/A), dan delegasi guru pengganti. |
| **Spesifikasi Teknis Endpoint Backend** | [`scp/MD/Development.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/Development.md) | Bagian API Routes & Envelopes | Semua Fase (1–5) | Rujukan resmi skema JSON request/response, status HTTP, dan struktur relasi database. |

---

## 2. Matriks Status Komponen & Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND SCP v4.5                                │
│  ┌───────────────────────┐ ┌──────────────────────┐ ┌────────────────────┐  │
│  │ PATCH /me/password    │ │ Excel Importer       │ │ Teacher Leave Req  │  │
│  │ (Status: AKTIF 100%)  │ │ (Guru & Siswa v4.5)  │ │ (Status: AKTIF)    │  │
│  └───────────────────────┘ └──────────────────────┘ └────────────────────┘  │
│  ┌───────────────────────┐ ┌──────────────────────┐ ┌────────────────────┐  │
│  │ Zero-Manual Ingestion │ │ Multirole Wali Kelas │ │ AI Quiz Generator  │  │
│  │ (Worker PDF Auto-Reg) │ │ & Guru Kesiswaan     │ │ (Gemini 3.8 Flash) │  │
│  └───────────────────────┘ └──────────────────────┘ └────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Kontrak REST API / Sanctum
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        FRONTEND TARGET SINKRONISASI                         │
│  [Fase 1] Fix TypeError & Hubungkan form password asli                      │
│  [Fase 2] Sinkronisasi Prasyarat PDF v4.5 & Pembersihan Data Dummy          │
│  [Fase 3] Integrasi UI Impor Excel Guru & Siswa + Inisialisasi []           │
│  [Fase 4] Integrasi Izin Guru Riil (FormData), UI Wali Kelas & Kesiswaan    │
│  [Fase 5] OPSI B: Pembersihan Total Preset Demo UKK & Mock Service          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Daftar Masalah, Kebutuhan & Prioritas

| # | Prioritas | Kategori | Ringkasan Kebutuhan | File Utama Terkait |
|---|:---:|---|---|---|
| 1 | **P0** | Bugfix Runtime | `masterDataApi.getClasses()` tidak ada pada default export — `MonitoringRecapPage` crash | `MonitoringRecapPage.jsx` L68 |
| 2 | **P0** | Integrasi API | Sinkronisasi frontend dengan endpoint `PATCH /api/me/password` (hapus swallow 404) | `AuthContext.jsx` L129-137, `ProfilePage.jsx` L172-176 |
| 3 | **P1** | Integritas Data | Hapus data kehadiran palsu saat `attendances` kosong di halaman Orang Tua | `ParentMonitoringPage.jsx` L77-78 |
| 4 | **P1** | Integritas Data | Perbaiki catch block OTP kontak agar tidak menganggap verifikasi berhasil saat API gagal | `ProfilePage.jsx` L86-89 & L129-132 |
| 5 | **P1** | Integritas Data | Hapus guard `raw.length > 0` & fallback dummy saat jadwal database kosong | `ScheduleManagementPage.jsx` L131, L230 |
| 6 | **P1** | Integritas Data | Hapus guard `list.length > 0` & fallback dummy riwayat putaran / missing jurnal Waka | `DashboardWakaPage.jsx` L50, L53, L96 |
| 7 | **P1** | Penyelarasan Aturan | Selaraskan prasyarat import PDF FET dengan backend v4.5 (hanya cek Siswa & Guru FET) | `prerequisiteHelper.js` L11-49, `UploadImportPage.jsx` |
| 8 | **P2** | Master Data Import | Integrasi unduh template & impor guru massal via Excel (.xlsx) | `masterDataApi.js`, `MasterDataPage.jsx` |
| 9 | **P2** | Master Data Import | Integrasi unduh template & impor siswa massal via Excel (.xlsx) + field `gender` & `nisn` | `masterDataApi.js`, `MasterDataPage.jsx` |
| 10 | **P2** | Pembersihan Fallback | State awal Master Data diisi fallback hardcoded (12 kelas, 6 ruang, 7 mapel, 3 guru, 4 siswa) | `MasterDataPage.jsx` L133-137 |
| 11 | **P2** | Pembersihan Fallback | State awal Kenaikan Kelas & Review Import diisi fallback dummy | `GradePromotionPage.jsx` L48-49, `ReviewImportPage.jsx` L85 |
| 12 | **P3** | Integrasi API | Pengajuan izin mengajar & titip tugas guru diganti dari `localStorage` ke API backend | `TeacherSchedulePage.jsx` L88-140, `leaveApi.js` |
| 13 | **P3** | Antarmuka Baru | Panel Verifikasi Izin Guru untuk Kesiswaan/Waka & proteksi read-only izin siswa bagi Wali Kelas | `PermissionVerifyPage.jsx` L35-39, L209-234 |
| 14 | **P3** | Multirole Guru | Akses jadwal & jurnal KBM kelas binaan bagi Wali Kelas serta inval darurat | `TeacherSchedulePage.jsx`, `TeacherJournalPage.jsx` |
| 15 | **P3** | Integrasi API | Progress upload import PDF FET ganti dari `setTimeout` dummy ke polling backend | `UploadImportPage.jsx` L69-80 |
| 16 | **P3** | Integritas Data | Promosi kelas massal hapus simulasi offline saat API error | `GradePromotionPage.jsx` L175-187 |
| 17 | **P4** | Pembersihan Total (Opsi B) | Hapus tombol demo login, `DEMO_PRESETS`, dan demo role switcher di TopBar | `LoginPage.jsx`, `TopBar.jsx`, `authConstants.js` |
| 18 | **P4** | Refactor Service | Hapus mock data di service layer (`journalApi`, `leaveApi`, `quizApi`) & sambungkan API riil | `journalApi.js`, `leaveApi.js`, `quizApi.js` |

---

## Fase 1 — P0: Perbaikan Runtime Kritis & Integrasi Password

> **Dokumen Panduan Wajib:**
> - [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) Bab 5.1 & 9.1 (Autentikasi, Profil & Mandatory Change Password).
> - [`scp/app/Http/Controllers/API/ProfileController.php`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/ProfileController.php#L357-L408) (Implementasi method `changePassword`).
> - [`scp/tests/Feature/ChangePasswordTest.php`](file:///D:/MyUKK/SchoolClassProject/scp/tests/Feature/ChangePasswordTest.php) (8 Skenario pengujian yang wajib terpenuhi).

### 1a. Integrasi Frontend dengan Route `PATCH /api/me/password`

* **Kondisi Backend:**
  Endpoint `PATCH /api/me/password` telah **aktif dan terverifikasi**. Validasi meliputi: `current_password` (wajib cocok dengan database), `new_password` (min:8, confirmed, different), dan mereset `must_change_password = false`.
* **Masalah di Frontend:**
  - [`AuthContext.jsx` L129-133](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx#L129-L133): `catch` block menelan error 404 lama dan mengeksekusi `updateUserProfile({ must_change_password: false })` secara sepihak.
  - [`ProfilePage.jsx` L172-176](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx#L172-L176): `catch` block menampilkan alert sukses palsu jika endpoint merespons error 404.
* **Langkah Pengerjaan:**
  1. Pada `AuthContext.jsx`, hapus kondisi `if (err.status !== 404)`. Semua kegagalan dari `authApi.changePassword(passwords)` wajib di-throw ke komponen pemanggil.
  2. Pindahkan pembaruan state lokal `updateUserProfile({ must_change_password: false })` ke dalam blok `try` setelah request API berhasil menerima HTTP 200.
  3. Pada `ProfilePage.jsx`, hapus fallback `if (err.status === 404)`. Tangkap error respons validasi (HTTP 422) dan tampilkan pesan kesalahan resmi dari server pada form.
* **Hasil yang Diharapkan:**
  - Kata sandi tersimpan permanen di database dalam bentuk hash baru.
  - Kolom `must_change_password` pada tabel `users` berubah dari `1` menjadi `0`.
  - Percobaan menggunakan password lama yang salah menampilkan pesan error HTTP 422: *"Kata sandi saat ini yang Anda masukkan tidak sesuai."*

---

### 1b. Perbaiki Pemanggilan `masterDataApi.getClasses()` di MonitoringRecapPage

* **Masalah:**
  [`MonitoringRecapPage.jsx` L68](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx#L68) memanggil `masterDataApi.getClasses(...)`, sedangkan export pada [`masterDataApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js) adalah `classApi`. Hal ini memicu `TypeError: undefined is not a function`, menggagalkan `Promise.all` dan membuat seluruh halaman kosong.
* **Langkah Pengerjaan:**
  1. Ubah baris import di awal file `MonitoringRecapPage.jsx`:
     ```js
     import { classApi } from '../../services/masterDataApi';
     ```
  2. Ubah pemanggilan pada baris 68:
     ```js
     classApi.getClasses({ per_page: 50 }).catch(() => ({ data: [] }))
     ```
* **Hasil yang Diharapkan:**
  - Halaman Monitoring Rekap ter-load sempurna tanpa error di konsol browser.
  - Data kehadiran, jurnal, dan dropdown rombel kelas ter-render secara utuh.

---

## Fase 2 — P1: Integritas Data & Penyelarasan Prasyarat PDF (Zero-Manual v4.5)

> **Dokumen Panduan Wajib:**
> - [`scp/MD/NewFeature.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/NewFeature.md) Bab 1.1, 1.2, & 4 (Kebijakan Prasyarat Baru & Matriks Otomatisasi).
> - [`scp/app/Services/MasterDataPrerequisiteService.php`](file:///D:/MyUKK/SchoolClassProject/scp/app/Services/MasterDataPrerequisiteService.php#L39-L70) (Metode `validateForPdfImport`).
> - [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) Bab 5.2 (Verifikasi Kontak Mandiri).

### 2a. Hapus Data Kehadiran Palsu di ParentMonitoringPage
* **Lokasi:** [`ParentMonitoringPage.jsx` L77-78](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx#L77-L78).
* **Langkah:** Ganti nilai kembalian fallback `return { hadir: 42, sakit: 3, izin: 2, alpa: 1 }` menjadi `return { hadir: 0, sakit: 0, izin: 0, alpa: 0 }`.
* **Hasil:** Halaman orang tua menampilkan angka 0 secara jujur saat data absensi anak belum ada di database.

### 2b. Perbaiki Catch Block Verifikasi OTP di ProfilePage
* **Lokasi:** [`ProfilePage.jsx` L86-89 & L129-132](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx#L86-L89).
* **Langkah:** Hapus baris `setEmailVerified(true)` dan `setWaVerified(true)` dari blok `catch`. Ganti dengan `setEmailError('Verifikasi gagal. Periksa kembali kode OTP Anda.')`.
* **Hasil:** Kontak hanya ditandai terverifikasi jika backend mengembalikan respons HTTP 200.

### 2c. Hapus Guard `raw.length > 0` & Fallback Jadwal Waka
* **Lokasi:** [`ScheduleManagementPage.jsx` L131 & L230](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx#L131).
* **Langkah:** Ubah inisialisasi state `useState(FALLBACK_SCHEDULES)` menjadi `useState([])`. Hapus guard `if (raw.length > 0)`.
* **Hasil:** Jika tabel jadwal di database kosong, tabel menampilkan komponen `EmptyState` resmi, bukan 4 baris jadwal dummy.

### 2d. Hapus Guard `list.length > 0` & Fallback Dashboard Waka
* **Lokasi:** [`DashboardWakaPage.jsx` L50, L53, L96](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx#L50).
* **Langkah:** Ubah `useState(FALLBACK_HISTORY)` dan `useState(FALLBACK_MISSING_JOURNALS)` menjadi `useState([])`. Hapus guard `if (list.length > 0)`.
* **Hasil:** Riwayat perubahan siklus dan alert jurnal kosong menampilkan status riil dari database.

### 2e. Sinkronisasi Prasyarat Import PDF FET (Aturan v4.5)
* **Konsep Arsitektur:** Pada SCP v4.5, master ruangan dan mata pelajaran dibuat secara otomatis saat berkas PDF diproses oleh worker backend. Oleh karena itu, form upload jadwal **HANYA mensyaratkan**:
  1. Minimal 1 Siswa aktif di database.
  2. Minimal 1 Guru aktif yang memiliki `fet_staff_id`.
* **Langkah Pengerjaan:**
  1. Refactor [`frontend/scp_web/src/utils/prerequisiteHelper.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/prerequisiteHelper.js):
     - Buat fungsi validator khusus: `checkPdfImportPrerequisites({ students = [], teachers = [] })`.
     - Lepaskan pengecekan terhadap `classes`, `rooms`, dan `subjects`.
     - Validasi hanya memeriksa keberadaan data siswa dan guru yang memiliki atribut `fet_staff_id`.
  2. Perbarui tampilan banner pada [`UploadImportPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/UploadImportPage.jsx):
     - Tampilkan checklist prasyarat baru: "Data Siswa Aktif" & "Data Guru & ID Staf FET".
     - Berikan keterangan informatif: *"Master Ruangan & Mata Pelajaran akan diregistrasikan secara otomatis dari berkas PDF."*

---

## Fase 3 — P2: Modul Impor Excel Master Data & Pembersihan Initial State

> **Dokumen Panduan Wajib:**
> - [`scp/MD/NewFeature.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/NewFeature.md) Bab 2.1, 2.2, & 5.1 (Kontrak Template Excel Guru & Siswa).
> - [`scp/app/Http/Controllers/API/TeacherController.php`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/TeacherController.php#L23-L170) (`downloadTemplate` & `import`).
> - [`scp/app/Http/Controllers/API/StudentController.php`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/StudentController.php#L23-L220) (`downloadTemplate` & `import`).

### 3a. Integrasi Unduh Template & Impor Guru Massal Excel
* **Endpoint Backend:**
  - `GET /api/teachers/import-template` (Mengunduh `guru_import_template.xlsx`).
  - `POST /api/teachers/import` (Menerima multipart file `.xlsx`, streaming import atomik).
* **Langkah Pengerjaan:**
  1. Pada [`services/masterDataApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js), tambahkan ke objek `teacherApi`:
     ```js
     downloadTemplate: () => api.get('/teachers/import-template', { responseType: 'blob' }),
     importTeachers: (formData) => api.post('/teachers/import', formData, {
       headers: { 'Content-Type': 'multipart/form-data' },
     }),
     ```
  2. Pada [`MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx) (Tab Guru):
     - Tambahkan tombol "Unduh Template Excel" dan "Impor Guru (.xlsx)".
     - Buat modal dialog upload berkas Excel dengan drag-and-drop.
     - Tangani respons error baris spesifik dari backend (struktur JSON: `{ row, attribute, message }`) dan tampilkan dalam bentuk tabel rekap error jika berkas tidak valid.

---

### 3b. Integrasi Unduh Template & Impor Siswa Massal Excel (Auto-Create Kelas)
* **Endpoint Backend:**
  - `GET /api/students/import-template` (Mengunduh `siswa_import_template.xlsx`).
  - `POST /api/students/import` (Menerima multipart file `.xlsx`, auto-create kelas & akun ortu).
* **Langkah Pengerjaan:**
  1. Pada [`services/masterDataApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js), tambahkan ke objek `studentApi`:
     ```js
     downloadTemplate: () => api.get('/students/import-template', { responseType: 'blob' }),
     importStudents: (formData) => api.post('/students/import', formData, {
       headers: { 'Content-Type': 'multipart/form-data' },
     }),
     ```
  2. Pada [`MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx) (Tab Siswa):
     - Tambahkan tombol "Unduh Template Excel" dan "Impor Siswa (.xlsx)".
     - Buat modal upload berkas Excel siswa.
     - Tambahkan notifikasi sukses informatif: *"Siswa berhasil diimpor dan kelas baru telah otomatis didaftarkan."*
  3. **Penyelarasan Form Tambah/Edit Siswa Manual:**
     - Tambahkan field **Jenis Kelamin** (`gender`): Opsi dropdown `L` (Laki-laki) atau `P` (Perempuan).
     - Tambahkan field **NISN** (`nisn`): Input teks 10 digit numerik opsional.

---

### 3c. Hapus Fallback Hardcoded sebagai Initial State
* **Lokasi & Langkah:**
  - [`MasterDataPage.jsx` L133-137](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx#L133-L137): Inisialisasi 5 dataset master (`classList`, `roomList`, `subjectList`, `teacherList`, `studentList`) dengan `useState([])`.
  - [`GradePromotionPage.jsx` L48-49](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/GradePromotionPage.jsx#L48-L49): Inisialisasi `classList` dan `studentList` dengan `useState([])`.
  - [`ReviewImportPage.jsx` L85](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx#L85): Inisialisasi `rows` dengan `useState([])`.

---

## Fase 4 — P3: Integrasi Perizinan Guru, Multirole Wali Kelas/Kesiswaan & Polling

> **Dokumen Panduan Wajib:**
> - [`scp/MD/SCP_MULTIKELAS_KESISWAAN_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/SCP_MULTIKELAS_KESISWAAN_PLAN.md) Bab 2, 4.1–4.3, & 5.1–5.4 (Alur Lengkap Izin Guru & Multirole).
> - [`scp/app/Http/Controllers/API/TeacherLeaveRequestController.php`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/TeacherLeaveRequestController.php) (Controller backend perizinan guru).
> - [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) Bab 5.7 & 9.6 (Penanganan Guru Berhalangan Hadir).

### 4a. Pengajuan Izin Guru & Delegasi Tugas — Ganti `localStorage` dengan API Riil
* **Kondisi Backend:**
  Endpoint `POST /api/teacher-leave-requests` telah aktif. Mendukung validasi kepemilikan jadwal, pencegahan izin duplikat pada tanggal yang sama, serta penyimpanan bukti surat (`attachment`) dan file tugas titipan siswa (`task_attachment`).
* **Langkah Pengerjaan:**
  1. Pada service layer frontend (misal di [`leaveApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/leaveApi.js) atau `teacherLeaveApi.js`), tambahkan fungsi:
     ```js
     submitTeacherLeave: (formData) => api.post('/teacher-leave-requests', formData, {
       headers: { 'Content-Type': 'multipart/form-data' },
     }),
     getMyTeacherLeaves: (params) => api.get('/teacher-leave-requests', { params }),
     ```
  2. Pada [`TeacherSchedulePage.jsx` L88-140](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx#L88-L140):
     - Hapus seluruh instruksi `localStorage.setItem('teacher_leave_active', ...)` dan `localStorage.setItem('delegated_classes', ...)`.
     - Ubah `handleSendLeave` agar menyusun payload `FormData`: `date`, `reason`, `schedule_ids[]`, file surat izin, instruksi materi, dan file tugas siswa.
     - Tambahkan panel/modal ringkas "Riwayat Permohonan Izin Saya" untuk memantau status persetujuan (`pending`, `approved`, `rejected`) langsung dari database.

---

### 4b. Pusat Verifikasi Izin Guru & Proteksi Hak Akses Wali Kelas
* **Kondisi Otorisasi Backend:**
  - Persetujuan izin siswa (`PATCH /leave-requests/{id}`) hanya boleh dilakukan oleh Kesiswaan dan Waka. Wali kelas hanya boleh **melihat**.
  - Persetujuan izin guru (`PATCH /teacher-leave-requests/{id}/approve` & `reject`) hanya boleh dilakukan oleh Kesiswaan dan Waka.
* **Langkah Pengerjaan:**
  1. Pada [`PermissionVerifyPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/PermissionVerifyPage.jsx):
     - **Bagi Wali Kelas:** Sembunyikan kolom tombol aksi "Setujui" dan "Tolak" pada tabel izin siswa jika peran user login adalah wali kelas murni. Tampilkan label status *"Menunggu Verifikasi Kesiswaan"*.
  2. **Tambahkan Tab Navigasi Baru pada Halaman:**
     - Tab 1: **Perizinan Siswa** (Menampilkan data dari `leaveApi.getLeaveRequests`).
     - Tab 2: **Perizinan Guru** (Khusus Kesiswaan dan Waka, memanggil `GET /api/teacher-leave-requests`).
  3. **Tabel Verifikasi Izin Guru (Tab 2):**
     - Kolom: Nama Guru, Tanggal Izin, Sesi Jadwal yang Terimbas, Alasan, Berkas Surat Dokter/Dinas, Instruksi Tugas Siswa, Berkas Tugas Siswa, Status.
     - Aksi: Tombol **Setujui** (`PATCH /teacher-leave-requests/{id}/approve`) dan **Tolak** (`PATCH /teacher-leave-requests/{id}/reject`).

---

### 4c. Dukungan Multirole Wali Kelas pada Jadwal & Jurnal
* **Kondisi Backend:**
  - `GET /api/schedules?class_id={id}` membuka jadwal seluruh mata pelajaran di kelas binaan bagi wali kelas.
  - `POST /api/journals` mengizinkan wali kelas membuka sesi KBM kelas binaannya sebagai guru pengganti (`substitute_teacher_id`), namun menolak HTTP 403 jika wali kelas memilih opsi status `teacher_absent`.
* **Langkah Pengerjaan:**
  1. Pada [`TeacherSchedulePage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx):
     - Deteksi apakah guru adalah Wali Kelas via `isWaliKelas()`.
     - Tampilkan switch selector: **[Jadwal Mengajar Saya]** | **[Jadwal Kelas Binaan ({nama_kelas})]**.
     - Jika tab kelas binaan dipilih, lakukan fetch ke `scheduleApi.getSchedules({ class_id: homeroomClassId })`.
  2. Pada [`TeacherJournalPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx):
     - Izinkan wali kelas membuka sesi KBM darurat untuk jadwal kelas binaannya yang kosong.
     - Sembunyikan pilihan "Tandai Guru Berhalangan Hadir" bagi pengguna yang hanya berstatus Wali Kelas (opsi ini eksklusif untuk Guru Kesiswaan dan Waka).

---

### 4d. Polling Asinkron Upload Import PDF FET
* **Masalah:** [`UploadImportPage.jsx` L69-80](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/UploadImportPage.jsx#L69-L80) menggunakan timer tiruan `setTimeout` (1.2 detik & 2.4 detik) untuk menggerakkan progress bar secara palsu.
* **Langkah Pengerjaan:**
  1. Hapus kedua `setTimeout` tiruan.
  2. Setelah `uploadSchedulePdf` merespons HTTP 202 dengan membawa `batch_id`, jalankan interval polling `scheduleImportApi.getImportDetail(batch_id)` setiap 1.5 detik.
  3. Perbarui persentase progress dan pesan status sesuai nilai `status` aktual dari backend:
     - `uploaded` $\rightarrow$ Progress 30% ("Berkas diunggah, menunggu worker...")
     - `parsing` $\rightarrow$ Progress 70% ("Mengekstraksi denah ruangan & jadwal kelas FET...")
     - `preview_ready` $\rightarrow$ Progress 100% ("Ekstraksi selesai. Menyiapkan pratinjau...") $\rightarrow$ Arahkan ke halaman Review Import.
     - `failed` $\rightarrow$ Hentikan polling dan tampilkan pesan error parsing dari server.

---

### 4e. Hapus Simulasi Offline Promosi Kelas Massal
* **Lokasi:** [`GradePromotionPage.jsx` L175-187](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/GradePromotionPage.jsx#L175-L187).
* **Langkah:** Hapus perhitungan offline di blok `catch`. Tangkap pesan kegagalan dari API dan tampilkan notifikasi alert error yang jelas kepada pengguna jika proses promosi gagal di server.

---

## Fase 5 — P4: Pembersihan Total Infrastruktur Demo & Mock Data (Opsi B)

> **Dokumen Panduan Wajib:**
> - [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) Bab 5.14 & 9.8 (Sistem Kuis Berbantuan AI).
> - [`scp/MD/Flow.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/Flow.md) (Alur Kerja Operasional Nyata).
> - **Keputusan Pengguna:** **OPSI B (Dibersihkan Total)**.

### 5a. Ruang Lingkup Pembersihan Demo
Seluruh fitur jalan pintas demo login, akun uji coba instan, dan role switcher di TopBar akan **dihapus sepenuhnya dari basis kode frontend**, sehingga sistem beroperasi 100% menggunakan autentikasi Sanctum dan kredensial database riil.

### 5b. Langkah-Langkah Pengerjaan Pembersihan:

#### 1. Pembersihan Halaman Login ([`LoginPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx))
* **Hapus L8-44:** Hapus deklarasi konstanta `DEMO_PRESETS` (akun dummy waka, guru, siswa, ortu, kesiswaan).
* **Hapus L102-108:** Hapus fungsi handler `handleQuickDemoLogin`.
* **Hapus L126-145:** Hapus komponen barisan tombol pemilihan role demo di atas form login.
* **Hapus L198-207:** Hapus tombol "Masuk Cepat Mode Demo".
* **Hasil:** Halaman login murni berupa form standar (Input NIS/NIP & Password) yang terhubung ke `authApi.login()`.

#### 2. Pembersihan TopBar ([`TopBar.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx))
* **Hapus L58-64:** Hapus fungsi `handleSelectDemoRole`.
* **Hapus L190-221:** Hapus seluruh blok menu dropdown "Uji Cepat Peran (UKK)" yang berisi 5 tombol pergantian role instan.
* **Hasil:** TopBar hanya menampilkan informasi profil pengguna yang sedang login dari database dan tombol navigasi profil/logout resmi.

#### 3. Pembersihan Context Autentikasi ([`AuthContext.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx) & [`authConstants.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/authConstants.js))
* Pada `AuthContext.jsx`, hapus method `loginWithDemo` dan import `DEMO_PROFILES`.
* Pada `authConstants.js`, hapus objek `DEMO_PROFILES`.
* Pastikan token di `localStorage` hanya berupa Bearer Token Sanctum yang valid dari respon backend.

#### 4. Pembersihan Service Layer Kuis ([`quizApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/quizApi.js))
* **Hapus L10-301:** Hapus seluruh konstanta mock dataset: `MOCK_QUIZZES`, `MOCK_QUESTIONS`, `MOCK_SUBMISSIONS`.
* **Refactor Fungsi Service:**
  - `getQuizzes(params)` $\rightarrow$ Panggil langsung `api.get('/quizzes', { params })`.
  - `createQuiz(data)` $\rightarrow$ Panggil `api.post('/quizzes', data)`.
  - `generateFromPrompt(quizId, payload)` $\rightarrow$ Panggil `api.post('/quizzes/' + quizId + '/generate-prompt', payload)`.
  - `extractFromDocument(quizId, formData)` $\rightarrow$ Panggil `api.post('/quizzes/' + quizId + '/extract-document', formData)`.
  - `submitQuiz(quizId, answers)` $\rightarrow$ Panggil `api.post('/quizzes/' + quizId + '/submissions', answers)`.
  - `getMySubmission(quizId)` $\rightarrow$ Panggil `api.get('/quizzes/' + quizId + '/submissions/me')`.
  - Hapus seluruh blok `catch` yang mengembalikan data fallback mock tiruan.

#### 5. Pembersihan Service Layer Izin & Jurnal ([`leaveApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/leaveApi.js) & [`journalApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/journalApi.js))
* Pada `leaveApi.js`: Hapus konstanta `MOCK_LEAVE_REQUESTS` dan `MOCK_ATTENDANCES`. Seluruh pemanggilan fungsi mengembalikan respons Axios riil.
* Pada `journalApi.js`: Hapus konstanta `MOCK_TEACHER_SCHEDULES` dan `MOCK_STUDENTS_CLASS_1`.

### 5c. Hasil Akhir yang Diharapkan (Expected Outcome Fase 5)
* Tidak ada lagi data dummy atau bypass autentikasi di seluruh antarmuka web.
* Pengujian fungsionalitas kuis AI berjalan secara nyata menggunakan endpoint Gemini Flash backend.
* Form login dan navigasi sistem terlihat profesional, bersih, dan siap untuk lingkungan evaluasi produksi.

---

## 9. Roadmap & Diagram Ketergantungan Eksekusi

```mermaid
flowchart TD
    subgraph Fase 1: P0 [Fase 1 - Prioritas P0]
        F1A["1a. Sambungkan Password ke PATCH /api/me/password"]
        F1B["1b. Perbaiki import classApi di MonitoringRecapPage"]
    end

    subgraph Fase 2: P1 [Fase 2 - Prioritas P1]
        F2A["2a. Nol-kan Default Kehadiran Ortu"]
        F2B["2b. Perbaiki Catch OTP Profile"]
        F2C["2c. Hapus Guard Dummy Jadwal Waka"]
        F2D["2d. Hapus Guard Dummy Dashboard Waka"]
        F2E["2e. Selaraskan Prasyarat PDF (Siswa & Guru FET v4.5)"]
    end

    subgraph Fase 3: P2 [Fase 3 - Prioritas P2]
        F3A["3a. Integrasi Unduh Template & Impor Guru Excel"]
        F3B["3b. Integrasi Unduh Template & Impor Siswa Excel (Gender/NISN)"]
        F3C["3c. Inisialisasi State Master Data & Promosi ke []"]
    end

    subgraph Fase 4: P3 [Fase 4 - Prioritas P3]
        F4A["4a. Ganti localStorage Izin Guru ke API teacher-leave-requests"]
        F4B["4b. Panel Verifikasi Izin Guru (Kesiswaan) & Read-Only Wali Kelas"]
        F4C["4c. Filter Jadwal & Jurnal Kelas Binaan Wali Kelas"]
        F4D["4d. Polling Asinkron Upload Import PDF"]
        F4E["4e. Hapus Simulasi Offline Kenaikan Kelas"]
    end

    subgraph Fase 5: P4 [Fase 5 - Prioritas P4 (Opsi B)]
        F5A["5a. Hapus DEMO_PRESETS & Tombol Demo di LoginPage"]
        F5B["5b. Hapus Role Switcher di TopBar"]
        F5C["5c. Hapus Seluruh Mock Data di quizApi, leaveApi, journalApi"]
    end

    Fase 1 --> Fase 2
    Fase 2 --> Fase 3
    Fase 3 --> Fase 4
    Fase 4 --> Fase 5
```

---

## 10. Daftar Lengkap Berkas Terdampak & Verifikasi

### Berkas Frontend yang Akan Dimodifikasi:

1. [`frontend/scp_web/src/context/AuthContext.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx) — Tangani respons password riil (Fase 1a) & hapus demo login (Fase 5b).
2. [`frontend/scp_web/src/pages/profile/ProfilePage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx) — Hapus swallow 404 password & catch OTP palsu (Fase 1a, 2b).
3. [`frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx) — Perbaiki pemanggilan `classApi` (Fase 1b).
4. [`frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx) — Default statistik kehadiran ke nol (Fase 2a).
5. [`frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx) — Inisialisasi `[]`, hapus guard dummy (Fase 2c).
6. [`frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx) — Inisialisasi `[]`, hapus guard dummy (Fase 2d).
7. [`frontend/scp_web/src/utils/prerequisiteHelper.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/prerequisiteHelper.js) — Logika prasyarat baru v4.5 (Fase 2e).
8. [`frontend/scp_web/src/pages/waka/UploadImportPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/UploadImportPage.jsx) — Banner prasyarat v4.5 (Fase 2e) & polling asinkron riil (Fase 4d).
9. [`frontend/scp_web/src/pages/waka/MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx) — Modal impor Excel Guru & Siswa, input gender & nisn, inisialisasi `[]` (Fase 3a, 3b, 3c).
10. [`frontend/scp_web/src/services/masterDataApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js) — Tambah method download template & import Excel (Fase 3a, 3b).
11. [`frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx) — API izin guru & delegasi tugas riil, selector jadwal kelas binaan (Fase 4a, 4c).
12. [`frontend/scp_web/src/pages/teacher/PermissionVerifyPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/PermissionVerifyPage.jsx) — Tab verifikasi izin guru, proteksi read-only wali kelas (Fase 4b).
13. [`frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx) — Dukungan jurnal KBM darurat wali kelas & proteksi teacher absent (Fase 4c).
14. [`frontend/scp_web/src/pages/waka/GradePromotionPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/GradePromotionPage.jsx) — Inisialisasi `[]`, hapus simulasi offline promosi (Fase 3c, 4e).
15. [`frontend/scp_web/src/pages/waka/ReviewImportPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx) — Inisialisasi `[]` (Fase 3c).
16. [`frontend/scp_web/src/pages/auth/LoginPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx) — Pembersihan total tombol demo login & presets (Fase 5b).
17. [`frontend/scp_web/src/components/layout/TopBar.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx) — Pembersihan total dropdown role switcher UKK (Fase 5b).
18. [`frontend/scp_web/src/context/authConstants.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/authConstants.js) — Hapus DEMO_PROFILES (Fase 5b).
19. [`frontend/scp_web/src/services/quizApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/quizApi.js) — Hapus seluruh mock dataset & integrasi Gemini AI riil (Fase 5b).
20. [`frontend/scp_web/src/services/leaveApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/leaveApi.js) — Hapus mock dataset & integrasi API perizinan guru/siswa (Fase 4a, 5b).
21. [`frontend/scp_web/src/services/journalApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/journalApi.js) — Hapus mock dataset (Fase 5b).
