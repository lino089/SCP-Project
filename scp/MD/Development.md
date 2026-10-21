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


---

# Dokumentasi Perkembangan Proyek: Fase 2 (Manajemen Jadwal Terpusat & Resolusi Jam Dinamis)

**Proyek:** School Class Progress (SCP) — Backend REST API  
**Fase:** Fase 2 (Manajemen Jadwal Terpusat & Resolusi Jam Dinamis)  
**Acuan Spesifikasi:** `MD/PRD.md` (v4.4 Bagian 5.3, 5.4, 5.6, 5.7, 9.4) & `MD/MASTER_IMPROVEMENT_PLAN.md`  
**Waktu Eksekusi:** 2026-10-20  
**Status Fase:** Selesai (100% Lolos Pengujian)

---

## 15. Ringkasan Implementasi & Tujuan Fase 2

Fase 2 berfokus pada pembangunan domain service resolusi waktu dinamis (*Dynamic Period Resolution*) berbasis template periode 10 JP, pembacaan jadwal ter-scope multi-peran, deteksi dini keterlambatan pengisian jurnal mengajar (*missing journal alert*), serta penguatan mutasi jadwal manual:
1. **Domain Service Resolusi Waktu Dinamis (`PeriodResolutionService`)**:
   - Menerjemahkan representasi abstrak `period_number` dan `duration_periods` menjadi rentang jam literal (`start_time` dan `end_time`) berdasarkan tanggal kalender riil, hari dalam sepekan, dan konfigurasi upacara hari Senin (`monday_is_upacara`).
   - Mendukung perhitungan jam otomatis untuk 5 tipe hari sekolah: `senin_upacara`, `senin_reguler`, `selasa`, `rabu_kamis`, dan `jumat` (durasi khusus 40 menit per JP).
2. **Endpoint Pembacaan Jadwal Ter-Scoping (`GET /api/schedules`)**:
   - Menghadirkan method `index` pada `ScheduleController` yang didaftarkan di bawah `auth:sanctum` dan `throttle:api`.
   - **Otorisasi Berbasis Peran:** Guru dibatasi secara otomatis hanya dapat membaca jadwal mengajarnya sendiri (*read-only*), sedangkan Waka Kurikulum memiliki akses menyeluruh untuk memantau jadwal seluruh guru dan kelas di sekolah.
   - Mendukung filter `?cycle=1|2` (default ke siklus aktif `active_cycle`), filter hari `?day=1..7`, filter kelas `?class_id=`, dan filter guru `?teacher_id=` bagi Waka.
   - Menyertakan data resolusi jam dinamis (`resolved_times`) pada setiap baris jadwal yang dikembalikan ke klien.
3. **Mekanisme Alert Keterlambatan Jurnal (`GET /api/schedules?status=missing_journal`)**:
   - Menghitung jadwal pelajaran hari ini (zona waktu `Asia/Jakarta`) pada putaran aktif.
   - Mengidentifikasi jadwal yang waktu selesainya (hasil resolusi JP) + toleransi 30 menit telah terlewat, namun belum memiliki jurnal dengan status `completed`.
   - **Pengecualian Status Khusus:** Secara otomatis mengecualikan jadwal yang telah ditandai berstatus **`teacher_absent`** (guru berhalangan hadir) sesuai amanat PRD Bagian 5.6 & 5.7.
   - Mendukung scoping otomatis: Guru hanya melihat alert jurnal kelasnya sendiri, sedangkan Waka melihat seluruh jadwal terlambat di sekolah.
4. **Solidifikasi Mutasi Jadwal Manual (`POST`, `PUT`, `DELETE /api/schedules`)**:
   - Memastikan penguncian permanen atribut `source = 'manual'`.
   - Menstandarisasi verifikasi ulang kata sandi akun Waka menggunakan helper `$this->passwordIsConfirmed($request)` dengan response HTTP 422 Unprocessable Entity yang seragam jika salah.
   - Menerapkan *pessimistic locking* (`lockForUpdate`) dalam transaksi database atomik untuk mencegah *race condition* alokasi guru, kelas, dan ruangan.
   - Melindungi integritas jadwal dari tabrakan slot waktu melalui `ScheduleConflictService` (dengan dukungan pengecualian `ignoreId` pada operasi pembaruan `PUT`).

---

## 16. Daftar File yang Dibuat atau Diubah pada Fase 2

| No | File Path | Status | Fungsi & Tanggung Jawab |
|---|---|---|---|
| 1 | `app/Services/PeriodResolutionService.php` | **Dibuat** | Domain service mandiri untuk resolusi tipe hari, jam mulai/selesai aktual per JP, dan evaluasi ambang batas keterlambatan jurnal. |
| 2 | `app/Http/Controllers/API/ScheduleController.php` | **Diubah** | Menginjeksi `PeriodResolutionService`, mengimplementasikan `index` (scoping Guru vs Waka, pagination, filter putaran, alert `missing_journal`), serta menstandarisasi verifikasi password pada mutasi manual. |
| 3 | `routes/api.php` | **Diubah** | Mendaftarkan route `GET /schedules` di bawah middleware `['auth:sanctum', 'throttle:api']`. |
| 4 | `tests/Unit/PeriodResolutionServiceTest.php` | **Dibuat** | Unit test pengujian resolusi jam pelajaran untuk berbagai tipe hari, durasi jam, dan batas toleransi. |
| 5 | `tests/Feature/ScheduleReadAndAlertTest.php` | **Dibuat** | Feature test pengujian endpoint `GET /api/schedules` (scoping Guru vs Waka, filter putaran/hari) dan alert `status=missing_journal`. |

---

## 17. Potongan Kode Penting & Penjelasan Logika

### 17.1 Domain Service Resolusi Jam Dinamis (`PeriodResolutionService.php`)
```php
// app/Services/PeriodResolutionService.php
public function getScheduleTimes(Schedule $schedule, ?Carbon $date = null): array
{
    $date = $date ? $date->copy() : Carbon::now('Asia/Jakarta');
    $dayType = $this->resolveDayType($date);

    if (!$dayType) {
        return ['start_time' => null, 'end_time' => null];
    }

    $startPeriod = (int) $schedule->period_number;
    $duration = (int) ($schedule->duration_periods ?? 1);
    $endPeriod = $startPeriod + $duration - 1;

    $startTemplate = PeriodTemplate::where('day_type', $dayType)
        ->where('period_number', $startPeriod)
        ->first();

    $endTemplate = PeriodTemplate::where('day_type', $dayType)
        ->where('period_number', $endPeriod)
        ->first();

    return [
        'start_time' => $startTemplate?->start_time,
        'end_time' => $endTemplate?->end_time,
    ];
}
```
*Penjelasan:* Mengambil waktu mulai dari JP pertama jadwal (`startPeriod`) dan waktu selesai dari JP terakhir (`endPeriod`). Tipe hari (`dayType`) dievaluasi secara dinamis berdasarkan hari kalender dan nilai `monday_is_upacara` dari konfigurasi sistem.

---

### 17.2 Scoping Otorisasi Multirole Jadwal Guru vs Waka
```php
// app/Http/Controllers/API/ScheduleController.php (method index)
$user = $request->user();
$perPage = $request->integer('per_page', 15);
$activeCycle = (int) (SystemConfiguration::first()?->active_cycle ?? 1);
$cycle = $request->has('cycle') ? $request->integer('cycle') : $activeCycle;

$query = Schedule::query()
    ->where('cycle_type', $cycle)
    ->with([
        'schoolClass:id,name,level',
        'teacher:id,name,nis_nip,fet_staff_id',
        'room:id,name,capacity',
        'subject:id,name',
    ]);

// Scoping: Guru hanya diizinkan melihat jadwal mengajarnya sendiri
if ($user->role === 'teacher') {
    $query->where('teacher_id', $user->id);
} elseif ($user->role === 'vice_principal') {
    if ($request->filled('teacher_id')) {
        $query->where('teacher_id', $request->input('teacher_id'));
    }
}
```
*Penjelasan:* Kueri jadwal secara mutlak membatasi guru pada ID akunnya sendiri (`where('teacher_id', $user->id)`), mencegah guru mengakses atau mengintip jadwal mengajar guru lain. Waka Kurikulum memiliki keleluasaan melihat seluruh jadwal atau memfilter spesifik per guru/kelas.

---

### 17.3 Algoritma Alert Keterlambatan Jurnal (`missing_journal`)
```php
// app/Http/Controllers/API/ScheduleController.php
if ($request->input('status') === 'missing_journal') {
    $now = Carbon::now('Asia/Jakarta');
    $activeCycle = (int) (SystemConfiguration::first()?->active_cycle ?? 1);
    $dayOfWeek = (int) $now->dayOfWeekIso;

    $query = Schedule::query()
        ->where('cycle_type', $activeCycle)
        ->where('day_of_week', $dayOfWeek)
        ->with([
            'schoolClass:id,name,level',
            'teacher:id,name,nis_nip,fet_staff_id',
            'room:id,name,capacity',
            'subject:id,name',
            'journals' => function ($q) use ($now) {
                $q->whereDate('date', $now->toDateString());
            },
        ]);

    ...
    foreach ($candidateSchedules as $schedule) {
        $todayJournal = $schedule->journals->first();

        // 1. Jadwal yang sudah memiliki jurnal berstatus completed dikecualikan
        if ($todayJournal && $todayJournal->status === 'completed') {
            continue;
        }

        // 2. Jadwal dengan status teacher_absent dikecualikan sesuai PRD 5.6 & 5.7
        if ($todayJournal && $todayJournal->status === 'teacher_absent') {
            continue;
        }

        // 3. Cek apakah waktu selesai jadwal + toleransi 30 menit sudah terlewat
        if ($this->periodResolver->isSchedulePastTolerance($schedule, $now)) {
            $times = $this->periodResolver->getScheduleTimes($schedule, $now);
            $deadline = Carbon::parse($now->toDateString() . ' ' . $times['end_time'], 'Asia/Jakarta')->addMinutes(30);

            $scheduleArray = $schedule->toArray();
            $scheduleArray['resolved_times'] = $times;
            $scheduleArray['tolerance_deadline'] = $deadline->toTimeString();
            $scheduleArray['minutes_overdue'] = (int) $now->diffInMinutes($deadline);
            $scheduleArray['journal_status'] = $todayJournal ? $todayJournal->status : 'not_started';

            $missingSchedules[] = $scheduleArray;
        }
    }
}
```
*Penjelasan:* Mengidentifikasi ketidakhadiran jurnal pengajaran secara presisi. Jika jadwal telah memiliki jurnal berstatus `completed`, atau berstatus `teacher_absent` (ketidakhadiran guru yang telah terkonfirmasi), jadwal otomatis dikeluarkan dari daftar alert. Jadwal hanya muncul jika waktu sekarang telah melampaui batas jam selesai + 30 menit toleransi.

---

### 17.4 Proteksi Mutasi Manual dengan Re-Konfirmasi Password & Pessimistic Locking
```php
// app/Http/Controllers/API/ScheduleController.php (method store)
if ($error = $this->passwordIsConfirmed($request)) {
    return $error;
}

$data = collect($validated)->except('password')->all();
$data['duration_periods'] = $data['duration_periods'] ?? 1;
$data['source'] = 'manual'; // Dikunci manual

$schedule = DB::transaction(function () use ($data) {
    $this->lockResources($data); // Pessimistic Lock

    if ($this->conflicts->findConflicts($data)->isNotEmpty()) {
        return null;
    }

    return Schedule::create($data);
});
```
*Penjelasan:* Seluruh aksi sensitif penambahan, perubahan, dan penghapusan jadwal manual mewajibkan kata sandi Waka pada request body. Transaksi database mengunci baris guru, kelas, dan ruangan terkait sebelum mengevaluasi tumpang tindih waktu via `ScheduleConflictService`.

---

## 18. Daftar Endpoint API Fase 2

| Method | Endpoint | Hak Akses | Parameter / Body | Deskripsi & Response |
|---|---|---|---|---|
| `GET` | `/api/schedules` | Terautentikasi (Guru & Waka) | Query: `cycle`, `day`, `class_id`, `teacher_id`, `per_page` | Daftar jadwal berpaginasi dengan resolusi jam dinamis. Guru hanya melihat jadwalnya sendiri (HTTP 200). |
| `GET` | `/api/schedules?status=missing_journal` | Terautentikasi (Guru & Waka) | Query: `status=missing_journal`, `teacher_id`, `class_id` | Daftar jadwal hari ini yang terlambat diisi jurnal (> 30 mnt), mengecualikan `teacher_absent` (HTTP 200). |
| `POST` | `/api/schedules` | Waka Kurikulum | Body: `cycle_type`, `day_of_week`, `period_number`, `duration_periods`, `teacher_id`, `class_id`, `room_id`, `subject_id`, `password` | Tambah jadwal manual baru dengan proteksi password dan anti-bentrok (HTTP 201). |
| `PUT` | `/api/schedules/{id}` | Waka Kurikulum | Body: *(Parameter jadwal yang diubah)* + `password` | Ubah data jadwal manual dengan validasi anti-bentrok mengabaikan ID dirinya sendiri (HTTP 200). |
| `DELETE` | `/api/schedules/{id}` | Waka Kurikulum | Body: `password` | Soft-delete jadwal pelajaran dengan konfirmasi password Waka (HTTP 200). |

---

## 19. Command Terminal yang Dijalankan pada Fase 2

| Command | Tujuan & Hasil |
|---|---|
| `php artisan test --filter=PeriodResolutionServiceTest` | Menjalankan unit test domain service resolusi jam dinamis (**5 test lulus, 17 assertions**). |
| `php artisan test --filter=ScheduleTest` | Memverifikasi seluruh pengujian mutasi jadwal lama tetap berfungsi (**9 test lulus, 27 assertions**). |
| `php artisan test --filter=ScheduleReadAndAlertTest` | Menjalankan feature test pembacaan jadwal ter-scope dan alert `missing_journal` (**8 test lulus, 50 assertions**). |
| `php artisan test` | Menjalankan seluruh test suite proyek: **86 test lulus (378 assertions)** tanpa satu pun kegagalan/regresi. |

---

## 20. Hasil Testing, Kendala & Status Penyelesaian

### 20.1 Hasil Pengujian Automated Test
Seluruh pengujian Fase 2 telah berjalan sukses dengan hasil 100% lulus:
```
Tests:    86 passed (378 assertions)
Duration: 3.75s
```
Rincian modul uji Fase 2:
- `PeriodResolutionServiceTest`:
  - `test_resolve_day_type_monday_upacara_vs_reguler` ➔ **PASSED**
  - `test_resolve_day_type_other_weekdays_and_weekend` ➔ **PASSED**
  - `test_get_schedule_times_for_single_and_multi_period` ➔ **PASSED**
  - `test_get_schedule_times_for_friday_short_periods` ➔ **PASSED**
  - `test_is_schedule_past_tolerance_threshold` ➔ **PASSED**
- `ScheduleReadAndAlertTest`:
  - `test_teacher_can_only_read_their_own_schedules` ➔ **PASSED**
  - `test_waka_can_read_all_schedules_and_filter_by_teacher_and_class` ➔ **PASSED**
  - `test_schedule_filter_by_day_and_cycle` ➔ **PASSED**
  - `test_missing_journal_alert_detects_overdue_schedule_without_journal` ➔ **PASSED**
  - `test_missing_journal_alert_ignores_schedule_within_grace_period` ➔ **PASSED**
  - `test_missing_journal_alert_ignores_completed_journal` ➔ **PASSED**
  - `test_missing_journal_alert_excludes_teacher_absent_status` ➔ **PASSED**
  - `test_missing_journal_alert_is_scoped_for_teacher` ➔ **PASSED**
- `ScheduleTest`:
  - 9 pengujian mutasi jadwal (`store`, `update`, `destroy`, deteksi bentrok, dan validasi password) ➔ **PASSED**

### 20.2 Kendala yang Ditemukan & Solusinya
1. **Pengecekan Ambang Batas Waktu Keterlambatan Tepat di Menit ke-30:**
   - *Masalah:* Saat pengujian alert, pengujian waktu yang disetel tepat pada menit tenggat toleransi (`10:00:00` pada jadwal JP 2 yang selesai `09:30:00`) belum dianggap terlambat karena operator evaluasi adalah `$now->greaterThan($deadline)` (ketat lebih besar).
   - *Solusi:* Menyelaraskan skenario pengujian dengan waktu riil yang telah melewati menit toleransi (`10:05:00`). Dengan demikian, toleransi 30 menit terpenuhi secara akurat dan tidak menimbulkan alarm palsu (*false positive*) pada menit pas toleransi.

### 20.3 Status Penyelesaian Tugas Fase 2
- [x] **Tugas 2.1** · Domain Service Resolusi Jam Dinamis (`PeriodResolutionService`): **SELESAI**
- [x] **Tugas 2.2** · Endpoint Pembacaan Jadwal & Alert Keterlambatan Jurnal (`GET /api/schedules`): **SELESAI**
- [x] **Tugas 2.3** · Mutasi Jadwal Manual dengan Proteksi Password Re-confirmation (`POST, PUT, DELETE /api/schedules`): **SELESAI**

---

## 21. Panduan Testing Endpoint melalui Postman (Fase 2)

### 21.1 Persiapan & Autentikasi (Prerequisites)
- **Base URL:** `http://127.0.0.1:8000/api`
- **Headers Wajib:**
  ```http
  Accept: application/json
  Content-Type: application/json
  ```
- **Login Waka Kurikulum:**
  - `POST {{base_url}}/login`
  - Body: `{ "identifier": "197001011990011001", "password": "password" }`
  - Simpan token sebagai `{{token_waka}}`.
- **Login Guru:**
  - `POST {{base_url}}/login`
  - Body: `{ "identifier": "198001012010011001", "password": "password" }`
  - Simpan token sebagai `{{token_guru}}`.

---

### 21.2 Pengujian `GET /api/schedules` (Listing Jadwal Reguler)

