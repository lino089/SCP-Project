# Dokumentasi Perkembangan Proyek: Fase 0 (Fondasi, Bug Kritis & Penyelarasan Skema DB)

**Proyek:** School Class Progress (SCP) — Backend REST API  
**Fase:** Fase 0 ()  
**Acuan Spesifikasi:** `MD/PRD.md` (v4.4) & `MD/MASTER_IMPROVEMENT_PLAN.md`  
**Waktu Eksekusi:** 2026-10-20  
**Status Fase:** Selesai (100% Lolos Pengujian)

---

## 1. Ringkasan Perubahan & Tujuan

Fase 0 bertujuan untuk memperkuat fondasi sistem sebelum modul fungsional diimplementasikan pada fase-fase berikutnya. Fokus utama pekerjaan meliputi:
1. **Eliminasi Fatal Runtime Error**: Memperbaiki pemanggilan relasi yang salah pada middleware penugasan multirole (`AssignmentMiddleware`) yang sebelumnya menyebabkan `BadMethodCallException`.
2. **Penyelarasan Data Integrity Kelas**: Memperbaiki typo kolom soft-delete (`delete_at` menjadi `deleted_at`) pada validasi unik kelas, serta standardisasi status response penghapusan kelas dari HTTP 201 menjadi HTTP 200.
3. **Penyelarasan Skema Database Perizinan Siswa (`leave_requests`)**: Mengganti tabel legacy `student_permisions` menjadi tabel resmi `leave_requests` sesuai PRD v4.4 Bagian 5.10 & 6 yang mendukung 2 tipe izin (`tidak_masuk` multi-hari dan `keluar_sekolah` same-day) x 2 kategori (`sakit`, `lainnya`), pemohon siswa/orang tua, dan audit trail verifikasi.
4. **Restrukturisasi Skema Database Kuis AI (`ai_quizzes`, `quiz_questions`, `quiz_submissions`)**: Merestrukturisasi tabel kuis agar terhubung ke guru dan kelas (bukan jurnal mengajar), mendukung jenis soal pilihan ganda & esai bertarget rubrik kata kunci, serta mengizinkan siswa mengerjakan multi-attempt (`['quiz_id', 'student_id', 'attempt_number']`) tanpa terhalang constraint unik lama.
5. **Standardisasi Model Eloquent & Relasi**: Menstandarkan penamaan model singular `Room` berdampingan dengan `Rooms`, serta menambahkan alias relasi `schoolClass(): BelongsTo` pada model `Schedule` untuk interoperabilitas seragam.
6. **Master Data Seeder Period Templates (10 JP) & Konfigurasi Sistem**: Men-generate 10 Jam Pelajaran (JP) lengkap untuk 5 tipe hari (`senin_upacara`, `senin_reguler`, `selasa`, `rabu_kamis`, `jumat`) termasuk penanganan durasi khusus hari Jumat (40 menit per JP), serta mengaktifkan inisialisasi akun Waka Kurikulum pertama dan baris `system_configurations` (id=1).
7. **Keamanan & Rate Limiting API**: Mengonfigurasi rate limiter Sanctum 60 request/menit untuk rute API terautentikasi dan memperbaiki exception handler global agar mendukung response `HttpResponseException`.

---

## 2. Daftar File yang Dibuat atau Diubah

| No | File Path | Status | Fungsi & Tanggung Jawab |
|---|---|---|---|
| 1 | `app/Http/Middleware/AssignmentMiddleware.php` | Diubah | Memperbaiki pemanggilan method relasi `$user->assignments()`, memperbaiki key error dan spasi pesan. |
| 2 | `app/Http/Controllers/API/SchoolClassController.php` | Diubah | Memperbaiki validasi unik `deleted_at` dan status response penghapusan menjadi 200 OK. |
| 3 | `database/migrations/2026_10_20_000001_create_leave_requests_table.php` | Dibuat | Migration tabel `leave_requests` sesuai spesifikasi PRD v4.4 Bagian 5.10 & 6. |
| 4 | `app/Models/LeaveRequest.php` | Dibuat | Model Eloquent untuk perizinan siswa, relasi ke student, applicant, verifier, dan accessor status. |
| 5 | `app/Models/StudentPermision.php` | Diubah | Menandai model lama sebagai `@deprecated` untuk migrasi bertahap. |
| 6 | `app/Models/User.php` | Diubah | Menambahkan relasi `leaveRequests()` dan `appliedLeaveRequests()`. |
| 7 | `database/migrations/2026_10_20_000002_rebuild_quiz_tables.php` | Dibuat | Migration perombakan tabel `ai_quizzes`, `quiz_questions`, dan `quiz_submissions`. |
| 8 | `app/Models/Quiz.php` | Diubah | Menyelaraskan tabel ke `ai_quizzes`, relasi ke `teacher`, `schoolClass`, `questions`, `submissions`. |
| 9 | `app/Models/QuizQuestion.php` | Diubah | Model pertanyaan kuis pilihan ganda dan esai, casting `options` ke array. |
| 10 | `app/Models/QuizSubmission.php` | Dibuat | Model submission pengerjaan kuis siswa dengan multi-attempt, audit trail override guru, dan score. |
| 11 | `app/Models/QuizSubmision.php` | Diubah | Menandai model lama (typo) sebagai `@deprecated` dan mengarahkannya ke tabel `quiz_submissions`. |
| 12 | `app/Models/Schedule.php` | Diubah | Menambahkan alias method relasi `schoolClass(): BelongsTo`. |
| 13 | `app/Models/Rooms.php` | Diubah | Menegaskan atribut `protected $table = 'rooms';`. |
| 14 | `app/Models/Room.php` | Dibuat | Model Eloquent singular `Room` yang merepresentasikan tabel `rooms`. |
| 15 | `database/seeders/PeriodTemplateSeeder.php` | Diubah | Seeder 50 record period template (10 JP x 5 tipe hari) dengan durasi Jumat 40 menit per JP. |
| 16 | `database/seeders/DatabaseSeeder.php` | Diubah | Mengaktifkan pembuatan akun default Waka, record `system_configurations` (id=1), dan panggilan `PeriodTemplateSeeder`. |
| 17 | `app/Providers/AppServiceProvider.php` | Diubah | Mendaftarkan konfigurasi `RateLimiter::for('api', ...)` 60 request/menit dengan response format standar. |
| 18 | `bootstrap/app.php` | Diubah | Menangani `HttpResponseException` secara langsung agar custom response (seperti rate limiter 429) tidak tertimpa menjadi 500. |
| 19 | `routes/api.php` | Diubah | Mengelompokkan seluruh endpoint terautentikasi di bawah middleware `['auth:sanctum', 'throttle:api']`. |
| 20 | `tests/Feature/AssignmentMiddlewareTest.php` | Dibuat | Automated test untuk pengujian hak akses penugasan guru (`assignment:kesiswaan`). |
| 21 | `tests/Feature/SchoolClassTest.php` | Dibuat | Automated test untuk pembuatan, soft-delete (200), re-create nama kelas yang sama, dan proteksi 409 jika terikat jadwal aktif. |
| 22 | `tests/Feature/LeaveRequestSchemaTest.php` | Dibuat | Automated test skema tabel `leave_requests` (tipe tidak_masuk dan keluar_sekolah). |
| 23 | `tests/Feature/QuizSchemaTest.php` | Dibuat | Automated test skema kuis AI multi-attempt (`attempt_number`), soal esai/pilihan ganda, dan proteksi duplicate attempt. |
| 24 | `tests/Unit/ModelStandardizationTest.php` | Dibuat | Unit test verifikasi relasi `schoolClass()` pada Schedule dan tabel `rooms` pada Room/Rooms. |
| 25 | `tests/Feature/SeederTest.php` | Dibuat | Automated test verifikasi seeder akun Waka, konfigurasi sistem id=1, dan 50 record period template. |
| 26 | `tests/Feature/RateLimitingTest.php` | Dibuat | Automated test verifikasi throttle 60 req/min (request ke-61 menerima 429). |

