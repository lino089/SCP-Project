# Rencana Perbaikan Backend SCP (PRD v4.4)

Dokumen ini merangkum hasil analisis antara **PRD_SCP_v4_4_Backend** dan kode yang sudah dibuat (model, migration, controller, route), lalu mengubahnya menjadi rencana kerja yang bisa langsung diikuti.

---

## 1. Ringkasan Status

| Item | Jumlah |
|---|---|
| Total endpoint di PRD (bagian 9) | **66** |
| Sudah ada dan sesuai PRD | **16** |
| Sudah ada tetapi path salah | **2** |
| Belum ada | **48** |
| Route ada di kode tetapi tidak ada di PRD | **10** |
| Route percobaan yang perlu dibersihkan | **3** |

Rincian endpoint yang belum ada, per kelompok PRD:

| Kelompok PRD | Total | Sudah ada | Path salah | Belum ada |
|---|---|---|---|---|
| 9.1 Autentikasi & Profil | 8 | 3 | 0 | 5 |
| 9.2 Setting Akademik & Riwayat | 4 | 1 | 0 | 3 |
| 9.3 Master Data & Penugasan | 24 | 6 | 1 | 17 |
| 9.4 Jadwal | 4 | 1 | 0 | 3 |
| 9.5 Import Jadwal PDF | 5 | 3 | 0 | 2 |
| 9.6 Perizinan & Presensi | 5 | 0 | 0 | 5 |
| 9.7 Jurnal | 4 | 1 | 0 | 3 |
| 9.8 Kuis AI | 12 | 1 | 1 | 10 |
| **Total** | **66** | **16** | **2** | **48** |

### Cara membaca prioritas

| Label | Arti |
|---|---|
| **P0** | Fondasi. Harus selesai lebih dulu karena pekerjaan lain bergantung padanya, atau karena bisa menyebabkan bug serius. |
| **P1** | Tinggi. Fitur inti atau perbaikan yang menyimpang dari PRD. |
| **P2** | Sedang. Dikerjakan setelah fitur inti stabil. |
| **P3** | Rendah. Boleh dikerjakan belakangan. |

Kode item: **F** = perbaikan, **N** = dibuat baru, **R** = dihilangkan.

---

## 2. Perlu Diperbaiki

Bagian yang sudah ada tetapi masih salah, tidak sesuai PRD, atau perlu dioptimalkan.

### P0: Kerjakan pertama

#### F-01 · Model `SchoolClass`

- **Yang dilakukan:**
  - Tambahkan `protected $table = 'classes';`.
  - Ganti `protected $guard = ['id'];` menjadi `protected $fillable = ['name', 'level', 'next_class_id'];`.
  - Pertahankan `use SoftDeletes;`.
- **Alasan:**
  - Tanpa `$table`, Eloquent mencari tabel `school_classes` dan query gagal.
  - `$guard` bukan properti Eloquent, jadi tidak berpengaruh. Mass assignment pada `create()` akan ditolak atau datanya dibuang diam-diam.

#### F-02 · Migration `users`: foreign key belum aktif

- **Yang dilakukan:**
  - Ubah `foreignId('class_id')->nullable()` menjadi `->constrained('classes')->nullOnDelete()`.
  - Lakukan hal yang sama untuk `linked_student_id`, dengan `->constrained('users')->nullOnDelete()`.
  - Pastikan urutan migration: `classes` dibuat **sebelum** `users` mereferensikannya. Jika tidak bisa, tambahkan FK lewat migration terpisah setelah kedua tabel ada.
- **Alasan:** Saat ini keduanya hanya kolom `unsigned bigint` tanpa constraint, sehingga database tidak menolak `class_id` yang tidak ada. Ini juga yang akan diuji pada sub-phase 6.3 (konsistensi FK PostgreSQL).

#### F-03 · Nama controller `academicSettingController`

- **Yang dilakukan:** Ubah nama class dan file menjadi `AcademicSettingController`, lalu perbarui `use` di `routes/api.php`.
- **Alasan:** Windows tidak membedakan huruf besar-kecil, tetapi server Linux membedakannya. Aplikasi bisa berjalan lokal lalu gagal saat deploy dengan error *class not found*.