#### 1. Pembacaan Jadwal oleh Guru (Auto-Scoped)
- **Method:** `GET`
- **URL:** `{{base_url}}/schedules?cycle=1`
- **Headers:** `Authorization: Bearer {{token_guru}}`
- **Query Parameters:**
  - `cycle`: `1` (opsional, integer)
  - `day`: `1` (opsional, integer 1-7)
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data jadwal berhasil diambil.",
    "data": [
      {
        "id": 1,
        "teacher_id": 3,
        "class_id": 1,
        "room_id": 1,
        "subject_id": 1,
        "day_of_week": 1,
        "period_number": 1,
        "duration_periods": 2,
        "cycle_type": 1,
        "source": "manual",
        "resolved_times": {
          "start_time": "08:00:00",
          "end_time": "09:30:00"
        },
        "school_class": {
          "id": 1,
          "name": "X RPL 1",
          "level": 10
        },
        "teacher": {
          "id": 3,
          "name": "Budi Santoso, M.Kom",
          "nis_nip": "198001012010011001",
          "fet_staff_id": "BS01"
        },
        "room": {
          "id": 1,
          "name": "Lab Komputer 1",
          "capacity": 36
        },
        "subject": {
          "id": 1,
          "name": "Pemrograman Dasar"
        }
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 15,
      "total": 1,
      "last_page": 1,
      "cycle": 1
    }
  }
  ```

#### 2. Pembacaan Jadwal oleh Waka Kurikulum (Seluruh Sekolah & Filter Guru)
- **Method:** `GET`
- **URL:** `{{base_url}}/schedules?cycle=1&teacher_id=3&day=1`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Expected Response (200 OK):** Menampilkan jadwal seluruh sekolah yang sesuai dengan kriteria filter.

---

### 21.3 Pengujian `GET /api/schedules?status=missing_journal` (Alert Keterlambatan Jurnal)

- **Method:** `GET`
- **URL:** `{{base_url}}/schedules?status=missing_journal`
- **Headers:** `Authorization: Bearer {{token_waka}}` *(atau `{{token_guru}}`)*
- **Body:** *(Kosong)*
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data alert jadwal tanpa jurnal berhasil diambil.",
    "data": [
      {
        "id": 1,
        "teacher_id": 3,
        "class_id": 1,
        "room_id": 1,
        "subject_id": 1,
        "day_of_week": 1,
        "period_number": 1,
        "duration_periods": 2,
        "cycle_type": 1,
        "source": "manual",
        "resolved_times": {
          "start_time": "08:00:00",
          "end_time": "09:30:00"
        },
        "tolerance_deadline": "10:00:00",
        "minutes_overdue": 25,
        "journal_status": "not_started",
        "school_class": { "id": 1, "name": "X RPL 1" },
        "teacher": { "id": 3, "name": "Budi Santoso, M.Kom" },
        "room": { "id": 1, "name": "Lab Komputer 1" },
        "subject": { "id": 1, "name": "Pemrograman Dasar" }
      }
    ],
    "meta": {
      "date": "2026-10-20",
      "active_cycle": 1,
      "day_of_week": 2,
      "total_missing": 1
    }
  }
  ```
- **Skenario Pengujian Penting:**
  1. **Dalam Grace Period (Waktu sekarang < Jam Selesai + 30 Menit):** Jadwal **tidak muncul** pada array `data`.
  2. **Jurnal Sudah Completed:** Jadwal **tidak muncul** pada array `data`.
  3. **Jurnal Berstatus `teacher_absent`:** Jadwal **tidak muncul** pada array `data` (dikecualikan sesuai PRD 5.6 & 5.7).
  4. **Akses Guru:** Guru hanya melihat jadwal kelasnya sendiri yang terlambat diisi.

---

### 21.4 Pengujian `POST /api/schedules` (Mutasi Jadwal Manual)

- **Method:** `POST`
- **URL:** `{{base_url}}/schedules`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "cycle_type": 1,
    "day_of_week": 1,
    "period_number": 1,
    "duration_periods": 2,
    "teacher_id": 3,
    "class_id": 1,
    "room_id": 1,
    "subject_id": 1,
    "password": "password"
  }
  ```
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Jadwal berhasil dibuat",
    "data": {
      "id": 10,
      "cycle_type": 1,
      "day_of_week": 1,
      "period_number": 1,
      "duration_periods": 2,
      "teacher_id": 3,
      "class_id": 1,
      "room_id": 1,
      "subject_id": 1,
      "source": "manual"
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
- **Skenario Bentrok Jadwal Guru/Kelas/Ruangan (422 Unprocessable Entity):**
  Kirim jadwal lain dengan guru, kelas, atau ruangan yang sama pada rentang jam bertabrakan:
  ```json
  {
    "success": false,
    "message": "Jadwal bentrok!",
    "errors": {
      "schedule": ["Terjadi bentrok guru, kelas atau ruangan pada jadwal."]
    }
  }
  ```
- **Skenario Bukan Waka (403 Forbidden):** Menggunakan token guru ➔ ditolak HTTP 403.

---

### 21.5 Pengujian `PUT /api/schedules/{id}` (Update Jadwal Manual)

- **Method:** `PUT`
- **URL:** `{{base_url}}/schedules/10`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "cycle_type": 1,
    "day_of_week": 1,
    "period_number": 3,
    "duration_periods": 2,
    "teacher_id": 3,
    "class_id": 1,
    "room_id": 1,
    "subject_id": 1,
    "password": "password"
  }
  ```
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Jadwal berhasil diperbarui",
    "data": {
      "id": 10,
      "period_number": 3
    }
  }
  ```

---

### 21.6 Pengujian `DELETE /api/schedules/{id}` (Soft Delete Jadwal)

- **Method:** `DELETE`
- **URL:** `{{base_url}}/schedules/10`
- **Headers:** `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "password": "password"
  }
  ```
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Jadwal berhasil dihapus",
    "data": null
  }
  ```

---

## 22. Kesiapan Menuju Fase 3

Dengan tuntasnya seluruh implementasi dan verifikasi Fase 2:
1. **Mesin Resolusi Waktu Terpusat:** `PeriodResolutionService` siap dipakai lintas modul (jurnal, presensi, kuis, dan import PDF).
2. **Keamanan & Konsistensi Jadwal:** Pembacaan jadwal ter-scope multi-peran dengan aman, alert keterlambatan jurnal berjalan real-time, dan mutasi manual dilindungi verifikasi password serta anti-bentrok.
3. **Pondasi Import PDF Terbuka:** Master data (Fase 1) dan tabel jadwal (Fase 2) telah siap untuk menerima commit replace per putaran dari proses ekstraksi file PDF FET.
4. Project siap sepenuhnya untuk melangkah ke **Fase 3: Import Jadwal Otomatis dari File PDF FET (PRD 5.16 & 9.5)**.


---

# Dokumentasi Perkembangan Proyek: Fase 3 (Import Jadwal Otomatis dari File PDF FET)

**Proyek:** School Class Progress (SCP) — Backend REST API  
**Fase:** Fase 3 (Import Jadwal Otomatis dari File PDF FET)  
**Acuan Spesifikasi:** `MD/PRD.md` (v4.4 Bagian 5.16 & 9.5), `MD/MASTER_IMPROVEMENT_PLAN.md`, dan `MD/FASE_3_SCHEDULE_IMPORT_PLAN.md`  
**Waktu Eksekusi:** 2026-10-20  
**Status Fase:** Selesai (100% Lolos Pengujian Otomatis, 96/96 Tests Passed)

---

## 23. Ringkasan Perubahan & Tujuan Fase 3

Fase 3 mengimplementasikan pipeline pemrosesan data asinkron untuk mengimpor jadwal pelajaran secara otomatis dari 2 file PDF keluaran aplikasi generator jadwal FET (v5.44.9) milik Waka Kurikulum SMK Negeri 1 Bantul. Pipeline ini menggantikan script stub/dummy dan hardcoded values lama, dengan karakteristik utama:

1. **Ekstraksi Data Berbasis Koordinat Sel Visual (`script/pdf_parser.py`)**:
   - Memanfaatkan engine `pdfplumber` (Python 3.11) untuk mengekstrak tabel jadwal kelas (49 halaman, 48 kelas) dan jadwal ruangan (3 halaman landscape, 48 kelas x 5 hari).
   - Menangani **78 sel anomali pada `Jadwal_Kelas.pdf`** di mana tanda kutip nama guru terpotong tanpa tanda kutip penutup akibat keterbatasan layout FET.
   - Melakukan kanonisasi dan normalisasi nama kelas (Romawi vs Arab: `10 RPL 1` vs `X RPL 1`) serta normalisasi kode ruang (`LAB 16` vs `L.16`, `OR1` vs `OR`).
   - Melakukan rekonsiliasi silang (*cross-matching*) antara PDF jadwal kelas (sumber guru, mapel, durasi JP) dan PDF ruangan (sumber alokasi fisik ruangan), serta menandai `room_source_conflict` jika terjadi ketidaksesuaian.
2. **Worker Pemetaan Master Data & Deteksi Bentrok Asinkron (`app/Jobs/ParseSchedulePdfJob.php`)**:
   - Menghapus seluruh hardcode (`id=1`) pada queue job lama.
   - Pre-loading master data ke memori PHP (`Classes`, `User`, `Subject`, `Rooms`) untuk meminimalisir overhead database (mengurangi dari ~2.800 query menjadi 4 query).
   - Memprioritaskan pencocokan guru menggunakan **`fet_staff_id`** (kunci utama numerik) sebelum fallback ke pencocokan nama dan pembersihan gelar akademik.
   - Menerapkan heuristik multi-strategi pencocokan ruangan (exact, numeric `Ruang X`, lab komputer `L.X` / `Lab Komputer X`, ruangan khusus `OR`, `L.IPA`, `HALL`).
   - Menerapkan deteksi tabrakan ganda: bentrok internal antar-baris dalam satu batch import (*intra-batch collisions*) serta bentrok terhadap jadwal eksisting via `ScheduleConflictService`.
3. **Resolusi Manual & Pembatalan Draft (`ScheduleImportController.php`)**:
   - Endpoint `PATCH /api/schedule-imports/{id}/rows/{row_id}` untuk mengoreksi baris `unmatched`/`conflict` satu per satu atau mengecualikannya dari proses import (`exclude = true`).
   - Endpoint `DELETE /api/schedule-imports/{id}` untuk membatalkan draft import yang belum dikonfirmasi dan membersihkan file fisik dari penyimpanan.
4. **Solidifikasi Final Commit Replace per Putaran (`confirm`)**:
   - Endpoint `POST /api/schedule-imports/{id}/confirm` mewajibkan verifikasi kata sandi Waka Kurikulum via `$this->passwordIsConfirmed($request)` (HTTP 422 jika salah).
   - Transaksi database atomik yang meng-soft-delete jadwal lama **hanya pada `cycle_type` terkait**, menjaga jadwal pada putaran lain tetap utuh, dan menjaga integritas relasi historis ke jurnal mengajar.
   - Melakukan bulk-insert baris berstatus `'matched'` dengan `source = 'imported'` dan `import_batch_id`.
   - Menghapus file fisik PDF dari storage private demi keamanan dan penghematan kapasitas disk.

---

## 24. Daftar File yang Dibuat atau Diubah

| No | File Path | Status | Fungsi & Tanggung Jawab |
|---|---|---|---|
| 1 | `script/pdf_parser.py` | Diubah | Script ekstraksi PDF Python berbasis `pdfplumber`, membaca kedua PDF aktual, menangani anomali kutip terbuka, mengekstrak `fet_staff_id`, menghitung durasi sel gabungan multi-JP, merekonsiliasi kode ruang, dan mencetak array JSON ke `stdout`. |
| 2 | `app/Jobs/ParseSchedulePdfJob.php` | Diubah | Queue job asinkron pemetaan master data dinamis, `fet_staff_id` priority matching, heuristik ruang, deteksi bentrok intra-batch & database, serta pengisian tabel `schedule_import_rows`. |
| 3 | `app/Http/Controllers/API/ScheduleImportController.php` | Diubah | Controller lengkap import jadwal: upload asinkron (202 Accepted), preview dengan relasi & ringkasan meta, resolusi manual row, pembatalan draft, dan commit final replace per putaran. |
| 4 | `routes/api.php` | Diubah | Mendaftarkan 5 rute lengkap resource `schedule-imports` di bawah middleware otorisasi `role:vice_principal`. |
| 5 | `tests/Feature/ScheduleImportTest.php` | Dibuat | Automated test feature mencakup alur upload PDF, proteksi otorisasi, preview import, manual row resolution, row exclusion, password confirmation validation, commit replace per cycle, dan pembatalan draft. |
| 6 | `tests/Feature/ParseSchedulePdfJobTest.php` | Dibuat | Automated test integrasi end-to-end yang mengeksekusi `ParseSchedulePdfJob` terhadap file PDF riil SMK Negeri 1 Bantul di `MD/PDF/`, memvalidasi ekstraksi >700 baris, pencocokan via `fet_staff_id`, dan tracking room conflict. |
| 7 | `MD/Development.md` | Diubah | Dokumentasi teknis perkembangan proyek Fase 3 dan panduan lengkap pengujian Postman. |

---

## 25. Potongan Kode Penting & Penjelasan Logika

### 25.1 Penanganan Anomali Kutip Terbuka & Ekstraksi `fet_staff_id` pada `script/pdf_parser.py`
```python
def parse_cell(cell_text):
    if not cell_text or cell_text.strip() in ["-x-", "---", ""]:
        return None
    
    full_text = " ".join([l.strip() for l in cell_text.strip().split("\n") if l.strip()])
    
    # Match teacher with or without closing quote (handles 78 unclosed quotes anomaly in FET export)
    quote_match = re.search(r'"(\d+)\.?\s*([^"\n\r]+?)(?:"|\s+(?:LAB|OR|HALL)\b|$)', full_text)
    
    fet_staff_id = None
    teacher_name = None
    subject_raw = None
    room_raw = None
    
    if quote_match:
        fet_staff_id = quote_match.group(1).strip()
        teacher_name = quote_match.group(2).strip()
        
        # Subject is text before quote
        subject_raw = full_text[:quote_match.start()].strip()
        
        # Room is text after teacher name / quote
        after_text = full_text[quote_match.end():].strip()
        after_text = re.sub(r'^"\s*', '', after_text).strip()
        if after_text:
            room_raw = after_text
    else:
        subject_raw = full_text
        
    return {
        "subject": subject_raw,
        "fet_staff_id": fet_staff_id,
        "teacher": teacher_name,
        "room_kelas": room_raw,
    }
```
*Penjelasan:* Menggunakan regular expression non-greedy yang mengenali pola nomor urut staf FET (`fet_staff_id`) dan nama guru, serta mentoleransi ketiadaan tanda kutip penutup akibat batas bounding box sel tabel FET.

---

### 25.2 Deteksi Header Matriks Ruangan Multipage pada `script/pdf_parser.py`
```python
# Mencari baris header dinamis yang diawali kata 'HARI' dan 'JAM'
for r_idx, row in enumerate(table):
    if len(row) >= 4 and (row[0] or "").strip().upper() == "HARI" and (row[1] or "").strip().upper() == "JAM":
        header_row_idx = r_idx
        for c_idx in range(3, len(row)):
            val = row[c_idx]
            if val:
                norm = normalize_class_name(val)
                if norm:
                    class_columns[c_idx] = norm
        break
```
*Penjelasan:* Pada file `Jadwal_Ruangan.pdf`, baris header kelas berada pada baris 1 di halaman 1, baris 0 di halaman 2, dan baris 0 pada sub-tabel kedua di halaman 3. Algoritma ini secara dinamis melacak baris header dan memetakan indeks kolom ke nama kelas ternormalisasi.

---

### 25.3 Pre-Loading Master Data & Pencocokan `fet_staff_id` pada `ParseSchedulePdfJob.php`
```php
// app/Jobs/ParseSchedulePdfJob.php
protected function findTeacher($teachers, ?string $fetStaffId, ?string $teacherRaw): ?User
{
    // Priority 1: Primary lookup via fet_staff_id
    if ($fetStaffId !== null && $fetStaffId !== '') {
        $match = $teachers->first(fn ($t) => (string) $t->fet_staff_id === (string) $fetStaffId);
        if ($match) {
            return $match;
        }
    }

    // Priority 2: Fallback to teacher name matching
    if ($teacherRaw) {
        $cleanRaw = strtoupper(trim($teacherRaw));

        // Exact match
        $match = $teachers->first(fn ($t) => strtoupper(trim($t->name)) === $cleanRaw);
        if ($match) return $match;

        // Substring match
        $match = $teachers->first(
            fn ($t) => stripos($t->name, $cleanRaw) !== false || stripos($cleanRaw, $t->name) !== false
        );
        if ($match) return $match;

        // Strip academic titles/degrees (S.Pd, M.Pd, etc.)
        $cleanNoTitle = preg_replace('/,\s*(?:S\.[A-Za-z]+|M\.[A-Za-z]+|Drs\.|Dr\.|Ir\.|M\.T|S\.T|S\.Kom|M\.Kom).*$/i', '', $cleanRaw);
        $cleanNoTitle = trim($cleanNoTitle);
        if ($cleanNoTitle && $cleanNoTitle !== $cleanRaw) {
            $match = $teachers->first(function ($t) use ($cleanNoTitle) {
                $tNameNoTitle = preg_replace('/,\s*(?:S\.[A-Za-z]+|M\.[A-Za-z]+|Drs\.|Dr\.|Ir\.|M\.T|S\.T|S\.Kom|M\.Kom).*$/i', '', strtoupper($t->name));
                return stripos($tNameNoTitle, $cleanNoTitle) !== false || stripos($cleanNoTitle, $tNameNoTitle) !== false;
            });
            if ($match) return $match;
        }
    }

    return null;
}
```
*Penjelasan:* Mengimplementasikan dua lapis pencocokan guru: prioritas utama menggunakan identitas staf FET numerik (`fet_staff_id`), dan prioritas kedua melakukan pembersihan gelar akademik untuk pencocokan toleran (*fuzzy string matching*).

---

### 25.4 Heuristik Pencocokan Ruangan Multi-Strategi pada `ParseSchedulePdfJob.php`
```php
protected function findRoom($rooms, ?string $roomCode): ?Rooms
{
    if (!$roomCode) return null;
    $code = strtoupper(trim($roomCode));

    // 1. Exact match
    $match = $rooms->first(fn ($r) => strtoupper(trim($r->name)) === $code);
    if ($match) return $match;

    // 2. Numeric room (e.g. "12" -> "Ruang 12", "Ruang Teori 12")
    if (is_numeric($code)) {
        $numMatch = $rooms->first(function ($r) use ($code) {
            $rName = strtoupper($r->name);
            return preg_match('/(?:RUANG(?:\s+TEORI)?\s+|^)' . preg_quote($code, '/') . '$/i', $rName);
        });
        if ($numMatch) return $numMatch;
    }

    // 3. Lab with number (e.g. "L.16", "LAB 16" -> "Lab Komputer 16", "L.16")
    if (preg_match('/^(?:LAB\.?|L\.)\s*(\d+)$/i', $code, $m)) {
        $num = $m[1];
        $labMatch = $rooms->first(function ($r) use ($num) {
            $rName = strtoupper($r->name);
            return preg_match('/(?:LAB(?:ORATORIUM)?(?:\s+KOMPUTER)?|L\.?)\s*' . $num . '$/i', $rName);
        });
        if ($labMatch) return $labMatch;
    }

    // 4. Special rooms
    if (in_array($code, ['OR', 'OR1', 'OR2', 'OR3', 'LAPANGAN'])) {
        $orMatch = $rooms->first(fn ($r) => preg_match('/(?:OR|LAPANGAN)/i', $r->name));
        if ($orMatch) return $orMatch;
    }

    if (in_array($code, ['L.IPA', 'LAB IPA', 'LAB.IPA'])) {
        $ipaMatch = $rooms->first(fn ($r) => preg_match('/(?:IPA)/i', $r->name));
        if ($ipaMatch) return $ipaMatch;
    }

    if (in_array($code, ['HALL'])) {
        $hallMatch = $rooms->first(fn ($r) => preg_match('/(?:HALL|MENARI)/i', $r->name));
        if ($hallMatch) return $hallMatch;
    }

    // 5. Fallback substring
    return $rooms->first(
        fn ($r) => stripos($r->name, $code) !== false || stripos($code, $r->name) !== false
    );
}
```
*Penjelasan:* Mengakomodasi variasi penamaan ruang di FET vs master data database, mencakup nomor ruang kelas teori biasa, variasi laboratorium komputer, laboratorium IPA, dan lapangan olahraga.

---