---

## 3. Potongan Kode Penting & Penjelasan Logika

### 3.1 Perbaikan `AssignmentMiddleware.php`
```php
// app/Http/Middleware/AssignmentMiddleware.php
$user = $request->user();

$hasAssignment = $user?->role === 'teacher'
    && $user->assignments()->where('type', $type)->exists();

if (!$hasAssignment) {
    return response()->json([
        'success' => false,
        'message' => 'Akses ditolak, anda tidak memiliki izin.',
        'errors' => [
            'assignment' => ['Membutuhkan penugasan ' . $type . '.']
        ]
    ], 403);
}

return $next($request);
```
*Penjelasan:* Mengganti pemanggilan `$user->teacherAsssignments()` yang salah ketik menjadi relasi resmi `$user->assignments()`, memperbaiki key error menjadi `'assignment'`, dan menambahkan spasi pada pesan kesalahan.

---

### 3.2 Penanganan Soft-Delete & HTTP 200 pada `SchoolClassController.php`
```php
// app/Http/Controllers/API/SchoolClassController.php
$validated = $request->validate([
    'name' => [
        'required',
        'string',
        'max:50',
        Rule::unique('classes', 'name')->whereNull('deleted_at') // Memperbaiki delete_at -> deleted_at
    ],
    'level' => 'required|integer|in:10,11,12'
]);
...
public function destroy($id)
{
    $class = Classes::findOrFail($id);

    if ($class->schedules()->exists()) {
        return response()->json([
            'success' => false,
            'message' => 'Kelas tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
            'errors' => [
                'class' => ['Hapus atau pindahkan jadwal terkait terlebih dahulu.']
            ]
        ], 409);
    }

    $class->delete();

    return response()->json([
        'success' => true,
        'message' => 'Data kelas berhasil dihapus',
        'data' => $class
    ], 200); // Memperbaiki 201 -> 200 OK
}
```
*Penjelasan:* Mengabaikan baris yang sudah di-soft-delete saat memeriksa keunikan nama kelas, serta mengembalikan kode HTTP 200 OK saat entitas berhasil dihapus.

---

### 3.3 Skema Tabel `leave_requests` (PRD v4.4)
```php
// database/migrations/2026_10_20_000001_create_leave_requests_table.php
Schema::create('leave_requests', function (Blueprint $table) {
    $table->id();
    $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
    $table->foreignId('applicant_id')->constrained('users')->cascadeOnDelete();
    $table->enum('type', ['tidak_masuk', 'keluar_sekolah']);
    $table->enum('category', ['sakit', 'lainnya']);
    $table->date('start_date')->nullable();
    $table->date('end_date')->nullable();
    $table->time('departure_time')->nullable();
    $table->time('expected_return_time')->nullable();
    $table->enum('status_approval', ['pending', 'approved', 'rejected'])->default('pending');
    $table->string('document_path')->nullable();
    $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamp('verified_at')->nullable();
    $table->timestamps();

    $table->index(['student_id', 'status_approval']);
    $table->index(['start_date', 'end_date']);
    $table->index('type');
});
```
*Penjelasan:* Memisahkan izin `tidak_masuk` (multi-hari rentang tanggal) dengan izin `keluar_sekolah` (same-day dengan jam keluar/kembali). Mendukung audit trail siapa yang mengajukan (`applicant_id`) dan siapa staf kesiswaan yang memverifikasi (`verified_by`, `verified_at`).

---

### 3.4 Skema Tabel Kuis AI & Multi-Attempt Submissions
```php
// database/migrations/2026_10_20_000002_rebuild_quiz_tables.php
Schema::create('ai_quizzes', function (Blueprint $table) {
    $table->id();
    $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
    $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
    $table->string('title');
    $table->enum('status', ['generating', 'draft_review', 'published', 'published_result'])->default('generating');
    $table->dateTime('due_date');
    $table->integer('max_attempts')->default(1);
    $table->timestamps();
});

Schema::create('quiz_questions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('quiz_id')->constrained('ai_quizzes')->cascadeOnDelete();
    $table->text('question_text');
    $table->json('options')->nullable(); // Nullable untuk soal esai
    $table->text('correct_answer');      // Jawaban opsi / rubrik kata kunci esai
    $table->enum('question_type', ['multiple_choice', 'essay'])->default('multiple_choice');
    $table->timestamps();
});

Schema::create('quiz_submissions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('quiz_id')->constrained('ai_quizzes')->cascadeOnDelete();
    $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
    $table->integer('attempt_number')->default(1);
    $table->json('answers_payload');
    $table->enum('grading_status', ['pending', 'graded'])->default('pending');
    $table->decimal('ai_score', 5, 2)->nullable();
    $table->text('ai_feedback')->nullable();
    $table->boolean('is_overridden')->default(false);
    $table->foreignId('overridden_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamp('overridden_at')->nullable();
    $table->timestamps();

    // Constraint unik multi-attempt
    $table->unique(['quiz_id', 'student_id', 'attempt_number']);
});
```
*Penjelasan:* Kuis berelasi langsung ke guru dan kelas sesuai PRD 5.14. Siswa diizinkan mencoba lebih dari 1 kali sesuai parameter `max_attempts` dengan composite unique key `['quiz_id', 'student_id', 'attempt_number']`.

---

### 3.5 Exception Handler untuk `HttpResponseException` di `bootstrap/app.php`
```php
// bootstrap/app.php
$exceptions->render(function (Throwable $e, Request $request) {
    if (! $request->is('api/*')) {
        return null;
    }

    // Mendukung custom JsonResponse yang dilempar via HttpResponseException (misal: RateLimiter)
    if ($e instanceof \Illuminate\Http\Exceptions\HttpResponseException) {
        return $e->getResponse();
    }

    if ($e instanceof ValidationException) { ... }
    ...
```
*Penjelasan:* Dalam Laravel, callback response custom pada `RateLimiter` melempar `HttpResponseException`. Tanpa penanganan ini, exception handler global menanggapinya sebagai exception tak terduga dan menghasilkan status code 500 alih-alih 429.

---

### 3.6 Konfigurasi Rate Limiter di `AppServiceProvider.php`
```php
// app/Providers/AppServiceProvider.php
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip())->response(function (Request $request, array $headers) {
        return response()->json([
            'success' => false,
            'message' => 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
            'errors' => null,
        ], 429, $headers);
    });
});
```
*Penjelasan:* Membatasi request API Sanctum sebanyak 60 request/menit berdasarkan ID user terautentikasi (atau IP address jika anonim) dan mengembalikan format JSON standar PRD saat kuota terlampaui.