#### F-04 · `AuthController@login`

- **Yang dilakukan:**
  - Ganti `Auth::attempt()` dengan `User::where('nis_nip', ...)->first()` dan `Hash::check()`. Hapus query `firstOrFail()` kedua yang redundan.
  - Ubah `data` menjadi objek: `{ token, expires_at, must_change_password }`.
  - Perbaiki key `'error'` menjadi `'errors'`, dengan bentuk `['nis_nip' => ['NIS/NIP atau password salah']]`.
  - Atur masa berlaku token 30 hari di `config/sanctum.php`: `'expiration' => 43200`.
- **Alasan:**
  - `Auth::attempt()` membuat state session yang tidak diperlukan pada API berbasis token.
  - PRD meminta `Bearer Token + expires_at`, dan klien perlu `must_change_password` untuk memaksa ganti password.
  - Format error harus seragam dengan standar PRD.

### P1: Tinggi

#### F-05 · Path route yang salah

- **Yang dilakukan:**
  - `POST /subject` menjadi `POST /subjects`.
  - `POST /quizzes/{id}/submit` menjadi `POST /quizzes/{id}/submissions`.
- **Alasan:** PRD memakai penamaan resource jamak. Klien (React/Flutter) mengikuti path di PRD.

#### F-06 · Pembatasan role yang terlalu ketat

- **Yang dilakukan:**
  - Pindahkan `GET /classes` ke grup `auth:sanctum` tanpa filter role. `POST`, `PUT`, dan `DELETE` tetap di grup Waka.
  - Pindahkan `GET /quizzes/{id}` ke grup yang mengizinkan Guru dan Siswa (misalnya `role:teacher,student`), bukan hanya `role:student`.
- **Alasan:** PRD menyebut `GET /api/classes` sebagai `Auth` biasa, dan `GET /api/quizzes/{id}` sebagai `Auth` untuk guru dan siswa. Pada kode saat ini Guru tidak bisa melihat daftar kelas maupun detail kuis.

#### F-07 · `ScheduleController@store`

- **Yang dilakukan:**
  - Kunci `source` menjadi `'manual'` di `create()`, dan hapus `source` dari validasi.
  - Jadikan `duration_periods` `nullable|integer|min:1` dengan nilai default 1 (`?? 1`).
  - Beri batas: `period_number` `min:1`, `cycle_type` `in:1,2`, `day_of_week` `between:1,7` (sesuaikan konvensi).
  - Pastikan `teacher_id` benar-benar user ber-role guru (`Rule::exists('users', 'id')->where('role', 'teacher')`).
  - Pindahkan logika bentrok ke service bersama (lihat **N-04**).
  - Bungkus pengecekan dan insert dalam `DB::transaction()`.
- **Alasan:**
  - Endpoint manual yang menerima `source = imported` merusak audit.
  - `duration_periods = 0` membuat rentang periode terbalik sehingga pengecekan bentrok bisa terlewat.
  - Dua request bersamaan bisa lolos pengecekan keduanya.

#### F-08 · `SchoolClassController`

- **Yang dilakukan:**
  - `index`: batasi `per_page` (validasi `integer|min:1|max:100`, atau clamping `min(max(..., 1), 100)`).
  - `store`: ubah validasi `level` sesuai tipe kolom di migration, dan tambahkan aturan `unique` jika nama kelas harus unik.
  - `destroy`: tolak dengan **409** jika kelas masih dipakai jadwal aktif.
- **Alasan:** `per_page` tanpa batas bisa membebani query. Aturan 409 pada DELETE tertulis jelas di PRD bagian 9.3. Tanpa itu jadwal bisa merujuk ke kelas yang sudah di-soft-delete.

#### F-09 · `updateMondayStatus`

- **Yang dilakukan:**
  - Ganti `DB::table('system_configurations')->where('id', 1)->update(...)` dengan `SystemConfiguration::firstOrFail()->update(...)` (butuh **N-02**).
  - Kembalikan nilai terbaru: `'data' => ['monday_is_upacara' => $config->monday_is_upacara]`.
