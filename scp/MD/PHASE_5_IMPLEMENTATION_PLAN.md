# Rencana Implementasi Fase 5: Penyelarasan Aturan Prasyarat Master Data (Hanya Siswa & Guru)

## 1. Ringkasan Eksekutif & Tujuan

### 1.1. Latar Belakang
Pada arsitektur sistem SCP v4.0 sebelumnya, proses pembuatan jadwal—baik secara manual (`POST /api/schedules`) maupun melalui impor PDF FET (`POST /api/schedule-imports`)—menggunakan aturan prasyarat kaku yang mewajibkan 4 entitas Master Data telah terisi di database:
1. Kelas (`classes`)
2. Guru (`users` role `teacher`)
3. Mata Pelajaran (`subjects`)
4. Ruangan (`rooms`)
Serta tambahan nomor staf FET (`fet_staff_id`) pada guru khusus untuk impor PDF.

Namun, sejak roadmap SCP v4.5 diimplementasikan:
- **Kelas** telah di-generate secara otomatis (*auto-created*) berdasarkan regex rombel saat Waka Kurikulum mengimpor data Siswa (Fase 4).
- **Ruangan** dan **Mata Pelajaran** akan didaftarkan secara otomatis (*auto-registered*) oleh antrean worker `ParseSchedulePdfJob` langsung dari hasil ekstraksi dokumen PDF FET (Fase 6).

Kondisi tersebut menyebabkan aturan validasi prasyarat pada endpoint upload PDF (`POST /api/schedule-imports`) menjadi tidak relevan dan menghambat alur kerja (*blocking workflow*). Waka Kurikulum tidak seharusnya dipaksa mendaftarkan ruangan atau mata pelajaran secara manual sebelum mengunggah PDF jadwal.

### 1.2. Tujuan Fase 5
1. **Dekopling Aturan Prasyarat:** Memisahkan secara tegas aturan prasyarat antara Impor PDF FET (`validateForPdfImport()`) dan Pembuatan Jadwal Manual (`validateForManualSchedule()`).
2. **Penyelarasan Aturan Impor PDF:** Mengubah `validateForPdfImport()` agar **hanya mensyaratkan**:
   - Minimal 1 data Siswa aktif (`role = 'student'`, `deleted_at IS NULL`).
   - Minimal 1 data Guru aktif dengan nomor staf FET valid (`role = 'teacher'`, `deleted_at IS NULL`, `fet_staff_id IS NOT NULL AND fet_staff_id != ''`).
   - **Menghapus total** kewajiban keberadaan data `classes`, `subjects`, dan `rooms` pada pengecekan impor PDF.
3. **Proteksi Integritas Jadwal Manual:** Memastikan `validateForManualSchedule()` **tetap utuh 100%** mewajibkan kelengkapan 4 entitas (`classes`, `teachers`, `subjects`, `rooms`) guna mencegah anomali pada form jadwal konvensional.
4. **Penyelarasan Test Suite:** Memperbarui `tests/Feature/MasterDataPrerequisiteRuleTest.php` dan fixture `tests/Feature/ScheduleImportTest.php` agar selaras dengan aturan bisnis baru, serta membuktikan bahwa upload PDF dapat menghasilkan status **202 Accepted** meski tabel `classes`, `subjects`, dan `rooms` dalam keadaan kosong melompong (0 record).

---

## 2. Analisis Kebutuhan & Kondisi Saat Ini (*As-Is vs To-Be*)

### 2.1. Kondisi Saat Ini (*As-Is*)

#### A. Kode Service: `app/Services/MasterDataPrerequisiteService.php`
Saat ini, method `validateForPdfImport()` masih berbagi method evaluasi privat `evaluate()` yang secara baku memeriksa kelima entitas sekaligus:
```php
public function validateForPdfImport(): array
{
    $hasTeachers = User::where('role', 'teacher')->whereNull('deleted_at')->exists();
    $hasTeachersWithFetId = User::where('role', 'teacher')
        ->whereNull('deleted_at')
        ->whereNotNull('fet_staff_id')
        ->where('fet_staff_id', '!=', '')
        ->exists();

    return $this->evaluate([
        'classes' => Classes::whereNull('deleted_at')->exists(),      // <-- Masih memeriksa kelas
        'teachers' => $hasTeachers,
        'fet_staff_id' => $hasTeachersWithFetId,
        'subjects' => Subject::whereNull('deleted_at')->exists(),    // <-- Masih memeriksa mapel
        'rooms' => Rooms::whereNull('deleted_at')->exists(),          // <-- Masih memeriksa ruangan
    ], isPdfImport: true);
}
```
**Temuan Masalah:**
1. Method `validateForPdfImport()` sama sekali **tidak memeriksa** keberadaan data Siswa (`role = 'student'`).
2. Method tersebut masih menolak upload jika tabel `classes`, `subjects`, atau `rooms` kosong, menghasilkan HTTP 422 Unprocessable Entity.

