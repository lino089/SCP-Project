# School Class Progress (SCP) v4.4 — Dokumentasi Kerangka Arsitektur Backend

> **Dokumen ini** adalah peta arsitektur yang memetakan setiap file di codebase backend terhadap spesifikasi `PRD.md` versi 4.4.
> Disusun sebagai panduan belajar: setiap modul memiliki daftar file, ringkasan alur, placeholder penjelasan logika (untuk diisi manual), dan daftar pertanyaan analisis mendalam.

**Tech Stack Aktual:** Laravel (API-only) · Laravel Sanctum · PostgreSQL · Local Storage (belum Supabase) · Queue Worker (Symfony Process → Python subprocess) · Intervention Image (kompresi foto)

**Namespace Controller:** `App\Http\Controllers\API\*`
**Role ENUM di Database:** `vice_principal`, `teacher`, `student`, `parent`

---

## Daftar Isi

- [0. Pondasi Arsitektur, Standar Response JSON, Middleware & Database Seeder](#0-pondasi-arsitektur-standar-response-json-middleware--database-seeder)
- [1. Autentikasi, Profil, Verifikasi Kontak & Password Re-confirmation](#1-autentikasi-profil-verifikasi-kontak-mandiri--password-re-confirmation)
- [2. Manajemen Master Data, Auto-Provisioning Akun & Multirole Guru](#2-manajemen-master-data-auto-provisioning-akun--multirole-guru)
- [3. Pengaturan Akademik, Siklus Putaran & Resolusi Jam Pelajaran Dinamis](#3-pengaturan-akademik-siklus-putaran--resolusi-jam-pelajaran-dinamis)
- [4. Manajemen Jadwal Manual Terpusat di Waka & Alert Keterlambatan Jurnal](#4-manajemen-jadwal-manual-terpusat-di-waka--alert-keterlambatan-jurnal)
- [5. Sistem Import Jadwal Otomatis dari 2 PDF FET & Subprocess Python](#5-sistem-import-jadwal-otomatis-dari-2-pdf-fet--subprocess-python)
- [6. Jurnal Mengajar (KBM), Kompresi Foto & Penanganan Guru Berhalangan](#6-jurnal-mengajar-kbm-kompresi-foto--penanganan-guru-berhalangan)
- [7. Sistem Perizinan, Presensi Exception-Based & Sinkronisasi](#7-sistem-perizinan-2-tipe-x-2-kategori-presensi-exception-based--sinkronisasi)
- [8. Workflow Evaluasi Kuis AI Asinkron](#8-workflow-evaluasi-kuis-ai-asinkron)
- [9. Siklus Kenaikan Kelas & Kelulusan](#9-siklus-kenaikan-kelas--kelulusan)
- [10. Scheduled Jobs & Background Queue Daemons](#10-scheduled-jobs--background-queue-daemons)

---

## 0. Pondasi Arsitektur, Standar Response JSON, Middleware & Database Seeder

**(Referensi PRD: Bab 2, 3, 6, 7)**

### A. Daftar File yang Terlibat (File Mapping)

* **Bootstrap & Konfigurasi Aplikasi:**
  - `bootstrap/app.php` — Registrasi routing (`api.php`, `web.php`, `console.php`), alias middleware (`role` → `RoleMiddleware`), dan global exception handler (render `AuthenticationException` → 401, `AccessDeniedHttpException` → 403, `NotFoundHttpException`/`ModelNotFoundException` → 404, `ValidationException` → 422, `Throwable` → 500) yang mengikuti standar JSON `{success, message, errors}`.
  - `config/app.php` — Timezone diset `Asia/Jakarta` (sesuai PRD Bab 2).
  - `config/database.php` — Konfigurasi koneksi database.
  - `config/filesystems.php` — Disk `local` (storage private, untuk PDF import), disk `public` (untuk foto jurnal, bukti izin).
  - `config/sanctum.php` — Konfigurasi Sanctum (stateful domains, guard, expiration).
  - `config/queue.php` — Konfigurasi queue driver untuk job asinkron.
  - `config/intervention-image.php` — Konfigurasi library Intervention Image.

* **Routes:**
  - `routes/api.php` — Seluruh definisi endpoint REST API; dikelompokkan dalam 3 middleware group: `role:vice_principal` (Waka), `role:teacher` (Guru), `role:student` (Siswa). Plus route publik `POST /api/login` dan route `auth:sanctum` umum (`/me`, `/logout`).
  - `routes/console.php` — Scheduled command: `scp:prune-failed-imports` dijalankan harian pukul `01:00`.
  - `routes/web.php` — Hanya halaman welcome Laravel (tidak relevan untuk API).

* **Middlewares:**
  - `app/Http/Middleware/RoleMiddleware.php` — Menerima parameter `...$roles`, memeriksa `$request->user()->role` terhadap daftar role yang diizinkan; mengembalikan 403 jika tidak cocok.

* **Exception Handling:**
  - Didefinisikan langsung di `bootstrap/app.php` via `->withExceptions()` — bukan di file Handler terpisah. Menangani 5 tipe exception dengan format JSON standar.

* **Database Seeders:**
  - `database/seeders/DatabaseSeeder.php` — Menyemai data awal: rooms (5 ruangan), subjects (7 mata pelajaran). Akun Waka awal di-comment-out di dalam file ini.
  - `database/seeders/PeriodTemplateSeeder.php` — Menyemai tabel `period_templates` untuk `senin_upacara` (1 record, period 1), `senin_reguler` (1 record), `selasa` (1 record, ada typo `end_type`), `rabu_kamis` (1 record). Data belum lengkap untuk seluruh period_number per day_type.

* **Migration Fondasi:**
  - `database/migrations/0001_01_01_000000_create_users_table.php` — Tabel `users` (role ENUM: `vice_principal/teacher/student/parent`, `nis_nip` unique, `fet_staff_id` nullable unique, `must_change_password`, `google_id`, `phone_number`, `linked_student_id`, `class_id`, `graduation_date`, `softDeletes`), plus tabel `password_reset_tokens` dan `sessions`.
  - `database/migrations/0001_01_01_000001_create_cache_table.php` — Tabel cache.
  - `database/migrations/0001_01_01_000002_create_jobs_table.php` — Tabel `jobs`, `job_batches`, `failed_jobs` untuk queue system.
  - `database/migrations/2026_09_05_155446_create_personal_access_tokens_table.php` — Tabel `personal_access_tokens` Sanctum (`tokenable` morph, `name`, `token`, `abilities`, `last_used_at`, `expires_at`).

* **Model Fondasi:**
  - `app/Models/User.php` — Extends `Authenticatable`, uses `HasApiTokens`, `HasFactory`, `Notifiable`. Fillable via PHP attribute: `name`, `email`, `password`, `role`, `nis_nip`, `must_change_password`, `class_id`, `linked_student_id`. Cast `password` → `hashed`. Tidak ada relasi `assignments()` yang terdefinisi eksplisit di model.

* **Provider:**
  - `app/Providers/AppServiceProvider.php` — Kosong (tidak ada custom binding/boot logic).

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. `bootstrap/app.php` mendaftarkan `routes/api.php` sebagai route API, mendaftarkan alias `role` → `RoleMiddleware`, dan menangkap semua exception global lalu me-render JSON standar.
2. Setiap request API melewati middleware `auth:sanctum` (kecuali `/login` & `/ping`), lalu middleware `role:xxx` sesuai group di `routes/api.php`, sebelum masuk ke controller.
3. `RoleMiddleware@handle()` membaca `$request->user()->role` dan membandingkan dengan parameter role yang diterima — menolak 403 jika tidak cocok.
4. `DatabaseSeeder@run()` memanggil insert langsung ke tabel `rooms` dan `subjects`, lalu memanggil `PeriodTemplateSeeder` untuk mengisi `period_templates`.
5. `config/app.php` menetapkan timezone `Asia/Jakarta` yang dipakai oleh seluruh fungsi `now()` dan Carbon di seluruh codebase.

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Logika Konfigurasi Bootstrap (`bootstrap/app.php`):** [Kosongkan untuk saya isi]
> * **Pola Exception Handling & Format JSON Standar:** [Kosongkan untuk saya isi]
> * **Mekanisme Middleware Role — Cara Kerja Parameter Variadic `...$roles`:** [Kosongkan untuk saya isi]
> * **Strategi Seeder — Mengapa data awal dipilih seperti ini:** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**File: `bootstrap/app.php`**
- Bagaimana method `->withRouting()`, `->withMiddleware()`, dan `->withExceptions()` bekerja dalam arsitektur Laravel 13 (dibanding `Kernel.php` di Laravel versi lama)?
- Di dalam `->withExceptions()`, terdapat 5 buah `$exceptions->render()`. Bagaimana Laravel menentukan urutan pencocokan tipe exception yang masuk? Apa yang terjadi jika exception yang masuk bukan salah satu dari 5 tipe tersebut — apakah blok `\Throwable` di akhir menangkapnya?
- PRD Bab 7 mensyaratkan format response error `{ "success": false, "message": "...", "errors": { "field": ["..."] } }`. Bandingkan format ini dengan implementasi aktual di setiap blok `render()` — apakah key `errors` konsisten di semua blok (perhatikan ada blok yang mengirim `'errors' => null`)?
- PRD Bab 7 juga mensyaratkan rate limiting 60 request/menit. Di mana konfigurasi throttle ini diatur? Apakah `'throttle:api'` yang terpasang di middleware API sudah cukup, dan berapa limit default-nya?

**File: `app/Http/Middleware/RoleMiddleware.php`**
- Method `handle()` menerima parameter `...$roles` (variadic). Bagaimana ini bekerja ketika middleware dipanggil sebagai `role:vice_principal` vs `role:teacher,vice_principal`?
- PRD Bab 3 menyebut role `waka`, `guru`, `kesiswaan`, `wali_kelas`, `siswa`, `ortu`. Bandingkan dengan ENUM role aktual di migration users (`vice_principal`, `teacher`, `student`, `parent`). Bagaimana middleware ini menangani perbedaan penamaan tersebut?
- PRD Bab 3 menyebut konsep "assignment" (Kesiswaan/BK, Wali Kelas). Di `routes/api.php`, tidak ada middleware `assignment` yang terdaftar — bagaimana otorisasi berbasis assignment ditegakkan saat ini? (Petunjuk: periksa controller-controller yang mengecek `TeacherAssignment` secara manual.)

**File: `config/app.php`**
- PRD Bab 2 mensyaratkan timezone `Asia/Jakarta`. Verifikasi apakah `'timezone' => 'Asia/Jakarta'` sudah benar diset. Apa implikasinya terhadap fungsi `now()`, `Carbon::today()`, dan `->toDateString()` yang dipakai di seluruh controller?

**File: `database/seeders/DatabaseSeeder.php`**
- PRD Bab 2 menyatakan "Akun Waka pertama dibuat via database seeder saat instalasi awal." Di file ini, blok pembuatan akun Waka (`User::create(...)`) sudah di-comment-out. Apakah ada mekanisme lain untuk membuat akun Waka pertama, atau ini harus di-uncomment?
- Seeder memasukkan 5 `rooms` dan 7 `subjects` langsung via `DB::table()->insert()`. Mengapa tidak menggunakan model Eloquent (`Room::create()` / `Subject::create()`)?

**File: `database/seeders/PeriodTemplateSeeder.php`**
- PRD Bab 5.3 mendefinisikan 5 tipe hari (`senin_upacara` s/d `jumat`) dengan masing-masing memiliki 6-8 period_number. Di seeder ini, setiap day_type hanya memiliki 1 record (period_number 1). Apakah ini berarti period_templates saat ini belum lengkap untuk menjalankan resolusi jam pelajaran pada semua jam?
- Ada typo di baris selasa: `'end_type'` seharusnya `'end_time'`. Apa dampaknya terhadap seeding data?

**File: `database/migrations/0001_01_01_000000_create_users_table.php`**
- PRD Bab 6 menyebutkan field `otp_codes` sebagai tabel terpisah. Apakah migration untuk tabel `otp_codes` sudah ada di codebase? (Cek daftar migration.)
- Kolom `linked_student_id` tidak memiliki `->constrained('users')`. Apakah ini disengaja? Apa risikonya terhadap referential integrity?
- Kolom role menggunakan ENUM `vice_principal/teacher/student/parent` — bandingkan dengan istilah PRD (`waka/guru/siswa/ortu`). Mengapa dipilih istilah bahasa Inggris?

---

## 1. Autentikasi, Profil, Verifikasi Kontak Mandiri & Password Re-confirmation

**(Referensi PRD: Bab 5.2, 5.4, 7, 9.1)**

### A. Daftar File yang Terlibat (File Mapping)

* **Routes:** `routes/api.php`
  - `POST /api/login` — Public, tanpa middleware.
  - `POST /api/logout` — `auth:sanctum`.
  - `GET /api/me` — `auth:sanctum`.
  - **Belum diimplementasikan:** `POST /api/me/email`, `POST /api/me/email/verify`, `POST /api/me/google-link`, `POST /api/me/phone`, `POST /api/me/phone/verify` (PRD 9.1).

* **Controllers:**
  - `app/Http/Controllers/API/AuthController.php` — Method: `login()`, `me()`, `logout()`.

* **Form Requests / Validators:**
  - Validasi dilakukan inline di `AuthController@login()` menggunakan `Validator::make()`.

* **Middlewares:**
  - `auth:sanctum` (bawaan Laravel Sanctum) untuk route terautentikasi.

* **Models & Migrations:**
  - `app/Models/User.php` — Model utama autentikasi, menggunakan trait `HasApiTokens`.
  - `database/migrations/2026_09_05_155446_create_personal_access_tokens_table.php` — Tabel token Sanctum.

* **Password Re-confirmation (PRD 5.4):**
  - Pola re-confirmation (verifikasi `Hash::check($request->password, $user->password)`) diimplementasikan di dalam controller yang membutuhkannya:
    - `academicSettingController@updateMondayStatus()`
    - `ScheduleController@store()`
    - `ScheduleImportController@confirm()`

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. `Route POST /api/login` → `AuthController@login()` → validasi `nis_nip` + `password` via `Validator::make()` → cek kredensial via `Auth::attempt()` → `User::where('nis_nip', ...)->firstOrFail()` → `$user->createToken($device_name)` → return token sebagai string plain text.
2. `Route GET /api/me` → `auth:sanctum` middleware → `AuthController@me()` → `$request->user()` → return data user JSON.
3. `Route POST /api/logout` → `auth:sanctum` middleware → `AuthController@logout()` → `$request->user()->currentAccessToken()->delete()` → return success.

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Logika Login & Pembuatan Token (`AuthController@login()`):** [Kosongkan untuk saya isi]
> * **Mekanisme `must_change_password` — Bagaimana Dipaksa di Client:** [Kosongkan untuk saya isi]
> * **Password Re-confirmation — Pola Umum di Controller yang Sensitif:** [Kosongkan untuk saya isi]
> * **Verifikasi Kontak (Email/Google/Phone) — Status Implementasi:** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**File: `app/Http/Controllers/API/AuthController.php`**
- Method `login()` menggunakan `Auth::attempt($request->only('nis_nip', 'password'))` yang berbasis credential matching bawaan Laravel. Kolom login default Laravel adalah `email` — bagaimana cara agar `nis_nip` bisa dipakai sebagai username? Apakah perlu config khusus atau method `username()` di model?
- Setelah `Auth::attempt()` berhasil, kode kembali melakukan `User::where('nis_nip', ...)->firstOrFail()`. Mengapa query kedua ini diperlukan padahal `Auth::attempt()` sudah memverifikasi kredensial?
- PRD Bab 7 menyebutkan token Sanctum harus memiliki expiry 30 hari. Di `login()`, `$user->createToken($device_name)` dipanggil TANPA parameter `expires_at`. Bandingkan dengan config `sanctum.php` di mana `'expiration' => null`. Apakah token saat ini memiliki masa kadaluarsa?
- PRD Bab 5.2 menyebutkan login harus memaksa ganti password jika `must_change_password` bernilai `true`. Di response `login()`, field `must_change_password` tidak dikembalikan secara eksplisit. Bagaimana client mengetahui bahwa user wajib ganti password?
- PRD 9.1 mendaftarkan 5 endpoint verifikasi kontak (`/me/email`, `/me/email/verify`, `/me/google-link`, `/me/phone`, `/me/phone/verify`). Apakah ada implementasinya di codebase saat ini?

**File: `app/Models/User.php`**
- Model menggunakan PHP Attribute `#[Fillable([...])]` dan `#[Hidden([...])]` (fitur Laravel modern). Field `fet_staff_id`, `google_id`, `phone_number`, `graduation_date` tidak ada di daftar `Fillable`. Apakah ini berarti field-field tersebut tidak bisa diisi via `User::create([])`? (Petunjuk: periksa bagaimana `TeacherController@store()` mengisi `fet_staff_id`.)
- Method `me()` di `AuthController` memanggil `$user->load('assignments')`, namun di model `User.php` tidak ada relasi `assignments()` yang terdefinisi. Apakah ini menyebabkan error saat runtime?

---

## 2. Manajemen Master Data, Auto-Provisioning Akun & Multirole Guru

**(Referensi PRD: Bab 5.1, 5.12, 9.3)**

### A. Daftar File yang Terlibat (File Mapping)

* **Routes:** `routes/api.php`
  - `GET /api/classes` — `role:vice_principal`.
  - `POST /api/classes` — `role:vice_principal`.
  - `DELETE /api/classes/{id}` — `role:vice_principal`.
  - `POST /api/students` — `role:vice_principal`.
  - `POST /api/teachers` — `role:vice_principal`.
  - `POST /api/teachers/{id}/assignments` — `role:vice_principal`.
  - `POST /api/subject` — `role:vice_principal`.
  - **Belum diimplementasikan di routes:** `GET/PUT/DELETE /api/students`, `GET/PUT/DELETE /api/teachers`, `GET/PUT/DELETE /api/rooms`, `GET/PUT/DELETE /api/subjects`, `DELETE /api/teachers/{id}/assignments/{assignmentId}` (PRD 9.3).

* **Controllers:**
  - `app/Http/Controllers/API/SchoolClassController.php` — Method: `index()`, `store()`, `destroy()`.
  - `app/Http/Controllers/API/StudentController.php` — Method: `store()`, `attendanceSummary()`.
  - `app/Http/Controllers/API/TeacherController.php` — Method: `store()`, `assignRole()`.
  - `app/Http/Controllers/API/SubjectController.php` — Method: `store()`.

* **Form Requests / Validators:**
  - Validasi dilakukan inline di setiap controller via `Validator::make()`.

* **Models & Migrations:**
  - `app/Models/SchoolClass.php` — `$table = 'classes'`, uses `SoftDeletes`, fillable: `name`, `level`, `next_class_id`.
  - `app/Models/Classes.php` — Model kosong (kemungkinan duplikat / tidak terpakai).
  - `app/Models/Rooms.php` — Model kosong (tidak ada fillable/relasi).
  - `app/Models/Subject.php` — Fillable: `name`.
  - `app/Models/TeacherAssignment.php` — Fillable: `user_id`, `type`, `class_id`.
  - `database/migrations/2026_09_06_214846_create_classes_table.php` — `name`, `level`, `next_class_id` (FK self nullable), `softDeletes`.
  - `database/migrations/2026_09_06_214911_create_rooms_table.php` — `name`, `capacity`, `softDeletes`.
  - `database/migrations/2026_09_06_215525_create_subjects_table.php` — `name`, `softDeletes`.
  - `database/migrations/2026_09_12_215945_create_teacher_assignments_table.php` — `user_id` (FK users, cascade delete), `type` ENUM (`kesiswaan`, `wali_kelas`), `class_id` (FK classes, nullable).

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. `Route POST /api/students` → `role:vice_principal` → `StudentController@store()` → validasi inline → `DB::transaction()` → `User::create()` (role `student`, password random 8 karakter via `Str::random(8)`) → `User::create()` (role `parent`, `nis_nip` = `"P-"` + NIS, `linked_student_id` = student ID) → return student + password generated.
2. `Route POST /api/teachers` → `role:vice_principal` → `TeacherController@store()` → validasi (name, nip unique, fet_staff_id nullable unique) → `User::create()` (role `teacher`, password random) → return teacher + password.
3. `Route POST /api/teachers/{id}/assignments` → `role:vice_principal` → `TeacherController@assignRole()` → cari User teacher by ID → validasi `type` (kesiswaan/wali_kelas), `class_id` (wajib jika wali_kelas) → `TeacherAssignment::create()`.
4. `Route POST /api/classes` → `role:vice_principal` → `SchoolClassController@store()` → validasi → `SchoolClass::create()`.
5. `Route DELETE /api/classes/{id}` → `SchoolClassController@destroy()` → `SchoolClass::findOrFail($id)->delete()` (soft-delete via trait `SoftDeletes`).

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Auto-Provisioning Akun Siswa + Ortu (`StudentController@store()`):** [Kosongkan untuk saya isi]
> * **Auto-Provisioning Akun Guru (`TeacherController@store()`):** [Kosongkan untuk saya isi]
> * **Multirole Guru via `TeacherAssignment` (`TeacherController@assignRole()`):** [Kosongkan untuk saya isi]
> * **Proteksi Soft-Delete 409 (PRD 5.12) — Status Implementasi:** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**File: `app/Http/Controllers/API/StudentController.php`**
- Method `store()` membungkus pembuatan siswa dan ortu dalam `DB::transaction()`. Apa tujuan transaksi di sini? Apa yang terjadi jika pembuatan akun ortu gagal — apakah akun siswa juga di-rollback?
- PRD 5.1 menyebutkan "Password random 8 karakter, ditampilkan sekali di response". Kode menggunakan `Str::random(8)`. Apakah karakter yang dihasilkan sudah cukup aman (apakah `Str::random()` menghasilkan karakter alfanumerik saja, atau termasuk simbol)?
- Username ortu di-generate sebagai `"P-" . $request->nis`. Dari mana konvensi ini berasal? Apakah PRD menyebutkan format username ortu secara eksplisit?
- PRD 5.1 menyebutkan `must_change_password` dipaksa `true`. Di kode, akun siswa memiliki `'must_change_password' => true`, tapi akun ortu TIDAK memiliki field ini di `User::create()`. Apakah default migration menangani ini?
- PRD 5.12 menyatakan DELETE ditolak 409 jika entitas masih direferensikan schedule aktif. Di `SchoolClassController@destroy()`, pengecekan referensi schedule TIDAK dilakukan — langsung `$schoolClass->delete()`. Apakah proteksi ini belum diimplementasikan?

**File: `app/Http/Controllers/API/TeacherController.php`**
- Method `store()` mengisi `fet_staff_id` via `$request->fet_staff_id`. Namun di model `User.php`, field `fet_staff_id` TIDAK tercantum di `#[Fillable]`. Bagaimana field ini berhasil terisi? (Petunjuk: periksa apakah ada mass-assignment protection yang terlewat atau model menggunakan `$guarded`.)
- Method `assignRole()` membuat `TeacherAssignment` tanpa mengecek apakah assignment sudah ada. Apa yang terjadi jika Waka menugaskan guru yang sama sebagai `kesiswaan` dua kali?

**File: `app/Http/Controllers/API/SchoolClassController.php`**
- Method `store()` menerima `name` dan `level` saja. PRD 6 menyebutkan field `next_class_id` di tabel `classes`. Apakah ada endpoint/mekanisme untuk mengatur `next_class_id` yang dipakai untuk logika kenaikan kelas?
- Method `destroy()` memanggil `$schoolClass->delete()` yang berarti soft-delete (karena model menggunakan `SoftDeletes`). PRD 5.12 mensyaratkan penolakan 409 jika masih direferensikan jadwal aktif — bagaimana ini seharusnya diimplementasikan?

**File: `app/Http/Controllers/API/SubjectController.php`**
- Validasi menggunakan rule `'unique:subject,name'`. Nama tabel yang benar di migration adalah `subjects` (plural). Apakah rule `unique:subject` akan menyebabkan error karena tabel `subject` tidak ada?

**File: `app/Models/TeacherAssignment.php`**
- Model tidak mendefinisikan relasi apapun (`belongsTo User`, `belongsTo SchoolClass`). Apakah relasi ini diperlukan untuk fitur-fitur lain (misalnya `AuthController@me()` yang memanggil `$user->load('assignments')`)?

---

## 3. Pengaturan Akademik, Siklus Putaran & Resolusi Jam Pelajaran Dinamis

**(Referensi PRD: Bab 5.3, 5.5, 9.2)**

### A. Daftar File yang Terlibat (File Mapping)

* **Routes:** `routes/api.php`
  - `PATCH /api/academic-settings/monday-status` — `role:vice_principal`.
  - **Belum diimplementasikan:** `GET /api/academic-settings`, `PATCH /api/academic-settings` (update `active_cycle`), `GET /api/cycle-history` (PRD 9.2).

* **Controllers:**
  - `app/Http/Controllers/API/academicSettingController.php` — Method: `updateMondayStatus()`.

* **Form Requests / Validators:**
  - Validasi inline: `is_upacara` (required boolean), `password` (required string).

* **Models & Migrations:**
  - `database/migrations/2026_09_09_223625_create_system_configurations_table.php` — `active_cycle` (integer, default 1), `monday_is_upacara` (boolean, default true).
  - `database/migrations/2026_09_09_223648_create_cycle_history_table.php` — `cycle_number`, `started_at`, `ended_at` (nullable), `changed_by` (FK users).
  - `database/migrations/2026_09_23_125439_create_period_templates_table.php` — `day_type` ENUM, `period_number`, `start_time`, `end_time`.
  - `app/Models/PeriodTemplate.php` — Model kosong (tidak ada fillable/relasi).
  - Tidak ada model untuk `system_configurations` atau `cycle_history`; diakses via `DB::table()`.

* **Seeders:**
  - `database/seeders/PeriodTemplateSeeder.php` — Data awal `period_templates` (belum lengkap, hanya 4 record masing-masing 1 period).

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. `Route PATCH /api/academic-settings/monday-status` → `role:vice_principal` → `academicSettingController@updateMondayStatus()` → validasi `is_upacara` + `password` → `Hash::check()` password re-confirmation → `DB::table('system_configurations')->where('id', 1)->update(['monday_is_upacara' => ...])` → return success.
2. Resolusi jam pelajaran: terjadi saat dibutuhkan (bukan di endpoint ini), dilakukan oleh controller lain (seperti `AttendanceWarningController`) yang membaca `system_configurations.monday_is_upacara` + `PeriodTemplate::where('day_type', ...)->where('period_number', ...)` untuk menghitung waktu aktual.

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Logika Update Status Upacara (`academicSettingController@updateMondayStatus()`):** [Kosongkan untuk saya isi]
> * **Logika Resolusi `day_type` dari `day_of_week` + `monday_is_upacara`:** [Kosongkan untuk saya isi]
> * **Siklus/Putaran Aktif & Riwayat (`cycle_history`) — Status Implementasi:** [Kosongkan untuk saya isi]
> * **Kelengkapan Data `period_templates` & Dampaknya pada Resolusi Jam:** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**File: `app/Http/Controllers/API/academicSettingController.php`**
- Nama class menggunakan huruf kecil di awal (`academicSettingController`). Apakah ini mengikuti konvensi PSR-4? Apakah autoloading tetap bekerja di Windows vs Linux?
- Method `updateMondayStatus()` mengakses tabel `system_configurations` langsung via `DB::table()` bukan Eloquent model. Mengapa pendekatan ini dipilih? Apa trade-off-nya?
- PRD 5.4 menyebutkan password re-confirmation harus mengembalikan 422 jika password salah. Di kode, `Hash::check()` yang gagal memang mengembalikan 422. Apakah format error-nya sudah sesuai standar PRD Bab 7?
- PRD 9.2 mendefinisikan `GET /api/academic-settings` dan `PATCH /api/academic-settings` untuk mengelola `active_cycle`, serta `GET /api/cycle-history`. Apakah endpoint-endpoint ini sudah ada di codebase?

**File: `database/seeders/PeriodTemplateSeeder.php`**
- PRD 5.3 menyebutkan 5 `day_type` dengan masing-masing 6-8 jam pelajaran. Seeder saat ini hanya memasukkan 4 record (1 record per day_type, hanya period_number 1). `jumat` bahkan tidak ada recordnya. Bagaimana dampaknya jika `AttendanceWarningController` mencari `period_number` > 1 yang belum ada?
- Baris untuk `selasa` memiliki typo: key `'end_type'` alih-alih `'end_time'`. Apakah ini menyebabkan kolom `end_time` bernilai NULL untuk record selasa?

**File: `database/migrations/2026_09_23_125439_create_period_templates_table.php`**
- Kolom `day_type` menggunakan ENUM `senin_upacara/senin_reguler/selasa/rabu_kamis/jumat`. Bagaimana mapping dari `day_of_week` (integer 1-5) ke `day_type` dilakukan? (Petunjuk: cari logika `match()` di `AttendanceWarningController`.)

---

## 4. Manajemen Jadwal Manual Terpusat di Waka & Alert Keterlambatan Jurnal

**(Referensi PRD: Bab 5.4, 5.5, 5.6, 9.4)**

### A. Daftar File yang Terlibat (File Mapping)

* **Routes:** `routes/api.php`
  - `POST /api/schedules` — `role:vice_principal`.
  - **Belum diimplementasikan:** `GET /api/schedules` (listing + filter `?cycle=`, `?day=`, `?status=missing_journal`), `PUT /api/schedules/{id}`, `DELETE /api/schedules/{id}` (PRD 9.4).
  - `GET /api/attendance-warnings` — `role:teacher` (implementasi alert keterlambatan).

* **Controllers:**
  - `app/Http/Controllers/API/ScheduleController.php` — Method: `store()`.
  - `app/Http/Controllers/API/AttendanceWarningController.php` — Method: `index()` (implementasi konsep `missing_journal` dari PRD 5.6, meskipun endpoint-nya berbeda nama).

* **Form Requests / Validators:**
  - Validasi inline di `ScheduleController@store()` via `Validator::make()`.

* **Models & Migrations:**
  - `app/Models/Schedule.php` — Uses `SoftDeletes`. Fillable: `cycle_type`, `period_number`, `duration_periods`, `teacher_id`, `class_id`, `room_id`, `subject_id`, `day_of_week`, `source`. Relasi: `teacher()` → User, `subject()` → Subject, `classRoom()` → SchoolClass.
  - `database/migrations/2026_09_24_074524_create_schedules_table.php` — `teacher_id`, `class_id`, `subject_id`, `room_id` (FK), `day_of_week`, `period_number`, `duration_periods` (default 1), `cycle_type`, `source` ENUM (`manual`, `imported`), `import_bacth_id` (nullable, note: typo `bacth`), `softDeletes`.
  - `database/migrations/2026_10_12_071243_add_indexes_for_performance.php` — Index `[day_of_week, cycle_type]` pada `schedules`.

* **Models pendukung resolusi waktu:**
  - `app/Models/PeriodTemplate.php` — Dipakai di `AttendanceWarningController` untuk resolve waktu akhir.

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. `Route POST /api/schedules` → `role:vice_principal` → `ScheduleController@store()` → validasi (termasuk `password`) → `Hash::check()` re-confirmation → hitung `startPeriod` & `endPeriod` dari `period_number` + `duration_periods` → query bentrok: cek `teacher_id` OR `class_id` OR `room_id` pada rentang period yang overlap di `cycle_type` + `day_of_week` yang sama → jika bentrok 422, jika lolos → `Schedule::create()` → return 201.
2. `Route GET /api/attendance-warnings` → `role:teacher` → `AttendanceWarningController@index()` → tentukan `$dayType` dari `$dayOfWeekIso` + `monday_is_upacara` (via `DB::table('system_configurations')`) → ambil semua `Schedule` hari ini pada `active_cycle` → per schedule, hitung period terakhir (`period_number + duration_periods - 1`), cari `PeriodTemplate` untuk `end_time` → `$endTime + 30 menit < now()` → cek apakah jurnal sudah `completed` atau `teacher_absent` → jika belum, masukkan ke daftar warning.

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Logika Deteksi Bentrok Jadwal (`ScheduleController@store()`):** [Kosongkan untuk saya isi]
> * **Logika Alert Keterlambatan Jurnal (`AttendanceWarningController@index()`):** [Kosongkan untuk saya isi]
> * **Resolusi `day_type` & Perhitungan Deadline 30 Menit:** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**File: `app/Http/Controllers/API/ScheduleController.php`**
- Method `store()` menerima field `source` dari request (`'source' => 'required|in:manual,imported'`). PRD 5.4 menyatakan jadwal manual harus otomatis memiliki `source=manual`. Mengapa client perlu mengirim field `source` — bukankah seharusnya di-hardcode sebagai `manual` di sisi backend?
- Query bentrok menggunakan 3 sub-query `orWhere` untuk `teacher_id`, `class_id`, `room_id`. Perhatikan bahwa ini mengecek ketiga resource secara OR (jika SALAH SATU resource bentrok, jadwal ditolak). Apakah logika ini sesuai PRD 5.4 yang mensyaratkan "validasi anti-bentrok berbasis rentang period_number & duration_periods"?
- Rumus overlap rentang: `period_number <= $endPeriod` AND `(period_number + duration_periods - 1) >= $startPeriod`. Jelaskan mengapa rumus ini benar untuk mendeteksi overlap dua rentang integer.
- PRD 5.4 mensyaratkan `PUT` dan `DELETE /api/schedules/{id}` juga mewajibkan password. Apakah method `update()` dan `destroy()` sudah ada di controller ini?

**File: `app/Http/Controllers/API/AttendanceWarningController.php`**
- Ada 2 controller dengan nama serupa di proyek ini yang mengimplementasikan konsep berbeda. `AttendanceWarningController` di routes `role:teacher` berfungsi sebagai peringatan siswa yang sering alpa (≥3 kali), bukan sebagai alert keterlambatan jurnal (PRD 5.6). Pastikan mana yang mana — karena subagent membaca 2 versi berbeda dari codebase.
- Method `index()` mengecek apakah user adalah Waka, Kesiswaan, atau Wali Kelas sebelum mengembalikan data. Otorisasi ini dilakukan MANUAL di dalam controller, bukan via middleware. Mengapa pendekatan ini dipilih?
- Query menggunakan `havingRaw("count(case when attendances.status = 'Alpa' then 1 end) >= 3")` untuk filter siswa bermasalah. Jelaskan bagaimana `CASE WHEN` di dalam `COUNT` bekerja di PostgreSQL.

---

## 5. Sistem Import Jadwal Otomatis dari 2 PDF FET & Subprocess Python

**(Referensi PRD: Bab 5.16, 9.5)**

### A. Daftar File yang Terlibat (File Mapping)

* **Routes:** `routes/api.php`
  - `POST /api/schedule-imports` — `role:vice_principal`.
  - `GET /api/schedule-imports/{id}` — `role:vice_principal`.
  - `POST /api/schedule-imports/{id}/confirm` — `role:vice_principal`.
  - **Belum diimplementasikan:** `PATCH /api/schedule-imports/{id}/rows/{row_id}` (resolusi manual per baris), `DELETE /api/schedule-imports/{id}` (batal import) (PRD 9.5).

* **Controllers:**
  - `app/Http/Controllers/API/ScheduleImportController.php` — Method: `store()`, `show()`, `confirm()`.

* **Jobs:**
  - `app/Jobs/ParseSchedulePdfJob.php` — Queue job yang dipanggil oleh `ScheduleImportController@store()` setelah upload. Menjalankan Python subprocess, mem-parse output JSON, mencocokkan ke master data, membuat record `ScheduleImportRow`.

* **Python Scripts:**
  - `script/pdf_parser.py` — Script dummy yang menerima 2 argumen (path file kelas & ruangan), menghasilkan JSON hardcoded. Belum melakukan parsing PDF sesungguhnya.

* **Models & Migrations:**
  - `app/Models/ScheduleImport.php` — Fillable: `waka_id`, `cycle_type`, `file_path_kelas`, `file_path_ruangan`, `status`. Relasi: `rows()` → hasMany ScheduleImportRow.
  - `app/Models/ScheduleImportRow.php` — Fillable: `import_id`, `raw_data` (cast array), `matched_class_id`, `matched_teacher_id`, `matched_room_id`, `matched_subject_id`, `day_of_week`, `period_number`, `duration_periods`, `match_status`, `room_source_conflict`, `resolved_by_waka`.
  - `database/migrations/2026_09_24_121547_create_schedule_imports_table.php` — `waka_id` (FK users), `cycle_type`, `file_path_kelas` (nullable setelah migrasi alter), `file_path_ruangan` (nullable), `status` ENUM (`uploaded/parsing/preview_ready/confirmed/faild` — note: typo `faild`), `parser_version`, `created-at` (note: kolom ekstra dengan dash, bukan underscore).
  - `database/migrations/2026_09_24_121632_create_schedule_import_rows_table.php` — `import_id` (FK schedule_imports), `raw_data` JSON, 4 FK nullable matched, `day_of_week`, `period_number`, `duration_periods`, `match_status` ENUM, `room_source_conflict` boolean, `resolved_by_waka` boolean.
  - `database/migrations/2026_10_02_212815_change_column_file_path_kelas_to_nullable_in_a_table.php` — Mengubah `file_path_kelas` menjadi nullable (agar bisa dikosongkan setelah konfirmasi).

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. `Route POST /api/schedule-imports` → `role:vice_principal` → `ScheduleImportController@store()` → validasi (cycle_type, 2 file PDF max 2MB) → simpan file via `$request->file()->store('imports/schedules')` ke disk `local` (private) → `ScheduleImport::create(status: 'uploaded')` → `ParseSchedulePdfJob::dispatch($import->id)` → return 201.
2. **Queue Job:** `ParseSchedulePdfJob@handle()` → `ScheduleImport::find($importId)` → update status `'parsing'` → resolve path fisik file → `new Process(['python', $scriptPath, $fullPathKelas, $fullPathRuangan])` → `$process->run()` → jika gagal, status `'failed'` + log error → jika sukses, parse JSON output → loop per row: cocokkan `mapel_mentah` via `Subject::where('name', 'ILIKE', ...)` dan `guru_mentah` via `User::where('name', 'ILIKE', ...)` → buat `ScheduleImportRow` (class_id & room_id di-hardcode `1`) → update status `'preview_ready'`.
3. `Route GET /api/schedule-imports/{id}` → `ScheduleImportController@show()` → `ScheduleImport::with('rows')->findOrFail($id)` → return import + semua rows.
4. `Route POST /api/schedule-imports/{id}/confirm` → `ScheduleImportController@confirm()` → validasi password → `Hash::check()` re-confirmation → cari import yang `status = 'preview_ready'` → `DB::transaction()`: `Schedule::where('cycle_type', ...)->delete()` (BUKAN soft-delete, menggunakan `delete()` langsung) → loop rows `matched`, `Schedule::create(source: 'imported')` → `Storage::delete()` kedua file PDF → update import status `'confirmed'`, kosongkan path file.

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Alur Upload & Dispatch Job (`ScheduleImportController@store()`):** [Kosongkan untuk saya isi]
> * **Logika Parsing & Matching di Queue Job (`ParseSchedulePdfJob@handle()`):** [Kosongkan untuk saya isi]
> * **Logika Konfirmasi Import & Transaksi Database (`ScheduleImportController@confirm()`):** [Kosongkan untuk saya isi]
> * **Script Python `pdf_parser.py` — Status Implementasi Aktual:** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**File: `app/Http/Controllers/API/ScheduleImportController.php`**
- Method `store()` menyimpan file ke disk `local` via `$request->file()->store('imports/schedules')`. PRD 5.16 menyebut file disimpan ke Supabase Storage. Saat ini menggunakan local filesystem — apakah ini sementara atau final?
- Method `confirm()` menjalankan `Schedule::where('cycle_type', $import->cycle_type)->delete()`. Perhatikan bahwa model `Schedule` menggunakan trait `SoftDeletes`, sehingga `delete()` di sini seharusnya soft-delete. Namun PRD 5.16 poin 7 secara eksplisit menyebut "seluruh schedules existing di-soft-delete (deleted_at diisi)" — apakah behavior `delete()` dengan `SoftDeletes` sudah benar di sini?
- Saat `confirm()`, `Hash::check()` yang gagal mengembalikan `response()->json(['success' => false, 'message' => 'Password Salah.'])` TANPA status code eksplisit (default 200). PRD menyebutkan 422 untuk password salah. Apakah ini bug?
- Method `confirm()` hanya meng-insert rows dengan `match_status === 'matched'`. Bagaimana rows `unmatched` atau `conflict` ditangani? PRD 5.16 poin 6 menyebutkan Waka bisa meresolusi baris unmatched via `PATCH .../rows/{row_id}` — apakah endpoint ini sudah tersedia?

**File: `app/Jobs/ParseSchedulePdfJob.php`**
- Di constructor, trait `Queueable` di-use DUA KALI (`use Queueable;` dan `use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;`). Apakah ini menyebabkan error atau hanya redundan?
- Pencocokan guru dilakukan via `User::where('name', 'ILIKE', '%' . trim($row['guru_mentah']) . '%')`. PRD 5.16 menyebutkan `fet_staff_id` sebagai "kunci pencocokan utama" dan nama sebagai "fallback". Di kode aktual, pencocokan `fet_staff_id` TIDAK dilakukan — langsung fallback ke nama. Mengapa ini signifikan?
- `$classId = 1` dan `$roomId = 1` di-hardcode untuk setiap row. Ini berarti semua jadwal hasil import akan menunjuk ke kelas ID 1 dan ruangan ID 1. Mengapa di-hardcode? Bagaimana seharusnya class dan room dicocokkan dari data parsing?
- `day_of_week`, `period_number`, `duration_periods` juga di-hardcode (`1`, `1`, `1`). Padahal data raw dari parser Python seharusnya menyediakan informasi `hari_mentah` dan `jam_mentah`. Mengapa data ini tidak diproses?

**File: `script/pdf_parser.py`**
- Script ini hanya menghasilkan 1 record dummy hardcoded. Struktur output (`kelas_mentah`, `hari_mentah`, `jam_mentah`, `mapel_mentah`, `guru_mentah`, `ruang_mentah`) menunjukkan format yang diharapkan. Bagaimana Symfony `Process` mengirim path file ke script dan bagaimana script seharusnya membaca/mem-parse file PDF sesungguhnya?

---

## 6. Jurnal Mengajar (KBM), Kompresi Foto & Penanganan Guru Berhalangan

**(Referensi PRD: Bab 5.7, 5.8, 5.11, 9.7)**

### A. Daftar File yang Terlibat (File Mapping)

* **Routes:** `routes/api.php`
  - `POST /api/journals` — `role:teacher` (buka kelas).
  - `POST /api/journals/{id}/complete` — `role:teacher` (selesaikan jurnal + upload foto).
  - `POST /api/journals/{id}/attendance` — `role:teacher` (presensi exception-based).
  - **Belum diimplementasikan:** `GET /api/journals` (listing), `PATCH /api/journals/{id}` (marking teacher_absent oleh Kesiswaan/Waka), `PUT /api/journals/{id}` untuk update jurnal (PRD 9.7).

* **Controllers:**
  - `app/Http/Controllers/API/JournalController.php` — Method: `store()`, `complete()`.
  - `app/Http/Controllers/API/SubstituteAssignmentController.php` — Method: `store()` (penugasan guru pengganti oleh Kesiswaan).

* **Models & Migrations:**
  - `app/Models/Journal.php` — Fillable: `schedule_id`, `date`, `topic_description`, `photo_path`, `status`, `substitute_teacher_id`. Relasi: `schedule()` → Schedule, `substituteTeacher()` → User.
  - `app/Models/SubstituteAssignment.php` — Model dengan `$guarded = ['id']`.
  - `database/migrations/2026_10_02_214810_create_journals_table.php` — `schedule_id` FK, `date`, `topic_description` (nullable), `photo_path` (nullable), `status` ENUM (`ongoing/completed/teacher_absent`), `substitute_teacher_id` FK nullable, unique `[schedule_id, date]`.
  - `database/migrations/2026_10_05_224651_create_substitute_assignments_table.php` — `schedule_id` FK (cascade), `original_teacher_id`, `substitute_teacher_id`, `assigned_by` (FK users), `date`, `reason` nullable, unique `[schedule_id, date]`.

* **Library Pendukung (Kompresi Foto):**
  - Paket `intervention/image` — Digunakan via `Image::decode()` lalu `->scaleDown(width: 1024)` → `->encodeUsingFileExtension('webp', quality: 75)`.
  - `config/intervention-image.php` — Konfigurasi driver Intervention Image.

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. `Route POST /api/journals` → `role:teacher` → `JournalController@store()` → validasi `schedule_id` → `Schedule::findOrFail()` → cek otorisasi (apakah user adalah `teacher_id` jadwal ATAU substitute teacher hari ini via `SubstituteAssignment`) → `Journal::firstOrCreate([schedule_id, date], [status: ongoing])` → return jurnal 201.
2. `Route POST /api/journals/{id}/complete` → `role:teacher` → `JournalController@complete()` → cek otorisasi (teacher atau substitute) → cek status `ongoing` → validasi `topic_description` + `photo` (image max 10MB) → `Image::decode($file)` → `scaleDown(width: 1024)` → `encodeUsingFileExtension('webp', quality: 75)` → `Storage::disk('public')->put()` → `$journal->update([status: 'completed'])`.
3. `Route POST /api/substitute` → `role:teacher` (Kesiswaan via manual check) → `SubstituteAssignmentController@store()` → cek TeacherAssignment `kesiswaan` → validasi → cek substitute ≠ original teacher → `SubstituteAssignment::create()`.

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Logika Buka Kelas & `firstOrCreate` (`JournalController@store()`):** [Kosongkan untuk saya isi]
> * **Kompresi Foto Jurnal (`JournalController@complete()`):** [Kosongkan untuk saya isi]
> * **Mekanisme Guru Pengganti (`SubstituteAssignmentController@store()`):** [Kosongkan untuk saya isi]
> * **Penandaan `teacher_absent` — Status Implementasi:** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**File: `app/Http/Controllers/API/JournalController.php`**
- Method `store()` menggunakan `Journal::firstOrCreate()`. Apa perbedaannya dengan `Journal::create()` biasa? Mengapa ini dipilih — apa yang terjadi jika guru menekan tombol "Buka Kelas" dua kali di hari yang sama?
- Otorisasi dilakukan manual: `$schedule->teacher_id === $userId` atau cek `SubstituteAssignment`. PRD 5.7 menyebutkan bahwa Kesiswaan/BK atau Waka juga bisa menandai `teacher_absent`. Apakah ada method/endpoint terpisah untuk marking `teacher_absent`?
- Method `complete()` menggunakan `Image::decode($file)->scaleDown(width: 1024)->encodeUsingFileExtension('webp', quality: 75)`. PRD 5.11 menyebutkan "Resize lebar maks ~800px, JPEG quality ~30-40%, target <150KB". Bandingkan: lebar aktual 1024 (bukan 800), format WebP (bukan JPEG), quality 75 (bukan 30-40). Apakah perbedaan ini signifikan terhadap ukuran file akhir?
- File foto disimpan ke `Storage::disk('public')` (lokal). PRD menyebutkan Supabase Storage. Bagaimana migrasi storage akan dilakukan?
- Validasi foto: `'photo' => 'required|image|mimes:jpg,jpeg,png,webp|max:10240'` (max 10MB). PRD tidak menyebutkan batas upload mentah, hanya batas setelah kompresi (<150KB). Apakah 10MB terlalu besar untuk upload dari mobile?

**File: `app/Http/Controllers/API/SubstituteAssignmentController.php`**
- Otorisasi Kesiswaan dilakukan via `TeacherAssignment::where('user_id', ...)->where('type', 'kesiswaan')->exists()`. Ini bukan via middleware, melainkan manual check di controller. Mengapa?
- PRD 5.7 menyebut "presensi kelas tersebut tetap wajib diisi oleh Guru dengan assignment terkait kelas tersebut" (Wali Kelas). Di kode, yang menugaskan guru pengganti adalah Kesiswaan (bukan Wali Kelas). Apakah ada ketidaksesuaian dengan PRD?
- Model `SubstituteAssignment` tidak didefinisikan di PRD Bab 6 sebagai tabel terpisah. PRD hanya menyebutkan `journals.substitute_teacher_id`. Mengapa dibuatkan tabel/model terpisah `substitute_assignments`?

---

## 7. Sistem Perizinan (2 Tipe x 2 Kategori), Presensi Exception-Based & Sinkronisasi

**(Referensi PRD: Bab 5.8, 5.9, 5.10, 5.15, 9.6)**

### A. Daftar File yang Terlibat (File Mapping)

* **Routes:** `routes/api.php`
  - `POST /api/permissions` — `role:student`.
  - `POST /api/permissions/{id}/status` — `role:teacher` (Kesiswaan memverifikasi).
  - `POST /api/journals/{id}/attendance` — `role:teacher` (presensi exception-based).
  - `GET /api/students/{id}/attendance/summary` — `role:student`.
  - **Belum diimplementasikan:** `GET /api/leave-requests` (listing auto-scoped), `PATCH /api/leave-requests/{id}` (edit siswa selama pending), `DELETE /api/leave-requests/{id}` (batal), `GET /api/attendances` (rekap auto-scoped) (PRD 9.6).

* **Controllers:**
  - `app/Http/Controllers/API/StudentPermisionController.php` — Method: `store()`, `updateStatus()`.
  - `app/Http/Controllers/API/AttendanceController.php` — Method: `store()` (presensi exception-based dengan sinkronisasi izin).
  - `app/Http/Controllers/API/StudentController.php` — Method: `attendanceSummary()`.

* **Models & Migrations:**
  - `app/Models/StudentPermision.php` — `$guarded = ['id']`. Relasi: `student()` → User.
  - `app/Models/Attendance.php` — `$guarded = ['id']`.
  - `database/migrations/2026_10_04_130006_create_student_permisions_table.php` — `student_id` FK (cascade), `permission_type` ENUM (`sakit/izin/dispen`), `start_date`, `end_date`, `reason`, `attachment_path`, `status` ENUM (`pending/approved/rejected`), `users` FK (nullable, note: nama kolom `users` bukan `approved_by`).
  - `database/migrations/2026_10_02_214821_create_attendances_table.php` — `journal_id` FK, `student_id` FK, `status` ENUM (`Hadir/Sakit/Izin/Alpa`), `date`.
  - `database/migrations/2026_10_12_071243_add_indexes_for_performance.php` — Index `[student_id, date]` pada `attendances`, index `[student_id, status]` pada `student_permisions`.

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. `Route POST /api/permissions` → `role:student` → `StudentPermisionController@store()` → tentukan `student_id` (dari user siswa langsung, atau dari `linked_student_id` jika ortu) → validasi (permission_type, start/end date, reason, attachment image max 5MB) → simpan attachment via `->store('permissions/attachment', 'public')` → `StudentPermision::create(status: 'pending')`.
2. `Route POST /api/permissions/{id}/status` → `role:teacher` → `StudentPermisionController@updateStatus()` → cek manual apakah user punya assignment `kesiswaan` → cek izin masih `pending` → `$permission->update([status, approved_by])`.
3. `Route POST /api/journals/{id}/attendance` → `role:teacher` → `AttendanceController@store()` → cek otorisasi (teacher/substitute pada jurnal) → cek jurnal `ongoing` → validasi `exceptions` array → `DB::transaction()` → ambil izin approved pada tanggal tersebut → loop: otomatis Sakit/Izin dari izin approved → merge manual exceptions → sisanya otomatis `Hadir` → hapus attendance lama → bulk `Attendance::insert()`.
4. `Route GET /api/students/{id}/attendance/summary` → `role:student` → `StudentController@attendanceSummary()` → otorisasi (siswa hanya diri sendiri, ortu hanya `linked_student_id`) → join `attendances` + `journals` → aggregate count per status → hitung persentase kehadiran → return ringkasan.

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Logika Pengajuan Izin (`StudentPermisionController@store()`):** [Kosongkan untuk saya isi]
> * **Logika Verifikasi Izin (`StudentPermisionController@updateStatus()`):** [Kosongkan untuk saya isi]
> * **Logika Presensi Exception-Based & Sinkronisasi Izin (`AttendanceController@store()`):** [Kosongkan untuk saya isi]
> * **Logika Rekap Presensi (`StudentController@attendanceSummary()`):** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**File: `app/Http/Controllers/API/AttendanceController.php`**
- Method `store()` menerima payload `exceptions` (bukan `absent_students` seperti di versi lain). PRD 5.8 menyebut "Guru hanya mengirim siswa yang TIDAK hadir". Apakah format payload `exceptions` sudah sesuai?
- Sinkronisasi izin: kode mengambil `StudentPermision` yang `approved` dan `start_date <= journalDate <= end_date`. PRD 5.9 menyebutkan: hanya izin bertipe `tidak_masuk` yang auto-prefill, sedangkan `keluar_sekolah` tetap Hadir. Di migration, tipe izin yang ada adalah `sakit/izin/dispen` (bukan `tidak_masuk/keluar_sekolah`). Apakah ada ketidaksesuaian antara skema database aktual dan PRD?
- Penentuan status presensi dari izin: `$perm->permission_type === 'sakit'` → `'Sakit'`, lainnya → `'Izin'`. Bagaimana `dispen` ditangani? Apakah `dispen` seharusnya menghasilkan status `Izin` juga?
- Di akhir method, `Attendance::where('journal_id', ...)->delete()` dipanggil sebelum `Attendance::insert()`. Ini berarti presensi lama DIHAPUS sepenuhnya lalu di-insert ulang. Mengapa tidak menggunakan `updateOrCreate` per siswa?

**File: `app/Http/Controllers/API/StudentPermisionController.php`**
- PRD 5.10 menyebutkan 2 tipe (`tidak_masuk`, `keluar_sekolah`) x 2 kategori (`sakit`, `lainnya`). Di codebase, `permission_type` ENUM adalah `sakit/izin/dispen`. Ini berbeda dari skema PRD. Mengapa ada perbedaan, dan apa implikasinya terhadap sinkronisasi presensi?
- PRD 5.10: "Validasi file: jpg/jpeg/png/pdf, maks 2MB." Di kode, validasi `attachment` menggunakan `'image|max:5120'` (hanya image, max 5MB). PDF tidak diterima dan batas ukuran berbeda — apakah ini sesuai PRD?
- Field `approved_by` di `$permission->update()` tidak ada di migration `student_permisions` (migration memiliki kolom `users`, bukan `approved_by`). Apakah ini akan menyebabkan error saat update?

**File: `app/Http/Controllers/API/StudentController.php` — method `attendanceSummary()`**
- PRD 5.15 menyebutkan "auto-scoped berdasarkan role & assignment dari token". Method ini melakukan scoping manual (cek role siswa/ortu). Bagaimana jika Waka atau Guru Kesiswaan ingin melihat ringkasan presensi seorang siswa?
- Query join `attendances` + `journals` dan filter `journals.status = 'completed'`. Mengapa hanya jurnal `completed` yang dihitung? Apa implikasinya jika jurnal masih `ongoing`?

---

## 8. Workflow Evaluasi Kuis AI Asinkron

**(Referensi PRD: Bab 5.14, 9.8)**

### A. Daftar File yang Terlibat (File Mapping)

* **Routes:** `routes/api.php`
  - `POST /api/journals/{id}/quiz/generate` — `role:teacher` (generate kuis dari jurnal).
  - `PATCH /api/quizzes/{id}/publish` — `role:teacher` (publish kuis).
  - `GET /api/quizzes/{id}` — `role:student` (lihat kuis + soal).
  - `POST /api/quizzes/{id}/submit` — `role:student` (submit jawaban).
  - **Belum diimplementasikan:** `GET /api/quizzes` (listing), `POST /api/quizzes` (buat kuis mandiri tanpa journal), `GET/PUT /api/quizzes/{id}/questions[/{questionId}]` (review/edit soal), `GET /api/quizzes/{id}/submissions` (review submission guru), `GET /api/quizzes/{id}/submissions/me` (hasil siswa), `PATCH /api/quiz-submissions/{id}` (override skor guru) (PRD 9.8).

* **Controllers:**
  - `app/Http/Controllers/API/QuizController.php` — Method: `generate()`, `show()`, `publish()`, `submit()`.

* **Jobs:**
  - `app/Jobs/GenerateQuizJob.php` — Queue job: menerima `$journalId`, menjalankan `script/quiz_generator.py` via Symfony Process, mem-parse output JSON, membuat `Quiz` + `QuizQuestion` records.

* **Python Scripts:**
  - `script/quiz_generator.py` — Script dummy yang menerima 1 argumen (topic), menghasilkan 1 soal multiple-choice hardcoded.

* **Models & Migrations:**
  - `app/Models/Quiz.php` — `$guarded = ['id']`. Relasi: `journal()` → Journal, `questions()` → hasMany QuizQuestion.
  - `app/Models/QuizQuestion.php` — `$guarded = ['id']`. Cast: `options` → array.
  - `app/Models/QuizSubmision.php` — `$guarded = ['id']` (note: typo `Submision` tanpa double s).
  - `database/migrations/2026_10_07_184040_create_quizzes_table.php` — `journal_id` FK (cascade), `title`, `status` ENUM (`draft/published`).
  - `database/migrations/2026_10_07_184100_create_quiz_questions_table.php` — `quiz_id` FK (cascade), `question_text`, `options` JSON, `correct_answer`.
  - `database/migrations/2026_10_08_151305_create_quiz_submisions_table.php` — `quiz_id` FK (cascade), `student_id` FK (cascade), `answers` JSON, `score` decimal, unique `[quiz_id, student_id]`.

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. `Route POST /api/journals/{id}/quiz/generate` → `role:teacher` → `QuizController@generate()` → cek otorisasi (teacher/substitute) → cek jurnal punya `topic_description` → `GenerateQuizJob::dispatch($journal->id)` → return 202 Accepted.
2. **Queue Job:** `GenerateQuizJob@handle()` → `Journal::findOrFail($journalId)` → ambil topic → `new Process(['python', quiz_generator.py, $topic])` → run → parse JSON → `Quiz::create([journal_id, title, status: draft])` → loop soal, `QuizQuestion::create([quiz_id, question_text, options, correct_answer])`.
3. `Route PATCH /api/quizzes/{id}/publish` → `role:teacher` → `QuizController@publish()` → cek otorisasi (via journal.schedule.teacher_id) → `$quiz->update([status: 'published'])`.
4. `Route GET /api/quizzes/{id}` → `role:student` → `QuizController@show()` → cek kuis `published` → cek siswa `Hadir` di attendance jurnal terkait → hide `correct_answer` → return kuis + soal.
5. `Route POST /api/quizzes/{id}/submit` → `role:student` → `QuizController@submit()` → cek role student → cek kuis published → cek attendance Hadir → cek belum pernah submit → validasi answers array → hitung skor (bandingkan `selected_option` dengan `correct_answer` per question) → `QuizSubmision::create()` → return skor.

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Logika Generate Kuis Asinkron (`QuizController@generate()` & `GenerateQuizJob`):** [Kosongkan untuk saya isi]
> * **Logika Publish & Akses Kuis (`QuizController@publish()`, `show()`):** [Kosongkan untuk saya isi]
> * **Logika Submit & Perhitungan Skor (`QuizController@submit()`):** [Kosongkan untuk saya isi]
> * **Workflow AI Asinkron vs Koreksi Sinkron — Perbedaan dengan PRD:** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**File: `app/Http/Controllers/API/QuizController.php`**
- Method `generate()` terhubung ke journal (`POST /api/journals/{id}/quiz/generate`). PRD 9.8 mendefinisikan `POST /api/quizzes` sebagai endpoint pembuatan kuis dengan field `due_date` dan `max_attempts`. Di implementasi aktual, kuis dibuat dari konteks jurnal, tanpa `due_date`/`max_attempts`. Apa perbedaan pendekatan ini dari PRD?
- Migration `quizzes` memiliki status ENUM hanya `draft/published`. PRD 5.14 menyebutkan lifecycle lebih kompleks: `generating → draft_review → published → graded → published_result`. Bagaimana lifecycle yang lebih lengkap ini bisa diakomodasi?
- Method `submit()` melakukan koreksi sinkron (langsung menghitung skor di dalam request). PRD 5.14 menyebutkan "koreksi AI asinkron" via queue job (`GradeQuizSubmissionJob`). File `GradeQuizSubmissionJob` TIDAK ditemukan di codebase. Mengapa koreksi dilakukan sinkron?
- Constraint unique `[quiz_id, student_id]` di migration `quiz_submisions` berarti siswa hanya bisa submit 1 kali per kuis. PRD 5.14 menyebutkan `max_attempts` — sistem percobaan ulang belum diimplementasikan?
- Method `show()` mengembalikan status 402 (`return response()->json([...], 402)`) saat kuis belum published. HTTP 402 adalah "Payment Required" — apakah ini status code yang tepat?

**File: `app/Jobs/GenerateQuizJob.php`**
- Constructor menerima `$journalId` (bukan `$quizId`). Saat `handle()`, ia membuat `Quiz::create()` baru. Di `QuizController@generate()`, `Quiz::create()` juga dipanggil sebelum dispatch job. Ini berarti ada 2 kuis yang dibuat — satu di controller, satu di job. Apakah ini duplikasi yang tidak disengaja?
- Script `quiz_generator.py` hanya menghasilkan 1 soal dummy. Jika diintegrasi dengan AI sesungguhnya, parameter apa yang perlu dikirim (misal: jumlah soal, tipe soal, tingkat kesulitan)?

**File: `app/Models/QuizSubmision.php`**
- Nama model `QuizSubmision` (satu `s`), nama tabel `quiz_submisions` (satu `s`). Ini konsisten satu sama lain tapi berbeda dari ejaan umum "submission" (dua `s`). Apakah ini menyebabkan masalah?
- Migration `quiz_submisions` tidak memiliki kolom `attempt_number`, `grading_status`, `ai_score`, `ai_feedback`, `is_overridden`, `overridden_by`, `overridden_at` yang disebutkan PRD Bab 6. Kolom `score` langsung diisi saat submit. Bagaimana ini akan diperluas jika fitur override guru dibutuhkan?

---

## 9. Siklus Kenaikan Kelas & Kelulusan

**(Referensi PRD: Bab 5.13, 9.3)**

### A. Daftar File yang Terlibat (File Mapping)

* **Routes:** `routes/api.php`
  - **Belum diimplementasikan sebagai route terpisah:** `POST /api/students/{id}/hold-back`, `POST /api/class-promotions` (PRD 9.3).

* **Controllers:**
  - **Belum ditemukan:** Tidak ada `ClassPromotionController.php` di codebase aktual (folder `app/Http/Controllers/API/`).

* **Models & Migrations:**
  - `app/Models/SchoolClass.php` — Field `next_class_id` (nullable FK self) yang digunakan untuk menentukan kelas tujuan kenaikan.
  - `app/Models/User.php` — Field `graduation_date` (nullable, date) untuk menandai siswa yang sudah lulus.
  - `database/migrations/0001_01_01_000000_create_users_table.php` — Kolom `graduation_date`.
  - `database/migrations/2026_09_06_214846_create_classes_table.php` — Kolom `next_class_id`.

* **Scheduled Job (terkait):**
  - `routes/console.php` — Job harian pembersihan akun lulusan (lihat Modul 10).

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. **Hold-back:** Waka seharusnya menandai siswa tinggal kelas via `POST /api/students/{id}/hold-back` — belum ada controller/route.
2. **Promosi massal:** `POST /api/class-promotions` seharusnya memindahkan `users.class_id` ke `classes.next_class_id`, dan mengisi `graduation_date` bagi siswa di kelas akhir (`next_class_id = NULL`) — belum ada controller/route.
3. **Hard-delete lulusan:** Dieksekusi oleh scheduled job di `routes/console.php` (14 hari setelah `graduation_date`).

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Logika Kenaikan Kelas via `next_class_id`:** [Kosongkan untuk saya isi]
> * **Logika Kelulusan & `graduation_date`:** [Kosongkan untuk saya isi]
> * **Status Implementasi Fitur Hold-Back & Class Promotion:** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**Konsep Arsitektural:**
- PRD 5.13 mendeskripsikan alur: Waka tandai hold-back → eksekusi kenaikan massal → siswa kelas akhir di-graduasi. Bagaimana seharusnya `ClassPromotionController` didesain? Method apa yang dibutuhkan?
- Field `next_class_id` di model `SchoolClass` adalah FK self-referencing. Jelaskan bagaimana rantai kelas (`X RPL 1 → XI RPL 1 → XII RPL 1 → NULL`) bekerja untuk mendukung promosi otomatis.
- PRD 5.13 menyebutkan "Waka menandai siswa tidak naik via `POST /api/students/{id}/hold-back` SEBELUM `POST /api/class-promotions` dijalankan." Bagaimana penandaan hold-back ini seharusnya bekerja? Apakah cukup dengan menambah kolom boolean `is_held_back` di tabel `users`?
- Saat promosi dijalankan, apa yang terjadi dengan jadwal (`schedules`) yang mereferensikan `class_id` lama? Apakah jadwal perlu di-reset setiap tahun ajaran?

---

## 10. Scheduled Jobs & Background Queue Daemons

**(Referensi PRD: Bab 8)**

### A. Daftar File yang Terlibat (File Mapping)

* **Scheduled Jobs:**
  - `routes/console.php` — Mendefinisikan 1 scheduled command:
    - `Schedule::command('scp:prune-failed-imports')->dailyAt('01:00')` — Membersihkan import jadwal gagal > 7 hari.
  - **Belum diimplementasikan di `routes/console.php`:** Job pembersihan akun lulusan (`graduation_date + 14 hari`), job pembersihan OTP kedaluwarsa (PRD Bab 8).

* **Console Commands:**
  - `app/Console/Commands/PruneFailedImports.php` — Signature: `scp:prune-failed-imports`. Menghapus `ScheduleImport` yang `status = 'failed'` dan `created_at < 7 hari lalu`.

* **Queue Jobs (Background Workers):**
  - `app/Jobs/ParseSchedulePdfJob.php` — Parsing PDF jadwal via Python subprocess (lihat Modul 5).
  - `app/Jobs/GenerateQuizJob.php` — Generate soal kuis via Python subprocess (lihat Modul 8).
  - **Belum diimplementasikan:** `GradeQuizSubmissionJob` (koreksi AI asinkron, PRD 5.14).

* **Migrations (Queue Infrastructure):**
  - `database/migrations/0001_01_01_000002_create_jobs_table.php` — Tabel `jobs`, `job_batches`, `failed_jobs`.

* **Konfigurasi:**
  - `config/queue.php` — Konfigurasi queue driver (database/redis/sync).

### B. Ringkasan Alur Relasi Antar-File (Call Graph Singkat)

1. Laravel Scheduler (via cron `* * * * * php artisan schedule:run`) → membaca `routes/console.php` → menjalankan `scp:prune-failed-imports` setiap hari pukul 01:00 → `PruneFailedImports@handle()` → `ScheduleImport::where('status', 'failed')->where('created_at', '<', now()->subDays(7))->delete()`.
2. Queue Worker (via `php artisan queue:work`) → mengambil job dari tabel `jobs` → menjalankan `ParseSchedulePdfJob` atau `GenerateQuizJob` → interaksi dengan database dan subprocess Python.

### C. Catatan & Penjelasan Logika Kode (Ditulis Manual oleh Developer)

> **[TODO - PENJELASAN LOGIKA OLEH SAYA]**
> * **Logika Pembersihan Import Gagal (`PruneFailedImports@handle()`):** [Kosongkan untuk saya isi]
> * **Pembersihan Akun Lulusan — Status Implementasi:** [Kosongkan untuk saya isi]
> * **Pembersihan OTP Kedaluwarsa — Status Implementasi:** [Kosongkan untuk saya isi]
> * **Arsitektur Queue Worker & Daemon — Cara Menjalankan:** [Kosongkan untuk saya isi]

### D. Daftar Poin untuk Dipelajari dan Dijelaskan Sendiri

**File: `app/Console/Commands/PruneFailedImports.php`**
- Command menggunakan `$signature = 'scp:prune-failed-imports'`. Bagaimana signature ini terhubung dengan `Schedule::command()` di `routes/console.php`?
- Deskripsi memiliki typo: "lebih dari7 hari" (kurang spasi). Apakah ini mempengaruhi fungsionalitas?
- `ScheduleImport::where('status', 'failed')` — note: di migration, ENUM status memiliki typo `faild` (bukan `failed`). Apakah query ini akan menemukan record dengan status `faild`?
- Method `handle()` mengembalikan `SymfonyCommand::SUCCESS`. Mengapa menggunakan constant dari Symfony alih-alih `Command::SUCCESS` bawaan Laravel?

**File: `routes/console.php`**
- PRD Bab 8 mendefinisikan 3 job terjadwal: (1) Hard delete akun lulusan harian, (2) Pembersihan OTP kedaluwarsa harian, (3) Queue worker daemon. Di `console.php` hanya ada 1 scheduled command (`prune-failed-imports`). Apakah 2 job lainnya perlu ditambahkan?
- `Schedule::command('scp:prune-failed-imports')->dailyAt('01:00')` — command ini BUKAN salah satu dari 3 job di PRD Bab 8 (yang menyebutkan pembersihan lulusan dan OTP). Command ini membersihkan import yang gagal. Apakah ini fitur tambahan yang tidak tercantum di PRD?
- Bagaimana cron system di server production dikonfigurasi agar `php artisan schedule:run` berjalan setiap menit?

**File: `app/Jobs/ParseSchedulePdfJob.php` & `app/Jobs/GenerateQuizJob.php`**
- Kedua job ini menggunakan `Symfony\Component\Process\Process` untuk menjalankan script Python. Apa yang terjadi jika Python tidak terinstall di server? Apakah ada error handling yang memadai?
- Kedua job implements `ShouldQueue`. Bagaimana queue driver dikonfigurasi (sync/database/redis)? Jika menggunakan `sync`, apakah job akan berjalan sinkron di dalam request HTTP?

---

## Lampiran: Peta File Lengkap Codebase

```
scp/
├── app/
│   ├── Console/Commands/
│   │   └── PruneFailedImports.php
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── API/
│   │   │   │   ├── academicSettingController.php     → Modul 3
│   │   │   │   ├── AttendanceController.php          → Modul 7
│   │   │   │   ├── AttendanceWarningController.php   → Modul 4
│   │   │   │   ├── AuthController.php                → Modul 1
│   │   │   │   ├── JournalController.php             → Modul 6
│   │   │   │   ├── QuizController.php                → Modul 8
│   │   │   │   ├── ReportController.php              → Modul 6 (tambahan)
│   │   │   │   ├── ScheduleController.php            → Modul 4
│   │   │   │   ├── ScheduleImportController.php      → Modul 5
│   │   │   │   ├── SchoolClassController.php         → Modul 2
│   │   │   │   ├── StudentController.php             → Modul 2, 7
│   │   │   │   ├── StudentPermisionController.php    → Modul 7
│   │   │   │   ├── SubjectController.php             → Modul 2
│   │   │   │   ├── SubstituteAssignmentController.php → Modul 6
│   │   │   │   └── TeacherController.php             → Modul 2
│   │   │   └── Controller.php
│   │   └── Middleware/
│   │       └── RoleMiddleware.php                    → Modul 0
│   ├── Jobs/
│   │   ├── GenerateQuizJob.php                       → Modul 8
│   │   └── ParseSchedulePdfJob.php                   → Modul 5
│   ├── Models/
│   │   ├── Attendance.php                            → Modul 7
│   │   ├── Classes.php                               → (kemungkinan tidak terpakai)
│   │   ├── Journal.php                               → Modul 6
│   │   ├── PeriodTemplate.php                        → Modul 3, 4
│   │   ├── Quiz.php                                  → Modul 8
│   │   ├── QuizQuestion.php                          → Modul 8
│   │   ├── QuizSubmision.php                         → Modul 8
│   │   ├── Rooms.php                                 → Modul 2
│   │   ├── Schedule.php                              → Modul 4, 5
│   │   ├── ScheduleImport.php                        → Modul 5
│   │   ├── ScheduleImportRow.php                     → Modul 5
│   │   ├── SchoolClass.php                           → Modul 2, 9
│   │   ├── StudentPermision.php                      → Modul 7
│   │   ├── Subject.php                               → Modul 2
│   │   ├── SubstituteAssignment.php                  → Modul 6
│   │   ├── TeacherAssignment.php                     → Modul 2
│   │   └── User.php                                  → Modul 0, 1, 2
│   └── Providers/
│       └── AppServiceProvider.php                    → Modul 0
├── bootstrap/
│   └── app.php                                       → Modul 0
├── config/
│   ├── app.php                                       → Modul 0
│   ├── database.php                                  → Modul 0
│   ├── filesystems.php                               → Modul 0
│   ├── intervention-image.php                        → Modul 6
│   ├── queue.php                                     → Modul 10
│   └── sanctum.php                                   → Modul 1
├── database/
│   ├── migrations/
│   │   ├── 0001_01_01_000000_create_users_table.php              → Modul 0
│   │   ├── 0001_01_01_000001_create_cache_table.php              → Modul 0
│   │   ├── 0001_01_01_000002_create_jobs_table.php               → Modul 10
│   │   ├── 2026_09_05_..._create_personal_access_tokens_table.php → Modul 1
│   │   ├── 2026_09_06_..._create_classes_table.php               → Modul 2
│   │   ├── 2026_09_06_..._create_rooms_table.php                 → Modul 2
│   │   ├── 2026_09_06_..._create_subjects_table.php              → Modul 2
│   │   ├── 2026_09_09_..._create_system_configurations_table.php → Modul 3
│   │   ├── 2026_09_09_..._create_cycle_history_table.php         → Modul 3
│   │   ├── 2026_09_12_..._create_teacher_assignments_table.php   → Modul 2
│   │   ├── 2026_09_23_..._create_period_templates_table.php      → Modul 3
│   │   ├── 2026_09_24_..._create_schedules_table.php             → Modul 4
│   │   ├── 2026_09_24_..._create_schedule_imports_table.php      → Modul 5
│   │   ├── 2026_09_24_..._create_schedule_import_rows_table.php  → Modul 5
│   │   ├── 2026_10_02_..._change_column_file_path_kelas...php    → Modul 5
│   │   ├── 2026_10_02_..._create_journals_table.php              → Modul 6
│   │   ├── 2026_10_02_..._create_attendances_table.php           → Modul 7
│   │   ├── 2026_10_04_..._create_student_permisions_table.php    → Modul 7
│   │   ├── 2026_10_05_..._create_substitute_assignments_table.php → Modul 6
│   │   ├── 2026_10_07_..._create_quizzes_table.php               → Modul 8
│   │   ├── 2026_10_07_..._create_quiz_questions_table.php        → Modul 8
│   │   ├── 2026_10_08_..._create_quiz_submisions_table.php       → Modul 8
│   │   └── 2026_10_12_..._add_indexes_for_performance.php        → Modul 4, 7
│   └── seeders/
│       ├── DatabaseSeeder.php                        → Modul 0 
│       └── PeriodTemplateSeeder.php                  → Modul 3
├── routes/
│   ├── api.php                                       → Modul 0-8
│   ├── console.php                                   → Modul 10
│   └── web.php                                       → (tidak relevan)
├── script/
│   ├── pdf_parser.py                                 → Modul 5
│   └── quiz_generator.py                             → Modul 8
└── PRD.md                                            → Referensi utama
```

---

*Dokumen ini di-generate berdasarkan analisis statis (read-only) terhadap codebase SCP dan file `PRD.md` versi 4.4. Terakhir diperbarui: 14 Oktober 2026.*
