# Master Plan Perbaikan & Penyelesaian Project SCP (Backend REST API)
**School Class Progress (SCP) — Berdasarkan PRD v4.4 & Tech Stack Laravel 13**

---

## 1. Ringkasan Eksekutif & Panduan Penggunaan Dokumen

Dokumen ini adalah **panduan rencana implementasi menyeluruh (end-to-end master execution plan)** untuk menyelesaikan backend School Class Progress (SCP) hingga seluruh fitur berfungsi sesuai **PRD v4.4**, memenuhi seluruh kriteria kelulusan Uji Kompetensi Keahlian (UKK), dan siap digunakan (*production ready*).

### 1.1 Prinsip Kerja
1. **Zero Guesswork**: Setiap tugas mendefinisikan masalah, solusi, file & lokasi baris, implementasi logis, command terminal, skenario pengujian, dan kriteria keberhasilan secara eksplisit.
2. **Prioritas & Dependensi Ketat**: Pengerjaan wajib mengikuti urutan Fase 0 hingga Fase 9. Jangan melompati fase karena layer di atasnya bergantung langsung pada stabilitas layer di bawahnya.
3. **Integritas Dokumentasi**: Tidak ada file lama yang dihapus sebelum fungsionalitas penggantinya teruji 100%.

### 1.2 Peta Jalan Tahapan (Roadmap)
```
[Fase 0: Fondasi, Bug Kritis & Penyelarasan Skema DB]
  ├── Perbaikan AssignmentMiddleware & SchoolClassController
  ├── Penyelarasan Tabel leave_requests & ai_quizzes
  └── Seeder Period Templates Lengkap & Konfigurasi Sistem
       │
[Fase 1: Master Data & Manajemen Akademik (PRD 9.2, 9.3)]
  ├── CRUD Rooms, Subjects, Classes, Teachers, Students
  ├── Promosi Kelas & Penandaan Siswa Tinggal Kelas (Hold-back)
  └── Pengaturan Siklus Putaran & Log cycle_history
       │
[Fase 2: Jadwal Terpusat & Resolusi Jam Dinamis (PRD 9.4)]
  ├── PeriodResolutionService (Resolusi Jam Riil Dinamis)
  ├── GET /schedules & Alert missing_journal (30 menit)
  └── Mutasi Jadwal Manual + Password Re-confirmation (422)
       │
[Fase 3: Import Jadwal Otomatis dari PDF FET (PRD 9.5)]
  ├── Python PDF Coordinate Parser (script/pdf_parser.py)
  ├── Queue Job ParseSchedulePdfJob (Cross-check FET Staff ID & Ruang)
  ├── Resolusi Manual Baris Unmatched & Pembatalan Import
  └── Konfirmasi Final: Replace Putaran (Soft-Delete) & Hapus PDF
       │
[Fase 4: Jurnal KBM & Presensi Exception-Based (PRD 9.7)]
  ├── Buka Jurnal & Penanganan teacher_absent
  ├── Atomic PUT /journals/{id} (Foto JPEG ~800px 30-40% + Materi + Absensi)
  └── Eliminasi tabel legacy substitute_assignments
       │
[Fase 5: Perizinan Siswa & Sinkronisasi Presensi (PRD 9.6)]
  ├── CRUD leave_requests (tidak_masuk vs keluar_sekolah)
  ├── Sinkronisasi Otomatis Izin Approved ke Hadir/Sakit/Izin
  └── GET /attendances Auto-Scoped Role
       │
[Fase 6: Workflow Evaluasi Kuis AI Asinkron (PRD 9.8)]
  ├── POST /quizzes (Generating -> Asynchronous GenerateQuizJob)
  ├── Review & Edit Soal oleh Guru (draft_review -> published)
  ├── Submission Siswa (Max Attempts, Due Date, Async Grading)
  └── Guru Override Nilai & Publikasi Hasil (published_result)
       │
[Fase 7: Profil, Verifikasi Kontak & Scheduled Background Jobs (PRD 9.1, 8)]
  ├── Self-linking Email, OTP No HP WhatsApp, Google Sign-In
  └── Scheduled Jobs: Hard Delete Lulusan 14 Hari & Prune OTP
       │
[Fase 8: Pembersihan Route & Dead Code (R-01 s.d. R-15)]
  └── Eliminasi Endpoint & Controller Legacy di luar PRD
       │
[Fase 9: Pengujian Akhir & Verifikasi Acceptance Criteria UKK (PRD 10)]
  └── Full Test Suite: Unit, Feature, Security, & Konsistensi Database
```

---

## FASE 0: Fondasi, Perbaikan Bug Kritis & Penyelarasan Skema Database

Tujuan fase ini adalah menstabilkan kode yang sudah ada, memperbaiki error fatal *runtime*, menyelaraskan skema database dengan PRD v4.4, dan menyiapkan seeder konfigurasi sistem dasar.

---

### Tugas 0.1 · Perbaikan Fatal Method Error & Response pada Middleware Penugasan
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Pada file `app/Http/Middleware/AssignmentMiddleware.php` baris 21, kode memanggil `$user->teacherAsssignments()` (typo 3 huruf 's'). Padahal method relasi di `app/Models/User.php` baris 55 bernama `assignments()`. Selain itu, baris 28 mengandung typo key `'assigment'` dan teks pesan error kehilangan spasi: `'Membutuhkan penugasan' . $type . '.'`.
  - *Penyebab:* Inkonsistensi penamaan relasi antara Model dan Middleware.
  - *Dampak:* Setiap kali rute yang diproteksi `assignment:kesiswaan` atau `assignment:wali_kelas` diakses, aplikasi langsung *crash* dengan `BadMethodCallException: Call to undefined method App\Models\User::teacherAsssignments()`.
  - *Hasil yang dicapai:* Middleware berjalan tanpa error, memvalidasi penugasan guru dengan benar, dan mengembalikan format error standar PRD.
- **Solusi:**
  - Ubah pemanggilan method relasi menjadi `$user->assignments()`.
  - Perbaiki struktur response error 403: key `'assignment'` dan pesan `'Membutuhkan penugasan ' . $type . '.'`.
- **File dan lokasi kode:**
  - `app/Http/Middleware/AssignmentMiddleware.php` (L20–L31).
- **Implementasi:**
  1. Buka `app/Http/Middleware/AssignmentMiddleware.php`.
  2. Ganti `$user->teacherAsssignments()->where('type', $type)->exists()` menjadi `$user->assignments()->where('type', $type)->exists()`.
  3. Ganti `'assigment' => ['Membutuhkan penugasan' . $type . '.']` menjadi `'assignment' => ['Membutuhkan penugasan ' . $type . '.']`.
- **Command:**
  - `php artisan test --filter=RoleMiddlewareTest` (atau test assignment terkait).
- **Testing:**
  - Buat unit/feature test: Akun guru tanpa penugasan kesiswaan mengakses endpoint ber-middleware `assignment:kesiswaan` ➔ Harus return 403 JSON dengan format standar tanpa melempar 500 BadMethodCallException.
  - Akun guru dengan penugasan kesiswaan mengakses endpoint ➔ Lolos (200/201).
- **Kriteria keberhasilan:**
  - Tidak ada exception `BadMethodCallException`.
  - HTTP 403 dikembalikan rapi dengan payload `{ success: false, message: '...', errors: { assignment: ['...'] } }`.

---

### Tugas 0.2 · Perbaikan Bug Soft Delete & Status Code pada SchoolClassController
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Pada `app/Http/Controllers/API/SchoolClassController.php` baris 42, validasi unik menuliskan `Rule::unique('classes', 'name')->whereNull('delete_at')` (typo: `'delete_at'`, kurang huruf 'd'). Pada baris 75, method `destroy()` mengembalikan status HTTP `201 Created` untuk aksi penghapusan.
  - *Penyebab:* Human error saat penulisan aturan validasi dan status kode.
  - *Dampak:* Pada PostgreSQL, query validasi unik gagal memeriksa kolom yang sudah di-soft-delete atau menghasilkan query error. Response delete membingungkan client (201 biasanya untuk pembuatan resource baru).
  - *Hasil yang dicapai:* Validasi unik kelas mengabaikan data yang di-soft-delete (`deleted_at`), dan method delete mengembalikan status HTTP `200 OK`.