- **Alasan:**
  - Query Builder tidak mengisi `updated_at` dan tidak memakai casting.
  - `update()` pada baris yang tidak ada tidak memberi error, sehingga masalah seeder tidak terlihat.

#### F-10 · Konsistensi status kode konfirmasi password

- **Yang dilakukan:** Tentukan satu status kode untuk "password konfirmasi salah" (disarankan **422**, seperti validasi lain) dan terapkan di semua endpoint yang meminta password.
- **Alasan:** Saat ini `updateMondayStatus` memakai 422, sedangkan `ScheduleController@store` memakai 403. Klien harus menangani keduanya berbeda.

### P2: Sedang

#### F-11 · Enum `role` pada migration `users`

- **Yang dilakukan:** Periksa daftar peran di PRD (bagian 3 dan 7) terhadap enum saat ini (`vice_principal`, `teacher`, `student`, `parent`). Jika Kesiswaan dan Guru Piket adalah role terpisah, tambahkan nilainya.
- **Alasan:** Phase 6.2 akan menyeed akun Staf Kesiswaan dan Guru Piket, dan `RoleMiddleware` membandingkan nilai role secara strict. Jika nilainya tidak ada di enum, seeder gagal atau akses selalu ditolak.

#### F-12 · Verifikasi pendaftaran alias middleware

- **Yang dilakukan:** Pastikan alias `role` terdaftar di `bootstrap/app.php` (`$middleware->alias([...])`). Logika `RoleMiddleware` sendiri sudah benar dan tidak perlu diubah.
- **Alasan:** Tanpa alias, semua route `role:...` gagal dikenali.

---

## 3. Perlu Dibuat

### 3.1 Fondasi (P0)

| Kode | Yang dibuat | Alasan |
|---|---|---|
| **N-01** | **Global exception handler** di `bootstrap/app.php` untuk `ValidationException` (422), `ModelNotFoundException` (404), `AuthenticationException` (401), akses ditolak (403), dan throttle (429), khusus `api/*`. | PRD mewajibkan format `{success, message, errors}` untuk semua kode status. Dengan ini controller cukup memakai `$request->validate()` dan blok `Validator::make()` manual tidak diperlukan. |
| **N-02** | Model **`SystemConfiguration`** (`$fillable`, `$casts`) dan seeder baris `id = 1`. | Dibutuhkan F-09 dan endpoint academic-settings. Tanpa baris awal, `firstOrFail()` selalu 404. |
| **N-03** | Model lain dengan `$fillable`, `SoftDeletes` (sesuai kolom `deleted_at` di PRD), relasi, dan `$table` bila perlu: `Schedule`, `Room`, `Subject`, `PeriodTemplate`, `CycleHistory`, `ScheduleImport`, `ScheduleImportRow`, dst. | Dibutuhkan semua controller berikutnya, dan relasi (misalnya `SchoolClass::schedules()`) dipakai untuk pengecekan 409. |
| **N-04** | **`ScheduleConflictService`** yang menerima `cycle_type`, `day_of_week`, `period_number`, `duration_periods`, `teacher_id`, `class_id`, `room_id`, dan opsional `ignoreId`. | Dipakai di tiga tempat: `POST` dan `PUT /schedules`, serta validasi baris import. Satu implementasi mencegah logika berbeda-beda. |
| **N-05** | **Seeder `period_templates`** (tergantung data jam pelajaran lengkap dari sekolah). | PRD hanya memberi jam mulai periode pertama tiap `day_type`. Jam periode berikutnya dan `end_time` harus dilengkapi dulu. |
| **N-06** | **Konfigurasi queue** (misalnya driver `database`) dan worker. | Parsing PDF (202 Accepted) dan generate kuis AI harus asinkron. |
| **N-07** | **Rate limiting** untuk route API. | Tercantum di acceptance criteria "API Security". |

### 3.2 Endpoint yang belum ada (48 endpoint), per tahap