### 25.5 Endpoint Resolusi Manual & Pengecualian Baris pada `ScheduleImportController.php`
```php
public function resolveRow(Request $request, $id, $row_id)
{
    $import = ScheduleImport::findOrFail($id);

    if ($import->status === 'confirmed') {
        return response()->json([
            'success' => false,
            'message' => 'Import yang sudah dikonfirmasi tidak dapat diubah.',
        ], 422);
    }

    $row = ScheduleImportRow::where('import_id', $import->id)->findOrFail($row_id);

    $validated = $request->validate([
        'matched_class_id' => 'nullable|exists:classes,id',
        'matched_teacher_id' => 'nullable|exists:users,id',
        'matched_room_id' => 'nullable|exists:rooms,id',
        'matched_subject_id' => 'nullable|exists:subjects,id',
        'exclude' => 'nullable|boolean',
    ]);

    if (!empty($validated['exclude'])) {
        $row->match_status = 'duplicate';
        $row->resolved_by_waka = true;
        $row->save();

        return response()->json([
            'success' => true,
            'message' => 'Baris jadwal berhasil dikecualikan dari import.',
            'data' => $row->fresh(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject']),
        ], 200);
    }

    if ($request->has('matched_class_id')) $row->matched_class_id = $validated['matched_class_id'];
    if ($request->has('matched_teacher_id')) $row->matched_teacher_id = $validated['matched_teacher_id'];
    if ($request->has('matched_room_id')) $row->matched_room_id = $validated['matched_room_id'];
    if ($request->has('matched_subject_id')) $row->matched_subject_id = $validated['matched_subject_id'];

    $row->resolved_by_waka = true;

    if ($row->matched_class_id && $row->matched_teacher_id && $row->matched_room_id && $row->matched_subject_id) {
        $conflicts = (new ScheduleConflictService())->findConflicts([
            'teacher_id' => $row->matched_teacher_id,
            'class_id' => $row->matched_class_id,
            'room_id' => $row->matched_room_id,
            'cycle_type' => $import->cycle_type,
            'day_of_week' => $row->day_of_week,
            'period_number' => $row->period_number,
            'duration_periods' => $row->duration_periods,
        ]);

        $row->match_status = $conflicts->isEmpty() ? 'matched' : 'conflict';
    } else {
        $row->match_status = 'unmatched';
    }

    $row->save();

    return response()->json([
        'success' => true,
        'message' => 'Baris import berhasil diupdate.',
        'data' => $row->fresh(['matchedClass', 'matchedTeacher', 'matchedRoom', 'matchedSubject']),
    ], 200);
}
```
*Penjelasan:* Mengizinkan Waka Kurikulum memilih ID master data yang valid untuk baris yang belum cocok secara otomatis, atau mengecualikan baris tersebut (`exclude = true`) sehingga tidak masuk ke jadwal definitif.

---

### 25.6 Konfirmasi Atomik Replace per Putaran & Pembersihan Fisik pada `confirm`
```php
public function confirm(Request $request, $id)
{
    $request->validate(['password' => 'required|string']);

    if ($error = $this->passwordIsConfirmed($request)) {
        return $error;
    }

    $import = ScheduleImport::with('rows')->where('status', 'preview_ready')->findOrFail($id);

    $insertedCount = 0;

    DB::transaction(function () use ($import, &$insertedCount) {
        // Soft-delete previous schedules on this cycle_type only
        Schedule::where('cycle_type', $import->cycle_type)->delete();

        foreach ($import->rows as $row) {
            if ($row->match_status === 'matched') {
                Schedule::create([
                    'teacher_id' => $row->matched_teacher_id,
                    'class_id' => $row->matched_class_id,
                    'room_id' => $row->matched_room_id,
                    'subject_id' => $row->matched_subject_id,
                    'day_of_week' => $row->day_of_week,
                    'period_number' => $row->period_number,
                    'duration_periods' => $row->duration_periods,
                    'cycle_type' => $import->cycle_type,
                    'source' => 'imported',
                    'import_batch_id' => $import->id,
                ]);
                $insertedCount++;
            }
        }

        // Clean up temporary physical PDF files
        if ($import->file_path_kelas) {
            Storage::disk('local')->delete($import->file_path_kelas);
        }
        if ($import->file_path_ruangan) {
            Storage::disk('local')->delete($import->file_path_ruangan);
        }

        $import->update([
            'status' => 'confirmed',
            'file_path_kelas' => null,
            'file_path_ruangan' => null,
        ]);
    });

    return response()->json([
        'success' => true,
        'message' => 'Import jadwal berhasil dikonfirmasi.',
        'data' => [
            'import_id' => $import->id,
            'cycle_type' => $import->cycle_type,
            'inserted_schedules_count' => $insertedCount,
        ],
    ], 200);
}
```
*Penjelasan:* Memastikan proses penggantian jadwal bersifat atomik dan aman: memvalidasi ulang kata sandi Waka (HTTP 422 jika gagal), meng-soft-delete jadwal hanya pada putaran yang di-import, menyimpan baris matched baru dengan `source = 'imported'`, menghapus file PDF fisik dari storage, dan mengunci status import menjadi `'confirmed'`.

---

## 26. Command Terminal yang Dijalankan

| No | Command | Tujuan |
|---|---|---|
| 1 | `uv pip install pdfplumber` | Memastikan paket Python `pdfplumber` terpasang di virtual environment aktif. |
| 2 | `python -c "import pdfplumber; ..."` | Memverifikasi ketersediaan dan versi modul `pdfplumber` (v0.11.10). |
| 3 | `php artisan route:list --path=schedule-import` | Memeriksa ketersediaan dan keabsahan 5 endpoint rute import jadwal. |
| 4 | `php artisan test --filter=ScheduleImportTest` | Menjalankan suite pengujian feature controller import jadwal (9 tests passing). |
| 5 | `php artisan test --filter=ParseSchedulePdfJobTest` | Menjalankan pengujian integrasi queue worker parsing terhadap file PDF aktual (1 test, 11 assertions passing). |
| 6 | `php artisan test` | Menjalankan seluruh rangkaian automated test proyek untuk memastikan regresi nol (96 tests, 420 assertions passing). |

---

## 27. Hasil Pengujian, Kendala & Status Penyelesaian

### 27.1 Hasil Eksekusi Automated Testing
```text
Pass: 96 / 96 tests (100%)
Assertions: 420 assertions
Duration: ~10.5 seconds
Status: OK
```

### 27.2 Kendala Teknis & Mitigasi yang Diterapkan
1. **Anomali Kutip Terbuka Tanpa Penutup (78 Kasus pada `Jadwal_Kelas.pdf`):**
   - *Kendala:* Regex standar `r'"([^"]+)"'` gagal menangkap 78 mata pelajaran karena kutip nama guru tidak ditutup oleh FET.
   - *Solusi:* Menggunakan regex toleran akhir sel `r'"(\d+)\.?\s*([^"\n\r]+?)(?:"|\s+(?:LAB|OR|HALL)\b|$)'` yang berhasil mengekstrak seluruh 721 jadwal tanpa ada data yang terlewat.
2. **Struktur Matriks Tabel `Jadwal_Ruangan.pdf` Multipage:**
   - *Kendala:* Halaman 3 memuat 2 tabel terpisah di mana tabel pertama adalah tabel keterangan legenda ruang dan tanda tangan kepala sekolah.
   - *Solusi:* Parser memeriksa header baris secara cerdas dengan mendeteksi kemunculan kata `HARI` dan `JAM` pada kolom 0 dan 1, serta hanya mengambil baris jam bernilai numerik 1 s.d. 10.
3. **Penyelarasan Python Path pada Subprocess Symfony:**
   - *Kendala:* Panggilan subprocess Windows berpotensi memanggil python launcher default store jika PATH tidak terkonfigurasi.
   - *Solusi:* Konfigurasi environment memastikan `python` merujuk ke interpreter aktif di mana `pdfplumber` terpasang, dengan timeout proses 180 detik.

---

## 28. Panduan Pengujian Manual via Postman (Fase 3 Complete Guide)

Bagian ini menyediakan dokumentasi cURL dan Postman terperinci untuk seluruh 5 endpoint import jadwal PDF Waka Kurikulum sesuai PRD v4.4 Bagian 5.16 & 9.5.

### Persiapan Variabel Postman:
- `base_url`: `http://127.0.0.1:8000/api`
- `token_waka`: Bearer token hasil login akun Waka Kurikulum.
- `token_guru`: Bearer token akun Guru (untuk uji otorisasi 403).

---

### 28.1 `POST /api/schedule-imports` (Upload & Dispatch Parsing PDF)

- **Method:** `POST`
- **URL:** `{{base_url}}/schedule-imports`
- **Headers:**
  - `Authorization: Bearer {{token_waka}}`
  - `Accept: application/json`
- **Body:** `form-data`
  - `cycle_type`: `1` (Text)
  - `file_kelas`: Pilih file `MD/PDF/Jadwal_Kelas.pdf` (File)
  - `file_ruangan`: Pilih file `MD/PDF/Jadwal_Ruangan.pdf` (File)

- **Expected Response (HTTP 202 Accepted):**
  ```json
  {
    "success": true,
    "message": "File jadwal diunggah. Sedang memproses...",
    "data": {
      "id": 1,
      "waka_id": 1,
      "cycle_type": 1,
      "file_path_kelas": "imports/schedules/RANDOM_HASH_KELAS.pdf",
      "file_path_ruangan": "imports/schedules/RANDOM_HASH_RUANGAN.pdf",
      "status": "uploaded",
      "parser_version": "v1.0",
      "created_at": "2026-10-20T12:30:00.000000Z",
      "updated_at": "2026-10-20T12:30:00.000000Z"
    }
  }
  ```

- **Skenario Hak Akses Ditolak (HTTP 403 Forbidden):**
  - Menggunakan `Authorization: Bearer {{token_guru}}`
  - Response:
    ```json
    {
      "success": false,
      "message": "Akses ditolak, anda tidak memiliki izin."
    }
    ```

---

### 28.2 `GET /api/schedule-imports/{id}` (Polling Status & Pratinjau Rows)

- **Method:** `GET`
- **URL:** `{{base_url}}/schedule-imports/1`
- **Headers:**
  - `Authorization: Bearer {{token_waka}}`
  - `Accept: application/json`

- **Expected Response saat Status `preview_ready` (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Detail preview import jadwal.",
    "data": {
      "id": 1,
      "waka_id": 1,
      "cycle_type": 1,
      "status": "preview_ready",
      "parser_version": "v1.0",
      "rows": [
        {
          "id": 101,
          "import_id": 1,
          "raw_data": {
            "kelas_mentah": "X RPL 1",
            "hari_mentah": "Senin",
            "day_of_week": 1,
            "period_number": 1,
            "duration_periods": 3,
            "mapel_mentah": "Matematika",
            "fet_staff_id": "34",
            "guru_mentah": "DWI LESMIYATI, S.Pd.",
            "ruang_kelas": null,
            "ruang_jadwal": "12",
            "ruang_final": "12",
            "room_source_conflict": false
          },
          "matched_class_id": 1,
          "matched_teacher_id": 2,
          "matched_room_id": 5,
          "matched_subject_id": 1,
          "day_of_week": 1,
          "period_number": 1,
          "duration_periods": 3,
          "match_status": "matched",
          "room_source_conflict": false,
          "resolved_by_waka": false,
          "matched_class": {
            "id": 1,
            "name": "X RPL 1"
          },
          "matched_teacher": {
            "id": 2,
            "name": "Dwi Lesmiyati",
            "fet_staff_id": "34"
          },
          "matched_room": {
            "id": 5,
            "name": "Ruang 12"
          },
          "matched_subject": {
            "id": 1,
            "name": "Matematika"
          }
        }
      ]
    },
    "meta": {
      "total_rows": 721,
      "matched_count": 680,
      "unmatched_count": 35,
      "conflict_count": 6,
      "duplicate_count": 0
    }
  }
  ```

---

### 28.3 `PATCH /api/schedule-imports/{id}/rows/{row_id}` (Resolusi Manual Baris Jadwal)

#### Skenario A: Mengoreksi ID Master Data
- **Method:** `PATCH`
- **URL:** `{{base_url}}/schedule-imports/1/rows/102`
- **Headers:**
  - `Authorization: Bearer {{token_waka}}`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Body raw JSON:**
  ```json
  {
    "matched_teacher_id": 2,
    "matched_room_id": 5,
    "matched_subject_id": 1
  }
  ```
- **Expected Response (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Baris import berhasil diupdate.",
    "data": {
      "id": 102,
      "import_id": 1,
      "matched_class_id": 1,
      "matched_teacher_id": 2,
      "matched_room_id": 5,
      "matched_subject_id": 1,
      "match_status": "matched",
      "resolved_by_waka": true
    }
  }
  ```

#### Skenario B: Mengecualikan Baris dari Import (Exclude)
- **Method:** `PATCH`
- **URL:** `{{base_url}}/schedule-imports/1/rows/103`
- **Body raw JSON:**
  ```json
  {
    "exclude": true
  }
  ```
- **Expected Response (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Baris jadwal berhasil dikecualikan dari import.",
    "data": {
      "id": 103,
      "import_id": 1,
      "match_status": "duplicate",
      "resolved_by_waka": true
    }
  }
  ```

---

### 28.4 `POST /api/schedule-imports/{id}/confirm` (Konfirmasi Commit Final Replace per Putaran)

#### Skenario A: Password Salah (HTTP 422)
- **Method:** `POST`
- **URL:** `{{base_url}}/schedule-imports/1/confirm`
- **Headers:**
  - `Authorization: Bearer {{token_waka}}`
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Body raw JSON:**
  ```json
  {
    "password": "kata-sandi-salah"
  }
  ```
- **Expected Response (HTTP 422 Unprocessable Entity):**
  ```json
  {
    "success": false,
    "message": "Validasi Gagal",
    "errors": {
      "password": [
        "Password tidak valid"
      ]
    }
  }
  ```

#### Skenario B: Password Benar (HTTP 200 OK)
- **Method:** `POST`
- **URL:** `{{base_url}}/schedule-imports/1/confirm`
- **Body raw JSON:**
  ```json
  {
    "password": "password"
  }
  ```
- **Expected Response (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Import jadwal berhasil dikonfirmasi.",
    "data": {
      "import_id": 1,
      "cycle_type": 1,
      "inserted_schedules_count": 715
    }
  }
  ```

---

### 28.5 `DELETE /api/schedule-imports/{id}` (Membatalkan Draft Import)

- **Method:** `DELETE`
- **URL:** `{{base_url}}/schedule-imports/2`
- **Headers:**
  - `Authorization: Bearer {{token_waka}}`
  - `Accept: application/json`

- **Expected Response (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Draft import jadwal berhasil dibatalkan."
  }
  ```

- **Skenario Import Sudah Dikonfirmasi (HTTP 422):**
  - Response:
    ```json
    {
      "success": false,
      "message": "Import yang sudah dikonfirmasi tidak dapat dibatalkan."
    }
    ```

---

## 29. Kesiapan Menuju Fase 4

Dengan terselesaikannya seluruh tugas pada **Fase 3: Import Jadwal Otomatis dari File PDF FET**:
1. **Pipeline Parsing Terverifikasi Penuh:** Ekstraksi 48 kelas dan 721 alokasi jadwal dari PDF resmi SMK Negeri 1 Bantul berjalan stabil tanpa ada baris data yang hilang akibat anomali layout FET.
2. **Penyelarasan Master Data Otomatis:** Relasi guru (`fet_staff_id`), mata pelajaran, kelas, dan variasi ruangan berhasil dipetakan secara dinamis ke tabel database dengan deteksi bentrok real-time.
3. **Keamanan & Integritas Jadwal Terjamin:** Penggantian jadwal per putaran dieksekusi secara aman menggunakan soft-delete terisolasi dan re-konfirmasi kata sandi Waka Kurikulum, serta file PDF sementara otomatis dibersihkan dari storage.
4. **Automated Test Lulus 100% (96/96 Tests, 420 Assertions).**
5. Project siap melangkah ke **Fase 4: Core Akademik — Presensi Siswa & Jurnal Mengajar Guru (PRD Bagian 5.7 s.d. 5.9)**.


---

# Dokumentasi Pembaruan Aturan Bisnis: Prasyarat Master Data Sebelum Pengelolaan Jadwal

**Proyek:** School Class Progress (SCP) — Backend REST API  
**Modul Terdampak:** Master Data, Jadwal Manual (PRD 5.3.1 & 9.4), Import Jadwal PDF FET (PRD 5.16 & 9.5)  
**Acuan Spesifikasi:** `MD/PRD.md` (Catatan Revisi, Bagian 5.3.1 & 5.16), `MD/MASTER_IMPROVEMENT_PLAN.md`, dan `MD/MASTER_DATA_PREREQUISITE_PLAN.md`  
**Waktu Eksekusi:** 2026-10-20  
**Status Dokumentasi:** Disetujui (Dokumen Acuan Resmi)

---

## 30. Ringkasan Latar Belakang & Analisis Masalah Riil

### 30.1 Kasus Temuan Riil pada Database PostgreSQL Development
Saat pengujian langsung dilakukan di lingkungan PostgreSQL lokal, ditemukan anomali perilaku sistem:
1. Waka Kurikulum dapat mengunggah 2 file PDF FET melalui `POST /api/schedule-imports` meskipun tabel `classes` (0 record) dan tabel `users` untuk guru (0 guru) masih kosong melompong.
2. Worker `ParseSchedulePdfJob` tetap berjalan memproses 52 halaman PDF dan mengekstrak 721 alokasi jadwal ke tabel `schedule_import_rows`. Namun, karena master data kosong, **100% baris (721 dari 721 baris) berstatus `unmatched`**.
3. Saat Waka memanggil endpoint `POST /api/schedule-imports/{id}/confirm` dengan password yang benar, sistem mengembalikan status HTTP 200 OK dengan data `"inserted_schedules_count": 0`. Di mata pengguna, proses tampak berhasil, namun tabel `schedules` tetap kosong karena sistem hanya memasukkan baris `matched`.
4. Pada jalur manual (`POST /api/schedules`), ketiadaan master data hanya ditangkap oleh validasi foreign key generik Laravel (`The selected class id is invalid.`), bukan pesan bisnis yang jelas bahwa Master Data sekolah belum dikonfigurasi.

### 30.2 Penetapan Aturan Bisnis Baru
Untuk menjamin integritas data dan efisiensi sistem, disepakati aturan bisnis baru:
> **"Waka Kurikulum wajib melengkapi seluruh Master Data prasyarat (Kelas, Guru beserta `fet_staff_id`, Mata Pelajaran, dan Ruangan) terlebih dahulu sebelum dapat menginput jadwal. Jika sistem mendeteksi bahwa salah satu Master Data masih kosong atau belum memenuhi persyaratan kelayakan, seluruh proses input jadwal (baik manual maupun upload PDF) wajib ditolak langsung di gerbang awal request dengan status HTTP 422 Unprocessable Entity."**

Selain itu, ditambahkan aturan pencegahan konfirmasi kosong:
> **"Endpoint `POST /api/schedule-imports/{id}/confirm` wajib menolak eksekusi (HTTP 422) jika tidak ada satupun baris jadwal hasil import yang berstatus `matched` (`matched_count === 0`)."**

---

## 31. Spesifikasi Teknis & Rencana Perubahan Kode

### 31.1 Komponen Domain Service: `MasterDataPrerequisiteService`
Akan diimplementasikan class service terpusat di `app/Services/MasterDataPrerequisiteService.php` dengan tanggung jawab:
- `validateForManualSchedule(): array`: Memastikan tabel `classes`, `users` (guru), `subjects`, dan `rooms` masing-masing memiliki $\ge 1$ record aktif (`deleted_at IS NULL`).
- `validateForPdfImport(): array`: Memeriksa 4 tabel di atas, ditambah syarat bahwa setidaknya ada $\ge 1$ akun guru yang telah diisi nomor staf FET-nya (`fet_staff_id IS NOT NULL`), karena FET mengandalkan ID numerik tersebut sebagai kunci utama pencocokan.
- Mengembalikan array struktur hasil evaluasi:
  ```php
  [
      'is_valid' => false,
      'missing' => ['classes', 'teachers'],
      'errors' => [
          'classes' => ['Master data kelas masih kosong. Waka wajib mendaftarkan kelas terlebih dahulu.'],
          'teachers' => ['Master data guru masih kosong. Waka wajib mendaftarkan guru terlebih dahulu.']
      ]
  ]
  ```

### 31.2 Titik Validasi Gerbang Awal (Pre-Upload Gateway Check)
1. **`ScheduleController@store`:**
   - Memanggil `MasterDataPrerequisiteService::validateForManualSchedule()`.
   - Jika tidak valid, mengembalikan HTTP 422 dengan daftar error detail.
2. **`ScheduleImportController@store`:**
   - Memanggil `MasterDataPrerequisiteService::validateForPdfImport()`.
   - Jika tidak valid, mengembalikan HTTP 422 langsung. File PDF fisik **tidak disimpan ke storage** dan queue worker **tidak di-dispatch**.
3. **`ScheduleImportController@confirm`:**
   - Memeriksa `$import->rows()->where('match_status', 'matched')->count() > 0`.
   - Jika bernilai 0, tolak konfirmasi dengan HTTP 422 dan pesan bahwa seluruh baris masih unmatched/conflict sehingga belum siap dimasukkan ke jadwal aktif.

---

## 32. Standar Respons API Penolakan Master Data (HTTP 422)

```json
{
  "success": false,
  "message": "Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.",
  "errors": {
    "classes": [
      "Master data kelas masih kosong. Waka wajib mendaftarkan kelas terlebih dahulu."
    ],
    "teachers": [
      "Master data guru masih kosong. Waka wajib mendaftarkan guru terlebih dahulu."
    ],
    "fet_staff_id": [
      "Belum ada guru yang memiliki nomor staf FET (fet_staff_id). Waka wajib melengkapi fet_staff_id guru untuk import PDF."
    ]
  },
  "meta": {
    "missing_entities": [
      "classes",
      "teachers",
      "fet_staff_id"
    ]
  }
}
```

---

## 33. Rencana Pengujian Otomatis

Akan dibuat suite pengujian feature baru pada `tests/Feature/MasterDataPrerequisiteRuleTest.php` untuk menguji:
1. `POST /api/schedules` ditolak 422 saat tabel master data kosong.
2. `POST /api/schedules` diizinkan 201 saat seluruh master data terisi.
3. `POST /api/schedule-imports` ditolak 422 saat master data kosong (file storage & queue bersih).
4. `POST /api/schedule-imports` ditolak 422 saat guru ada tetapi belum memiliki `fet_staff_id`.
5. `POST /api/schedule-imports` diizinkan 202 saat master data lengkap dan siap.
6. `POST /api/schedule-imports/{id}/confirm` ditolak 422 jika `matched_count === 0`.
7. Seluruh endpoint memvalidasi otorisasi `role:vice_principal` (401 unauthenticated, 403 non-waka).

---

## 34. Realisasi Implementasi & Hasil Pengujian Aktual

### 34.1 File yang Dibuat dan Diubah
| No | File | Tipe Perubahan | Deskripsi & Tanggung Jawab |
|---|---|---|---|
| 1 | `app/Services/MasterDataPrerequisiteService.php` | Baru | Service layer untuk validasi ketersediaan Master Data (Kelas, Guru, Mata Pelajaran, Ruangan, serta `fet_staff_id` untuk PDF import). |
| 2 | `app/Http/Controllers/API/ScheduleController.php` | Diperbarui | Menginjeksi `MasterDataPrerequisiteService` dan menambahkan guard validasi pada `store()` sebelum aturan request diproses. |
| 3 | `app/Http/Controllers/API/ScheduleImportController.php` | Diperbarui | Menambahkan guard validasi pada `store()` sebelum penyimpanan file ke storage/dispatch job, serta menambahkan guard pada `confirm()` yang menolak commit jika `matched_count === 0`. |
| 4 | `tests/Feature/MasterDataPrerequisiteRuleTest.php` | Baru | Automated feature test suite berisikan 9 skenario pengujian komprehensif untuk aturan bisnis baru ini. |

---

### 34.2 Potongan Kode Utama yang Diimplementasikan

#### 1. `app/Services/MasterDataPrerequisiteService.php`
```php
namespace App\Services;

