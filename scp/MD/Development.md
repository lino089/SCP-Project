# Dokumentasi Perkembangan Proyek: Fase 0 (Fondasi, Bug Kritis & Penyelarasan Skema DB)

**Proyek:** School Class Progress (SCP) — Backend REST API  
**Fase:** Fase 0 (Fondasi, Perbaikan Bug Kritis & Penyelarasan Skema Database)  
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