---

## 4. Command yang Dijalankan Beserta Tujuannya

| Command | Tujuan |
|---|---|
| `php artisan test` | Menjalankan seluruh test suite awal untuk memastikan baseline hijau sebelum perubahan. |
| `php artisan migrate` | Mengeksekusi migration `create_leave_requests_table` dan `rebuild_quiz_tables`. |
| `php artisan db:seed` | Menguji pengisian data seeder Waka, konfigurasi sistem, dan 50 record period template. |
| `php artisan tinker --execute="..."` | Memverifikasi jumlah baris database seeder secara real-time via CLI. |
| `php artisan test --filter=AssignmentMiddlewareTest` | Memverifikasi perbaikan bug method di AssignmentMiddleware. |
| `php artisan test --filter=SchoolClassTest` | Menguji soft delete 200 OK dan validasi unik `whereNull('deleted_at')`. |
| `php artisan test --filter=LeaveRequestSchemaTest` | Menguji penyimpanan dan relasi data tabel `leave_requests`. |
| `php artisan test --filter=QuizSchemaTest` | Menguji skema kuis AI multi-attempt dan tipe soal pilihan ganda & esai. |
| `php artisan test --filter=ModelStandardizationTest` | Menguji relasi `schoolClass` pada Schedule dan keselarasan model `Room`. |
| `php artisan test --filter=SeederTest` | Menguji kelengkapan 50 JP period template dan record awal Waka & config. |
| `php artisan test --filter=RateLimitingTest` | Menguji rate limiting 60 req/min (request ke-61 menerima 429). |
| `php artisan test` (final) | Menjalankan full regression test suite (34 test, 175 assertions, 100% lulus). |

---

## 5. Hasil Testing, Kendala & Status Penyelesaian

### 5.1 Hasil Pengujian
Semua 34 skenario pengujian automated test di proyek ini lulus tanpa kegagalan:
```
Tests:    34 passed (175 assertions)
Duration: 2.02s
```
Daftar test case spesifik Fase 0:
- `AssignmentMiddlewareTest`:
  - `test_teacher_without_assignment_is_rejected_with_403_and_correct_format` ➔ PASSED
  - `test_teacher_with_assignment_is_allowed` ➔ PASSED
- `SchoolClassTest`:
  - `test_waka_can_create_class_and_recreate_after_soft_delete` ➔ PASSED
  - `test_delete_class_fails_with_409_if_referenced_by_active_schedule` ➔ PASSED
- `LeaveRequestSchemaTest`:
  - `test_can_create_leave_request_tidak_masuk_and_keluar_sekolah` ➔ PASSED
- `QuizSchemaTest`:
  - `test_quiz_schema_supports_multi_attempts_and_question_types` ➔ PASSED
- `ModelStandardizationTest`:
  - `test_schedule_school_class_and_class_room_relationships` ➔ PASSED
  - `test_room_and_rooms_models_target_rooms_table` ➔ PASSED
- `SeederTest`:
  - `test_database_seeder_initializes_waka_system_config_and_period_templates` ➔ PASSED
- `RateLimitingTest`:
  - `test_authenticated_api_is_rate_limited_to_60_requests_per_minute` ➔ PASSED

### 5.2 Kendala yang Ditemukan & Solusinya
1. **Kendala RateLimiter Response Fallback:**
   - *Masalah:* Saat menguji rate limiting, request ke-61 melempar error status 500 alih-alih 429.
   - *Penyebab:* Laravel melemparkan `HttpResponseException` untuk response custom dari `RateLimiter`. Di `bootstrap/app.php`, blok handler generic menangkapnya sebagai error server tak terduga (500) karena bukan turunan `Symfony\Component\HttpKernel\Exception\HttpException`.
   - *Solusi:* Menambahkan pengecekan `if ($e instanceof \Illuminate\Http\Exceptions\HttpResponseException) { return $e->getResponse(); }` pada baris awal handler exception di `bootstrap/app.php`. Response 429 kini dikembalikan secara akurat.

### 5.3 Status Penyelesaian Tugas Fase 0
- [x] **Tugas 0.1** · Perbaikan Fatal Method Error di `AssignmentMiddleware.php`: **SELESAI**
- [x] **Tugas 0.2** · Perbaikan Bug Soft Delete & Status Code di `SchoolClassController.php`: **SELESAI**
- [x] **Tugas 0.3** · Penyelarasan Skema Database Perizinan Siswa (`leave_requests`): **SELESAI**
- [x] **Tugas 0.4** · Penyelarasan Skema Database Kuis AI (`ai_quizzes`, `quiz_questions`, `quiz_submissions`): **SELESAI**
- [x] **Tugas 0.5** · Standardisasi Penamaan & Relasi Model Eloquent (`Schedule`, `Room`): **SELESAI**
- [x] **Tugas 0.6** · Seeder Period Templates Lengkap (10 JP) & Konfigurasi Sistem: **SELESAI**
- [x] **Tugas 0.7** · Konfigurasi Rate Limiting API (60 req/min) & Expiration Sanctum: **SELESAI**

---

## 6. Kesiapan Menuju Fase 1
Dengan selesainya seluruh tugas pada Fase 0:
- Fondasi database dan integritas model sudah 100% selaras dengan PRD v4.4.
- Tidak ada bug kritis atau runtime exception yang menghambat pengerjaan master data.
- Project siap melangkah ke **Fase 1: Master Data & Manajemen Siklus Akademik** (CRUD Rooms, Subjects, Classes, Teachers, Students, Promosi Kelas, dan Cycle History).


---

# Dokumentasi Perkembangan Proyek: Fase 1 (Master Data & Manajemen Siklus Akademik)

**Proyek:** School Class Progress (SCP) — Backend REST API  
**Fase:** Fase 1 (Master Data & Manajemen Siklus Akademik)  
**Acuan Spesifikasi:** `MD/PRD.md` (v4.4 Bagian 5.1, 5.5, 5.13, 9.2, 9.3) & `MD/MASTER_IMPROVEMENT_PLAN.md`  
**Waktu Eksekusi:** 2026-10-20  
**Status Fase:** Selesai (100% Lolos Pengujian)

---

## 7. Ringkasan Implementasi & Tujuan Fase 1

Fase 1 mengimplementasikan seluruh kebutuhan siklus akademik dan CRUD master data inti sekolah dengan arsitektur RESTful API yang aman, konsisten, dan terintegrasi dengan aturan bisnis pada PRD v4.4:
1. **Penyempurnaan Skema Siswa (`is_held_back`)**: Menambahkan kolom `is_held_back` (boolean, default false) pada tabel `users` untuk memfasilitasi penandaan siswa tinggal kelas sebelum kenaikan kelas massal (PRD 5.13).
2. **Master Data Ruangan (`rooms`)**: Menghadirkan CRUD lengkap untuk master ruangan (`RoomController`) berpaginasi dengan pencarian nama, validasi kapasitas min 1, validasi nama unik mengabaikan data terhapus (`whereNull('deleted_at')`), serta proteksi HTTP 409 Conflict apabila ruangan masih terikat pada jadwal aktif di tabel `schedules`.
3. **Master Data Mata Pelajaran (`subjects`)**: Membangun modul controller `SubjectController` dengan standardisasi soft-delete, dukungan re-create nama mapel yang sama setelah soft-delete, pencarian case-insensitive, dan proteksi HTTP 409 Conflict jika mapel terkait dengan jadwal aktif.
4. **Master Data Kelas & Promosi Massal (`classes`, `class-promotions`)**:
   - Memperbarui `SchoolClassController` untuk mendukung konfigurasi `next_class_id` berelasi self-referencing.
   - Mengimplementasikan endpoint kenaikan kelas dan kelulusan massal akhir tahun ajaran (`POST /api/class-promotions`): mempromosikan siswa ke `next_class_id`, mempertahankan siswa berstatus `is_held_back` dan mereset statusnya, serta menetapkan tanggal kelulusan `graduation_date` bagi siswa kelas 12 (kelas akhir).
