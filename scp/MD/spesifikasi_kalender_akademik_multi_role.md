# Analisis Arsitektur dan Rencana Implementasi: Kalender Akademik Multi-Role (Waka, Guru, Siswa, Orang Tua)

**Project:** School Class Progress (SCP) — SMK Negeri 1 Bantul  
**Versi Dokumen:** v1.0 (Hasil Audit Arsitektur Aktual SCP v4.5)  
**Status:** Menunggu Persetujuan Pengguna (*Pending User Approval — Read-Only Analysis Phase*)  
**Lokasi Dokumen:** `D:\MyUKK\SchoolClassProject\scp\MD\spesifikasi_kalender_akademik_multi_role.md`  

> [!IMPORTANT]
> **Catatan Pelestarian Dokumen Spesifikasi Sumber:**  
> Dokumen ini menyajikan **18 Bagian Analisis Arsitektur & Rencana Implementasi** berdasarkan pemeriksaan kode aktual pada repositori backend (`/scp`) dan frontend (`/frontend/scp_web`). Naskah asli **Spesifikasi Fitur Kalender Akademik Multi-Role (227 baris)** tetap dipertahankan secara **utuh tanpa perubahan** pada bagian **[Lampiran: Dokumen Spesifikasi Sumber (Utuh)](#lampiran-dokumen-spesifikasi-sumber-utuh)** di akhir berkas ini.

---

## Daftar Isi

1. [Ringkasan dan Tujuan Fitur](#1-ringkasan-dan-tujuan-fitur)
2. [Hasil Analisis Arsitektur Project SCP](#2-hasil-analisis-arsitektur-project-scp)
3. [Kondisi Sistem Saat Ini](#3-kondisi-sistem-saat-ini)
4. [Evaluasi Spesifikasi Kalender Multi-Role](#4-evaluasi-spesifikasi-kalender-multi-role)
5. [Analisis Backend dan Endpoint API](#5-analisis-backend-dan-endpoint-api)
6. [Analisis Personalisasi Agenda Berdasarkan Role](#6-analisis-personalisasi-agenda-berdasarkan-role)
7. [Analisis Keamanan dan Isolasi Data](#7-analisis-keamanan-dan-isolasi-data)
8. [Analisis Komponen dan Halaman Frontend](#8-analisis-komponen-dan-halaman-frontend)
9. [Analisis Integrasi dengan Fitur SCP Lainnya](#9-analisis-integrasi-dengan-fitur-scp-lainnya)
10. [Analisis Database dan Relasi Data](#10-analisis-database-dan-relasi-data)
11. [Analisis Performa dan Optimasi](#11-analisis-performa-dan-optimasi)
12. [Ruang Lingkup dan Batasan](#12-ruang-lingkup-dan-batasan)
13. [Potensi Konflik, Risiko, dan Solusi](#13-potensi-konflik-risiko-dan-solusi)
14. [Daftar File yang Akan Dibuat atau Dimodifikasi](#14-daftar-file-yang-akan-dibuat-atau-dimodifikasi)
15. [Rencana Implementasi Bertahap](#15-rencana-implementasi-bertahap)
16. [Strategi Pengujian dan Validasi](#16-strategi-pengujian-dan-validasi)
17. [Kriteria Keberhasilan](#17-kriteria-keberhasilan)
18. [Daftar Keputusan yang Membutuhkan Persetujuan Saya](#18-daftar-keputusan-yang-membutuhkan-persetujuan-saya)
- [Lampiran: Dokumen Spesifikasi Sumber (Utuh)](#lampiran-dokumen-spesifikasi-sumber-utuh)

---

## 1. Ringkasan dan Tujuan Fitur

Fitur **Kalender Akademik Multi-Role** merupakan perluasan strategis dari modul **Kalender Akademik & Agenda Khusus KBM** yang sebelumnya telah diimplementasikan untuk peran Waka Kurikulum (`vice_principal`). Pengembangan ini bertujuan mengangkat kalender akademik menjadi **Fitur Terpadu Lintas Peran (*Centralized Management, Role-Aware Adaptive Views*)** yang dapat diakses oleh keempat peran utama dalam ekosistem SCP:

1. **Waka Kurikulum (`vice_principal`):** Mengelola penuh (CRUD) seluruh agenda sekolah, memantau dampak kegiatan terhadap KBM, serta melakukan filter simulasi kalender berdasarkan tingkat (`10`, `11`, `12`) maupun rombel kelas tertentu.
2. **Guru (`teacher`):** Melihat agenda seluruh sekolah (`all`) serta agenda tingkat (`grade`) dan rombel (`class`) yang beririsan dengan jadwal mengajar maupun kelas binaannya, lengkap dengan indikator dampak mengajar harian (*"Jadwal Anda Bebas"* vs *"KBM Parsial: Tetap Mengajar di Kelas ..."*) dan filter khusus jadwal sendiri.
3. **Siswa (`student`):** Melihat kalender bulanan dan daftar kegiatan mendatang (*Upcoming Events*) yang relevan khusus untuk seluruh sekolah (`all`), tingkat kelasnya (`grade`), dan rombelnya sendiri (`class`), disertai informasi status KBM dan instruksi kegiatan tanpa bisa melihat agenda khusus kelas/tingkat lain.
4. **Orang Tua (`parent`):** Memantau agenda sekolah dan kegiatan khusus yang berdampak pada anaknya secara transparan, lengkap dengan ringkasan kegiatan minggu berjalan, status kewajiban kehadiran anak (*libur di rumah* vs *kegiatan wajib non-KBM di sekolah*), serta dukungan pemilih anak (*Multi-Student Switcher*).

---

## 2. Hasil Analisis Arsitektur Project SCP

Hasil pemeriksaan langsung terhadap struktur kode aktual project SCP menunjukkan karakteristik arsitektur sebagai berikut:

### 2.1 Arsitektur Backend (`/scp`)
- **Framework & Database:** Laravel 13 (PHP 8.2+) dengan database utama PostgreSQL (`db_scp`) dan SQLite In-Memory (`:memory:`) untuk pengujian otomatis PHPUnit.
- **Autentikasi & Otorisasi:**
  - Menggunakan **Laravel Sanctum** (`auth:sanctum`) dan rate limiter (`throttle:api`) pada [`scp/routes/api.php`](file:///d:/MyUKK/SchoolClassProject/scp/routes/api.php#L36).
  - Otorisasi berbasis peran dikawal oleh [`RoleMiddleware.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Http/Middleware/RoleMiddleware.php#L16) dengan alias `role:...`.
  - Nilai kolom `users.role` yang sah di database adalah:
    - `'vice_principal'` (Waka Kurikulum / Administrator Akademik)
    - `'teacher'` (Guru Mapel, Wali Kelas, Guru BK/Kesiswaan)
    - `'student'` (Peserta Didik)
    - `'parent'` (Wali Murid / Orang Tua)
- **Model & Relasi Aktual:**
  - [`User.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Models/User.php): Menyimpan seluruh entitas pengguna (Waka, Guru, Siswa, Orang Tua) dalam satu tabel `users` (*Single-Table Inheritance* berbasis kolom `role`).
    - Siswa memiliki `class_id` yang berelasi ke [`Classes.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Models/Classes.php) melalui `schoolClass(): BelongsTo`.
    - Orang Tua memiliki `linked_student_id` yang berelasi ke akun Siswa melalui `linkedStudent(): BelongsTo`.
    - Guru memiliki relasi `schedules(): HasMany` ke [`Schedule.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Models/Schedule.php) (`teacher_id`) untuk **jadwal mengajar KBM**, serta relasi `assignments(): HasMany` ke [`TeacherAssignment.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Models/TeacherAssignment.php) (`user_id`) untuk **tugas tambahan** (`type = 'wali_kelas'` atau `'kesiswaan'`).
- **Service Layer & Controller Kalender:**
  - [`AcademicEvent.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Models/AcademicEvent.php): Model untuk tabel `academic_events` dengan atribut `title`, `description`, `start_date`, `end_date`, `type` (`holiday`, `school_event`, `class_event`, `exam`), `scope_type` (`all`, `grade`, `class`), `scope_targets` (JSON array), `disables_teaching` (boolean), `academic_year`, dan `created_by`.
  - [`AcademicCalendarExclusionService.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Services/AcademicCalendarExclusionService.php): Service terpusat yang menangani pengecekan `isEventApplicableToClass()`, `getActiveDisablingEvent()`, `getActiveEventsForClass()`, `getEventsForRange()`, dan *in-memory static caching* `$eventsByDateCache`.
  - [`AcademicEventController.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/AcademicEventController.php): Menangani endpoint `index`, `checkExemption`, `show`, `store`, `update`, dan `destroy`.

### 2.2 Arsitektur Frontend (`/frontend/scp_web`)
- **Framework & Routing:** React 19 + Vite + React Router v7 + Tailwind CSS + Vanilla CSS bertema *Exness Clean Precision*.
- **State & Konteks Autentikasi:**
  - [`AuthContext.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx): Menyimpan profil user dari `GET /api/me`, menyediakan fungsi `hasRole()`, `isKesiswaan()`, dan `isWaliKelas()`. Fungsi `hasRole()` secara otomatis menormalisasi `'vice_principal'` menjadi `'waka'`.
  - [`RoleRoute.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/routes/RoleRoute.jsx): Komponen pembungkus rute yang memvalidasi `allowedRoles` serta flag `requireKesiswaan` / `requireWaliKelas`.
  - [`AppRouter.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/routes/AppRouter.jsx): Mengatur *lazy-loading* seluruh halaman per role di dalam `<WebLayout />`.
  - [`Sidebar.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/Sidebar.jsx): Menampilkan navigasi dinamis berdasarkan `hasRole('waka')`, `hasRole('teacher')`, `hasRole('student')`, dan `hasRole('parent')`.
- **Service API:**
  - [`academicEventApi.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/academicEventApi.js): Sudah tersedia dan mengekspor `getEvents`, `getEventById`, `checkExemption`, `createEvent`, `updateEvent`, dan `deleteEvent`.

---

## 3. Kondisi Sistem Saat Ini

Sebelum pengembangan fitur Multi-Role ini, status implementasi Kalender Akademik pada project SCP adalah sebagai berikut:

1. **Sisi Waka Kurikulum (Sudah Berjalan):**
   - Halaman [`AcademicCalendarPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/AcademicCalendarPage.jsx) dan [`AcademicEventModal.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/components/AcademicEventModal.jsx) sudah aktif pada rute `/web/academic-calendar` (dengan redirect dari `/waka/academic-calendar`).
   - Waka dapat membuat, mengedit, dan menghapus agenda, serta memfilter berdasarkan kategori (`type`), namun belum memiliki dropdown filter simulasi per **Tingkat (`grade`)** atau **Rombel (`class_id`)** pada tampilan kalendernya.
2. **Sisi Guru, Siswa, dan Orang Tua (Belum Memiliki Halaman Kalender Khusus):**
   - **Guru:** Baru menerima banner hari libur/agenda hari ini di [`TeacherDashboardPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherDashboardPage.jsx) dan lencana *Bebas KBM* pada jadwal harian di [`TeacherSchedulePage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx) dan [`TeacherJournalPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx). Guru **belum memiliki menu Kalender Akademik** untuk melihat jadwal kegiatan bulanan ke depan.
   - **Siswa:** Baru menerima banner agenda hari ini di [`StudentHomePage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/student/StudentHomePage.jsx) dan blokir izin di [`StudentPermissionPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/student/StudentPermissionPage.jsx). Siswa **belum memiliki halaman Kalender & Kegiatan** (`/student/calendar`).
   - **Orang Tua:** Baru menerima banner agenda hari ini di [`ParentMonitoringPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx). Orang Tua **belum memiliki halaman Kalender Sekolah** (`/parent/calendar`).
3. **Sisi Endpoint Backend:**
   - Endpoint `GET /api/academic-events/my-calendar` **belum ada**.
   - Endpoint `GET /api/academic-events` dan `GET /api/academic-events/{id}` saat ini terbuka untuk semua role terautentikasi, tetapi belum memaksakan isolasi data otomatis apabila `for_my_class` tidak dikirim oleh klien.

---

## 4. Evaluasi Spesifikasi Kalender Multi-Role

Berdasarkan pencocokan dokumen spesifikasi terhadap kode aktual SCP, berikut adalah matriks evaluasi kesesuaian dan penyesuaian yang diperlukan:

| No | Bagian Spesifikasi | Kondisi Aktual di Codebase SCP | Status | Rekomendasi Penyesuaian Teknis |
| :---: | :--- | :--- | :---: | :--- |
| 1 | **Role Waka/Admin:** Tertulis `allowedRoles={['waka', 'admin']}` dan role `admin` | Di DB & Backend role Waka adalah `'vice_principal'`. Di Frontend `hasRole('waka')` memetakan `'vice_principal'` $\leftrightarrow$ `'waka'`. | **Sesuaikan** | Gunakan `'vice_principal'` di backend controller/middleware, dan `allowedRoles={['waka']}` pada `RoleRoute` di `AppRouter.jsx`. |
| 2 | **Relasi Kelas Guru:** Tertulis mengambil kelas yang diajar guru dari `TeacherAssignment` | `TeacherAssignment` hanya menyimpan tugas tambahan (`wali_kelas` & `kesiswaan`). Kelas yang diajar guru tersimpan di tabel **`schedules`** (`Schedule::where('teacher_id', $user->id)`). | **Wajib Disesuaikan** | Ambil kelas mengajar guru dari tabel `schedules` (untuk kalkulasi `affects_my_teaching` dan status KBM harian) **ditambah** kelas binaan dari `teacher_assignments` (Wali Kelas/BK) agar guru melihat seluruh agenda yang relevan dengan tugasnya. |
| 3 | **Relasi Orang Tua - Anak:** Tertulis menggunakan relasi `parent_student` (multi-anak) | Tidak ada tabel `parent_student`. Tabel `users` menggunakan kolom `linked_student_id` (`BelongsTo`). Satu siswa (`NIS`) berpasangan dengan 1 akun wali (`P-[NIS]`). Namun beberapa akun wali bisa memiliki `phone_number` / `email` / `google_id` orang tua yang sama. | **Sesuaikan Tanpa Ubah DB** | Buat helper `$user->getLinkedStudents()` pada model `User` yang mengambil siswa dari `linked_student_id` serta menggabungkan siswa kandung lain jika akun `parent` memiliki `phone_number`, `email`, atau `google_id` terverifikasi yang sama. Kontrak API tetap mengembalikan array `children` sehingga UI *Dropdown Anak* berjalan mulus untuk 1 maupun multi-anak tanpa migrasi tabel baru. |
| 4 | **Nama File API Frontend:** Tertulis `src/services/academicCalendarApi.js` | Sudah ada `src/services/academicEventApi.js` yang dipakai oleh 7 halaman aktif. | **Hindari Duplikasi** | Tambahkan fungsi `getMyCalendar(params)` langsung ke dalam [`src/services/academicEventApi.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/academicEventApi.js) (dan ekspor alias jika diperlukan) agar tidak ada 2 file API untuk entitas yang sama. |
| 5 | **Nama Modal Form Waka:** Tertulis `AcademicEventFormModal.jsx` | Sudah ada [`src/pages/waka/components/AcademicEventModal.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/components/AcademicEventModal.jsx) yang sudah teruji. | **Hindari Duplikasi** | Pertahankan `AcademicEventModal.jsx` untuk operasi CRUD Waka, dan buat `src/components/calendar/AcademicEventDetailModal.jsx` khusus untuk modal informasi *read-only* semua role. |
| 6 | **Route Kalender Waka:** Tertulis `/waka/calendar` | Route aktif di `Sidebar.jsx` & `AppRouter.jsx` adalah `/web/academic-calendar` (dan `/waka/academic-calendar`). | **Kompatibilitas** | Pertahankan `/web/academic-calendar` sebagai rute utama Waka, dan tambahkan rute redirect `<Route path="/waka/calendar" element={<Navigate to="/web/academic-calendar" replace />} />`. |
| 7 | **Isolasi Data Endpoint Lama:** Hanya membahas filter di `/my-calendar` | `GET /api/academic-events` dan `GET /api/academic-events/{id}` masih bisa diakses `student`/`parent` tanpa filter jika parameter query diubah manual. | **Penguatan Keamanan** | Terapkan juga pembatasan cakupan (*mandatory role scoping*) pada `AcademicEventController@index` dan `AcademicEventController@show` untuk role `student`, `parent`, dan `teacher`. |

---

## 5. Analisis Backend dan Endpoint API

### 5.1 Pendaftaran Route Baru (`scp/routes/api.php`)
Di dalam grup middleware `['auth:sanctum', 'throttle:api']`, sebelum rute wildcard `/academic-events/{id}`:

```php
// Kalender Akademik & Agenda Khusus KBM
Route::get('/academic-events/my-calendar', [AcademicEventController::class, 'myCalendar']);
Route::get('/academic-events/check-exemption', [AcademicEventController::class, 'checkExemption']);
Route::get('/academic-events', [AcademicEventController::class, 'index']);
Route::get('/academic-events/{id}', [AcademicEventController::class, 'show']);
```

> [!NOTE]
> Peletakan `/academic-events/my-calendar` **wajib berada di atas** `/academic-events/{id}` agar string `my-calendar` tidak ditangkap sebagai parameter `{id}` oleh router Laravel.

### 5.2 Spesifikasi Kontrak `GET /api/academic-events/my-calendar`
- **Query Parameters:**
  - `month` (opsional, integer `1..12`, default: bulan berjalan `Asia/Jakarta`)
  - `year` (opsional, integer `2020..2099`, default: tahun berjalan `Asia/Jakarta`)
  - `start_date` & `end_date` (opsional, `Y-m-d`, alternatif jika meminta rentang tanggal lintas bulan untuk *Upcoming Events*)
  - `type` (opsional, filter kategori: `holiday`, `school_event`, `class_event`, `exam`)
  - `class_id` (opsional, khusus Waka atau Guru untuk memfilter kelas tertentu)
  - `grade` (opsional, `10`, `11`, `12`, khusus Waka untuk memfilter tingkat tertentu)
  - `only_affects_my_teaching` (opsional, boolean, khusus Guru)
  - `child_id` (opsional, integer, khusus Orang Tua untuk memfilter anak tertentu)

- **Struktur JSON Response Standar SCP:**
```json
{
  "success": true,
  "message": "Kalender akademik berhasil dimuat.",
  "data": {
    "role": "teacher",
    "period": {
      "month": 11,
      "year": 2026,
      "start_date": "2026-11-01",
      "end_date": "2026-11-30"
    },
    "context": {
      "taught_classes": [
        { "id": 1, "name": "X RPL 1", "level": "10" },
        { "id": 15, "name": "XI RPL 1", "level": "11" }
      ],
      "homeroom_class": { "id": 1, "name": "X RPL 1", "level": "10" },
      "student": null,
      "children": []
    },
    "summary": {
      "total_events": 3,
      "holiday_count": 1,
      "special_event_count": 1,
      "exam_count": 1,
      "affecting_teaching_count": 2
    },
    "daily_teaching_status": {
      "2026-11-05": {
        "status": "partial_teaching",
        "label": "KBM Parsial: Tetap Mengajar di XI RPL 1",
        "exempted_classes": ["X RPL 1"],
        "active_classes": ["XI RPL 1"]
      },
      "2026-11-10": {
        "status": "full_free",
        "label": "Jadwal Anda Bebas",
        "exempted_classes": ["X RPL 1", "XI RPL 1"],
        "active_classes": []
      }
    },
    "events": [
      {
        "id": 12,
        "title": "Perkemahan Pramuka Blok Kelas X",
        "description": "Menggunakan seragam Pramuka lengkap, berkumpul pukul 06.30 WIB di lapangan utama.",
        "start_date": "2026-11-05",
        "end_date": "2026-11-06",
        "type": "class_event",
        "scope_type": "grade",
        "scope_targets": ["10"],
        "target_classes": [],
        "disables_teaching": true,
        "academic_year": "2025/2026 Ganjil",
        "affects_my_teaching": true,
        "affected_my_classes": ["X RPL 1"],
        "attendance_guidance": "Siswa wajib hadir mengikuti agenda kegiatan sekolah/lapangan. KBM reguler di kelas ditiadakan.",
        "applicable_children": []
      }
    ]
  }
}
```

---

## 6. Analisis Personalisasi Agenda Berdasarkan Role

### 6.1 Role Waka Kurikulum (`vice_principal`)
- **Cakupan Data:** Melihat seluruh agenda (`all`, `grade`, `class`).
- **Fitur Filter Tambahan:** Dapat memfilter berdasarkan `grade` (`10`, `11`, `12`) atau `class_id` (rombel tertentu) untuk melakukan simulasi tampilan kalender kelas/tingkat tertentu.
- **Hak Aksi:** Memiliki akses penuh tambah, ubah, dan hapus agenda (`canManage = true`).

### 6.2 Role Guru (`teacher`)
- **Resolusi Kelas Terkait Guru:**
  1. **Kelas Mengajar (`taughtClassIds`):** Diambil dari `Schedule::where('teacher_id', $user->id)->distinct()->pluck('class_id')`.
  2. **Kelas Binaan (`assignedClassIds`):** Diambil dari `TeacherAssignment::where('user_id', $user->id)->whereNotNull('class_id')->pluck('class_id')`.
  3. **Gabungan Kelas Relevan (`relevantClassIds`):** `array_unique(array_merge($taughtClassIds, $assignedClassIds))`.
  4. **Tingkat Kelas Relevan (`relevantGrades`):** Diambil dari `Classes::whereIn('id', $relevantClassIds)->pluck('level')` yang dinormalisasi via `normalizeGrade()` (`'10'`, `'11'`, `'12'`).
- **Filter Visibilitas Event:**
  - Event dengan `scope_type === 'all'` $\rightarrow$ **Tampil**.
  - Event dengan `scope_type === 'grade'` yang memiliki irisan dengan `$relevantGrades` $\rightarrow$ **Tampil**.
  - Event dengan `scope_type === 'class'` yang memiliki irisan dengan `$relevantClassIds` $\rightarrow$ **Tampil**.
  - *(Khusus Guru Kesiswaan yang membina lintas kelas atau jika memiliki penugasan global `class_id = null`: dapat melihat agenda kelas binaannya).*
- **Perhitungan `affects_my_teaching` & Status Mengajar Harian (`daily_teaching_status`):**
  - Sebuah event ditandai `affects_my_teaching = true` apabila:
    1. Event tersebut berlaku pada minimal satu kelas di dalam `$taughtClassIds`, **DAN**
    2. Pada rentang tanggal event (`start_date` s/d `end_date`), terdapat hari (`day_of_week` 1..7) di mana guru tersebut memiliki jadwal mengajar di kelas yang terdampak tersebut.
  - Untuk setiap tanggal $d$ dalam bulan berjalan yang memiliki agenda `disables_teaching = true`:
    - Sistem memeriksa seluruh jadwal mengajar guru pada hari `dayOfWeekIso` dari tanggal $d$.
    - Jika **semua** kelas yang diajar guru pada hari tersebut dibebaskan oleh agenda aktif $\rightarrow$ `status = 'full_free'`, `label = 'Jadwal Anda Bebas'`.
    - Jika **sebagian** kelas yang diajar guru dibebaskan, namun masih ada kelas lain yang tidak libur pada hari itu $\rightarrow$ `status = 'partial_teaching'`, `label = 'KBM Parsial: Tetap Mengajar di ' . implode(', ', $activeClassNames)`.

### 6.3 Role Siswa (`student`)
- **Resolusi Identitas Kelas Siswa:**
  - Mengambil `$user->class_id` dan model `Classes` terkait (`id`, `name`, `level`).
- **Filter Visibilitas Event:**
  - Hanya mengembalikan event di mana `AcademicCalendarExclusionService::isEventApplicableToClass($event, $class->id, $class->level)` bernilai `true`:
    - `scope_type === 'all'`
    - `scope_type === 'grade'` dengan target tingkat yang cocok dengan `$class->level`
    - `scope_type === 'class'` dengan target ID kelas yang memuat `$class->id`
  - **Isolasi Ketat:** Siswa Kelas 10 (`X RPL 1`) **tidak akan pernah** menerima data agenda khusus Kelas 11/12 maupun agenda khusus rombel `X RPL 2`.

### 6.4 Role Orang Tua (`parent`)
- **Resolusi Data Anak (`getLinkedStudents()`):**
  - Mengambil akun siswa utama dari `$user->linkedStudent` (`users.linked_student_id`).
  - Mendukung multi-anak secara otomatis apabila orang tua memiliki beberapa akun wali yang berbagi nomor telepon terverifikasi (`phone_number`), `email`, atau `google_id` yang sama (atau melalui relasi anak terkait).
- **Filter & Tagging Multi-Anak:**
  - Jika parameter `child_id` diberikan, sistem memvalidasi bahwa `child_id` ada di dalam koleksi anak milik orang tua tersebut (jika bukan anaknya, tolak dengan `403 Forbidden`).
  - Untuk setiap event yang dikembalikan, sistem menyertakan properti `applicable_children`: daftar anak yang terdampak oleh event tersebut beserta `tag_label`, misalnya `"Anak - Ahmad Fajar (X RPL 1)"`.
  - Menyertakan atribut `attendance_guidance` yang menjelaskan secara eksplisit bagi orang tua:
    - `type === 'holiday'`: *"Hari Libur Resmi Sekolah — Siswa libur dan belajar mandiri di rumah."*
    - `type === 'class_event'` / `'school_event'` dengan `disables_teaching = true`: *"Kegiatan Wajib Sekolah/Lapangan — Siswa wajib hadir mengikuti agenda kegiatan. KBM reguler di kelas ditiadakan."*
    - `type === 'exam'`: *"Masa Penilaian / Ujian — Siswa wajib hadir sesuai jadwal ujian. KBM reguler dialihkan."*
    - `disables_teaching = false`: *"Kegiatan Pendamping — KBM reguler tetap berjalan normal."*

---

## 7. Analisis Keamanan dan Isolasi Data

1. **Zero Client-Side Trust (Filter Wajib di Backend):**
   - Penyaringan agenda berdasarkan role dilakukan sepenuhnya di server pada `AcademicEventController` menggunakan identitas dari token Sanctum (`$request->user()`), bukan hanya disembunyikan di komponen React.
2. **Pengamanan Endpoint Eksisting (`GET /api/academic-events` & `GET /api/academic-events/{id}`):**
   - Agar tidak ada celah *Insecure Direct Object Reference (IDOR)* di mana siswa/orang tua memanggil `GET /api/academic-events` (tanpa `for_my_class=1`) atau `GET /api/academic-events/99` untuk melihat agenda kelas lain:
     - Pada `AcademicEventController@index`: Jika `$user->role === 'student'`, otomatis paksa filter ke `$user->class_id`. Jika `$user->role === 'parent'`, otomatis paksa filter ke kelas anak-anaknya.
     - Pada `AcademicEventController@show`: Jika `$user->role === 'student'` atau `'parent'`, periksa apakah agenda `{id}` relevan dengan kelas siswa/anaknya. Jika tidak relevan, kembalikan `403 Forbidden`.
3. **Proteksi Mutasi Data (Write Protection):**
   - Endpoint `POST /api/academic-events`, `PUT /api/academic-events/{id}`, dan `DELETE /api/academic-events/{id}` tetap berada di dalam grup middleware `role:vice_principal`.
   - Upaya mutasi oleh token `teacher`, `student`, atau `parent` otomatis ditolak dengan `403 Forbidden` oleh `RoleMiddleware`.
4. **Proteksi Parameter `child_id` pada Role Orang Tua:**
   - Jika orang tua mengirimkan `?child_id=X` di mana `X` bukan ID siswa yang terhubung dengannya, backend langsung mengembalikan `403 Forbidden` (`"Anda tidak memiliki akses ke data siswa tersebut."`).

---

## 8. Analisis Komponen dan Halaman Frontend

Untuk menjaga modularitas, kemudahan pemeliharaan (*maintainability*), dan konsistensi desain *Exness Clean Precision*, arsitektur komponen frontend dibagi menjadi **Komponen Kalender Bersama (`src/components/calendar/`)** dan **Halaman Spesifik Role (`src/pages/...`)**:

### 8.1 Komponen Bersama (`src/components/calendar/`)

1. **`SharedCalendarView.jsx` & `SharedCalendarView.css`:**
   - Bertanggung jawab merender **Toolbar Navigasi Bulan** (`Bulan Sebelumnya`, `Hari Ini`, `Bulan Berikutnya`, judul `Bulan Tahun`, dan slot filter kanan), **Grid Kalender Bulanan 7 Kolom (Senin–Minggu)**, serta **Bar Keterangan Warna (Legend)**.
   - **Props yang didukung:**
     - `year`, `month`, `onPrevMonth`, `onNextMonth`, `onToday`
     - `events`: daftar agenda yang sudah difilter
     - `canManage`: `boolean` (`true` hanya untuk Waka — menampilkan tombol `+` tambah agenda pada sel tanggal)
     - `userRole`: `'waka' | 'teacher' | 'student' | 'parent'`
     - `dailyTeachingStatus`: objek status mengajar per tanggal (khusus `teacher` untuk menampilkan badge *"Bebas KBM"* atau *"KBM Parsial"* di dalam sel tanggal)
     - `onDateClick(dateStr)`: handler tambah agenda pada tanggal tertentu (khusus Waka)
     - `onEventClick(event)`: handler klik chip agenda (membuka modal edit untuk Waka, atau membuka `AcademicEventDetailModal` *read-only* untuk Guru/Siswa/Orang Tua)
     - `toolbarRight`: React node kustom untuk filter spesifik role (dropdown kategori, tingkat, kelas, atau checkbox guru).

2. **`AcademicEventDetailModal.jsx`:**
   - Modal informasi detail agenda bersifat **Read-Only** untuk Guru, Siswa, dan Orang Tua (serta mode pratinjau).
   - Menampilkan:
     - Judul kegiatan & badge kategori (`Libur Resmi`, `Kegiatan Sekolah`, `Kegiatan Tingkat/Rombel`, `Ujian / Asesmen`).
     - Rentang tanggal terformat dalam Bahasa Indonesia (contoh: *Kamis, 5 November 2026 s/d Jumat, 6 November 2026*).
     - Cakupan peserta (`Seluruh Sekolah`, `Tingkat 10`, atau daftar nama rombel seperti `X RPL 1, X RPL 2`).
     - **Kotak Informasi Kontekstual Berdasarkan Role:**
       - Untuk **Guru**: Menampilkan status dampak terhadap jadwal mengajarnya (`affects_my_teaching`, daftar kelas ajar yang terdampak, dan apakah kewajiban jurnal ditiadakan).
       - Untuk **Siswa**: Menampilkan status KBM kelasnya dan catatan instruksi/perlengkapan kegiatan.
       - Untuk **Orang Tua**: Menampilkan panduan kepastian kehadiran anak (`attendance_guidance`) dan tag nama anak yang terdampak.

3. **`UpcomingEventsList.jsx`:**
   - Komponen daftar kartu kegiatan (*List Card View*) yang responsif untuk Siswa, Orang Tua, dan tampilan mobile.
   - Menampilkan setiap agenda dalam bentuk kartu terstruktur sesuai rancangan spesifikasi (tanggal lengkap, badge tingkat/kategori, judul kegiatan, status KBM/kehadiran, tag anak jika orang tua, dan deskripsi catatan lengkap).

### 8.2 Halaman Spesifik Role

1. **Halaman Waka (`src/pages/waka/AcademicCalendarPage.jsx`):**
   - Menggunakan `SharedCalendarView` dengan `canManage={true}`.
   - Dilengkapi 4 kartu KPI, filter Kategori + **filter Tingkat (`10`, `11`, `12`) / Rombel Kelas**, tabel manajemen agenda dengan aksi Edit & Hapus, `AcademicEventModal`, dan `ConfirmDialog`.
2. **Halaman Guru (`src/pages/teacher/TeacherCalendarPage.jsx`):**
   - Rute: `/teacher/calendar` | Menu Sidebar: **"Kalender Akademik"**.
   - Menampilkan ringkasan bulan berjalan (*Jumlah Hari Libur Resmi • Jumlah Agenda yang Mempengaruhi Jadwal Mengajar*).
   - Dilengkapi toggle filter: `[x] Tampilkan Hanya Agenda yang Mempengaruhi Jadwal Mengajar Saya`.
   - Menggunakan `SharedCalendarView` (`canManage={false}`, `userRole="teacher"`, `dailyTeachingStatus={...}`) di mana setiap sel tanggal yang terdampak menampilkan indikator status mengajar (*"Jadwal Anda Bebas"* atau *"KBM Parsial: Tetap Mengajar di ..."*), ditambah tab/daftar rincian kegiatan di bawahnya.
3. **Halaman Siswa (`src/pages/student/StudentCalendarPage.jsx`):**
   - Rute: `/student/calendar` | Menu Sidebar: **"Kalender & Kegiatan"**.
   - Header menampilkan identitas siswa dan badge rombel aktif (`[ Siswa: {Nama} - {Rombel} ]`).
   - Memiliki 2 Tab Tampilan:
     - **Tab 1: Tampilan Kalender Bulanan** (`SharedCalendarView`)
     - **Tab 2: Daftar Kegiatan Mendatang (List View)** (`UpcomingEventsList`)
   - Klik agenda pada kalender maupun kartu membuka `AcademicEventDetailModal`.
4. **Halaman Orang Tua (`src/pages/parent/ParentCalendarPage.jsx`):**
   - Rute: `/parent/calendar` | Menu Sidebar: **"Kalender Sekolah"**.
   - Header dilengkapi informasi/pemilih anak (`[ Pilih Anak: ... ]` — mendukung multi-anak maupun anak tunggal).
   - Menampilkan **Banner/Kartu "Informasi Minggu Ini untuk {Nama Anak}"** di bagian atas halaman agar orang tua langsung melihat agenda terdekat beserta kepastian kehadiran anak.
   - Menampilkan `SharedCalendarView` dengan legenda warna yang jelas serta `UpcomingEventsList` di bagian bawah.

---

## 9. Analisis Integrasi dengan Fitur SCP Lainnya

Seluruh fitur yang sudah berjalan di SCP dipastikan tetap terintegrasi dalam **satu sumber kebenaran (*Single Source of Truth*)** yaitu tabel `academic_events` dan `AcademicCalendarExclusionService`:

1. **Kalender Akademik Waka:** Setiap agenda yang dibuat, diubah, atau dihapus oleh Waka pada `/web/academic-calendar` langsung tercermin secara *real-time* pada kalender Guru, Siswa, dan Orang Tua tanpa sinkronisasi ganda.
2. **Jadwal Mengajar & Jurnal Guru (`ScheduleController` & `JournalController`):**
   - Logika `is_teaching_exempted` pada jadwal harian guru dan proteksi `TEACHING_DISABLED_BY_EVENT` (`HTTP 422`) pada jurnal tetap menggunakan `AcademicCalendarExclusionService` yang sama dengan perhitungan `affects_my_teaching` pada kalender Guru.
3. **Dashboard Guru, Siswa, dan Orang Tua:**
   - Banner informasi agenda aktif hari ini pada `TeacherDashboardPage.jsx`, `StudentHomePage.jsx`, dan `ParentMonitoringPage.jsx` dapat dilengkapi tombol pintasan (*shortcut link*) **"Lihat Kalender Akademik"** yang mengarahkan langsung ke `/teacher/calendar`, `/student/calendar`, dan `/parent/calendar`.
4. **Sistem Presensi & Perizinan (`AttendanceController`, `LeaveRequestController`, `TeacherLeaveRequestController`):**
   - Tidak ada perubahan yang merusak alur presensi maupun blokir pengajuan izin pada hari bebas-KBM yang sudah berjalan.
5. **Monitoring & Rekapitulasi Waka (`JournalController@dailyRecap`):**
   - Perhitungan target jurnal wajib dan jadwal yang dikecualikan (`exempted_schedules`) tetap konsisten dengan indikator `affects_my_teaching` yang dilihat guru pada kalendernya.

---

## 10. Analisis Database dan Relasi Data

Berdasarkan pemeriksaan skema database aktual:
1. **Tidak Diperlukan Migrasi Tabel Baru:**
   - Tabel `academic_events` (`2026_11_06_000001_create_academic_events_table.php`) sudah memiliki seluruh kolom yang dibutuhkan (`title`, `description`, `start_date`, `end_date`, `type`, `scope_type`, `scope_targets`, `disables_teaching`, `academic_year`, `created_by`, `timestamps`, `softDeletes`) beserta indeks komposit `['start_date', 'end_date']` dan `['type', 'scope_type']`.
2. **Pemanfaatan Relasi Model yang Ada:**
   - **Guru $\rightarrow$ Kelas Ajar:** `User::schedules()` (`schedules.teacher_id`) $\rightarrow$ `Schedule::schoolClass()` (`classes.id`, `classes.name`, `classes.level`).
   - **Guru $\rightarrow$ Kelas Binaan:** `User::assignments()` (`teacher_assignments.user_id`) $\rightarrow$ `TeacherAssignment::schoolClass()`.
   - **Siswa $\rightarrow$ Kelas:** `User::schoolClass()` (`users.class_id` $\rightarrow$ `classes.id`).
   - **Orang Tua $\rightarrow$ Siswa:** `User::linkedStudent()` (`users.linked_student_id` $\rightarrow$ `users.id`), diperkaya dengan method helper `User::getLinkedStudents()` pada [`User.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Models/User.php) yang mengambil siswa utama serta mendeteksi apabila terdapat akun wali lain dengan `phone_number`, `email`, atau `google_id` terverifikasi yang sama (sehingga mendukung skenario orang tua dengan >1 anak tanpa mengubah struktur tabel `users`).

---

## 11. Analisis Performa dan Optimasi

1. **Pencegahan Query N+1 pada Resolusi Nama Kelas (`target_classes`):**
   - Ketika terdapat banyak agenda dengan `scope_type = 'class'` dalam satu bulan, pemanggilan `Classes::whereIn('id', ...)` tidak boleh dilakukan di dalam *loop* per event.
   - **Solusi:** Kumpulkan seluruh ID kelas unik dari semua event `scope_type = 'class'` pada bulan tersebut, lakukan **1 kali query** `Classes::whereIn('id', $allTargetClassIds)->get(['id', 'name', 'level'])->keyBy('id')`, lalu petakan di memori.
2. **Kalkulasi `daily_teaching_status` Guru Tanpa Query Berulang:**
   - Jadwal mengajar mingguan milik guru (`Schedule::where('teacher_id', $user->id)->with('schoolClass:id,name,level')->get()`) hanya diambil **1 kali per request** dan dikelompokkan berdasarkan `day_of_week` di memori.
   - Pencocokan jadwal guru terhadap agenda sepanjang 30 hari dalam sebulan diproses sepenuhnya di memori dalam waktu $< 2\text{ ms}$.
3. **Indeks Rentang Tanggal Database:**
   - Query filter bulanan pada `academic_events` memanfaatkan indeks `idx_academic_events_dates` (`start_date`, `end_date`) yang sudah terpasang.

---

## 12. Ruang Lingkup dan Batasan

### Dalam Ruang Lingkup (In-Scope):
- Pembuatan endpoint `GET /api/academic-events/my-calendar` dengan personalisasi penuh untuk 4 role (`vice_principal`, `teacher`, `student`, `parent`).
- Penguatan isolasi akses data berdasarkan role pada `GET /api/academic-events` dan `GET /api/academic-events/{id}`.
- Penambahan helper `getLinkedStudents()` pada model `User` untuk mendukung multi-anak pada role Orang Tua.
- Pembuatan komponen bersama `SharedCalendarView.jsx`, `AcademicEventDetailModal.jsx`, dan `UpcomingEventsList.jsx`.
- Pembaruan `AcademicCalendarPage.jsx` (Waka) agar menggunakan `SharedCalendarView` dan mendukung filter tingkat/rombel.
- Pembuatan halaman `TeacherCalendarPage.jsx`, `StudentCalendarPage.jsx`, dan `ParentCalendarPage.jsx`.
- Pendaftaran rute baru pada `AppRouter.jsx` dan penambahan menu navigasi pada `Sidebar.jsx` untuk Guru, Siswa, dan Orang Tua.
- Pembuatan *Automated Feature Test* `tests/Feature/MultiRoleAcademicCalendarAccessTest.php`.

### Di Luar Ruang Lingkup (Out-of-Scope):
- Mengubah struktur tabel database yang sudah berjalan atau mereset data yang sudah tersimpan.
- Mengubah mekanisme autentikasi login atau mengubah fitur Kuis AI, Import Jadwal PDF/Excel, maupun Kenaikan Kelas.
- Membuat sistem notifikasi push eksternal (WhatsApp/Email) di luar portal web.

---

## 13. Potensi Konflik, Risiko, dan Solusi

| No | Potensi Risiko / Konflik | Dampak | Solusi Mitigasi |
| :---: | :--- | :--- | :--- |
| 1 | **Urutan Route Wildcard di `routes/api.php`:** Jika `/academic-events/my-calendar` ditaruh setelah `/academic-events/{id}`, Laravel akan menganggap `my-calendar` sebagai `{id}` dan mengembalikan `404 Not Found`. | Endpoint `/my-calendar` gagal diakses. | Daftarkan `Route::get('/academic-events/my-calendar', ...)` **sebelum** `Route::get('/academic-events/{id}', ...)`. |
| 2 | **Guru Mengajar di Siklus Mingguan Berbeda (`cycle_type`):** Jadwal di SCP mendukung siklus putaran (Siklus 1, 2, dst.). | Jika hanya memeriksa siklus 1, guru yang mengajar kelas X di siklus 2 bisa tidak terdeteksi `affects_my_teaching`. | Ambil kelas ajar guru dari jadwal aktif (dengan memprioritaskan `active_cycle` dari `SystemConfiguration` untuk status harian, serta mencakup seluruh kelas yang diampu guru pada semester aktif untuk filter visibilitas agenda). |
| 3 | **Format `level` Kelas Tidak Seragam (`'10'` vs `'X'`):** Di database, kolom `classes.level` bisa berisi `'10'` atau `'X'`. | Filter `scope_type = 'grade'` tidak cocok jika dibandingkan langsung tanpa normalisasi. | Gunakan selalu helper `$this->exclusionService->normalizeGrade($level)` yang menyamakan `'X'` $\rightarrow$ `'10'`, `'XI'` $\rightarrow$ `'11'`, dan `'XII'` $\rightarrow$ `'12'`. |
| 4 | **Kebocoran Data Kelas Lain pada Siswa/Orang Tua:** Jika frontend memanggil endpoint `/api/academic-events` tanpa parameter. | Siswa kelas 10 bisa melihat agenda khusus rombel kelas 12. | Terapkan *server-side role scoping* baik di `/api/academic-events/my-calendar` maupun di `/api/academic-events` dan `/api/academic-events/{id}`. |
| 5 | **Tampilan Grid Kalender di Layar Mobile Sempit:** Grid 7 kolom pada layar ponsel ($< 640\text{px}$) dapat membuat teks chip agenda terpotong. | UX kurang nyaman di layar HP siswa/orang tua. | Sediakan *horizontal scroll* halus atau tampilan ringkas pada grid mobile di `SharedCalendarView.css`, serta sediakan tab/bagian `UpcomingEventsList` (*List Card View*) yang sangat ramah layar mobile. |

---

## 14. Daftar File yang Akan Dibuat atau Dimodifikasi

### A. Backend (`/scp`)

| Status | Path File Aktual | Deskripsi Perubahan |
| :---: | :--- | :--- |
| **Modifikasi** | [`scp/app/Models/User.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Models/User.php) | Menambahkan helper `getLinkedStudents()` untuk mengambil koleksi siswa terkait akun Orang Tua (mendukung 1 maupun multi-anak). |
| **Modifikasi** | [`scp/app/Services/AcademicCalendarExclusionService.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Services/AcademicCalendarExclusionService.php) | Menambahkan helper evaluasi dampak jadwal mengajar guru (`evaluateTeacherCalendarImpact`) dan resolusi panduan kehadiran (`getAttendanceGuidance`). |
| **Modifikasi** | [`scp/app/Http/Controllers/API/AcademicEventController.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/AcademicEventController.php) | Menambahkan method `myCalendar(Request $request)` serta memperketat isolasi role pada `index()` dan `show()`. |
| **Modifikasi** | [`scp/routes/api.php`](file:///d:/MyUKK/SchoolClassProject/scp/routes/api.php) | Mendaftarkan endpoint `GET /api/academic-events/my-calendar`. |
| **Buat Baru** | `scp/tests/Feature/MultiRoleAcademicCalendarAccessTest.php` | Pengujian otomatis (Feature Test) untuk akses Waka, personalisasi Guru, isolasi tingkat/rombel Siswa, dan multi-anak Orang Tua. |

### B. Frontend (`/frontend/scp_web`)

| Status | Path File Aktual | Deskripsi Perubahan |
| :---: | :--- | :--- |
| **Modifikasi** | [`frontend/scp_web/src/services/academicEventApi.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/academicEventApi.js) | Menambahkan method `getMyCalendar: (params) => api.get('/academic-events/my-calendar', { params })`. |
| **Buat Baru** | `frontend/scp_web/src/components/calendar/SharedCalendarView.jsx` | Komponen kalender bulanan bersama yang mendukung mode kelola (`canManage`) dan mode baca lintas role beserta badge status mengajar guru. |
| **Buat Baru** | `frontend/scp_web/src/components/calendar/SharedCalendarView.css` | Styling bersih untuk komponen kalender bersama, chip agenda, badge status KBM, dan responsivitas mobile. |
| **Buat Baru** | `frontend/scp_web/src/components/calendar/AcademicEventDetailModal.jsx` | Modal detail agenda *read-only* dengan informasi kontekstual sesuai role pengguna. |
| **Buat Baru** | `frontend/scp_web/src/components/calendar/UpcomingEventsList.jsx` | Komponen daftar kartu kegiatan mendatang (*List View*) untuk Siswa, Orang Tua, dan Guru. |
| **Modifikasi** | [`frontend/scp_web/src/pages/waka/AcademicCalendarPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/AcademicCalendarPage.jsx) | Integrasi `SharedCalendarView` dan penambahan filter simulasi berdasarkan Tingkat (`grade`) & Rombel (`class_id`). |
| **Buat Baru** | `frontend/scp_web/src/pages/teacher/TeacherCalendarPage.jsx` | Halaman Kalender Akademik Guru (`/teacher/calendar`) dengan ringkasan bulan, filter `affects_my_teaching`, dan indikator status mengajar harian. |
| **Buat Baru** | `frontend/scp_web/src/pages/student/StudentCalendarPage.jsx` | Halaman Kalender & Kegiatan Siswa (`/student/calendar`) dengan tab Kalender Bulanan & Daftar Kegiatan Mendatang. |
| **Buat Baru** | `frontend/scp_web/src/pages/parent/ParentCalendarPage.jsx` | Halaman Kalender Sekolah Orang Tua (`/parent/calendar`) dengan pemilih anak, ringkasan minggu ini, kepastian kehadiran, dan kalender bulanan. |
| **Modifikasi** | [`frontend/scp_web/src/routes/AppRouter.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/routes/AppRouter.jsx) | Pendaftaran rute `/teacher/calendar`, `/student/calendar`, `/parent/calendar`, dan alias `/waka/calendar`. |
| **Modifikasi** | [`frontend/scp_web/src/components/layout/Sidebar.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/Sidebar.jsx) | Penambahan item menu navigasi kalender pada Sidebar Guru, Siswa, dan Orang Tua. |

---

## 15. Rencana Implementasi Bertahap

Pekerjaan dibagi ke dalam **4 Fase Terukur** dengan urutan dari Backend $\rightarrow$ Shared Components $\rightarrow$ Role Pages & Routing $\rightarrow$ Automated Testing & Build Verification:

### Fase 1: Pengembangan Backend & Personalisasi Endpoint API
- **Tujuan Fase:** Menyediakan fondasi data dan endpoint `GET /api/academic-events/my-calendar` yang aman dan terpersonalisasi untuk 4 role, sekaligus memperketat isolasi akses pada endpoint kalender yang sudah ada.
- **Aktivitas yang Harus Dilakukan:**
  1. Menambahkan method `getLinkedStudents()` pada `User.php`.
  2. Menambahkan helper evaluasi dampak jadwal mengajar guru dan panduan kehadiran pada `AcademicCalendarExclusionService.php`.
  3. Mengimplementasikan `AcademicEventController@myCalendar` untuk memproses filter berdasarkan role (`vice_principal`, `teacher`, `student`, `parent`), memperkaya data `target_classes`, `affects_my_teaching`, `daily_teaching_status`, dan `applicable_children`.
  4. Menambahkan *role scoping* otomatis untuk `student` dan `parent` pada `AcademicEventController@index` dan `AcademicEventController@show`.
  5. Mendaftarkan rute `GET /api/academic-events/my-calendar` pada `scp/routes/api.php`.
- **Backend yang Terdampak:** Model `User`, Service `AcademicCalendarExclusionService`, Controller `AcademicEventController`, dan `routes/api.php`.
- **Frontend yang Terdampak:** Belum ada (tidak memutus kontrak API lama).
- **File yang Dibuat/Dimodifikasi:**
  - `scp/app/Models/User.php`
  - `scp/app/Services/AcademicCalendarExclusionService.php`
  - `scp/app/Http/Controllers/API/AcademicEventController.php`
  - `scp/routes/api.php`
- **Ketergantungan:** Tidak ada (menggunakan tabel `academic_events` yang sudah aktif).
- **Risiko yang Perlu Diperhatikan:** Pastikan eager loading / batch lookup `Classes` digunakan agar tidak timbul N+1 query.
- **Skenario Pengujian:** Pengujian pemanggilan endpoint `/api/academic-events/my-calendar` menggunakan token masing-masing role.
- **Kriteria Keberhasilan:** Endpoint mengembalikan HTTP 200 dengan struktur JSON yang tepat sesuai role, dan menolak akses lintas kelas secara tidak sah.

### Fase 2: Pembuatan Service API & Komponen Kalender Bersama (Frontend Shared Layer)
- **Tujuan Fase:** Membangun komponen kalender modular (`SharedCalendarView`, `AcademicEventDetailModal`, `UpcomingEventsList`) dan memperbarui halaman Waka agar menggunakan komponen bersama tersebut.
- **Aktivitas yang Harus Dilakukan:**
  1. Menambahkan `getMyCalendar(params)` pada `src/services/academicEventApi.js`.
  2. Membuat `SharedCalendarView.jsx` dan `SharedCalendarView.css`.
  3. Membuat `AcademicEventDetailModal.jsx` untuk tampilan detail *read-only* yang adaptif terhadap role.
  4. Membuat `UpcomingEventsList.jsx` untuk tampilan kartu daftar agenda.
  5. Memperbarui `AcademicCalendarPage.jsx` (Waka) untuk menggunakan `SharedCalendarView` (`canManage={true}`) serta menambahkan filter Tingkat (`grade`) dan Rombel (`class_id`).
- **Backend yang Terdampak:** Tidak ada.
- **Frontend yang Terdampak:** Service `academicEventApi.js`, folder `src/components/calendar/`, dan `AcademicCalendarPage.jsx`.
- **File yang Dibuat/Dimodifikasi:**
  - `frontend/scp_web/src/services/academicEventApi.js`
  - `frontend/scp_web/src/components/calendar/SharedCalendarView.jsx`
  - `frontend/scp_web/src/components/calendar/SharedCalendarView.css`
  - `frontend/scp_web/src/components/calendar/AcademicEventDetailModal.jsx`
  - `frontend/scp_web/src/components/calendar/UpcomingEventsList.jsx`
  - `frontend/scp_web/src/pages/waka/AcademicCalendarPage.jsx`
- **Ketergantungan:** Bergantung pada Fase 1.
- **Risiko yang Perlu Diperhatikan:** Menjaga agar fungsi tambah, edit, dan hapus agenda pada halaman Waka tidak mengalami regresi.
- **Skenario Pengujian:** Menguji navigasi bulan, filter tingkat/rombel, dan modal CRUD pada halaman Waka.
- **Kriteria Keberhasilan:** Halaman Kalender Waka berjalan mulus menggunakan `SharedCalendarView` dan komponen bersama siap dikonsumsi halaman role lain.

### Fase 3: Implementasi Halaman Kalender Guru, Siswa, Orang Tua, Routing & Sidebar
- **Tujuan Fase:** Menghadirkan halaman kalender khusus untuk Guru, Siswa, dan Orang Tua beserta integrasi penuh pada `AppRouter.jsx` dan `Sidebar.jsx`.
- **Aktivitas yang Harus Dilakukan:**
  1. Membuat `TeacherCalendarPage.jsx` dengan ringkasan bulanan, filter checkbox *"Tampilkan Hanya Agenda yang Mempengaruhi Jadwal Mengajar Saya"*, badge status mengajar harian pada sel kalender, dan modal detail.
  2. Membuat `StudentCalendarPage.jsx` dengan informasi kelas siswa, tab *Tampilan Kalender Bulanan* & *Daftar Kegiatan Mendatang (List View)*, serta modal detail.
  3. Membuat `ParentCalendarPage.jsx` dengan pemilih anak (*Multi-Student Switcher*), kartu sorotan *"Informasi Minggu Ini"*, legenda warna, kalender bulanan, dan daftar agenda.
  4. Mendaftarkan rute `/teacher/calendar`, `/student/calendar`, `/parent/calendar`, dan redirect `/waka/calendar` di `AppRouter.jsx`.
  5. Menambahkan tautan menu di `Sidebar.jsx` untuk Guru (*"Kalender Akademik"*), Siswa (*"Kalender & Kegiatan"*), dan Orang Tua (*"Kalender Sekolah"*).
- **Backend yang Terdampak:** Tidak ada.
- **Frontend yang Terdampak:** Halaman Guru, Siswa, Orang Tua, `AppRouter.jsx`, dan `Sidebar.jsx`.
- **File yang Dibuat/Dimodifikasi:**
  - `frontend/scp_web/src/pages/teacher/TeacherCalendarPage.jsx`
  - `frontend/scp_web/src/pages/student/StudentCalendarPage.jsx`
  - `frontend/scp_web/src/pages/parent/ParentCalendarPage.jsx`
  - `frontend/scp_web/src/routes/AppRouter.jsx`
  - `frontend/scp_web/src/components/layout/Sidebar.jsx`
- **Ketergantungan:** Bergantung pada Fase 1 dan Fase 2.
- **Risiko yang Perlu Diperhatikan:** Pastikan `RoleRoute` membungkus masing-masing rute dengan tepat sehingga role lain tidak bisa mengakses rute yang bukan haknya.
- **Skenario Pengujian:** Login sebagai Guru, Siswa, dan Orang Tua untuk memverifikasi menu sidebar, tampilan kalender, filter, dan modal detail *read-only*.
- **Kriteria Keberhasilan:** Keempat role memiliki akses ke halaman kalender masing-masing sesuai matriks RBAC.

### Fase 4: Pengujian Otomatis (Automated Testing) & Verifikasi Build
- **Tujuan Fase:** Memastikan seluruh skenario keamanan, isolasi data antar-role, dan integrasi frontend-backend terverifikasi secara otomatis tanpa regresi.
- **Aktivitas yang Harus Dilakukan:**
  1. Menyusun `scp/tests/Feature/MultiRoleAcademicCalendarAccessTest.php` yang menguji:
     - **Test 1 (Waka Access):** Waka dapat membuat, melihat, memfilter per kelas/tingkat, mengubah, dan menghapus agenda.
     - **Test 2 (Teacher Personalization & Read-Only):** Guru hanya menerima agenda `all` dan agenda tingkat/rombel yang terkait jadwalnya, menerima flag `affects_my_teaching` dan `daily_teaching_status` (`full_free` vs `partial_teaching`), serta mendapat `403 Forbidden` jika mencoba membuat/mengubah/menghapus agenda.
     - **Test 3 (Student Grade & Class Isolation):** Siswa kelas 10 (`X RPL 1`) melihat agenda `all`, tingkat `10`, dan kelas `X RPL 1`, tetapi **tidak melihat** agenda tingkat `11` atau kelas `X RPL 2` (baik via `/my-calendar` maupun `/academic-events`), serta mendapat `403` jika mengakses detail agenda kelas lain.
     - **Test 4 (Parent Multi-Child & Security):** Orang tua melihat agenda anaknya (termasuk penggabungan tag anak jika memiliki 2 anak di tingkat berbeda), dan mendapat `403 Forbidden` jika mencoba memfilter `child_id` milik siswa lain.
  2. Menjalankan suite pengujian PHPUnit (`AcademicCalendarExclusionTest` dan `MultiRoleAcademicCalendarAccessTest`).
  3. Menjalankan `npm --prefix frontend/scp_web run build` untuk memverifikasi tidak ada error kompilasi maupun *broken imports*.
- **Backend yang Terdampak:** `scp/tests/Feature/MultiRoleAcademicCalendarAccessTest.php`.
- **Frontend yang Terdampak:** Verifikasi build produksi Vite.
- **File yang Dibuat/Dimodifikasi:**
  - `scp/tests/Feature/MultiRoleAcademicCalendarAccessTest.php`
- **Ketergantungan:** Bergantung pada Fase 1, 2, dan 3.
- **Risiko yang Perlu Diperhatikan:** Pastikan `AcademicCalendarExclusionService::clearCache()` selalu dipanggil pada `setUp()` dan `tearDown()` di pengujian.
- **Skenario Pengujian:** Eksekusi `php artisan test` dan `vite build`.
- **Kriteria Keberhasilan:** 100% test lulus (hijau) dan build frontend sukses tanpa error.

---

## 16. Strategi Pengujian dan Validasi

1. **Automated Feature Testing (PHPUnit):**
   - Menjalankan `MultiRoleAcademicCalendarAccessTest.php` untuk memvalidasi kontrak JSON `/api/academic-events/my-calendar`, akurasi flag `affects_my_teaching`, akurasi status `full_free` vs `partial_teaching` pada guru yang mengajar lintas tingkat, isolasi ketat siswa antar-tingkat/rombel, serta keamanan multi-anak pada orang tua.
   - Menjalankan kembali `AcademicCalendarExclusionTest.php` untuk memastikan fitur pengecualian jurnal dan rekapitulasi Waka yang sudah ada tetap 100% lulus tanpa regresi.
2. **Validasi Keamanan & Otorisasi:**
   - Memastikan request `POST/PUT/DELETE /api/academic-events` oleh role `teacher`, `student`, dan `parent` ditolak dengan HTTP `403`.
   - Memastikan request `GET /api/academic-events/{id}` untuk agenda khusus kelas lain oleh `student` atau `parent` ditolak dengan HTTP `403`.
3. **Validasi Frontend & Build:**
   - Memastikan `npm --prefix frontend/scp_web run build` menghasilkan bundle produksi tanpa warning/error sintaks.

---

## 17. Kriteria Keberhasilan

Implementasi dinyatakan berhasil apabila seluruh kriteria berikut terpenuhi:
- [ ] Endpoint `GET /api/academic-events/my-calendar` aktif dan mengembalikan agenda yang terpersonalisasi sesuai role user login.
- [ ] Waka Kurikulum dapat mengelola agenda serta memfilter tampilan kalender berdasarkan tingkat maupun rombel kelas.
- [ ] Guru dapat mengakses menu **Kalender Akademik** (`/teacher/calendar`), melihat indikator dampak mengajar (*"Jadwal Anda Bebas"* vs *"KBM Parsial"*), dan memfilter agenda yang berdampak pada jadwal mengajarnya.
- [ ] Siswa dapat mengakses menu **Kalender & Kegiatan** (`/student/calendar`), beralih antara tampilan Kalender Bulanan dan Daftar Kegiatan Mendatang, serta hanya melihat agenda yang berlaku bagi kelas/tingkatnya.
- [ ] Orang Tua dapat mengakses menu **Kalender Sekolah** (`/parent/calendar`), melihat sorotan agenda minggu ini beserta panduan kehadiran anak, serta memilih filter anak jika memiliki lebih dari satu anak.
- [ ] Seluruh pengujian otomatis pada `MultiRoleAcademicCalendarAccessTest` dan `AcademicCalendarExclusionTest` lulus 100%.

---

## 18. Daftar Keputusan yang Membutuhkan Persetujuan Saya

Sebelum masuk ke tahap implementasi kode, mohon konfirmasi Anda terhadap **4 poin keputusan teknis** berikut:

1. **Mekanisme Relasi Orang Tua dengan Banyak Anak (Multi-Student):**
   - Di database SCP saat ini, tabel `users` menghubungkan akun orang tua (`P-[NIS]`) ke siswa melalui kolom `linked_student_id` (tanpa tabel pivot `parent_student`).
   - **Opsi A (Direkomendasikan — Tanpa Ubah Struktur Database):** Pertahankan struktur tabel `users` saat ini dan buat helper `getLinkedStudents()` di model `User` yang mengambil siswa dari `linked_student_id` serta otomatis menggabungkan saudara kandung apabila akun orang tua memiliki `phone_number`, `email`, atau `google_id` terverifikasi yang sama. Endpoint `/my-calendar` tetap mengembalikan array `children` dan tag `[Anak - Nama (Kelas)]` sehingga UI *Dropdown Anak* berfungsi penuh tanpa migrasi database baru.
   - **Opsi B:** Membuat migrasi tabel pivot baru `parent_student` di database.

2. **Cakupan Visibilitas Agenda Kelas bagi Guru (`role = teacher`):**
   - Di SCP, jadwal mengajar guru ada di tabel `schedules`, sedangkan tugas Wali Kelas / Guru BK ada di `teacher_assignments`.
   - **Opsi A (Direkomendasikan):** Guru dapat melihat agenda berlingkup `all` + agenda `grade`/`class` untuk seluruh kelas yang **diajarnya di jadwal (`schedules`)** maupun kelas yang **dibinanya (`teacher_assignments`)**, sedangkan flag `affects_my_teaching` dihitung secara spesifik dari jadwal mengajar KBM aktifnya di `schedules`.
   - **Opsi B:** Hanya menampilkan agenda dari jadwal mengajar (`schedules`) saja tanpa menyertakan kelas binaan Wali Kelas/BK.

3. **Pengamanan Endpoint Lama (`GET /api/academic-events` & `GET /api/academic-events/{id}`):**
   - **Opsi A (Direkomendasikan — Isolasi Ketat):** Selain menyediakan `/api/academic-events/my-calendar`, terapkan juga pembatasan otomatis di backend pada `GET /api/academic-events` dan `GET /api/academic-events/{id}` agar role `student` dan `parent` tidak dapat melihat agenda khusus kelas/tingkat lain meskipun memanggil URL API secara langsung.
   - **Opsi B:** Biarkan endpoint `/api/academic-events` seperti saat ini dan hanya terapkan filter ketat pada endpoint baru `/api/academic-events/my-calendar`.

4. **Fitur Cetak / Ekspor Agenda pada Halaman Kalender:**
   - Pada Tabel Matriks RBAC di spesifikasi tercantum baris *"Ekspor Jadwal / Unduh PDF Agenda: Ya"*, namun tidak dirinci pada spesifikasi komponen.
   - **Opsi A (Direkomendasikan):** Sediakan tombol **"Cetak / Simpan PDF"** bersih berbasis `@media print` / *printable view* pada halaman kalender agar semua role dapat mencetak atau menyimpan PDF agenda bulanan secara langsung tanpa menambah beban library berat.
   - **Opsi B:** Tidak perlu menambahkan tombol cetak/ekspor pada tahap ini (fokus pada tampilan kalender interaktif dan daftar kegiatan saja).

---

## Lampiran: Dokumen Spesifikasi Sumber (Utuh)

Berikut adalah naskah asli dokumen spesifikasi sumber yang dipertahankan secara utuh sebagai referensi:

# Spesifikasi Fitur: Kalender Akademik Multi-Role (Waka, Guru, Siswa, Orang Tua)

**Status Dokumen:** Proposed / Ready for Implementation  
**Target Rilis:** Modul Kalender Terpadu Multi-Role v1.0  
**Komponen Terdampak:**  
- **Backend API (`/scp`):** Routing, Middleware Otorisasi, Endpoint Personalisasi Agenda (`/api/academic-events/my-calendar`).
- **Frontend Web (`/frontend/scp_web`):** Komponen Kalender Bersama (*Shared Calendar Component*), Navigasi Sidebar tiap role, Halaman Tampilan Spesifik Peran (*Role-Aware Views*).

---

## 1. Latar Belakang & Kebutuhan

Sebelumnya, pengelolaan kalender dan agenda sekolah dirancang hanya sebagai alat administratif di sisi Waka (Wakil Kepala Sekolah Bidang Kurikulum). Namun di lapangan:
1. **Guru:** Perlu melihat jauh ke depan kapan ada ujian, libur nasional, rapat dinas, maupun kegiatan perkemahan/proyek P5 agar dapat merancang modul ajar dan target capaian kurikulum.
2. **Siswa:** Perlu mengetahui jadwal kegiatan sekolah, masa jeda tengah semester, asesmen sumatif, serta agenda khusus untuk tingkat kelas mereka (misal: jadwal gladi bersih, perkemahan, studi lapangan).
3. **Orang Tua:** Membutuhkan transparansi jadwal operasional sekolah anak secara real-time untuk sinkronisasi agenda keluarga, persiapan perlengkapan acara khusus anak, dan kepastian hari libur resmi.

Oleh karena itu, modul Kalender Akademik diangkat menjadi **Fitur Terpadu Lintas Peran (Multi-Role Academic Calendar)** dengan hak kelola terpusat (*Centralized Management*) namun dapat diakses secara transparan dengan tampilan yang terpersonalisasi (*Role-Aware Adaptive Views*).

---

## 2. Matriks Hak Akses & Matriks Fitur (RBAC Matrix)

| Fitur / Aksi | Waka / Admin | Guru (Teacher) | Siswa (Student) | Orang Tua (Parent) |
| :--- | :---: | :---: | :---: | :---: |
| **Melihat Seluruh Agenda Sekolah (`all`)** | Ya | Ya | Ya | Ya |
| **Melihat Agenda Khusus Tingkat Sendiri** | Ya (Semua) | Ya (Terkait jam ajar) | Ya (Sesuai tingkatnya) | Ya (Sesuai anak) |
| **Melihat Agenda Khusus Rombel Sendiri** | Ya (Semua) | Ya (Terkait rombel ajar) | Ya (Sesuai rombel) | Ya (Sesuai anak) |
| **Membuat / Menambah Agenda Baru** | Ya | Tidak (Read-Only) | Tidak (Read-Only) | Tidak (Read-Only) |
| **Mengedit / Menghapus Agenda** | Ya | Tidak | Tidak | Tidak |
| **Melihat Detail Dampak KBM & Jurnal** | Ya (Lengkap) | Ya (Fokus Dampak Jurnal) | Terbatas (Info Masuk/Libur) | Terbatas (Info Masuk/Libur) |
| **Filter Tampilan Kalender** | Bebas semua kelas | Berdasarkan jadwal sendiri | Otomatis tingkat sendiri | Otomatis rombel anak |
| **Ekspor Jadwal / Unduh PDF Agenda** | Ya | Ya | Ya | Ya |

---

## 3. Penyesuaian Arsitektur Backend (`/scp`)

### 3.1 Endpoint Terpersonalisasi Berdasarkan Token (`AuthContext`)

Selain endpoint CRUD administratif Waka (`POST/PUT/DELETE /api/academic-events`), dibuat endpoint khusus yang menyajikan agenda yang telah difilter sesuai konteks pengguna yang sedang login:

* **Endpoint:** `GET /api/academic-events/my-calendar`
* **Query Params:** `month=MM&year=YYYY`
* **Middleware:** `auth:sanctum`

#### Logika Penentuan Filter di Controller (`AcademicEventController@myCalendar`):
1. **Role Waka / Admin:**
   - Menampilkan seluruh agenda tanpa filter, dapat melihat opsi switch ke rombel mana pun.
2. **Role Guru:**
   - Menampilkan agenda dengan `scope_type: all`.
   - Menampilkan agenda `scope_type: grade` atau `class` yang beririsan dengan daftar kelas yang diajar oleh guru tersebut pada semester aktif (melalui relasi `TeacherAssignment`).
   - Menyertakan flag penanda: `affects_my_teaching: true/false`.
3. **Role Siswa:**
   - Menampilkan agenda `scope_type: all`.
   - Mengambil `grade_level` dan `class_id` siswa login dari relasi `User -> Classes`.
   - Menampilkan event tingkat yang cocok atau event spesifik kelas siswa.
4. **Role Orang Tua:**
   - Mengambil data anak dari relasi `parent_student`.
   - Jika memiliki lebih dari 1 anak yang bersekolah di tempat yang sama (misal anak 1 di Kelas 10 dan anak 2 di Kelas 12), sistem mengembalikan agenda gabungan dengan label tag pembeda: `[Tag: Anak - Fajar (X RPL 1)]`.

---

## 4. Rancangan UI/UX & Tampilan Tiap Role (`/frontend/scp_web`)

Untuk efisiensi kode dan konsistensi visual, dibuat komponen inti yang dapat digunakan kembali:  
📁 `src/components/calendar/SharedCalendarView.jsx`

Komponen ini menerima properti:
- `canManage`: boolean (`true` hanya untuk Waka/Admin).
- `events`: array data agenda.
- `onDateClick`, `onEventClick`: handler modal detail.
- `userRole`: konteks peran aktif.

---

### 4.1 Tampilan Role Guru (`/teacher/calendar`)
**Akses:** Sidebar Menu Guru -> **"Kalender Akademik"**

```
+----------------------------------------------------------------------------------------------------+
|  TopBar: Kalender Akademik Guru                                        [ Bulan Ini: Nov 2026 v ]    |
+----------------------------------------------------------------------------------------------------+
|  Ringkasan Bulan Ini: 2 Hari Libur Resmi • 1 Agenda Kegiatan Tingkat (Bebas Jurnal Mengajar)        |
|  [ ] Tampilkan Hanya Agenda yang Mempengaruhi Jadwal Mengajar Saya                                  |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | SENIN         | SELASA        | RABU          | KAMIS         | JUMAT         | SABTU        |  |
|  | 2             | 3             | 4             | 5             | 6             | 7            |  |
|  |               |               |               | [*] Pramuka X | [*] Pramuka X |              |  |
|  |               |               |               | Kelas 10      | Kelas 10      |              |  |
|  |               |               |               | [!] Bebas KBM | [!] Bebas KBM |              |  |
|  +---------------+---------------+---------------+---------------+---------------+--------------+  |
|  | 9             | 10            | 11            | 12            | 13            | 14           |  |
|  |               | [x] Libur     |               |               |               |              |  |
|  |               | Hari Pahlawan |               |               |               |              |  |
|  |               | Bebas KBM     |               |               |               |              |  |
|  +---------------+---------------+---------------+---------------+---------------+--------------+  |
+----------------------------------------------------------------------------------------------------+
```

#### Fitur Khusus Guru:
- **Badge Status Mengajar:** Jika pada hari kegiatan Pramuka guru tersebut hanya mengajar Kelas 10, muncul label *"Jadwal Anda Bebas"*. Jika guru tersebut juga mengajar Kelas 11 di jam berikutnya, muncul label *"KBM Parsial: Tetap Mengajar di Kelas 11"*.
- **Klik Sel / Agenda:** Membuka modal informasi ringkas kegiatan sekolah tanpa form edit (read-only).

---

### 4.2 Tampilan Role Siswa (`/student/calendar`)
**Akses:** Sidebar Menu Siswa -> **"Kalender & Kegiatan"**

```
+----------------------------------------------------------------------------------------------------+
|  TopBar: Kalender Kegiatan Siswa                                   [ Siswa: Ahmad Fajar - X RPL 1 ] |
+----------------------------------------------------------------------------------------------------+
|  [ Tab: Tampilan Kalender Bulanan ]  [ Tab: Daftar Kegiatan Mendatang (List View) ]                 |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | KAMIS, 5 NOVEMBER 2026 s/d JUMAT, 6 NOVEMBER 2026                                            |  |
|  | [BADGE: KEGIATAN TINGKAT X]                                                                  |  |
|  | Judul: Perkemahan Pramuka Blok Kelas X                                                       |  |
|  | Status KBM: Libur KBM Kelas (Mengikuti agenda lapangan)                                      |  |
|  | Catatan: Menggunakan seragam Pramuka lengkap, berkumpul pukul 06.30 WIB di lapangan utama.    |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | SELASA, 10 NOVEMBER 2026                                                                     |  |
|  | [BADGE: LIBUR NASIONAL]                                                                      |  |
|  | Judul: Hari Pahlawan Nasional (Seluruh Tingkat Libur)                                        |  |
|  +----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

#### Fitur Khusus Siswa:
- **Tampilan Kalender Sederhana & List Card:** Siswa dapat beralih antara tampilan kotak kalender dan tampilan daftar kegiatan terdekat (*Upcoming Events*).
- **Instruksi Khusus:** Dapat membaca deskripsi perlengkapan atau pengumuman yang disematkan pihak sekolah untuk agenda tersebut.

---

### 4.3 Tampilan Role Orang Tua (`/parent/calendar`)
**Akses:** Sidebar Menu Orang Tua -> **"Kalender Sekolah"**

```
+----------------------------------------------------------------------------------------------------+
|  TopBar: Agenda & Kalender Akademik Sekolah                         [ Pilih Anak: Ahmad Fajar v ]   |
+----------------------------------------------------------------------------------------------------+
|  Keterangan Warna: [ Merah: Libur Sekolah ]  [ Kuning: Kegiatan Khusus ]  [ Biru: Masa Ujian ]      |
|                                                                                                    |
|  Informasi Minggu Ini untuk Ahmad Fajar (Kelas X RPL 1):                                           |
|  +----------------------------------------------------------------------------------------------+  |
|  | Kamis - Jumat, 5 - 6 November 2026                                                           |  |
|  | Kegiatan: Perkemahan Pramuka Blok Kelas X                                                    |  |
|  | Kepastian Kehadiran: Siswa wajib hadir di sekolah / lokasi kemah. KBM reguler ditiadakan.  |  |
|  +----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

#### Fitur Khusus Orang Tua:
- **Dropdown Anak (Multi-Student Switcher):** Jika orang tua mendaftarkan lebih dari satu anak, kalender dapat disaring per anak atau menampilkan agenda gabungan.
- **Transparansi Libur & Kepulangan:** Informasi jelas apakah agenda tersebut merupakan hari libur di rumah (*school holiday*) atau kegiatan wajib non-KBM di sekolah (*mandatory extracurricular activity*).

---

## 5. Struktur Berkas Frontend yang Ditambahkan / Dimodifikasi

```
frontend/scp_web/src/
├── components/
│   └── calendar/
│       ├── SharedCalendarView.jsx       <-- Grid kalender bulanan serbaguna
│       ├── SharedCalendarView.css
│       ├── AcademicEventDetailModal.jsx <-- Modal detail kegiatan (Read-Only)
│       └── UpcomingEventsList.jsx       <-- Tampilan list kegiatan untuk mobile/siswa
├── pages/
│   ├── waka/
│   │   ├── AcademicCalendarPage.jsx     <-- Tampilan Waka (+ Tombol Buat/Edit/Hapus)
│   │   └── components/
│   │       └── AcademicEventFormModal.jsx
│   ├── teacher/
│   │   └── TeacherCalendarPage.jsx      <-- Tampilan Guru (Indikator Dampak Mengajar)
│   ├── student/
│   │   └── StudentCalendarPage.jsx      <-- Tampilan Siswa (Fokus Rombel & Agenda Diri)
│   └── parent/
│       └── ParentCalendarPage.jsx       <-- Tampilan Orang Tua (Filter Anak & Keterangan)
├── routes/
│   └── AppRouter.jsx                    <-- Pendaftaran rute baru untuk semua role
└── services/
    └── academicCalendarApi.js           <-- Axios wrapper getEvents, getMyCalendar, CRUD
```

---

## 6. Pendaftaran Rute Frontend (`AppRouter.jsx`)

Semua role mendapatkan rute khusus dengan penjagaan hak akses (*RoleRoute*):

```jsx
// Role Waka / Kurikulum
<Route element={<RoleRoute allowedRoles={['waka', 'admin']} />}>
  <Route path="/waka/calendar" element={<AcademicCalendarPage />} />
</Route>

// Role Guru
<Route element={<RoleRoute allowedRoles={['teacher']} />}>
  <Route path="/teacher/calendar" element={<TeacherCalendarPage />} />
</Route>

// Role Siswa
<Route element={<RoleRoute allowedRoles={['student']} />}>
  <Route path="/student/calendar" element={<StudentCalendarPage />} />
</Route>

// Role Orang Tua
<Route element={<RoleRoute allowedRoles={['parent']} />}>
  <Route path="/parent/calendar" element={<ParentCalendarPage />} />
</Route>
```

---

## 7. Rencana Pengujian Otomatis Fitur Multi-Role

Pada berkas pengujian backend `tests/Feature/MultiRoleAcademicCalendarAccessTest.php`:

1. **Test Waka Access:** Memastikan Waka dapat melakukan create, read, update, dan delete agenda.
2. **Test Teacher Personalization:** Guru login hanya menerima agenda umum dan agenda yang berdampak pada tingkat/kelas tempat ia mengajar. Upaya membuat agenda baru dengan token guru menghasilkan `403 Forbidden`.
3. **Test Student Grade Isolation:** Siswa kelas 10 dapat melihat agenda Pramuka Kelas 10, tetapi siswa kelas 11 tidak melihat agenda tersebut di kalender personalnya (hanya melihat agenda berlingkup `all` atau tingkat 11).
4. **Test Parent Multi-Child View:** Orang tua dengan 2 anak di tingkat berbeda dapat melihat agenda kedua anaknya secara terintegrasi.