use App\Models\Classes;
use App\Models\Rooms;
use App\Models\Subject;
use App\Models\User;

class MasterDataPrerequisiteService
{
    public function validateForManualSchedule(): array
    {
        return $this->evaluate([
            'classes' => Classes::whereNull('deleted_at')->exists(),
            'teachers' => User::where('role', 'teacher')->whereNull('deleted_at')->exists(),
            'subjects' => Subject::whereNull('deleted_at')->exists(),
            'rooms' => Rooms::whereNull('deleted_at')->exists(),
        ], isPdfImport: false);
    }

    public function validateForPdfImport(): array
    {
        $hasTeachers = User::where('role', 'teacher')->whereNull('deleted_at')->exists();
        $hasTeachersWithFetId = User::where('role', 'teacher')
            ->whereNull('deleted_at')
            ->whereNotNull('fet_staff_id')
            ->where('fet_staff_id', '!=', '')
            ->exists();

        return $this->evaluate([
            'classes' => Classes::whereNull('deleted_at')->exists(),
            'teachers' => $hasTeachers,
            'fet_staff_id' => $hasTeachersWithFetId,
            'subjects' => Subject::whereNull('deleted_at')->exists(),
            'rooms' => Rooms::whereNull('deleted_at')->exists(),
        ], isPdfImport: true);
    }

    private function evaluate(array $checks, bool $isPdfImport): array
    {
        $missing = [];
        $errors = [];

        if (!$checks['classes']) {
            $missing[] = 'classes';
            $errors['classes'] = ['Master data kelas masih kosong. Waka wajib mendaftarkan kelas terlebih dahulu.'];
        }

        if (!$checks['teachers']) {
            $missing[] = 'teachers';
            $errors['teachers'] = ['Master data guru masih kosong. Waka wajib mendaftarkan guru terlebih dahulu.'];
        } elseif ($isPdfImport && isset($checks['fet_staff_id']) && !$checks['fet_staff_id']) {
            $missing[] = 'fet_staff_id';
            $errors['fet_staff_id'] = ['Belum ada guru yang memiliki nomor staf FET (fet_staff_id). Waka wajib melengkapi fet_staff_id guru untuk import PDF.'];
        }

        if (!$checks['subjects']) {
            $missing[] = 'subjects';
            $errors['subjects'] = ['Master data mata pelajaran masih kosong. Waka wajib mendaftarkan mata pelajaran terlebih dahulu.'];
        }

        if (!$checks['rooms']) {
            $missing[] = 'rooms';
            $errors['rooms'] = ['Master data ruangan masih kosong. Waka wajib mendaftarkan ruangan terlebih dahulu.'];
        }

        return [
            'is_valid' => empty($missing),
            'missing' => $missing,
            'errors' => $errors,
        ];
    }
}
```

#### 2. Guarding pada `ScheduleController.php`
```php
public function store(Request $request): JsonResponse
{
    $prerequisiteCheck = $this->prerequisites->validateForManualSchedule();
    if (!$prerequisiteCheck['is_valid']) {
        return response()->json([
            'success' => false,
            'message' => 'Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.',
            'errors' => $prerequisiteCheck['errors'],
            'meta' => [
                'missing_entities' => $prerequisiteCheck['missing'],
            ],
        ], 422);
    }

    $validated = $request->validate([
        // ... validasi request
    ]);
    // ... logic pembuatan jadwal
}
```

#### 3. Guarding pada `ScheduleImportController.php`
```php
public function store(Request $request)
{
    $prerequisiteCheck = $this->prerequisites->validateForPdfImport();
    if (!$prerequisiteCheck['is_valid']) {
        return response()->json([
            'success' => false,
            'message' => 'Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.',
            'errors' => $prerequisiteCheck['errors'],
            'meta' => [
                'missing_entities' => $prerequisiteCheck['missing'],
            ],
        ], 422);
    }

    // Hanya jika lolos, file disimpan dan job diantrekan
    $request->validate([
        'cycle_type' => 'required|integer|in:1,2',
        'file_kelas' => 'required|file|mimes:pdf|max:10240',
        'file_ruangan' => 'required|file|mimes:pdf|max:10240',
    ]);

    $pathKelas = $request->file('file_kelas')->store('imports/schedules');
    $pathRuangan = $request->file('file_ruangan')->store('imports/schedules');
    // ...
}

public function confirm(Request $request, $id)
{
    $request->validate(['password' => 'required|string']);

    if ($error = $this->passwordIsConfirmed($request)) {
        return $error;
    }

    $import = ScheduleImport::with('rows')->where('status', 'preview_ready')->findOrFail($id);

    $matchedCount = $import->rows->where('match_status', 'matched')->count();
    if ($matchedCount === 0) {
        return response()->json([
            'success' => false,
            'message' => 'Konfirmasi gagal. Tidak ada baris jadwal yang berstatus matched untuk dimasukkan ke jadwal aktif.',
            'errors' => [
                'import' => ['Seluruh baris import masih berstatus unmatched atau conflict. Harap lengkapi master data atau lakukan resolusi baris terlebih dahulu.'],
            ],
        ], 422);
    }

    // ... commit schedules ke tabel schedules
}
```

---

### 34.3 Hasil Verifikasi Automated Testing Aktual

Perintah eksekusi pengujian rule baru:
```bash
php artisan test --filter=MasterDataPrerequisiteRuleTest
```
**Hasil Eksekusi:**
```
PASS  Tests\Feature\MasterDataPrerequisiteRuleTest
✓ manual schedule creation is rejected when master data is completely empty
✓ manual schedule creation is rejected when some master data is missing
✓ manual schedule creation is allowed when master data is complete
✓ pdf import upload is rejected when master data is empty
✓ pdf import upload is rejected when teachers lack fet staff id
✓ pdf import upload is allowed when master data and fet staff id are present
✓ confirm import is rejected when matched count is zero
✓ confirm import is allowed when matched rows exist
✓ non waka users cannot access schedule store and import

Tests:    9 passed (59 assertions)
Duration: 0.94s
```

Perintah eksekusi regression test keseluruhan:
```bash
php artisan test
```
**Hasil Eksekusi Keseluruhan:**
```
Tests:    105 passed (479 assertions)
Duration: 12.43s
Result:   100% Passed (Zero Failures, Zero Errors)
```

---

### 34.4 Panduan Pengujian Postman untuk Skenario Prasyarat Master Data

#### Skenario 1: Upload Import PDF Ditolak Karena Master Data Kosong / Belum Ada Guru Ber-FET ID
- **Method:** `POST`
- **URL:** `{{base_url}}/schedule-imports`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_waka}}`
- **Body (form-data):**
  - `cycle_type`: `1`
  - `file_kelas`: `(pilih file PDF)`
  - `file_ruangan`: `(pilih file PDF)`
- **Expected Response (422 Unprocessable Entity):**
  ```json
  {
    "success": false,
    "message": "Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.",
    "errors": {
      "fet_staff_id": [
        "Belum ada guru yang memiliki nomor staf FET (fet_staff_id). Waka wajib melengkapi fet_staff_id guru untuk import PDF."
      ]
    },
    "meta": {
      "missing_entities": [
        "fet_staff_id"
      ]
    }
  }
  ```

#### Skenario 2: Pembuatan Jadwal Manual Ditolak Karena Master Data Kosong
- **Method:** `POST`
- **URL:** `{{base_url}}/schedules`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "cycle_type": 1,
    "day_of_week": 1,
    "period_number": 1,
    "duration_periods": 2,
    "teacher_id": 1,
    "class_id": 1,
    "room_id": 1,
    "subject_id": 1,
    "password": "password"
  }
  ```
- **Expected Response (422 Unprocessable Entity):**
  ```json
  {
    "success": false,
    "message": "Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.",
    "errors": {
      "classes": [
        "Master data kelas masih kosong. Waka wajib mendaftarkan kelas terlebih dahulu."
      ],
      "rooms": [
        "Master data ruangan masih kosong. Waka wajib mendaftarkan ruangan terlebih dahulu."
      ]
    },
    "meta": {
      "missing_entities": [
        "classes",
        "rooms"
      ]
    }
  }
  ```

#### Skenario 3: Konfirmasi Import Ditolak Jika Matched Count = 0
- **Method:** `POST`
- **URL:** `{{base_url}}/schedule-imports/{{import_id}}/confirm`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_waka}}`
- **Body raw JSON:**
  ```json
  {
    "password": "password"
  }
  ```
- **Expected Response (422 Unprocessable Entity):**
  ```json
  {
    "success": false,
    "message": "Konfirmasi gagal. Tidak ada baris jadwal yang berstatus matched untuk dimasukkan ke jadwal aktif.",
    "errors": {
      "import": [
        "Seluruh baris import masih berstatus unmatched atau conflict. Harap lengkapi master data atau lakukan resolusi baris terlebih dahulu."
      ]
    }
  }
  ```

---

# Dokumentasi Perencanaan Fase 4: Alur Jurnal KBM, Presensi Exception-Based & Hak Eksklusif Guru Pengganti Kesiswaan

**Proyek:** School Class Progress (SCP) — Backend REST API  
**Modul Terdampak:** Jurnal Mengajar Guru (PRD 5.7, 5.8, 5.11, 9.7), Presensi Siswa (PRD 9.6), dan Otorisasi Penugasan Kesiswaan vs Wali Kelas  
**Acuan Spesifikasi:** `MD/PRD.md` (Catatan Revisi, Bagian 3, 5.7, 5.8, 9.7) dan `MD/MASTER_IMPROVEMENT_PLAN.md` (Fase 4)  
**Status Fase 4:** **Selesai Diimplementasikan & Terverifikasi Pengujian Otomatis 100% (122 Tests Pass)**  

---

## 35. Ringkasan Implementasi Fase 4

### 35.1 Analisis & Realisasi Masalah
1. **Penegakan Hak Eksklusif Guru Pengganti (Kesiswaan Only):**
   - Diimplementasikan di `JournalController@store` dan `JournalController@update`.
   - Hanya guru yang memiliki penugasan struktural `kesiswaan` (`teacher_assignments.type = 'kesiswaan'`) yang berhak bertindak sebagai Guru Pengganti (`substitute_teacher_id`) untuk membuka dan menyelesaikan jurnal mengajar serta presensi KBM kelas saat guru utama berhalangan hadir.
   - Wali Kelas dari kelas terkait maupun guru mata pelajaran reguler lainnya tanpa penugasan Kesiswaan secara tegas **DITOLAK LANGSUNG DENGAN STATUS HTTP 403 FORBIDDEN**.
2. **Penyatuan Endpoint Jurnal Atomik (`PUT /api/journals/{id}`):**
   - Menggantikan alur lama yang terpecah (`/attendance` dan `/complete`).
   - Menerima `topic_description`, berkas gambar `photo`, dan array `exceptions` presensi siswa.
   - Seluruh mutasi dijalankan dalam satu transaksi database `DB::transaction()`.
3. **Standarisasi Kompresi Foto (PRD 5.11):**
   - Menggunakan `Intervention Image` untuk resize lebar maksimum ~800px (`scaleDown(width: 800)`) dan encode ke JPEG dengan kualitas 35% (`encodeUsingFileExtension('jpg', quality: 35)`).
   - Target ukuran file di bawah 150KB tercapai dan terverifikasi via automated testing.
4. **Presensi Exception-Based & Sinkronisasi Perizinan (PRD 5.8 & 5.9):**
   - Siswa yang tidak disebutkan dalam array `exceptions` otomatis tercatat sebagai **Hadir**.
   - Terintegrasi langsung dengan tabel `leave_requests` approved bertipe `tidak_masuk` (Sakit otomatis menjadi status `Sakit`, lainnya menjadi status `Izin`).
5. **Endpoint Monitoring Ter-scoped (PRD 9.6 & 9.7):**
   - `GET /api/journals`: Waka & Kesiswaan dapat melihat rekap seluruh sekolah; Guru biasa hanya melihat jurnal miliknya atau yang digantikannya.
   - `GET /api/attendances`: Waka & Kesiswaan melihat seluruh sekolah; Wali Kelas otomatis ter-scoped pada kelas binaannya; Siswa & Orang Tua auto-scoped pada data mandiri / anak.

---

## 36. File yang Dibuat & Diubah

| No | File | Tipe | Deskripsi & Tanggung Jawab |
|---|---|---|---|
| 1 | `app/Models/User.php` | Diperbarui | Menambahkan helper method `hasAssignment(string $type)`, `isKesiswaan()`, dan `isWaliKelas(?int $classId)`. |
| 2 | `app/Http/Controllers/API/JournalController.php` | Diperbarui Penuh | Menangani `index` (rekap jurnal ter-scoped), `show` (detail jurnal & presensi), `store` (buka sesi KBM / tandai `teacher_absent`), `markTeacherAbsent` (patch `teacher_absent`), dan `update` (penyelesaian jurnal atomik + kompresi foto + presensi exception-based). |
| 3 | `app/Http/Controllers/API/AttendanceController.php` | Diperbarui | Menambahkan method `index` untuk `GET /api/attendances` dengan scoping multi-role (Waka, Kesiswaan, Wali Kelas, Guru Mapel, Siswa, Orang Tua), serta menyelaraskan validasi perizinan `LeaveRequest`. |
| 4 | `app/Http/Controllers/API/SubstituteAssignmentController.php` | Diperbarui | Menambahkan validasi ketat bahwa guru pengganti yang ditugaskan wajib berstatus Kesiswaan. |
| 5 | `routes/api.php` | Diperbarui | Mendaftarkan route `GET /attendances`, `GET /journals`, `GET /journals/{id}`, `POST /journals`, `PATCH /journals/{id}`, dan `PUT/POST /journals/{id}` dengan middleware otorisasi yang presisi. |
| 6 | `tests/Feature/JournalAndAttendanceTest.php` | Baru | Suite pengujian feature komprehensif berisikan 17 skenario pengujian Fase 4 (lulus 100%). |

---

## 37. Potongan Kode Utama yang Diimplementasikan

### 37.1 Otorisasi Eksklusif Pengganti Kesiswaan pada `JournalController.php`
```php
// app/Http/Controllers/API/JournalController.php (method store)
$isOriginalTeacher = ($schedule->teacher_id === $user->id);
$isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
$isWaka = ($user->role === 'vice_principal');

// Penegakan Otorisasi Baru: Wali Kelas dan Guru reguler dilarang keras membuka/menggantikan jadwal guru lain
if (!$isOriginalTeacher && !$isKesiswaan && !$isWaka) {
    return response()->json([
        'success' => false,
        'message' => 'Akses ditolak. Hanya guru pengajar jadwal atau Guru Kesiswaan yang berhak membuka atau menggantikan jadwal ini.',
    ], 403);
}

// Skenario 1: Menandai status teacher_absent
if ($request->input('status') === 'teacher_absent') {
    if (!$isKesiswaan && !$isWaka) {
        return response()->json([
            'success' => false,
            'message' => 'Hanya Guru Kesiswaan atau Waka Kurikulum yang berhak menandai status guru berhalangan hadir (teacher_absent).',
        ], 403);
    }
    // Update atau buat jurnal dengan status teacher_absent
}

// Skenario 2: Membuka sesi KBM ongoing
// Jika bukan original teacher, maka wajib Kesiswaan yang menjadi substitute_teacher_id
$substituteTeacherId = (!$isOriginalTeacher && $isKesiswaan) ? $user->id : null;
$journal = Journal::firstOrCreate(
    ['schedule_id' => $schedule->id, 'date' => $today],
    ['status' => 'ongoing', 'substitute_teacher_id' => $substituteTeacherId]
);
```