5. **Master Data Guru & Penugasan Tambahan (`teachers`, `assignments`)**:
   - CRUD Guru pada tabel `users` (terfilter `role = 'teacher'`) dengan auto-provisioning password acak 8 karakter dan flag `must_change_password = true`.
   - Mendukung pencatatan `fet_staff_id` (kode guru resmi sinkronisasi FET untuk Fase 2).
   - Mengatur penugasan multi-peran (`POST/DELETE /api/teachers/{id}/assignments`) untuk Wali Kelas dan Kesiswaan, dengan validasi satu kelas hanya boleh memiliki satu wali kelas aktif.
   - Proteksi HTTP 409 Conflict saat penghapusan guru yang masih memiliki jadwal mengajar aktif.
6. **Master Data Siswa & Sinkronisasi Akun Wali (`students`, `hold-back`)**:
   - CRUD Siswa pada tabel `users` (terfilter `role = 'student'`), mendukung filter kelas (`?class_id=`) dan pencarian (`?search=`).
   - Auto-provisioning akun orang tua (`role = 'parent'`, username `P-{nis}`, `linked_student_id`) dalam transaksi atomik saat pendaftaran siswa baru.
   - Sinkronisasi otomatis NIS orang tua saat NIS siswa diperbarui.
   - Penghapusan siswa secara otomatis meng-cascade soft-delete ke akun orang tua terkait.
   - Endpoint penandaan tinggal kelas (`POST /api/students/{id}/hold-back`).
7. **Pengaturan Siklus Akademik & Riwayat Putaran (`academic-settings`, `cycle-history`)**:
   - Membaca konfigurasi `active_cycle` (Putaran 1/Putaran 2) dan `monday_is_upacara`.
   - Mengubah putaran aktif (`PATCH /api/academic-settings`) yang mewajibkan konfirmasi password Waka (gagal 422 jika salah), mengakhiri record riwayat sebelumnya (`ended_at`), dan mencatat record baru pada tabel `cycle_history`.
   - Mengubah status upacara bendera Senin (`PATCH /api/academic-settings/monday-status`) dengan konfirmasi password.
   - Menyajikan daftar riwayat putaran berpaginasi (`GET /api/cycle-history`).

---

## 8. Daftar File yang Dibuat atau Diubah pada Fase 1

| No | File Path | Status | Fungsi & Tanggung Jawab |
|---|---|---|---|
| 1 | `database/migrations/2026_10_20_000004_add_is_held_back_to_users_table.php` | Dibuat | Menambahkan kolom boolean `is_held_back` (default false) pada tabel `users`. |
| 2 | `app/Models/User.php` | Diubah | Mendaftarkan atribut `is_held_back` pada `$fillable` dan `$casts`. |
| 3 | `app/Http/Controllers/API/RoomController.php` | Dibuat | Controller CRUD Master Data Ruangan, validasi kapasitas, soft-delete, dan proteksi 409. |
| 4 | `app/Http/Controllers/API/SubjectController.php` | Diubah | Controller CRUD Master Data Mata Pelajaran dengan soft-delete, pencarian, dan proteksi 409. |
| 5 | `app/Http/Controllers/API/SchoolClassController.php` | Diubah | Mendukung `next_class_id` pada update kelas dan transaksi kenaikan kelas massal (`promoteClasses`). |
| 6 | `app/Http/Controllers/API/TeacherController.php` | Diubah | CRUD Guru dengan `fet_staff_id`, auto-password, penugasan tambahan, dan proteksi 409 jadwal aktif. |
| 7 | `app/Http/Controllers/API/StudentController.php` | Diubah | CRUD Siswa, auto-provisioning & sync akun orang tua `P-{nis}`, cascade soft delete, dan endpoint `holdBack`. |
| 8 | `app/Http/Controllers/API/academicSettingController.php` | Diubah | Menampilkan konfigurasi, switch putaran dengan verifikasi password & audit `cycle_history`, dan status upacara. |
| 9 | `routes/api.php` | Diubah | Mendaftarkan seluruh route Fase 1 di bawah otentikasi Sanctum, rate limiter, dan otorisasi role Waka. |
| 10 | `tests/Feature/RoomTest.php` | Dibuat | Automated feature test untuk modul Room (CRUD, search, proteksi 409, otorisasi role). |
| 11 | `tests/Feature/SubjectTest.php` | Dibuat | Automated feature test untuk modul Subject (CRUD, search, unique soft-delete, proteksi 409). |
| 12 | `tests/Feature/TeacherManagementTest.php` | Dibuat | Automated feature test untuk modul Guru & Penugasan (`fet_staff_id`, penugasan, proteksi 409). |
| 13 | `tests/Feature/StudentManagementTest.php` | Dibuat | Automated feature test untuk modul Siswa (CRUD, filter, auto-parent `P-{nis}`, sync, cascade delete, hold-back). |
| 14 | `tests/Feature/ClassPromotionTest.php` | Dibuat | Automated feature test konfigurasi `next_class_id` dan promosi kenaikan kelas/kelulusan massal. |
| 15 | `tests/Feature/AcademicSettingTest.php` | Dibuat | Automated feature test pengaturan akademik, konfirmasi password (422), log riwayat putaran. |

---

## 9. Potongan Kode Penting & Penjelasan Logika

### 9.1 Proteksi Penghapusan Berelasi Aktif (HTTP 409 Conflict)
Setiap entitas master data (`Room`, `Subject`, `Classes`, `User` guru) dicegah dari penghapusan tidak disengaja jika masih dirujuk oleh tabel `schedules`.
```php
// app/Http/Controllers/API/RoomController.php
public function destroy(int $id): JsonResponse
{
    $room = Room::findOrFail($id);

    if ($room->schedules()->exists()) {
        return response()->json([
            'success' => false,
            'message' => 'Ruangan tidak bisa dihapus karena masih digunakan untuk jadwal aktif.',
            'errors' => [
                'room' => ['Hapus atau pindahkan jadwal terkait terlebih dahulu.'],
            ],
        ], 409);
    }

    $room->delete();

    return response()->json([
        'success' => true,
        'message' => 'Data ruangan berhasil dihapus.',
        'data' => $room,
    ], 200);
}
```
*Penjelasan:* Memeriksa eksistensi jadwal aktif via relasi `$room->schedules()->exists()`. Jika ditemukan, controller segera mengembalikan status HTTP 409 Conflict lengkap dengan arahan resolusi bagi pengguna. Pola identik diterapkan pada `SubjectController`, `SchoolClassController`, dan `TeacherController`.