#### B. Kondisi Pemanggil Controller
1. **`app/Http/Controllers/API/ScheduleImportController.php` (Line 30):**
   ```php
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
   ```
   Controller sudah mengadopsi struktur standar respons generic (`is_valid`, `errors`, `missing`). Tidak memerlukan perubahan kode di controller.
2. **`app/Http/Controllers/API/ScheduleController.php` (Line 183):**
   Memanggil `$this->prerequisites->validateForManualSchedule()`. Logika ini tetap dipertahankan.

#### C. Kondisi Test Suite Saat Ini
1. **`tests/Feature/MasterDataPrerequisiteRuleTest.php`:**
   - Baris 172 (`test_pdf_import_upload_is_rejected_when_master_data_is_empty`): Masih mengharapkan error key `['classes', 'teachers', 'subjects', 'rooms']`.
   - Baris 202 (`test_pdf_import_upload_is_rejected_when_teachers_lack_fet_staff_id`): Mengisi `classes`, `rooms`, dan `subjects` terlebih dahulu.
   - Baris 231 (`test_pdf_import_upload_is_allowed_when_master_data_and_fet_staff_id_are_present`): Mengisi `classes`, `rooms`, dan `subjects` terlebih dahulu. Belum menguji kondisi ketika ketiga tabel tersebut kosong.
   - Belum ada test untuk validasi data Siswa kosong pada impor PDF.
2. **`tests/Feature/ScheduleImportTest.php`:**
   - Pada method `setUp()`, hanya diinisialisasi `waka`, `teacher` (dengan `fet_staff_id`), `class`, `subject`, dan `room`.
   - **PENTING:** Fixture `setUp()` belum membuat user siswa (`role = 'student'`). Jika `validateForPdfImport()` diubah untuk mewajibkan data siswa, method `test_waka_can_upload_pdfs_and_dispatches_parse_job` akan gagal dengan status 422. Fixture ini wajib diselaraskan.

---

### 2.2. Kondisi yang Diharapkan (*To-Be*)

| Aspek | Impor Jadwal PDF FET (`validateForPdfImport`) | Pembuatan Jadwal Manual (`validateForManualSchedule`) |
|---|---|---|
| **Siswa (`students`)** | **Wajib ($\ge 1$ aktif)** | Tidak dicek |
| **Guru (`teachers`)** | **Wajib ($\ge 1$ aktif)** | **Wajib ($\ge 1$ aktif)** |
| **FET Staff ID (`fet_staff_id`)** | **Wajib ($\ge 1$ guru ber-ID FET)** | Tidak dicek |
| **Kelas (`classes`)** | **Ditiadakan (Akan auto-create / fallback)** | **Wajib ($\ge 1$ aktif)** |
| **Mata Pelajaran (`subjects`)**| **Ditiadakan (Akan auto-register di Fase 6)** | **Wajib ($\ge 1$ aktif)** |
| **Ruangan (`rooms`)** | **Ditiadakan (Akan auto-register di Fase 6)** | **Wajib ($\ge 1$ aktif)** |
| **HTTP Status Jika Gagal** | 422 Unprocessable Entity | 422 Unprocessable Entity |
| **HTTP Status Jika Lolos** | 202 Accepted (dispatch background job) | 201 Created (jadwal tersimpan) |

---

## 3. Desain Teknis & Spesifikasi Logika Bisnis

### 3.1. Struktur Logika Baru `MasterDataPrerequisiteService`

```mermaid
flowchart TD
    StartPDF[Request POST /api/schedule-imports] --> CallPdfCheck[validateForPdfImport]
    CallPdfCheck --> CheckStudent{Ada Siswa Aktif?}
    CheckStudent -- Tidak --> AddMissingStudent[missing += 'students'<br>errors['students'] = '...']
    CheckStudent -- Ya --> CheckTeacher{Ada Guru Aktif?}
    AddMissingStudent --> CheckTeacher

    CheckTeacher -- Tidak --> AddMissingTeacher[missing += 'teachers'<br>errors['teachers'] = '...']
    CheckTeacher -- Ya --> CheckFET{Ada Guru dg fet_staff_id?}
    CheckFET -- Tidak --> AddMissingFET[missing += 'fet_staff_id'<br>errors['fet_staff_id'] = '...']
    CheckFET -- Ya --> EvalResult
    AddMissingTeacher --> EvalResult
    AddMissingFET --> EvalResult

    EvalResult{missing kosong?}
    EvalResult -- Ya --> Allow202[Status is_valid = true ➔ Lolos ke Upload 202]
    EvalResult -- Tidak --> Reject422[Status is_valid = false ➔ Tolak 422]
```