#### Tahap 1 · Master data (17 endpoint) · P1
*Bergantung pada: F-01, F-02, N-01, N-03.*

| Endpoint | Akses | Catatan |
|---|---|---|
| `GET /rooms`, `/students`, `/teachers`, `/subjects` | Auth | Pagination. |
| `POST /rooms` | Waka | |
| `PUT /classes/{id}`, `/rooms/{id}`, `/students/{id}`, `/teachers/{id}`, `/subjects/{id}` | Waka | |
| `DELETE /rooms/{id}`, `/students/{id}`, `/teachers/{id}`, `/subjects/{id}` | Waka | Soft delete, tolak 409 jika masih dipakai jadwal aktif. |
| `DELETE /teachers/{id}/assignments/{assignment_id}` | Waka | Pasangan dari `POST .../assignments` yang sudah ada. |
| `POST /students/{id}/hold-back` | Waka | Butuh `next_class_id` terisi benar. |
| `POST /class-promotions` | Waka | Kenaikan kelas dan penandaan kelulusan (`graduation_date`). |

*Tambahan: ubah path `POST /subject` menjadi `/subjects` (F-05).*

#### Tahap 2 · Pengaturan akademik (3 endpoint) · P1
*Bergantung pada: N-02, N-03. Bisa dikerjakan paralel dengan Tahap 1.*

| Endpoint | Akses | Catatan |
|---|---|---|
| `GET /academic-settings` | Waka | |
| `PATCH /academic-settings` | Waka | Ubah `active_cycle` (nilai 1 atau 2). Dalam satu transaksi: tutup baris `cycle_history` sebelumnya (`ended_at`), buat baris baru (`started_at`, `changed_by`). |
| `GET /cycle-history` | Waka | |

#### Tahap 3 · Jadwal (3 endpoint) · P1
*Bergantung pada: Tahap 1, N-04, N-05.*

| Endpoint | Akses | Catatan |
|---|---|---|
| `GET /schedules` | Auth | Filter `?cycle=1\|2`, `?day=`, pagination. Guru hanya melihat jadwalnya sendiri. Dukung `?status=missing_journal`, yang menghitung waktu dari `period_templates` dan mengecualikan `teacher_absent` (sebagian logika ini baru lengkap setelah Tahap 5). |
| `PUT /schedules/{id}` | Waka | Wajib password dan pengecekan bentrok dengan `ignoreId`. PRD hanya menyebut cek bentrok pada `POST`, tetapi edit juga bisa menciptakan bentrok. |
| `DELETE /schedules/{id}` | Waka | Wajib password, soft delete. |

#### Tahap 4 · Import jadwal PDF (2 endpoint) · P1
*Bergantung pada: Tahap 3, N-06. Tiga endpoint import lainnya sudah ada.*

| Endpoint | Akses | Catatan |
|---|---|---|
| `PATCH /schedule-imports/{id}/rows/{row_id}` | Waka | Resolusi manual satu baris (pilih `class_id`, `teacher_id`, `room_id`, `subject_id`, atau exclude), lalu validasi ulang bentrok. |
| `DELETE /schedule-imports/{id}` | Waka | Hanya untuk import yang belum dikonfirmasi. Hapus juga file PDF di storage. |

*Periksa juga `confirm`: hanya soft-delete jadwal pada `cycle_type` yang sama, insert dengan `source = imported` dan `import_batch_id`, lalu hapus file PDF.*

#### Tahap 5 · Jurnal dan presensi (3 endpoint) · P1
*Bergantung pada: Tahap 3. `POST /journals` sudah ada.*

| Endpoint | Akses | Catatan |
|---|---|---|
| `GET /journals` | Waka (semua), Guru (miliknya) | Pagination. |
| `PUT /journals/{id}` | Guru pemilik | Multipart: foto (dikompresi), topik, `attendances` bersifat exception-based (siswa yang tidak disebut otomatis Hadir). |
| `PATCH /journals/{id}` | Kesiswaan / Waka | Menandai `teacher_absent`. |