---

### 9.2 Auto-Provisioning & Sinkronisasi Akun Siswa & Orang Tua
```php
// app/Http/Controllers/API/StudentController.php
public function store(Request $request): JsonResponse
{
    $request->validate([
        'name' => 'required|string|max:100',
        'nis' => [
            'required',
            'string',
            'max:50',
            Rule::unique('users', 'nis_nip')->whereNull('deleted_at'),
        ],
        'class_id' => 'required|integer|exists:classes,id',
    ]);

    $result = DB::transaction(function () use ($request) {
        $randomPassword = Str::random(8);

        $student = User::create([
            'name' => $request->name,
            'role' => 'student',
            'nis_nip' => $request->nis,
            'password' => Hash::make($randomPassword),
            'must_change_password' => true,
            'class_id' => $request->class_id,
        ]);

        $parent = User::create([
            'name' => 'Wali dari ' . $request->name,
            'role' => 'parent',
            'nis_nip' => 'P-' . $request->nis,
            'linked_student_id' => $student->id,
            'password' => Hash::make($randomPassword),
            'must_change_password' => true,
        ]);

        return [
            'student' => $student->load('schoolClass'),
            'parent' => $parent,
            'generate_password' => $randomPassword,
        ];
    });

    return response()->json([
        'success' => true,
        'message' => 'Data siswa berhasil ditambahkan.',
        'data' => $result,
    ], 201);
}
```
*Penjelasan:* Dijalankan dalam satu `DB::transaction` atomik. Sistem secara otomatis mencetak akun siswa dan akun orang tua dengan prefix `P-{nis}` serta menautkan relasi `linked_student_id`. Keduanya mendapatkan password awal acak yang sama dan diwajibkan mengganti password pada saat login pertama kali (`must_change_password = true`).

---

### 9.3 Algoritma Promosi Kenaikan Kelas & Kelulusan Massal
```php
// app/Http/Controllers/API/SchoolClassController.php
public function promoteClasses(Request $request): JsonResponse
{
    $result = DB::transaction(function () {
        $students = User::where('role', 'student')->with('schoolClass')->get();

        $promotedCount = 0;
        $heldBackCount = 0;
        $graduatedCount = 0;

        foreach ($students as $student) {
            if ($student->is_held_back) {
                // Siswa tinggal kelas: reset flag untuk tahun ajaran baru, tidak ubah class_id
                $student->update(['is_held_back' => false]);
                $heldBackCount++;
                continue;
            }

            $currentClass = $student->schoolClass;

            if ($currentClass && $currentClass->next_class_id) {
                // Naik ke kelas berikutnya
                $student->update(['class_id' => $currentClass->next_class_id]);
                $promotedCount++;
            } elseif ($currentClass && is_null($currentClass->next_class_id)) {
                // Kelas akhir (kelas 12): kelulusan
                $student->update([
                    'graduation_date' => now()->toDateString(),
                    'class_id' => null,
                ]);
                $graduatedCount++;
            }
        }

        return [
            'total_students' => $students->count(),
            'promoted' => $promotedCount,
            'held_back' => $heldBackCount,
            'graduated' => $graduatedCount,
        ];
    });

    return response()->json([
        'success' => true,
        'message' => 'Proses kenaikan kelas dan kelulusan berhasil diproses.',
        'data' => $result,
    ], 200);
}
```
*Penjelasan:* Sesuai PRD 5.13, proses kenaikan kelas dieksekusi secara massal. Siswa yang ditandai tinggal kelas (`is_held_back = true`) dipertahankan pada kelas yang sama dan flag tinggal kelas direset ke `false`. Siswa yang memiliki `next_class_id` dipindahkan ke kelas tujuan, sedangkan siswa di kelas akhir tanpa tujuan lanjutan otomatis di-set `class_id = null` dan dicatat tanggal kelulusannya (`graduation_date`).

---

### 9.4 Pergantian Putaran Aktif dengan Konfirmasi Password & Log Audit
```php
// app/Http/Controllers/API/academicSettingController.php
public function updateCycle(Request $request): JsonResponse
{
    $request->validate([
        'cycle_type' => 'required|integer|in:1,2',
        'password' => 'required|string',
    ]);

    if ($error = $this->passwordIsConfirmed($request)) {
        return $error;
    }

    $result = DB::transaction(function () use ($request) {
        $config = SystemConfiguration::firstOrFail();
        $config->update(['active_cycle' => $request->cycle_type]);

        // Tutup riwayat putaran sebelumnya jika ada
        CycleHistory::whereNull('ended_at')->update(['ended_at' => now()]);

        // Catat log riwayat putaran baru
        $history = CycleHistory::create([
            'cycle_number' => $request->cycle_type,
            'started_at' => now(),
            'changed_by' => $request->user()->id,
        ]);

        return [
            'active_cycle' => $config->active_cycle,
            'history' => $history,
        ];
    });

    return response()->json([
        'success' => true,
        'message' => 'Putaran aktif berhasil diubah.',
        'data' => $result,
    ], 200);
}
```
*Penjelasan:* Memvalidasi kata sandi akun pemanggil menggunakan helper `$this->passwordIsConfirmed($request)`. Jika verifikasi gagal, langsung mengembalikan HTTP 422 Unprocessable Entity. Jika valid, dalam satu transaksi atomik nilai `active_cycle` diperbarui, log putaran sebelumnya ditutup dengan mengisi `ended_at = now()`, dan baris baru di-insert pada tabel `cycle_history` dengan menyertakan `changed_by`.

---

## 10. Daftar Endpoint API Fase 1