### 3.2. Query Database yang Digunakan
1. **Pengecekan Siswa:**
   ```php
   $hasStudents = User::where('role', 'student')->whereNull('deleted_at')->exists();
   ```
2. **Pengecekan Guru Eksis:**
   ```php
   $hasTeachers = User::where('role', 'teacher')->whereNull('deleted_at')->exists();
   ```
3. **Pengecekan Guru dengan Nomor Staf FET:**
   ```php
   $hasTeachersWithFetId = User::where('role', 'teacher')
       ->whereNull('deleted_at')
       ->whereNotNull('fet_staff_id')
       ->where('fet_staff_id', '!=', '')
       ->exists();
   ```

### 3.3. Matriks Skenario Validasi & Struktur Respons Error

#### Skenario 1: Data Siswa Masih Kosong
- **Kondisi:** Guru dengan `fet_staff_id` tersedia, namun data siswa belum ada (`$hasStudents = false`).
- **HTTP Status:** `422 Unprocessable Entity`
- **JSON Payload:**
  ```json
  {
    "success": false,
    "message": "Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.",
    "errors": {
      "students": [
        "Master data siswa masih kosong. Waka wajib mengimpor data siswa terlebih dahulu."
      ]
    },
    "meta": {
      "missing_entities": ["students"]
    }
  }
  ```

#### Skenario 2: Data Guru Masih Kosong
- **Kondisi:** Siswa tersedia, namun belum ada akun guru sama sekali (`$hasTeachers = false`).
- **HTTP Status:** `422 Unprocessable Entity`
- **JSON Payload:**
  ```json
  {
    "success": false,
    "message": "Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.",
    "errors": {
      "teachers": [
        "Master data guru masih kosong. Waka wajib mengimpor data guru terlebih dahulu."
      ]
    },
    "meta": {
      "missing_entities": ["teachers"]
    }
  }
  ```