- **Solusi:**
  - Ganti `'delete_at'` menjadi `'deleted_at'`.
  - Ganti status code response penghapusan dari `201` menjadi `200`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/SchoolClassController.php` (L42, L75).
- **Implementasi:**
  1. Ubah baris 42 menjadi: `Rule::unique('classes', 'name')->whereNull('deleted_at')`.
  2. Ubah baris 75 menjadi: `return response()->json([...], 200);`.
- **Command:**
  - `php artisan test --filter=SchoolClassTest`
- **Testing:**
  - Buat kelas "X RPL 1", hapus (soft delete), lalu buat kembali kelas dengan nama "X RPL 1" ➔ Berhasil dibuat (201).
  - Panggil `DELETE /api/classes/{id}` ➔ Memastikan respons berstatus HTTP 200 OK.
- **Kriteria keberhasilan:**
  - Re-create nama kelas setelah soft-delete berhasil tanpa collision error.
  - Response DELETE menghasilkan status code 200.

---

### Tugas 0.3 · Penyelarasan Skema Database Perizinan Siswa (`leave_requests`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Tabel database saat ini bernama `student_permisions` (typo huruf 's'), dengan kolom yang tidak sesuai PRD v4.4: `permission_type (sakit, izin, dispen)`, `reason`, `attachment_path`, `approved_by`.
  - *Spesifikasi PRD v4.4 (Bagian 5.10 & Bagian 6):* Tabel bernama `leave_requests`, dengan skema:
    - `id`
    - `student_id` (FK users)
    - `applicant_id` (FK users: bisa siswa sendiri atau orang tua)
    - `type` (ENUM: `tidak_masuk`, `keluar_sekolah`)
    - `category` (ENUM: `sakit`, `lainnya`)
    - `start_date` (date, nullable untuk keluar_sekolah)
    - `end_date` (date, nullable untuk keluar_sekolah)
    - `departure_time` (time, untuk keluar_sekolah)
    - `expected_return_time` (time, untuk keluar_sekolah)
    - `status_approval` / `status` (ENUM: `pending`, `approved`, `rejected`)
    - `document_path` (nullable string, bukti surat/dokter)
    - `verified_by` (FK users, nullable)
    - `verified_at` (timestamp, nullable)
    - `timestamps`
  - *Dampak:* Fitur perizinan tidak dapat membedakan izin tidak masuk multi-hari dengan izin keluar sekolah (same-day), tidak mencatat siapa pemohon (siswa vs orang tua), dan sinkronisasi absensi otomatis rusak.
  - *Hasil yang dicapai:* Skema tabel database `leave_requests` terbentuk rapi sesuai standar PRD v4.4.
- **Solusi:**
  - Buat migration baru untuk menggantikan `student_permisions` menjadi `leave_requests` dengan struktur kolom lengkap.
  - Buat Model `App\Models\LeaveRequest` dengan relasi lengkap ke `User` (student, applicant, verifier).
- **File dan lokasi kode:**
  - `database/migrations/2026_10_20_000001_create_leave_requests_table.php` (Baru).
  - `app/Models/LeaveRequest.php` (Baru).
  - Hapus/deprecate `app/Models/StudentPermision.php`.
- **Implementasi:**
  1. Jalankan artisan command untuk membuat file migration.
  2. Tulis skema tabel `leave_requests` mencakup seluruh kolom di atas dengan tipe data PostgreSQL/MySQL yang sesuai.
  3. Beri indeks pada `['student_id', 'status']`, `['start_date', 'end_date']`, dan `['type']`.
  4. Implementasikan Model `LeaveRequest` dengan `$fillable`, casting tanggal/waktu, dan relasi `belongsTo(User::class)`.
- **Command:**
  - `php artisan make:migration create_leave_requests_table`
  - `php artisan migrate`
- **Testing:**
  - Jalankan migration fresh dan verifikasi struktur tabel via PostgreSQL/SQLite schema inspector.
- **Kriteria keberhasilan:**
  - Tabel `leave_requests` terbentuk dengan semua kolom yang disyaratkan PRD Bagian 6.

---

### Tugas 0.4 · Penyelarasan Skema Database Kuis AI (`ai_quizzes`, `quiz_questions`, `quiz_submissions`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:*
    - Tabel `quizzes` berelasi ke `journal_id` (PRD mewajibkan berelasi ke `teacher_id` dan `class_id`).
    - Tabel `quiz_submisions` (typo huruf 's') memiliki unique constraint `['quiz_id', 'student_id']` yang memblokir percobaan multi-attempt (`attempt_number`).
    - Kolom penting di PRD belum ada: `ai_quizzes` (`due_date`, `max_attempts`, status `generating`, `draft_review`, `published`, `published_result`), `quiz_questions` (`question_type`), `quiz_submissions` (`attempt_number`, `answers_payload`, `grading_status`, `ai_score`, `ai_feedback`, `is_overridden`, `overridden_by`, `overridden_at`).
  - *Dampak:* Fitur Kuis AI PRD 5.14 tidak dapat dijalankan (kuis harus independen dari jurnal mengajar, siswa berhak mengerjakan hingga `max_attempts`, jawaban esai dinilai asinkron).
  - *Hasil yang dicapai:* Tiga tabel kuis selaras 100% dengan PRD Bagian 6.
- **Solusi:**
  - Buat migration baru untuk merestrukturisasi:
    - Tabel `ai_quizzes` (atau menyesuaikan `quizzes`): `id`, `teacher_id`, `class_id`, `title`, `status` (`generating`, `draft_review`, `published`, `published_result`), `due_date` (datetime), `max_attempts` (int default 1), `timestamps`.
    - Tabel `quiz_questions`: `id`, `quiz_id`, `question_text`, `options` (json, nullable utk esai), `correct_answer` (string/text rubrik kata kunci), `question_type` (ENUM: `multiple_choice`, `essay`), `timestamps`.
    - Tabel `quiz_submissions`: `id`, `quiz_id`, `student_id`, `attempt_number` (int default 1), `answers_payload` (json), `grading_status` (ENUM: `pending`, `graded`), `ai_score` (decimal 5,2 nullable), `ai_feedback` (text nullable), `is_overridden` (boolean default false), `overridden_by` (FK users nullable), `overridden_at` (timestamp nullable), `timestamps`. Unique constraint: `['quiz_id', 'student_id', 'attempt_number']`.
  - Buat/perbarui Model `Quiz`, `QuizQuestion`, `QuizSubmission`.
- **File dan lokasi kode:**
  - `database/migrations/2026_10_20_000002_rebuild_quiz_tables.php` (Baru).
  - `app/Models/Quiz.php` (Update).
  - `app/Models/QuizQuestion.php` (Update).
  - `app/Models/QuizSubmission.php` (Baru, menggantikan `QuizSubmision.php`).
- **Implementasi:**
  1. Buat migration baru yang drop tabel kuis lama jika belum ada data produksi atau alter struktur tabel.
  2. Definisikan foreign key dan unique constraint `['quiz_id', 'student_id', 'attempt_number']`.
  3. Konfigurasi model `Quiz` dengan `$table = 'ai_quizzes'` (atau `quizzes` sesuai kesepakatan), relasi `hasMany(QuizQuestion::class)`, `hasMany(QuizSubmission::class)`, `belongsTo(User::class, 'teacher_id')`, `belongsTo(Classes::class, 'class_id')`.
  4. Konfigurasi model `QuizSubmission` dengan casting `$casts = ['answers_payload' => 'array', 'is_overridden' => 'boolean']`.
- **Command:**
  - `php artisan make:migration rebuild_quiz_tables`
  - `php artisan migrate`
- **Testing:**
  - Verifikasi insert submission dengan `attempt_number = 1` dan `attempt_number = 2` pada siswa dan kuis yang sama ➔ Berhasil tanpa melanggar unique constraint.
- **Kriteria keberhasilan:**
  - Tabel dan model mendukung multi-attempt, rubrik esai, dan audit trail override guru.

---

### Tugas 0.5 · Standardisasi Penamaan & Relasi Model Eloquent
- **Masalah dan tujuan:**
  - *Kondisi saat ini:*
    - Model `Rooms` dan `Classes` berbentuk jamak (plural).
    - Relasi di `Schedule.php` bernama `classRoom()` mengarah ke `Classes`, sementara di `User.php` bernama `schoolClass()`, di `TeacherAssignment.php` bernama `schoolClass()`.
  - *Penyebab:* Penamaan inkonsisten antar kontributor.
  - *Dampak:* Developer mudah salah memanggil nama relasi (misal `$schedule->schoolClass` menghasilkan null/error).
  - *Hasil yang dicapai:* Penamaan relasi dan model konsisten. Model `Rooms` dialiaskan atau distandardisasi ke `Room`, `Classes` ke `SchoolClass` (atau diberi alias class-alias agar backward compatible), serta relasi di `Schedule` memiliki alias `schoolClass()`.
- **Solusi:**
  - Tambahkan alias method `schoolClass(): BelongsTo` di `Schedule.php` (mengarah ke `Classes`) di samping mempertahankan `classRoom()` untuk backward compatibility.
  - Buat model `Room.php` yang meng-extend `Model` dengan `$table = 'rooms'`, atau tambahkan `class_alias` agar `Room` dan `Rooms` merujuk ke class yang sama.
- **File dan lokasi kode:**
  - `app/Models/Schedule.php` (L36–L45).
  - `app/Models/Room.php` (Baru) & `app/Models/Rooms.php`.
- **Implementasi:**
  1. Pada `Schedule.php`, tambahkan:
     ```php
     public function schoolClass(): BelongsTo {
         return $this->belongsTo(Classes::class, 'class_id');
     }
     ```
  2. Buat `app/Models/Room.php` yang merepresentasikan tabel `rooms`.
- **Command:**
  - `php artisan test`
- **Testing:**
  - Panggil `$schedule->schoolClass` pada unit test dan pastikan data instance `Classes` dimuat dengan benar.
- **Kriteria keberhasilan:**
  - Relasi `schoolClass` dapat dipanggil secara seragam di `User`, `TeacherAssignment`, dan `Schedule`.

---

### Tugas 0.6 · Seeder Period Templates Lengkap (10 JP & Jumat Pendek) & Konfigurasi Sistem
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* `PeriodTemplateSeeder.php` hanya memiliki data periode 1 untuk 4 hari, dan **sama sekali tidak memiliki template untuk hari `jumat`**. Di `DatabaseSeeder.php`, baris inisialisasi Waka dan `system_configurations` masih di-comment out.
  - *Spesifikasi PRD v4.4 (Bagian 5.3):*
    - `senin_upacara`: Jam pelajaran 1 dimulai 08:00 (durasi 45 menit/JP).
    - `senin_reguler`: Jam pelajaran 1 dimulai 07:15 (durasi 45 menit/JP).
    - `selasa`: Jam pelajaran 1 dimulai 07:30 (literasi, durasi 45 menit/JP).
    - `rabu_kamis`: Jam pelajaran 1 dimulai 07:15 (tadarus/pendalaman, durasi 45 menit/JP).
    - `jumat`: Jam pelajaran 1 dimulai 07:15, setiap JP berdurasi **40 menit** (lebih singkat).
  - *Dampak:* Fitur resolusi jam pelajaran dinamis tidak bisa menghitung jam pelajaran ke-2 hingga ke-10, jadwal hari Jumat tidak bisa diproses, dan database fresh selalu gagal pada endpoint akademik.
  - *Hasil yang dicapai:* Database seeder memuat 10 Jam Pelajaran lengkap untuk seluruh `day_type`, menyertakan jeda istirahat, serta mengaktifkan inisialisasi akun Waka Kurikulum pertama (`must_change_password = false` atau `true`) dan record `system_configurations` (id=1).
- **Solusi:**
  - Perbarui `PeriodTemplateSeeder.php` untuk men-generate 10 periode per `day_type` dengan perhitungan waktu yang presisi.
  - Aktifkan seeder Waka Kurikulum dan `system_configurations` (id=1, active_cycle=1, monday_is_upacara=true) di `DatabaseSeeder.php`.
- **File dan lokasi kode:**
  - `database/seeders/PeriodTemplateSeeder.php`.
  - `database/seeders/DatabaseSeeder.php`.
- **Implementasi:**
  1. Di `PeriodTemplateSeeder.php`, susun array konfigurasi 10 JP untuk kelima `day_type`:
     - *Senin Upacara*: JP 1 (08:00–08:45), JP 2 (08:45–09:30), JP 3 (09:30–10:15), Istirahat (10:15–10:45), JP 4 (10:45–11:30), JP 5 (11:30–12:15), Istirahat Sholat (12:15–13:00), JP 6 (13:00–13:45), JP 7 (13:45–14:30), JP 8 (14:30–15:15), JP 9 (15:15–16:00).
     - *Senin Reguler*: JP 1 (07:15–08:00), JP 2 (08:00–08:45), JP 3 (08:45–09:30), JP 4 (09:30–10:15), Istirahat, dst.
     - *Selasa*: JP 1 (07:30–08:15), dst.
     - *Rabu & Kamis*: JP 1 (07:15–08:00), dst.
     - *Jumat*: JP 1 (07:15–07:55), JP 2 (07:55–08:35), JP 3 (08:35–09:15), Istirahat (09:15–09:35), JP 4 (09:35–10:15), JP 5 (10:15–10:55), JP 6 (10:55–11:35).
  2. Di `DatabaseSeeder.php`, uncomment pembuatan Waka Kurikulum default dan `SystemConfiguration::create(['id' => 1, 'active_cycle' => 1, 'monday_is_upacara' => true])`.
  3. Daftarkan `$this->call(PeriodTemplateSeeder::class)` di dalam `DatabaseSeeder.php`.
- **Command:**
  - `php artisan db:seed`
- **Testing:**
  - Jalankan `php artisan tinker --execute="echo App\Models\PeriodTemplate::count();"` ➔ Menghasilkan data template lengkap (minimal 45–50 baris).
  - Jalankan `php artisan tinker --execute="echo App\Models\SystemConfiguration::first()->active_cycle;"` ➔ Menghasilkan `1`.
- **Kriteria keberhasilan:**
  - Seeder berjalan mulus tanpa error duplikasi kunci unik `['day_type', 'period_number']`.
  - Record konfigurasi sistem id=1 dan akun Waka ter-generate otomatis saat `migrate --seed`.

---

### Tugas 0.7 · Konfigurasi Rate Limiting API & Expiration Sanctum
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* PRD Bagian 7 & Bagian 10 menetapkan kriteria keamanan: "Throttle 60 request/menit per token untuk endpoint terautentikasi". Rute di `routes/api.php` belum menerapkan middleware throttle secara eksplisit.
  - *Hasil yang dicapai:* Seluruh request API Sanctum terlindungi dari brute-force dan spamming melalui rate limiting 60 req/min, dan unauthorized request mengembalikan 429 berformat JSON standar PRD.
- **Solusi:**
  - Konfigurasi `RateLimiter` di `app/Providers/AppServiceProvider.php`.
  - Pasang middleware `throttle:api` pada rute terautentikasi di `routes/api.php`.
- **File dan lokasi kode:**
  - `app/Providers/AppServiceProvider.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. Di `AppServiceProvider.php`, definisikan:
     ```php
     RateLimiter::for('api', function (Request $request) {
         return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
     });
     ```
  2. Terapkan grup middleware `throttle:api` pada rute `api.php`.