| Method | Endpoint | Hak Akses | Parameter / Body | Deskripsi & Response |
|---|---|---|---|---|
| `GET` | `/api/rooms` | Terautentikasi | Query: `search`, `per_page` | Daftar master ruangan berpaginasi (HTTP 200). |
| `POST` | `/api/rooms` | Waka Kurikulum | Body: `name`, `capacity` | Tambah ruangan baru (HTTP 201). |
| `PUT` | `/api/rooms/{id}` | Waka Kurikulum | Body: `name`, `capacity` | Update ruangan (HTTP 200). |
| `DELETE` | `/api/rooms/{id}` | Waka Kurikulum | Path: `id` | Soft-delete ruangan (HTTP 200), tolak 409 jika terikat jadwal aktif. |
| `GET` | `/api/subjects` | Terautentikasi | Query: `search`, `per_page` | Daftar mata pelajaran berpaginasi (HTTP 200). |
| `POST` | `/api/subjects` | Waka Kurikulum | Body: `name` | Tambah mata pelajaran baru (HTTP 201). |
| `PUT` | `/api/subjects/{id}` | Waka Kurikulum | Body: `name` | Update mata pelajaran (HTTP 200). |
| `DELETE` | `/api/subjects/{id}` | Waka Kurikulum | Path: `id` | Soft-delete mata pelajaran (HTTP 200), tolak 409 jika terikat jadwal. |
| `GET` | `/api/classes` | Terautentikasi | Query: `search`, `per_page` | Daftar kelas lengkap beserta `nextClass` (HTTP 200). |
| `PUT` | `/api/classes/{id}` | Waka Kurikulum | Body: `name`, `level`, `next_class_id` | Update kelas dan mapping kelas tujuan lanjutan (HTTP 200). |
| `POST` | `/api/class-promotions` | Waka Kurikulum | *(None)* | Eksekusi massal kenaikan kelas dan kelulusan (HTTP 200). |
| `GET` | `/api/teachers` | Terautentikasi | Query: `search`, `per_page` | Daftar guru lengkap beserta penugasan tambahannya (HTTP 200). |
| `POST` | `/api/teachers` | Waka Kurikulum | Body: `name`, `nip`/`nis_nip`, `fet_staff_id` | Buat akun guru baru dengan password otomatis (HTTP 201). |
| `PUT` | `/api/teachers/{id}` | Waka Kurikulum | Body: `name`, `nip`, `fet_staff_id` | Update profil guru dan ID sinkronisasi FET (HTTP 200). |
| `DELETE` | `/api/teachers/{id}` | Waka Kurikulum | Path: `id` | Soft-delete guru (HTTP 200), tolak 409 jika terikat jadwal. |
| `POST` | `/api/teachers/{id}/assignments` | Waka Kurikulum | Body: `type` (`kesiswaan`/`wali_kelas`), `class_id` | Berikan tugas tambahan guru (HTTP 201). |
| `DELETE` | `/api/teachers/{id}/assignments/{assignment_id}` | Waka Kurikulum | Path: `id`, `assignment_id` | Cabut penugasan tambahan guru (HTTP 200). |
| `GET` | `/api/students` | Terautentikasi | Query: `search`, `class_id`, `per_page` | Daftar siswa berpaginasi terfilter (HTTP 200). |
| `POST` | `/api/students` | Waka Kurikulum | Body: `name`, `nis`, `class_id` | Daftarkan siswa baru + akun orang tua `P-{nis}` (HTTP 201). |
| `PUT` | `/api/students/{id}` | Waka Kurikulum | Body: `name`, `nis`, `class_id` | Update profil siswa dan sinkronisasi otomatis nama/NIS orang tua (HTTP 200). |
| `DELETE` | `/api/students/{id}` | Waka Kurikulum | Path: `id` | Soft-delete siswa dan akun orang tuanya sekaligus (HTTP 200). |
| `POST` | `/api/students/{id}/hold-back` | Waka Kurikulum | Path: `id` | Tandai siswa tinggal kelas (`is_held_back = true`) (HTTP 200). |
| `GET` | `/api/academic-settings` | Waka Kurikulum | *(None)* | Mengambil data putaran aktif & status upacara (HTTP 200). |
| `PATCH` | `/api/academic-settings` | Waka Kurikulum | Body: `cycle_type` (`1`/`2`), `password` | Ubah putaran aktif dengan verifikasi password (HTTP 200). |
| `PATCH` | `/api/academic-settings/monday-status` | Waka Kurikulum | Body: `is_upacara`, `password` | Ubah status upacara Senin dengan verifikasi password (HTTP 200). |
| `GET` | `/api/cycle-history` | Waka Kurikulum | Query: `per_page` | Daftar riwayat pergantian putaran berpaginasi (HTTP 200). |

---

## 11. Command Terminal yang Dijalankan

| Command | Tujuan & Hasil |
|---|---|
| `php artisan make:migration add_is_held_back_to_users_table --table=users` | Menghasilkan file migration untuk kolom `is_held_back`. |
| `php artisan migrate` | Menjalankan migration skema database baru ke tabel `users`. |
| `php artisan test --filter=RoomTest` | Menjalankan automated test modul Room (7 test lulus, 22 assertions). |
| `php artisan test --filter=SubjectTest` | Menjalankan automated test modul Subject (7 test lulus, 22 assertions). |
| `php artisan test --filter=TeacherManagementTest` | Menjalankan automated test modul Guru & Penugasan (9 test lulus, 31 assertions). |
| `php artisan test --filter=StudentManagementTest` | Menjalankan automated test modul Siswa & Orang Tua (6 test lulus, 27 assertions). |
| `php artisan test --filter=ClassPromotionTest` | Menjalankan automated test Promosi Kelas & Kelulusan (4 test lulus, 12 assertions). |
| `php artisan test --filter=AcademicSettingTest` | Menjalankan automated test Setting Akademik & Putaran (6 test lulus, 22 assertions). |
| `php artisan test` | Menjalankan seluruh test suite proyek: **73 test lulus (311 assertions)** tanpa regresi. |

---

## 12. Hasil Testing, Kendala & Status Penyelesaian

### 12.1 Hasil Pengujian Automated Test
Seluruh modul Fase 1 telah diuji menggunakan PHPUnit / Pest Feature Test pada SQLite in-memory dan database PostgreSQL:
```
Tests:    73 passed (311 assertions)
Duration: 2.67s
```
Rincian modul uji Fase 1:
- `RoomTest`: Pengujian pencarian nama ruangan, penambahan, perubahan, soft delete, proteksi 409 jika terikat jadwal aktif, dan otorisasi role ➔ **LULUS (7 test)**
- `SubjectTest`: Pengujian listing mata pelajaran, pencarian, soft delete, kemampuan reuse nama mapel yang terhapus, proteksi 409 jika terikat jadwal aktif, dan otorisasi role ➔ **LULUS (7 test)**
- `TeacherManagementTest`: Pengujian CRUD profil guru, integrasi `fet_staff_id`, auto-password 8 karakter, penugasan `wali_kelas` dan `kesiswaan`, proteksi 1 kelas 1 wali kelas aktif, pencabutan penugasan, dan proteksi 409 ➔ **LULUS (9 test)**
- `StudentManagementTest`: Pengujian listing siswa dengan filter kelas, auto-provisioning akun orang tua ber-prefix `P-{nis}`, update siswa dengan sinkronisasi orang tua, cascade soft-delete orang tua, dan endpoint penandaan tinggal kelas ➔ **LULUS (6 test)**
- `ClassPromotionTest`: Pengujian konfigurasi relasi `next_class_id`, promosi massal kelas 10 ke 11, proteksi siswa tinggal kelas, dan pencatatan kelulusan kelas 12 ➔ **LULUS (4 test)**
- `AcademicSettingTest`: Pengujian pembacaan setting, pergantian putaran 1/2 dengan verifikasi kata sandi, proteksi kata sandi salah (422), pencatatan otomatis ke `cycle_history`, dan penyesuaian status upacara Senin ➔ **LULUS (6 test)**

### 12.2 Kendala & Solusi Teknis
1. **Pencarian Case-Insensitive Lintas Driver (PostgreSQL vs SQLite In-Memory):**
   - *Masalah:* Operator `ILIKE` yang didukung PostgreSQL tidak didukung oleh driver SQLite yang digunakan PHPUnit saat menjalankan feature test (`near "ILIKE": syntax error`).
   - *Solusi:* Memanfaatkan deteksi dinamis driver database:
     `$like = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';`
     Dengan ini, query pencarian berjalan case-insensitive sempurna baik di environment production (PostgreSQL) maupun pengujian automated (SQLite).