#### Tahap 6 · Perizinan dan presensi siswa (5 endpoint) · P2
*Bergantung pada: Tahap 5 (tabel attendances).*

| Endpoint | Akses | Catatan |
|---|---|---|
| `POST /leave-requests` | Siswa | Multipart untuk bukti. |
| `GET /leave-requests` | Kesiswaan (semua), Siswa/Ortu (auto-scoped) | Pagination. |
| `PATCH /leave-requests/{id}` | Kesiswaan (verifikasi), Siswa pemilik (selama pending) | Izin `tidak_masuk` yang disetujui mengisi presensi otomatis pada rentang tanggalnya. |
| `DELETE /leave-requests/{id}` | Siswa pemilik | Hanya selama pending. |
| `GET /attendances` | Waka/Kesiswaan (semua), Siswa/Ortu (auto-scoped) | Pagination. |

#### Tahap 7 · Kuis AI (10 endpoint) · P2
*Bergantung pada: Tahap 5, N-06.*

| Endpoint | Akses | Catatan |
|---|---|---|
| `GET /quizzes` | Guru (miliknya), Siswa (published kelasnya) | Pagination. |
| `POST /quizzes` | Guru | `due_date`, `max_attempts`. Generate lewat job asinkron. |
| `PATCH /quizzes/{id}` | Guru | Ubah status, `due_date`, `max_attempts`. |
| `GET /quizzes/{id}/questions` | Guru | |
| `PUT /quizzes/{id}/questions/{question_id}` | Guru | Review dan edit soal. |
| `POST /quizzes/{id}/submissions` | Siswa | Tolak 422 jika melebihi percobaan atau lewat `due_date`. |
| `GET /quizzes/{id}/submissions` | Guru | |
| `PATCH /quiz-submissions/{id}` | Guru | Override skor atau feedback dengan audit trail. |
| `GET /quizzes/{id}/submissions/me` | Siswa/Ortu | Setelah `published_result`. |
| `GET /quizzes/{id}/questions/{question_id}` | Guru | Detail satu soal, bila PRD dimaksudkan memiliki endpoint ini. Konfirmasi dulu. |

*Catatan: rincian `GET & PUT /quizzes/{id}/questions[/{question_id}]` di PRD ambigu. Jika `GET` per soal tidak diperlukan, jumlah endpoint tahap ini berkurang satu.*

#### Tahap 8 · Profil dan verifikasi kontak (5 endpoint) · P3
*Bergantung pada: F-04. Tidak memblokir fitur lain, jadi bisa dikerjakan kapan saja setelah Tahap 0.*

| Endpoint | Akses |
|---|---|
| `POST /me/email`, `POST /me/email/verify` | Auth |
| `POST /me/google-link` | Auth |
| `POST /me/phone`, `POST /me/phone/verify` | Auth |

### 3.3 Pekerjaan pendukung (P2)

| Kode | Yang dibuat | Alasan |
|---|---|---|
| **N-08** | **Factory** (guru, siswa, kelas, mapel, ruangan) dan **seeder akun resmi** (Waka, Guru Mapel, Guru Piket, Staf Kesiswaan, Siswa, Orang Tua), dengan `Hash::make()` dan `must_change_password = true`. | Phase 6.1 dan 6.2 di rencana awal. Berguna untuk menguji pagination dan pengecekan bentrok. |
| **N-09** | **Scheduled job harian** yang `forceDelete()` akun siswa dan data terkait 14 hari setelah `graduation_date`. | Aturan retensi di PRD. Karena `users` memakai soft delete, harus `forceDelete()`, dan data terkait seperti `attendances` dan `leave_requests` tidak boleh menjadi yatim. |
| **N-10** | **Pengujian konsistensi FK PostgreSQL**: hapus kelas yang direferensikan jadwal, isi `class_id` yang tidak ada, cek data yatim setelah soft/hard delete. | Phase 6.3. Hanya bermakna setelah F-02 selesai. |
| **N-11** | **Test fitur** minimal untuk login, `RoleMiddleware`, pengecekan bentrok, dan konfirmasi import. | Empat area ini berisiko tertinggi bila ada regresi. |