- **Command:**
  - `php artisan test`
- **Testing:**
  - Kirim 61 request berturut-turut menggunakan loop di Feature Test ➔ Request ke-61 menerima HTTP status 429 Too Many Requests dengan payload JSON `{ success: false, message: 'Too Many Attempts.', errors: null }`.
- **Kriteria keberhasilan:**
  - Acceptance Criteria "API Security: Rate limiting aktif" terpenuhi 100%.

---

## FASE 1: Master Data & Manajemen Siklus Akademik (PRD 9.2 & 9.3)

Tujuan fase ini adalah melengkapi seluruh endpoint CRUD Master Data (Rooms, Subjects, Classes, Teachers, Students), menegakkan penolakan HTTP 409 jika entitas masih berelasi dengan jadwal aktif, serta mengaktifkan alur promosi kelas dan siklus putaran.

---

### Tugas 1.1 · CRUD Lengkap Master Data Ruangan (`/api/rooms`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Tidak ada `RoomController` dan rute `/api/rooms`. Tabel `rooms` sudah ada di database, tetapi API tidak memiliki akses membaca atau mengelola ruangan.
  - *Kebutuhan PRD 9.3:*
    - `GET /api/rooms` (Auth, pagination `per_page` maks 100).
    - `POST /api/rooms` (Auth Waka: `name`, `capacity`).
    - `PUT /api/rooms/{id}` (Auth Waka: edit).
    - `DELETE /api/rooms/{id}` (Auth Waka: soft-delete, ditolak **409** jika masih direferensikan schedule aktif).
- **Solusi:**
  - Buat `app/Http/Controllers/API/RoomController.php` dengan method `index`, `store`, `update`, `destroy`.
  - Daftarkan rute di `routes/api.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/RoomController.php` (Baru).
  - `routes/api.php`.
- **Implementasi:**
  1. `index`: Ambil data ruangan berpaginasi, dukung parameter `search` dan `per_page`.
  2. `store`: Validasi `name` (required, string, unique di tabel rooms whereNull deleted_at), `capacity` (required, integer, min 1). Return 201.
  3. `update`: Validasi input, perbarui data. Return 200.
  4. `destroy`: Cari room dengan `findOrFail($id)`. Cek `$room->schedules()->exists()`. Jika ya, return 409 JSON:
     `{ success: false, message: 'Ruangan tidak bisa dihapus karena masih digunakan untuk jadwal aktif.', errors: { room: ['Hapus atau pindahkan jadwal terkait terlebih dahulu.'] } }`. Jika tidak, jalankan `$room->delete()`, return 200.
- **Command:**
  - `php artisan make:controller API/RoomController`
- **Testing:**
  - Test Waka membuat room baru ➔ 201.
  - Test Guru membaca room ➔ 200.
  - Test Hapus room yang tidak terikat jadwal ➔ 200 (soft deleted).
  - Test Hapus room yang terikat jadwal aktif ➔ 409 Conflict.
- **Kriteria keberhasilan:**
  - 4 endpoint `/api/rooms` beroperasi sempurna sesuai PRD 9.3.

---

### Tugas 1.2 · CRUD Lengkap Master Data Mata Pelajaran (`/api/subjects`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* `SubjectController.php` hanya memiliki method `store()`. Rute `GET`, `PUT`, dan `DELETE` belum ada. Validasi unique di `store()` belum mengecualikan baris yang di-soft-delete (`whereNull('deleted_at')`).
  - *Kebutuhan PRD 9.3:* CRUD lengkap, proteksi DELETE dengan 409 jika terikat jadwal aktif, paginasi pada GET.
- **Solusi:**
  - Lengkapi `index`, `update`, `destroy` pada `SubjectController.php`.
  - Perbaiki validasi unique pada `store` dan `update`.
  - Daftarkan rute di `routes/api.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/SubjectController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. `index`: Paginasi `Subject::paginate($perPage)`.
  2. `store`: Validasi `Rule::unique('subjects', 'name')->whereNull('deleted_at')`.
  3. `update`: Validasi `Rule::unique('subjects', 'name')->ignore($id)->whereNull('deleted_at')`.
  4. `destroy`: Periksa `$subject->schedules()->exists()`. Tolak 409 jika aktif, hapus jika aman (return 200).
- **Command:**
  - `php artisan test --filter=SubjectTest`
- **Testing:**
  - Uji CRUD subject, coba hapus mapel yang memiliki foreign key di tabel `schedules` ➔ Pastikan tertolak dengan HTTP 409.
- **Kriteria keberhasilan:**
  - Seluruh endpoint `/api/subjects` beroperasi dan memenuhi kriteria soft-delete protektif.

---

### Tugas 1.3 · Penyempurnaan Master Data Kelas & Kenaikan Kelas (`/api/classes`, `/api/class-promotions`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* `SchoolClassController` belum memiliki `PUT /api/classes/{id}`. Fitur kenaikan kelas (`POST /api/class-promotions`) belum dibuat.
  - *Kebutuhan PRD 5.13 & 9.3:*
    - Waka dapat mengupdate nama, level, dan `next_class_id` kelas tujuan kenaikan.
    - `POST /api/class-promotions`: Proses bulk akhir tahun ajaran. Siswa di kelas yang memiliki `next_class_id` dipindahkan ke kelas tujuan (kecuali yang ditandai *hold-back*). Siswa di kelas akhir (`next_class_id = null`) yang lulus diset tanggal kelulusannya (`users.graduation_date = now()`).
- **Solusi:**
  - Tambahkan method `update` di `SchoolClassController`.
  - Tambahkan method `promoteClasses` di `SchoolClassController` (atau controller terpisah `ClassPromotionController`).
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/SchoolClassController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. Di `update`: Validasi `name`, `level`, `next_class_id` (nullable, exists di classes). Perbarui data.
  2. Di `promoteClasses`:
     - Jalankan dalam `DB::transaction()`.
     - Ambil seluruh siswa aktif ber-role `student` yang tidak memiliki flag *hold-back*.
     - Jika kelas siswa memiliki `next_class_id`, ubah `class_id` siswa ke `next_class_id`.
     - Jika kelas siswa memiliki `next_class_id == null` (kelas 12/akhir), isi `graduation_date = now()->toDateString()`.
     - Reset flag/record *hold-back* untuk tahun ajaran baru.
- **Command:**
  - `php artisan test --filter=ClassPromotionTest`
- **Testing:**
  - Buat Kelas 10 (next_class_id -> Kelas 11) dan Kelas 12 (next_class_id -> null).
  - Tempatkan Siswa A di Kelas 10, Siswa B di Kelas 10 (ditandai hold-back), dan Siswa C di Kelas 12.
  - Eksekusi `POST /api/class-promotions` ➔ Siswa A naik ke Kelas 11, Siswa B tetap di Kelas 10, Siswa C lulus (`graduation_date` terisi).
- **Kriteria keberhasilan:**
  - Alur kenaikan kelas dan kelulusan berjalan presisi tanpa kehilangan riwayat siswa.

---

### Tugas 1.4 · Master Data Guru, Penugasan & Pencabutan Tugas (`/api/teachers`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* `TeacherController.php` hanya memiliki `store` dan `assignRole`. Belum ada `index`, `update`, `destroy`, dan belum ada endpoint pencabutan penugasan (`DELETE /api/teachers/{id}/assignments/{assignment_id}`).
  - *Kebutuhan PRD 5.12 & 9.3:* CRUD penuh guru, pencatatan `fet_staff_id`, dan pengelolaan penugasan tambahan (Kesiswaan, Wali Kelas).
- **Solusi:**
  - Lengkapi `index`, `update`, `destroy` pada `TeacherController.php`.
  - Tambahkan method `revokeRole` (`DELETE .../assignments/{assignment_id}`).
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/TeacherController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. `index`: `User::where('role', 'teacher')->with('assignments')->paginate($perPage)`.
  2. `update`: Perbarui nama, NIP, `fet_staff_id`.
  3. `destroy`: Cek `$teacher->schedules()->exists()`. Tolak 409 jika masih mengajar jadwal aktif. Jika tidak, soft delete.
  4. `revokeRole`: Cari `TeacherAssignment::where('user_id', $id)->findOrFail($assignment_id)->delete()`. Return 200.
- **Command:**
  - `php artisan test --filter=TeacherTest`
- **Testing:**
  - Berikan guru tugas kesiswaan dan wali kelas (multirole).
  - Panggil endpoint revoke assignment ➔ Penugasan spesifik terhapus tanpa menghapus penugasan lainnya.
- **Kriteria keberhasilan:**
  - Guru dapat memiliki multirole dan Waka dapat mencabut penugasan kapan saja.

---

### Tugas 1.5 · Master Data Siswa, Auto-Provisioning & Hold-Back (`/api/students`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* `StudentController.php` memiliki `store` dan `attendanceSummary` (rute non-PRD). Belum ada `index`, `update`, `destroy`, dan belum ada `POST /api/students/{id}/hold-back`.
  - *Kebutuhan PRD 5.1, 5.13 & 9.3:*
    - CRUD data siswa (role: student).
    - Auto-provisioning akun siswa + orang tua: Password random 8 karakter, `must_change_password = true`.
    - `POST /api/students/{id}/hold-back`: Menandai siswa tidak naik kelas sebelum promosi kelas massal dijalankan.
- **Solusi:**
  - Lengkapi method `index`, `update`, `destroy` di `StudentController.php`.
  - Implementasikan endpoint `holdBack($id)`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/StudentController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. `index`: `User::where('role', 'student')->with('schoolClass')->paginate($perPage)`.
  2. `update`: Perbarui nama, NIS, `class_id`.
  3. `destroy`: Soft delete akun siswa dan akun orang tua terkait (`linked_student_id`).
  4. `holdBack`: Buat flag atau tabel pivot/kolom penanda `is_held_back` pada siswa terkait.
- **Command:**
  - `php artisan test --filter=StudentTest`
- **Testing:**
  - Input siswa baru ➔ Akun siswa & akun orang tua ter-generate dengan password acak.
  - Panggil `POST /api/students/{id}/hold-back` ➔ Status siswa tercatat tidak naik kelas pada eksekusi promosi.
- **Kriteria keberhasilan:**
  - Auto-provisioning akun siswa dan orang tua berjalan mulus dan tercakup di test.

---

### Tugas 1.6 · Pengaturan Akademik & Riwayat Putaran (`/api/academic-settings`, `/api/cycle-history`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Hanya ada endpoint `PATCH /api/academic-settings/monday-status`. Endpoint `GET /api/academic-settings`, `PATCH /api/academic-settings` (toggle active cycle), dan `GET /api/cycle-history` belum diimplementasikan.
  - *Kebutuhan PRD 5.5 & 9.2:*
    - Waka dapat melihat konfigurasi aktif (`active_cycle`, `monday_is_upacara`).
    - Waka dapat mengubah `active_cycle` (nilai 1 atau 2). Dalam satu transaksi: baris `cycle_history` yang sedang berjalan ditutup (`ended_at = now()`), dan baris baru dibuat (`cycle_number`, `started_at = now()`, `changed_by = auth()->id()`).
    - `GET /api/cycle-history`: Melihat riwayat pergantian putaran.
- **Solusi:**
  - Lengkapi method `index`, `updateCycle`, dan `cycleHistory` di `app/Http/Controllers/API/AcademicSettingController.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/AcademicSettingController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. `index`: Return data `SystemConfiguration::firstOrFail()`.
  2. `updateCycle`: Validasi `cycle_type` (`required|in:1,2`), `password` (`required`).
     - Verifikasi password Waka via `$this->passwordIsConfirmed($request)`.
     - Dalam `DB::transaction()`:
       - Update `SystemConfiguration::first()->update(['active_cycle' => $request->cycle_type])`.
       - Tutup baris `CycleHistory::whereNull('ended_at')->update(['ended_at' => now()])`.
       - Buat baris `CycleHistory::create(['cycle_number' => $request->cycle_type, 'started_at' => now(), 'changed_by' => $request->user()->id])`.
  3. `cycleHistory`: Return `CycleHistory::with('changer:id,name')->orderBy('started_at', 'desc')->paginate($perPage)`.