#### Skenario 3: Guru Ada, Namun Tidak Ada yang Memiliki `fet_staff_id`
- **Kondisi:** Siswa tersedia, akun guru tersedia, namun kolom `fet_staff_id` bernilai `null` atau `""` untuk semua guru (`$hasTeachers = true`, `$hasTeachersWithFetId = false`).
- **HTTP Status:** `422 Unprocessable Entity`
- **JSON Payload:**
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
      "missing_entities": ["fet_staff_id"]
    }
  }
  ```

#### Skenario 4: Siswa dan Guru Sama-Sama Kosong
- **Kondisi:** Belum ada siswa dan belum ada guru yang diimpor ke sistem.
- **HTTP Status:** `422 Unprocessable Entity`
- **JSON Payload:**
  ```json
  {
    "success": false,
    "message": "Master Data belum lengkap. Waka wajib mengisi Master Data terlebih dahulu sebelum dapat menginput jadwal.",
    "errors": {
      "students": [
        "Master data siswa masih kosong. Waka wajib mengimpor data siswa terlebih dahulu."
      ],
      "teachers": [
        "Master data guru masih kosong. Waka wajib mengimpor data guru terlebih dahulu."
      ]
    },
    "meta": {
      "missing_entities": ["students", "teachers"]
    }
  }
  ```

#### Skenario 5: Siswa & Guru Ber-FET Siap, Sedangkan Kelas, Ruangan, dan Mapel Kosong (Sukses)
- **Kondisi:** Minimal 1 siswa aktif dan minimal 1 guru aktif ber-ID FET tersedia. Tabel `classes`, `subjects`, dan `rooms` masing-masing memiliki 0 baris data.
- **HTTP Status:** `202 Accepted`
- **Response:** File PDF berhasil disimpan ke storage private, record `schedule_imports` dibuat dengan status `uploaded`, dan job `ParseSchedulePdfJob` masuk ke antrean queue.

---

## 4. Rencana Pengerjaan & Perubahan Berkas (*Step-by-Step*)

### Langkah 1: Refactoring `app/Services/MasterDataPrerequisiteService.php`
- Pisahkan logika evaluasi `validateForManualSchedule()` dan `validateForPdfImport()`.
- Tetapkan method `validateForManualSchedule()` mengevaluasi 4 entitas (`classes`, `teachers`, `subjects`, `rooms`) menggunakan method `evaluateManual()`.
- Perbarui `validateForPdfImport()` agar hanya memeriksa `$hasStudents`, `$hasTeachers`, dan `$hasTeachersWithFetId`.
- Konstruksikan return array dengan kontrak:
  ```php
  return [
      'is_valid' => empty($missing),
      'missing' => $missing,
      'errors' => $errors,
  ];
  ```

### Langkah 2: Pembaruan & Penambahan Skenario Pengujian pada `tests/Feature/MasterDataPrerequisiteRuleTest.php`
Perbarui dan lengkapi method pengujian pada kelas test tersebut:
1. **Perbarui `test_pdf_import_upload_is_rejected_when_master_data_is_empty`:**
   - Ubah agar menghapus data guru dan siswa.
   - Pastikan response 422 hanya memuat `missing_entities = ['students', 'teachers']` (tidak ada lagi `classes`, `subjects`, atau `rooms`).
2. **Tambahkan `test_pdf_import_upload_is_rejected_when_students_are_empty`:**
   - Sediakan guru ber-FET valid, tetapi hapus seluruh user ber-role `student`.
   - Pastikan response 422 memuat error key `students` dan `meta.missing_entities = ['students']`.
3. **Perbarui `test_pdf_import_upload_is_rejected_when_teachers_lack_fet_staff_id`:**
   - Hapus pemanggilan pembuatan data `Classes`, `Rooms`, dan `Subject`. Cukup sediakan user siswa dan guru tanpa `fet_staff_id`.
   - Pastikan response 422 memuat error key `fet_staff_id`.
4. **Perbarui `test_pdf_import_upload_is_allowed_when_master_data_and_fet_staff_id_are_present`:**
   - Ubah/pastikan skenario menguji kondisi **tanpa membuat data Kelas, Ruangan, atau Mata Pelajaran**.
   - Tambahkan assertion `assertEquals(0, Classes::count())`, `assertEquals(0, Rooms::count())`, `assertEquals(0, Subject::count())`.
   - Pastikan response tetap mengembalikan status **202 Accepted**.
5. **Pertahankan Skenario Manual Schedule & Konfirmasi:**
   - `test_manual_schedule_creation_is_rejected_when_master_data_is_completely_empty` ➔ Tetap memverifikasi `classes`, `teachers`, `subjects`, `rooms`.
   - `test_manual_schedule_creation_is_rejected_when_some_master_data_is_missing` ➔ Tetap memverifikasi missing entities.
   - `test_manual_schedule_creation_is_allowed_when_master_data_is_complete` ➔ Tetap memverifikasi 201 Created.

### Langkah 3: Penyelarasan Fixture `tests/Feature/ScheduleImportTest.php`
- Pada method `setUp()`, tambahkan pembuatan user siswa aktif:
  ```php
  User::create([
      'name' => 'Siswa Test',
      'email' => 'siswa@example.com',
      'nis_nip' => '12345678',
      'role' => 'student',
      'password' => Hash::make('password123'),
      'must_change_password' => false,
  ]);
  ```
- Langkah ini memastikan test `test_waka_can_upload_pdfs_and_dispatches_parse_job` pada `ScheduleImportTest` tetap berjalan mulus tanpa terkena blocking validasi siswa kosong.

### Langkah 4: Eksekusi Uji Regresi & Verifikasi
- Jalankan test terarah:
  ```bash
  php artisan test --filter=MasterDataPrerequisiteRuleTest
  php artisan test --filter=ScheduleImportTest
  php artisan test --filter=ScheduleTest
  ```
- Pastikan seluruh test case yang relevan berstatus **Passed** (100% Green).

### Langkah 5: Dokumentasi Proyek
- Catat seluruh perubahan implementasi pada `MD/Development.md` sebagai **Bagian 78: Penyelarasan Aturan Prasyarat Master Data (Fase 5)**.

---

## 5. Matriks File yang Terdampak

| No | File Path | Status | Deskripsi Tanggung Jawab & Perubahan |
|:--:|---|:---:|---|
| 1 | `app/Services/MasterDataPrerequisiteService.php` | Diubah | Memperbarui method `validateForPdfImport()` agar hanya mengevaluasi Siswa dan Guru ber-ID FET; menjaga `validateForManualSchedule()` tetap utuh mengevaluasi 4 master data. |
| 2 | `tests/Feature/MasterDataPrerequisiteRuleTest.php` | Diubah | Menyelaraskan skenario pengujian penolakan & penerimaan upload PDF sesuai aturan baru; menambahkan skenario siswa kosong. |
| 3 | `tests/Feature/ScheduleImportTest.php` | Diubah | Menambahkan seed user siswa pada `setUp()` agar pengujian upload PDF tetap valid sesuai aturan prasyarat baru. |
| 4 | `MD/Development.md` | Diubah | Mendokumentasikan perubahan arsitektur prasyarat, pembaruan skenario test, dan hasil verifikasi. |

> **Catatan Pengendalian:** File `app/Http/Controllers/API/ScheduleController.php`, `app/Http/Controllers/API/ScheduleImportController.php`, tabel database, serta migration **TIDAK DIUBAH** pada fase ini.

---

## 6. Kriteria Keberhasilan (*Acceptance Criteria*)

Implementasi Fase 5 dinyatakan selesai dan berhasil apabila:

1. [ ] **Validasi Impor PDF:** Endpoint `POST /api/schedule-imports` berhasil menerima berkas PDF dengan status `202 Accepted` dan men-dispatch job `ParseSchedulePdfJob` dalam kondisi tabel `classes`, `subjects`, dan `rooms` kosong sama sekali (0 baris data), selama minimal ada 1 user siswa aktif dan 1 guru aktif dengan `fet_staff_id`.
2. [ ] **Proteksi Data Siswa:** Endpoint `POST /api/schedule-imports` menolak upload dengan status `422 Unprocessable Entity` dan `missing_entities = ['students']` jika belum ada user dengan role `student`.
3. [ ] **Proteksi Data Guru & FET:** Endpoint `POST /api/schedule-imports` menolak upload dengan status `422 Unprocessable Entity` jika:
   - Tidak ada guru sama sekali (`missing_entities = ['teachers']`).
   - Ada guru tetapi tidak ada satupun yang memiliki `fet_staff_id` (`missing_entities = ['fet_staff_id']`).
4. [ ] **Integritas Jadwal Manual:** Endpoint `POST /api/schedules` (jadwal manual) tetap menolak pembuatan jadwal dengan status `422 Unprocessable Entity` jika salah satu dari `classes`, `teachers`, `subjects`, atau `rooms` kosong.
5. [ ] **Otomasi Pengujian:** Rangkaian test `MasterDataPrerequisiteRuleTest` (seluruh skenario baru & lama) dan `ScheduleImportTest` lulus 100% dengan 0 failure dan 0 error.
6. [ ] **Dokumentasi Lengkap:** Catatan teknis tertera rapi pada `MD/Development.md`.

---

## 7. Analisis Risiko & Mitigasi

| No | Potensi Risiko / Kendala | Dampak Teknis | Strategi Mitigasi Terencana |
|:--:|---|---|---|
| 1 | **Test suite `ScheduleImportTest` lama mengalami kegagalan** | `ScheduleImportTest` sebelumnya tidak membuat user siswa, sehingga akan tertolak 422 saat upload PDF. | Menambahkan akun siswa pada method `setUp()` di `tests/Feature/ScheduleImportTest.php` sebagai bagian dari scope penyesuaian test Fase 5. |
| 2 | **Inkonsistensi key error pada frontend lama** | Frontend yang mengasumsikan key `classes` saat validasi impor PDF gagal dapat mengalami kebingungan penanganan error. | Key error diselaraskan secara semantik: `students` untuk data siswa kosong, `teachers` untuk guru kosong, dan `fet_staff_id` untuk nomor staf FET yang belum terisi. Format respons API (`success`, `message`, `errors`, `meta.missing_entities`) tetap mempertahankan struktur kontrak yang identik. |
| 3 | **Regresi pada pembuatan jadwal manual** | Perubahan service memengaruhi validasi jadwal manual sehingga lolos tanpa ruangan atau mapel. | Logika `validateForManualSchedule()` dipisahkan secara tegas (*decoupled*) dari `validateForPdfImport()`, dan feature test jadwal manual (`test_manual_schedule_creation_*`) dijalankan untuk memverifikasi proteksinya tetap aktif 100%. |

---

## 8. Persiapan Menuju Fase 6
Setelah Fase 5 selesai dan terverifikasi:
- Waka Kurikulum dapat mengunggah PDF jadwal segera setelah mengimpor data Guru (Fase 3) dan Siswa (Fase 4).
- Sistem siap melangkah ke **Fase 6: Pra-Registrasi Otomatis Ruangan & Mapel pada Worker PDF**, di mana antrean worker `ParseSchedulePdfJob` akan membaca isi PDF hasil upload dan mendaftarkan kode ruangan serta nama mata pelajaran secara mandiri ke database.