---

## 4. Perlu Dihilangkan

### Route percobaan (P1)

| Kode | Route | Tindakan |
|---|---|---|
| **R-01** | `GET /user` | Hapus. Fungsinya sudah dicakup `GET /me`. |
| **R-02** | `GET /waka-only` | Hapus sebelum rilis. Hanya dipakai untuk menguji middleware. |
| **R-03** | `GET /ping` | Hapus, atau pertahankan sebagai health check jika memang dibutuhkan deployment. |

### Route di luar PRD (P2)

Route berikut tidak ada di 66 endpoint PRD. **Putuskan dulu** apakah termasuk scope. Bila tidak, hapus route dan controller-nya. Bila ya, petakan ke padanan PRD.

| Kode | Route saat ini | Padanan di PRD | Tindakan |
|---|---|---|---|
| **R-04** | `POST /journals/{id}/attendance` | `POST /journals` dan `PUT /journals/{id}` | Gabungkan, lalu hapus. |
| **R-05** | `POST /journals/{id}/complete` | `PUT /journals/{id}` | Gabungkan, lalu hapus. |
| **R-06** | `POST /permissions`, `POST /permissions/{id}/status` | `/leave-requests` (POST, PATCH) | Ganti nama dan path. Controller `StudentPermisionController` (typo) menjadi `LeaveRequestController`. |
| **R-07** | `GET /attendance-warnings` | `GET /schedules?status=missing_journal` | Hapus setelah padanan siap. |
| **R-08** | `POST /journals/{id}/quiz/generate` | `POST /quizzes` | Ganti. |
| **R-09** | `PATCH /quizzes/{id}/publish` | `PATCH /quizzes/{id}` (ubah status) | Ganti. |
| **R-10** | `POST /substitute` | Tidak ada | Konfirmasi ke pembuat PRD. Jika di luar scope, hapus beserta `SubstituteAssignmentController`. |
| **R-11** | `GET /students/{id}/attendance/summary`, `GET /reports/journals` | Tidak ada | Konfirmasi scope. Jika tidak dibutuhkan, tunda atau hapus. |

### Kode redundan (P2)

| Kode | Bagian | Alasan |
|---|---|---|
| **R-12** | `User::where(...)->firstOrFail()` setelah `Auth::attempt()` di login | Mengulang pencarian user yang sama. Hilang otomatis lewat F-04. |
| **R-13** | `'source'` dari validasi dan input klien di `POST /schedules` | Nilainya harus selalu `manual`. Hilang lewat F-07. |
| **R-14** | Blok `Validator::make()` + `if ($validator->fails())` manual di controller | Digantikan `$request->validate()` ditambah handler global (N-01). Kode lebih singkat dan konsisten. |
| **R-15** | Duplikasi logika bentrok di beberapa controller | Dipusatkan di `ScheduleConflictService` (N-04). |

---

## 5. Urutan Pengerjaan dan Dependensi

```
Tahap 0  Fondasi        F-01 F-02 F-03 F-04 F-12 · N-01 N-02 N-03 N-04 N-05 N-06 N-07 · R-01 R-02
   │
   ├── Tahap 1  Master data ───────┐
   │       │                       │
   ├── Tahap 2  Academic settings  │
   │                               ▼
   │                         Tahap 3  Jadwal ──► Tahap 4  Import PDF
   │                               │
   │                               ▼
   │                         Tahap 5  Jurnal ──► Tahap 6  Perizinan
   │                               │
   │                               └──────────► Tahap 7  Kuis AI
   │
   └── Tahap 8  Profil & kontak (kapan saja, tidak memblokir)

Tahap 9  Penyelesaian   N-08 N-09 N-10 N-11 · R-04 … R-15 · F-05 F-06 F-07 F-08 F-09 F-10 F-11
```