### 37.2 Penyelesaian Jurnal Atomik & Kompresi Foto Standar PRD 5.11
```php
// app/Http/Controllers/API/JournalController.php (method update)
$journal = Journal::with('schedule')->findOrFail($id);
$user = $request->user();

$isOriginalTeacher = ($journal->schedule->teacher_id === $user->id);
$isAuthorizedSubstitute = ($journal->substitute_teacher_id === $user->id && $user->isKesiswaan());

if (!$isOriginalTeacher && !$isAuthorizedSubstitute) {
    return response()->json([
        'success' => false,
        'message' => 'Akses ditolak. Anda tidak memiliki izin untuk mengisi atau menyelesaikan jurnal ini.',
    ], 403);
}

// Kompresi Gambar: Lebar maks ~800px, JPEG quality 35% (< 150KB)
$file = $request->file('photo');
$img = Image::decode($file);
$img->scaleDown(width: 800);
$encoded = $img->encodeUsingFileExtension('jpg', quality: 35);

$filename = 'journals/' . Str::uuid() . '.jpg';
Storage::disk('public')->put($filename, (string) $encoded);

DB::transaction(function () use ($journal, $request, $filename, $journalDate, $classId, &$insertedCount) {
    // 1. Ambil seluruh siswa aktif di kelas
    $allStudents = User::where('role', 'student')->where('class_id', $classId)->get();

    // 2. Ambil izin approved tidak_masuk hari ini (PRD 5.9)
    $approvedLeaves = LeaveRequest::where('status_approval', 'approved')
        ->where('type', 'tidak_masuk')
        ->whereDate('start_date', '<=', $journalDate)
        ->whereDate('end_date', '>=', $journalDate)
        ->get()->keyBy('student_id');

    // 3. Susun presensi: exceptions -> approved leaves -> sisa default Hadir
    $manualExceptions = collect($request->input('exceptions', []))->keyBy('student_id');
    // ...
    Attendance::where('journal_id', $journal->id)->delete();
    Attendance::insert($attendanceData);

    $journal->update([
        'topic_description' => $request->topic_description,
        'photo_path' => $filename,
        'status' => 'completed',
    ]);
});
```

---

## 38. Hasil Eksekusi Automated Testing Aktual

### 38.1 Test Suite Khusus Fase 4 (`JournalAndAttendanceTest`)
```bash
php artisan test --filter=JournalAndAttendanceTest
```
**Output Eksekusi:**
```
PASS  Tests\Feature\JournalAndAttendanceTest
✓ original teacher can open journal session
✓ kesiswaan can open journal as substitute teacher
✓ kesiswaan can mark teacher absent via store
✓ waka can mark teacher absent via store
✓ wali kelas is forbidden from opening or substituting journal
✓ regular teacher without kesiswaan is forbidden from substituting
✓ student and parent cannot open journal
✓ kesiswaan or waka can mark ongoing journal as teacher absent via patch
✓ wali kelas cannot patch journal to teacher absent
✓ atomic put journal completion with exception based attendance
✓ kesiswaan as substitute can complete journal and attendance
✓ wali kelas cannot complete journal of other teacher
✓ approved leave requests are synced to attendance
✓ journal index scoping
✓ attendance index scoping
✓ photo compression conforms to prd specs
✓ journal show scoping

Tests:    17 passed (70 assertions)
Duration: 3.71s
```

### 38.2 Regression Test Menyeluruh (Full Test Suite)
```bash
php artisan test
```
**Output Eksekusi:**
```
Tests:    122 passed (549 assertions)
Duration: 14.48s
Result:   100% Passed (Zero Failures, Zero Errors)
```

---

## 39. Panduan Pengujian Endpoint melalui Postman (Fase 4)

### 39.1 Prasyarat & Autentikasi Pengujian

Untuk melakukan pengujian endpoint Fase 4 di Postman, siapkan environment variable:
- `base_url`: `http://127.0.0.1:8000/api`
- Dapatkan token autentikasi melalui `POST {{base_url}}/login`:
  - **Akun Waka Kurikulum:** Body: `{ "nis_nip": "197001011990011001", "password": "password" }` ➔ Simpan token ke variable `token_waka`.
  - **Akun Guru Utama:** Body: `{ "nis_nip": "198001012010011001", "password": "password" }` ➔ Simpan token ke variable `token_guru_utama`.
  - **Akun Guru Kesiswaan:** Akun guru yang memiliki record di `teacher_assignments` bertipe `kesiswaan` ➔ Simpan token ke variable `token_kesiswaan`.
  - **Akun Guru Wali Kelas:** Akun guru yang memiliki record di `teacher_assignments` bertipe `wali_kelas` ➔ Simpan token ke variable `token_wali_kelas`.
  - **Akun Siswa:** Body: `{ "nis_nip": "12345", "password": "password" }` ➔ Simpan token ke variable `token_siswa`.

---

### 39.2 Endpoint 1: Buka Sesi Jurnal KBM (`POST /api/journals`)

- **Method:** `POST`
- **URL:** `{{base_url}}/journals`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_guru_utama}}` *(atau `{{token_kesiswaan}}`)*
- **Body raw JSON (Kasus 1: Buka KBM Normal):**
  ```json
  {
    "schedule_id": 1
  }
  ```
- **Expected Response (201 Created - Dibuka Guru Utama):**
  ```json
  {
    "success": true,
    "message": "Jurnal KBM berhasil dibuka.",
    "data": {
      "id": 15,
      "schedule_id": 1,
      "date": "2026-10-21",
      "status": "ongoing",
      "substitute_teacher_id": null,
      "schedule": {
        "id": 1,
        "subject": { "id": 2, "name": "Pemrograman Berorientasi Objek" },
        "school_class": { "id": 1, "name": "XII RPL 1", "level": 12 }
      }
    },
    "meta": {
      "approved_leaves": []
    }
  }
  ```

- **Body raw JSON (Kasus 2: Dibuka oleh Kesiswaan sebagai Guru Pengganti):**
  Gunakan header `Authorization: Bearer {{token_kesiswaan}}` dengan body yang sama:
  - **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Jurnal KBM berhasil dibuka.",
    "data": {
      "id": 15,
      "schedule_id": 1,
      "date": "2026-10-21",
      "status": "ongoing",
      "substitute_teacher_id": 3
    }
  }
  ```

- **Body raw JSON (Kasus 3: Kesiswaan/Waka Menandai `teacher_absent`):**
  ```json
  {
    "schedule_id": 1,
    "status": "teacher_absent"
  }
  ```
  - **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Jadwal berhasil ditandai sebagai guru berhalangan hadir (teacher_absent).",
    "data": {
      "id": 15,
      "schedule_id": 1,
      "date": "2026-10-21",
      "status": "teacher_absent",
      "substitute_teacher_id": null
    }
  }
  ```

- **Skenario Penolakan Wali Kelas & Guru Reguler (403 Forbidden):**
  Kirim request menggunakan token Wali Kelas (`Bearer {{token_wali_kelas}}`) untuk jadwal guru lain:
  - **Expected Response (403 Forbidden):**
  ```json
  {
    "success": false,
    "message": "Akses ditolak. Hanya guru pengajar jadwal atau Guru Kesiswaan yang berhak membuka atau menggantikan jadwal ini."
  }
  ```

---

### 39.3 Endpoint 2: Penyelesaian Jurnal Atomik & Presensi (`PUT /api/journals/{id}`)

- **Method:** `POST` *(dengan method spoofing `_method=PUT`)* atau `PUT`
- **URL:** `{{base_url}}/journals/15`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_guru_utama}}` *(atau `{{token_kesiswaan}}` jika terdaftar sebagai pengganti)*
- **Body (form-data):**
  - `_method`: `PUT`
  - `topic_description`: `Implementasi encapsulation, inheritance, dan polymorphism pada controller Laravel.`
  - `photo`: `(Pilih berkas foto kegiatan belajar mengajar: jpg/jpeg/png)`
  - `exceptions[0][student_id]`: `10`
  - `exceptions[0][status]`: `Sakit`
  - `exceptions[1][student_id]`: `12`
  - `exceptions[1][status]`: `Izin`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Jurnal KBM dan presensi berhasil diselesaikan.",
    "data": {
      "id": 15,
      "schedule_id": 1,
      "date": "2026-10-21",
      "topic_description": "Implementasi encapsulation, inheritance, dan polymorphism pada controller Laravel.",
      "photo_path": "journals/4b568726-0e12-4cf0-8b1b-85fae44dbba1.jpg",
      "status": "completed",
      "substitute_teacher_id": null
    },
    "meta": {
      "total_students_attendance": 36
    }
  }
  ```

- **Skenario Penolakan Wali Kelas / Guru Lain (403 Forbidden):**
  Jika Wali Kelas mencoba menyelesaikan jurnal ini:
  ```json
  {
    "success": false,
    "message": "Akses ditolak. Anda tidak memiliki izin untuk mengisi atau menyelesaikan jurnal ini."
  }
  ```

- **Skenario Validasi Materi Terlalu Pendek (422 Unprocessable Entity):**
  Jika `topic_description` kurang dari 10 karakter:
  ```json
  {
    "success": false,
    "message": "Validasi gagal.",
    "errors": {
      "topic_description": [
        "The topic description field must be at least 10 characters."
      ]
    }
  }
  ```

---

### 39.4 Endpoint 3: Menandai `teacher_absent` pada Jurnal Aktif (`PATCH /api/journals/{id}`)

- **Method:** `PATCH`
- **URL:** `{{base_url}}/journals/15`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_kesiswaan}}` *(atau `{{token_waka}}`)*
- **Body:** Kosong (tidak membutuhkan request body).
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Status jurnal berhasil diubah menjadi guru berhalangan hadir (teacher_absent).",
    "data": {
      "id": 15,
      "schedule_id": 1,
      "status": "teacher_absent",
      "substitute_teacher_id": null
    }
  }
  ```
- **Skenario Akses Bukan Kesiswaan/Waka (403 Forbidden):**
  ```json
  {
    "success": false,
    "message": "Akses ditolak. Hanya Guru Kesiswaan atau Waka Kurikulum yang berhak menandai status guru berhalangan hadir."
  }
  ```

---

### 39.5 Endpoint 4: Monitoring Riwayat Jurnal (`GET /api/journals`)

- **Method:** `GET`
- **URL:** `{{base_url}}/journals?status=completed&per_page=10`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_waka}}` *(melihat semua)* atau `Bearer {{token_guru_utama}}` *(auto-scoped miliknya)*
- **Query Parameters (Opsional):**
  - `date`: `2026-10-21` (filter tanggal spesifik)
  - `start_date` & `end_date`: rentang tanggal
  - `class_id`: ID kelas
  - `teacher_id`: ID guru
  - `status`: `ongoing` / `completed` / `teacher_absent`
  - `per_page`: `10`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data jurnal berhasil diambil.",
    "data": [
      {
        "id": 15,
        "schedule_id": 1,
        "date": "2026-10-21",
        "topic_description": "Implementasi encapsulation, inheritance, dan polymorphism pada controller Laravel.",
        "photo_path": "journals/4b568726-0e12-4cf0-8b1b-85fae44dbba1.jpg",
        "status": "completed",
        "schedule": {
          "id": 1,
          "subject": { "id": 2, "name": "Pemrograman Berorientasi Objek" },
          "school_class": { "id": 1, "name": "XII RPL 1", "level": 12 },
          "teacher": { "id": 2, "name": "Guru A (Utama)", "nis_nip": "198001012010011001" }
        },
        "substitute_teacher": null
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

### 39.6 Endpoint 5: Detail Jurnal & Presensi Kelas (`GET /api/journals/{id}`)

- **Method:** `GET`
- **URL:** `{{base_url}}/journals/15`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_guru_utama}}` *(atau Kesiswaan/Waka)*
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Detail jurnal berhasil diambil.",
    "data": {
      "id": 15,
      "schedule_id": 1,
      "date": "2026-10-21",
      "topic_description": "Implementasi encapsulation, inheritance, dan polymorphism.",
      "photo_path": "journals/4b568726-0e12-4cf0-8b1b-85fae44dbba1.jpg",
      "status": "completed",
      "schedule": { ... },
      "attendances": [
        {
          "id": 101,
          "student_id": 10,
          "status": "Sakit",
          "student": { "id": 10, "name": "Siswa Satu", "nis_nip": "1001" }
        },
        {
          "id": 102,
          "student_id": 11,
          "status": "Hadir",
          "student": { "id": 11, "name": "Siswa Dua", "nis_nip": "1002" }
        }
      ]
    }
  }
  ```

---

### 39.7 Endpoint 6: Rekapitulasi Presensi Multi-Role (`GET /api/attendances`)

- **Method:** `GET`
- **URL:** `{{base_url}}/attendances?status=Alpa`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_wali_kelas}}` *(melihat kelasnya)* atau `Bearer {{token_kesiswaan}}` *(melihat sekolah)* atau `Bearer {{token_siswa}}` *(melihat diri sendiri)*
- **Query Parameters (Opsional):**
  - `date`: `2026-10-21`
  - `class_id`: ID kelas
  - `student_id`: ID siswa
  - `status`: `Hadir` / `Sakit` / `Izin` / `Alpa`
  - `per_page`: `15`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data presensi berhasil diambil.",
    "data": [
      {
        "id": 101,
        "journal_id": 15,
        "student_id": 10,
        "status": "Alpa",
        "date": "2026-10-21",
        "student": {
          "id": 10,
          "name": "Siswa Satu",
          "nis_nip": "1001",
          "school_class": { "id": 1, "name": "XII RPL 1" }
        },
        "journal": {
          "id": 15,
          "topic_description": "Implementasi encapsulation, inheritance, dan polymorphism."
        }
      }
    ],
    "meta": {
      "current_page": 1,
      "per_page": 15,
      "total": 1,
      "last_page": 1
    }
  }
  ```

---

# Dokumentasi Perkembangan Proyek: Fase 5 (Manajemen Perizinan Siswa / `leave_requests` & Sinkronisasi Presensi)

**Proyek:** School Class Progress (SCP) — Backend REST API  
**Fase:** Fase 5 (Manajemen Perizinan Siswa / `leave_requests`)  
**Acuan Spesifikasi:** `MD/PRD.md` (v4.4, Bagian 5.9, 5.10, 6, 9.6) & `MD/MASTER_IMPROVEMENT_PLAN.md`  
**Waktu Eksekusi:** 2026-10-21  
**Status Fase:** Selesai (100% Lolos Pengujian Otomatis, 139/139 Tests Passed)

---

## 40. Ringkasan Perubahan & Tujuan Fase 5

Fase 5 berfokus pada implementasi menyeluruh sistem pengajuan, verifikasi, monitoring, pembatalan, dan sinkronisasi perizinan siswa berbasis model resmi `leave_requests` (menggantikan legacy `student_permisions` secara permanen). Sistem ini mengintegrasikan seluruh alur bisnis yang diamanatkan dalam PRD v4.4:

1. **Siklus Hidup Lengkap Perizinan Siswa (`leave_requests`)**:
   - Mendukung 2 Tipe Perizinan x 2 Kategori:
     - Tipe `tidak_masuk`: Berlaku multi-hari (`start_date`, `end_date`), kolom jam keluar/kembali otomatis diset `null`.
     - Tipe `keluar_sekolah`: Berlaku dalam satu hari yang sama (`start_date` = `end_date`), wajib mencantumkan jam keluar sekolah (`departure_time`) dan perkiraan kembali (`expected_return_time`).
     - Kategori `sakit`: Wajib melampirkan berkas bukti pendukung (misal: surat keterangan dokter).
     - Kategori `lainnya`: Lampiran bukti dokumen bersifat opsional.
2. **Fleksibilitas Pemohon Ganda (Dual-Applicant)**:
   - Pengajuan dapat dilakukan oleh **Siswa** (untuk dirinya sendiri) atau oleh **Orang Tua** (`role: parent`) atas nama anaknya.
   - Sistem memvalidasi kaitan akun orang tua dengan siswa melalui kolom `users.linked_student_id`. Jika orang tua belum ditautkan dengan siswa, sistem menolak pengajuan dengan response 422 Unprocessable Content.
3. **Penyimpanan Berkas Lampiran yang Aman**:
   - Mendukung format file gambar (`jpg, jpeg, png`) dan dokumen digital (`pdf`) dengan batas ukuran maksimal 2MB.
   - Disimpan secara aman pada disk storage `public` di direktori `leaves/` dengan penamaan hash acak unik.
4. **Alur Kerja Verifikasi & Audit Trail Dua Arah (`PATCH /api/leave-requests/{id}`)**:
   - **Verifikasi oleh Staf Berwenang**: Hanya Guru dengan penugasan `kesiswaan` atau Waka Kurikulum (`waka`) yang berhak memverifikasi izin menjadi `approved` (disetujui) atau `rejected` (ditolak). Saat diverifikasi, sistem secara otomatis mencatat audit trail identitas verifikator (`verified_by = auth()->id()`) dan stempel waktu persetujuan (`verified_at = now()`).
   - **Pembaruan oleh Pemohon**: Siswa atau Orang Tua pemohon dapat memperbarui informasi pengajuan (alasan/kategori, tanggal, jam, maupun berkas dokumen) selama status izin masih `pending`. Apabila izin sudah diverifikasi (status `approved` atau `rejected`), sistem menolak modifikasi dengan HTTP 422.
5. **Pembatalan Aman & Pembersihan Berkas (`DELETE /api/leave-requests/{id}`)**:
   - Pemohon (Siswa atau Orang Tua) berhak membatalkan perizinan yang masih berstatus `pending`.
   - Proses pembatalan menghapus baris database sekaligus secara otomatis menghapus berkas dokumen fisik dari storage disk (`Storage::disk('public')->delete(...)`), mencegah penumpukan file sampah (*storage leak*).
   - Pengajuan yang telah disetujui atau ditolak tidak dapat dihapus/dibatalkan oleh pemohon.
6. **Otorisasi & Scoping Data Berbasis Peran (`GET /api/leave-requests`)**:
   - **Waka Kurikulum & Guru Kesiswaan**: Dapat memantau seluruh daftar pengajuan izin se-sekolah.
   - **Wali Kelas**: Hanya dapat melihat daftar perizinan dari siswa-siswi yang terdaftar di kelas binaannya (`school_classes.teacher_id = auth()->id()`).
   - **Siswa**: Terkunci secara otomatis (*auto-scoped*) hanya dapat melihat data perizinan miliknya sendiri.
   - **Orang Tua**: Terkunci secara otomatis (*auto-scoped*) hanya dapat melihat perizinan atas nama anak yang terhubung dengannya.
   - **Guru Biasa**: Ditolak dengan HTTP 403 Forbidden.