- **Command:**
  - `php artisan test --filter=AcademicSettingTest`
- **Testing:**
  - Ubah siklus dari Putaran 1 ke Putaran 2 dengan password benar ➔ Berhasil (200), record baru di `cycle_history`.
  - Coba ganti siklus dengan password salah ➔ Ditolak 422.
- **Kriteria keberhasilan:**
  - Pergantian siklus terisolasi dan tercatat dalam audit log `cycle_history`.

---

## FASE 2: Manajemen Jadwal Terpusat & Resolusi Jam Dinamis (PRD 9.4)

Tujuan fase ini adalah membangun domain service untuk resolusi jam dinamis, menyediakan endpoint pembacaan jadwal (dengan auto-scoping guru vs waka), menghitung alert keterlambatan jurnal (*missing journal alert*), serta mutasi jadwal manual yang dilindungi verifikasi password Waka dan anti-bentrok.

---

### Tugas 2.1 · Domain Service Resolusi Jam Pelajaran Dinamis (`PeriodResolutionService`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Tabel `schedules` hanya menyimpan `period_number` dan `duration_periods`. Belum ada service terpusat yang mengubah nomor periode menjadi jam mulai dan jam selesai literal (`start_time` & `end_time`) berdasarkan tanggal hari ini dan setting `monday_is_upacara`.
  - *Kebutuhan PRD 5.3:* Resolusi jam dinamis sesuai hari:
    - Hari Senin: jika `monday_is_upacara == true` ➔ `senin_upacara`, jika false ➔ `senin_reguler`.
    - Hari Selasa: `selasa`.
    - Hari Rabu & Kamis: `rabu_kamis`.
    - Hari Jumat: `jumat`.
  - *Hasil yang dicapai:* Service reusable yang menghitung waktu mulai (periode awal) dan waktu selesai (periode awal + durasi - 1) untuk jadwal apa pun pada tanggal tertentu.
- **Solusi:**
  - Buat `app/Services/PeriodResolutionService.php`.
- **File dan lokasi kode:**
  - `app/Services/PeriodResolutionService.php` (Baru).
- **Implementasi:**
  1. Definisikan method `resolveDayType(Carbon $date): string`:
     - Baca flag `SystemConfiguration::first()->monday_is_upacara`.
     - Gunakan helper `PeriodTemplate::dayTypeFor($date->dayOfWeekIso, $mondayIsUpacara)`.
  2. Definisikan method `getScheduleTimes(Schedule $schedule, ?Carbon $date = null): array`:
     - Tentukan `$date = $date ?: now()`.
     - Ambil `$dayType = $this->resolveDayType($date)`.
     - Cari template periode awal: `PeriodTemplate::where('day_type', $dayType)->where('period_number', $schedule->period_number)->first()`.
     - Cari template periode akhir: `PeriodTemplate::where('day_type', $dayType)->where('period_number', $schedule->period_number + $schedule->duration_periods - 1)->first()`.
     - Return `['start_time' => $startTemplate?->start_time, 'end_time' => $endTemplate?->end_time]`.
- **Command:**
  - `php artisan make:test Unit/PeriodResolutionServiceTest --unit`
- **Testing:**
  - Berikan jadwal hari Senin, set `monday_is_upacara = true` ➔ Periode 1 mulai pukul 08:00.
  - Set `monday_is_upacara = false` ➔ Periode 1 mulai pukul 07:15.
  - Uji jadwal dengan durasi 2 periode (JP 1–2) ➔ Waktu selesai diambil dari end_time periode 2.
- **Kriteria keberhasilan:**
  - Seluruh variasi hari menghasilkan rentang jam yang akurat 100%.

---

### Tugas 2.2 · Endpoint Pembacaan Jadwal & Alert Keterlambatan Jurnal (`GET /api/schedules`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Route `GET /api/schedules` belum terdaftar di `routes/api.php`. Kode saat ini memiliki route ad-hoc `GET /attendance-warnings` yang tidak sesuai spesifikasi PRD.
  - *Kebutuhan PRD 5.6 & 9.4:*
    - `GET /api/schedules`: Auth. Query parameters: `?cycle=1|2`, `?day=1..7`.
      - Guru: Otomatis terfilter hanya melihat jadwal miliknya (read-only).
      - Waka: Dapat melihat seluruh jadwal sekolah.
    - `GET /api/schedules?status=missing_journal`:
      - Mencari jadwal hari ini (WIB) pada siklus aktif di mana: waktu selesai jadwal (hasil resolusi `PeriodResolutionService`) + 30 menit sudah lewat dari waktu sekarang, TETAPI jurnal belum dibuat atau belum berstatus `completed`.
      - Jadwal berstatus `teacher_absent` dikecualikan dari alert ini.