2. **Fleksibilitas Input NIP / NISN pada Controller Guru:**
   - *Masalah:* Controller awal mengharapkan field `'nip'`, sedangkan beberapa frontend/client mungkin mengirimkan `'nis_nip'`.
   - *Solusi:* Menggunakan aturan validasi kondisional `'required_without:nis_nip'` dan fallback `$nip = $request->input('nip') ?? $request->input('nis_nip')` sehingga kompatibel dengan kedua penamaan payload.

### 12.3 Status Penyelesaian Tugas Fase 1
- [x] **Tugas 1.1** · Master Data Ruangan (`RoomController` & Routes): **SELESAI**
- [x] **Tugas 1.2** · Master Data Mata Pelajaran (`SubjectController` & Routes): **SELESAI**
- [x] **Tugas 1.3** · Master Data Kelas, Pemetaan `next_class_id`, dan Promosi Kenaikan Kelas Massal: **SELESAI**
- [x] **Tugas 1.4** · Master Data Guru, Integrasi `fet_staff_id`, dan Manajemen Penugasan Tambahan: **SELESAI**
- [x] **Tugas 1.5** · Master Data Siswa, Auto-Provisioning Orang Tua (`P-{nis}`), Cascade Delete & Hold-Back: **SELESAI**
- [x] **Tugas 1.6** · Pengaturan Siklus Akademik, Pergantian Putaran dengan Password, dan Riwayat Putaran: **SELESAI**

---

## 13. Panduan Testing Endpoint melalui Postman

Panduan berikut dirancang agar developer atau QA dapat menguji seluruh endpoint Fase 1 secara langsung melalui Postman.

### 13.1 Persiapan & Autentikasi (Prerequisites)
- **Base URL:** `http://127.0.0.1:8000/api`
- **Headers Umum:**
  ```http
  Accept: application/json
  Content-Type: application/json
  ```
- **Langkah Mendapatkan Token Waka Kurikulum:**
  1. Method: `POST`
  2. URL: `{{base_url}}/login`
  3. Body raw JSON:
     ```json
     {
       "identifier": "197001011990011001",
       "password": "password"
     }
     ```
  4. Ambil token dari `response.data.token`.
  5. Tambahkan header pada request berikutnya:
     ```http
     Authorization: Bearer <token_waka_anda>
     ```

---

### 13.2 Pengujian Master Data Ruangan (`rooms`)

#### 1. List Ruangan
- **Method:** `GET`
- **URL:** `{{base_url}}/rooms?search=Lab&per_page=10`
- **Headers:** `Accept: application/json`, `Authorization: Bearer {{token}}`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data ruangan berhasil diambil.",
    "data": [
      {
        "id": 1,
        "name": "Lab Komputer 1",
        "capacity": 36,
        "created_at": "2026-10-20T08:00:00.000000Z",
        "updated_at": "2026-10-20T08:00:00.000000Z"
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 10,
      "total": 1,
      "last_page": 1
    }
  }
  ```

#### 2. Tambah Ruangan Baru
- **Method:** `POST`
- **URL:** `{{base_url}}/rooms`
- **Headers:** `Authorization: Bearer {{token_waka}}`, `Content-Type: application/json`
- **Body raw JSON:**
  ```json
  {
    "name": "Lab Jaringan 2",
    "capacity": 36
  }
  ```
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Data ruangan berhasil ditambahkan.",
    "data": {
      "id": 2,
      "name": "Lab Jaringan 2",
      "capacity": 36
    }
  }
  ```
- **Skenario Validasi Gagal (422 Unprocessable Entity):**
  Kirimkan kapasitas `0` atau nama kosong.
  ```json
  {
    "success": false,
    "message": "The capacity field must be at least 1.",
    "errors": {
      "capacity": ["The capacity field must be at least 1."]
    }
  }
  ```

#### 3. Update Ruangan
- **Method:** `PUT`
- **URL:** `{{base_url}}/rooms/2`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "name": "Lab Cloud Computing",
    "capacity": 40
  }
  ```
- **Expected Response (200 OK):** Berisi data ruangan terbarui.

#### 4. Hapus Ruangan (Soft Delete & Proteksi 409)
- **Method:** `DELETE`
- **URL:** `{{base_url}}/rooms/2`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Skenario Sukses (200 OK):** Ruangan belum dipakai di tabel jadwal.
  ```json
  {
    "success": true,
    "message": "Data ruangan berhasil dihapus.",
    "data": { "id": 2, "name": "Lab Cloud Computing" }
  }
  ```
- **Skenario Konflik Terikat Jadwal (409 Conflict):**
  ```json
  {
    "success": false,
    "message": "Ruangan tidak bisa dihapus karena masih digunakan untuk jadwal aktif.",
    "errors": {
      "room": ["Hapus atau pindahkan jadwal terkait terlebih dahulu."]
    }
  }
  ```

---

### 13.3 Pengujian Master Data Mata Pelajaran (`subjects`)

#### 1. List Mata Pelajaran
- **Method:** `GET`
- **URL:** `{{base_url}}/subjects?search=Matematika`
- **Headers:** `Authorization: Bearer {{token}}`
- **Expected Response (200 OK):** Daftar mapel berpaginasi.

#### 2. Tambah Mata Pelajaran
- **Method:** `POST`
- **URL:** `{{base_url}}/subjects`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "name": "Pemrograman Web Lanjut"
  }
  ```
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Data mata pelajaran berhasil ditambahkan.",
    "data": {
      "id": 1,
      "name": "Pemrograman Web Lanjut"
    }
  }
  ```

#### 3. Update Mata Pelajaran
- **Method:** `PUT`
- **URL:** `{{base_url}}/subjects/1`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "name": "Pemrograman Berbasis Objek"
  }
  ```
- **Expected Response (200 OK):** Data mapel berhasil diperbarui.

#### 4. Hapus Mata Pelajaran
- **Method:** `DELETE`
- **URL:** `{{base_url}}/subjects/1`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Expected Response (200 OK / 409 Conflict):**
  Sama seperti ruangan, ditolak HTTP 409 jika terikat jadwal aktif pada Putaran 1/2.

---

### 13.4 Pengujian Master Data Kelas & Promosi Massal (`classes`, `class-promotions`)

#### 1. List Kelas dengan Relasi Next Class
- **Method:** `GET`
- **URL:** `{{base_url}}/classes`
- **Headers:** `Authorization: Bearer {{token}}`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data kelas berhasil diambil.",
    "data": [
      {
        "id": 1,
        "name": "X RPL 1",
        "level": 10,
        "next_class_id": 2,
        "next_class": {
          "id": 2,
          "name": "XI RPL 1",
          "level": 11
        }
      }
    ]
  }
  ```

#### 2. Konfigurasi Pemetaan Kelas Lanjutan
- **Method:** `PUT`
- **URL:** `{{base_url}}/classes/1`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "name": "X RPL 1",
    "level": 10,
    "next_class_id": 2
  }
  ```
- **Expected Response (200 OK):** Data kelas berhasil diperbarui.
- **Skenario Error (422 Unprocessable Entity):** Jika `next_class_id` diisi dengan ID dirinya sendiri (`id = 1`).