7. **Penyelarasan Format Tanggal Eloquent**:
   - Menstandarkan casting atribut `start_date` dan `end_date` pada model `LeaveRequest` menggunakan `date:Y-m-d` agar output serialisasi JSON seragam berupa string `YYYY-MM-DD` dan tidak bergeser akibat konversi timezone UTC (`T00:00:00.000000Z`).

---

## 41. Daftar File yang Dibuat atau Diubah

| No | File Path | Status | Fungsi & Tanggung Jawab |
|---|---|---|---|
| 1 | `app/Http/Controllers/API/LeaveRequestController.php` | Dibuat | Controller utama RESTful perizinan siswa: `index`, `show`, `store`, `update`, dan `destroy` dengan integrasi validasi multi-tipe/kategori, otorisasi peran, scoping wali kelas/kesiswaan/pemohon, upload berkas, dan audit verifikasi. |
| 2 | `app/Models/LeaveRequest.php` | Diubah | Memperbarui casting atribut `start_date` dan `end_date` ke format `date:Y-m-d` untuk konsistensi serialisasi JSON REST API. |
| 3 | `routes/api.php` | Diubah | Mendaftarkan route API perizinan: `POST` dan `DELETE` di bawah middleware `role:student,parent`, serta `GET` (index, show) dan `PATCH` (update/verifikasi) di bawah grup terautentikasi dengan pengamanan granular di controller. |
| 4 | `tests/Feature/LeaveRequestFeatureTest.php` | Dibuat | Test suite otomatis komprehensif mencakup 17 skenario pengujian: pembuatan izin multi-hari & same-day, upload berkas, validasi gagal, proteksi hak akses peran, scoping wali kelas/siswa/ortu, verifikasi kesiswaan, edit pemohon, dan pembatalan aman beserta penghapusan berkas fisik. |

---

## 42. Potongan Kode Penting & Penjelasan Logika

### 42.1 Resolusi Pemohon Ganda & Validasi Pengajuan (`LeaveRequestController@store`)

```php
// app/Http/Controllers/API/LeaveRequestController.php
public function store(Request $request): JsonResponse
{
    $user = $request->user();

    // Resolusi student_id & applicant_id
    if ($user->role === 'student') {
        $studentId = $user->id;
    } elseif ($user->role === 'parent') {
        if (!$user->linked_student_id) {
            return response()->json([
                'success' => false,
                'message' => 'Akun orang tua belum terhubung dengan data siswa.',
            ], 422);
        }
        $studentId = $user->linked_student_id;
    } else {
        return response()->json([
            'success' => false,
            'message' => 'Akses ditolak. Pengajuan izin hanya dapat dilakukan oleh Siswa atau Orang Tua.',
        ], 403);
    }

    $isKeluarSekolah = $request->input('type') === 'keluar_sekolah';
    $isSakit = $request->input('category') === 'sakit';

    $rules = [
        'type' => ['required', 'string', Rule::in(['tidak_masuk', 'keluar_sekolah'])],
        'category' => ['required', 'string', Rule::in(['sakit', 'lainnya'])],
        'start_date' => ['required', 'date_format:Y-m-d'],
        'end_date' => [$isKeluarSekolah ? 'nullable' : 'required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        'departure_time' => [$isKeluarSekolah ? 'required' : 'nullable', 'date_format:H:i'],
        'expected_return_time' => [$isKeluarSekolah ? 'required' : 'nullable', 'date_format:H:i', 'after:departure_time'],
        'document' => [$isSakit ? 'required' : 'nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:2048'],
    ];

    $validated = $request->validate($rules);
    ...
}
```
*Penjelasan:* Logika di atas secara dinamis menyesuaikan aturan validasi berdasarkan kombinasi tipe dan kategori:
- Jika `parent`, diverifikasi bahwa akun orang tua memiliki relasi `linked_student_id` yang valid.
- Jika `type === 'keluar_sekolah'`, tanggal akhir otomatis diselaraskan dengan tanggal awal (`$endDate = $validated['start_date']`), serta mewajibkan jam keluar dan perkiraan kembali.
- Jika `category === 'sakit'`, dokumen surat keterangan dokter diwajibkan (`required`), sedangkan pada `lainnya` berkas bersifat opsional.

---

### 42.2 Penanganan Upload Dokumen & Persistensi Data (`LeaveRequestController@store`)

```php
// app/Http/Controllers/API/LeaveRequestController.php
$documentPath = null;
if ($request->hasFile('document')) {
    $documentPath = $request->file('document')->store('leaves', 'public');
}

$leaveRequest = LeaveRequest::create([
    'student_id' => $studentId,
    'applicant_id' => $user->id,
    'type' => $validated['type'],
    'category' => $validated['category'],
    'start_date' => $validated['start_date'],
    'end_date' => $endDate,
    'departure_time' => $isKeluarSekolah ? $validated['departure_time'] : null,
    'expected_return_time' => $isKeluarSekolah ? $validated['expected_return_time'] : null,
    'status_approval' => 'pending',
    'document_path' => $documentPath,
]);

$leaveRequest->load(['student.schoolClass', 'applicant']);
```
*Penjelasan:* Berkas disimpan secara terisolasi pada direktori `leaves/` disk `public`. Seluruh nilai jam pada izin bertipe `tidak_masuk` secara konsisten dinolkan (`null`) dan status awal selalu diset `'pending'`.

---

### 42.3 Otorisasi & Scoping Role pada Monitoring (`LeaveRequestController@index`)

```php
// app/Http/Controllers/API/LeaveRequestController.php
public function index(Request $request): JsonResponse
{
    $user = $request->user();
    $query = LeaveRequest::with(['student.schoolClass', 'applicant', 'verifier']);

    // Otorisasi & Scoping berdasarkan role
    if ($user->role === 'waka') {
        // Full access se-sekolah
    } elseif ($user->role === 'teacher') {
        $isKesiswaan = $user->assignments()->where('type', 'kesiswaan')->exists();
        $isWaliKelas = $user->assignments()->where('type', 'wali_kelas')->exists();

        if ($isKesiswaan) {
            // Full access se-sekolah untuk staf Kesiswaan
        } elseif ($isWaliKelas) {
            $assignedClassIds = SchoolClass::where('teacher_id', $user->id)->pluck('id');
            $query->whereHas('student', function ($q) use ($assignedClassIds) {
                $q->whereIn('class_id', $assignedClassIds);
            });
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat daftar perizinan.',
            ], 403);
        }
    } elseif ($user->role === 'student') {
        $query->where('student_id', $user->id);
    } elseif ($user->role === 'parent') {
        $query->where('student_id', $user->linked_student_id);
    } else {
        return response()->json([
            'success' => false,
            'message' => 'Akses ditolak.',
        ], 403);
    }
    ...
}
```
*Penjelasan:* Menjamin privasi dan keamanan data presensi siswa:
- Waka dan Guru Kesiswaan memiliki visibilitas global sekolah.
- Wali Kelas hanya dapat melihat data siswa di kelas yang berada di bawah perwaliannya.
- Siswa dan Orang Tua hanya melihat data keluarga mereka sendiri.
- Guru mata pelajaran tanpa penugasan struktural ditolak dengan HTTP 403 Forbidden.

---

### 42.4 Verifikasi Dua Arah & Audit Trail (`LeaveRequestController@update`)

```php
// app/Http/Controllers/API/LeaveRequestController.php
public function update(Request $request, $id): JsonResponse
{
    $leaveRequest = LeaveRequest::findOrFail($id);
    $user = $request->user();

    $isKesiswaan = $user->role === 'teacher' && $user->assignments()->where('type', 'kesiswaan')->exists();
    $isWaka = $user->role === 'waka';
    $isApplicant = $leaveRequest->applicant_id === $user->id;

    // Skenario 1: Verifikasi Persetujuan oleh Kesiswaan / Waka
    if ($request->has('status') || $request->has('status_approval')) {
        if (!$isKesiswaan && !$isWaka) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Guru Kesiswaan atau Waka Kurikulum yang berhak memverifikasi perizinan.',
            ], 403);
        }

        $validated = $request->validate([
            'status' => ['nullable', 'string', Rule::in(['approved', 'rejected'])],
            'status_approval' => ['nullable', 'string', Rule::in(['approved', 'rejected'])],
        ]);

        $newStatus = $validated['status'] ?? $validated['status_approval'];

        $leaveRequest->update([
            'status_approval' => $newStatus,
            'verified_by' => $user->id,
            'verified_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Status perizinan berhasil diperbarui menjadi ' . $newStatus . '.',
            'data' => $leaveRequest->fresh(['student.schoolClass', 'applicant', 'verifier']),
        ], 200);
    }

    // Skenario 2: Pembaruan Data Izin oleh Siswa / Orang Tua Pemohon
    if (!$isApplicant) {
        return response()->json([
            'success' => false,
            'message' => 'Akses ditolak. Hanya pemohon yang berhak mengubah isi pengajuan perizinan.',
        ], 403);
    }

    if ($leaveRequest->status_approval !== 'pending') {
        return response()->json([
            'success' => false,
            'message' => 'Pengajuan izin yang sudah diproses (' . $leaveRequest->status_approval . ') tidak dapat diubah kembali.',
        ], 422);
    }
    ...
}
```
*Penjelasan:* Endpoint `PATCH` mengenali konteks aktor secara cerdas:
- Jika membawa payload perubahan status persetujuan, sistem memeriksa otoritas verifikator (Kesiswaan/Waka), lalu otomatis mengisi kolom audit `verified_by` dan `verified_at`.
- Jika dipanggil oleh pemohon untuk mengedit data, sistem memastikan status pengajuan masih `pending`. Setiap upaya mengubah izin yang sudah diverifikasi akan ditolak dengan HTTP 422.

---

### 42.5 Pembatalan Izin & Pembersihan Berkas Fisik (`LeaveRequestController@destroy`)

```php
// app/Http/Controllers/API/LeaveRequestController.php
public function destroy(Request $request, $id): JsonResponse
{
    $leaveRequest = LeaveRequest::findOrFail($id);
    $user = $request->user();

    if ($leaveRequest->applicant_id !== $user->id) {
        return response()->json([
            'success' => false,
            'message' => 'Akses ditolak. Anda hanya dapat membatalkan pengajuan izin yang Anda buat sendiri.',
        ], 403);
    }

    if ($leaveRequest->status_approval !== 'pending') {
        return response()->json([
            'success' => false,
            'message' => 'Pengajuan izin yang sudah diverifikasi (' . $leaveRequest->status_approval . ') tidak dapat dibatalkan atau dihapus.',
        ], 422);
    }

    // Bersihkan file dokumen fisik jika ada
    if ($leaveRequest->document_path && Storage::disk('public')->exists($leaveRequest->document_path)) {
        Storage::disk('public')->delete($leaveRequest->document_path);
    }

    $leaveRequest->delete();

    return response()->json([
        'success' => true,
        'message' => 'Pengajuan izin berhasil dibatalkan dan dihapus.',
    ], 200);
}
```
*Penjelasan:* Menghindari penumpukan berkas yatim (*orphaned files*) pada disk storage server dengan memastikan berkas fisik dihapus bersamaan dengan baris data izin.

---

## 43. Endpoint API yang Dibuat atau Diubah

| No | Method | URL Endpoint | Autentikasi & Middleware | Parameter / Payload Utama | Status Code | Deskripsi & Peran Aktor |
|---|---|---|---|---|---|---|
| 1 | `POST` | `/api/leave-requests` | `auth:sanctum`, `role:student,parent` | `type`, `category`, `start_date`, `end_date`, `departure_time`, `expected_return_time`, `document` (multipart/form-data) | 201 Created / 422 Unprocessable | Siswa atau Orang Tua mengajukan perizinan baru (`tidak_masuk` atau `keluar_sekolah`). |
| 2 | `GET` | `/api/leave-requests` | `auth:sanctum` | Query params: `status`, `type`, `category`, `class_id`, `date`, `start_date`, `end_date`, `student_id`, `per_page` | 200 OK / 403 Forbidden | Monitoring perizinan dengan scoping otomatis (Waka/Kesiswaan se-sekolah, Wali Kelas se-kelas, Siswa/Ortu milik sendiri). |
| 3 | `GET` | `/api/leave-requests/{id}` | `auth:sanctum` | URL Param: `{id}` | 200 OK / 403 Forbidden / 404 Not Found | Melihat rincian lengkap satu perizinan beserta informasi siswa, kelas, pemohon, dan verifikator. |
| 4 | `PATCH` | `/api/leave-requests/{id}` | `auth:sanctum` | Body JSON: `{ "status": "approved" \| "rejected" }` (Verifikator) ATAU `{ "category": "...", "start_date": "...", ... }` (Pemohon) | 200 OK / 403 Forbidden / 422 Unprocessable | Verifikasi status persetujuan oleh Kesiswaan/Waka ATAU pembaruan data izin oleh pemohon selama masih `pending`. |
| 5 | `DELETE` | `/api/leave-requests/{id}` | `auth:sanctum`, `role:student,parent` | URL Param: `{id}` | 200 OK / 403 Forbidden / 422 Unprocessable | Pembatalan pengajuan izin oleh Siswa/Orang Tua pemohon selama status masih `pending` sekaligus pembersihan berkas fisik. |

---

## 44. Command yang Dijalankan, Hasil Automated Testing, & Kendala

### 44.1 Command yang Dijalankan

1. **Uji Coba Fitur Perizinan Siswa Spesifik (`LeaveRequestFeatureTest`)**:
   ```bash
   php artisan test --filter=LeaveRequestFeatureTest
   ```
   *Tujuan:* Menjalankan seluruh 17 skenario automated test untuk memastikan semua cabang logika controller, otorisasi, upload dokumen, edit, dan pembatalan berfungsi sesuai spesifikasi PRD v4.4.
   *Hasil:* **17 passed** dari 17 tests (62 assertions, durasi 1.59s).

2. **Uji Coba Regresi Penuh Seluruh Test Suite Project (`All Tests`)**:
   ```bash
   php artisan test
   ```
   *Tujuan:* Memastikan penambahan modul perizinan siswa tidak menyebabkan efek samping atau mematahkan 122 test sebelumnya dari Fase 0 hingga Fase 4.
   *Hasil:* **139 passed** dari 139 tests (611 assertions, durasi 12.91s, 0 failed, 100% lolos).

### 44.2 Kendala yang Ditemukan dan Solusinya

- **Kendala Serialisasi ISO 8601 Tanggal**:
  - *Deskripsi Masalah:* Pada model `LeaveRequest`, casting `'start_date' => 'date'` secara bawaan memformat tanggal menggunakan format standar datetime Laravel dengan zona waktu UTC (`2026-10-24T17:00:00.000000Z` dari basis data tanggal `2026-10-25` di zona Asia/Jakarta). Hal ini mengakibatkan ketidaksesuaian perbandingan JSON pada pengujian unit dan berpotensi membingungkan frontend mobile/web yang menerima tanggal dengan selisih -1 hari akibat konversi UTC.
  - *Solusi:* Memperbarui atribut casting pada `app/Models/LeaveRequest.php` menjadi `'start_date' => 'date:Y-m-d'` dan `'end_date' => 'date:Y-m-d'`. Dengan demikian, nilai tanggal diekspor secara konsisten dalam format ISO `YYYY-MM-DD` (`2026-10-25`) murni tanpa distorsi jam dan zona waktu.

---

## 45. Panduan Pengujian Endpoint melalui Postman (Fase 5)

Berikut adalah panduan langkah demi langkah pengujian seluruh endpoint Fase 5 melalui Postman:

### 45.1 Pengujian 1: Pengajuan Izin Siswa Sakit Multi-Hari (`tidak_masuk`)

- **Method:** `POST`
- **URL:** `{{base_url}}/leave-requests`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_siswa}}`
- **Body:** `form-data` (Multipart)
  | Key | Type | Value | Keterangan |
  |---|---|---|---|
  | `type` | Text | `tidak_masuk` | Wajib (`tidak_masuk` atau `keluar_sekolah`) |
  | `category` | Text | `sakit` | Wajib (`sakit` atau `lainnya`) |
  | `start_date` | Text | `2026-10-25` | Format YYYY-MM-DD |
  | `end_date` | Text | `2026-10-27` | Format YYYY-MM-DD (>= start_date) |
  | `document` | File | `[Pilih file surat_dokter.pdf atau .jpg]` | Wajib untuk kategori sakit (max 2MB) |
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Pengajuan perizinan berhasil dikirim.",
    "data": {
      "id": 1,
      "student_id": 10,
      "applicant_id": 10,
      "type": "tidak_masuk",
      "category": "sakit",
      "start_date": "2026-10-25",
      "end_date": "2026-10-27",
      "departure_time": null,
      "expected_return_time": null,
      "status_approval": "pending",
      "document_path": "leaves/u10_abc123.pdf",
      "verified_by": null,
      "verified_at": null,
      "created_at": "2026-10-21T06:17:48.000000Z",
      "student": {
        "id": 10,
        "name": "Siswa Satu",
        "nis_nip": "1001",
        "class_id": 1,
        "school_class": { "id": 1, "name": "XII RPL 1", "level": "12" }
      },
      "applicant": {
        "id": 10,
        "name": "Siswa Satu",
        "role": "student"
      }
    }
  }
  ```

---

### 45.2 Pengujian 2: Pengajuan Izin Keluar Sekolah Same-Day (`keluar_sekolah`)

- **Method:** `POST`
- **URL:** `{{base_url}}/leave-requests`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_siswa}}`
- **Body:** `form-data` (Multipart)
  | Key | Type | Value | Keterangan |
  |---|---|---|---|
  | `type` | Text | `keluar_sekolah` | Tipe izin keluar sementara |
  | `category` | Text | `lainnya` | Kategori |
  | `start_date` | Text | `2026-10-25` | Tanggal izin keluar |
  | `departure_time` | Text | `09:30` | Format HH:mm (Wajib untuk keluar_sekolah) |
  | `expected_return_time` | Text | `11:30` | Format HH:mm (Wajib, setelah departure_time) |
  | `document` | File | `[Opsional]` | Dapat dikosongkan untuk kategori lainnya |
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Pengajuan perizinan berhasil dikirim.",
    "data": {
      "id": 2,
      "student_id": 10,
      "applicant_id": 10,
      "type": "keluar_sekolah",
      "category": "lainnya",
      "start_date": "2026-10-25",
      "end_date": "2026-10-25",
      "departure_time": "09:30",
      "expected_return_time": "11:30",
      "status_approval": "pending",
      "document_path": null
    }
  }
  ```

---

### 45.3 Pengujian 3: Pengajuan Izin oleh Orang Tua untuk Anaknya

- **Method:** `POST`
- **URL:** `{{base_url}}/leave-requests`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_orang_tua}}`
- **Body:** `form-data` (Multipart)
  | Key | Type | Value |
  |---|---|---|
  | `type` | Text | `tidak_masuk` |
  | `category` | Text | `lainnya` |
  | `start_date` | Text | `2026-10-28` |
  | `end_date` | Text | `2026-10-28` |
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Pengajuan perizinan berhasil dikirim.",
    "data": {
      "id": 3,
      "student_id": 10,
      "applicant_id": 25,
      "type": "tidak_masuk",
      "category": "lainnya",
      "status_approval": "pending",
      "student": {
        "id": 10,
        "name": "Siswa Satu"
      },
      "applicant": {
        "id": 25,
        "name": "Bapak Siswa Satu",
        "role": "parent"
      }
    }
  }
  ```

---

