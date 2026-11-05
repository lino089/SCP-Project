# Analisis Arsitektur dan Rencana Implementasi Fitur: Kalender Akademik & Agenda Khusus KBM (Event-Driven Academic Calendar)

**Project:** School Class Progress (SCP) — SMK Negeri 1 Bantul  
**Versi Rencana:** v1.0 (Berdasarkan Audit Kode Aktual SCP v4.5)  
**Status:** Menunggu Persetujuan Pengguna (*Pending User Approval — Read-Only Analysis Phase*)  
**Lokasi Dokumen:** `D:\MyUKK\SchoolClassProject\scp\MD\fitur_kalender_akademik_agenda_kbm - Copy.md`  

> **Catatan Pelestarian Dokumen Sumber:**  
> Dokumen ini memuat **15 Bagian Analisis Arsitektur & Rencana Implementasi** yang disesuaikan dengan kondisi kode aktual project SCP. Naskah asli **Spesifikasi Fitur Sumber (308 baris)** tetap dipertahankan secara **utuh tanpa perubahan satu karakter pun** pada bagian **[Lampiran: Dokumen Spesifikasi Sumber (Utuh)](#lampiran-dokumen-spesifikasi-sumber-utuh)** di akhir berkas ini.

---

## Daftar Isi

1. [Ringkasan dan Tujuan Fitur](#1-ringkasan-dan-tujuan-fitur)
2. [Hasil Analisis Arsitektur Project SCP](#2-hasil-analisis-arsitektur-project-scp)
3. [Kondisi Sistem Saat Ini](#3-kondisi-sistem-saat-ini)
4. [Evaluasi dan Penyesuaian Spesifikasi Fitur](#4-evaluasi-dan-penyesuaian-spesifikasi-fitur)
5. [Analisis Integrasi Backend](#5-analisis-integrasi-backend)
6. [Analisis Integrasi Frontend](#6-analisis-integrasi-frontend)
7. [Analisis Database dan Relasi Data](#7-analisis-database-dan-relasi-data)
8. [Analisis Hak Akses dan Keamanan](#8-analisis-hak-akses-dan-keamanan)
9. [Potensi Konflik, Risiko, dan Solusi](#9-potensi-konflik-risiko-dan-solusi)
10. [Ruang Lingkup dan Batasan Implementasi](#10-ruang-lingkup-dan-batasan-implementasi)
11. [Rencana Implementasi Bertahap](#11-rencana-implementasi-bertahap)
12. [Daftar File yang Akan Dibuat atau Dimodifikasi](#12-daftar-file-yang-akan-dibuat-atau-dimodifikasi)
13. [Strategi Pengujian dan Validasi](#13-strategi-pengujian-dan-validasi)
14. [Kriteria Keberhasilan](#14-kriteria-keberhasilan)
15. [Hal yang Membutuhkan Konfirmasi atau Keputusan Pengguna](#15-hal-yang-membutuhkan-konfirmasi-atau-keputusan-pengguna)
- [Lampiran: Dokumen Spesifikasi Sumber (Utuh)](#lampiran-dokumen-spesifikasi-sumber-utuh)

---

## 1. Ringkasan dan Tujuan Fitur

### 1.1 Latar Belakang Masalah pada Sistem Aktual
Saat ini, sistem **School Class Progress (SCP)** mengasumsikan bahwa setiap hari kerja (Senin–Jumat) adalah hari Kegiatan Belajar Mengajar (KBM) reguler yang aktif untuk seluruh tingkat kelas (`10`, `11`, `12`) dan seluruh rombel (48 kelas). Dalam operasional nyata di SMK Negeri 1 Bantul, terdapat berbagai kondisi pengecualian KBM:
1. **Hari Libur Nasional / Cuti Bersama (`scope_type = 'all'`):** Seluruh kegiatan KBM di sekolah ditiadakan.
2. **Kegiatan Khusus Tingkat (`scope_type = 'grade'`):** Misalnya Tingkat `10` mengikuti Kemah Pramuka Blok atau Asesmen Bakat Minat, sementara Tingkat `11` dan `12` tetap melaksanakan KBM reguler.
3. **Kegiatan Khusus Rombel (`scope_type = 'class'`):** Misalnya rombel `XI RPL 1` melaksanakan Kunjungan Industri (KI) atau Praktik Kerja Lapangan, sedangkan rombel lain tetap KBM normal.
4. **Masa Penilaian / Ujian (`type = 'exam'`):** KBM reguler per mata pelajaran ditiadakan atau digantikan jadwal ujian.

Karena belum adanya modul Kalender Akademik:
- Endpoint deteksi keterlambatan jurnal (`GET /api/schedules?status=missing_journal`) menandai guru sebagai **"Terlambat / Belum Mengisi Jurnal"** pada hari libur atau saat kelas yang diampunya sedang mengikuti kegiatan luar/sekolah.
- Guru terpaksa tidak mengisi jurnal (yang merusak statistik kepatuhan) atau mengisi jurnal fiktif.
- Siswa dan Orang Tua tidak mendapatkan informasi terpusat di dashboard mengenai perubahan status KBM harian pada kelasnya.

### 1.2 Tujuan Utama Fitur
1. **Pengelolaan Kalender Akademik Terpusat oleh Waka Kurikulum:** Menyediakan antarmuka kalender interaktif bagi Waka untuk mengelola agenda sekolah (`holiday`, `school_event`, `class_event`, `exam`) beserta rentang tanggal (`start_date` – `end_date`), cakupan (`all`, `grade`, `class`), dan dampak terhadap KBM (`disables_teaching`).
2. **Otomatisasi Eksklusi Jadwal, Jurnal, & Presensi:** Menyediakan layanan terpusat (`AcademicCalendarExclusionService`) yang mendeteksi apakah suatu jadwal kelas pada tanggal tertentu dikecualikan dari kewajiban KBM, memblokir pembukaan/pengisian jurnal & presensi pada jadwal yang dikecualikan (`HTTP 422`), serta mengecualikannya dari daftar keterlambatan jurnal (`missing_journal`).
3. **Perhitungan Kepatuhan & Monitoring yang Akurat:** Memastikan jadwal yang dikecualikan (`is_teaching_exempted = true`) tidak dihitung sebagai kelalaian guru pada dashboard Waka, dashboard Guru, maupun halaman Monitoring & Rekapitulasi.
4. **Transparansi Informasi Lintas Role:** Menampilkan banner/badge status agenda KBM secara *real-time* pada portal Guru, Siswa, dan Orang Tua, serta mengintegrasikannya dengan validasi pengajuan izin.

---

## 2. Hasil Analisis Arsitektur Project SCP

Berdasarkan pemeriksaan langsung pada kode sumber (`scp/` dan `frontend/scp_web/`), berikut adalah arsitektur aktual yang diterapkan di project SCP:

### 2.1 Arsitektur Backend (`scp/`)
- **Framework & Database Engine:**
  - Laravel 13 (Headless REST API Provider) dengan autentikasi token berbasis **Laravel Sanctum**.
  - Database utama menggunakan **PostgreSQL** (`db_scp`), sedangkan pengujian otomatis (`PHPUnit`) berjalan menggunakan **SQLite In-Memory** (`:memory:`). Oleh karena itu, seluruh migration dan query Eloquent **wajib kompatibel dengan PostgreSQL dan SQLite** (tidak boleh menggunakan sintaks mentah spesifik MySQL seperti `ENGINE=InnoDB` atau fungsi tanggal spesifik MySQL).
- **Standar Response JSON (`app/Http/Controllers/Controller.php`):**
  - Seluruh controller di `App\Http\Controllers\API\*` mewarisi base `Controller` yang memiliki helper:
    - `$this->sendResponse($data, $message, $code = 200)` $\rightarrow$ mengembalikan `{"success": true, "message": "...", "data": ...}`.
    - `$this->sendError($message, $errors = [], $code = 400)` $\rightarrow$ mengembalikan `{"success": false, "message": "...", "errors": ...}`.
  - Untuk kode error spesifik domain (seperti `TEACHING_DISABLED_BY_EVENT`), response JSON dapat menyertakan field tambahan atau menggunakan struktur standar `response()->json([...], 422)` yang tetap memuat `success: false`, `message`, dan `error_code` agar kompatibel dengan interceptor Axios frontend.
- **Mekanisme Autentikasi, Role, & Step-Up Auth:**
  - Tabel `users` menggunakan kolom `role` dengan 4 nilai sah: `'vice_principal'`, `'teacher'`, `'student'`, `'parent'`.
  - Middleware otorisasi didefinisikan di `app/Http/Middleware/RoleMiddleware.php` (`role:vice_principal`, `role:teacher`, `role:student`) dan seluruh endpoint terproteksi berada di bawah grup `Route::middleware(['auth:sanctum', 'throttle:api'])` pada `scp/routes/api.php`.
  - Base `Controller` menyediakan metode `$this->passwordIsConfirmed(Request $request)` untuk validasi *Step-Up Authentication* (konfirmasi ulang password Waka pada aksi sensitif).
- **Service Layer & Pola Optimasi Performa (Static In-Memory Cache):**
  - Logika bisnis lintas modul ditempatkan di `app/Services/` (contoh: `PeriodResolutionService.php`, `MasterDataDependencyService.php`, `TeacherMatcherService.php`, `AIService.php`).
  - `PeriodResolutionService` menerapkan **static in-memory cache** (`protected static ?string $activeCycleCache`, `protected static array $templatesCache`, beserta metode `clearCache()`) untuk mencegah masalah *N+1 query* ketika meresolusi ratusan baris jadwal sekaligus dalam satu request HTTP. Pola ini **wajib** diikuti oleh `AcademicCalendarExclusionService`.

### 2.2 Arsitektur Frontend (`frontend/scp_web/`)
- **Tech Stack & Struktur Direktori:**
  - React.js (Vite) dengan React Router v6 (`src/routes/AppRouter.jsx`), Axios instance terpusat (`src/services/api.js`), Context API (`src/context/AuthContext.jsx`, `src/context/ToastContext.jsx`), dan ikon dari `lucide-react`.
  - Struktur halaman dipisahkan per role di bawah `src/pages/`:
    - `waka/`: `DashboardWakaPage.jsx`, `MasterDataPage.jsx`, `ScheduleManagementPage.jsx`, `ScheduleImportPage.jsx`, `MonitoringRecapPage.jsx`, `PermissionVerifyPage.jsx`, `GradePromotionPage.jsx`.
    - `teacher/`: `TeacherDashboardPage.jsx`, `TeacherSchedulePage.jsx`, `TeacherJournalPage.jsx`, `TeacherLeavePage.jsx`, `TeacherQuizPage.jsx`.
    - `student/`: `StudentHomePage.jsx`, `StudentSchedulePage.jsx`, `StudentPermissionPage.jsx`, `StudentQuizPage.jsx`.
    - `parent/`: `ParentMonitoringPage.jsx`.
- **Pemetaan Role di Frontend (`AuthContext.jsx`):**
  - Berbeda dengan backend yang menggunakan string `'vice_principal'`, di frontend `AuthContext.jsx` menyediakan fungsi `hasRole(roles)` dengan `ROLE_MAP` yang memetakan `'waka' -> 'vice_principal'`.
  - Pada `AppRouter.jsx`, route khusus Waka dibungkus dengan `<RoleRoute allowedRoles={['waka']}>`.
- **Komponen UI Bersama (`src/components/ui/` & `src/components/schedule/`):**
  - Tersedia komponen standar: `Card`, `Badge`, `Button`, `Modal`, `Table`, `Input`, `Select`, `EmptyState`, `LoadingSpinner`, `Skeleton`, `ConfirmDialog`, `PasswordConfirmModal`, `StatusLabel`, serta matriks jadwal `ScheduleTimetableMatrix.jsx`.

---

## 3. Kondisi Sistem Saat Ini

Hasil pemeriksaan mekanisme aktual pada 7 modul utama yang berkaitan dengan Kalender Akademik:

### 3.1 Master Data Kelas & Tahun Ajaran (`Classes.php`, `SystemConfiguration.php`)
- Model `App\Models\Classes` merujuk ke tabel `classes` dengan kolom: `id`, `name` (misal `"X RPL 1"`), `level` (**integer**: `10`, `11`, `12`), `major` (misal `"RPL"`), `homeroom_teacher_id`, `counselor_id`, `academic_year` (misal `"2025/2026"`), dan `is_active` (boolean).
- Pengaturan akademik global disimpan di tabel `system_configurations` (`key` / `value`), seperti `active_cycle` (`regular`, `ramadhan`, `exam`), `monday_type` (`senin_upacara`, `senin_reguler`), dan `active_academic_year`, yang dikelola lewat `AcademicSettingController.php`.

### 3.2 Jadwal Pelajaran & Deteksi Jurnal Terlambat (`ScheduleController.php`)
- **Seluruh** pengambilan daftar jadwal untuk Waka, Guru, Siswa, dan Orang Tua dilayani oleh **satu metode utama**: `ScheduleController@index` (`GET /api/schedules`). Tidak ada metode `getTeacherSchedule` di codebase.
- `ScheduleController@index` memiliki **2 percabangan logika**:
  1. **Cabang `status=missing_journal` (Baris 58–133):**
     - Mengambil jadwal pada hari ini (`day_of_week = $now->dayOfWeekIso`) dan siklus aktif (`cycle_type = $activeCycle`).
     - Mengecek apakah jadwal pada tanggal hari ini (`$todayStr`) belum memiliki record di tabel `journals`.
     - Menghitung batas waktu `end_time + 30 menit` lewat `PeriodResolutionService`. Jika waktu sekarang melewati batas tersebut, jadwal dikembalikan sebagai *alert* keterlambatan jurnal (ditampilkan di `DashboardWakaPage.jsx` dan `TeacherDashboardPage.jsx`).
  2. **Cabang Listing Reguler (Baris 135–255):**
     - Melayani filter `class_id`, `teacher_id`, `subject_id`, `room_id`, `day_of_week`, `cycle_type`, `scope=homeroom`, dan `all=1`.
     - Saat `all=1` (digunakan oleh matriks jadwal Waka dan jadwal mingguan Guru), endpoint mengembalikan hingga **721 baris jadwal** dalam satu respons JSON, lengkap dengan `time_Info` (`start_time`, `end_time`) dan `today_journal_status` untuk tanggal referensi `$referenceDate`.

### 3.3 Jurnal Mengajar & Presensi Siswa (`JournalController.php` & `AttendanceController.php`)
- **Penting:** Di SCP, `AttendanceController.php` hanya memiliki metode `index` (`GET /api/attendances`) yang bersifat **read-only**.
- Seluruh proses pembukaan sesi KBM, pengisian jurnal, dan pencatatan presensi siswa dilakukan secara **atomik di dalam `JournalController.php`**:
  1. **`POST /api/journals` (`JournalController@store`):**
     - Guru pengampu (atau Guru Kesiswaan/BK jika menggantikan) membuka sesi KBM pada hari jadwal berlangsung.
     - Mendukung `status = 'ongoing'` (membuka kelas) atau `status = 'teacher_absent'`.
  2. **`PUT /api/journals/{id}` (`JournalController@update`):**
     - Menyelesaikan jurnal (`status = 'completed'`), mengunggah/mengompresi foto bukti KBM, dan menyimpan array `exceptions` presensi siswa.
     - Secara otomatis membuat record `Attendance` untuk seluruh siswa aktif di kelas tersebut (siswa yang tidak ada di `exceptions` otomatis tercatat `hadir`, sedangkan siswa yang sedang memiliki izin disetujui otomatis disinkronkan statusnya).
  3. **`PATCH /api/journals/{id}` (`JournalController@markTeacherAbsent`):**
     - Mengubah status jurnal menjadi `teacher_absent` beserta `absence_reason`.

### 3.4 Monitoring & Rekapitulasi Waka (`MonitoringRecapPage.jsx` & `MasterDataSummaryController.php`)
- `MasterDataSummaryController@index` (`GET /api/master-data/summary`) saat ini **hanya** mengembalikan jumlah entitas master statis (`classes`, `rooms`, `subjects`, `teachers`, `students`, `schedules`).
- `MonitoringRecapPage.jsx` saat ini memanggil `GET /api/attendances` dan `GET /api/journals` (dengan filter `date_from`, `date_to`, `class_id`), lalu menghitung `journalMetrics` di sisi frontend dari tabel `journals` yang sudah terbentuk (`completed / total journals`). Jadwal yang sama sekali belum dibuka jurnalnya belum tercermin sebagai baris `[Belum Terisi]` maupun `[Dikecualikan: Acara]` pada tabel jurnal di halaman tersebut.

### 3.5 Dashboard Guru, Siswa, Orang Tua, & Sistem Perizinan
- **Guru (`TeacherDashboardPage.jsx`, `TeacherSchedulePage.jsx`, `TeacherJournalPage.jsx`):**
  - Mengambil jadwal dari `GET /api/schedules` dan jurnal dari `GET /api/journals`.
  - Tombol `"Buka Kelas / Isi Jurnal"` aktif pada hari jadwal berlangsung selama `today_journal_status` belum terisi.
- **Siswa (`StudentHomePage.jsx`, `StudentSchedulePage.jsx`, `StudentPermissionPage.jsx`):**
  - `StudentHomePage.jsx` menampilkan ringkasan kehadiran, jadwal hari ini (`GET /api/schedules?day_of_week=...`), daftar izin, dan kuis.
  - `StudentPermissionPage.jsx` mengirim pengajuan izin ke `POST /api/leave-requests` (`LeaveRequestController@store`).
- **Orang Tua (`ParentMonitoringPage.jsx`):**
  - Memantau kehadiran anak (`GET /api/attendances`), riwayat izin (`GET /api/leave-requests`), dan jadwal pelajaran kelas anak (`GET /api/schedules?class_id=...`).
- **Izin Guru (`TeacherLeavePage.jsx` & `TeacherLeaveRequestController.php`):**
  - Guru mengajukan izin tidak mengajar ke `POST /api/teacher-leave-requests`, yang memvalidasi bahwa `schedule_ids` yang dipilih memang jatuh pada hari dari `date` yang diajukan.

---

## 4. Evaluasi dan Penyesuaian Spesifikasi Fitur

Berdasarkan perbandingan antara **Dokumen Spesifikasi Sumber** dengan **Kode Aktual SCP**, berikut adalah evaluasi kritis beserta penyesuaian arsitektur yang wajib dilakukan:

| No | Aspek pada Dokumen Spesifikasi | Kondisi Aktual di Codebase SCP | Status Evaluasi & Rekomendasi Penyesuaian |
| :---: | :--- | :--- | :--- |
| 1 | **Middleware Role:** `Route::middleware(['role:waka,admin'])` (Bagian 5.3) | Di database dan `routes/api.php`, role Waka adalah `'vice_principal'`. Tidak ada role `'waka'` atau `'admin'` di backend. Semua route memakai `['auth:sanctum', 'throttle:api']`. | **Wajib Disesuaikan:** Gunakan `Route::middleware('role:vice_principal')` di dalam grup `['auth:sanctum', 'throttle:api']` pada `scp/routes/api.php`. Di frontend `AppRouter.jsx` tetap gunakan `allowedRoles={['waka']}`. |
| 2 | **Sintaks Migrasi Database:** Raw MySQL DDL `ENGINE=InnoDB`, `AUTO_INCREMENT`, `ENUM(...)` (Bagian 4.1) | Backend menggunakan **PostgreSQL** (`db_scp`) dan testing menggunakan **SQLite `:memory:`**. | **Wajib Disesuaikan:** Gunakan Laravel Schema Builder (`Schema::create('academic_events', ...)`) dengan `$table->id()`, `$table->string('type', 30)`, `$table->string('scope_type', 20)->default('all')`, `$table->json('scope_targets')->nullable()`, `$table->boolean('disables_teaching')->default(true)`, `$table->softDeletes()`, serta index komposit. |
| 3 | **Query Service di dalam Loop Jadwal:** `AcademicCalendarExclusionService::getActiveDisablingEvent()` menjalankan query DB `AcademicEvent::query()->...->get()` setiap dipanggil (Bagian 5.1) | `GET /api/schedules?all=1` memuat **721 jadwal** sekaligus. Jika service melakukan query DB per jadwal, akan terjadi **721 N+1 Query** dalam 1 request! | **Wajib Disesuaikan (Kritis - Performa):** Terapkan pola **In-Memory Static Cache per Tanggal/Rentang** seperti pada `PeriodResolutionService.php` (`protected static array $eventsByDateCache = []` dan `clearCache()`). Cukup **1 query DB per tanggal**, lalu evaluasi kecocokan `all` / `grade` / `class` di memori (RAM) dalam waktu $< 1\text{ ms}$ untuk 721 jadwal. |
| 4 | **Tipe Data `gradeLevel` & `scope_targets`:** Spesifikasi memakai string `"10"` dan `in_array($classId, $targets, true)` dengan strict type (Bagian 5.1) | Di tabel `classes`, kolom `level` bertipe **integer** (`10`, `11`, `12`). Pada payload JSON, `scope_targets` bisa terkirim sebagai `[10]` (int) atau `["10"]` (string). | **Wajib Disesuaikan:** Normalisasi perbandingan di `AcademicCalendarExclusionService`: untuk `scope_type === 'grade'`, konversi kedua sisi ke string standar (`'10'`, `'11'`, `'12'`, termasuk helper konversi angka Romawi `'X' -> '10'` jika ada). Untuk `scope_type === 'class'`, konversi seluruh elemen `scope_targets` ke integer (`array_map('intval', $targets)`) sebelum dibandingkan dengan `(int) $classId`. |
| 5 | **Nama Metode Jadwal:** Spesifikasi menyebut `ScheduleController@getTeacherSchedule` (Bagian 5.2.2) | Hanya ada `ScheduleController@index` (`GET /api/schedules`) yang melayani cabang `status=missing_journal` dan cabang jadwal reguler untuk semua role. | **Wajib Disesuaikan:** Integrasikan `AcademicCalendarExclusionService` ke kedua cabang di `ScheduleController@index`, serta dukung parameter opsional `?date=YYYY-MM-DD` (default: hari ini) agar pengecekan eksklusi akurat untuk tanggal spesifik maupun tampilan mingguan. |
| 6 | **Validasi Jurnal & Presensi:** Spesifikasi menyebut `StoreJournalRequest` dan `AttendanceController` (Bagian 3.3 & 5.2.1) | Tidak ada class `StoreJournalRequest`, dan `AttendanceController` hanya read-only (`GET`). Presensi disimpan atomik di `JournalController@store`, `update`, dan `markTeacherAbsent`. | **Wajib Disesuaikan:** Tempatkan guard validasi `AcademicCalendarExclusionService` di `JournalController@store`, `JournalController@update`, dan `JournalController@markTeacherAbsent`. Jika kelas terdampak agenda dengan `disables_teaching = true`, kembalikan `HTTP 422` dengan `error_code: 'TEACHING_DISABLED_BY_EVENT'`. |
| 7 | **Urutan Route API Laravel:** `Route::get('/academic-events/{id}')` diletakkan sebelum `Route::get('/academic-events/check-exemption')` (Bagian 5.3) | Di Laravel Routing, jika `/{id}` didefinisikan lebih dulu tanpa constraint numerik, request ke `/academic-events/check-exemption` akan ditangkap oleh `show("check-exemption")` dan gagal (404). | **Wajib Disesuaikan:** Definisikan route statis `/academic-events/check-exemption` **sebelum** route dinamis `/academic-events/{id}` (atau tambahkan `->whereNumber('id')`). |
| 8 | **Prioritas / Hierarki Konflik Agenda:** Spesifikasi menyatakan `holiday` (`all`) meng-override agenda parsial lainnya (Bagian 3.3) | Jika pada tanggal yang sama terdapat agenda `school_event` (`disables_teaching = false`, misal Upacara) dan agenda `class_event` (`disables_teaching = true`, misal Kunjungan Industri XI RPL 1), urutan pengambilan `.first()` tanpa sorting prioritas bisa salah mengambil event. | **Wajib Disesuaikan:** Saat mencari `getActiveDisablingEvent()`, filter hanya `disables_teaching = true` dan urutkan berdasarkan prioritas cakupan (`all` $\rightarrow$ `grade` $\rightarrow$ `class`). Selain itu, sediakan metode `getActiveEventsForClass()` untuk menampilkan seluruh agenda aktif (baik yang menonaktifkan KBM maupun informasi agenda non-libur) di UI. |

---

## 5. Analisis Integrasi Backend

Berikut adalah rancangan detail integrasi komponen backend di dalam direktori `scp/`:

### 5.1 Model `App\Models\AcademicEvent` (`scp/app/Models/AcademicEvent.php`)
- Menggunakan trait `HasFactory` dan `SoftDeletes`.
- Konfigurasi `$fillable`:
  ```php
  protected $fillable = [
      'title',
      'description',
      'start_date',
      'end_date',
      'type',              // 'holiday' | 'school_event' | 'class_event' | 'exam'
      'scope_type',        // 'all' | 'grade' | 'class'
      'scope_targets',     // JSON array: null | ["10", "11"] | [1, 2, 5]
      'disables_teaching', // boolean
      'academic_year',     // string nullable (misal "2025/2026")
      'created_by',        // foreign key -> users.id
  ];
  ```
- Konfigurasi `$casts`:
  ```php
  protected function casts(): array
  {
      return [
          'start_date' => 'date:Y-m-d',
          'end_date' => 'date:Y-m-d',
          'scope_targets' => 'array',
          'disables_teaching' => 'boolean',
      ];
  }
  ```
- Relasi Eloquent:
  - `creator(): BelongsTo` $\rightarrow$ `belongsTo(User::class, 'created_by')`.

### 5.2 Service Layer `App\Services\AcademicCalendarExclusionService` (`scp/app/Services/AcademicCalendarExclusionService.php`)
Dirancang mengikuti pola efisiensi tinggi seperti `PeriodResolutionService`:
1. **In-Memory Caching (`$eventsByDateCache`):**
   - Menyimpan koleksi `AcademicEvent` aktif untuk tanggal `Y-m-d` yang diminta selama siklus hidup request (dan menyediakan `public static function clearCache(): void` untuk pengujian PHPUnit).
2. **`getActiveDisablingEvent(int $classId, int|string $gradeLevel, Carbon|string $date): ?AcademicEvent`:**
   - Mengambil daftar event aktif pada tanggal `$date` dari cache/DB yang memiliki `disables_teaching === true`.
   - Memeriksa apakah event berlaku untuk kelas tersebut:
     - `scope_type === 'all'` $\rightarrow$ cocok.
     - `scope_type === 'grade'` $\rightarrow$ cocok jika `$gradeLevel` (setelah dinormalisasi ke string `'10'`, `'11'`, `'12'`) ada di dalam `scope_targets`.
     - `scope_type === 'class'` $\rightarrow$ cocok jika `(int) $classId` ada di dalam `array_map('intval', $scope_targets)`.
   - Jika terdapat lebih dari satu event yang cocok, prioritaskan event dengan urutan: `type = 'holiday'` (`scope_type = 'all'`) lebih dulu, kemudian `grade`, lalu `class`.
3. **`getActiveEventsForClass(int $classId, int|string $gradeLevel, Carbon|string $date): Collection`:**
   - Mengembalikan seluruh agenda yang relevan bagi kelas tersebut pada tanggal `$date` (termasuk agenda dengan `disables_teaching = false` seperti Upacara Khusus / Peringatan Hari Guru) untuk ditampilkan sebagai banner informasi di dashboard Guru, Siswa, dan Orang Tua.
4. **`getEventsForRange(Carbon $startDate, Carbon $endDate, ?int $classId = null, int|string|null $gradeLevel = null): Collection`:**
   - Mengambil seluruh agenda yang beririsan dengan rentang `[$startDate, $endDate]`. Jika `$classId` atau `$gradeLevel` diberikan (misal saat diakses oleh Siswa/Orang Tua), hasil otomatis difilter hanya agenda yang relevan bagi kelas tersebut.
5. **`preloadEventsForRange(Carbon $startDate, Carbon $endDate): void`:**
   - Memuat seluruh event dalam rentang tanggal ke dalam memori dalam **1 query tunggal**, sehingga perhitungan rekapitulasi kepatuhan multi-hari (mingguan/bulanan) tidak melakukan query berulang per tanggal.

### 5.3 Controller Baru `App\Http\Controllers\API\AcademicEventController` (`scp/app/Http/Controllers/API/AcademicEventController.php`)
Mengimplementasikan endpoint RESTful dengan format response standar SCP (`sendResponse` / `sendError`):
1. **`GET /api/academic-events` (`index`):**
   - Dapat diakses oleh seluruh role terautentikasi (`vice_principal`, `teacher`, `student`, `parent`).
   - Filter query opsional: `month` (`1..12`), `year` (`YYYY`), `start_date`, `end_date`, `type`, `scope_type`, `class_id`, `grade_level`, `academic_year`.
   - Khusus role `student` dan `parent`, jika `for_my_class=1` dikirim, otomatis memfilter agenda yang berdampak pada `class_id` dan `level` siswa terkait.
2. **`GET /api/academic-events/check-exemption` (`checkExemption`):**
   - Menerima `date` (`Y-m-d`, default hari ini) dan `class_id` (opsional; jika kosong untuk siswa/ortu otomatis menggunakan kelas siswa; jika kosong untuk Waka/Guru memeriksa apakah hari tersebut libur `scope_type = 'all'`).
   - Mengembalikan status `is_teaching_exempted`, `disabling_event`, dan daftar `active_events` hari tersebut.
3. **`GET /api/academic-events/{id}` (`show`):**
   - Mengembalikan detail 1 agenda beserta informasi nama-nama kelas jika `scope_type === 'class'`.
4. **`POST /api/academic-events` (`store` — Khusus Waka `role:vice_principal`):**
   - Validasi input ketat:
     - `title`: `required|string|max:150`
     - `description`: `nullable|string|max:1000`
     - `start_date`: `required|date_format:Y-m-d`
     - `end_date`: `required|date_format:Y-m-d|after_or_equal:start_date`
     - `type`: `required|in:holiday,school_event,class_event,exam`
     - `scope_type`: `required|in:all,grade,class`
     - `scope_targets`:
       - Wajib `null`/kosong jika `scope_type === 'all'`.
       - Wajib `array|min:1` berisi nilai dalam `['10', '11', '12', 10, 11, 12]` jika `scope_type === 'grade'`.
       - Wajib `array|min:1` berisi ID yang valid di tabel `classes` (`exists:classes,id`) jika `scope_type === 'class'`.
     - `disables_teaching`: `required|boolean` (dengan default aturan bisnis sesuai `type`).
   - Validasi pencegahan duplikasi/konflik agenda pada tanggal dan target yang sama.
5. **`PUT /api/academic-events/{id}` (`update` — Khusus Waka `role:vice_principal`):**
   - Memperbarui agenda dengan validasi yang sama.
6. **`DELETE /api/academic-events/{id}` (`destroy` — Khusus Waka `role:vice_principal`):**
   - Melakukan *soft-delete* pada agenda.

### 5.4 Integrasi pada Controller yang Sudah Ada
1. **[`ScheduleController.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/ScheduleController.php):**
   - **Pada cabang `status=missing_journal` (Baris 58–133):**
     - Sebelum sebuah jadwal dimasukkan ke daftar `$missingSchedules`, panggil `$this->exclusionService->getActiveDisablingEvent($schedule->class_id, $schedule->schoolClass->level, $now)`.
     - Jika mengembalikan event (tidak `null`), **lewati (`continue`)** jadwal tersebut sehingga guru tidak pernah ditandai terlambat/alpa mengisi jurnal pada kelas yang sedang libur atau berkegiatan.
   - **Pada cabang listing reguler (Baris 135–255):**
     - Dukung parameter opsional `$request->input('date')` sebagai `$referenceDate` (default: `Carbon::now('Asia/Jakarta')`).
     - Untuk setiap jadwal pada `$referenceDate` (atau pada hari yang sesuai dengan `day_of_week` dalam minggu `$referenceDate`), sisipkan atribut:
       - `is_teaching_exempted` (`bool`)
       - `exemption_reason` (`string|null` — judul agenda)
       - `event_type` (`string|null` — `'holiday' | 'school_event' | 'class_event' | 'exam'`)
       - `academic_event_id` (`int|null`)
     - Jika `is_teaching_exempted === true` dan belum ada jurnal pada hari itu, `today_journal_status` diberi nilai `'exempted'`.
2. **[`JournalController.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/JournalController.php):**
   - **Pada `store()`, `update()`, dan `markTeacherAbsent()`:**
     - Muat relasi `schedule.schoolClass`.
     - Panggil `$disablingEvent = $this->exclusionService->getActiveDisablingEvent($schedule->class_id, $schedule->schoolClass->level, $targetDate)`.
     - Jika `$disablingEvent !== null`, tolak request dengan HTTP `422 Unprocessable Content`:
       ```json
       {
         "success": false,
         "message": "Pengisian jurnal dibatalkan karena terdapat agenda sekolah: Kemah Pramuka Blok Kelas X.",
         "error_code": "TEACHING_DISABLED_BY_EVENT",
         "data": {
           "event_id": 1,
           "event_title": "Kemah Pramuka Blok Kelas X",
           "event_type": "class_event"
         }
       }
       ```
   - **Endpoint/Data Tambahan untuk Rekapitulasi Kepatuhan Jurnal (`JournalController` / `ScheduleController`):**
     - Menyediakan kalkulasi metrik kepatuhan jurnal (`total_mandatory_schedules`, `exempted_schedules`, `filled_journals`, `missing_journals`, `compliance_percentage`) pada rentang tanggal yang dipilih di halaman Monitoring & Rekapitulasi Waka, serta daftar slot jadwal yang dikecualikan (`status = 'exempted'`) agar Waka dapat melihat baris `[Dikecualikan: <Nama Agenda>]` secara transparan.
3. **[`LeaveRequestController.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/LeaveRequestController.php) & [`TeacherLeaveRequestController.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/TeacherLeaveRequestController.php):**
   - Memvalidasi pengajuan izin pada tanggal yang seluruh KBM kelas terkait sudah dinonaktifkan oleh agenda (`disables_teaching = true`), sesuai keputusan pengguna pada Bagian 15.

---

## 6. Analisis Integrasi Frontend

Seluruh komponen frontend di `frontend/scp_web/src/` dirancang agar menyatu secara visual dengan *Design System* SCP yang sudah ada (CSS Variables, komponen `Card`, `Badge`, `Modal`, `Table`, `Button`, dan palet warna SCP).

### 6.1 API Service Baru: `src/services/academicEventApi.js`
Dibuat mengikuti pola `src/services/scheduleApi.js` dan `src/services/journalApi.js`:
- `getAcademicEvents(params)` $\rightarrow$ `GET /academic-events`
- `getAcademicEventById(id)` $\rightarrow$ `GET /academic-events/${id}`
- `checkAcademicExemption(params)` $\rightarrow$ `GET /academic-events/check-exemption`
- `createAcademicEvent(payload)` $\rightarrow$ `POST /academic-events`
- `updateAcademicEvent(id, payload)` $\rightarrow$ `PUT /academic-events/${id}`
- `deleteAcademicEvent(id)` $\rightarrow$ `DELETE /academic-events/${id}`

### 6.2 Navigasi & Routing (`Sidebar.jsx` & `AppRouter.jsx`)
- **[`Sidebar.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/Sidebar.jsx):**
  - Menambahkan item menu pada grup Waka (`NAV_ITEMS.waka`) di bawah kategori `Akademik & KBM`:
    - `{ to: '/waka/academic-calendar', label: 'Kalender Akademik', icon: CalendarDays }`
- **[`AppRouter.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/routes/AppRouter.jsx):**
  - Menambahkan lazy route `/waka/academic-calendar` menuju `AcademicCalendarPage.jsx` di dalam `<RoleRoute allowedRoles={['waka']}>`.

### 6.3 Halaman Kalender Akademik Waka (`src/pages/waka/AcademicCalendarPage.jsx` & `AcademicEventModal.jsx`)
- **Fitur Utama `AcademicCalendarPage.jsx`:**
  - **Header & Filter Bar:** Navigasi bulan (`Bulan Sebelumnya`, `Bulan Ini`, `Bulan Berikutnya`), pemilih Bulan & Tahun, filter Tipe Agenda (`Semua`, `Libur Resmi`, `Kegiatan Sekolah`, `Kegiatan Kelas/Tingkat`, `Ujian/Asesmen`), dan tombol `[ + Tambah Agenda ]`.
  - **Ringkasan Bulan Ini (KPI Cards):** Jumlah Hari Libur, Jumlah Agenda Khusus Tingkat/Kelas, Jumlah Hari Efektif KBM.
  - **Grid Kalender Bulanan (7 Kolom: Senin – Minggu):**
    - Menampilkan tanggal dalam bulan aktif; klik pada tanggal kosong dapat langsung membuka modal tambah agenda dengan `start_date` terisi otomatis.
    - Menampilkan chip agenda berwarna sesuai standar spesifikasi:
      - **Merah/Rose (`#EF4444`):** `holiday` (Libur Nasional & Resmi)
      - **Kuning/Amber (`#F59E0B`):** `school_event` & `class_event` (Kegiatan Sekolah / Tingkat / Rombel)
      - **Biru/Indigo (`#4361EE`):** `exam` (Masa Penilaian / Ujian)
  - **Daftar Agenda Bulan Aktif (Tabel / List View di samping atau di bawah kalender):**
    - Memudahkan Waka melihat detail rentang tanggal, target peserta (`Seluruh Sekolah`, `Tingkat 10`, atau badge nama-nama rombel `XI RPL 1, XI RPL 2`), badge status dampak KBM (`KBM Ditiadakan` vs `KBM Tetap Berjalan`), serta tombol aksi `Edit` dan `Hapus`.
- **Fitur `AcademicEventModal.jsx`:**
  - Input **Nama Kegiatan** (`title`), **Deskripsi/Keterangan** (`description`), **Kategori Agenda** (`type`), serta **Tanggal Mulai** (`start_date`) & **Tanggal Selesai** (`end_date`).
  - Pilihan **Target Peserta / Lingkup (`scope_type`)**:
    - `all`: Seluruh Sekolah (Tingkat 10, 11, dan 12).
    - `grade`: Checkbox multi-pilih `[ ] Tingkat 10`, `[ ] Tingkat 11`, `[ ] Tingkat 12`.
    - `class`: Multi-select / searchable checklist rombel kelas aktif dari Master Data Kelas (dilengkapi filter cepat per tingkat/jurusan agar mudah memilih dari 48 rombel).
  - Toggle Switch **Dampak KBM (`disables_teaching`)**: *"Bebaskan Jadwal KBM & Kewajiban Jurnal/Presensi"* (otomatis `true` saat memilih `holiday`, `class_event`, atau `exam`, dan dapat diatur manual untuk `school_event`).

### 6.4 Integrasi Halaman Guru (`TeacherDashboardPage.jsx`, `TeacherSchedulePage.jsx`, `TeacherJournalPage.jsx`)
- **[`TeacherDashboardPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherDashboardPage.jsx):**
  - Menampilkan banner agenda hari ini jika ada agenda sekolah yang aktif.
  - Kartu jadwal mengajar hari ini yang memiliki `is_teaching_exempted === true` diberi badge kuning/amber `[Dikecualikan dari KBM]` beserta alasan agenda (`exemption_reason`), dan tidak masuk ke dalam alert merah "Jurnal Belum Diisi".
- **[`TeacherSchedulePage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx):**
  - **Skenario 1 (Libur Sekolah Penuh / `scope_type = 'all'` & `disables_teaching = true`):** Menampilkan banner jelas di bagian atas jadwal hari tersebut: *"HARI LIBUR / AGENDA SEKOLAH: [Nama Agenda] — Seluruh kegiatan KBM dan kewajiban pengisian jurnal dinonaktifkan pada hari ini."*
  - **Skenario 2 (Agenda Parsial Tingkat/Rombel):** Pada daftar jadwal harian maupun matriks, slot kelas yang terdampak (misal `X RPL 2` sedang Kemah Pramuka) menampilkan status `DIKECUALIKAN DARI KBM`, alasan agenda, dan tombol `[ Isi Jurnal / Presensi ]` dalam keadaan **disabled** (nonaktif), sedangkan slot kelas lain yang tidak terdampak (misal `XI RPL 1`) tetap berstatus `KBM AKTIF` dan tombolnya berfungsi normal.
- **[`TeacherJournalPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx):**
  - Pada langkah pemilihan jadwal untuk membuka kelas (`POST /api/journals`), jadwal yang berstatus `is_teaching_exempted === true` dinonaktifkan agar tidak dapat dipilih, dilengkapi keterangan nama agenda yang mengecualikannya.

### 6.5 Integrasi Halaman Monitoring & Rekapitulasi Waka (`DashboardWakaPage.jsx` & `MonitoringRecapPage.jsx`)
- **[`DashboardWakaPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx):**
  - Karena `GET /api/schedules?status=missing_journal` sudah memfilter jadwal yang dikecualikan, daftar "Peringatan Keterlambatan Jurnal Hari Ini" di Dashboard Waka otomatis bersih dari kelas yang sedang libur/berkegiatan.
  - Menambahkan informasi ringkas jika hari ini terdapat agenda aktif di Kalender Akademik.
- **[`MonitoringRecapPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx):**
  - Menyesuaikan kartu metrik Jurnal Mengajar dengan formula indeks kepatuhan:
    $$\text{Persentase Kepatuhan} = \frac{\text{Jumlah Jurnal Terisi}}{\text{Total Jadwal Wajib} - \text{Jadwal Dikecualikan}} \times 100\%$$
  - Menampilkan badge jumlah jadwal yang dikecualikan oleh agenda sekolah.
  - Pada tabel rekapitulasi jurnal, membedakan dengan jelas label status:
    - Hijau: `[Selesai / Terisi]`
    - Biru: `[Sedang Berlangsung]`
    - Merah: `[Belum Terisi / Guru Absen]`
    - Kuning/Abu-abu: `[Dikecualikan: <Nama Agenda>]`

### 6.6 Integrasi Portal Siswa & Orang Tua (`StudentHomePage.jsx`, `StudentSchedulePage.jsx`, `StudentPermissionPage.jsx`, `ParentMonitoringPage.jsx`)
- **[`StudentHomePage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/student/StudentHomePage.jsx) & [`ParentMonitoringPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx):**
  - Memanggil `checkAcademicExemption` / `getAcademicEvents` untuk kelas siswa pada hari ini.
  - Jika kelas siswa terdampak agenda (misal Kelas 10 sedang Kemah Pramuka Blok), tampilkan banner informasi kontekstual: *"Agenda Hari Ini: [Nama Agenda]. Kegiatan KBM reguler di kelas ditiadakan."*
  - Siswa kelas lain yang tidak terdampak (misal Kelas 11) tetap melihat jadwal pelajaran harian normal tanpa gangguan banner libur.
- **[`StudentPermissionPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/student/StudentPermissionPage.jsx):**
  - Saat siswa memilih tanggal izin yang bertepatan dengan hari libur sekolah atau agenda bebas-KBM untuk kelasnya, tampilkan peringatan/blokir bahwa KBM reguler ditiadakan pada tanggal tersebut sehingga tidak diperlukan pengajuan izin KBM reguler.

---

## 7. Analisis Database dan Relasi Data

### 7.1 Desain Tabel Baru: `academic_events`
Tabel `academic_events` dirancang agar 100% kompatibel dengan **PostgreSQL** (production/development) dan **SQLite** (automated testing):

| Nama Kolom | Tipe Data (Laravel Migration) | Nullable | Default | Keterangan & Aturan |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `bigIncrements` (`$table->id()`) | Tidak | Auto | Primary Key. |
| `title` | `string(150)` | Tidak | - | Nama agenda/kegiatan (misal: `"Kemah Pramuka Blok Kelas X"`). |
| `description` | `text` | Ya | `null` | Penjelasan tambahan kegiatan. |
| `start_date` | `date` | Tidak | - | Tanggal mulai agenda (`YYYY-MM-DD`, inklusif). |
| `end_date` | `date` | Tidak | - | Tanggal selesai agenda (`YYYY-MM-DD`, inklusif, `>= start_date`). |
| `type` | `string(30)` | Tidak | - | Nilai sah: `'holiday'`, `'school_event'`, `'class_event'`, `'exam'`. |
| `scope_type` | `string(20)` | Tidak | `'all'` | Nilai sah: `'all'`, `'grade'`, `'class'`. |
| `scope_targets` | `json` | Ya | `null` | `null` jika `all`; array tingkat `["10", "11"]` jika `grade`; array ID kelas `[1, 2, 5]` jika `class`. |
| `disables_teaching` | `boolean` | Tidak | `true` | `true` = membebaskan KBM, jurnal, & presensi; `false` = KBM tetap berjalan. |
| `academic_year` | `string(20)` | Ya | `null` | Tahun ajaran terkait (misal `"2025/2026"`), diambil otomatis dari `system_configurations` jika tidak dikirim. |
| `created_by` | `foreignId` (`users.id`) | Ya/Tidak | - | Referensi ke user Waka pembuat agenda (`nullOnDelete()` atau `cascadeOnDelete()`). |
| `created_at` | `timestamp` | Ya | - | Waktu pembuatan record. |
| `updated_at` | `timestamp` | Ya | - | Waktu pembaruan terakhir. |
| `deleted_at` | `timestamp` (`softDeletes`) | Ya | `null` | Mendukung *Soft Delete* untuk menjaga jejak audit historis. |

### 7.2 Indexing & Performa Query
Untuk menjamin pencarian agenda berdasarkan tanggal dan cakupan selalu menggunakan *Index Scan* yang cepat:
1. `INDEX idx_academic_events_dates (start_date, end_date)` — Mempercepat query `whereDate('start_date', '<=', $date)->whereDate('end_date', '>=', $date)` dan query rentang kalender bulanan.
2. `INDEX idx_academic_events_scope_teaching (disables_teaching, scope_type)` — Mempercepat filter eksklusi KBM.
3. `INDEX idx_academic_events_academic_year (academic_year)` — Mempercepat filter per tahun ajaran.

### 7.3 Relasi dengan Tabel yang Sudah Ada
- **`users` (`1 : N` `academic_events`):** Kolom `created_by` merujuk ke `users.id` (akun Waka Kurikulum).
- **`classes` (Relasi Logis via `scope_targets` & `classes.level`):**
  - Saat `scope_type = 'grade'`, nilai di `scope_targets` dicocokkan dengan `classes.level` (`10`, `11`, `12`).
  - Saat `scope_type = 'class'`, nilai integer di `scope_targets` dicocokkan dengan `classes.id` (dan divalidasi keberadaannya di tabel `classes` saat `store`/`update`).
- **Tidak Mengubah Tabel Eksisting (`schedules`, `journals`, `attendances`):**
  - Tabel `schedules`, `journals`, dan `attendances` **tidak perlu diubah strukturnya** (zero destructive migration), sehingga seluruh data jadwal (721 baris), jurnal, dan presensi yang sudah ada dijamin 100% aman dan utuh.

---

## 8. Analisis Hak Akses dan Keamanan

### 8.1 Matriks Otorisasi Endpoint Kalender Akademik

| Endpoint | Method | Waka (`vice_principal`) | Guru (`teacher`) | Siswa (`student`) | Orang Tua (`parent`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/academic-events` | `GET` | Diizinkan | Diizinkan | Diizinkan | Diizinkan |
| `/api/academic-events/check-exemption` | `GET` | Diizinkan | Diizinkan | Diizinkan | Diizinkan |
| `/api/academic-events/{id}` | `GET` | Diizinkan | Diizinkan | Diizinkan | Diizinkan |
| `/api/academic-events` | `POST` | **Diizinkan** | Ditolak (`403`) | Ditolak (`403`) | Ditolak (`403`) |
| `/api/academic-events/{id}` | `PUT` | **Diizinkan** | Ditolak (`403`) | Ditolak (`403`) | Ditolak (`403`) |
| `/api/academic-events/{id}` | `DELETE` | **Diizinkan** | Ditolak (`403`) | Ditolak (`403`) | Ditolak (`403`) |

### 8.2 Validasi Keamanan & Integritas Backend
1. **Proteksi Bypass via API Langsung (Server-Side Enforcement):**
   - Meskipun tombol `"Isi Jurnal"` sudah di-disable di frontend React, backend tetap memvalidasi ulang melalui `AcademicCalendarExclusionService` pada `JournalController@store`, `JournalController@update`, dan `JournalController@markTeacherAbsent`. Request langsung via Postman/cURL atau aplikasi mobile Flutter pada jadwal yang dikecualikan akan langsung ditolak dengan `HTTP 422 Unprocessable Content`.
2. **Validasi Konsistensi `scope_type` dan `scope_targets`:**
   - Mencegah penyimpanan `scope_type = 'grade'` atau `'class'` dengan `scope_targets` kosong.
   - Memastikan setiap ID kelas di dalam `scope_targets` saat `scope_type = 'class'` benar-benar merupakan ID kelas yang terdaftar di tabel `classes`.
   - Jika `scope_type = 'all'`, backend secara otomatis memaksa `scope_targets = null` agar tidak ada data residu yang membingungkan.
3. **Pencegahan Konflik Agenda Bertentangan:**
   - Mencegah pembuatan dua agenda yang identik/bertentangan pada tanggal dan target cakupan yang sama.
4. **Audit Trail via SoftDeletes & `created_by`:**
   - Penghapusan agenda menggunakan `SoftDeletes` (`deleted_at`) dan mencatat `created_by = $request->user()->id` sehingga riwayat perubahan agenda tetap terlacak.

---

## 9. Potensi Konflik, Risiko, dan Solusi

| No | Potensi Konflik / Risiko Teknis | Dampak Jika Tidak Ditangani | Solusi Arsitektural dalam Rencana Ini |
| :---: | :--- | :--- | :--- |
| 1 | **Ledakan Query (*N+1 Query*) pada `GET /api/schedules?all=1`** | Memanggil query `AcademicEvent` untuk masing-masing dari 721 baris jadwal akan menimbulkan 721 query tambahan dan memperlambat waktu muat halaman jadwal hingga $> 3\text{ detik}$. | Mengimplementasikan **Static In-Memory Cache** di `AcademicCalendarExclusionService` (seperti `PeriodResolutionService`). Cukup 1 query database per tanggal, lalu pencocokan 721 baris jadwal dilakukan di memori array PHP. |
| 2 | **Ketidakcocokan Tipe Data `classes.level` (Integer vs String)** | `classes.level` di PostgreSQL bertipe `integer` (`10`), sedangkan JSON `scope_targets` dapat berisi string `["10"]`. `in_array(..., true)` dengan *strict mode* akan gagal mencocokkan dan menyebabkan eksklusi tingkat kelas tidak berfungsi. | Melakukan normalisasi tipe eksplisit di `AcademicCalendarExclusionService`: mengonversi `level` dan target grade ke string kanonik (`"10"`, `"11"`, `"12"`), serta mengonversi target `class_id` ke `int` sebelum pencocokan. |
| 3 | **Jurnal yang Sudah Terlanjur Diisi Sebelum Waka Membuat Agenda** | Waka baru menambahkan agenda libur/kegiatan pada siang hari setelah ada guru yang membuka atau menyelesaikan jurnal pada pagi hari di tanggal yang sama. | Jurnal yang sudah berstatus `completed` tetap dipertahankan (tidak dihapus otomatis agar tidak merusak data historis). Jika ada jurnal yang masih menggantung `ongoing` saat agenda `disables_teaching = true` dibuat, perilaku penanganannya dikonfirmasikan kepada pengguna (lihat Bagian 15). |
| 4 | **Tumpang Tindih Agenda `disables_teaching = false` dan `disables_teaching = true`** | Pada hari Senin ada agenda `Upacara Hari Guru` (`scope_type = 'all'`, `disables_teaching = false`) dan di hari yang sama `XI RPL 1` melaksanakan `Kunjungan Industri` (`scope_type = 'class'`, `disables_teaching = true`). | `getActiveDisablingEvent()` secara spesifik hanya memfilter `where('disables_teaching', true)`, sehingga agenda non-libur (`disables_teaching = false`) tidak akan pernah menutupi/membatalkan pengecualian KBM milik `XI RPL 1`. |
| 5 | **Kompatibilitas SQLite (Testing) vs PostgreSQL (Production) pada Kolom JSON** | Penggunaan operator JSON spesifik database (seperti `whereJsonContains` di SQLite lama atau tipe `ENUM` MySQL) dapat menyebabkan test gagal atau migrasi error. | Menyimpan `scope_targets` sebagai kolom `json` standar Laravel, memfilter berdasarkan index `start_date` dan `end_date` di SQL, lalu mengevaluasi `scope_targets` di level Collection PHP yang di-cache. Pendekatan ini 100% identik perilakunya di PostgreSQL maupun SQLite. |

---

## 10. Ruang Lingkup dan Batasan Implementasi

### 10.1 Termasuk dalam Ruang Lingkup (In-Scope)
1. **Database & Model:** Pembuatan migrasi tabel `academic_events` dan model `AcademicEvent` beserta relasi dan *casts*.
2. **Service Layer:** Pembuatan `AcademicCalendarExclusionService` dengan mekanisme *in-memory caching*, resolusi hierarki (`all`, `grade`, `class`), dan agregasi rentang tanggal.
3. **REST API Kalender Akademik:** Pembuatan `AcademicEventController` (`index`, `show`, `checkExemption`, `store`, `update`, `destroy`) dan pendaftaran rute di `scp/routes/api.php`.
4. **Integrasi Jadwal & Jurnal Backend:**
   - Eksklusi otomatis pada `GET /api/schedules?status=missing_journal`.
   - Penyisipan atribut `is_teaching_exempted`, `exemption_reason`, `event_type`, dan `academic_event_id` pada `GET /api/schedules`.
   - Penolakan `HTTP 422` (`TEACHING_DISABLED_BY_EVENT`) pada `JournalController` (`store`, `update`, `markTeacherAbsent`) saat KBM dinonaktifkan.
5. **Antarmuka Waka:** Halaman `AcademicCalendarPage.jsx`, modal `AcademicEventModal.jsx`, integrasi menu `Sidebar.jsx`, route `AppRouter.jsx`, dan penyesuaian perhitungan serta label `[Dikecualikan: Acara]` pada `MonitoringRecapPage.jsx`.
6. **Antarmuka Guru, Siswa, & Orang Tua:** Banner dan status disabled/dikecualikan pada `TeacherDashboardPage.jsx`, `TeacherSchedulePage.jsx`, `TeacherJournalPage.jsx`, `StudentHomePage.jsx`, `StudentSchedulePage.jsx`, `StudentPermissionPage.jsx`, dan `ParentMonitoringPage.jsx`.
7. **Automated Testing:** Unit & Feature Test lengkap di `scp/tests/Feature/AcademicCalendarExclusionTest.php`.

### 10.2 Di Luar Ruang Lingkup (Out-of-Scope)
1. Mengubah struktur tabel atau alur kerja import jadwal PDF FET (`ParseSchedulePdfJob.php`) maupun import Excel Guru/Siswa.
2. Mengubah mekanisme Kuis AI, kenaikan kelas (`GradePromotionPage`), atau sistem OTP/OAuth.
3. Membuat modul kartu presensi ujian khusus terpisah (untuk agenda bertipe `exam`, sistem hanya menonaktifkan kewajiban jurnal KBM reguler dan menampilkan status agenda ujian).

---

## 11. Rencana Implementasi Bertahap

Implementasi dibagi ke dalam **6 Tahap Terukur** yang berurutan dan dapat diverifikasi secara independen:

---

### Tahap 1: Fondasi Database & Model `AcademicEvent`
- **Tujuan Tahap:** Membangun skema tabel `academic_events` yang kompatibel dengan PostgreSQL & SQLite beserta model Eloquent `AcademicEvent`.
- **Aktivitas yang Harus Dilakukan:**
  1. Membuat file migrasi `database/migrations/2026_11_06_000001_create_academic_events_table.php` dengan kolom, foreign key `created_by`, `softDeletes()`, dan composite indexes.
  2. Membuat model `app/Models/AcademicEvent.php` dengan `$fillable`, `$casts` (`start_date`, `end_date`, `scope_targets`, `disables_teaching`), konstanta tipe/cakupan, dan relasi `creator()`.
- **File atau Komponen yang Terdampak:**
  - `[NEW] scp/database/migrations/2026_11_06_000001_create_academic_events_table.php`
  - `[NEW] scp/app/Models/AcademicEvent.php`
- **Ketergantungan dengan Tahap Lainnya:** Tidak ada (Tahap fondasi awal).
- **Hasil yang Diharapkan:** Tabel `academic_events` berhasil dibuat di database dan model `AcademicEvent` siap digunakan oleh Service dan Controller.
- **Skenario Pengujian:**
  - Menjalankan migrasi pada environment testing SQLite dan memeriksa struktur kolom serta casting JSON `scope_targets` dan boolean `disables_teaching`.
- **Kriteria Tahap Dianggap Selesai:** Migrasi berjalan mulus tanpa error dan operasi dasar Eloquent (`create`, `find`, `delete` soft-delete) bekerja sesuai spesifikasi.

---

### Tahap 2: Service Layer `AcademicCalendarExclusionService` & CRUD API `AcademicEventController`
- **Tujuan Tahap:** Menyediakan mesin kalkulasi eksklusi KBM berkinerja tinggi (tanpa N+1 query) serta endpoint REST API untuk pengelolaan dan pembacaan agenda kalender akademik.
- **Aktivitas yang Harus Dilakukan:**
  1. Membuat `app/Services/AcademicCalendarExclusionService.php` dengan static cache per tanggal, normalisasi `grade` (`10`, `11`, `12`) dan `class_id`, fungsi `getActiveDisablingEvent()`, `getActiveEventsForClass()`, `getEventsForRange()`, dan `clearCache()`.
  2. Membuat `app/Http/Controllers/API/AcademicEventController.php` dengan action `index`, `show`, `checkExemption`, `store`, `update`, dan `destroy` beserta validasi payload dan pencegahan konflik agenda.
  3. Mendaftarkan rute `/api/academic-events` di `scp/routes/api.php` (read-only untuk semua user `auth:sanctum`, mutasi `POST/PUT/DELETE` khusus `role:vice_principal`).
- **File atau Komponen yang Terdampak:**
  - `[NEW] scp/app/Services/AcademicCalendarExclusionService.php`
  - `[NEW] scp/app/Http/Controllers/API/AcademicEventController.php`
  - `[MOD] scp/routes/api.php`
- **Ketergantungan dengan Tahap Lainnya:** Bergantung pada **Tahap 1**.
- **Hasil yang Diharapkan:** Endpoint CRUD Kalender Akademik dan pengecekan eksklusi siap dikonsumsi dengan proteksi role `vice_principal` yang ketat.
- **Skenario Pengujian:**
  - Waka membuat agenda `holiday` (`all`), `class_event` (`grade: ["10"]`), dan `class_event` (`class: [id]`).
  - Guru/Siswa mencoba memanggil `POST /api/academic-events` $\rightarrow$ ditolak `403 Forbidden`.
  - Memastikan `getActiveDisablingEvent()` mengembalikan event yang tepat untuk kelas yang terdampak dan `null` untuk kelas yang tidak terdampak.
- **Kriteria Tahap Dianggap Selesai:** Seluruh endpoint `/api/academic-events*` merespons sesuai standar JSON SCP dan lulus uji otorisasi role.

---

### Tahap 3: Integrasi Backend pada Jadwal, Jurnal, Presensi, Monitoring, & Perizinan
- **Tujuan Tahap:** Mengintegrasikan aturan pengecualian Kalender Akademik ke dalam alur jadwal harian, deteksi jurnal terlambat, pembukaan/penyelesaian jurnal & presensi, rekapitulasi monitoring, serta perizinan.
- **Aktivitas yang Harus Dilakukan:**
  1. Memodifikasi `ScheduleController@index`:
     - Mengecualikan jadwal yang terdampak `getActiveDisablingEvent()` dari cabang `status=missing_journal`.
     - Menyisipkan `is_teaching_exempted`, `exemption_reason`, `event_type`, `academic_event_id`, dan `today_journal_status = 'exempted'` pada cabang listing jadwal.
  2. Memodifikasi `JournalController@store`, `JournalController@update`, dan `JournalController@markTeacherAbsent` untuk memblokir pengisian jurnal & presensi pada jadwal yang dikecualikan dengan respons `HTTP 422` (`error_code: 'TEACHING_DISABLED_BY_EVENT'`).
  3. Menambahkan data/endpoint ringkasan kepatuhan jurnal (termasuk daftar/jumlah jadwal yang dikecualikan) untuk mendukung halaman `MonitoringRecapPage` Waka.
  4. Mengintegrasikan validasi tanggal libur/bebas-KBM pada `LeaveRequestController@store` (dan `TeacherLeaveRequestController@store` sesuai konfirmasi pengguna).
- **File atau Komponen yang Terdampak:**
  - `[MOD] scp/app/Http/Controllers/API/ScheduleController.php`
  - `[MOD] scp/app/Http/Controllers/API/JournalController.php`
  - `[MOD] scp/app/Http/Controllers/API/LeaveRequestController.php`
  - `[MOD] scp/app/Http/Controllers/API/TeacherLeaveRequestController.php` (opsional sesuai konfirmasi)
- **Ketergantungan dengan Tahap Lainnya:** Bergantung pada **Tahap 2**.
- **Hasil yang Diharapkan:** Backend secara otomatis melindungi integritas jurnal, presensi, alert keterlambatan, dan perhitungan kepatuhan guru.
- **Skenario Pengujian:**
  - Menguji `POST /api/journals` pada kelas yang sedang terdampak agenda $\rightarrow$ ditolak `HTTP 422` dengan `error_code: TEACHING_DISABLED_BY_EVENT`.
  - Menguji `POST /api/journals` pada kelas tingkat lain di hari yang sama yang tidak terdampak $\rightarrow$ berhasil (`HTTP 201`).
  - Menguji `GET /api/schedules?status=missing_journal` pada hari kegiatan $\rightarrow$ kelas yang terdampak tidak muncul sebagai *missing journal*.
- **Kriteria Tahap Dianggap Selesai:** Seluruh integrasi backend berjalan tanpa merusak test suite eksisting (`php artisan test`).

---

### Tahap 4: Antarmuka Kalender Akademik Waka (`AcademicCalendarPage` & `AcademicEventModal`)
- **Tujuan Tahap:** Membangun halaman pengelolaan Kalender Akademik interaktif untuk Waka Kurikulum.
- **Aktivitas yang Harus Dilakukan:**
  1. Membuat service API `frontend/scp_web/src/services/academicEventApi.js`.
  2. Membuat komponen modal tambah/edit agenda `frontend/scp_web/src/pages/waka/components/AcademicEventModal.jsx` (dengan pilihan cakupan `Seluruh Sekolah`, `Tingkat Tertentu` [10, 11, 12], atau `Rombel Tertentu` serta toggle `disables_teaching`).
  3. Membuat halaman utama `frontend/scp_web/src/pages/waka/AcademicCalendarPage.jsx` beserta styling CSS `AcademicCalendarPage.css` (grid kalender 7 kolom, chip warna merah/kuning/biru, daftar agenda, filter bulan/tipe, dan dialog konfirmasi hapus).
  4. Menambahkan menu `Kalender Akademik` di `Sidebar.jsx` dan rute `/waka/academic-calendar` di `AppRouter.jsx`.
- **File atau Komponen yang Terdampak:**
  - `[NEW] frontend/scp_web/src/services/academicEventApi.js`
  - `[NEW] frontend/scp_web/src/pages/waka/AcademicCalendarPage.jsx`
  - `[NEW] frontend/scp_web/src/pages/waka/AcademicCalendarPage.css`
  - `[NEW] frontend/scp_web/src/pages/waka/components/AcademicEventModal.jsx`
  - `[MOD] frontend/scp_web/src/components/layout/Sidebar.jsx`
  - `[MOD] frontend/scp_web/src/routes/AppRouter.jsx`
- **Ketergantungan dengan Tahap Lainnya:** Bergantung pada **Tahap 2**.
- **Hasil yang Diharapkan:** Waka dapat melihat kalender bulanan, menambah, mengubah, dan menghapus agenda dengan memilih cakupan seluruh sekolah, tingkat, maupun rombel tertentu.
- **Skenario Pengujian:**
  - Login sebagai Waka, buka menu Kalender Akademik, tambah agenda tingkat 10, verifikasi chip tampil di grid kalender, edit agenda, dan hapus agenda.
- **Kriteria Tahap Dianggap Selesai:** Halaman Kalender Akademik Waka berfungsi penuh, responsif, dan konsisten dengan desain UI SCP.

---

### Tahap 5: Integrasi UI Jadwal/Jurnal Guru, Monitoring Rekap Waka, & Portal Siswa/Orang Tua
- **Tujuan Tahap:** Menampilkan status pengecualian KBM, alasan agenda, banner informasi, penonaktifan tombol jurnal/presensi, serta perhitungan kepatuhan yang akurat di seluruh antarmuka pengguna.
- **Aktivitas yang Harus Dilakukan:**
  1. Memperbarui `TeacherSchedulePage.jsx`, `TeacherDashboardPage.jsx`, dan `TeacherJournalPage.jsx` untuk menampilkan banner libur penuh, status `[DIKECUALIKAN DARI KBM]` beserta alasan agenda pada slot kelas yang terdampak, dan menonaktifkan tombol `[ Isi Jurnal / Presensi ]`.
  2. Memperbarui `MonitoringRecapPage.jsx` dan `DashboardWakaPage.jsx` untuk menampilkan label `[Dikecualikan: <Nama Agenda>]` serta menghitung persentase kepatuhan jurnal dengan mengurangi jadwal yang dikecualikan dari penyebut (*denominator*).
  3. Memperbarui `StudentHomePage.jsx`, `StudentSchedulePage.jsx`, `StudentPermissionPage.jsx`, dan `ParentMonitoringPage.jsx` untuk menampilkan banner agenda relevan bagi kelas siswa dan mencegah pengajuan izin KBM reguler pada hari bebas-KBM.
- **File atau Komponen yang Terdampak:**
  - `[MOD] frontend/scp_web/src/pages/teacher/TeacherDashboardPage.jsx`
  - `[MOD] frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx`
  - `[MOD] frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx`
  - `[MOD] frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx`
  - `[MOD] frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx`
  - `[MOD] frontend/scp_web/src/pages/student/StudentHomePage.jsx`
  - `[MOD] frontend/scp_web/src/pages/student/StudentSchedulePage.jsx`
  - `[MOD] frontend/scp_web/src/pages/student/StudentPermissionPage.jsx`
  - `[MOD] frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx`
- **Ketergantungan dengan Tahap Lainnya:** Bergantung pada **Tahap 3** dan **Tahap 4**.
- **Hasil yang Diharapkan:** Seluruh role (Waka, Guru, Siswa, Orang Tua) melihat status KBM dan agenda secara konsisten dan akurat.
- **Skenario Pengujian:**
  - Verifikasi tampilan Guru yang mengajar Kelas 10 (sedang Pramuka) dan Kelas 11 (KBM aktif) di hari yang sama.
  - Verifikasi tampilan Siswa Kelas 10 vs Siswa Kelas 11.
  - Verifikasi kalkulasi persentase kepatuhan di halaman Monitoring Rekap Waka.
- **Kriteria Tahap Dianggap Selesai:** Seluruh halaman terintegrasi tanpa error konsol maupun error kompilasi Vite (`npm run build`).

---

### Tahap 6: Pengujian Otomatis (`AcademicCalendarExclusionTest`) & Verifikasi Regresi Menyeluruh
- **Tujuan Tahap:** Memvalidasi seluruh aturan bisnis Kalender Akademik secara otomatis dan memastikan tidak ada regresi pada fitur SCP yang sudah ada.
- **Aktivitas yang Harus Dilakukan:**
  1. Membuat `scp/tests/Feature/AcademicCalendarExclusionTest.php` yang mencakup pengujian:
     - Scope `all` (Hari Libur Nasional): semua kelas `is_teaching_exempted == true`, `POST /api/journals` ditolak `422`.
     - Scope `grade` (Kegiatan Tingkat 10): kelas 10 `is_teaching_exempted == true` & jurnal ditolak `422`, sementara kelas 11 & 12 `is_teaching_exempted == false` & jurnal berhasil disimpan (`201`).
     - Scope `class` (Kegiatan Rombel Spesifik): hanya rombel terdaftar yang dikecualikan, rombel lain di tingkat yang sama tetap aktif.
     - Agenda non-libur (`disables_teaching = false`): agenda tetap muncul sebagai informasi tetapi KBM & jurnal tetap aktif.
     - Eksklusi dari `GET /api/schedules?status=missing_journal` dan akurasi perhitungan denominator kepatuhan monitoring.
     - Otorisasi CRUD (`vice_principal` diizinkan, role lain ditolak `403`).
  2. Menjalankan seluruh test suite backend (`php artisan test`) dan build frontend (`npm run build`).
  3. Memperbarui dokumentasi log teknis di `scp/MD/Development.md` dan `frontend/scp_web/Development.md`.
- **File atau Komponen yang Terdampak:**
  - `[NEW] scp/tests/Feature/AcademicCalendarExclusionTest.php`
  - `[MOD] scp/MD/Development.md`
  - `[MOD] frontend/scp_web/Development.md`
- **Ketergantungan dengan Tahap Lainnya:** Bergantung pada **Tahap 1 s.d. Tahap 5**.
- **Hasil yang Diharapkan:** 100% test di `AcademicCalendarExclusionTest` dan seluruh test suite SCP lulus tanpa kegagalan.
- **Skenario Pengujian:** Eksekusi `php artisan test --filter=AcademicCalendarExclusionTest`, `php artisan test`, dan `npm --prefix frontend/scp_web run build`.
- **Kriteria Tahap Dianggap Selesai:** Seluruh automated test hijau (pass) dan bundle produksi frontend terbangun tanpa error.

---

## 12. Daftar File yang Akan Dibuat atau Dimodifikasi

Berikut adalah daftar lengkap file dengan path aktual pada workspace `d:\MyUKK\SchoolClassProject`:

### 12.1 Backend (`d:\MyUKK\SchoolClassProject\scp\`)

| Status | Path File Aktual | Deskripsi Perubahan |
| :---: | :--- | :--- |
| **[BARU]** | `scp/database/migrations/2026_11_06_000001_create_academic_events_table.php` | Migrasi pembuatan tabel `academic_events` beserta foreign key dan index komposit. |
| **[BARU]** | `scp/app/Models/AcademicEvent.php` | Model Eloquent `AcademicEvent` dengan `SoftDeletes`, `$casts`, dan relasi `creator()`. |
| **[BARU]** | `scp/app/Services/AcademicCalendarExclusionService.php` | Service layer resolusi pengecualian KBM dengan static cache per tanggal. |
| **[BARU]** | `scp/app/Http/Controllers/API/AcademicEventController.php` | Controller REST API untuk CRUD agenda, filter rentang kalender, dan `checkExemption`. |
| **[BARU]** | `scp/tests/Feature/AcademicCalendarExclusionTest.php` | Pengujian otomatis fitur Kalender Akademik (`all`, `grade`, `class`, `422` journal block, monitoring). |
| **[UBAH]** | `scp/routes/api.php` | Pendaftaran endpoint `/api/academic-events*` untuk user terautentikasi dan grup `role:vice_principal`. |
| **[UBAH]** | `scp/app/Http/Controllers/API/ScheduleController.php` | Integrasi `AcademicCalendarExclusionService` pada `missing_journal` dan atribut eksklusi pada daftar jadwal. |
| **[UBAH]** | `scp/app/Http/Controllers/API/JournalController.php` | Proteksi `HTTP 422` (`TEACHING_DISABLED_BY_EVENT`) pada `store`, `update`, `markTeacherAbsent` serta data kepatuhan rekapitulasi. |
| **[UBAH]** | `scp/app/Http/Controllers/API/LeaveRequestController.php` | Validasi pengajuan izin siswa pada hari libur / bebas-KBM. |
| **[UBAH]** | `scp/app/Http/Controllers/API/TeacherLeaveRequestController.php` | Validasi pengajuan izin guru pada jadwal yang sudah dibebaskan oleh agenda sekolah (sesuai konfirmasi). |

### 12.2 Frontend (`d:\MyUKK\SchoolClassProject\frontend\scp_web\`)

| Status | Path File Aktual | Deskripsi Perubahan |
| :---: | :--- | :--- |
| **[BARU]** | `frontend/scp_web/src/services/academicEventApi.js` | Modul Axios client untuk komunikasi dengan `/api/academic-events*`. |
| **[BARU]** | `frontend/scp_web/src/pages/waka/AcademicCalendarPage.jsx` | Halaman Kalender Akademik Waka (grid bulanan, filter, KPI, dan daftar agenda). |
| **[BARU]** | `frontend/scp_web/src/pages/waka/AcademicCalendarPage.css` | Styling khusus grid kalender bulanan, chip agenda, dan responsivitas halaman. |
| **[BARU]** | `frontend/scp_web/src/pages/waka/components/AcademicEventModal.jsx` | Modal form tambah/edit agenda dengan pilihan lingkup `all`, `grade`, dan `class`. |
| **[UBAH]** | `frontend/scp_web/src/components/layout/Sidebar.jsx` | Penambahan menu navigasi `Kalender Akademik` pada sidebar Waka. |
| **[UBAH]** | `frontend/scp_web/src/routes/AppRouter.jsx` | Penambahan route `/waka/academic-calendar` dengan proteksi `RoleRoute`. |
| **[UBAH]** | `frontend/scp_web/src/pages/teacher/TeacherDashboardPage.jsx` | Penampilan banner agenda hari ini dan badge pengecualian pada jadwal mengajar hari ini. |
| **[UBAH]** | `frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx` | Penampilan banner hari libur, kartu jadwal `DIKECUALIKAN DARI KBM`, alasan agenda, dan disable tombol jurnal. |
| **[UBAH]** | `frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx` | Penonaktifan pilihan jadwal yang sedang dikecualikan pada form buka jurnal/presensi. |
| **[UBAH]** | `frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx` | Penampilan indikator agenda aktif hari ini pada dashboard Waka. |
| **[UBAH]** | `frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx` | Penyesuaian formula persentase kepatuhan jurnal dan penampilan label `[Dikecualikan: Acara]`. |
| **[UBAH]** | `frontend/scp_web/src/pages/student/StudentHomePage.jsx` | Penampilan banner pengumuman agenda yang relevan dengan kelas siswa. |
| **[UBAH]** | `frontend/scp_web/src/pages/student/StudentSchedulePage.jsx` | Penampilan indikator agenda/libur pada tampilan jadwal pelajaran siswa. |
| **[UBAH]** | `frontend/scp_web/src/pages/student/StudentPermissionPage.jsx` | Pencegahan/peringatan pengajuan izin reguler pada tanggal libur atau agenda bebas-KBM. |
| **[UBAH]** | `frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx` | Penampilan banner agenda kelas anak pada portal monitoring orang tua. |

---

## 13. Strategi Pengujian dan Validasi

### 13.1 Pengujian Otomatis Backend (PHPUnit Feature & Unit Tests)
Dibuat di `scp/tests/Feature/AcademicCalendarExclusionTest.php` dengan 7 skenario pengujian terisolasi:
1. **`test_waka_can_manage_academic_events_and_other_roles_are_forbidden`:**
   - Memastikan Waka (`vice_principal`) dapat membuat, mengubah, dan menghapus agenda (`201`, `200`), sedangkan Guru, Siswa, dan Orang Tua ditolak (`403`).
2. **`test_exemption_scope_all_disables_teaching_for_all_grades_and_blocks_journal`:**
   - Membuat agenda `holiday` (`scope_type = 'all'`) pada tanggal $T$.
   - Memverifikasi jadwal Kelas 10, 11, dan 12 pada tanggal $T$ memiliki `is_teaching_exempted = true`.
   - Memverifikasi `POST /api/journals` mengembalikan `HTTP 422` dengan `error_code = 'TEACHING_DISABLED_BY_EVENT'`.
3. **`test_exemption_scope_grade_only_disables_targeted_grade_levels`:**
   - Membuat agenda `class_event` ("Kemah Pramuka Blok Tingkat 10") dengan `scope_type = 'grade'` dan `scope_targets = ["10"]`.
   - Memverifikasi jadwal Kelas 10 ditandai `is_teaching_exempted = true` dan `POST /api/journals` ditolak `422`.
   - Memverifikasi jadwal Kelas 11 dan 12 pada hari yang sama tetap `is_teaching_exempted = false` dan `POST /api/journals` berhasil disimpan (`201`).
4. **`test_exemption_scope_specific_class_only_disables_targeted_rombel`:**
   - Membuat agenda `class_event` ("Kunjungan Industri XI RPL 1") dengan `scope_type = 'class'` dan `scope_targets = [$xiRpl1->id]`.
   - Memverifikasi jadwal `XI RPL 1` dikecualikan (`true`), sedangkan `XI RPL 2` (di tingkat dan jurusan yang sama) tetap aktif (`false`).
5. **`test_non_disabling_school_event_keeps_teaching_and_journal_active`:**
   - Membuat agenda `school_event` ("Upacara Peringatan Hari Guru") dengan `disables_teaching = false`.
   - Memverifikasi `is_teaching_exempted = false` dan guru tetap dapat membuka serta menyelesaikan jurnal mengajar.
6. **`test_exempted_schedules_are_excluded_from_missing_journal_alerts`:**
   - Mensimulasikan waktu melewati `end_time + 30 menit` pada hari kerja.
   - Memverifikasi bahwa jadwal kelas yang sedang terdampak agenda `disables_teaching = true` **tidak muncul** pada `GET /api/schedules?status=missing_journal`.
7. **`test_monitoring_compliance_denominator_excludes_exempted_schedules`:**
   - Memverifikasi bahwa perhitungan target wajib jurnal harian mengurangi jumlah jadwal yang berstatus `is_teaching_exempted = true`.

### 13.2 Validasi Performa & Build Frontend
- Memastikan `GET /api/schedules?all=1` hanya mengeksekusi **1 query** ke tabel `academic_events` berkat *static in-memory cache* di `AcademicCalendarExclusionService`.
- Menjalankan `npm --prefix frontend/scp_web run build` untuk memastikan tidak ada *broken import*, *syntax error*, maupun *missing component*.

---

## 14. Kriteria Keberhasilan

Fitur Kalender Akademik & Agenda Khusus KBM dinyatakan berhasil dan siap rilis apabila memenuhi seluruh kriteria berikut:
- [ ] Waka Kurikulum dapat menambah, mengedit, menghapus, dan memfilter agenda dengan lingkup `Seluruh Sekolah`, `Tingkat Tertentu (10/11/12)`, dan `Rombel Tertentu` melalui halaman Kalender Akademik.
- [ ] Jadwal pelajaran yang terdampak agenda dengan `disables_teaching = true` otomatis memiliki atribut `is_teaching_exempted = true` beserta alasan dan tipe agendanya.
- [ ] Tombol pengisian jurnal dan presensi pada jadwal yang dikecualikan otomatis nonaktif (*disabled*) di UI Guru dengan keterangan alasan yang jelas, sedangkan jadwal kelas lain yang tidak terdampak di hari yang sama tetap aktif.
- [ ] Percobaan pengiriman jurnal/presensi ke backend pada jadwal yang dikecualikan selalu ditolak dengan `HTTP 422 Unprocessable Content` (`TEACHING_DISABLED_BY_EVENT`).
- [ ] Kelas yang dikecualikan tidak pernah ditandai sebagai "Jurnal Terlambat / Belum Diisi" (`missing_journal`) dan dikeluarkan dari penyebut (*denominator*) persentase kepatuhan jurnal guru pada halaman Monitoring & Rekapitulasi Waka.
- [ ] Siswa dan Orang Tua melihat banner agenda yang relevan dengan kelasnya pada dashboard masing-masing.
- [ ] Seluruh pengujian otomatis di `AcademicCalendarExclusionTest.php` dan seluruh test suite eksisting SCP lulus 100%.

---

## 15. Hal yang Membutuhkan Konfirmasi atau Keputusan Pengguna

Sesuai aturan pengerjaan, sebelum melangkah ke tahap implementasi kode, mohon konfirmasi dan keputusan Anda terhadap **5 hal sensitif / keputusan arsitektural** berikut:

### 1. Kebijakan *Step-Up Authentication* (Konfirmasi Password Waka) pada Pengelolaan Agenda
- **Konteks di SCP saat ini:** Pada modul Jadwal Manual dan Pengaturan Akademik, aksi mutasi oleh Waka memerlukan konfirmasi password ulang (`password_confirmation`), sedangkan pada modul Master Data (Kelas, Ruangan, Mapel) aksi Tambah/Edit tidak memerlukan input password berulang.
- **Opsi A (Direkomendasikan):** Tambah, Edit, dan Hapus Agenda Kalender Akademik cukup menggunakan autentikasi token Waka (`role:vice_principal`) + dialog konfirmasi standar (`ConfirmDialog`) saat menghapus, tanpa meminta ketik ulang password setiap membuat agenda agar Waka mudah memasukkan banyak agenda tahunan.
- **Opsi B:** Mewajibkan modal konfirmasi password Waka (`PasswordConfirmModal`) setiap kali menambah/mengubah/menghapus agenda.
- **Pertanyaan 1:** Apakah Anda memilih **Opsi A** atau **Opsi B**?

### 2. Penanganan Jurnal yang Sudah Terlanjur Dibuka (`ongoing`) Jika Agenda Dibuat Menyusul di Hari yang Sama
- **Konteks:** Bagaimana jika seorang guru sudah terlanjur menekan `"Buka Kelas"` (`status = 'ongoing'`) pada pukul 07:05, lalu pada pukul 07:30 Waka baru menginput agenda mendadak yang menonaktifkan KBM (`disables_teaching = true`) untuk kelas tersebut pada hari itu?
- **Opsi A (Direkomendasikan):** Blokir penyelesaian jurnal baru (`store` & `update` ditolak `422`), dan untuk jurnal yang sudah terlanjur berstatus `ongoing` pada hari itu, otomatis abaikan/kecualikan dari perhitungan *missing/incomplete journal* (atau batalkan sesi `ongoing` tersebut) tanpa menghapus jurnal yang sudah `completed`.
- **Opsi B:** Izinkan jurnal yang sudah terlanjur `ongoing` untuk tetap diselesaikan (`update`), dan hanya blokir pembukaan jurnal baru (`store`).
- **Pertanyaan 2:** Apakah Anda memilih **Opsi A** atau **Opsi B**?

### 3. Tampilan Baris Jadwal yang Dikecualikan pada Tabel `MonitoringRecapPage.jsx`
- **Konteks:** Saat ini tab "Jurnal Mengajar" di `MonitoringRecapPage.jsx` hanya merender baris dari tabel `journals` (jurnal yang pernah dibuka oleh guru). Padahal spesifikasi meminta agar jadwal yang belum diisi tampil sebagai `[Belum Terisi]` dan jadwal yang terdampak agenda tampil sebagai `[Dikecualikan: Acara]`, serta persentase kepatuhan dihitung dari $\frac{\text{Jurnal Terisi}}{\text{Total Jadwal Wajib} - \text{Jadwal Dikecualikan}} \times 100\%$.
- **Opsi A (Direkomendasikan):** Memperkaya endpoint monitoring/jurnal agar untuk tanggal yang dipantau menyertakan pula slot jadwal wajib hari tersebut yang berstatus `[Belum Terisi]` dan `[Dikecualikan: <Nama Agenda>]` beserta ringkasan `compliance_metrics` (`total_mandatory`, `exempted_count`, `completed_count`, `compliance_rate`), sehingga tabel dan rumus kepatuhan di `MonitoringRecapPage.jsx` 100% akurat sesuai spesifikasi.
- **Opsi B:** Hanya memperbarui rumus kartu KPI persentase kepatuhan di bagian atas `MonitoringRecapPage.jsx`, sementara tabel di bawahnya tetap hanya menampilkan record dari tabel `journals` saja.
- **Pertanyaan 3:** Apakah Anda memilih **Opsi A** atau **Opsi B**?

### 4. Aturan Blokir Pengajuan Izin Siswa & Guru pada Tanggal Agenda Bebas-KBM
- **Konteks:** Siswa dapat mengajukan izin multi-hari (`tidak_masuk` dari Senin s.d. Rabu) atau izin 1 hari (`keluar_sekolah`), dan Guru dapat mengajukan izin tidak mengajar (`TeacherLeavePage.jsx`).
- **Opsi A (Direkomendasikan):**
  - Untuk **Siswa/Orang Tua**: Blokir (`HTTP 422` & peringatan di UI) jika **seluruh** tanggal dalam rentang izin yang diajukan jatuh pada hari libur/agenda bebas-KBM untuk kelas siswa tersebut. Namun jika izin bersifat multi-hari (misal Senin–Rabu) dan hanya hari Selasa yang libur nasional, tetap izinkan pengajuan karena Senin dan Rabu masih hari KBM aktif.
  - Untuk **Guru**: Blokir pemilihan jadwal pada `TeacherLeavePage` jika jadwal pada tanggal tersebut sudah berstatus `is_teaching_exempted = true` (karena guru memang sudah dibebaskan dari kewajiban mengajar pada slot tersebut).
- **Opsi B:** Blokir pengajuan izin siswa hanya di sisi tampilan frontend (`StudentPermissionPage.jsx`) tanpa validasi blokir `422` di `LeaveRequestController` maupun `TeacherLeaveRequestController`.
- **Pertanyaan 4:** Apakah Anda memilih **Opsi A** atau **Opsi B**?

### 5. Perilaku Data Kalender Akademik Saat "Reset Tahun Ajaran / Kenaikan Kelas"
- **Konteks:** Di SCP terdapat fitur Reset / Siklus Tahun Ajaran (`AcademicSettingController` & `GradePromotionPage`).
- **Opsi A (Direkomendasikan):** Tambahkan kolom `academic_year` pada `academic_events` (diisi otomatis dengan tahun ajaran aktif saat dibuat). Data `academic_events` **tidak ikut dihapus** saat reset jadwal/siklus putaran, melainkan tetap tersimpan sebagai arsip historis per tahun ajaran.
- **Opsi B:** Ikut menghapus (*soft-delete*) seluruh `academic_events` ketika Waka melakukan reset sistem tahun ajaran.
- **Pertanyaan 5:** Apakah Anda memilih **Opsi A** atau **Opsi B**?

---
---

# Lampiran: Dokumen Spesifikasi Sumber (Utuh)

*Di bawah ini adalah naskah asli dokumen spesifikasi sumber (baris 1–308) yang dipertahankan secara utuh sebagai referensi utama:*

---

# Spesifikasi Fitur: Kalender Akademik & Agenda Khusus KBM (Event-Driven Academic Calendar)

**Status Dokumen:** Proposed / Ready for Implementation  
**Target Rilis:** Modul Kalender & Penyesuaian KBM v1.0  
**Komponen Terdampak:**
- Backend API (`/scp`): Migrasi Database, Model, Service Layer, Controller, dan Automated Testing.
- Frontend Web (`/frontend/scp_web`): Halaman Waka (Kalender), Dashboard Guru (Jadwal & Jurnal), Monitoring Rekap, dan Portal Siswa/Orang Tua.

---

## 1. Latar Belakang & Problem Statement

Pada operasional sekolah reguler, proses Belajar Mengajar (KBM) tidak selalu berjalan serentak untuk semua kelas setiap harinya. Terdapat beberapa kondisi khusus:
1. **Hari Libur Nasional / Cuti Bersama Sekolah:** Seluruh kelas diliburkan, sehingga pengisian jurnal dan presensi harian wajib ditiadakan tanpa menandai guru sebagai "Alpa/Belum Mengisi Jurnal".
2. **Kegiatan Khusus Bertingkat (Grade-Specific Event):** Misalnya, Kelas 10 mengikuti Perkemahan Pramuka Blok atau Asesmen Bakat Minat, sementara Kelas 11 dan 12 tetap melaksanakan KBM normal di kelas.
3. **Kegiatan Khusus Spesifik Rombel/Kelas (Class-Specific Event):** Misalnya, Rombel XI RPL 1 melaksanakan Kunjungan Industri (KI), sedangkan rombel lainnya di tingkat yang sama tetap belajar di kelas.

Sebelum fitur ini dirancang, sistem memperlakukan seluruh jadwal KBM aktif setiap hari kerja. Hal ini menyebabkan guru yang kelasnya sedang berkegiatan ditandai belum mengisi jurnal (merusak statistik monitoring kepatuhan guru) dan memaksa pengisian jurnal fiktif.

---

## 2. Tujuan & Sasaran Fitur (Objectives)

- **Otomatisasi Pengecualian Jurnal & Presensi:** Sistem secara otomatis mendeteksi apakah suatu rombel/tingkat kelas berstatus libur atau sedang berkegiatan pada tanggal tertentu.
- **Kepatuhan Monitoring Akurat:** Jadwal yang terdampak agenda bebas-KBM dikeluarkan dari penyebut (*denominator*) kalkulasi persentase kepatuhan jurnal guru.
- **Transparansi Multi-Role:** Guru, Waka, Siswa, dan Orang Tua memiliki satu sumber kebenaran (*single source of truth*) mengenai agenda harian sekolah.
- **Pencegahan Error Pengisian:** Tombol "Isi Jurnal" dan "Presensi" dinonaktifkan secara otomatis (*disabled*) disertai alasan yang jelas saat KBM ditiadakan.

---

## 3. Aturan Bisnis (Business Rules)

### 3.1 Hierarki & Lingkup Agenda (`scope_type`)
1. **`all` (Seluruh Sekolah):**
   - Berdampak pada seluruh tingkatan (10, 11, 12) dan seluruh rombel.
   - Contoh: Libur Nasional Hari Kemerdekaan, Hari Raya Idul Fitri, Hari Guru Nasional.
2. **`grade` (Tingkat Tertentu):**
   - Berdampak pada satu atau lebih tingkatan kelas sekaligus.
   - Contoh: Kemah Pramuka Blok Tingkat 10, Wisuda / Asesmen Tingkat 12.
   - Kelas pada tingkat selain yang dipilih tetap wajib menjalankan KBM dan mengisi jurnal.
3. **`class` (Spesifik Rombel):**
   - Berdampak hanya pada rombel-rombel yang didaftarkan.
   - Contoh: Kunjungan Industri XI RPL 1 dan XI RPL 2.

### 3.2 Tipe Agenda & Pengaruh terhadap KBM
| Tipe Agenda (`type`) | Default `disables_teaching` | Perilaku terhadap KBM & Jurnal |
| :--- | :---: | :--- |
| `holiday` | `true` | KBM libur penuh. Jurnal ditiadakan, presensi siswa ditiadakan. |
| `school_event` | Bervariasi (`true`/`false`) | Ditentukan oleh Waka. Jika `true` (misal Classmeeting/Porseni), KBM ditiadakan. Jika `false` (misal Upacara Hari Senin), KBM tetap berjalan. |
| `class_event` | `true` | KBM untuk rombel/tingkat tersebut ditiadakan, digantikan kegiatan khusus. |
| `exam` | `true` | KBM mata pelajaran ditiadakan; modul presensi dialihkan ke kartu presensi ujian. |

### 3.3 Validasi & Integritas Data
- Tidak diperbolehkan membuat dua agenda berulang yang tumpang tindih untuk target kelas/tingkat yang sama dengan status bertentangan.
- Jika sebuah agenda bertipe `holiday` dengan cakupan `all`, agenda tersebut otomatis meng-override agenda parsial lainnya pada rentang tanggal yang sama.
- Backend memvalidasi integritas data pada layer `StoreJournalRequest` dan `AttendanceController`. Request pengisian jurnal pada slot waktu yang dibebaskan akan ditolak dengan respons `HTTP 422 Unprocessable Content`.

---

## 4. Arsitektur & Desain Database

### 4.1 Skema Tabel `academic_events`
Tabel baru dibuat melalui migrasi: `database/migrations/2026_11_06_000001_create_academic_events_table.php`

```sql
CREATE TABLE academic_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type ENUM('holiday', 'school_event', 'class_event', 'exam') NOT NULL,
    scope_type ENUM('all', 'grade', 'class') NOT NULL DEFAULT 'all',
    scope_targets JSON NULL COMMENT 'Array tingkat misal ["10"] atau ID kelas [1, 2, 5]',
    disables_teaching BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_academic_events_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_academic_events_dates (start_date, end_date),
    INDEX idx_academic_events_scope (scope_type, disables_teaching)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 5. Rencana Arsitektur Backend (`/scp`)

### 5.1 Service Layer: `AcademicCalendarExclusionService.php`
Ditempatkan di `app/Services/AcademicCalendarExclusionService.php`.

**Tanggung Jawab:**
1. Menyediakan kalkulasi status eksklusi KBM untuk suatu kelas pada tanggal spesifik.
2. Melayani filter query cepat untuk jadwal harian guru.
3. Menyediakan agregator pengecualian untuk modul monitoring Waka.

```php
namespace App\Services;

use App\Models\AcademicEvent;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class AcademicCalendarExclusionService
{
    /**
     * Mendapatkan event yang menonaktifkan KBM untuk kelas tertentu pada tanggal tertentu.
     */
    public function getActiveDisablingEvent(int $classId, string $gradeLevel, Carbon $date): ?AcademicEvent
    {
        return AcademicEvent::query()
            ->where('disables_teaching', true)
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->get()
            ->first(function (AcademicEvent $event) use ($classId, $gradeLevel) {
                if ($event->scope_type === 'all') {
                    return true;
                }
                
                $targets = $event->scope_targets ?? [];
                if ($event->scope_type === 'grade' && in_array((string)$gradeLevel, array_map('strval', $targets), true)) {
                    return true;
                }

                if ($event->scope_type === 'class' && in_array($classId, $targets, true)) {
                    return true;
                }

                return false;
            });
    }

    /**
     * Mendapatkan seluruh agenda dalam rentang waktu (untuk kalender visual).
     */
    public function getEventsForRange(Carbon $startDate, Carbon $endDate): Collection
    {
        return AcademicEvent::query()
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate, $endDate])
                  ->orWhereBetween('end_date', [$startDate, $endDate])
                  ->orWhere(function ($sub) use ($startDate, $endDate) {
                      $sub->where('start_date', '<=', $startDate)
                          ->where('end_date', '>=', $endDate);
                  });
            })
            ->orderBy('start_date')
            ->get();
    }
}
```

### 5.2 Penyesuaian Controller Terkait
1. **`JournalController@store`**:
   - Memanggil `AcademicCalendarExclusionService::getActiveDisablingEvent()`.
   - Jika ditemukan event, gagalkan proses simpan dan kembalikan pesan:
     ```json
     {
       "message": "Pengisian jurnal dibatalkan karena terdapat agenda sekolah: Kemah Pramuka Blok Kelas X.",
       "error_code": "TEACHING_DISABLED_BY_EVENT"
     }
     ```
2. **`ScheduleController@getTeacherSchedule`**:
   - Setiap item jadwal yang dikembalikan ke antarmuka guru akan disisipkan atribut tambahan:
     - `is_teaching_exempted: boolean`
     - `exemption_reason: string|null`
     - `event_type: string|null`
3. **`MasterDataSummaryController` & `MonitoringRecapPage` Backend**:
   - Jadwal yang memiliki `is_teaching_exempted === true` dikeluarkan dari total target pengisian jurnal harian.
   - Status kolom jurnal pada tabel rekapitulasi diberi nilai `EXEMPTED`.

### 5.3 Daftar Rute API (`/scp/routes/api.php`)
```php
Route::middleware(['auth:sanctum'])->group(function () {
    // Read-only untuk seluruh user terotentikasi (Guru, Siswa, Ortu, Waka)
    Route::get('/academic-events', [AcademicEventController::class, 'index']);
    Route::get('/academic-events/{id}', [AcademicEventController::class, 'show']);
    Route::get('/academic-events/check-exemption', [AcademicEventController::class, 'checkExemption']);

    // Khusus Waka & Administrator
    Route::middleware(['role:waka,admin'])->group(function () {
        Route::post('/academic-events', [AcademicEventController::class, 'store']);
        Route::put('/academic-events/{id}', [AcademicEventController::class, 'update']);
        Route::delete('/academic-events/{id}', [AcademicEventController::class, 'destroy']);
    });
});
```

---

## 6. Rencana Desain Antarmuka Pengguna (Frontend `/frontend/scp_web`)

### 6.1 Tampilan Kalender Akademik Waka (`AcademicCalendarPage.jsx`)
- **Navigasi:** Ditambahkan pada sidebar menu Waka (`Sidebar.jsx`) dengan ikon kalender.
- **Fitur Utama:**
  - Header bulan dengan tombol navigasi *Previous Month / Next Month* dan dropdown pemilih tahun ajaran.
  - Tampilan grid bulanan 7 kolom (Senin - Minggu).
  - Chip agenda berwarna pada sel tanggal:
    - **Merah/Rose (`#EF4444`):** Libur Nasional & Resmi.
    - **Kuning/Amber (`#F59E0B`):** Kegiatan Khusus Tingkat / Acara Sekolah.
    - **Biru/Indigo (`#4361EE`):** Masa Penilaian / Ujian.
  - Tombol aksi: `[ + Tambah Agenda ]` membuka modal interaktif.

#### Desain Modal Tambah/Edit Agenda (`AcademicEventModal.jsx`):
1. **Nama Kegiatan:** Input teks (misal: "Kemah Pramuka Blok Kelas X").
2. **Kategori Agenda:** Dropdown (`Libur Nasional / Resmi`, `Kegiatan Sekolah`, `Kegiatan Luar / Perkemahan`, `Ujian / Asesmen`).
3. **Rentang Tanggal:** Input tanggal `Mulai` dan `Selesai`.
4. **Target Peserta / Lingkup:**
   - Radio: `Seluruh Sekolah`
   - Radio: `Tingkat Tertentu` $\rightarrow$ Muncul checkbox: `[x] Tingkat 10`, `[ ] Tingkat 11`, `[ ] Tingkat 12`
   - Radio: `Rombel Tertentu` $\rightarrow$ Muncul multi-select rombel kelas aktif.
5. **Dampak KBM (Toggle Switch):** *"Bebaskan Jadwal KBM & Kewajiban Jurnal"* (Secara default aktif untuk libur dan kegiatan luar).

---

### 6.2 Responsivitas Antarmuka Jadwal Guru (`TeacherSchedulePage.jsx`)

#### Skenario 1: Hari Libur Nasional Penuh
Jika hari yang dipilih memiliki agenda libur sekolah umum:
```
+------------------------------------------------------------------------------+
|  SELASA, 10 NOVEMBER 2026                                                    |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  | [ICON LIBUR] HARI LIBUR NASIONAL: Hari Pahlawan                         |  |
|  | Seluruh kegiatan KBM dan pengisian jurnal dinonaktifkan hari ini.      |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  (Tabel slot jam pelajaran dialihkan ke status non-aktif / istirahat)        |
+------------------------------------------------------------------------------+
```

#### Skenario 2: Hari dengan Agenda Khusus Tingkat (Contoh: Guru mengajar Kelas 10 dan Kelas 11)
```
+------------------------------------------------------------------------------+
|  KAMIS, 5 NOVEMBER 2026                                                      |
+------------------------------------------------------------------------------+

  [ Jam 1-3 | 07:00 - 09:15 ] • X RPL 2 • Dasar Pemrograman
  +--------------------------------------------------------------------------+
  | [!] STATUS: DIKECUALIKAN DARI KBM                                        |
  | Alasan: Kemah Pramuka Blok Tingkat 10                                    |
  | Guru tidak berkewajiban mengisi jurnal atau presensi kelas.              |
  |                                                                          |
  | [ Isi Jurnal (Disabled) ]              [ Presensi Siswa (Disabled) ]     |
  +--------------------------------------------------------------------------+

  [ Jam 4-6 | 09:30 - 11:45 ] • XI RPL 1 • Rekayasa Perangkat Lunak
  +--------------------------------------------------------------------------+
  | STATUS: KBM AKTIF                                                        |
  | Ruang: Lab Komputer 2                                                    |
  |                                                                          |
  | [ Isi Jurnal Mengajar (Aktif) ]        [ Presensi Siswa (Aktif) ]        |
  +--------------------------------------------------------------------------+
```

---

### 6.3 Halaman Monitoring & Rekapitulasi Waka (`MonitoringRecapPage.jsx`)
- Pada kolom status jurnal harian:
  - Kelas yang aktif dan belum diisi: Label Merah `[Belum Terisi]`.
  - Kelas yang aktif dan sudah diisi: Label Hijau `[Terisi Tepat Waktu]`.
  - Kelas yang terdampak agenda bebas-KBM: Label Kuning/Abu-abu `[Dikecualikan: Acara]`.
- **Indeks Kepatuhan Guru:**
  $$\text{Persentase Kepatuhan} = \frac{\text{Jumlah Jurnal Terisi}}{\text{Total Jadwal Wajib} - \text{Jadwal Dikecualikan}} \times 100\%$$
  Dengan formula ini, guru tidak dirugikan ketika kelas yang diampunya sedang berhalangan KBM karena agenda sekolah.

---

### 6.4 Portal Siswa & Orang Tua (`StudentHomePage.jsx` & `ParentMonitoringPage.jsx`)
- Menampilkan banner pengumuman pada dashboard siswa:
  - Siswa Kelas 10: *"Hari ini agenda: Kemah Pramuka Blok. KBM reguler di kelas ditiadakan."*
  - Siswa Kelas 11: Menampilkan jadwal pelajaran harian normal.
- Modul perizinan siswa (`StudentPermissionPage.jsx`): Memblokir pengajuan izin sakit/izin kelas reguler pada hari libur nasional atau hari acara khusus yang meniadakan KBM.

---

## 7. Strategi Pengujian Otomatis (Automated Testing Strategy)

Pengujian dibuat pada berkas `tests/Feature/AcademicCalendarExclusionTest.php` untuk memastikan keandalan sistem:

1. **Test Exemption Scope All:**
   - Membuat agenda libur nasional pada tanggal $T$.
   - Menguji bahwa jadwal kelas 10, 11, dan 12 pada tanggal $T$ menghasilkan `is_teaching_exempted == true`.
   - Menguji bahwa endpoint `POST /api/journals` mengembalikan status error 422 jika dicoba disimpan.
2. **Test Exemption Scope Grade:**
   - Membuat agenda Pramuka untuk `scope_targets: ["10"]`.
   - Menguji bahwa jadwal kelas 10 ditandai `is_teaching_exempted == true`.
   - Menguji bahwa jadwal kelas 11 dan 12 pada tanggal yang sama tetap berstatus `is_teaching_exempted == false` dan jurnalnya dapat disimpan dengan sukses.
3. **Test Exemption Scope Specific Class:**
   - Menguji skenario rombel tunggal (misal hanya kelas ID 3 yang libur).
4. **Test Monitoring Calculation Integrity:**
   - Memastikan pembagi (*denominator*) pada perhitungan rekapitulasi kepatuhan guru berkurang sesuai jumlah jam yang dikecualikan.

---

## 8. Langkah Kerja Implementasi Bertahap (Implementation Roadmap)

| Tahap | Aktivitas Utama | Output |
| :---: | :--- | :--- |
| **Tahap 1** | Pembuatan migration `academic_events` & Model Eloquent | Tabel basis data dan model siap |
| **Tahap 2** | Implementasi `AcademicCalendarExclusionService` & integrasi ke `JournalController` | Proteksi backend terhadap pengisian jurnal ilegal |
| **Tahap 3** | Penambahan atribut eksklusi pada `ScheduleController` & API CRUD Event | Endpoint API kalender siap dikonsumsi |
| **Tahap 4** | Pembuatan UI `AcademicCalendarPage.jsx` dan Modal Form Waka | Halaman admin kalender interaktif |
| **Tahap 5** | Pembaruan visual kartu jadwal guru (`TeacherSchedulePage.jsx`) & Rekap Waka | Status disabled dan label pengecualian tampil |
| **Tahap 6** | Eksekusi Unit & Feature Tests (`AcademicCalendarExclusionTest`) | Verifikasi seluruh skenario pengujian sukses |