#### 3. Eksekusi Kenaikan Kelas & Kelulusan Massal
- **Method:** `POST`
- **URL:** `{{base_url}}/class-promotions`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body:** *(Kosong)*
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Proses kenaikan kelas dan kelulusan berhasil diproses.",
    "data": {
      "total_students": 32,
      "promoted": 30,
      "held_back": 1,
      "graduated": 1
    }
  }
  ```

---

### 13.5 Pengujian Master Data Guru & Penugasan Tambahan (`teachers`, `assignments`)

#### 1. List Guru dengan Penugasan
- **Method:** `GET`
- **URL:** `{{base_url}}/teachers?search=Budi`
- **Headers:** `Authorization: Bearer {{token}}`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data guru berhasil diambil.",
    "data": [
      {
        "id": 3,
        "name": "Budi Santoso, M.Kom",
        "nis_nip": "198001012010011002",
        "fet_staff_id": "BS01",
        "role": "teacher",
        "assignments": [
          {
            "id": 1,
            "user_id": 3,
            "type": "wali_kelas",
            "class_id": 1,
            "school_class": {
              "id": 1,
              "name": "X RPL 1"
            }
          }
        ]
      }
    ]
  }
  ```

#### 2. Tambah Guru Baru (Auto-Provisioning Password)
- **Method:** `POST`
- **URL:** `{{base_url}}/teachers`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "name": "Dewi Sartika, S.Pd",
    "nip": "198802022015032001",
    "fet_staff_id": "DS02"
  }
  ```
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Akun guru berhasil dibuat.",
    "data": {
      "teacher": {
        "id": 5,
        "name": "Dewi Sartika, S.Pd",
        "nis_nip": "198802022015032001",
        "fet_staff_id": "DS02",
        "role": "teacher",
        "must_change_password": true
      },
      "password": "A8bX19zK"
    }
  }
  ```

#### 3. Berikan Tugas Tambahan Guru
- **Method:** `POST`
- **URL:** `{{base_url}}/teachers/5/assignments`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON (Wali Kelas):**
  ```json
  {
    "type": "wali_kelas",
    "class_id": 1
  }
  ```
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Tugas tambahan berhasil diberikan.",
    "data": {
      "id": 2,
      "user_id": 5,
      "type": "wali_kelas",
      "class_id": 1
    }
  }
  ```
- **Skenario Konflik Wali Kelas (422 Unprocessable Entity):**
  Jika kelas 1 sudah memiliki wali kelas guru lain:
  ```json
  {
    "success": false,
    "message": "Kelas ini sudah memiliki wali kelas aktif."
  }
  ```

#### 4. Cabut Tugas Tambahan Guru
- **Method:** `DELETE`
- **URL:** `{{base_url}}/teachers/5/assignments/2`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Penugasan guru berhasil dicabut.",
    "data": null
  }
  ```

---

### 13.6 Pengujian Master Data Siswa & Hold-Back (`students`, `hold-back`)

#### 1. Tambah Siswa Baru (Auto-Provisioning Orang Tua)
- **Method:** `POST`
- **URL:** `{{base_url}}/students`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "name": "Ahmad Fauzi",
    "nis": "24001",
    "class_id": 1
  }
  ```
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Data siswa berhasil ditambahkan.",
    "data": {
      "student": {
        "id": 10,
        "name": "Ahmad Fauzi",
        "role": "student",
        "nis_nip": "24001",
        "class_id": 1
      },
      "parent": {
        "id": 11,
        "name": "Wali dari Ahmad Fauzi",
        "role": "parent",
        "nis_nip": "P-24001",
        "linked_student_id": 10
      },
      "generate_password": "qW83mZ1e"
    }
  }
  ```

#### 2. Tandai Siswa Tinggal Kelas (Hold-Back)
- **Method:** `POST`
- **URL:** `{{base_url}}/students/10/hold-back`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body:** *(Kosong)*
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Siswa berhasil ditandai tinggal kelas.",
    "data": {
      "id": 10,
      "name": "Ahmad Fauzi",
      "is_held_back": true
    }
  }
  ```

#### 3. Hapus Siswa (Cascade Soft Delete ke Orang Tua)
- **Method:** `DELETE`
- **URL:** `{{base_url}}/students/10`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data siswa berhasil dihapus.",
    "data": { "id": 10, "name": "Ahmad Fauzi" }
  }
  ```
  *Verifikasi:* Akun orang tua dengan `id: 11` otomatis ter-soft-delete dari tabel `users`.

---

### 13.7 Pengujian Pengaturan Siklus Akademik (`academic-settings`, `cycle-history`)

#### 1. Ambil Pengaturan Akademik Aktif
- **Method:** `GET`
- **URL:** `{{base_url}}/academic-settings`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Pengaturan akademik berhasil diambil.",
    "data": {
      "id": 1,
      "active_cycle": 1,
      "monday_is_upacara": true
    }
  }
  ```

#### 2. Ganti Putaran Aktif (Switch Cycle)
- **Method:** `PATCH`
- **URL:** `{{base_url}}/academic-settings`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "cycle_type": 2,
    "password": "password"
  }
  ```
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Putaran aktif berhasil diubah.",
    "data": {
      "active_cycle": 2,
      "history": {
        "id": 3,
        "cycle_number": 2,
        "started_at": "2026-10-20T09:00:00.000000Z",
        "changed_by": 1
      }
    }
  }
  ```
- **Skenario Password Salah (422 Unprocessable Entity):**
  ```json
  {
    "success": false,
    "message": "Validasi Gagal",
    "errors": {
      "password": ["Password tidak valid"]
    }
  }
  ```

#### 3. Update Status Upacara Bendera Senin
- **Method:** `PATCH`
- **URL:** `{{base_url}}/academic-settings/monday-status`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "is_upacara": false,
    "password": "password"
  }
  ```
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Status upacara hari senin berhasil diperbarui.",
    "data": {
      "monday_is_upacara": false
    }
  }
  ```

#### 4. Ambil Riwayat Pergantian Putaran
- **Method:** `GET`
- **URL:** `{{base_url}}/cycle-history?per_page=10`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Riwayat pergantian putaran berhasil diambil.",
    "data": [
      {
        "id": 3,
        "cycle_number": 2,
        "started_at": "2026-10-20T09:00:00.000000Z",
        "ended_at": null,
        "changed_by": 1,
        "changed_by_user": {
          "id": 1,
          "name": "Waka Kurikulum",
          "nis_nip": "197001011990011001"
        }
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 10,
      "total": 1,
      "last_page": 1
    }
  }
  ```

---

## 14. Kesiapan Menuju Fase 2

Dengan selesainya seluruh implementasi dan verifikasi Fase 1:
1. **Master Data Siap 100%**: Ruangan, Mata Pelajaran, Kelas, Guru (dengan `fet_staff_id`), dan Siswa sudah siap digunakan sebagai entitas referensi untuk modul jadwal dan import PDF.
2. **Siklus Akademik Terkendali**: Pengaturan putaran mingguan (Putaran 1 & Putaran 2) sudah berfungsi aman dengan konfirmasi kata sandi dan audit riwayat `cycle_history`.
3. **Pengujian Menyeluruh**: Sebanyak **73 automated test** berhasil dilewati dengan tingkat kelulusan 100% tanpa regresi.
4. Project siap sepenuhnya untuk melanjutkan ke **Fase 2: Jadwal Terpusat, Resolusi Jam Dinamis & Konfirmasi Import PDF**.