- **Solusi:**
  - Implementasikan method `index` pada `ScheduleController.php` dengan logika scoping dan filter `missing_journal`.
  - Daftarkan rute di `routes/api.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/ScheduleController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. Inject `PeriodResolutionService` ke dalam `ScheduleController`.
  2. Pada method `index`:
     - Jika `$request->status === 'missing_journal'`:
       - Ambil tanggal hari ini, tentukan `day_of_week` dan `active_cycle`.
       - Ambil jadwal hari ini yang relevan (jika user adalah guru, scope ke guru tersebut; jika Waka, semua guru).
       - Filter jadwal yang belum memiliki jurnal `completed` untuk tanggal hari ini, dan belum ditandai `teacher_absent`.
       - Evaluasi apakah `now() > Carbon::parse($resolvedEndTime)->addMinutes(30)`.
       - Return daftar jadwal terlambat tersebut.
     - Jika query biasa: Filter query berdasarkan `cycle_type` (default active_cycle) dan `day_of_week` (opsional). Paginate hasil.
- **Command:**
  - `php artisan test --filter=ScheduleTest`
- **Testing:**
  - Simulasikan waktu saat ini 35 menit setelah jam pelajaran selesai, jurnal belum diisi ➔ Jadwal muncul di daftar alert `missing_journal`.
  - Tandai jurnal sebagai `teacher_absent` ➔ Jadwal hilang dari daftar alert.
  - Login sebagai Guru A ➔ `GET /api/schedules` hanya mengembalikan jadwal Guru A.
- **Kriteria keberhasilan:**
  - Query alert menghitung batas keterlambatan secara presisi berbasis period template.
  - Guru tidak dapat mengintip jadwal guru lain di luar hak aksesnya.

---

### Tugas 2.3 · Mutasi Jadwal Manual dengan Proteksi Password Re-confirmation (`POST, PUT, DELETE /api/schedules`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* `ScheduleController` sudah memiliki `store`, `update`, dan `destroy`. Namun perlu dipastikan bahwa:
    - Input `source` dikunci selalu bernilai `'manual'` (tidak boleh di-override client).
    - `PUT /api/schedules/{id}` memvalidasi bentrok dengan mengabaikan ID jadwal yang sedang diedit (`ignoreId`).
    - Password re-confirmation selalu diverifikasi dan mengembalikan status code konsisten 422 jika gagal.
- **Solusi:**
  - Verifikasi dan sempurnakan method `store`, `update`, dan `destroy` pada `ScheduleController.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/ScheduleController.php`.
- **Implementasi:**
  1. Pastikan validasi body menyertakan `'password' => 'required|string'`.
  2. Panggil `$this->passwordIsConfirmed($request)`.
  3. Kunci `$data['source'] = 'manual'`.
  4. Jalankan pengecekan bentrok via `ScheduleConflictService` dalam transaksi database dengan *pessimistic locking* (`lockForUpdate()`).
  5. Pada `destroy`: lakukan soft-delete (`$schedule->delete()`).
- **Command:**
  - `php artisan test --filter=ScheduleTest`
- **Testing:**
  - Jalankan test `ScheduleTest.php` yang sudah ada untuk memastikan seluruh skenario bentrok guru, bentrok kelas, bentrok ruangan, dan password salah tetap lulus 100%.
- **Kriteria keberhasilan:**
  - Jadwal bentrok ditolak dengan 422 JSON.
  - Password salah ditolak dengan 422 JSON.

---

## FASE 3: Import Jadwal Otomatis dari File PDF FET (PRD 5.16 & 9.5)

Tujuan fase ini adalah membangun alur lengkap import jadwal dari 2 file PDF (jadwal kelas & jadwal ruangan dari FET Waka), mengekstrak data secara asinkron via script Python, menyediakan antarmuka resolusi manual baris unmatched, dan commit final replace per putaran.

---

### Tugas 3.1 · Penyempurnaan Script Ekstraksi PDF Berbasis Tabel Koordinat (`script/pdf_parser.py`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* File `script/pdf_parser.py` saat ini hanya mengembalikan 1 baris dummy statis dalam format JSON.
  - *Kebutuhan PRD 5.16:* Python script dipanggil via subprocess oleh queue worker, menerima path `file_kelas` dan `file_ruangan`. Ekstraksi dilakukan berbasis struktur sel/koordinat tabel (menggunakan library Python seperti `pdfplumber` atau `pypdf`/`fitz`) agar teks tidak tercampur akibat sel gabungan (*merged cells*). Output berupa JSON terstruktur per baris: kelas, hari, nomor jam, durasi, mapel, guru, fet_staff_id (jika ada), dan kode ruang dari kedua file.
- **Solusi:**
  - Kembangkan script `script/pdf_parser.py` yang membaca struktur tabel PDF FET secara tangguh, menangani sel merged, dan menghasilkan JSON output standar ke `stdout`.
- **File dan lokasi kode:**
  - `script/pdf_parser.py`.
- **Implementasi:**
  1. Gunakan library `pdfplumber` (atau fallback native extraction) untuk mengekstrak bounding box tabel.
  2. Parse jadwal mapel per kelas: Identifikasi kolom hari, kolom jam (misal "1-2" ➔ period 1, duration 2), baris guru dan nama mata pelajaran.
  3. Parse jadwal ruangan: Ekstrak pemakaian ruang per kelas dan jam sebagai sumber cross-check.
  4. Gabungkan kedua sumber data: jika kode ruang sama ➔ masukkan `ruang_mentah`, jika berbeda ➔ tandai flag `room_conflict = true`.
  5. Cetak JSON string ke terminal (`print(json.dumps(result))`).
- **Command:**
  - `python script/pdf_parser.py "path/to/sample_kelas.pdf" "path/to/sample_ruangan.pdf"`
- **Testing:**
  - Jalankan script dengan file PDF contoh dari FET ➔ Script mengembalikan array JSON valid tanpa error ke stderr.
- **Kriteria keberhasilan:**
  - Data tabel terekstraksi bersih tanpa teks sel yang terpotong atau tertukar.

---

### Tugas 3.2 · Worker Pemetaan & Deteksi Bentrok Asinkron (`ParseSchedulePdfJob.php`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Pada `ParseSchedulePdfJob.php`, mapping kelas dan ruang di-hardcode ke id=1, dan nomor periode di-hardcode ke 1. Pencocokan guru mengabaikan `fet_staff_id`.
  - *Kebutuhan PRD 5.16 Alur 3 & 4:*
    - Setiap baris hasil ekstraksi Python dicocokkan ke master data:
      - Kelas: cocokkan `kelas_mentah` ke `classes.name`.
      - Mapel: cocokkan `mapel_mentah` ke `subjects.name`.
      - Guru: Kunci utama cocokkan `fet_staff_id` ke `users.fet_staff_id`, fallback cocokkan nama guru ke `users.name`.
      - Ruangan: cocokkan `ruang_mentah` ke `rooms.name`.
    - Jika semua cocok ➔ `match_status = 'matched'`. Jika ada yang belum cocok ➔ `match_status = 'unmatched'`.
    - Lakukan uji bentrok terhadap baris sesama hasil import dan jadwal existing pada putaran yang sama ➔ jika bentrok, set `match_status = 'conflict'`.
    - Simpan ke `schedule_import_rows` dan ubah status import menjadi `preview_ready`.
- **Solusi:**
  - Tulis ulang logika pemetaan di `handle()` pada `app/Jobs/ParseSchedulePdfJob.php`.
- **File dan lokasi kode:**
  - `app/Jobs/ParseSchedulePdfJob.php`.
- **Implementasi:**
  1. Jalankan proses Python dan tangkap JSON output.
  2. Loop setiap item hasil parse:
     - Cari `Classes::where('name', 'ILIKE', $item['kelas_mentah'])->first()`.
     - Cari `Subject::where('name', 'ILIKE', $item['mapel_mentah'])->first()`.
     - Cari Guru: jika ada `fet_staff_id`, cari `User::where('role', 'teacher')->where('fet_staff_id', $item['fet_staff_id'])->first()`. Jika tidak ditemukan, fallback ke `User::where('role', 'teacher')->where('name', 'ILIKE', '%' . $item['guru_mentah'] . '%')->first()`.
     - Cari Ruangan: `Room::where('name', 'ILIKE', $item['ruang_mentah'])->first()`.
     - Parse hari ("Senin" ➔ 1, "Selasa" ➔ 2, dst.) dan jam ("1-2" ➔ period 1, duration 2).
     - Tentukan status: jika ada entitas null ➔ `unmatched`. Jika lengkap ➔ cek bentrok via `ScheduleConflictService`. Jika bentrok ➔ `conflict`, jika aman ➔ `matched`.
     - Simpan ke `ScheduleImportRow`.
  3. Update `ScheduleImport::where('id', $importId)->update(['status' => 'preview_ready'])`.
- **Command:**
  - `php artisan queue:work --once`
- **Testing:**
  - Dispatch job dengan data uji ➔ Record `schedule_import_rows` terisi dengan foreign key yang tepat, status `matched`, `unmatched`, dan `conflict` terklasifikasi akurat.
- **Kriteria keberhasilan:**
  - Tidak ada lagi ID atau periode yang di-hardcode.
  - Pencocokan guru mengutamakan `fet_staff_id`.

---

### Tugas 3.3 · Endpoint Resolusi Manual & Pembatalan Import (`PATCH & DELETE /api/schedule-imports/{id}`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Endpoint resolusi manual baris import (`PATCH .../rows/{row_id}`) dan pembatalan import (`DELETE /api/schedule-imports/{id}`) belum dibuat di `ScheduleImportController.php`.
  - *Kebutuhan PRD 5.16 & 9.5:*
    - Waka dapat mengoreksi baris yang `unmatched` satu per satu dengan memilih `class_id`, `teacher_id`, `room_id`, `subject_id` yang benar, atau menandai baris tersebut untuk di-*exclude*.
    - Waka dapat membatalkan proses import yang belum dikonfirmasi (menghapus record import dan menghapus file sementara di storage).
- **Solusi:**
  - Tambahkan method `resolveRow` dan `destroy` pada `ScheduleImportController.php`.
  - Daftarkan rute di `routes/api.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/ScheduleImportController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. Di `resolveRow($id, $row_id, Request $request)`:
     - Validasi input `matched_class_id`, `matched_teacher_id`, `matched_room_id`, `matched_subject_id`, `is_excluded`.
     - Ambil baris `ScheduleImportRow::where('import_id', $id)->findOrFail($row_id)`.
     - Jika `is_excluded == true`, set status baris menjadi `excluded`.
     - Jika dikoreksi ID-nya, perbarui foreign keys, jalankan validasi bentrok ulang. Jika tidak bentrok, ubah `match_status = 'matched'` dan `resolved_by_waka = true`.
     - Return data baris yang diperbarui.
  2. Di `destroy($id)`:
     - Cari import dengan status bukan `confirmed`.
     - Hapus file fisik PDF dari storage.
     - Hapus baris anak (`schedule_import_rows`) dan record `schedule_imports`.
     - Return status 200.
- **Command:**
  - `php artisan test --filter=ScheduleImportTest`
- **Testing:**
  - Ambil baris import berstatus `unmatched`, kirim `PATCH` dengan `matched_teacher_id` yang valid ➔ Status baris berubah menjadi `matched`.
  - Panggil `DELETE` pada import berstatus `preview_ready` ➔ Data terhapus dan file storage bersih.
- **Kriteria keberhasilan:**
  - Waka memiliki kendali penuh menyelesaikan data anomali sebelum melakukan konfirmasi final.

---

### Tugas 3.4 · Konfirmasi Final Import PDF & Replace Per Putaran (`POST /api/schedule-imports/{id}/confirm`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Method `confirm()` di `ScheduleImportController` sudah ada, namun perlu diverifikasi:
    - Hanya jadwal pada `cycle_type` yang sama yang di-soft-delete (jadwal putaran lain tidak boleh terhapus).
    - Insert jadwal baru menyertakan `source = 'imported'` dan `import_batch_id = $import->id`.
    - File fisik PDF dihapus dari storage segera setelah transaksi berhasil.
    - Status import berubah menjadi `confirmed`.
- **Solusi:**
  - Pastikan transaksi atomik di `confirm()` membungkus seluruh aksi di atas dan memverifikasi password Waka (422 jika gagal).
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/ScheduleImportController.php` (L56–L99).
- **Implementasi:**
  1. Validasi `'password' => 'required|string'`.
  2. Verifikasi password Waka via `$this->passwordIsConfirmed($request)`.
  3. `DB::transaction(function () use ($import) { ... })`:
     - `Schedule::where('cycle_type', $import->cycle_type)->delete();` (Soft-delete).
     - Insert seluruh baris `ScheduleImportRow` yang berstatus `matched` ke tabel `schedules`.
     - Hapus file PDF fisik dari storage.
     - Update record `ScheduleImport` status `confirmed`, `file_path_kelas = null`, `file_path_ruangan = null`.
- **Command:**
  - `php artisan test --filter=ScheduleImportTest`
- **Testing:**
  - Lakukan import pada Putaran 1. Pastikan jadwal Putaran 2 tetap utuh dan jurnal historis yang terhubung ke jadwal lama Putaran 1 tetap bisa diakses (*tidak orphan/rusak*).
- **Kriteria keberhasilan:**
  - Acceptance Criteria UKK: "Replace Per Putaran" terpenuhi 100%.

---

## FASE 4: Alur Jurnal KBM, Presensi Exception-Based & Guru Berhalangan Hadir (PRD 9.7)

Tujuan fase ini adalah menyatukan endpoint penyelesaian jurnal KBM menjadi satu request atomik (`PUT /api/journals/{id}`), menerapkan presensi *exception-based*, mengompresi foto sesuai standar PRD (~800px JPEG quality 30-40%), dan mengeliminasi ketergantungan pada tabel legacy `substitute_assignments`.

---

### Tugas 4.1 · Buka Kelas Jurnal & Penanganan Guru Berhalangan Hadir (`POST & PATCH /api/journals`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* `JournalController@store` menggunakan model `SubstituteAssignment`. Padahal PRD v4.4 menetapkan bahwa guru berhalangan hadir ditandai dengan status `teacher_absent` pada jurnal oleh Guru Kesiswaan atau Waka, dan presensi kelas tetap diisi oleh guru pengganti/wali kelas.
  - *Kebutuhan PRD 5.7 & 9.7:*
    - `POST /api/journals`:
      - Guru pemilik jadwal membuka kelas ➔ Jurnal dibuat dengan status `ongoing`.
      - ATAU Kesiswaan/Waka menandai `teacher_absent` pada jadwal hari ini ➔ Jurnal dibuat dengan status `teacher_absent`.
    - `PATCH /api/journals/{id}`:
      - Kesiswaan/Waka mengubah status jurnal yang sedang berjalan menjadi `teacher_absent`.
- **Solusi:**
  - Refactor `store()` dan tambahkan `markTeacherAbsent()` di `app/Http/Controllers/API/JournalController.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/JournalController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. Di `store`:
     - Validasi `schedule_id` (required, exists).
     - Cek apakah user adalah guru pemilik jadwal ATAU user memiliki role `vice_principal` / penugasan `kesiswaan`.
     - Jika Waka/Kesiswaan mengirim payload `{ status: 'teacher_absent' }`, buat jurnal dengan `status = 'teacher_absent'`.
     - Jika guru pengajar, buat jurnal dengan status `ongoing`.
     - Saat jurnal dibuka, otomatis cek siswa yang memiliki `leave_requests` approved bertipe `tidak_masuk` untuk hari ini, siapkan draft status absensinya (Sakit/Izin).
  2. Di `markTeacherAbsent`:
     - Khusus Waka/Kesiswaan. Ubah status jurnal menjadi `teacher_absent`.