### 45.4 Pengujian 4: Validasi Gagal (Kategori Sakit Tanpa Berkas / Waktu Salah)

- **Kasus A: Kategori `sakit` tanpa mengunggah berkas `document`**
  - **Expected Response (422 Unprocessable Content):**
    ```json
    {
      "message": "The document field is required when category is sakit.",
      "errors": {
        "document": [
          "The document field is required when category is sakit."
        ]
      }
    }
    ```
- **Kasus B: Tipe `keluar_sekolah` tanpa menyertakan `departure_time`**
  - **Expected Response (422 Unprocessable Content):**
    ```json
    {
      "message": "The departure time field is required when type is keluar sekolah.",
      "errors": {
        "departure_time": [
          "The departure time field is required when type is keluar sekolah."
        ]
      }
    }
    ```
- **Kasus C: Orang tua belum ditautkan dengan data siswa (`linked_student_id = null`)**
  - **Expected Response (422 Unprocessable Content):**
    ```json
    {
      "success": false,
      "message": "Akun orang tua belum terhubung dengan data siswa."
    }
    ```

---

### 45.5 Pengujian 5: Verifikasi Persetujuan oleh Guru Kesiswaan (`PATCH`)

- **Method:** `PATCH`
- **URL:** `{{base_url}}/leave-requests/1`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_guru_kesiswaan}}` *(atau token Waka Kurikulum)*
- **Body (raw JSON):**
  ```json
  {
    "status": "approved"
  }
  ```
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Status perizinan berhasil diperbarui menjadi approved.",
    "data": {
      "id": 1,
      "student_id": 10,
      "applicant_id": 10,
      "status_approval": "approved",
      "verified_by": 3,
      "verified_at": "2026-10-21T06:25:00.000000Z",
      "verifier": {
        "id": 3,
        "name": "Guru Kesiswaan",
        "nis_nip": "198505052010011002"
      }
    }
  }
  ```

---

### 45.6 Pengujian 6: Verifikasi Penolakan oleh Kesiswaan / Waka (`PATCH`)

- **Method:** `PATCH`
- **URL:** `{{base_url}}/leave-requests/2`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_waka}}`
- **Body (raw JSON):**
  ```json
  {
    "status": "rejected"
  }
  ```
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Status perizinan berhasil diperbarui menjadi rejected.",
    "data": {
      "id": 2,
      "status_approval": "rejected",
      "verified_by": 1,
      "verified_at": "2026-10-21T06:26:00.000000Z"
    }
  }
  ```
- **Skenario Akses Verifikasi Ditolak (Guru Biasa):**
  - **Expected Response (403 Forbidden):**
    ```json
    {
      "success": false,
      "message": "Akses ditolak. Hanya Guru Kesiswaan atau Waka Kurikulum yang berhak memverifikasi perizinan."
    }
    ```

---

### 45.7 Pengujian 7: Pembaruan Isi Pengajuan oleh Siswa Pemohon (`PATCH`)

- **Method:** `PATCH`
- **URL:** `{{base_url}}/leave-requests/1` *(Ketika status masih `pending`)*
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_siswa}}`
- **Body (raw JSON):**
  ```json
  {
    "category": "lainnya",
    "start_date": "2026-10-26",
    "end_date": "2026-10-28"
  }
  ```
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data pengajuan perizinan berhasil diperbarui.",
    "data": {
      "id": 1,
      "category": "lainnya",
      "start_date": "2026-10-26",
      "end_date": "2026-10-28",
      "status_approval": "pending"
    }
  }
  ```

---

### 45.8 Pengujian 8: Ditolak Mengedit Pengajuan yang Sudah Diverifikasi (`PATCH`)

- **Method:** `PATCH`
- **URL:** `{{base_url}}/leave-requests/1` *(Setelah status menjadi `approved`)*
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_siswa}}`
- **Body (raw JSON):**
  ```json
  {
    "category": "sakit"
  }
  ```
- **Expected Response (422 Unprocessable Content):**
  ```json
  {
    "success": false,
    "message": "Pengajuan izin yang sudah diproses (approved) tidak dapat diubah kembali."
  }
  ```

---

### 45.9 Pengujian 9: Monitoring & Filtering Daftar Perizinan (`GET`)

- **Method:** `GET`
- **URL:** `{{base_url}}/leave-requests?status=pending&type=tidak_masuk&per_page=10`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_kesiswaan}}` *(melihat se-sekolah)* ATAU `Bearer {{token_wali_kelas}}` *(melihat kelas binaannya)* ATAU `Bearer {{token_siswa}}` *(melihat izin sendiri)*
- **Query Parameters (Opsional):**
  - `status`: `pending` / `approved` / `rejected`
  - `type`: `tidak_masuk` / `keluar_sekolah`
  - `category`: `sakit` / `lainnya`
  - `class_id`: ID kelas siswa (khusus Kesiswaan/Waka)
  - `student_id`: ID siswa
  - `date`: Filter tanggal spesifik
  - `start_date` & `end_date`: Filter rentang tanggal
  - `per_page`: Jumlah pagination per halaman (default 15)
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data perizinan berhasil diambil.",
    "data": [
      {
        "id": 1,
        "student_id": 10,
        "applicant_id": 10,
        "type": "tidak_masuk",
        "category": "sakit",
        "start_date": "2026-10-25",
        "end_date": "2026-10-27",
        "departure_time": null,
        "expected_return_time": null,
        "status_approval": "pending",
        "document_path": "leaves/u10_abc123.pdf",
        "verified_by": null,
        "verified_at": null,
        "student": {
          "id": 10,
          "name": "Siswa Satu",
          "nis_nip": "1001",
          "school_class": {
            "id": 1,
            "name": "XII RPL 1",
            "level": "12"
          }
        },
        "applicant": {
          "id": 10,
          "name": "Siswa Satu",
          "role": "student"
        },
        "verifier": null
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

### 45.10 Pengujian 10: Detail Pengajuan Perizinan (`GET /api/leave-requests/{id}`)

- **Method:** `GET`
- **URL:** `{{base_url}}/leave-requests/1`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_siswa}}` *(pemohon / verifikator / wali kelas)*
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Detail perizinan berhasil diambil.",
    "data": {
      "id": 1,
      "student_id": 10,
      "applicant_id": 10,
      "type": "tidak_masuk",
      "category": "sakit",
      "start_date": "2026-10-25",
      "end_date": "2026-10-27",
      "departure_time": null,
      "expected_return_time": null,
      "status_approval": "pending",
      "document_path": "leaves/u10_abc123.pdf",
      "student": {
        "id": 10,
        "name": "Siswa Satu",
        "school_class": { "id": 1, "name": "XII RPL 1" }
      },
      "applicant": {
        "id": 10,
        "name": "Siswa Satu"
      },
      "verifier": null
    }
  }
  ```

---

### 45.11 Pengujian 11: Pembatalan Pengajuan oleh Pemohon (`DELETE`)

- **Method:** `DELETE`
- **URL:** `{{base_url}}/leave-requests/1`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_siswa}}` *(atau token orang tua pemohon)*
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Pengajuan izin berhasil dibatalkan dan dihapus."
  }
  ```
- **Skenario Pembatalan Gagal (Bukan Pemohon):**
  - **Expected Response (403 Forbidden):**
    ```json
    {
      "success": false,
      "message": "Akses ditolak. Anda hanya dapat membatalkan pengajuan izin yang Anda buat sendiri."
    }
    ```
- **Skenario Pembatalan Gagal (Sudah Diverifikasi `approved`/`rejected`):**
  - **Expected Response (422 Unprocessable Content):**
    ```json
    {
      "success": false,
      "message": "Pengajuan izin yang sudah diverifikasi (approved) tidak dapat dibatalkan atau dihapus."
    }
    ```

---

# Dokumentasi Perkembangan Proyek: Fase 6 (Sistem Kuis Berbantuan AI & Evaluasi Asinkron)

**Proyek:** School Class Progress (SCP) — Backend REST API  
**Fase:** Fase 6 (Sistem Kuis Berbantuan AI & Evaluasi Asinkron)  
**Acuan Spesifikasi:** `MD/PRD.md` (v4.4, Bagian 5.14, 9.8, 10) & `MD/MASTER_IMPROVEMENT_PLAN.md`  
**Waktu Eksekusi:** 2026-10-21  
**Status Fase:** Selesai (100% Lolos Pengujian Otomatis, 156/156 Tests Passed & Live E2E Verified)

---

## 46. Ringkasan Perubahan & Tujuan Fase 6

Fase 6 mengimplementasikan modul Kuis Berbantuan AI yang beroperasi sepenuhnya secara asinkron (*non-blocking*) via Laravel Queue Worker, mengintegrasikan model AI resmi `ag/gemini-3.8-flash` melalui 9router API Gateway, serta menyediakan tiga metode pembuatan soal yang fleksibel dengan kendali mutu penuh bagi guru sebelum kuis dibuka untuk siswa:

1. **Tiga Metode Pembuatan Soal**:
   - **Metode 1 (Prompt AI dengan Konfigurasi Wajib)**: Guru memasukkan instruksi materi dalam bahasa sehari-hari. Sebelum prompt dikirim, guru wajib melengkapi konfigurasi soal: `total_questions`, `question_types` (`multiple_choice`, `essay`, atau `combination`), `essay_count`, dan `mc_count`. Sistem menerapkan validasi ketat di mana jumlah soal pilihan ganda dan esai harus sama persis dengan total soal.
   - **Metode 2 (Ekstraksi Dokumen Berbantuan AI)**: Guru dapat mengunggah berkas soal (.pdf atau .txt, maksimal 5MB). Sistem mengekstrak teks dokumen dan meminta AI menyusunnya ke dalam butir-butir soal terstruktur. Prinsip utama metode ini adalah melestarikan isi, konteks, dan kunci jawaban asli tanpa mengarang soal baru. Jika terdapat teks buram atau kunci jawaban tidak ditemukan secara pasti, AI menandai butir soal dengan `needs_review: true` beserta catatan `review_note`.
   - **Metode 3 (Pembuatan Soal Manual)**: Guru dapat menambah, mengedit, atau menghapus butir soal secara manual satu per satu tanpa ketergantungan pada AI.
2. **Tahap Preview & Konfirmasi Wajib (Status `draft_review`)**:
   - Setiap butir soal—baik dari prompt AI, ekstraksi dokumen, maupun manual—wajib masuk ke tahap preview.
   - Guru dapat melihat seluruh soal, opsi jawaban, dan kunci jawaban/rubrik esai, mengoreksi kekeliruan teks, menghapus soal yang tidak sesuai, atau membatalkan proses.
   - Kuis hanya dapat diakses oleh siswa setelah guru melakukan konfirmasi publikasi (`PATCH /api/quizzes/{id}/publish` atau update status `published`).
3. **Penyembunyian Kunci Jawaban (*Data Hiding*)**:
   - Ketika siswa membuka detail kuis (`GET /api/quizzes/{id}`), atribut `correct_answer` otomatis disembunyikan (*hidden*) oleh model Eloquent.
4. **Pengerjaan Siswa & Penilaian Asinkron Hybrid**:
   - Siswa mengirim jawaban via `POST /api/quizzes/{id}/submissions`. Sistem menegakkan batasan tenggat waktu (`due_date`) dan batas percobaan (`max_attempts`).
   - Sistem mengembalikan response HTTP **202 Accepted** dan men-dispatch queue job `GradeQuizSubmissionJob` di latar belakang:
     - Soal Pilihan Ganda dikoreksi secara instan oleh logika sistem (pencocokan opsi A–D).
     - Soal Esai dievaluasi secara semantik oleh model `ag/gemini-3.8-flash` berdasarkan rubrik kata kunci, menghasilkan skor 0–100 dan umpan balik edukatif.
     - Akumulasi nilai gabungan disimpan ke kolom `ai_score` dan umpan balik ke `ai_feedback`.
5. **Kendali Guru, Override Nilai & Audit Trail**:
   - Guru dapat memantau seluruh submission siswa via `GET /api/quizzes/{id}/submissions`.
   - Guru berhak meng-override skor maupun umpan balik AI via `PATCH /api/quiz-submissions/{id}`. Setiap tindakan override otomatis mencatat audit trail: `is_overridden = true`, `overridden_by = auth()->id()`, dan `overridden_at = now()`.
   - Siswa dan orang tua hanya dapat melihat nilai akhir dan umpan balik pengerjaan via `GET /api/quizzes/{id}/submissions/me` setelah guru merilis status kuis menjadi `published_result`.

---

## 47. Daftar File yang Dibuat atau Diubah

| No | File Path | Status | Fungsi & Tanggung Jawab |
|---|---|---|---|
| 1 | `config/services.php` | Diubah | Mendaftarkan konfigurasi `ai` (base_url, api_key, model `ag/gemini-3.8-flash`, timeout, dan verify_ssl). |
| 2 | `.env` & `.env.example` | Diubah | Menambahkan variabel konfigurasi AI gateway secara aman. |
| 3 | `script/pdf_doc_extractor.py` | Dibuat | Skrip Python berbasis `pdfplumber` untuk mengekstrak isi teks seluruh halaman berkas PDF secara akurat. |
| 4 | `app/Services/AIService.php` | Dibuat | Service layer komunikasi HTTP ke 9router AI gateway: `generateFromPrompt`, `extractFromDocumentText`, `gradeEssay`, ekstraksi teks dokumen, sanitasi markdown block, dan pembersihan JSON. |
| 5 | `app/Jobs/GenerateQuizFromPromptJob.php` | Dibuat | Queue job background untuk mengeksekusi generasi soal via prompt AI dan menyimpannya ke `quiz_questions`. |
| 6 | `app/Jobs/ExtractQuizFromDocumentJob.php` | Dibuat | Queue job background untuk mengeksekusi ekstraksi butir soal dari dokumen teks/PDF dan menandai `needs_review` pada soal ambigu. |
| 7 | `app/Jobs/GenerateQuizJob.php` | Diubah | Menyelaraskan job generasi kuis umum agar menggunakan `AIService` dan skema database `ai_quizzes` terbaru. |
| 8 | `app/Jobs/GradeQuizSubmissionJob.php` | Dibuat | Queue job background untuk penilaian hybrid (koreksi PG otomatis + evaluasi esai via AI terhadap rubrik kata kunci). |
| 9 | `app/Http/Controllers/API/QuizController.php` | Diubah | Controller RESTful kuis: index (scoping role), store, show (hidden kunci untuk siswa), generatePrompt (202), extractDocument (202), questions (preview), CRUD butir soal manual, publish, submit (202), submissions review, override nilai dengan audit trail, dan mySubmission. |
| 10 | `routes/api.php` | Diubah | Pendaftaran 16 rute API Kuis AI terautentikasi dan terproteksi middleware peran guru, siswa, dan orang tua. |
| 11 | `tests/Feature/QuizFeatureTest.php` | Dibuat | Suite pengujian otomatis komprehensif mencakup 17 skenario: inisialisasi kuis, CRUD manual, validasi ketat konfigurasi prompt, generasi prompt AI, ekstraksi dokumen, preview, publikasi, submit pengerjaan, batas due date & attempt, penilaian hybrid, override nilai, dan rilis hasil. |

---

## 48. Potongan Kode Penting & Penjelasan Logika

### 48.1 Komunikasi HTTP 9router & Sanitasi JSON (`app/Services/AIService.php`)

```php
// app/Services/AIService.php
protected function sendChatCompletion(array $messages, float $temperature = 0.5): string
{
    $url = rtrim($this->baseUrl, '/') . '/chat/completions';

    $payload = [
        'model' => $this->model, // 'ag/gemini-3.8-flash'
        'stream' => false,       // Wajib false agar menghasilkan objek JSON tunggal
        'temperature' => $temperature,
        'messages' => $messages,
    ];

    $httpRequest = Http::withToken($this->apiKey)->timeout($this->timeout);
    if (!$this->verifySsl) {
        $httpRequest = $httpRequest->withoutVerifying();
    }

    $response = $httpRequest->post($url, $payload);
    ...
    return (string) $response->json('choices.0.message.content');
}
```
*Penjelasan:* Menggunakan endpoint OpenAI-compatible `/chat/completions` dengan model resmi `ag/gemini-3.8-flash`. Parameter `"stream": false` krusial agar gateway mengembalikan satu payload utuh, dan method `cleanAndParseJson()` memotong bungkus markdown (````json ... ````) sebelum di-parse ke array PHP.

---

### 48.2 Validasi Ketat Konfigurasi Soal Prompt AI (`QuizController@generatePrompt`)

```php
// app/Http/Controllers/API/QuizController.php
$total = (int) $validated['total_questions'];
$type = $validated['question_types'];
$mcCount = (int) ($validated['mc_count'] ?? 0);
$essayCount = (int) ($validated['essay_count'] ?? 0);

if ($type === 'multiple_choice') {
    $mcCount = $total;
    $essayCount = 0;
} elseif ($type === 'essay') {
    $essayCount = $total;
    $mcCount = 0;
} elseif ($type === 'combination') {
    if (($mcCount + $essayCount) !== $total) {
        return response()->json([
            'success' => false,
            'message' => "Untuk jenis kombinasi, jumlah soal pilihan ganda ({$mcCount}) dan esai ({$essayCount}) harus berjumlah sama dengan total soal ({$total}).",
        ], 422);
    }
    if ($mcCount < 1 || $essayCount < 1) {
        return response()->json([
            'success' => false,
            'message' => 'Untuk jenis kombinasi, soal pilihan ganda dan esai masing-masing minimal 1.',
        ], 422);
    }
}
```
*Penjelasan:* Memastikan bahwa sebelum AI dihubungi, konfigurasi komposisi soal sudah diverifikasi secara matematis konsisten.

---

### 48.3 Ekstraksi Dokumen & Pelestarian Konteks Asli (`app/Services/AIService.php`)

```php
// app/Services/AIService.php
public function extractFromDocumentText(string $documentText): array
{
    $systemPrompt = <<<SYS
Anda adalah asisten AI yang bertugas mengekstrak dan menstrukturkan butir soal dari isi dokumen teks.
Tujuan utama Anda adalah MEMINDAHKAN soal yang sudah ada di dokumen, BUKAN mengarang soal baru.
Pertahankan kalimat pertanyaan asli, konteks soal, pilihan opsi, dan kunci jawaban asli semaksimal mungkin.
Jika ada bagian opsi/pertanyaan/kunci yang ambigu, tidak terbaca, atau hilang di dokumen, tambahkan key "needs_review": true dan "review_note": "catatan penjelasan bagian yang meragukan".
SYS;
    ...
}
```
*Penjelasan:* Prompt ekstraksi secara eksplisit melarang halusinasi pembuatan soal baru dan mewajibkan pemberian flag `needs_review: true` pada soal dengan ketidakpastian.

---

### 48.4 Penilaian Asinkron Hybrid PG + Esai AI (`GradeQuizSubmissionJob.php`)

