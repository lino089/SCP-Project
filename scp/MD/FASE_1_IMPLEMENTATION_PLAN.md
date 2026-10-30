# Rencana Implementasi Terperinci: Fase 1 — Modul Impor Guru & Fondasi Dependensi Spreadsheet

**Dokumen Rencana:** `MD/FASE_1_IMPLEMENTATION_PLAN.md`  
**Proyek:** School Class Progress (SCP) — Backend REST API  
**Versi Target:** SCP v4.5 (Fase 1)  
**Dokumen Acuan:** `MD/NewFeature.md` (Tahap 1), `MD/NEW_FEATURE_IMPLEMENTATION_PLAN.md` (Fase 1 & Fase 3), `MD/PRD.md` (v4.4), `MD/Development.md`  
**Status Dokumen:** Usulan Rencana Detail (Menunggu Persetujuan Pengguna Sebelum Eksekusi)  

---

## DAFTAR ISI
1. [Ringkasan & Tujuan Fase 1](#1-ringkasan--tujuan-fase-1)
2. [Ruang Lingkup Pekerjaan (In-Scope & Out-of-Scope)](#2-ruang-lingkup-pekerjaan-in-scope--out-of-scope)
3. [Analisis Kebutuhan & Kondisi Sistem Saat Ini](#3-analisis-kebutuhan--kondisi-sistem-saat-ini)
   - 3.1 Kondisi Runtime, Framework & Dependensi
   - 3.2 Kondisi Routing & Controller Guru Saat Ini
   - 3.3 Kondisi Model & Basis Data Guru Saat Ini
   - 3.4 Kesenjangan Teknis yang Perlu Diselesaikan
4. [Rencana Pengerjaan & Urutan Tahapan Implementasi](#4-rencana-pengerjaan--urutan-tahapan-implementasi)
   - Bagian A: Pondasi Lingkungan & Dependensi Pustaka Spreadsheet
   - Bagian B: Registrasi Rute API Baru
   - Bagian C: Generator Template Excel Guru (`downloadTemplate`)
   - Bagian D: Engine Impor Guru & Validasi Streaming (`import`)
   - Bagian E: Penyusunan Automated Feature Test Suite
5. [Detail Teknis & Arsitektur Komponen Terdampak](#5-detail-teknis--arsitektur-komponen-terdampak)
   - 5.1 Penanganan Tipe Data & Preservasi *Leading Zero* pada NIP
   - 5.2 Strategi Transaksi Basis Data Atomik (*All-or-Nothing*)
   - 5.3 Spesifikasi Kontrak Request & Response JSON Standar
   - 5.4 Matriks Berkas yang Dibuat / Dimodifikasi
6. [Target Hasil Akhir & Kriteria Keberhasilan (*Acceptance Criteria*)](#6-target-hasil-akhir--kriteria-keberhasilan-acceptance-criteria)
7. [Rencana Pengujian Komprehensif (Positive & Negative Test Cases)](#7-rencana-pengujian-komprehensif-positive--negative-test-cases)
   - 7.1 Matriks Skenario Pengujian Otomatis
   - 7.2 Skenario Pengujian Kasus Gagal (*Negative Cases*)
   - 7.3 Jaminan *Zero-Regression* terhadap Fitur Eksisting
8. [Analisis Risiko, Kendala Teknis & Strategi Mitigasi](#8-analisis-risiko-kendala-teknis--strategi-mitigasi)
9. [Hal yang Perlu Dikonfirmasi Sebelum Eksekusi](#9-hal-yang-perlu-dikonfirmasi-sebelum-eksekusi)

---

## 1. Ringkasan & Tujuan Fase 1

Fase 1 berfokus pada pembangunan **Fondasi Pustaka Spreadsheet Hemat Memori** dan **Modul Impor Guru Massal (Auto-Provisioning Master Guru & `fet_staff_id`)** sesuai spesifikasi `MD/NewFeature.md` Bagian 2.1, Bagian 3, dan Bagian 5.

### Tujuan Utama Fase 1:
1. **Pondasi Pustaka Streaming**: Memasang dan mengonfigurasi pustaka `spatie/simple-excel:^3.0` pada arsitektur Laravel 13 / PHP 8.4, memastikan pemrosesan berkas Excel dilakukan secara *streaming generator* dengan pemakaian memori rendah ($< 10\text{ MB}$ RAM).
2. **Template Download Resmi**: Menyediakan endpoint bagi Waka Kurikulum untuk mengunduh template spreadsheet resmi guru (`guru_import_template.xlsx`) lengkap dengan contoh data yang valid.
3. **Endpoint Impor Guru**: Menyediakan endpoint multipart bagi Waka Kurikulum untuk mengunggah berkas Excel data guru (`POST /api/teachers/import`).
4. **Validasi Menyeluruh & Deteksi Anomali**: Melakukan validasi format berkas (.xlsx, $\le 5\text{ MB}$), validasi kelengkapan header, validasi tipe data per baris, serta deteksi duplikasi internal lembar kerja (*in-sheet duplicates*) maupun duplikasi terhadap basis data PostgreSQL/SQLite.
5. **Auto-Provisioning Akun Guru**: Membentuk record pengguna (`users`) secara atomik dengan peran `teacher`, username berupa NIP, password ter-hash berupa NIP, atribut `fet_staff_id` terisi, dan flag `must_change_password = true`.
6. **Integritas Transaksi Atomik**: Memastikan seluruh baris diproses dalam satu transaksi `DB::transaction()`. Apabila terdapat satu baris yang cacat, seluruh operasi dibatalkan (*rollback*) dan mengembalikan struktur JSON error terperinci per nomor baris.
7. **Verifikasi Kualitas**: Menghadirkan test suite otomatis `TeacherImportTest.php` yang memverifikasi seluruh skenario pengujian dengan status 100% lulus.

---

## 2. Ruang Lingkup Pekerjaan (In-Scope & Out-of-Scope)

### A. Pekerjaan di Dalam Lingkup (In-Scope):
- Konfigurasi modul PHP `ext-zip` pada lingkungan runtime server.
- Instalasi dependensi `spatie/simple-excel:^3.0` pada `composer.json` dan pembaharuan `composer.lock`.
- Pendaftaran 2 rute API baru pada `routes/api.php` di bawah middleware `['auth:sanctum', 'throttle:api', 'role:vice_principal']`:
  - `GET /api/teachers/import-template`
  - `POST /api/teachers/import`
- Implementasi method `downloadTemplate()` pada `app/Http/Controllers/API/TeacherController.php`.
- Implementasi method `import(Request $request)` pada `app/Http/Controllers/API/TeacherController.php`.
- Penanganan konversi tipe data NIP untuk menjaga keutuhan karakter nol di depan (*leading zeros*).
- Penanganan validasi struktur JSON error standar PRD v4.4:
  `{ success: false, message: "Validasi berkas gagal pada beberapa baris.", errors: [{ row: X, attribute: "nip", message: "..." }] }`.
- Pembuatan automated feature test suite `tests/Feature/TeacherImportTest.php`.
- Verifikasi regresi penuh terhadap 199 automated test eksisting via `php artisan test`.

### B. Pekerjaan di Luar Lingkup (Out-of-Scope / Dikerjakan pada Fase Selanjutnya):
- Modul impor siswa, auto-create kelas, dan provisi akun orang tua (dikerjakan pada **Fase 2**).
- Penyelarasan logika evaluasi prasyarat master data pada `MasterDataPrerequisiteService` (dikerjakan pada **Fase 3**).
- Modifikasi pra-registrasi ruangan dan mapel pada antrean worker PDF `ParseSchedulePdfJob` (dikerjakan pada **Fase 4**).
- Modifikasi skrip Python `script/pdf_parser.py`.

---

## 3. Analisis Kebutuhan & Kondisi Sistem Saat Ini

### 3.1 Kondisi Runtime, Framework & Dependensi
- **Versi PHP Aktual**: PHP 8.4.13 (Visual C++ 2022 x64, CLI).
- **Versi Framework**: Laravel 13.17.0 (API-only).
- **Status Ekstensi PHP**:
  - Modul `xml`, `xmlreader`, `xmlwriter`, dan `fileinfo` sudah aktif.
  - Modul `zip` belum aktif secara default di `C:\php\php.ini`, namun file binary `php_zip.dll` sudah terpasang di direktori ekstensi `C:\php\ext\php_zip.dll`.
  - Pustaka `spatie/simple-excel` membutuhkan ekstensi PHP `zip` dan `xml` agar dapat mengekstrak berkas arsip OpenXML (`.xlsx`).
- **Dependensi Composer**:
  - `composer.json` saat ini memuat `intervention/image-laravel`, `laravel/framework`, `laravel/sanctum`, dan `laravel/tinker`. Pustaka `spatie/simple-excel` belum terdaftar.

### 3.2 Kondisi Routing & Controller Guru Saat Ini
- **Controller Guru (`app/Http/Controllers/API/TeacherController.php`)**:
  - Sudah memiliki method:
    - `index()`: Menampilkan daftar guru berpaginasi dengan pencarian (200 OK).
    - `store()`: Pembuatan guru manual satu per satu dengan password random 8 karakter (201 Created).
    - `update()`: Pembaruan data guru (200 OK).
    - `destroy()`: Soft-delete guru dengan proteksi jadwal aktif (409 Conflict).
    - `assignRole()` & `revokeRole()`: Penugasan tambahan kesiswaan dan wali kelas.
  - **Kekurangan**: Belum memiliki method `downloadTemplate()` dan `import()`.
- **Rute API Guru (`routes/api.php`)**:
  - Saat ini rute mutasi guru dikelompokkan di dalam:
    ```php
    Route::middleware('role:vice_principal')->group(function () {
        ...
        Route::post('/teachers', [TeacherController::class, 'store']);
        Route::put('/teachers/{id}', [TeacherController::class, 'update']);
        Route::delete('/teachers/{id}', [TeacherController::class, 'destroy']);
        Route::post('/teachers/{id}/assignments', [TeacherController::class, 'assignRole']);
        Route::delete('/teachers/{id}/assignments/{assignment_id}', [TeacherController::class, 'revokeRole']);
        ...
    });
    ```
  - **Kekurangan**: Rute `GET /teachers/import-template` dan `POST /teachers/import` belum didaftarkan.

### 3.3 Kondisi Model & Basis Data Guru Saat Ini
- **Model `app/Models/User.php`**:
  - Atribut `#[Fillable]` sudah memuat: `'name'`, `'email'`, `'password'`, `'role'`, `'nis_nip'`, `'must_change_password'`, `'fet_staff_id'`, `'phone_number'`.
  - Atribut `#[Hidden]` sudah menyembunyikan `'password'` dan `'remember_token'`.
  - Method `casts()` sudah meng-cast `'password' => 'hashed'` dan `'must_change_password' => 'boolean'`.
- **Tabel Basis Data `users`**:
  - Kolom `nis_nip` bertipe string dan memiliki indeks `UNIQUE`.
  - Kolom `fet_staff_id` bertipe string nullable dan memiliki indeks `UNIQUE`.
  - Kolom `role` berupa ENUM (`vice_principal`, `teacher`, `student`, `parent`).
  - Kolom `deleted_at` mendukung *soft-delete*.
- **Kesimpulan Skema**: Struktur model dan tabel `users` **sudah 100% siap** untuk menerima provisi akun guru dari berkas Excel tanpa memerlukan penambahan migrasi basis data baru pada Fase 1.

### 3.4 Kesenjangan Teknis yang Perlu Diselesaikan
1. Pustaka `spatie/simple-excel` belum terinstal dan ekstensi `zip` belum diaktifkan di `php.ini`.
2. Controller `TeacherController` belum memiliki kemampuan membaca stream baris Excel, memvalidasi integritas baris, dan membuat akun massal secara atomik.
3. Belum ada format standar template Excel guru (`guru_import_template.xlsx`) yang dapat diunduh langsung dari server.
4. Belum ada test suite otomatis untuk memverifikasi fungsionalitas impor guru dan respons error yang dihasilkan.

---

## 4. Rencana Pengerjaan & Urutan Tahapan Implementasi

Pelaksanaan Fase 1 dipecah ke dalam 5 langkah berurutan (*step-by-step*):

```
[Langkah 1: Lingkungan & Dependensi]
   └── Aktifkan extension=zip di C:\php\php.ini
   └── Tambahkan spatie/simple-excel:^3.0 di composer.json & update
   └── Verifikasi keberadaan autoloader SimpleExcel
            │
[Langkah 2: Registrasi Rute API]
   └── Tambahkan GET /teachers/import-template pada routes/api.php
   └── Tambahkan POST /teachers/import pada routes/api.php
            │
[Langkah 3: Generator Template Excel]
   └── Implementasikan TeacherController::downloadTemplate()
   └── Hasilkan file guru_import_template.xlsx dengan header & data contoh
            │
[Langkah 4: Engine Impor & Validasi Streaming]
   └── Implementasikan TeacherController::import(Request $request)
   └── Validasi multipart file (.xlsx, <= 5MB)
   └── Streaming parser via SimpleExcelReader
   └── Deteksi duplikasi lembar kerja & database
   └── DB::transaction All-or-Nothing -> User::create (role: teacher, pass: hash NIP)
   └── Response standar 201 Created / 422 Unprocessable Entity
            │
[Langkah 5: Automated Feature Testing & Verifikasi Regresi]
   └── Buat tests/Feature/TeacherImportTest.php
   └── Jalankan test suite terisolasi (positif, negatif, otorisasi)
   └── Jalankan php artisan test penuh untuk verifikasi zero-regression
```

---

### Bagian A: Pondasi Lingkungan & Dependensi Pustaka Spreadsheet
1. **Aktivasi Ekstensi PHP**:
   - Membuka file konfigurasi `C:\php\php.ini`.
   - Mengaktifkan baris `extension=zip` (menghapus tanda titik koma `;` jika berstatus komentar).
   - Memverifikasi keberhasilan aktivasi melalui perintah terminal:
     ```bash
     php -m | findstr -i zip
     ```
     *(Output yang diharapkan: `zip`)*.
2. **Instalasi Pustaka Composer**:
   - Memperbarui `composer.json` pada bagian `require`:
     ```json
     "require": {
         "php": "^8.3",
         "intervention/image-laravel": "^4.1",
         "laravel/framework": "^13.17",
         "laravel/sanctum": "^4.0",
         "laravel/tinker": "^3.0",
         "spatie/simple-excel": "^3.0"
     }
     ```
   - Mengeksekusi instalasi dependensi tanpa menjalankan script yang berisiko:
     ```bash
     composer update spatie/simple-excel --no-scripts
     ```
3. **Verifikasi Autoloader**:
   - Menjalankan uji pemuatan class via tinker:
     ```bash
     php artisan tinker --execute="var_dump(class_exists('Spatie\SimpleExcel\SimpleExcelReader'));"
     ```
     *(Output yang diharapkan: `bool(true)`)*.

---

### Bagian B: Registrasi Rute API Baru
1. **Modifikasi `routes/api.php`**:
   - Menambahkan 2 rute di dalam grup middleware `['auth:sanctum', 'throttle:api', 'role:vice_principal']`:
     ```php
     // Impor Guru & Unduh Template (Fase 1)
     Route::get('/teachers/import-template', [TeacherController::class, 'downloadTemplate']);
     Route::post('/teachers/import', [TeacherController::class, 'import']);
     ```
   - **Posisi Rute**: Diletakkan secara teratur berdampingan dengan blok master data teachers (`/teachers`, `/teachers/{id}`).
   - **Otorisasi**: Mewajibkan token Sanctum aktif, dibatasi rate limiting 60 req/menit, dan hanya dapat diakses oleh akun ber-role `vice_principal` (Waka Kurikulum).

---

### Bagian C: Generator Template Excel Guru (`downloadTemplate`)
1. **Tujuan**:
   Menyediakan berkas spreadsheet `.xlsx` yang terstandarisasi agar Waka Kurikulum dapat mengisi data guru tanpa kesalahan nama header.
2. **Implementasi pada `TeacherController.php`**:
   ```php
   use Spatie\SimpleExcel\SimpleExcelWriter;
   use Symfony\Component\HttpFoundation\StreamedResponse;

   public function downloadTemplate(): StreamedResponse
   {
       return response()->stream(function () {
           $writer = SimpleExcelWriter::create('php://output', 'xlsx');
           
           // Header & Contoh Baris
           $writer->addRows([
               [
                   'nip' => '198001012010011002',
                   'name' => 'Budi Santoso, S.Pd.',
                   'fet_staff_id' => '1',
                   'email' => 'budi.santoso@sekolah.sch.id',
                   'phone_number' => '081234567890',
               ],
               [
                   'nip' => '198502022015022003',
                   'name' => 'Dewi Lestari, M.Pd.',
                   'fet_staff_id' => '14',
                   'email' => 'dewi.lestari@sekolah.sch.id',
                   'phone_number' => '082345678901',
               ],
           ]);
           
           $writer->close();
       }, 200, [
           'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           'Content-Disposition' => 'attachment; filename="guru_import_template.xlsx"',
           'Cache-Control' => 'no-cache, private',
       ]);
   }
   ```
3. **Karakteristik Output**:
   - Tipe respons: `StreamedResponse` (mengalir langsung ke output browser tanpa membuat file sampah sementara di disk server).
   - Ekstensi: `.xlsx`.
   - Nama file unduhan: `guru_import_template.xlsx`.

---

### Bagian D: Engine Impor Guru & Validasi Streaming (`import`)
1. **Alur Kerja Pemrosesan Berkas**:
   - **Validasi Berkas HTTP**:
     ```php
     $request->validate([
         'file' => [
             'required',
             'file',
             'mimes:xlsx',
             'max:5120', // Maksimal 5 MB
         ],
     ], [
         'file.required' => 'Berkas Excel guru wajib diunggah.',
         'file.mimes' => 'Berkas harus berupa spreadsheet dengan ekstensi .xlsx.',
         'file.max' => 'Ukuran berkas tidak boleh melebihi 5 MB.',
     ]);
     ```
   - **Inisialisasi Streaming Reader**:
     Menggunakan `SimpleExcelReader::create($uploadedFile->getRealPath())->trimHeaderRow()`.
   - **Pemeriksaan Header Berkas**:
     Memastikan kolom wajib `nip`, `name`, dan `fet_staff_id` terdapat pada baris header lembar kerja. Jika salah satu kolom kunci hilang, kembalikan respons 422:
     ```json
     {
         "success": false,
         "message": "Format berkas tidak valid. Kolom header 'nip', 'name', dan 'fet_staff_id' wajib tersedia.",
         "errors": null
     }
     ```
   - **Iterasi Validasi & Pengumpulan Data**:
     Melakukan pembacaan baris demi baris menggunakan penomoran baris realita Excel (dimulai dari baris ke-2 setelah header):
     - Memeriksa kelengkapan nilai `nip` (wajib diisi, string teks).
     - Memeriksa kelengkapan nilai `name` (wajib diisi, string maks 100 karakter).
     - Memeriksa kelengkapan nilai `fet_staff_id` (wajib diisi, string/integer).
     - Memeriksa format `email` jika diisi (harus valid format email).
     - **Pemeriksaan Duplikasi Lembar Kerja (*In-Sheet Duplicates*)**:
       Menyimpan NIP dan `fet_staff_id` yang sudah dibaca pada array pelacak memori. Jika ditemukan NIP atau `fet_staff_id` berulang di baris berbeda, catat sebagai error baris terkait.
     - **Pemeriksaan Duplikasi Basis Data (*Database Collision Check*)**:
       Memeriksa keberadaan NIP pada `User::where('nis_nip', $nip)->whereNull('deleted_at')->exists()` dan `fet_staff_id` pada `User::where('fet_staff_id', $fetId)->whereNull('deleted_at')->exists()`.
   - **Eksekusi Transaksi Basis Data Atomik (`DB::transaction`)**:
     - Jika array `$errors` tidak kosong:
       Batalkan proses penyimpanan, kembalikan HTTP 422:
       ```json
       {
           "success": false,
           "message": "Validasi berkas gagal pada beberapa baris.",
           "errors": [
               { "row": 3, "attribute": "nip", "message": "NIP 198001012010011002 sudah terdaftar di sistem." },
               { "row": 5, "attribute": "fet_staff_id", "message": "ID staf FET '14' duplikat di dalam berkas ini." }
           ]
       }
       ```
     - Jika seluruh baris valid:
       Mengeksekusi pembuatan record pengguna massal:
       ```php
       foreach ($validRows as $row) {
           User::create([
               'name' => trim((string) $row['name']),
               'role' => 'teacher',
               'nis_nip' => trim((string) $row['nip']),
               'password' => Hash::make(trim((string) $row['nip'])), // Password default = Hash NIP
               'fet_staff_id' => trim((string) $row['fet_staff_id']),
               'email' => !empty($row['email']) ? trim((string) $row['email']) : null,
               'phone_number' => !empty($row['phone_number']) ? trim((string) $row['phone_number']) : null,
               'must_change_password' => true,
           ]);
       }
       ```
   - **Format Respons Sukses (HTTP 201 Created)**:
     ```json
     {
         "success": true,
         "message": "Data guru berhasil diimpor.",
         "data": {
             "imported_count": 25
         }
     }
     ```

---

### Bagian E: Penyusunan Automated Feature Test Suite
Menghadirkan file pengujian berdedikasi `tests/Feature/TeacherImportTest.php` yang mencakup 8 skenario pengujian unit & integrasi untuk memverifikasi fungsionalitas secara otomatis.

---

## 5. Detail Teknis & Arsitektur Komponen Terdampak

### 5.1 Penanganan Tipe Data & Preservasi *Leading Zero* pada NIP
- **Tantangan Teknis**: Excel sering mengonversi NIP berawalan angka `0` (misal guru honorer atau NIP berformat tertentu) menjadi nilai numerik integer sehingga angka `0` di depan terpotong.
- **Solusi Arsitektur**:
  1. Pada generator template, kolom `nip` diberi instruksi format *Text*.
  2. Pada engine pembacaan, nilai NIP dipaksa menggunakan typecasting `(string) $rawNip` dan fungsi pembersihan `trim()`.

### 5.2 Strategi Transaksi Basis Data Atomik (*All-or-Nothing*)
- Seluruh baris diverifikasi terlebih dahulu sebelum ada satu pun record yang ditulis ke basis data.
- Jika dari 100 baris terdapat 1 baris yang bermasalah (misalnya `fet_staff_id` kosong pada baris 78), sistem **tidak akan menyimpan 99 baris lainnya**.
- Pendekatan ini menjamin integritas data tetap bersih (*clean slate*) dan memudahkan pengguna memperbaiki file Excel tanpa pusing memisahkan data mana yang sudah masuk dan mana yang belum.

### 5.3 Spesifikasi Kontrak Request & Response JSON Standar

#### A. Endpoint `GET /api/teachers/import-template`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer {token_waka}`
- **Expected Status**: `200 OK`
- **Content-Type**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Content-Disposition**: `attachment; filename="guru_import_template.xlsx"`

#### B. Endpoint `POST /api/teachers/import`
- **Method**: `POST`
- **Headers**:
  - `Authorization: Bearer {token_waka}`
  - `Content-Type: multipart/form-data`
  - `Accept: application/json`
- **Body**: `file` (Binary File `.xlsx`, maks 5 MB)
- **Response Sukses (HTTP 201 Created)**:
  ```json
  {
      "success": true,
      "message": "Data guru berhasil diimpor.",
      "data": {
          "imported_count": 15
      }
  }
  ```
- **Response Error Validasi Baris (HTTP 422 Unprocessable Entity)**:
  ```json
  {
      "success": false,
      "message": "Validasi berkas gagal pada beberapa baris.",
      "errors": [
          {
              "row": 2,
              "attribute": "fet_staff_id",
              "message": "Kolom fet_staff_id wajib diisi."
          },
          {
              "row": 4,
              "attribute": "nip",
              "message": "NIP 198001012010011002 sudah terdaftar di sistem."
          }
      ]
  }
  ```
- **Response Error Format Berkas (HTTP 422 Unprocessable Entity)**:
  ```json
  {
      "success": false,
      "message": "Berkas harus berupa spreadsheet dengan ekstensi .xlsx.",
      "errors": {
          "file": [
              "Berkas harus berupa spreadsheet dengan ekstensi .xlsx."
          ]
      }
  }
  ```

### 5.4 Matriks Berkas yang Dibuat / Dimodifikasi

| No | File Path | Status | Deskripsi Perubahan / Peran Teknis |
|:--:|---|:---:|---|
| 1 | `C:\php\php.ini` | Konfigurasi | Mengaktifkan baris `extension=zip` untuk membaca file `.xlsx`. |
| 2 | `composer.json` & `composer.lock` | Diubah | Mendaftarkan paket pustaka `spatie/simple-excel:^3.0`. |
| 3 | `routes/api.php` | Diubah | Mendaftarkan rute `GET /teachers/import-template` dan `POST /teachers/import` di bawah grup Waka. |
| 4 | `app/Http/Controllers/API/TeacherController.php` | Diubah | Menambahkan method `downloadTemplate()` dan `import(Request $request)`. |
| 5 | `tests/Feature/TeacherImportTest.php` | Dibuat | Berkas pengujian otomatis fitur download template dan import guru. |

---

## 6. Target Hasil Akhir & Kriteria Keberhasilan (*Acceptance Criteria*)

Fase 1 dinyatakan berhasil dan selesai secara sempurna apabila memenuhi seluruh kriteria kelulusan berikut:

1. [ ] **Kesiapan Ekstensi & Library**: Pustaka `spatie/simple-excel` terinstal pada `vendor/` dan autoloader mengenali class `SimpleExcelReader` dan `SimpleExcelWriter` tanpa error.
2. [ ] **Hak Akses & Otorisasi API**:
   - Pengguna anonim (tanpa token) menerima respons **HTTP 401 Unauthorized**.
   - Pengguna dengan peran selain Waka Kurikulum (Guru, Siswa, Orang Tua) menerima respons **HTTP 403 Forbidden**.
   - Waka Kurikulum dengan token sah dapat mengakses kedua endpoint dengan lancar.
3. [ ] **Template Spreadsheet**: Endpoint `GET /api/teachers/import-template` menghasilkan unduhan berkas valid `guru_import_template.xlsx` dengan header: `nip`, `name`, `fet_staff_id`, `email`, dan `phone_number`.
4. [ ] **Validasi Berkas Input**:
   - Permintaan tanpa file atau dengan file selain `.xlsx` (misal `.csv`, `.pdf`, `.png`) ditolak dengan **HTTP 422**.
   - Berkas dengan ukuran $> 5\text{ MB}$ ditolak dengan **HTTP 422**.
   - Berkas dengan header yang tidak sesuai kontrak ditolak dengan **HTTP 422**.
5. [ ] **Integritas Baris & Auto-Provisioning**:
   - Setiap baris valid berhasil membuat entitas pengguna pada tabel `users`.
   - Atribut akun tersimpan presisi: `role = teacher`, `nis_nip = NIP`, `fet_staff_id = ID FET`, `must_change_password = true`.
   - Password terenkripsi secara aman dengan algoritma bcrypt/Argon2 (`Hash::check($nip, $user->password) === true`).
6. [ ] **Pencegahan Duplikasi & Atomisitas**:
   - Duplikasi NIP atau `fet_staff_id` dalam file yang sama langsung menggagalkan proses dengan respons **HTTP 422**.
   - Tabrakan NIP atau `fet_staff_id` dengan akun yang sudah ada di basis data membatalkan seluruh transaksi (**0 baris tersimpan ke database**).
7. [ ] **Kualitas Kode & Pengujian**:
   - Berkas pengujian `tests/Feature/TeacherImportTest.php` lulus 100% (8 skenario passed).
   - Eksekusi test suite menyeluruh (`php artisan test`) mengonfirmasi **Zero Regression** (seluruh 199 pengujian eksisting tetap lulus hijau).

---

## 7. Rencana Pengujian Komprehensif (Positive & Negative Test Cases)

### 7.1 Matriks Skenario Pengujian Otomatis (`TeacherImportTest.php`)

| # | Nama Uji Skenario | Kategori | Ekspektasi Hasil |
|---|---|:---:|---|
| 1 | `test_guest_cannot_download_teacher_template_or_import` | Keamanan (401) | HTTP 401 Unauthorized `{ message: "Anda belum login..." }`. |
| 2 | `test_non_waka_cannot_download_teacher_template_or_import` | Otorisasi (403) | Akses oleh Guru / Siswa menghasilkan HTTP 403 Forbidden. |
| 3 | `test_waka_can_download_teacher_import_template` | Fungsional (200) | HTTP 200 OK, Content-Type `.sheet`, attachment `guru_import_template.xlsx`. |
| 4 | `test_waka_can_import_valid_teachers_excel` | Fungsional (201) | HTTP 201 Created, `imported_count: 3`, data akun guru tersimpan di tabel `users` dengan password hash NIP. |
| 5 | `test_import_fails_when_file_is_missing_or_invalid_extension` | Validasi (422) | Upload berkas `.pdf` atau `.txt` ditolak dengan HTTP 422. |
| 6 | `test_import_fails_when_header_is_invalid` | Validasi (422) | Berkas tanpa kolom `fet_staff_id` atau `nip` ditolak dengan HTTP 422. |
| 7 | `test_import_fails_and_rollbacks_on_in_sheet_duplicate_nip_or_fet_staff_id` | Integritas (422) | NIP ganda dalam file membatalkan seluruh transaksi, tabel `users` tetap bersih. |
| 8 | `test_import_fails_and_rollbacks_on_database_nip_collision` | Integritas (422) | NIP yang sudah ada di database memicu HTTP 422, data baru tidak ada yang tersimpan. |

### 7.2 Skenario Pengujian Kasus Gagal (*Negative Cases*)
1. **File Kosong (0 Bytes)**: Upload file `.xlsx` kosong tanpa baris data apa pun ➔ Ditolak dengan status HTTP 422 *"Berkas Excel tidak memuat data guru."*.
2. **Nilai Wajib Kosong**: Baris tertentu memiliki nama guru tetapi kolom NIP kosong ➔ Ditolak dengan status HTTP 422 dan penunjuk `{ row: X, attribute: "nip", message: "Kolom NIP wajib diisi." }`.
3. **Format Email Rusak**: Baris tertentu memuat string email yang tidak valid (misal: `budi-at-sekolah`) ➔ Ditolak dengan status HTTP 422 dan penunjuk baris terkait.
4. **Ukuran Melebihi Kuota**: Upload berkas sebesar 6 MB ➔ Ditolak pada layer validasi Laravel sebelum parsing dijalankan.

### 7.3 Jaminan *Zero-Regression* terhadap Fitur Eksisting
Untuk memastikan penambahan dependensi `spatie/simple-excel` dan perubahan pada `TeacherController` serta `routes/api.php` tidak merusak fungsi yang sudah ada:
1. Endpoint CRUD guru eksisting (`GET /api/teachers`, `POST /api/teachers`, `PUT /api/teachers/{id}`, `DELETE /api/teachers/{id}`) tetap diuji via `tests/Feature/TeacherManagementTest.php`.
2. Seluruh rangkaian test suite (`php artisan test`) dijalankan sebelum dan sesudah Fase 1.
3. Kriteria batas keberhasilan: Total tes bertambah dari **199 tests ➔ 207 tests** dengan status **0 failed, 0 errors**.

---

## 8. Analisis Risiko, Kendala Teknis & Strategi Mitigasi

| No | Risiko / Kendala Teknis | Dampak | Rencana Mitigasi Terukur |
|:--:|---|---|---|
| 1 | **Ekstensi `zip` PHP tidak aktif pada sistem lokal** | Instalasi Composer atau eksekusi pembacaan file `.xlsx` gagal dengan error `Class ZipArchive not found`. | Melakukan verifikasi dan aktivasi `extension=zip` pada `C:\php\php.ini` pada Langkah 1 sebelum menjalankan instalasi Composer. |
| 2 | **Format NIP kehilangan angka 0 di depan (*leading zero*)** | NIP `08123...` terbaca sebagai integer `8123...` oleh spreadsheet reader. | Pada generator template, kolom NIP diberi format teks. Pada controller, setiap baris diproses menggunakan typecasting eksplisit `(string) $row['nip']`. |
| 3 | **Penggunaan memori membengkak pada file besar** | Server kehabisan RAM jika file dimuat sekaligus ke memori PHP (*memory limit exceeded*). | Menggunakan `SimpleExcelReader` yang memproses data berbasis *generator stream* baris demi baris, menjaga footprint RAM tetap $< 10\text{ MB}$. |
| 4 | **Penyimpanan parsial saat terjadi kegagalan di tengah file** | Sebagian guru tersimpan, sebagian tidak, menyebabkan data gantung dan integritas rusak. | Membungkus seluruh operasi ke dalam blok `DB::transaction()`. Pengumpulan error dilakukan secara komprehensif sebelum eksekusi insert pertama dijalankan. |

---

## 9. Hal yang Perlu Dikonfirmasi Sebelum Eksekusi

Sebelum melangkah ke eksekusi kode, berikut adalah 2 catatan konfirmasi teknis:
1. **Konvensi Password Awal Guru**:
   - Pada `NewFeature.md` Bagian 3 ditetapkan: *Password default guru = Hash NIP* (misal: jika NIP `198001012010011002`, password awal adalah `198001012010011002`), dengan `must_change_password = true`.
   - Pendekatan ini sangat memudahkan Waka membagikan akun guru secara massal dibanding password acak 8 karakter pada form manual. Konvensi ini akan diterapkan secara konsisten.
2. **Kesiapan Modifikasi `php.ini`**:
   - Karena ekstensi `zip` dibutuhkan untuk paket spreadsheet, kita akan memastikan baris `extension=zip` di `C:\php\php.ini` diaktifkan saat memulai implementasi Fase 1.

---

*Rencana ini disusun secara komprehensif untuk menjadi panduan kerja langkah-demi-langkah pada pelaksanaan Fase 1. Tidak ada implementasi kode yang dijalankan sebelum rencana ini ditinjau dan disetujui.*