- **Command:**
  - `php artisan test --filter=JournalTest`
- **Testing:**
  - Kesiswaan menandai jadwal guru yang tidak hadir sebagai `teacher_absent` ➔ Status jurnal tersimpan `teacher_absent`.
  - Verifikasi jadwal tersebut tidak muncul pada alert keterlambatan jurnal `missing_journal`.
- **Kriteria keberhasilan:**
  - Alur `teacher_absent` berfungsi tanpa melibatkan tabel legacy `substitute_assignments`.

---

### Tugas 4.2 · Penyelesaian Jurnal Atomik dengan Kompresi Foto & Presensi Exception-Based (`PUT /api/journals/{id}`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Penyelesaian jurnal saat ini terpecah menjadi `POST /journals/{id}/complete` dan `POST /journals/{id}/attendance`. Kompresi gambar saat ini diatur ke lebar 1024px WebP kualitas 75% (tidak sesuai PRD 5.11).
  - *Kebutuhan PRD 5.8, 5.11 & 9.7:*
    - `PUT /api/journals/{id}`: Endpoint tunggal (multipart) menerima:
      - `topic_description` (string materi)
      - `photo` (file gambar KBM)
      - `exceptions` (array siswa yang TIDAK hadir: student_id dan status Sakit/Izin/Alpa).
    - Seluruh siswa lain di kelas tersebut yang tidak disebutkan otomatis tercatat **Hadir**.
    - Kompresi foto: Resize lebar maksimum ~800px, re-encode JPEG quality ~30-40%, target ukuran file di bawah ~150KB.
    - Status jurnal berubah menjadi `completed`.
- **Solusi:**
  - Implementasikan method `update` pada `JournalController.php` yang menjalankan seluruh proses ini dalam satu transaksi database.
  - Hapus/gabungkan logika dari `AttendanceController.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/JournalController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. Validasi:
     - `topic_description => required|string|min:10`
     - `photo => required|image|mimes:jpg,jpeg,png|max:5120`
     - `exceptions => nullable|array`
     - `exceptions.*.student_id => required|exists:users,id`
     - `exceptions.*.status => required|in:Sakit,Izin,Alpa`
  2. Proses kompresi gambar via Intervention Image:
     ```php
     $img = Image::read($file);
     $img->scaleDown(width: 800);
     $encoded = $img->toJpeg(quality: 35);
     $filename = 'journals/' . Str::uuid() . '.jpg';
     Storage::disk('public')->put($filename, (string) $encoded);
     ```
  3. Dalam `DB::transaction()`:
     - Update jurnal: `topic_description`, `photo_path = $filename`, `status = 'completed'`.
     - Ambil seluruh ID siswa aktif di kelas jadwal tersebut: `$allStudents = User::where('role', 'student')->where('class_id', $classId)->pluck('id')`.
     - Petakan siswa dalam `exceptions` sesuai status yang dikirim guru.
     - Sisanya otomatis diberi record status `Hadir`.
     - Simpan data ke tabel `attendances` dengan `upsert` atau `insert`.
- **Command:**
  - `php artisan test --filter=JournalTest`
- **Testing:**
  - Kirim 1 siswa Sakit dari kelas beranggotakan 36 siswa ➔ Sistem mencatat 1 Sakit dan 35 Hadir.
  - Periksa file gambar di storage ➔ Format file JPEG, lebar <= 800px, ukuran file < 150KB.
- **Kriteria keberhasilan:**
  - Acceptance Criteria UKK: "Presensi Exception-Based" dan "Kompresi Foto Jurnal" terpenuhi 100%.

---

### Tugas 4.3 · Monitoring & Rekap Jurnal Mengajar (`GET /api/journals`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Route `GET /api/journals` belum diimplementasikan. Yang ada saat ini adalah `GET /reports/journals` yang tidak terstandarisasi.
  - *Kebutuhan PRD 9.7:* `GET /api/journals` berpaginasi.
    - Waka: Dapat melihat seluruh riwayat jurnal sekolah (dengan filter tanggal, kelas, guru).
    - Guru: Terfilter otomatis hanya melihat jurnal yang diajarnya sendiri.
- **Solusi:**
  - Buat method `index` pada `JournalController.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/JournalController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. Scope query: Jika role user `teacher`, batasi `$query->whereHas('schedule', fn($q) => $q->where('teacher_id', $user->id))`.
  2. Dukung filter `date`, `start_date`, `end_date`, `class_id`.
  3. Load relasi `schedule.subject`, `schedule.schoolClass`, `schedule.teacher`.
  4. Return paginated response standar.
- **Command:**
  - `php artisan test --filter=JournalTest`
- **Testing:**
  - Guru A memanggil `GET /api/journals` ➔ Hanya melihat jurnalnya sendiri.
  - Waka memanggil `GET /api/journals` ➔ Melihat jurnal seluruh guru.
- **Kriteria keberhasilan:**
  - Endpoint monitoring jurnal berjalan dengan auto-scoping role yang aman.

---

## FASE 5: Manajemen Perizinan Siswa & Sinkronisasi Presensi (PRD 9.6)

Tujuan fase ini adalah membangun modul perizinan siswa (`leave_requests`) yang mendukung 2 tipe x 2 kategori perizinan, mengizinkan siswa membatalkan/mengedit izin saat status masih pending, verifikasi oleh Kesiswaan/Waka, dan sinkronisasi otomatis ke absensi jurnal.

---

### Tugas 5.1 · Pengajuan, Pembatalan & Verifikasi Perizinan Siswa (`/api/leave-requests`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Controller saat ini bernama `StudentPermisionController` dengan rute `/permissions`. Tidak mendukung pembatalan oleh siswa, tidak mendukung tipe `keluar_sekolah`, dan validasi file tidak sesuai PRD.
  - *Kebutuhan PRD 5.10 & 9.6:*
    - `POST /api/leave-requests`: Siswa/Ortu mengajukan izin.
      - Tipe `tidak_masuk`: wajib `start_date`, `end_date`, `category` (`sakit`, `lainnya`).
      - Tipe `keluar_sekolah`: same-day, wajib `departure_time`, `expected_return_time`, `category`.
      - Dokumen bukti: jpg/jpeg/png/pdf, maks 2MB.
    - `GET /api/leave-requests`:
      - Kesiswaan/Waka: melihat semua + filter status.
      - Siswa/Ortu: auto-scoped hanya data diri/anaknya.
    - `PATCH /api/leave-requests/{id}`:
      - Kesiswaan: verifikasi status (`approved` / `rejected`), tercatat `verified_by` & `verified_at`.
      - Siswa pemilik: mengedit data izin selama status masih `pending`.
    - `DELETE /api/leave-requests/{id}`:
      - Siswa pemilik membatalkan pengajuan selama status masih `pending`.
- **Solusi:**
  - Buat `app/Http/Controllers/API/LeaveRequestController.php` untuk menangani 4 endpoint tersebut.
  - Daftarkan rute di `routes/api.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/LeaveRequestController.php` (Baru).
  - `routes/api.php`.
- **Implementasi:**
  1. `store`: Simpan `applicant_id = auth()->id()`, simpan file dokumen bukti ke storage.
  2. `index`: Paginasi dengan filtering status. Terapkan scope role.
  3. `update`: Deteksi aktor. Jika kesiswaan, ubah status dan isi `verified_by = auth()->id()`, `verified_at = now()`. Jika siswa pemilik, izinkan perubahan field jika status masih `pending`.
  4. `destroy`: Hapus data jika status masih `pending` dan milik user login.
- **Command:**
  - `php artisan make:controller API/LeaveRequestController`
- **Testing:**
  - Siswa mengajukan izin ➔ Status `pending`.
  - Siswa membatalkan izin ➔ Berhasil dihapus (200).
  - Kesiswaan memverifikasi izin menjadi `approved` ➔ Status tersimpan beserta data verifikator.
  - Siswa mencoba menghapus izin yang sudah `approved` ➔ Ditolak 422/403.
- **Kriteria keberhasilan:**
  - Seluruh alur perizinan sesuai aturan PRD Bagian 5.10.

---

### Tugas 5.2 · Sinkronisasi Otomatis Perizinan ke Presensi Jurnal & Rekapitulasi Presensi
- **Masalah dan tujuan:**
  - *Kebutuhan PRD 5.9 & 9.6:*
    - Saat guru membuka kelas atau presensi digenerate: Siswa dengan `leave_requests` berstatus `approved` bertipe `tidak_masuk` (pada rentang tanggal yang sesuai) otomatis terisi status **Sakit** (jika kategori sakit) atau **Izin** (jika kategori lainnya).
    - Izin bertipe `keluar_sekolah` **TIDAK mengubah status presensi (tetap Hadir)**.
    - `GET /api/attendances`: Waka/Kesiswaan melihat rekap semua presensi; Siswa/Ortu auto-scoped melihat presensi mandiri.
- **Solusi:**
  - Integrasikan pengecekan `leave_requests` ke dalam pembuatan presensi default di `JournalController` atau `AttendanceService`.
  - Buat method `index` pada `AttendanceController.php` untuk melayani `GET /api/attendances`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/AttendanceController.php`.
  - `app/Http/Controllers/API/JournalController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. Di `JournalController`: Query `LeaveRequest::where('status', 'approved')->where('type', 'tidak_masuk')->whereDate('start_date', '<=', $date)->whereDate('end_date', '>=', $date)`. Masukkan siswa tersebut ke draft absensi Sakit/Izin.
  2. Di `AttendanceController@index`:
     - Jika Siswa/Ortu: scope ke `student_id`.
     - Jika Waka/Kesiswaan: izinkan filter `class_id`, `date`, `status`.
     - Return paginated data presensi.
- **Command:**
  - `php artisan test --filter=AttendanceSyncTest`
- **Testing:**
  - Siswa A izin `tidak_masuk` (sakit) disetujui ➔ Jurnal dibuka ➔ Siswa A otomatis terisi Sakit.
  - Siswa B izin `keluar_sekolah` disetujui ➔ Jurnal dibuka ➔ Siswa B tetap terisi Hadir.