```php
// app/Jobs/GradeQuizSubmissionJob.php
foreach ($questions as $qId => $question) {
    $studentAns = trim((string) ($studentAnswers[$qId] ?? ''));

    if ($question->question_type === 'multiple_choice') {
        $isCorrect = (strtoupper($studentAns) === strtoupper(trim($question->correct_answer)));
        $score = $isCorrect ? 100.0 : 0.0;
        $accumulatedScore += $score;
    } else {
        // Soal Esai dievaluasi oleh AI ag/gemini-3.8-flash terhadap rubrik kata kunci
        $eval = $aiService->gradeEssay(
            questionText: $question->question_text,
            rubric: $question->correct_answer,
            studentAnswer: $studentAns
        );
        $accumulatedScore += (float) $eval['score'];
        $feedbackParts[] = "Soal #{$qNum} (Esai): Nilai {$eval['score']}/100. Evaluasi: {$eval['feedback']}";
    }
}

$finalScore = round($accumulatedScore / $totalQuestions, 2);
$submission->update([
    'ai_score' => $finalScore,
    'ai_feedback' => implode("\n", $feedbackParts),
    'grading_status' => 'graded',
]);
```
*Penjelasan:* Menggabungkan efisiensi koreksi pilihan ganda secara deterministik dengan kecerdasan semantik AI dalam menilai esai berdasarkan rubrik konsep penting.

---

### 48.5 Audit Trail Override Guru (`QuizController@overrideSubmission`)

```php
// app/Http/Controllers/API/QuizController.php
$submission->update([
    'ai_score' => round((float) $validated['score'], 2),
    'ai_feedback' => $validated['feedback'] ?? $submission->ai_feedback,
    'is_overridden' => true,
    'overridden_by' => $user->id,
    'overridden_at' => now(),
    'grading_status' => 'graded',
]);
```
*Penjelasan:* Setiap intervensi guru terhadap nilai otomatis merekam identitas verifikator dan waktu penyesuaian untuk akuntabilitas akademik.

---

## 49. Endpoint API yang Dibuat atau Diubah

| No | Method | URL Endpoint | Middleware | Payload / Parameter Utama | Status Code | Deskripsi & Peran Aktor |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/api/quizzes` | `auth:sanctum` | Query: `class_id`, `status`, `per_page` | 200 OK / 403 | Monitoring daftar kuis dengan auto-scoping peran (Guru, Siswa, Ortu, Waka). |
| 2 | `POST` | `/api/quizzes` | `auth:sanctum`, `role:teacher` | `title`, `class_id`, `due_date`, `max_attempts` | 201 Created / 422 | Inisialisasi kuis baru dalam status `draft_review`. |
| 3 | `GET` | `/api/quizzes/{id}` | `auth:sanctum` | URL Param: `{id}` | 200 OK / 403 / 404 | Detail kuis. Kunci jawaban `correct_answer` otomatis disembunyikan bagi siswa. |
| 4 | `POST` | `/api/quizzes/{id}/generate-prompt` | `auth:sanctum`, `role:teacher` | `prompt`, `total_questions`, `question_types`, `mc_count`, `essay_count`, `difficulty` | 202 Accepted / 422 | Metode 1: Generate soal AI via prompt dengan konfigurasi ketat. |
| 5 | `POST` | `/api/quizzes/{id}/extract-document` | `auth:sanctum`, `role:teacher` | `document` (multipart/form-data: PDF/TXT max 5MB) | 202 Accepted / 422 | Metode 2: Ekstraksi butir soal dari dokumen via AI dengan pelestarian konteks. |
| 6 | `GET` | `/api/quizzes/{id}/questions` | `auth:sanctum`, `role:teacher` | URL Param: `{id}` | 200 OK / 403 | Tahap Preview: Guru melihat seluruh butir soal draft, opsi, kunci, dan catatan review. |
| 7 | `POST` | `/api/quizzes/{id}/questions` | `auth:sanctum`, `role:teacher` | `question_text`, `question_type`, `options`, `correct_answer` | 201 Created / 422 | Metode 3: Tambah butir soal secara manual satu per satu tanpa AI. |
| 8 | `PUT` | `/api/quizzes/{id}/questions/{qid}` | `auth:sanctum`, `role:teacher` | `question_text`, `question_type`, `options`, `correct_answer` | 200 OK / 422 | Koreksi / edit butir soal pada tahap preview. |
| 9 | `DELETE` | `/api/quizzes/{id}/questions/{qid}` | `auth:sanctum`, `role:teacher` | URL Param: `{qid}` | 200 OK / 403 / 404 | Hapus butir soal yang tidak sesuai pada tahap preview. |
| 10 | `PATCH` | `/api/quizzes/{id}/publish` | `auth:sanctum`, `role:teacher` | URL Param: `{id}` | 200 OK / 422 | Konfirmasi & publikasikan kuis (`status: published`) agar dapat dikerjakan siswa. |
| 11 | `PATCH` | `/api/quizzes/{id}` | `auth:sanctum`, `role:teacher` | `title`, `due_date`, `max_attempts`, `status` | 200 OK / 422 | Update metadata kuis atau rilis hasil kuis (`status: published_result`). |
| 12 | `POST` | `/api/quizzes/{id}/submissions` | `auth:sanctum`, `role:student` | `answers`: `[{"question_id": 1, "answer": "B"}]` | 202 Accepted / 422 | Pengumpulan jawaban siswa (validasi due date & max attempts) memicu koreksi AI asinkron. |
| 13 | `GET` | `/api/quizzes/{id}/submissions` | `auth:sanctum`, `role:teacher` | URL Param: `{id}` | 200 OK / 403 | Guru meninjau seluruh riwayat submission siswa kelas bersangkutan. |
| 14 | `PATCH` | `/api/quiz-submissions/{id}` | `auth:sanctum`, `role:teacher` | `score` (0-100), `feedback` | 200 OK / 422 | Guru meng-override nilai & umpan balik dengan pencatatan audit trail otomatis. |
| 15 | `GET` | `/api/quizzes/{id}/submissions/me` | `auth:sanctum`, `role:student,parent` | URL Param: `{id}` | 200 OK / 403 | Siswa dan Orang Tua melihat hasil evaluasi akhir setelah kuis berstatus `published_result`. |
| 16 | `POST` | `/api/journals/{id}/quiz/generate` | `auth:sanctum`, `role:teacher` | URL Param: `{id}` | 202 Accepted / 422 | Endpoint legacy pembuatan kuis via materi jurnal (backward compatibility). |

---

## 50. Command yang Dijalankan, Hasil Automated Testing, & Kendala

### 50.1 Command yang Dijalankan

1. **Uji Coba Fitur Kuis Berbantuan AI (`QuizFeatureTest`)**:
   ```bash
   php artisan test --filter=QuizFeatureTest
   ```
   *Hasil:* **17 passed** dari 17 tests (67 assertions, durasi 1.58s, 100% lolos).
2. **Uji Coba Regresi Penuh Seluruh Test Suite Project (`Full Suite`)**:
   ```bash
   php artisan test
   ```
   *Hasil:* **156 passed** dari 156 tests (678 assertions, durasi 31.65s, 0 failed, 100% lolos hijau tanpa regresi).
3. **Uji Coba Live E2E ke 9router AI Gateway (`ag/gemini-3.8-flash`)**:
   - Memanggil `AIService::generateFromPrompt()` dengan materi *"Dasar-dasar Flutter"*, menghasilkan 1 soal PG valid dan 1 soal Esai lengkap dengan rubrik penilaian komprehensif.
   - Memanggil `AIService::gradeEssay()` terhadap jawaban esai siswa mengenai `StatefulWidget`, menghasilkan skor riil `95.0` dan umpan balik analitis profesional berbahasa Indonesia.

### 50.2 Kendala yang Ditemukan dan Solusinya

- **Kendala Sertifikat SSL cURL pada PHP CLI Windows Lokal**:
  - *Deskripsi Masalah:* Saat melakukan request live HTTP ke `https://9router.wekanz.id/v1`, PHP cURL pada mesin Windows lokal mengalami error `cURL error 60: SSL certificate problem: unable to get local issuer certificate` karena ketiadaan bundel CA root di `php.ini`.
  - *Solusi:* Menambahkan opsi konfigurasi `'verify_ssl' => env('AI_VERIFY_SSL', false)` pada `config/services.php` dan mengaktifkan `$httpRequest->withoutVerifying()` di `AIService.php` jika verifikasi dinonaktifkan di environment lokal.

---

## 51. Panduan Pengujian Endpoint melalui Postman (Fase 6)

### 51.1 Pengujian 1: Inisialisasi Kuis Baru (`POST /api/quizzes`)

- **Method:** `POST`
- **URL:** `{{base_url}}/quizzes`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_guru}}`
- **Body (raw JSON):**
  ```json
  {
    "title": "Kuis Pemrograman Mobile Flutter",
    "class_id": 1,
    "due_date": "2026-10-25 23:59:00",
    "max_attempts": 2
  }
  ```
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Kuis berhasil dibuat dalam status draft review.",
    "data": {
      "id": 1,
      "teacher_id": 2,
      "class_id": 1,
      "title": "Kuis Pemrograman Mobile Flutter",
      "status": "draft_review",
      "due_date": "2026-10-25T23:59:00.000000Z",
      "max_attempts": 2,
      "school_class": { "id": 1, "name": "XII RPL 1" }
    }
  }
  ```

---

### 51.2 Pengujian 2: Generate Soal via Prompt AI dengan Konfigurasi Wajib (`POST`)

- **Method:** `POST`
- **URL:** `{{base_url}}/quizzes/1/generate-prompt`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_guru}}`
- **Body (raw JSON):**
  ```json
  {
    "prompt": "Buatkan soal tentang dasar-dasar Flutter, StatelessWidget, StatefulWidget, dan navigasi routing",
    "total_questions": 5,
    "question_types": "combination",
    "mc_count": 3,
    "essay_count": 2,
    "difficulty": "sedang",
    "additional_notes": "Sertakan contoh potongan kode singkat pada soal pilihan ganda"
  }
  ```
- **Expected Response (202 Accepted):**
  ```json
  {
    "success": true,
    "message": "Permintaan pembuatan soal kuis sedang diproses oleh AI di latar belakang.",
    "data": {
      "quiz_id": 1,
      "status": "generating",
      "config": {
        "prompt": "Buatkan soal tentang dasar-dasar Flutter...",
        "total_questions": 5,
        "question_types": "combination",
        "mc_count": 3,
        "essay_count": 2
      }
    }
  }
  ```

---

### 51.3 Pengujian 3: Validasi Gagal Konfigurasi Prompt Tidak Seimbang (422)

- **Method:** `POST`
- **URL:** `{{base_url}}/quizzes/1/generate-prompt`
- **Body (raw JSON):**
  ```json
  {
    "prompt": "Soal Flutter",
    "total_questions": 5,
    "question_types": "combination",
    "mc_count": 3,
    "essay_count": 1
  }
  ```
- **Expected Response (422 Unprocessable Content):**
  ```json
  {
    "success": false,
    "message": "Untuk jenis kombinasi, jumlah soal pilihan ganda (3) dan esai (1) harus berjumlah sama dengan total soal (5).",
    "errors": {
      "total_questions": [
        "Total soal (5) tidak sesuai dengan penjumlahan pilihan ganda (3) dan esai (1)."
      ]
    }
  }
  ```

---

### 51.4 Pengujian 4: Ekstraksi Soal dari Berkas Dokumen PDF/TXT (`POST`)

- **Method:** `POST`
- **URL:** `{{base_url}}/quizzes/1/extract-document`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_guru}}`
- **Body:** `form-data` (Multipart)
  | Key | Type | Value | Keterangan |
  |---|---|---|---|
  | `document` | File | `[Pilih file bank_soal.pdf atau bank_soal.txt]` | Berkas teks soal (max 5MB) |
- **Expected Response (202 Accepted):**
  ```json
  {
    "success": true,
    "message": "Ekstraksi soal dari dokumen sedang diproses oleh AI di latar belakang.",
    "data": {
      "quiz_id": 1,
      "status": "generating",
      "document_name": "bank_soal.pdf",
      "file_size": 154200
    }
  }
  ```

---

### 51.5 Pengujian 5: Tambah Butir Soal Manual (`POST`)

- **Method:** `POST`
- **URL:** `{{base_url}}/quizzes/1/questions`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_guru}}`
- **Body (raw JSON):**
  ```json
  {
    "question_text": "Apa nama perintah CLI untuk membuat project Flutter baru?",
    "question_type": "multiple_choice",
    "options": {
      "A": "flutter start project",
      "B": "flutter create project_name",
      "C": "flutter init project",
      "D": "flutter new app"
    },
    "correct_answer": "B"
  }
  ```
- **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Butir soal manual berhasil ditambahkan.",
    "data": {
      "id": 10,
      "quiz_id": 1,
      "question_text": "Apa nama perintah CLI untuk membuat project Flutter baru?",
      "question_type": "multiple_choice",
      "options": { ... },
      "correct_answer": "B"
    }
  }
  ```

---

### 51.6 Pengujian 6: Tahap Preview & Edit Soal oleh Guru (`GET & PUT`)

- **Preview Daftar Soal:**
  - **Method:** `GET`
  - **URL:** `{{base_url}}/quizzes/1/questions`
  - **Expected Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Daftar butir soal kuis berhasil diambil untuk preview.",
      "data": {
        "quiz_id": 1,
        "title": "Kuis Pemrograman Mobile Flutter",
        "status": "draft_review",
        "total_questions": 5,
        "questions": [ ... ]
      }
    }
    ```
- **Koreksi / Update Butir Soal:**
  - **Method:** `PUT`
  - **URL:** `{{base_url}}/quizzes/1/questions/10`
  - **Body (raw JSON):**
    ```json
    {
      "question_text": "Perintah CLI resmi untuk menginisialisasi project Flutter adalah?",
      "correct_answer": "B"
    }
    ```
  - **Expected Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Butir soal berhasil diperbarui.",
      "data": { "id": 10, ... }
    }
    ```

---

### 51.7 Pengujian 7: Konfirmasi & Publikasikan Kuis (`PATCH`)

- **Method:** `PATCH`
- **URL:** `{{base_url}}/quizzes/1/publish`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_guru}}`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Kuis berhasil dipublikasikan dan siap dikerjakan siswa.",
    "data": {
      "id": 1,
      "status": "published",
      "questions": [ ... ]
    }
  }
  ```

---

### 51.8 Pengujian 8: Siswa Membuka Kuis yang Dipublikasikan (`GET`)

- **Method:** `GET`
- **URL:** `{{base_url}}/quizzes/1`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_siswa}}`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data kuis berhasil diambil.",
    "data": {
      "id": 1,
      "title": "Kuis Pemrograman Mobile Flutter",
      "status": "published",
      "due_date": "2026-10-25T23:59:00.000000Z",
      "max_attempts": 2,
      "questions": [
        {
          "id": 10,
          "question_text": "Perintah CLI resmi untuk menginisialisasi project Flutter adalah?",
          "question_type": "multiple_choice",
          "options": {
            "A": "flutter start project",
            "B": "flutter create project_name",
            "C": "flutter init project",
            "D": "flutter new app"
          }
          // Note: 'correct_answer' otomatis disembunyikan (hidden) untuk siswa
        }
      ]
    }
  }
  ```

---

### 51.9 Pengujian 9: Siswa Mengerjakan Kuis Multi-Attempt (`POST`)

- **Method:** `POST`
- **URL:** `{{base_url}}/quizzes/1/submissions`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_siswa}}`
- **Body (raw JSON):**
  ```json
  {
    "answers": [
      {
        "question_id": 10,
        "answer": "B"
      },
      {
        "question_id": 11,
        "answer": "StatefulWidget adalah widget yang memiliki state dinamis yang dapat berubah sepanjang waktu menggunakan setState."
      }
    ]
  }
  ```
- **Expected Response (202 Accepted):**
  ```json
  {
    "success": true,
    "message": "Jawaban kuis berhasil dikumpulkan dan sedang dinilai oleh sistem evaluasi AI.",
    "data": {
      "submission_id": 1,
      "quiz_id": 1,
      "student_id": 5,
      "attempt_number": 1,
      "grading_status": "pending"
    }
  }
  ```

---

### 51.10 Pengujian 10: Validasi Gagal Melewati Deadline / Max Attempts (422)

- **Kasus Melewati Tenggat Waktu (`due_date`):**
  - **Expected Response (422 Unprocessable Content):**
    ```json
    {
      "success": false,
      "message": "Batas waktu pengerjaan kuis telah berakhir."
    }
    ```
- **Kasus Melebihi Batas Percobaan (`max_attempts`):**
  - **Expected Response (422 Unprocessable Content):**
    ```json
    {
      "success": false,
      "message": "Batas percobaan kuis telah habis (maksimal 2 kali)."
    }
    ```

---

### 51.11 Pengujian 11: Guru Mereview Seluruh Submission Siswa (`GET`)

- **Method:** `GET`
- **URL:** `{{base_url}}/quizzes/1/submissions`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_guru}}`
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data submission siswa berhasil diambil.",
    "data": {
      "quiz_id": 1,
      "title": "Kuis Pemrograman Mobile Flutter",
      "total_submissions": 1,
      "submissions": [
        {
          "id": 1,
          "student_id": 5,
          "attempt_number": 1,
          "grading_status": "graded",
          "ai_score": 95.0,
          "ai_feedback": "Soal #1 (Pilihan Ganda): Benar (B).\nSoal #2 (Esai): Nilai 90/100. Evaluasi: Konsep dinamis dan setState dijelaskan dengan tepat.",
          "is_overridden": false,
          "student": { "id": 5, "name": "Ahmad Siswa", "nis_nip": "1001" }
        }
      ]
    }
  }
  ```

---

### 51.12 Pengujian 12: Guru Meng-override Nilai & Feedback AI (`PATCH`)

- **Method:** `PATCH`
- **URL:** `{{base_url}}/quiz-submissions/1`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_guru}}`
- **Body (raw JSON):**
  ```json
  {
    "score": 98.0,
    "feedback": "Nilai disesuaikan oleh guru: Penjelasan konsep dan contoh kasus sangat lengkap."
  }
  ```
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Nilai kuis berhasil di-override oleh guru.",
    "data": {
      "id": 1,
      "ai_score": 98.0,
      "ai_feedback": "Nilai disesuaikan oleh guru: Penjelasan konsep dan contoh kasus sangat lengkap.",
      "is_overridden": true,
      "overridden_by": 2,
      "overridden_at": "2026-10-21T15:15:00.000000Z",
      "overrider": { "id": 2, "name": "Pak Budi Guru" }
    }
  }
  ```

---

### 51.13 Pengujian 13: Guru Merilis Hasil Akhir Kuis (`PATCH`)

- **Method:** `PATCH`
- **URL:** `{{base_url}}/quizzes/1`
- **Headers:**
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {{token_guru}}`
- **Body (raw JSON):**
  ```json
  {
    "status": "published_result"
  }
  ```
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Data kuis berhasil diperbarui.",
    "data": {
      "id": 1,
      "status": "published_result"
    }
  }
  ```

---

### 51.14 Pengujian 14: Siswa & Orang Tua Melihat Hasil Akhir Kuis (`GET`)

- **Method:** `GET`
- **URL:** `{{base_url}}/quizzes/1/submissions/me`
- **Headers:**
  - `Accept: application/json`
  - `Authorization: Bearer {{token_siswa}}` *(atau token orang tua)*
- **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Hasil kuis berhasil diambil.",
    "data": {
      "quiz_id": 1,
      "title": "Kuis Pemrograman Mobile Flutter",
      "best_score": 98.0,
      "attempts_used": 1,
      "max_attempts": 2,
      "submissions": [
        {
          "id": 1,
          "attempt_number": 1,
          "ai_score": 98.0,
          "ai_feedback": "Nilai disesuaikan oleh guru: Penjelasan konsep dan contoh kasus sangat lengkap.",
          "is_overridden": true
        }
      ]
    }
  }
  ```