| Tahap | Isi | Prioritas | Bergantung pada | Selesai bila |
|---|---|---|---|---|
| **0** | Fondasi: perbaikan P0, handler global, model dasar, service bentrok, queue, rate limit | P0 | Tidak ada | Login mengembalikan token + `expires_at`, `GET /classes` bekerja, semua error 4xx berformat PRD |
| **1** | Master data lengkap (17 endpoint) | P1 | 0 | CRUD classes, rooms, students, teachers, subjects berjalan, DELETE ditolak 409 saat dipakai |
| **2** | Academic settings dan cycle history | P1 | 0 | Ganti `active_cycle` tercatat di `cycle_history` |
| **3** | Jadwal | P1 | 1, N-04, N-05 | Bentrok terdeteksi pada guru, kelas, dan ruangan di `POST` dan `PUT` |
| **4** | Import PDF | P1 | 3, N-06 | Preview matched/unmatched/conflict akurat, confirm hanya menimpa `cycle_type` terkait |
| **5** | Jurnal dan presensi | P1 | 3 | Presensi exception-based dan `teacher_absent` berjalan |
| **6** | Perizinan dan presensi siswa | P2 | 5 | Izin disetujui mengisi presensi otomatis |
| **7** | Kuis AI | P2 | 5, N-06 | Generate tidak memblokir HTTP, batas percobaan dan deadline ditegakkan |
| **8** | Profil dan verifikasi kontak | P3 | 0 | Email, telepon, dan Google link terverifikasi |
| **9** | Seeder/factory, job lulusan, tes FK, pembersihan route | P2 | 1 sampai 7 | Seluruh acceptance criteria PRD bagian 10 terpenuhi |

> **Perbaikan P1 (F-05 sampai F-10)** boleh dikerjakan bersamaan dengan tahap yang menyentuh controller terkait, misalnya F-07 saat Tahap 3 dan F-08 saat Tahap 1. Tidak perlu menunggu Tahap 9.

---

## 6. Keputusan yang Perlu Dikonfirmasi

| # | Pertanyaan | Mempengaruhi |
|---|---|---|
| 1 | Jam mulai dan selesai **setiap** periode untuk tiap `day_type` (`senin_upacara`, `senin_reguler`, `selasa` s.d. `jumat`). PRD hanya memberi jam mulai periode pertama. | N-05, Tahap 3 |
| 2 | Field login: PRD menulis `{ username, password, device_name }`, sedangkan kode memakai `nis_nip`. | F-04, klien |
| 3 | Apakah Kesiswaan dan Guru Piket role terpisah di enum `users.role`? | F-11, N-08 |
| 4 | Apakah route di luar PRD (R-10, R-11) termasuk scope? | Tahap 5 sampai 7 |
| 5 | Status kode untuk password konfirmasi salah: 422 atau 403? | F-10 |
| 6 | Apakah `PUT /schedules/{id}` juga wajib cek bentrok? (disarankan ya) | Tahap 3 |
| 7 | Apakah `monday_is_upacara` global sudah cukup, atau perlu pengecualian per tanggal? Saat ini flag berlaku untuk **semua** hari Senin. | Tahap 2, desain `schedules` |
| 8 | Apakah `GET /quizzes/{id}/questions/{question_id}` memang endpoint terpisah? | Tahap 7 |

---

## 7. Checklist Selesai per Endpoint

Gunakan daftar ini setiap kali sebuah endpoint dianggap selesai.

- [ ] Path dan method sama persis dengan PRD bagian 9.
- [ ] Route berada di grup middleware yang tepat (`auth:sanctum` dan role yang sesuai, bukan lebih ketat atau lebih longgar dari PRD).
- [ ] Input divalidasi (tipe, rentang, `exists`, `in`), dan response error berformat `{success, message, errors}`.
- [ ] Aturan bisnis PRD diterapkan (409 saat masih dipakai, password re-confirmation, cek bentrok, dan seterusnya).
- [ ] Model memiliki `$fillable`, `SoftDeletes`, dan `$table` bila nama tidak sesuai konvensi.
- [ ] Pagination dengan batas `per_page` pada endpoint list.
- [ ] Response sukses berformat `{success, message, data}` dengan status yang tepat (200, 201, 202).
- [ ] Diuji dengan token valid, tanpa token (401), dan role salah (403).