- **Kriteria keberhasilan:**
  - Acceptance Criteria UKK: "Sinkronisasi Izin" terpenuhi 100%.

---

## FASE 6: Workflow Evaluasi Kuis AI Asinkron (PRD 5.14 & 9.8)

Tujuan fase ini adalah merombak modul Kuis AI agar berjalan sepenuhnya asinkron via Queue Worker, mendukung pembuatan kuis oleh guru, review/edit soal esai & pilihan ganda, pengerjaan siswa dengan batasan `max_attempts` dan `due_date`, penilaian AI asinkron, serta audit trail override nilai oleh guru.

---

### Tugas 6.1 · Pembuatan Kuis Asinkron & Polling Status (`POST & GET /api/quizzes`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Pembuatan kuis saat ini dipicu lewat `POST /journals/{id}/quiz/generate`.
  - *Kebutuhan PRD 5.14 & 9.8:*
    - `POST /api/quizzes`: Auth (Guru). Menerima `title`, `class_id`, `due_date`, `max_attempts`, dan materi/topik kuis.
    - Status kuis awal: `generating`.
    - Memicu job asinkron `GenerateQuizJob` ➔ mengembalikan respons **202 Accepted**.
    - Job mengeksekusi pembuatan soal AI (via Google Generative AI / script generator), mengisi `quiz_questions`, lalu mengubah status kuis menjadi `draft_review`.
    - `GET /api/quizzes`: Paginasi kuis (Guru: miliknya; Siswa: published di kelasnya).
    - `GET /api/quizzes/{id}`: Polling detail & status kuis.
- **Solusi:**
  - Refactor `QuizController.php` dan `GenerateQuizJob.php`.
  - Daftarkan endpoint REST di `routes/api.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/QuizController.php`.
  - `app/Jobs/GenerateQuizJob.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. `store`: Validasi `title`, `class_id`, `due_date` (after:now), `max_attempts` (min:1), `topic`.
     - Buat record `Quiz::create(['teacher_id' => auth()->id(), 'status' => 'generating', ...])`.
     - Dispatch `GenerateQuizJob::dispatch($quiz->id, $request->topic)`.
     - Return respons 202 JSON.
  2. Di `GenerateQuizJob`:
     - Panggil AI engine untuk membuat 5–10 soal (kombinasi pilihan ganda dan esai berserta rubrik kata kunci).
     - Simpan butir soal ke `quiz_questions`.
     - Update status kuis menjadi `draft_review`.
- **Command:**
  - `php artisan test --filter=QuizAsyncTest`
- **Testing:**
  - Guru men-trigger `POST /api/quizzes` ➔ Mendapat respons 202 tanpa blocking HTTP.
  - Jalankan queue worker ➔ Status kuis bertransisi dari `generating` menjadi `draft_review` dan `quiz_questions` terisi.
- **Kriteria keberhasilan:**
  - Proses generate tidak pernah memblokir response HTTP client.

---

### Tugas 6.2 · Review & Edit Soal Kuis oleh Guru (`/api/quizzes/{id}/questions`, `/publish`)
- **Masalah dan tujuan:**
  - *Kebutuhan PRD 5.14 & 9.8:*
    - Guru berhak mereview, mengedit teks soal, opsi jawaban, dan kunci jawaban/rubrik (`GET & PUT /api/quizzes/{id}/questions/{question_id}`).
    - Guru dapat mengubah status kuis menjadi `published` (`PATCH /api/quizzes/{id}`) sehingga dapat dikerjakan siswa.
- **Solusi:**
  - Tambahkan method `questions`, `updateQuestion`, dan `update` (patch status) di `QuizController.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/QuizController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. `questions($id)`: Ambil seluruh soal untuk kuis terkait (khusus guru pemilik).
  2. `updateQuestion($id, $question_id, Request $request)`: Validasi dan perbarui teks soal, opsi, atau kata kunci rubrik esai.
  3. `update($id, Request $request)`: Guru mengubah status kuis dari `draft_review` menjadi `published`.
- **Command:**
  - `php artisan test --filter=QuizQuestionTest`
- **Testing:**
  - Guru mengedit kunci rubrik esai ➔ Perubahan tersimpan.
  - Guru mempublikasikan kuis ➔ Status berubah menjadi `published`.
  - Siswa membuka detail kuis ➔ Kunci jawaban `correct_answer` disembunyikan (*hidden*).
- **Kriteria keberhasilan:**
  - Guru memegang kendali mutu soal AI sebelum siswa mulai mengerjakan.

---

### Tugas 6.3 · Submission Siswa & Penilaian AI Asinkron (`/submissions`, `GradeQuizSubmissionJob`)
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Submission dikoreksi secara sinkron dan hanya mencocokkan string huruf pilihan ganda. Siswa ditolak jika mencoba kedua kalinya.
  - *Kebutuhan PRD 5.14 & 9.8:*
    - Siswa mengirim jawaban via `POST /api/quizzes/{id}/submissions`.
    - Ditolak (422) jika waktu sekarang melewati `due_date` ATAU jumlah percobaan siswa sudah mencapai `max_attempts`.
    - Submission dicatat dengan nomor percobaan (`attempt_number`), status penilaian `pending`.
    - Memicu job asinkron `GradeQuizSubmissionJob` (mengoreksi pilihan ganda secara otomatis dan mengevaluasi jawaban esai berdasarkan rubrik kata kunci AI) ➔ Update status menjadi `graded`, isi `ai_score` dan `ai_feedback`.
- **Solusi:**
  - Implementasikan endpoint `submit` di `QuizController.php` dan buat queue job `app/Jobs/GradeQuizSubmissionJob.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/QuizController.php`.
  - `app/Jobs/GradeQuizSubmissionJob.php` (Baru).
  - `routes/api.php`.
- **Implementasi:**
  1. Di `submit`:
     - Cek kuis `status === 'published'`. Cek `now() <= $quiz->due_date`.
     - Hitung jumlah attempt siswa: `$attempts = QuizSubmission::where('quiz_id', $id)->where('student_id', $user->id)->count()`.
     - Jika `$attempts >= $quiz->max_attempts`, tolak 422: "Batas percobaan telah habis".
     - Buat submission: `attempt_number = $attempts + 1`, `grading_status = 'pending'`, `answers_payload = $request->answers`.
     - Dispatch `GradeQuizSubmissionJob::dispatch($submission->id)`. Return 202 Accepted.
  2. Di `GradeQuizSubmissionJob`:
     - Hitung skor pilihan ganda. Evaluasi esai terhadap rubrik.
     - Simpan akumulasi `ai_score` dan teks evaluasi `ai_feedback`.
     - Ubah `grading_status = 'graded'`.
- **Command:**
  - `php artisan make:job GradeQuizSubmissionJob`
  - `php artisan test --filter=QuizSubmissionTest`
- **Testing:**
  - Siswa submit percobaan ke-1 ➔ Diterima (202).
  - Siswa submit percobaan ke-2 (jika max_attempts=2) ➔ Diterima sebagai attempt 2.
  - Siswa submit setelah deadline ➔ Ditolak 422.
- **Kriteria keberhasilan:**
  - Acceptance Criteria UKK: "Kuis AI Asinkron" ditegakkan.

---

### Tugas 6.4 · Review Guru, Override Nilai & Publikasi Hasil Kuis (`PATCH /quiz-submissions/{id}`, `/submissions/me`)
- **Masalah dan tujuan:**
  - *Kebutuhan PRD 5.14 & 9.8:*
    - Guru mereview seluruh submission siswa (`GET /api/quizzes/{id}/submissions`).
    - Guru dapat meng-override nilai atau feedback hasil AI (`PATCH /api/quiz-submissions/{id}`). Setiap override wajib mencatat audit trail: `is_overridden = true`, `overridden_by = auth()->id()`, `overridden_at = now()`.
    - Guru mempublikasikan hasil (`published_result`).
    - Siswa dan Orang Tua dapat melihat nilai & feedback akhir melalui `GET /api/quizzes/{id}/submissions/me` setelah hasil dipublikasikan.
- **Solusi:**
  - Tambahkan method `submissions`, `overrideSubmission`, dan `mySubmission` di `QuizController.php`.
- **File dan lokasi kode:**
  - `app/Http/Controllers/API/QuizController.php`.
  - `routes/api.php`.
- **Implementasi:**
  1. `overrideSubmission($id, Request $request)`:
     - Validasi `score => required|numeric|min:0|max:100`, `feedback => nullable|string`.
     - Update record: `ai_score = $request->score`, `ai_feedback = $request->feedback`, `is_overridden = true`, `overridden_by = auth()->id()`, `overridden_at = now()`.
  2. `mySubmission($id, Request $request)`:
     - Cek apakah status kuis sudah `published_result`. Jika belum, kembalikan info bahwa hasil belum diumumkan.
     - Ambil submission siswa terbaik / attempt terakhir beserta nilai dan feedback.
- **Command:**
  - `php artisan test --filter=QuizOverrideTest`
- **Testing:**
  - Guru meng-override nilai AI dari 70 menjadi 85 ➔ Field `is_overridden` bernilai true dan nama guru tercatat.
  - Siswa dan orang tua mengakses nilai setelah dipublish ➔ Nilai 85 dan feedback tampil.
- **Kriteria keberhasilan:**
  - Audit trail penilaian transparan dan akuntabel.

---

## FASE 7: Profil, Verifikasi Kontak & Scheduled Background Jobs (PRD 5.2, 8, 9.1)

Tujuan fase ini adalah menyediakan mekanisme self-service linking kontak (email, WhatsApp OTP, Google ID) serta mengaktifkan background cron jobs (pembersihan akun lulusan 14 hari dan OTP kedaluwarsa).

---

### Tugas 7.1 · Endpoint Profil & Verifikasi Kontak Mandiri (`/api/me/*`)
- **Masalah dan tujuan:**
  - *Kebutuhan PRD 5.2 & 9.1:*
    - Akun awal dibuat tanpa email/no HP. Pengguna menautkannya sendiri secara mandiri:
      - `POST /api/me/email` & `POST /api/me/email/verify`: Kirim kode OTP 6 digit ke email, verifikasi kode, set `email_verified_at`.
      - `POST /api/me/phone` & `POST /api/me/phone/verify`: Kirim OTP WhatsApp via Twilio, verifikasi kode, simpan `phone_number`.
      - `POST /api/me/google-link`: Kirim Google `id_token`, verifikasi dan simpan `google_id` (auto-isi email jika masih kosong).
- **Solusi:**
  - Buat migration tabel `otp_codes` (id, user_id, code, purpose, expires_at).
  - Tambahkan method penautan kontak di `AuthController.php` (atau controller terpisah `ProfileController.php`).
- **File dan lokasi kode:**
  - `database/migrations/2026_10_20_000003_create_otp_codes_table.php` (Baru).
  - `app/Models/OtpCode.php` (Baru).
  - `app/Http/Controllers/API/ProfileController.php` (Baru).
  - `routes/api.php`.
