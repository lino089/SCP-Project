# Rencana Implementasi: Zero-Manual Master Data & Integrated Schedule Ingestion (SCP v4.5)

**Dokumen Rencana:** `MD/NEW_FEATURE_IMPLEMENTATION_PLAN.md`  
**Proyek:** School Class Progress (SCP) — Backend REST API  
**Versi Target:** SCP v4.5  
**Dokumen Acuan:** `MD/NewFeature.md`, `MD/PRD.md` (v4.4), `MD/Development.md`, `MD/MASTER_DATA_PREREQUISITE_PLAN.md`, `MD/FASE_3_SCHEDULE_IMPORT_PLAN.md`  
**Status Dokumen:** Usulan Rencana Terperinci (Menunggu Persetujuan Pengguna Sebelum Eksekusi)  

---

## DAFTAR ISI
1. [Ringkasan Eksekutif & Prinsip Desain v4.5](#1-ringkasan-eksekutif--prinsip-desain-v45)
2. [Identifikasi Kebutuhan Pengembangan & Analisis Dampak](#2-identifikasi-kebutuhan-pengembangan--analisis-dampak)
3. [Hal-Hal yang Perlu Dikonfirmasi (Ambiguitas & Keputusan Desain)](#3-hal-hal-yang-perlu-dikonfirmasi-ambiguitas--keputusan-desain)
4. [Rincian Tahapan Implementasi (Fase 1 s.d. Fase 7)](#4-rincian-tahapan-implementasi-fase-1-sd-fase-7)
   - [Fase 1: Kesiapan Lingkungan & Dependensi Spreadsheet](#fase-1-kesiapan-lingkungan--dependensi-spreadsheet)
   - [Fase 2: Skema Basis Data & Penyelarasan Model Siswa](#fase-2-skema-basis-data--penyelarasan-model-siswa)
   - [Fase 3: Modul Impor Guru & Auto-Provisioning Akun](#fase-3-modul-impor-guru--auto-provisioning-akun)
   - [Fase 4: Modul Impor Siswa & Auto-Create Kelas](#fase-4-modul-impor-siswa--auto-create-kelas)
   - [Fase 5: Penyelarasan Aturan Prasyarat Master Data (Hanya Siswa & Guru)](#fase-5-penyelarasan-aturan-prasyarat-master-data-hanya-siswa--guru)
   - [Fase 6: Pra-Registrasi Otomatis Ruangan & Mapel pada Worker PDF](#fase-6-pra-registrasi-otomatis-ruangan--mapel-pada-worker-pdf)
   - [Fase 7: Pengujian Komprehensif & Verifikasi Zero-Regression](#fase-7-pengujian-komprehensif--verifikasi-zero-regression)
5. [Matriks File yang Terdampak (Created / Modified)](#5-matriks-file-yang-terdampak-created--modified)
6. [Analisis Risiko, Kendala Teknis & Mitigasi](#6-analisis-risiko-kendala-teknis--mitigasi)
7. [Kriteria Penyelesaian Akhir (*Definition of Done*)](#7-kriteria-penyelesaian-akhir-definition-of-done)

---

## 1. Ringkasan Eksekutif & Prinsip Desain v4.5

### 1.1 Latar Belakang & Masalah
Pada implementasi SCP v4.4, Waka Kurikulum menghadapi kendala operasional awal:
1. Master data sekolah (Kelas, Guru, Ruangan, dan Mata Pelajaran) harus diisi secara manual satu per satu sebelum Waka dapat mengunggah jadwal KBM dari FET.
2. Jika master data belum lengkap, gerbang prasyarat (`MasterDataPrerequisiteService`) menolak upload PDF jadwal dengan status HTTP 422.
3. Waka dibebani proses administrasi redundan: mendaftarkan puluhan kelas, ruangan, dan ratusan mata pelajaran yang sebenarnya sudah tercetak lengkap di dalam berkas ekspor FET (`Jadwal_Kelas.pdf` dan `Jadwal_Ruangan.pdf`).

### 1.2 Ketentuan Baru v4.5 (*The Revised Prerequisite Rule*)
Berdasarkan arahan terbaru:
> **"Master data yang wajib tersedia sebelum proses import jadwal HANYALAH Data Siswa dan Data Guru (beserta fet_staff_id). Seluruh master data lainnya (Kelas, Ruangan, dan Mata Pelajaran) TIDAK PERLU disyaratkan di gerbang awal import jadwal."**

### 1.3 Paradigma 4 Berkas Masukan (*The 4-Files Ingestion Paradigm*)
Sistem mengotomatisasi seluruh master data melalui alur berantai yang efisien:
```
[Tahap 1: Data Pengguna Sekolah via Excel]
   ├── 1. Excel Guru (.xlsx)   ──> Auto-Provisioning Akun Guru & fet_staff_id
   └── 2. Excel Siswa (.xlsx)  ──> Auto-Provisioning Akun Siswa & Ortu + Auto-Create Master Kelas

[Tahap 2: Data Fisik & Kurikulum via Ekspor PDF FET]
   ├── 3. Jadwal_Ruangan.pdf   ──> Auto-Create Master Ruangan (Kapasitas bawaan: 36) [TIDAK DISYARATKAN DI AWAL]
   └── 4. Jadwal_Kelas.pdf     ──> Auto-Create Master Mapel & Matching Komit Jadwal [TIDAK DISYARATKAN DI AWAL]
```

---

## 2. Identifikasi Kebutuhan Pengembangan & Analisis Dampak

### 2.1 Kebutuhan Infrastruktur & Pustaka
- Membutuhkan library *streaming spreadsheet* hemat memori ($< 10\text{ MB}$ RAM) untuk memproses ribuan baris Excel tanpa *memory leak* atau *timeout*. Pustaka terpilih: `spatie/simple-excel:^3.0`.
- Memerlukan ekstensi PHP `ext-zip` (via `php_zip.dll`) dan `ext-xml` pada lingkungan PHP 8.4 server.

### 2.2 Kebutuhan Endpoint API Baru
Daftar endpoint baru di bawah middleware `['auth:sanctum', 'throttle:api', 'role:vice_principal']`:
1. `GET /api/teachers/import-template` ➔ Mengunduh template Excel guru (`guru_import_template.xlsx`).
2. `POST /api/teachers/import` ➔ Mengunggah dan memproses data guru massal via multipart.
3. `GET /api/students/import-template` ➔ Mengunduh template Excel siswa (`siswa_import_template.xlsx`).
4. `POST /api/students/import` ➔ Mengunggah dan memproses data siswa, kelas, dan orang tua massal via multipart.

### 2.3 Kebutuhan Logika Domain & Service
- **`MasterDataPrerequisiteService`**:
  - `validateForPdfImport()`: Direvisi total agar **hanya** memvalidasi ketersediaan `students` ($\ge 1$) dan `teachers` dengan `fet_staff_id` ($\ge 1$). Evaluasi `classes`, `rooms`, dan `subjects` dihapus dari pengecekan awal PDF.
  - `validateForManualSchedule()`: Tetap mempertahankan validasi lengkap 4 pilar (`classes`, `teachers`, `rooms`, `subjects`) karena form manual menuntut pemilihan ID entitas yang sudah ada.
- **`ParseSchedulePdfJob`**:
  - Menambahkan fase pra-registrasi sebelum matching:
    1. Ekstraksi kode ruang unik dari hasil parser ➔ `Rooms::firstOrCreate(['name' => $roomCode], ['capacity' => 36])`.
    2. Ekstraksi nama mapel unik dari hasil parser ➔ `Subject::firstOrCreate(['name' => $subjectName])`.
    3. Fallback ekstraksi kelas unik jika belum ada di database ➔ `Classes::firstOrCreate(['name' => $cleanClass], ['level' => $level])`.

---

## 3. Hal-Hal yang Perlu Dikonfirmasi (Ambiguitas & Keputusan Desain)

Sebelum eksekusi teknis dilakukan, berikut adalah 3 poin keputusan teknis yang perlu dicatat dan dikonfirmasi:

### ❓ Poin 1: Penyimpanan Kolom `gender` dan `nisn` pada Tabel `users`
- **Kondisi:** Pada spesifikasi template Excel siswa (`siswa_import_template.xlsx`), terdapat kolom wajib `gender` (`L`/`P`) dan kolom opsional `nisn` (10 digit). Namun, skema tabel `users` saat ini belum memiliki kedua kolom tersebut.
- **Opsi Solusi:**
  - *Opsi A (Direkomendasikan):* Membuat migration baru `add_gender_and_nisn_to_users_table.php` dan mendaftarkannya pada `$fillable` model `User`. Dengan opsi ini, data profil gender dan NISN siswa tersimpan permanen di database.
  - *Opsi B:* Kolom `gender` dan `nisn` hanya divalidasi pada berkas Excel tanpa disimpan ke tabel `users`.
- **Rencana Default:** Mengadopsi **Opsi A** demi integritas data akademik jangka panjang, kecuali diarahkan lain oleh pengguna.

### ❓ Poin 2: Penanganan Akun Orang Tua dengan Nomor Telepon Sama (Siswa Bersaudara)
- **Kondisi:** `NewFeature.md` Bagian 3 menyebutkan: *"Orang Tua: User::firstOrCreate dari parent_phone"*. Namun di skema database saat ini, kolom `nis_nip` bersifat `UNIQUE` dan `linked_student_id` bernilai ID tunggal (*one-to-one/many-to-one inverse*). Jika ada dua siswa bersaudara dengan nomor telepon orang tua yang sama, pembuatan akun ortu berbasis nomor telepon dapat memicu konflik `nis_nip` atau kehilangan tautan ke salah satu anak.
- **Rencana Default:**
  - Akun orang tua tetap dibuat menggunakan konvensi baku SCP: `username / nis_nip = "P-" . $nisSiswa`, dengan `phone_number = $parentPhone`.
  - Hal ini menjamin keunikan kredensial login orang tua per anak dan kompatibel 100% dengan endpoint `GET /api/students/{id}/attendance/summary` dan `linked_student_id`.

### ❓ Poin 3: Kesiapan Ekstensi PHP `zip`
- **Kondisi:** Pemeriksaan lingkungan menunjukkan PHP 8.4 belum mengaktifkan modul `zip` (`php_zip.dll` tersedia di `C:\php\ext`, namun belum di-uncomment di `C:\php\php.ini`).
- **Rencana:** Pada Fase 1, status ekstensi akan diverifikasi dan diaktifkan agar library `spatie/simple-excel` dapat mengeksekusi ekstraksi file `.xlsx` berbasis ZIP secara lancar.

---

## 4. Rincian Tahapan Implementasi (Fase 1 s.d. Fase 7)

```
┌────────────────────────────────────────────────────────────────────────┐
│               ROADMAP IMPLEMENTASI SCP v4.5 (WBS)                      │
└────────────────────────────────────────────────────────────────────────┘
   [Fase 1: Kesiapan Lingkungan & Dependensi]
      └── Verifikasi ext-zip & instalasi spatie/simple-excel
            │
   [Fase 2: Skema Basis Data & Model Siswa]
      └── Migration add_gender_and_nisn_to_users_table & Update User Model
            │
   [Fase 3: Modul Impor Guru (TeacherController)]
      └── Template generator & streaming import (NIP, fet_staff_id, pass hash)
            │
   [Fase 4: Modul Impor Siswa & Auto-Create Kelas (StudentController)]
      └── Template generator, regex level kelas, & streaming import siswa/ortu
            │
   [Fase 5: Penyelarasan Prasyarat (MasterDataPrerequisiteService)]
      └── Aturan baru PDF import: HANYA wajib siswa & guru (fet_staff_id)
            │
   [Fase 6: Pra-Registrasi Otomatis Ruangan & Mapel (ParseSchedulePdfJob)]
      └── Auto-create Rooms (kapasitas 36), Subject, & fallback Classes
            │
   [Fase 7: Automated Test Suite & Verifikasi Regresi]
      └── Feature tests modul import, rule test baru, & full suite (199+ passed)
```

---

### Fase 1: Kesiapan Lingkungan & Dependensi Spreadsheet
- **Tujuan & Ruang Lingkup:**
  Menyiapkan pustaka pengolah file Excel bervolume besar dengan footprint memori minimal pada PHP 8.4 / Laravel 13.
- **Detail Tugas:**
  1. Memastikan ekstensi `extension=zip` aktif pada `C:\php\php.ini`.
  2. Menambahkan dependensi `spatie/simple-excel:^3.0` pada `composer.json`.
  3. Menjalankan `composer update spatie/simple-excel --no-scripts` (atau `composer require spatie/simple-excel`).
  4. Memverifikasi bahwa class `Spatie\SimpleExcel\SimpleExcelReader` dan `SimpleExcelWriter` dapat dimuat via autoloader Laravel.
- **File / Komponen yang Dibuat atau Diubah:**
  - `composer.json` (diubah: require `spatie/simple-excel`).
  - `composer.lock` (diubah).
- **Ketergantungan:** Tidak ada (fondasi awal).
- **Target Hasil & Kriteria Keberhasilan:**
  - Perintah `php -m` menampilkan modul `zip`.
  - Eksekusi `php artisan tinker --execute="class_exists('Spatie\SimpleExcel\SimpleExcelReader');"` mengembalikan `true`.
- **Skenario Pengujian:**
  - Uji baca file dummy `.xlsx` melalui CLI / tinker tanpa memicu `ClassNotFoundException`.

---

### Fase 2: Skema Basis Data & Penyelarasan Model Siswa
- **Tujuan & Ruang Lingkup:**
  Menyesuaikan tabel `users` agar dapat menampung kolom `gender` dan `nisn` sesuai spesifikasi kontrak berkas template Excel siswa.
- **Detail Tugas:**
  1. Membuat berkas migration `database/migrations/2026_10_30_000001_add_gender_and_nisn_to_users_table.php`.
     - Kolom `gender`: `enum('gender', ['L', 'P'])->nullable()`.
     - Kolom `nisn`: `string('nisn', 20)->nullable()->unique()`.
  2. Menjalankan migrasi `php artisan migrate`.
  3. Memperbarui atribut `#[Fillable]` pada `app/Models/User.php` dengan menambahkan `'gender'` dan `'nisn'`.
- **File / Komponen yang Dibuat atau Diubah:**
  - `database/migrations/2026_10_30_000001_add_gender_and_nisn_to_users_table.php` (dibuat).
  - `app/Models/User.php` (diubah).
- **Ketergantungan:** Fase 1.
- **Target Hasil & Kriteria Keberhasilan:**
  - Tabel `users` di PostgreSQL/SQLite memiliki kolom `gender` dan `nisn`.
  - Model `User::create` dapat menginjeksi kedua kolom tersebut tanpa terkena *mass-assignment protection error*.
- **Skenario Pengujian:**
  - `php artisan migrate:status` berstatus *Ran*.
  - Pembuatan user siswa dengan field gender 'L' dan NISN '0012345678' berhasil tersimpan.

---

### Fase 3: Modul Impor Guru & Auto-Provisioning Akun
- **Tujuan & Ruang Lingkup:**
  Menyediakan endpoint download template Excel guru dan memproses impor data guru secara massal dengan validasi ketat dan transaksi atomik.
- **Detail Tugas:**
  1. Menambahkan 2 rute pada `routes/api.php` di dalam grup Waka:
     ```php
     Route::get('/teachers/import-template', [TeacherController::class, 'downloadTemplate']);
     Route::post('/teachers/import', [TeacherController::class, 'import']);
     ```
  2. Mengimplementasikan method `downloadTemplate()` pada `app/Http/Controllers/API/TeacherController.php`:
     - Menghasilkan file `guru_import_template.xlsx` secara streaming dengan header: `nip`, `name`, `fet_staff_id`, `email`, `phone_number`.
     - Menyertakan 1–2 baris contoh data valid.
  3. Mengimplementasikan method `import(Request $request)` pada `TeacherController.php`:
     - Validasi file: wajib ada, ekstensi `.xlsx`, MIME spreadsheet, ukuran maksimal 5120 KB (5 MB).
     - Streaming baris via `SimpleExcelReader::create($filePath)`.
     - Validasi per baris: `nip` wajib (format text string), `name` wajib, `fet_staff_id` wajib (numerik/string).
     - Pengecekan in-file duplikasi NIP dan `fet_staff_id`.
     - Pengecekan duplikasi NIP dan `fet_staff_id` terhadap basis data (`User::where('nis_nip', ...)->exists()`).
     - Eksekusi `DB::transaction()` *all-or-nothing*: jika ada 1 baris salah, rollback dan return HTTP 422 berstruktur JSON standar:
       `{ success: false, message: "Validasi berkas gagal pada beberapa baris.", errors: [{ row: X, attribute: "nip", message: "..." }] }`.
     - Jika valid: membuat akun `User` (role: `teacher`, `nis_nip` = NIP, `password` = Hash NIP, `fet_staff_id`, `must_change_password` = true).
     - Mengembalikan respons HTTP 201 dengan data ringkasan jumlah guru yang diimpor.
  4. Menyusun automated feature test `tests/Feature/TeacherImportTest.php`.
- **File / Komponen yang Dibuat atau Diubah:**
  - `routes/api.php` (diubah).
  - `app/Http/Controllers/API/TeacherController.php` (diubah).
  - `tests/Feature/TeacherImportTest.php` (dibuat).
- **Ketergantungan:** Fase 1.
- **Target Hasil & Kriteria Keberhasilan:**
  - Waka dapat mengunduh template Excel guru yang valid.
  - Upload file Excel guru berhasil membuat akun guru massal dengan password default hash NIP.
  - Percobaan impor file dengan NIP ganda atau file rusak ditolak dengan status 422 dan pesan terperinci.
  - Pengguna non-Waka ditolak dengan HTTP 403 Forbidden.
- **Skenario Pengujian:**
  - Uji otorisasi Waka vs Guru vs Siswa.
  - Uji download template: respons 200, header attachment `.xlsx`.
  - Uji impor data valid: 5 akun guru terbuat di DB, `role = teacher`, `must_change_password = true`.
  - Uji duplikasi NIP dalam file yang sama: ditolak 422, rollback DB.
  - Uji tabrakan NIP dengan data yang sudah ada di DB: ditolak 422.

---

### Fase 4: Modul Impor Siswa & Auto-Create Kelas
- **Tujuan & Ruang Lingkup:**
  Menyediakan endpoint download template Excel siswa, auto-create master kelas berbasis nama rombel, auto-provisioning akun siswa, serta auto-provisioning akun orang tua.
- **Detail Tugas:**
  1. Menambahkan 2 rute pada `routes/api.php` di dalam grup Waka:
     ```php
     Route::get('/students/import-template', [StudentController::class, 'downloadTemplate']);
     Route::post('/students/import', [StudentController::class, 'import']);
     ```
  2. Mengimplementasikan method `downloadTemplate()` pada `app/Http/Controllers/API/StudentController.php`:
     - Menghasilkan file `siswa_import_template.xlsx` secara streaming dengan header: `nis`, `name`, `class_name`, `gender`, `nisn`, `parent_name`, `parent_phone`.
     - Menyertakan contoh data rombel (misal: `X RPL 1`, `XI TKJ 2`, `XII AK 3`).
  3. Mengimplementasikan method `import(Request $request)` pada `StudentController.php`:
     - Validasi file: wajib ada, ekstensi `.xlsx`, MIME spreadsheet, ukuran maksimal 5120 KB.
     - Streaming baris via `SimpleExcelReader`.
     - Validasi per baris: `nis` wajib, `name` wajib, `class_name` wajib, `gender` wajib (`L`/`P`).
     - Deteksi duplikasi NIS di dalam file dan terhadap database.
     - Eksekusi `DB::transaction()` *all-or-nothing*:
       - **Auto-create Kelas:** Membaca `class_name`, membersihkan spasi, mendeteksi tingkatan via regex:
         - Dimulai dengan `XII` ➔ `level = "12"`
         - Dimulai dengan `XI` ➔ `level = "11"`
         - Dimulai dengan `X` (atau lainnya) ➔ `level = "10"`
         - Menjalankan `Classes::firstOrCreate(['name' => $cleanClassName], ['level' => $level, 'next_class_id' => null])`.
       - **Auto-create Siswa:** Menjalankan `User::create` (role: `student`, `nis_nip` = NIS, `password` = Hash NIS, `class_id` = ID kelas terkait, `gender`, `nisn`, `is_held_back` = false, `must_change_password` = true).
       - **Auto-create Orang Tua:** Menjalankan `User::create` (role: `parent`, `name` = `parent_name` ?: `"Wali dari " . $name`, `nis_nip` = `"P-" . $nis`, `password` = Hash NIS, `linked_student_id` = ID siswa, `phone_number` = `parent_phone`, `must_change_password` = true).
     - Mengembalikan respons HTTP 201 dengan ringkasan: jumlah kelas terbuat/ditemukan, jumlah siswa terdaftar, dan akun orang tua tercetak.
  4. Menyusun automated feature test `tests/Feature/StudentImportTest.php`.
- **File / Komponen yang Dibuat atau Diubah:**
  - `routes/api.php` (diubah).
  - `app/Http/Controllers/API/StudentController.php` (diubah).
  - `tests/Feature/StudentImportTest.php` (dibuat).
- **Ketergantungan:** Fase 1, Fase 2.
- **Target Hasil & Kriteria Keberhasilan:**
  - Berkas template siswa berhasil diunduh.
  - Impor siswa berhasil membuat master kelas otomatis tanpa entri manual.
  - Akun siswa dan orang tua (`P-{nis}`) terbentuk presisi dalam transaksi database atomik.
  - Jika terjadi validasi gagal (format gender bukan L/P, NIS duplikat), transaksi di-rollback utuh dan return 422.
- **Skenario Pengujian:**
  - Uji download template siswa.
  - Uji impor data valid (misal: 10 siswa dalam 3 rombel berbeda): 3 kelas terbuat di tabel `classes` dengan level 10, 11, dan 12; 10 siswa terdaftar; 10 akun orang tua terbuat.
  - Uji parsing regex level kelas: `X RPL 1` ➔ level 10, `XI DKV 2` ➔ level 11, `XII OTKP` ➔ level 12.
  - Uji validasi baris: gender 'X' ditolak 422, NIS ganda ditolak 422.

---

### Fase 5: Penyelarasan Aturan Prasyarat Master Data (Hanya Siswa & Guru)
- **Tujuan & Ruang Lingkup:**
  Menyelaraskan service evaluasi prasyarat (`MasterDataPrerequisiteService`) dan endpoint upload PDF jadwal (`POST /api/schedule-imports`) agar **hanya mensyaratkan tersedianya data Siswa dan data Guru (dengan `fet_staff_id`)**.
- **Detail Tugas:**
  1. Memodifikasi `app/Services/MasterDataPrerequisiteService.php`:
     - Method `validateForPdfImport()`:
       ```php
       public function validateForPdfImport(): array
       {
           $hasStudents = User::where('role', 'student')->whereNull('deleted_at')->exists();
           $hasTeachersWithFetId = User::where('role', 'teacher')
               ->whereNull('deleted_at')
               ->whereNotNull('fet_staff_id')
               ->where('fet_staff_id', '!=', '')
               ->exists();

           $missing = [];
           $errors = [];

           if (!$hasStudents) {
               $missing[] = 'students';
               $errors['students'] = ['Master data siswa masih kosong. Waka wajib mengimpor data siswa terlebih dahulu.'];
           }

           if (!$hasTeachersWithFetId) {
               $missing[] = 'teachers';
               $errors['teachers'] = ['Master data guru belum siap. Waka wajib mengimpor guru yang memiliki fet_staff_id untuk import PDF.'];
           }

           return [
               'is_valid' => empty($missing),
               'missing' => $missing,
               'errors' => $errors,
           ];
       }
       ```
     - Method `validateForManualSchedule()`: Tetap dipertahankan memvalidasi 4 entitas lengkap (`classes`, `teachers`, `subjects`, `rooms`).
  2. Memperbarui `tests/Feature/MasterDataPrerequisiteRuleTest.php`:
     - Mengubah skenario pengujian upload PDF:
       - Uji tolak jika siswa kosong (422 missing: `students`).
       - Uji tolak jika guru / `fet_staff_id` kosong (422 missing: `teachers`).
       - Uji **LOLOS (202 Accepted)** saat hanya terdapat Siswa dan Guru dengan `fet_staff_id`, **meskipun tabel `rooms` dan `subjects` masih kosong (0 record)**.
- **File / Komponen yang Dibuat atau Diubah:**
  - `app/Services/MasterDataPrerequisiteService.php` (diubah).
  - `tests/Feature/MasterDataPrerequisiteRuleTest.php` (diubah).
- **Ketergantungan:** Fase 3, Fase 4.
- **Target Hasil & Kriteria Keberhasilan:**
  - Upload berkas PDF jadwal FET tidak lagi memblokir Waka dengan alasan master ruangan atau mata pelajaran kosong.
  - Penolakan 422 hanya terjadi jika data siswa atau data guru ber-ID FET belum ada di sistem.
- **Skenario Pengujian:**
  - `test_pdf_import_upload_is_rejected_when_students_are_empty` ➔ 422.
  - `test_pdf_import_upload_is_rejected_when_teachers_lack_fet_staff_id` ➔ 422.
  - `test_pdf_import_upload_is_allowed_when_only_students_and_teachers_with_fet_exist` ➔ 202.

---

### Fase 6: Pra-Registrasi Otomatis Ruangan & Mapel pada Worker PDF
- **Tujuan & Ruang Lingkup:**
  Memperbarui antrean worker latar belakang (`ParseSchedulePdfJob`) agar mengekstrak dan mendaftarkan entitas ruangan fisik dan mata pelajaran unik secara otomatis sebelum proses pencocokan jadwal KBM dijalankan.
- **Detail Tugas:**
  1. Memodifikasi `app/Jobs/ParseSchedulePdfJob.php` pada method `handle()` tepat setelah data mentah `$parseData` berhasil diekstrak dari skrip Python:
     - **Pra-Registrasi Ruangan Otomatis:**
       ```php
       $uniqueRooms = collect($parseData)->pluck('ruang_final')->filter()->unique();
       foreach ($uniqueRooms as $roomCode) {
           Rooms::firstOrCreate(
               ['name' => trim($roomCode)],
               ['capacity' => 36]
           );
       }
       ```
     - **Pra-Registrasi Mata Pelajaran Otomatis:**
       ```php
       $uniqueSubjects = collect($parseData)->pluck('mapel_mentah')->filter()->unique();
       foreach ($uniqueSubjects as $subjectName) {
           Subject::firstOrCreate(['name' => trim($subjectName)]);
       }
       ```
     - **Fallback Pra-Registrasi Kelas:**
       ```php
       $uniqueClasses = collect($parseData)->pluck('kelas_mentah')->filter()->unique();
       foreach ($uniqueClasses as $rawClass) {
           $cleanName = trim($rawClass);
           $level = '10';
           if (preg_match('/^XII\b/i', $cleanName)) $level = '12';
           elseif (preg_match('/^XI\b/i', $cleanName)) $level = '11';

           Classes::firstOrCreate(['name' => $cleanName], ['level' => $level, 'next_class_id' => null]);
       }
       ```
     - **Reload Koleksi Master Data:** Memanggil `$allRooms = Rooms::all();`, `$allSubjects = Subject::all();`, `$allClasses = Classes::all();` setelah registrasi otomatis selesai, sebelum perulangan pemetaan jadwal dimulai.
  2. Memastikan penanganan format data selaras dengan output array `script/pdf_parser.py`.
- **File / Komponen yang Dibuat atau Diubah:**
  - `app/Jobs/ParseSchedulePdfJob.php` (diubah).
- **Ketergantungan:** Fase 4, Fase 5.
- **Target Hasil & Kriteria Keberhasilan:**
  - Saat worker memproses PDF ruangan dan kelas, tabel `rooms` terisi seluruh kode ruangan dengan kapasitas default 36, dan tabel `subjects` terisi seluruh nama mata pelajaran.
  - Tingkat pencocokan baris jadwal (`match_status = matched`) mendekati 100% tanpa adanya baris yang gagal akibat missing ruangan atau mapel.
- **Skenario Pengujian:**
  - Pengujian job dengan database kosong (hanya guru & siswa): setelah job selesai, tabel `rooms` dan `subjects` terisi otomatis dan status import menjadi `preview_ready`.

---

### Fase 7: Pengujian Komprehensif & Verifikasi Zero-Regression
- **Tujuan & Ruang Lingkup:**
  Menjalankan rangkaian pengujian otomatis end-to-end, memastikan seluruh modul baru teruji, dan memastikan seluruh 199 unit/feature test yang sudah ada tetap berstatus hijau (100% Passed).
- **Detail Tugas:**
  1. Menjalankan pengujian terisolasi modul baru:
     - `php artisan test --filter=TeacherImportTest`
     - `php artisan test --filter=StudentImportTest`
     - `php artisan test --filter=MasterDataPrerequisiteRuleTest`
     - `php artisan test --filter=ScheduleImportTest`
  2. Menjalankan integrasi end-to-end:
     - Simulasi upload Excel Guru ➔ 10 guru terbuat.
     - Simulasi upload Excel Siswa ➔ 3 kelas & 30 siswa terbuat.
     - Simulasi upload 2 PDF FET ➔ Lolos 202 Accepted.
     - Simulasi eksekusi `ParseSchedulePdfJob` ➔ Ruangan & Mapel terdaftar otomatis.
     - Simulasi konfirmasi import ➔ Jadwal tersimpan ke tabel `schedules`.
  3. Menjalankan *Full Regression Test Suite*:
     - `php artisan test`
     - Target: Seluruh test case lulus (minimal $\ge 205$ test cases passed, 0 failures, 0 errors).
- **File / Komponen yang Dibuat atau Diubah:**
  - Seluruh test suite terverifikasi.
- **Ketergantungan:** Fase 1 s.d. Fase 6.
- **Target Hasil & Kriteria Keberhasilan:**
  - Seluruh 11 Checklist Kriteria Kelulusan UKK pada PRD Bagian 10 tetap 100% terpenuhi.
  - Zero regression pada seluruh fitur eksisting (auth, presensi, jurnal, kuis AI, kenaikan kelas).

---

## 5. Matriks File yang Terdampak (Created / Modified)

| No | File Path | Status | Deskripsi Tanggung Jawab & Perubahan |
|:--:|---|:---:|---|
| 1 | `composer.json` & `composer.lock` | Diubah | Mendaftarkan dependensi `spatie/simple-excel:^3.0`. |
| 2 | `database/migrations/2026_10_30_000001_add_gender_and_nisn_to_users_table.php` | Dibuat | Menambahkan kolom `gender` dan `nisn` pada tabel `users`. |
| 3 | `app/Models/User.php` | Diubah | Mendaftarkan `gender` dan `nisn` pada `#[Fillable]`. |
| 4 | `routes/api.php` | Diubah | Mendaftarkan 4 rute import guru & siswa di bawah middleware Waka. |
| 5 | `app/Http/Controllers/API/TeacherController.php` | Diubah | Menambahkan method `downloadTemplate()` dan `import()` guru. |
| 6 | `app/Http/Controllers/API/StudentController.php` | Diubah | Menambahkan method `downloadTemplate()` dan `import()` siswa/kelas. |
| 7 | `app/Services/MasterDataPrerequisiteService.php` | Diubah | Memperbarui `validateForPdfImport()`: hanya mensyaratkan siswa & guru ber-ID FET. |
| 8 | `app/Jobs/ParseSchedulePdfJob.php` | Diubah | Menambahkan pra-registrasi otomatis `Rooms`, `Subject`, dan fallback `Classes`. |
| 9 | `tests/Feature/TeacherImportTest.php` | Dibuat | Feature test validasi, streaming import guru, dan penanganan duplikasi. |
| 10 | `tests/Feature/StudentImportTest.php` | Dibuat | Feature test streaming import siswa, regex kelas, dan akun orang tua. |
| 11 | `tests/Feature/MasterDataPrerequisiteRuleTest.php` | Diubah | Memperbarui skenario prasyarat PDF import agar sesuai aturan baru. |

---

## 6. Analisis Risiko, Kendala Teknis & Mitigasi

| No | Potensi Risiko / Kendala | Dampak Teknis | Strategi Mitigasi Terencana |
|:--:|---|---|---|
| 1 | **Ekstensi PHP `zip` belum aktif pada `php.ini`** | Perintah `composer require spatie/simple-excel` atau pembacaan file `.xlsx` akan gagal dengan error *ZipArchive not found*. | Mengaktifkan `extension=zip` pada `C:\php\php.ini` sebelum menginstal package, dan memverifikasinya via `php -m`. |
| 2 | **Berkas Excel berukuran besar memicu *Memory Exhausted*** | Server kehabisan RAM jika file dimuat sekaligus ke memori PHP. | Menggunakan library *streaming reader* (`spatie/simple-excel`) yang membaca baris demi baris secara generator ($< 10\text{ MB}$ RAM). |
| 3 | **Format teks NIS/NIP kehilangan angka nol di depan (*leading zero*)** | NIP `08123...` terbaca sebagai integer `8123...` sehingga gagal mencocokkan kredensial. | Memaksa konversi tipe data kolom NIP/NIS ke `(string)` dan memberikan instruksi format *Text* pada template Excel. |
| 4 | **Inkonsistensi penamaan rombel kelas** | Regex gagal mendeteksi tingkat jika nama kelas tidak lazim (misal: `Sepuluh RPL 1`). | Menetapkan standar penamaan pada template (`X`, `XI`, `XII`) dan fallback regex cerdas (`level = 10` jika format tidak terdeteksi). |
| 5 | **Integritas data parsial akibat kegagalan baris di tengah file** | Separuh data masuk ke database, separuh gagal, menyebabkan data inkonsisten. | Menerapkan `DB::transaction()` menyeluruh (*all-or-nothing*); jika ada 1 baris yang gagal validasi, seluruh transaksi di-rollback. |

---

## 7. Kriteria Penyelesaian Akhir (*Definition of Done*)

Proyek dinyatakan selesai dan siap (*production ready*) apabila memenuhi parameter berikut:
1. [ ] Endpoint `GET /api/teachers/import-template` dan `GET /api/students/import-template` dapat diunduh langsung sebagai file spreadsheet `.xlsx`.
2. [ ] Endpoint `POST /api/teachers/import` berhasil mendaftarkan akun guru massal dengan password default hash NIP dan `fet_staff_id`.
3. [ ] Endpoint `POST /api/students/import` berhasil mendaftarkan kelas otomatis, akun siswa (hash NIS), dan akun orang tua (`P-{nis}`).
4. [ ] Waka Kurikulum dapat mengunggah berkas PDF jadwal FET (`POST /api/schedule-imports`) **hanya dengan syarat minimal data siswa dan guru telah diimpor**, tanpa penolakan 422 akibat ketiadaan ruangan atau mapel.
5. [ ] Worker antrean `ParseSchedulePdfJob` berhasil mendaftarkan seluruh ruangan fisik (kapasitas 36) dan mata pelajaran unik dari berkas PDF secara otomatis.
6. [ ] Seluruh skenario pengujian baru (`TeacherImportTest`, `StudentImportTest`) lulus 100%.
7. [ ] Full test suite (`php artisan test`) mengonfirmasi **Zero Regression** (seluruh 199+ automated test eksisting tetap berstatus Passed).
