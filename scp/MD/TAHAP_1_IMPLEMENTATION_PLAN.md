# Rencana Implementasi Terperinci: Tahap 1 — Skema Data & Helper Model

**Dokumen Rencana:** `MD/TAHAP_1_IMPLEMENTATION_PLAN.md`  
**Proyek:** School Class Progress (SCP) — Backend REST API  
**Versi Target:** SCP v4.5 (Ekstensi Multirole Guru & Kesiswaan — Tahap 1)  
**Dokumen Acuan:** `MD/SCP_MULTIKELAS_KESISWAAN_PLAN.md` (Bab 5.1, 5.2, Bab 7 Tahap 1), `MD/PRD.md`  
**Status Dokumen:** Usulan Rencana Detail (Menunggu Persetujuan Pengguna Sebelum Eksekusi)  

---

## DAFTAR ISI

1. [Tujuan dan Ruang Lingkup Tahap 1](#1-tujuan-dan-ruang-lingkup-tahap-1)
2. [Ringkasan Kondisi Kode Aktual (Terverifikasi)](#2-ringkasan-kondisi-kode-aktual-terverifikasi)
3. [Hasil Analisis Setiap Komponen](#3-hasil-analisis-setiap-komponen)
   - 3.1 Analisis Tabel & Migrasi `teacher_leave_requests`
   - 3.2 Analisis Model `TeacherLeaveRequest`
   - 3.3 Analisis Modifikasi Model `User`
4. [Daftar File yang Akan Dibuat dan Dimodifikasi](#4-daftar-file-yang-akan-dibuat-dan-dimodifikasi)
5. [Detail Rencana Perubahan Masing-Masing File](#5-detail-rencana-perubahan-masing-masing-file)
   - 5.1 Berkas Migrasi Database
   - 5.2 Berkas Model `TeacherLeaveRequest.php`
   - 5.3 Berkas Model `User.php`
   - 5.4 Berkas Pengujian Terisolasi `TeacherLeaveRequestSchemaTest.php`
6. [Urutan Implementasi Bertahap](#6-urutan-implementasi-bertahap)
7. [Potensi Masalah, Konflik, dan Analisis Risiko](#7-potensi-masalah-konflik-dan-analisis-risiko)
8. [Hal-Hal yang Membutuhkan Konfirmasi Pengguna](#8-hal-hal-yang-membutuhkan-konfirmasi-pengguna)
9. [Rencana Verifikasi dan Perintah CLI](#9-rencana-verifikasi-dan-perintah-cli)
10. [Kriteria Keberhasilan (*Acceptance Criteria*)](#10-kriteria-keberhasilan-acceptance-criteria)
11. [Batasan Implementasi (*Out-of-Scope*)](#11-batasan-implementasi-out-of-scope)

---

## 1. Tujuan dan Ruang Lingkup Tahap 1

### 1.1 Tujuan Utama
Membangun fondasi persistensi basis data dan abstraksi model Eloquent untuk perizinan guru (`TeacherLeaveRequest`) serta menyediakan helper method otorisasi kelas binaan wali kelas (`homeroomClassIds()`) pada model `User`. 

Tahap 1 bertujuan memastikan bahwa seluruh entitas data, relasi antar tabel, tipe data, dan method helper model telah tersedia secara stabil, terisolasi, dan teruji secara otomatis sebelum controller dan endpoint API dibangun pada Tahap 2 dan Tahap 3.

### 1.2 Ruang Lingkup Pengerjaan (In-Scope Tahap 1)
- Pembuatan 1 berkas migrasi database baru untuk tabel `teacher_leave_requests`.
- Pembuatan 1 berkas model Eloquent baru: `app/Models/TeacherLeaveRequest.php`.
- Penambahan relasi `teacherLeaveRequests()` dan helper method `homeroomClassIds()` pada model eksisting `app/Models/User.php`.
- Pembuatan 1 berkas automated test suite terisolasi: `tests/Feature/TeacherLeaveRequestSchemaTest.php` untuk memvalidasi skema tabel, casting tipe data JSON/array, dan relasi Eloquent.
- Eksekusi migrasi lokal dan verifikasi zero-regression terhadap test suite eksisting.

### 1.3 Pekerjaan di Luar Lingkup (Strictly Out-of-Scope pada Tahap 1)
- Pembuatan controller baru `TeacherLeaveRequestController` (dialokasikan ke **Tahap 3**).
- Modifikasi controller eksisting `JournalController` dan `ScheduleController` (dialokasikan ke **Tahap 2**).
- Penambahan atau pendaftaran route API baru pada `routes/api.php` (dialokasikan ke **Tahap 3**).
- Penambahan file controller, views, middleware, atau job antrean.

---

## 2. Ringkasan Kondisi Kode Aktual (Terverifikasi)

Hasil inspeksi langsung terhadap repositori aktual per 31 Oktober 2026:

1. **Framework & Runtime:**
   - Framework: Laravel 13.17.0 (API-only architecture).
   - PHP Runtime: PHP 8.4.13 CLI (x64) pada sistem operasi Windows.
   - Database Development: PostgreSQL (`DB_CONNECTION=pgsql`, database: `db_scp`).
   - Database Testing: SQLite In-Memory (`DB_CONNECTION=sqlite`, database: `:memory:` via `phpunit.xml`).

2. **Kondisi Migrasi Terakhir:**
   - Migrasi terakhir yang terdaftar: `database/migrations/2026_10_30_000001_add_gender_and_nisn_to_users_table.php`.
   - Tabel `teacher_leave_requests` saat ini **belum ada** di direktori migrasi maupun di basis data.

3. **Kondisi Model `User` (`app/Models/User.php`):**
   - Menggunakan PHP 8 Attributes untuk mass-assignment: `#[Fillable([...])]` dan `#[Hidden([...])]`.
   - Menggunakan method modern `protected function casts(): array`.
   - Menggunakan traits: `HasApiTokens`, `HasFactory`, `Notifiable`, `SoftDeletes`.
   - Telah memiliki relasi penugasan: `assignments(): HasMany` ke `TeacherAssignment`.
   - Telah memiliki helper penugasan:
     - `hasAssignment(string $type): bool`
     - `isKesiswaan(): bool`
     - `isWaliKelas(?int $classId = null): bool`
   - **Ketiadaan:** Belum memiliki relasi ke izin guru (`teacherLeaveRequests()`) dan belum memiliki helper ekstraksi daftar ID kelas binaan (`homeroomClassIds()`).

4. **Kondisi Model Perizinan Siswa (`app/Models/LeaveRequest.php`):**
   - Menggunakan properti konvensional `protected $fillable = [...]` dan `protected $casts = [...]`.
   - Memiliki accessor dinamis `status()` sebagai alias untuk kolom basis data `status_approval`.
   - Kolom verifikator dinamai `verified_by` (bukan `approved_by`) dengan timestamp `verified_at`.

5. **Kondisi Model Jadwal (`app/Models/Schedule.php`):**
   - Menggunakan trait `SoftDeletes`.
   - Berelasi dengan `teacher` (`User`), `schoolClass` (`Classes`), `room` (`Rooms`), `subject` (`Subject`), dan `journals` (`Journal`).

---

## 3. Hasil Analisis Setiap Komponen

### 3.1 Analisis Tabel & Migrasi `teacher_leave_requests`

| Kolom | Tipe Data Basis Data | Nullable | Default | Relasi / Indeks | Analisis Teknis & Rasional Desain |
|---|---|:---:|:---:|---|---|
| `id` | `BIGINT UNSIGNED` (Auto-increment) | Tidak | - | Primary Key | Standar Laravel ID primary key. |
| `teacher_id` | `BIGINT UNSIGNED` | Tidak | - | FK `users.id` (onDelete: cascade), Index | Akun guru pemohon izin. Menggunakan `cascadeOnDelete` jika akun dihapus permanen. Karena `User` menggunakan `SoftDeletes`, penghapusan reguler aman. |
| `schedule_ids` | `JSON` | Ya | `null` | - | Menampung array ID jadwal sesi mengajar yang ditinggalkan (contoh: `[12, 14, 15]`). Nullable jika izin harian penuh tanpa rujukan jadwal spesifik. |
| `date` | `DATE` | Tidak | - | Index | Tanggal ketidakhadiran guru (format `YYYY-MM-DD`). Diindeks untuk mempercepat pencarian jadwal dan pelaporan harian. |
| `reason` | `TEXT` | Tidak | - | - | Alasan ketidakhadiran yang diajukan oleh guru. |
| `attachment_path` | `VARCHAR(255)` | Ya | `null` | - | Path berkas bukti surat keterangan (surat dokter/keterangan dinas) di disk storage publik. |
| `task_instruction` | `TEXT` | Ya | `null` | - | Instruksi tugas titipan bagi siswa yang dapat dibaca oleh tim Kesiswaan / Guru Piket. |
| `task_attachment_path` | `VARCHAR(255)` | Ya | `null` | - | Path berkas lampiran materi/soal tugas titipan (PDF/DOCX/Gambar). |
| `status` | `ENUM('pending', 'approved', 'rejected')` | Tidak | `'pending'` | Index gabungan `(teacher_id, status)` | Status approval izin. Nilai awal selalu `pending`. |
| `approved_by` | `BIGINT UNSIGNED` | Ya | `null` | FK `users.id` (onDelete: null), Index | ID pengguna Kesiswaan atau Waka yang memverifikasi. Menggunakan `nullOnDelete` agar riwayat izin tidak hilang jika akun verifikator dihapus permanen. |
| `verified_at` | `TIMESTAMP` | Ya | `null` | - | Waktu audit saat status diubah dari `pending` menjadi `approved` atau `rejected`. |
| `created_at`, `updated_at` | `TIMESTAMP` | Ya | `null` | - | Timestamp standar Laravel untuk tracking audit waktu pembuatan dan pembaruan. |

#### Indeks Komposit & Kinerja Query:
- `$table->index(['teacher_id', 'status'])`: Mengoptimalkan filter daftar izin yang diajukan oleh guru yang sedang login (digunakan pada `GET /api/teacher-leave-requests`).
- `$table->index('date')`: Mengoptimalkan pencarian izin berdasarkan tanggal hari berjalan untuk menentukan apakah guru hadir atau perlu digantikan jadwalnya.

### 3.2 Analisis Model `TeacherLeaveRequest`

1. **Mass-Assignment Protection:**
   Model ini wajib mendefinisikan `$fillable` yang mencakup 10 atribut:
   `teacher_id`, `schedule_ids`, `date`, `reason`, `attachment_path`, `task_instruction`, `task_attachment_path`, `status`, `approved_by`, `verified_at`.

2. **Atribut Casting:**
   - `'schedule_ids' => 'array'`: Memastikan saat data dibaca dari PostgreSQL/SQLite, otomatis terkonversi menjadi native array PHP, dan saat disimpan otomatis di-encode ke format JSON valid.
   - `'date' => 'date:Y-m-d'`: Memastikan format tanggal konsisten string ISO saat di-serialize ke JSON response.
   - `'verified_at' => 'datetime'`: Memastikan waktu verifikasi berbentuk objek `Carbon`.

3. **Relasi Eloquent:**
   - `teacher(): BelongsTo`: Menghubungkan ke `User::class` melalui foreign key `teacher_id`.
   - `approvedBy(): BelongsTo`: Menghubungkan ke `User::class` melalui foreign key `approved_by`.

### 3.3 Analisis Modifikasi Model `User`

1. **Relasi `teacherLeaveRequests()`:**
   - Menghubungkan satu user (guru) ke banyak record izin yang diajukannya:
     ```php
     public function teacherLeaveRequests(): HasMany
     {
         return $this->hasMany(TeacherLeaveRequest::class, 'teacher_id');
     }
     ```
2. **Helper Method `homeroomClassIds()`:**
   - **Tantangan Logika:** Metode ini akan dipanggil oleh controller untuk memfilter jadwal, jurnal, dan presensi.
   - **Implementasi Aman:**
     ```php
     public function homeroomClassIds(): array
     {
         if ($this->role !== 'teacher') {
             return [];
         }

         return $this->assignments()
             ->where('type', 'wali_kelas')
             ->pluck('class_id')
             ->filter()
             ->values()
             ->toArray();
     }
     ```
   - **Keamanan:**
     - Mengecek `$this->role !== 'teacher'` (mengembalikan array kosong `[]` jika dipanggil oleh siswa, orang tua, atau waka).
     - Filter `->filter()` memastikan nilai `null` (jika ada data assignment rusak tanpa class_id) dibuang.
     - `->values()->toArray()` memastikan array yang dihasilkan berindeks numerik murni tanpa gap (`[1, 2]`), siap digunakan dalam klausul Eloquent `whereIn('class_id', $ids)`.

---

## 4. Daftar File yang Akan Dibuat dan Dimodifikasi

| No | Lokasi Berkas | Status | Tanggung Jawab Komponen |
|:--:|---|:---:|---|
| 1 | `database/migrations/2026_10_31_000001_create_teacher_leave_requests_table.php` | **Dibuat Baru** | Definisi DDL tabel `teacher_leave_requests`, tipe kolom, foreign key constraints, dan indeks. |
| 2 | `app/Models/TeacherLeaveRequest.php` | **Dibuat Baru** | Model representasi data perizinan guru, konfigurasi casting JSON/array, dan relasi Eloquent. |
| 3 | `app/Models/User.php` | **Dimodifikasi** | Penambahan relasi `teacherLeaveRequests()` dan helper method `homeroomClassIds()`. |
| 4 | `tests/Feature/TeacherLeaveRequestSchemaTest.php` | **Dibuat Baru** | Pengujian otomatis validasi skema basis data, constraint FK, relasi model, dan helper `homeroomClassIds()`. |

---

## 5. Detail Rencana Perubahan Masing-Masing File

### 5.1 Berkas Migrasi Database
**Berkas:** `database/migrations/2026_10_31_000001_create_teacher_leave_requests_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('teacher_leave_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->json('schedule_ids')->nullable();
            $table->date('date');
            $table->text('reason');
            $table->string('attachment_path')->nullable();
            $table->text('task_instruction')->nullable();
            $table->string('task_attachment_path')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index(['teacher_id', 'status']);
            $table->index('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('teacher_leave_requests');
    }
};
```

### 5.2 Berkas Model `TeacherLeaveRequest.php`
**Berkas:** `app/Models/TeacherLeaveRequest.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeacherLeaveRequest extends Model
{
    use HasFactory;

    protected $table = 'teacher_leave_requests';

    protected $fillable = [
        'teacher_id',
        'schedule_ids',
        'date',
        'reason',
        'attachment_path',
        'task_instruction',
        'task_attachment_path',
        'status',
        'approved_by',
        'verified_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'schedule_ids' => 'array',
            'date' => 'date:Y-m-d',
            'verified_at' => 'datetime',
        ];
    }

    /**
     * Relasi ke pengguna (guru yang mengajukan perizinan)
     */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    /**
     * Relasi ke pengguna (Waka/Kesiswaan yang menyetujui atau menolak perizinan)
     */
    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
```

### 5.3 Berkas Model `User.php`
**Berkas:** `app/Models/User.php`

Menambahkan relasi dan method helper baru di dalam body class `User`:

```php
    /**
     * Relasi ke perizinan mengajar yang diajukan oleh guru
     */
    public function teacherLeaveRequests(): HasMany
    {
        return $this->hasMany(TeacherLeaveRequest::class, 'teacher_id');
    }

    /**
     * Mengembalikan daftar class_id yang dibina sebagai wali kelas aktif
     *
     * @return array<int>
     */
    public function homeroomClassIds(): array
    {
        if ($this->role !== 'teacher') {
            return [];
        }

        return $this->assignments()
            ->where('type', 'wali_kelas')
            ->pluck('class_id')
            ->filter()
            ->values()
            ->toArray();
    }
```

### 5.4 Berkas Pengujian Terisolasi `TeacherLeaveRequestSchemaTest.php`
**Berkas:** `tests/Feature/TeacherLeaveRequestSchemaTest.php`

Memverifikasi fungsi Tahap 1 tanpa memerlukan controller atau routing:
1. `test_can_create_teacher_leave_request_record_with_json_schedule_ids`: Memastikan record berhasil disimpan, array `schedule_ids` tersimpan dan terbaca kembali sebagai array, serta default status adalah `'pending'`.
2. `test_teacher_leave_request_relations_work_correctly`: Memastikan relasi `teacher()` dan `approvedBy()` mengembalikan objek `User` yang sah.
3. `test_user_teacher_leave_requests_relation`: Memastikan pemanggilan `$user->teacherLeaveRequests` mengembalikan kumpulan perizinan guru terkait.
4. `test_user_homeroom_class_ids_helper_returns_expected_array`: Memastikan guru wali kelas mengembalikan `[class_id_1, class_id_2]`, sedangkan guru biasa atau role non-teacher mengembalikan array kosong `[]`.
5. `test_teacher_leave_request_approved_by_sets_null_on_user_hard_delete`: Memastikan constraint `nullOnDelete` bekerja saat akun verifikator dihapus permanen.

---

## 6. Urutan Implementasi Bertahap

Pengerjaan Tahap 1 wajib dilakukan dengan urutan linier berikut untuk meminimalkan dependensi yang hilang:

```
[Langkah 1: Migrasi Basis Data]
    └── Buat database/migrations/2026_10_31_000001_create_teacher_leave_requests_table.php
             │
[Langkah 2: Model TeacherLeaveRequest]
    └── Buat app/Models/TeacherLeaveRequest.php
             │
[Langkah 3: Pembaruan Model User]
    └── Tambahkan method teacherLeaveRequests() & homeroomClassIds() pada app/Models/User.php
             │
[Langkah 4: Penyusunan Test Suite Skema]
    └── Buat tests/Feature/TeacherLeaveRequestSchemaTest.php
             │
[Langkah 5: Eksekusi Migrasi & Pengujian]
    └── Jalankan php artisan migrate (database PostgreSQL)
    └── Jalankan php artisan test --filter=TeacherLeaveRequestSchemaTest (database SQLite in-memory)
    └── Jalankan php artisan test (verifikasi zero-regression pada seluruh test suite)
```

---

## 7. Potensi Masalah, Konflik, dan Analisis Risiko

| No | Potensi Risiko / Masalah | Dampak Teknis | Strategi Mitigasi Terukur |
|:--:|---|---|---|
| 1 | **Kompatibilitas Kolom JSON (PostgreSQL vs SQLite)** | Uji coba otomatis pada SQLite memory bisa berbeda perilaku dengan PostgreSQL jika tipe data JSON tidak kompatibel. | Di Laravel, `$table->json()` dipetakan menjadi tipe `json` pada PostgreSQL dan `text` pada SQLite. Casting Eloquent `'schedule_ids' => 'array'` menangani serialisasi/deserialisasi transparan pada kedua driver. |
| 2 | **Integritas Relasi Elemen dalam JSON `schedule_ids`** | Karena `schedule_ids` berbentuk array di kolom JSON, database tidak dapat memasang foreign key otomatis ke `schedules.id`. | Verifikasi integritas ID jadwal dibebankan secara ketat pada validation rules di `TeacherLeaveRequestController::store` pada Tahap 3 (`schedule_ids.* => exists:schedules,id`). Pada Tahap 1, kita pastikan model menampung array secara murni. |
| 3 | **Penanganan Soft Deletes pada Relasi User** | Model `User` menggunakan `SoftDeletes`. Jika user di-soft-delete, relasi `teacher()` bisa mengembalikan null jika query default mengecualikan deleted records. | Pada relasi Eloquent di `TeacherLeaveRequest`, gunakan `belongsTo(User::class, 'teacher_id')->withTrashed()` jika riwayat perizinan tetap harus menampilkan nama guru yang telah dinonaktifkan/soft-deleted. |
| 4 | **Penanganan `approved_by` saat Verifikator Dihapus** | Menghindari foreign key constraint violation saat admin/kesiswaan dihapus. | Migration secara eksplisit menggunakan `nullOnDelete()` pada kolom `approved_by`. |
| 5 | **Duplikasi Pemanggilan Query pada `homeroomClassIds()`** | Jika `homeroomClassIds()` dipanggil berulang kali dalam satu lifecycle request, query ke tabel `teacher_assignments` dapat tereksekusi berkali-kali. | Pada Tahap 1 ini kita pertahankan evaluasi relasi Eloquent `$this->assignments()`. Jika penugasan sudah di-eager-load (`with('assignments')`), Eloquent otomatis mengambil dari collection memori tanpa query SQL baru. |

---

## 8. Hal-Hal yang Membutuhkan Konfirmasi Pengguna

Sebelum melangkah ke eksekusi kode, terdapat **2 hal teknis konvensional** yang memerlukan konfirmasi Anda:

### Konfirmasi 1: Konvensi Penamaan Kolom Verifikator (`approved_by` vs `verified_by`)
- **Fakta di Lapangan:** Pada tabel izin siswa (`leave_requests`), kolom verifikator dinamai `verified_by` dengan timestamp `verified_at`. Hal ini karena seorang verifikator bertindak memverifikasi izin, baik hasilnya **disetujui** (*approved*) maupun **ditolak** (*rejected*).
- **Di Dokumen Rencana Awal:** Dokumen rencana menggunakan nama kolom `approved_by` dan `verified_at`. Jika izin berstatus `rejected`, kolom `approved_by` tetap diisi ID guru kesiswaan yang menolak, yang secara semantik sedikit kurang intuitif (*rejected by X, but stored in approved_by*).
- **Pilihan Solusi:**
  - **Opsi A (Sesuai Rencana Awal):** Tetap menggunakan nama kolom `approved_by`.
  - **Opsi B (Rekomendasi Arsitek):** Menggunakan nama kolom `verified_by` di database (agar konsisten dengan `leave_requests`), dan menambahkan alias accessor `approved_by` di Model `TeacherLeaveRequest` untuk backward compatibility.
- **Pertanyaan untuk Anda:** *Apakah Anda ingin tetap menggunakan `approved_by` (Opsi A) atau menggunakan `verified_by` agar selaras dengan tabel izin siswa (Opsi B)?*

### Konfirmasi 2: Perilaku Relasi jika Guru Di-Soft-Delete (`withTrashed()`)
- **Fakta di Lapangan:** Akun guru di SCP menggunakan *Soft Deletes*. Jika suatu saat seorang guru nonaktif/pindah, data akunnya di-soft-delete (`deleted_at` terisi).
- **Pertimbangan:** Apakah relasi `teacher()` pada `TeacherLeaveRequest` harus menggunakan `->withTrashed()` agar riwayat izin masa lampau tetap dapat membaca nama guru tersebut di sistem Kesiswaan?
- **Rekomendasi Arsitek:** Ya, menggunakan `->withTrashed()` sangat disarankan untuk integritas laporan audit akademik.
- **Pertanyaan untuk Anda:** *Apakah Anda menyetujui penambahan `->withTrashed()` pada relasi `teacher()` di model `TeacherLeaveRequest`?*

---

## 9. Rencana Verifikasi dan Perintah CLI

Setelah pengerjaan Tahap 1 diizinkan dan dieksekusi, verifikasi wajib dilakukan dengan urutan perintah berikut:

1. **Pemeriksaan Status Migrasi Sebelum Dijalankan:**
   ```bash
   php artisan migrate:status
   ```
   *(Memastikan migrasi baru terdeteksi dengan status `Pending`)*

2. **Eksekusi Migrasi Database:**
   ```bash
   php artisan migrate
   ```
   *(Memastikan tabel `teacher_leave_requests` berhasil dibuat pada PostgreSQL lokal tanpa error DDL)*

3. **Verifikasi Keberadaan Tabel dan Skema Kolom:**
   ```bash
   php artisan tinker --execute="var_dump(Schema::hasTable('teacher_leave_requests'));"
   php artisan tinker --execute="var_dump(Schema::hasColumns('teacher_leave_requests', ['id', 'teacher_id', 'schedule_ids', 'date', 'reason', 'attachment_path', 'task_instruction', 'task_attachment_path', 'status', 'approved_by', 'verified_at']));"
   ```
   *(Ekspektasi: `bool(true)` untuk kedua perintah)*

4. **Eksekusi Automated Test Suite Terisolasi Tahap 1:**
   ```bash
   php artisan test --filter=TeacherLeaveRequestSchemaTest
   ```
   *(Ekspektasi: Seluruh pengujian skema & helper lolos 100% / Hijau)*

5. **Pemeriksaan Regresi Penuh Sistem (*Zero-Regression Check*):**
   ```bash
   php artisan test
   ```
   *(Memastikan seluruh 199+ skenario pengujian eksisting di proyek SCP tetap berstatus Passed tanpa ada error baru)*

---

## 10. Kriteria Keberhasilan (*Acceptance Criteria*)

Tahap 1 dinyatakan **SELESAI dan LULUS** apabila seluruh kriteria berikut terpenuhi secara objektif:

- [ ] Berkas migrasi `database/migrations/2026_10_31_000001_create_teacher_leave_requests_table.php` terdaftar dan berhasil dieksekusi oleh `php artisan migrate`.
- [ ] Tabel `teacher_leave_requests` memiliki 12 kolom dengan tipe data, nullable, default value, foreign key constraints (`cascadeOnDelete` untuk `teacher_id` dan `nullOnDelete` untuk verifikator), serta 2 indeks yang presisi.
- [ ] Model `TeacherLeaveRequest` dapat menyimpan data dan meng-cast atribut `schedule_ids` secara otomatis menjadi array PHP native (bukan raw string JSON).
- [ ] Model `User` memiliki relasi `teacherLeaveRequests()` yang mengembalikan instance `HasMany` ke `TeacherLeaveRequest`.
- [ ] Method `$user->homeroomClassIds()` mengembalikan array integer ID kelas binaan bagi guru wali kelas aktif, dan mengembalikan `[]` bagi guru non-wali kelas atau pengguna selain role guru.
- [ ] Berkas pengujian `tests/Feature/TeacherLeaveRequestSchemaTest.php` lulus 100% (5 skenario pengujian hijau).
- [ ] Seluruh test suite eksisting proyek tetap lulus 100% tanpa regresi.

---

## 11. Batasan Implementasi (*Out-of-Scope*)

Untuk menjaga isolasi dan mencegah kebocoran lingkup pengerjaan:
1. **Tidak menyentuh Controller:** Dilarang membuat `TeacherLeaveRequestController.php` atau menyunting `JournalController.php` dan `ScheduleController.php` selama Tahap 1.
2. **Tidak menyentuh Rute:** Dilarang menambahkan route baru pada `routes/api.php`.
3. **Tidak menyentuh Middleware:** Dilarang memodifikasi `AssignmentMiddleware.php` atau middleware lainnya.
4. **Tidak melakukan refactoring di luar lingkup:** Dilarang mengubah kode bisnis lain yang tidak terkait langsung dengan entitas `teacher_leave_requests` dan helper `homeroomClassIds()`.

---

*Dokumen ini disusun sebagai panduan teknis resmi Tahap 1. Seluruh implementasi kode ditangguhkan sampai dokumen ini diperiksa dan disetujui secara eksplisit oleh Pengguna.*