- **Implementasi:**
  1. Generate random 6 digit numeric code, simpan dengan `expires_at = now()->addMinutes(10)`.
  2. Verifikasi kode: jika cocok dan belum expired, update data user dan hapus baris OTP.
- **Command:**
  - `php artisan make:controller API/ProfileController`
  - `php artisan test --filter=ProfileContactTest`
- **Testing:**
  - Request OTP email ➔ Masukkan kode benar ➔ Email terverifikasi.
  - Masukkan kode salah atau expired ➔ Ditolak 422.
- **Kriteria keberhasilan:**
  - Seluruh pengguna dapat memverifikasi email, no HP, dan menautkan akun Google.

---

### Tugas 7.2 · Scheduled Job Retensi Akun Siswa Lulus (14 Hari) & Pembersihan OTP
- **Masalah dan tujuan:**
  - *Kebutuhan PRD 5.13 & Bagian 8:*
    - Akun siswa kelas akhir yang lulus memiliki kolom `graduation_date`.
    - Scheduled job harian wajib menghapus PERMANEN (*forceDelete*) akun siswa dan data terkait (presensi, perizinan, submission kuis) tepat **14 hari setelah graduation_date**.
    - Scheduled job harian membersihkan kode OTP yang kedaluwarsa (`expires_at < now()`).
- **Solusi:**
  - Buat Artisan Command `app/Console/Commands/PruneGraduatedStudents.php`.
  - Buat Artisan Command `app/Console/Commands/PruneExpiredOtps.php`.
  - Daftarkan jadwal eksekusi di `routes/console.php`.
- **File dan lokasi kode:**
  - `app/Console/Commands/PruneGraduatedStudents.php` (Baru).
  - `app/Console/Commands/PruneExpiredOtps.php` (Baru).
  - `routes/console.php`.
- **Implementasi:**
  1. Di `PruneGraduatedStudents`:
     - Cari siswa di mana `graduation_date <= now()->subDays(14)->toDateString()`.
     - Gunakan transaksi untuk menghapus permanen (*forceDelete*) data presensi, submission kuis, perizinan, akun orang tua terkait, dan akun siswa tersebut.
  2. Di `routes/console.php`:
     ```php
     Schedule::command('scp:prune-graduated-students')->dailyAt('02:00');
     Schedule::command('scp:prune-expired-otps')->dailyAt('03:00');
     ```
- **Command:**
  - `php artisan scp:prune-graduated-students`
- **Testing:**
  - Buat siswa dengan `graduation_date = now()->subDays(15)` ➔ Jalankan command ➔ Akun terhapus permanen dari database.
  - Buat siswa dengan `graduation_date = now()->subDays(10)` ➔ Jalankan command ➔ Akun tetap aman.
- **Kriteria keberhasilan:**
  - Acceptance Criteria UKK: "Kenaikan Kelas & Kelulusan (Retensi 14 Hari)" terpenuhi 100%.

---

## FASE 8: Pembersihan Route & Dead Code (R-01 s.d. R-15)

Tujuan fase ini adalah membersihkan route percobaan, mengeliminasi controller legacy yang tidak tercantum dalam 66 endpoint PRD, dan memastikan rute API bersih, konsisten, dan aman.

---

### Tugas 8.1 · Pembersihan Rute Percobaan & Controller Legacy
- **Masalah dan tujuan:**
  - *Kondisi saat ini:* Terdapat beberapa route eksperimental dan controller legacy:
    - `/ping`, `/waka-only` (rute percobaan).
    - `POST /substitute` & `SubstituteAssignmentController.php` (legacy).
    - `GET /attendance-warnings` & `AttendanceWarningController.php` (digantikan `GET /api/schedules?status=missing_journal`).
    - `GET /reports/journals` (digantikan `GET /api/journals`).
    - `POST /journals/{id}/attendance` & `POST /journals/{id}/complete` (digantikan atomic `PUT /api/journals/{id}`).
- **Solusi:**
  - Hapus controller dan route yang sudah tidak relevan.
  - Buat migration untuk mendrop tabel `substitute_assignments` (jika tidak lagi dipakai).
- **File dan lokasi kode:**
  - `routes/api.php`.
  - Hapus: `app/Http/Controllers/API/AttendanceWarningController.php`, `SubstituteAssignmentController.php`, `ReportController.php`.
- **Implementasi:**
  1. Bersihkan `routes/api.php` dari route legacy.
  2. Hapus class controller legacy dari folder `app/Http/Controllers/API/`.
- **Command:**
  - `php artisan route:list --path=api`
- **Testing:**
  - Jalankan `php artisan route:list` ➔ Hanya rute resmi PRD yang terdaftar.
  - Jalankan seluruh automated test suite ➔ Tidak ada test yang gagal akibat route dihapus.
- **Kriteria keberhasilan:**
  - Codebase bersih dari dead code dan technical debt.

---

## FASE 9: Pengujian Komprehensif & Verifikasi Kesiapan Sistem (PRD Bagian 10)

Tujuan fase ini adalah memverifikasi seluruh fungsionalitas sistem terhadap 11 butir Checklist Kriteria Kelulusan UKK pada PRD Bagian 10, menguji performa query dan constraint PostgreSQL, serta memastikan project siap digunakan (*production ready*).

---

### Tugas 9.1 · Automated Test Suite untuk 11 Kriteria Kelulusan UKK (PRD Bagian 10)
- **Tabel Verifikasi Kriteria:**

| # | Kriteria Kelulusan (PRD 10) | File Test Penanggung Jawab | Skenario yang Diuji |
|---|---|---|---|
| 1 | **API Security** | `tests/Feature/SecurityTest.php` | Request tanpa token ditolak (401); Throttle 60 req/min aktif (429); Token expired ditolak (401). |
| 2 | **Jadwal Milik Waka** | `tests/Feature/ScheduleTest.php` | Guru tidak memiliki endpoint mutasi jadwal; Mutasi Waka wajib password (422 jika salah); Soft-delete jadwal. |
| 3 | **Import Jadwal PDF** | `tests/Feature/ScheduleImportTest.php` | Parsing 2 PDF asinkron; Preview matched/unmatched/conflict akurat; Resolusi manual baris; Rollback import. |
| 4 | **Replace Per Putaran** | `tests/Feature/ScheduleImportTest.php` | Confirm import hanya soft-delete jadwal pada cycle_type terkait; Jurnal historis tetap terhubung utuh. |
| 5 | **Resolusi Jam Pelajaran** | `tests/Feature/PeriodResolutionTest.php` | Waktu riil periode dihitung akurat sesuai day_type (Senin upacara vs reguler, Jumat 40 menit); Alert missing journal (30 menit). |
| 6 | **Auto-Provisioning Akun** | `tests/Feature/UserProvisioningTest.php` | Input Siswa otomatis buat akun Siswa + Ortu; Password acak 8 karakter; `must_change_password` aktif. |
| 7 | **Multirole Guru** | `tests/Feature/TeacherAssignmentTest.php` | Guru memegang penugasan Kesiswaan + Wali Kelas sekaligus; Middleware assignment memvalidasi hak akses tepat. |
| 8 | **Sinkronisasi Izin** | `tests/Feature/LeaveRequestSyncTest.php` | Izin `tidak_masuk` Approved otomatis mengisi Sakit/Izin pada rentang tanggal; Izin `keluar_sekolah` tetap tercatat Hadir. |
| 9 | **Presensi Exception-Based** | `tests/Feature/JournalAttendanceTest.php` | Payload PUT jurnal hanya mencantumkan siswa tidak hadir; Siswa sisanya otomatis tercatat Hadir; Kompresi foto ~800px <150KB. |
| 10 | **Kuis AI Asinkron** | `tests/Feature/QuizWorkflowTest.php` | Generate kuis 202 non-blocking; Submission multi-attempt dibatasi `max_attempts` & `due_date`; Penilaian asinkron; Guru override. |
| 11 | **Kenaikan Kelas & Retensi** | `tests/Feature/ClassPromotionTest.php` | Promosi kelas massal & hold-back; Siswa kelas akhir lulus; Scheduled job harian hard delete 14 hari pasca graduation. |

- **Command:**
  - `php artisan test`
- **Kriteria keberhasilan:**
  - Seluruh test (100% green) lulus tanpa failure atau error.

---

### Tugas 9.2 · Pengujian Konsistensi Foreign Key PostgreSQL & Database Seeder
- **Masalah dan tujuan:**
  - Memastikan integritas referensial database saat deploy ke PostgreSQL: foreign key constraint berjalan ketat, tidak ada data yatim (*orphan data*), dan seeder awal berjalan tanpa konflik.
- **Command:**
  - `php artisan migrate:fresh --seed`
  - `php artisan test`
- **Testing:**
  - Coba insert data siswa dengan `class_id` yang tidak ada ➔ Database menolak foreign key constraint.
  - Coba hapus kelas yang direferensikan jadwal aktif ➔ Ditolak HTTP 409.
- **Kriteria keberhasilan:**
  - Database schema stabil, konsisten, dan seluruh seeder terisi lengkap.

---

## 3. Catatan Penyempurnaan PRD (Rekomendasi Tambahan)

Berdasarkan analisis arsitektur, berikut adalah catatan teknis yang disarankan untuk menyempurnakan PRD v4.4:
1. **Fallback Engine Kuis AI**: Disarankan menyediakan opsi pemanggilan langsung Google Generative AI (Gemini API via Laravel HTTP Client) di samping script Python, untuk memangkas overhead proses subprocess OS dan meningkatkan keandalan di lingkungan cloud.
2. **Fleksibilitas Input Login**: Pada `POST /api/login`, disarankan menerima input `username` (sesuai PRD) dengan fallback otomatis ke `nis_nip` (sesuai kode mobile/web) agar kedua variasi payload didukung secara transparan.
3. **Abstraksi Supabase Storage**: Pada development lokal, sediakan fallback transparan ke disk `public`/`local` jika kredensial S3/Supabase belum diisi di `.env`, sehingga proses pengujian offline tetap berjalan lancar.

---

## 4. Definition of Done (DoD) Project

Project SCP dinyatakan **selesai 100% dan siap digunakan** apabila:
- [ ] 66 endpoint REST API diimplementasikan sesuai rute, method, dan otorisasi PRD Bagian 9.
- [ ] Seluruh response sukses dan error mengikuti standar JSON format `{ success, message, data, meta, errors }`.
- [ ] 11 Acceptance Criteria PRD Bagian 10 lolos uji otomatis via PHPUnit (`php artisan test`).
- [ ] Seluruh data master terproteksi dari penghapusan tidak sengaja (409 Conflict).
- [ ] Password re-confirmation melindungi aksi mutasi jadwal Waka.
- [ ] Import PDF berhasil memproses jadwal kelas dan ruangan dari FET Waka secara asinkron.
- [ ] Alur jurnal mengajar, kompresi foto, dan presensi exception-based berjalan stabil.
- [ ] Evaluasi kuis AI asinkron dan audit trail override guru berfungsi penuh.
- [ ] Scheduled background jobs untuk retensi data lulusan dan OTP aktif.
