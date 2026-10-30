# Spesifikasi Arsitektur: Zero-Manual Master Data & Integrated Schedule Ingestion (SCP v4.5)

## 1. Pendahuluan & Prinsip Desain

### 1.1 Latar Belakang & Kebijakan Prasyarat Baru
Pada implementasi awal (SCP v4.4), proses pembuatan dan pengunggahan jadwal menuntut Waka Kurikulum untuk melengkapi seluruh entitas Master Data sekolah (Kelas, Guru, Ruangan, dan Mata Pelajaran) secara manual satu per satu. Pendekatan ini menimbulkan hambatan administratif yang tinggi sebelum Waka dapat memanfaatkan fitur import jadwal dari FET.

Pada arsitektur v4.5, sistem menerapkan kebijakan penyederhanaan radikal:
> **"Master data yang wajib tersedia sebelum proses import jadwal hanyalah Data Siswa dan Data Guru (beserta nomor staf FET). Seluruh master data lainnya (Kelas, Ruangan, dan Mata Pelajaran) TIDAK LAGI disyaratkan sebagai prasyarat di gerbang awal import jadwal."**

Melalui pendekatan ini, Waka cukup menginisialisasi data manusia (Guru dan Siswa via Excel), sedangkan seluruh master data fisik dan kurikulum (Kelas, Ruangan, dan Mata Pelajaran) akan dibentuk, dilengkapi, atau di-resolve secara otomatis oleh sistem saat berkas diproses.

---

### 1.2 Prinsip Desain (*The 4-Files Ingestion Paradigm*)
Sistem mengadopsi integrasi 4 berkas sumber masukan terstruktur:
1. **1 Berkas Excel Guru (`.xlsx`)**: Master guru, provisi akun, dan pemetaan `fet_staff_id`.
2. **1 Berkas Excel Siswa (`.xlsx`)**: Master siswa, akun orang tua, dan pembentukan otomatis master kelas.
3. **1 Berkas PDF Ruangan (`Jadwal_Ruangan.pdf`)**: Ekstraksi dan registrasi otomatis denah fisik seluruh ruangan aktif dari FET.
4. **1 Berkas PDF Kelas (`Jadwal_Kelas.pdf`)**: Ekstraksi dan registrasi otomatis nama mata pelajaran serta komit jadwal KBM per kelas.

```
[4 Berkas Sumber Masukan Waka]
   ├── 1. File Excel Guru (.xlsx)   ──> Auto-Provisioning User Guru & fet_staff_id (PRASYARAT WAJIB 1)
   ├── 2. File Excel Siswa (.xlsx)  ──> Auto-Provisioning Siswa & Ortu, Auto-Create Kelas (PRASYARAT WAJIB 2)
   ├── 3. Jadwal_Ruangan.pdf (FET) ──> Auto-Create Master Ruangan (Default Kapasitas 36) [TIDAK DISYARATKAN DI AWAL]
   └── 4. Jadwal_Kelas.pdf (FET)   ──> Auto-Create Master Mapel & Komit Jadwal KBM [TIDAK DISYARATKAN DI AWAL]
```

---

## 2. Kontrak Berkas & Spesifikasi Template Input

### 2.1 File Excel Guru (`guru_import_template.xlsx`)
* **Engine Parser**: Diproses langsung di Laravel menggunakan *streaming reader* (`spatie/simple-excel`) untuk menjaga efisiensi RAM server ($< 10\text{ MB}$).
* **Format Kolom**:

| Kolom Header | Tipe Data | Wajib / Opsional | Deskripsi & Validasi |
| :--- | :--- | :--- | :--- |
| `nip` | String | **Wajib** | Nomor Induk Pegawai. Wajib format *Text* untuk menjaga *leading zero*. Unik di tabel `users`. |
| `name` | String | **Wajib** | Nama lengkap guru beserta gelar akademik. |
| `fet_staff_id` | Integer / String | **Wajib** | ID numerik staf pada FET (misal: `1`, `14`, `32`) untuk pencocokan jadwal KBM. |
| `email` | String | Opsional | Email aktif guru. Diperbarui otomatis jika diisi. |
| `phone_number` | String | Opsional | Nomor telepon/WhatsApp aktif untuk verifikasi OTP dan notifikasi. |

---

### 2.2 File Excel Siswa (`siswa_import_template.xlsx`)
* **Engine Parser**: Diproses langsung di Laravel menggunakan pustaka stream spreadsheet yang sama (`spatie/simple-excel`).
* **Format Kolom**:

| Kolom Header | Tipe Data | Wajib / Opsional | Deskripsi & Validasi |
| :--- | :--- | :--- | :--- |
| `nis` | String | **Wajib** | Nomor Induk Siswa. Kunci unik akun siswa dan dasar password default. |
| `name` | String | **Wajib** | Nama lengkap siswa. |
| `class_name` | String | **Wajib** | Nama rombel (misal: `X RPL 1`, `XI TKJ 2`, `XII AK 3`). Menjadi sumber *auto-create* master kelas. |
| `gender` | Enum (`L`/`P`) | **Wajib** | Jenis kelamin siswa (`L` = Laki-laki, `P` = Perempuan). Divalidasi formatnya. |
| `nisn` | String | Opsional | Nomor Induk Siswa Nasional (10 digit numerik). |
| `parent_name` | String | Opsional | Nama orang tua / wali murid (default: `"Wali dari {nama_siswa}"`). |
| `parent_phone` | String | Opsional | Nomor kontak orang tua; dasar pembuatan akun orang tua (*role: parent*). |

---

### 2.3 Berkas Ekspor FET 5.44.9
* **`Jadwal_Ruangan.pdf`**: Berkas PDF denah matriks ruangan hasil generate FET. Sumber registrasi master ruangan otomatis.
* **`Jadwal_Kelas.pdf`**: Berkas PDF jadwal KBM per kelas hasil generate FET. Sumber registrasi mata pelajaran otomatis dan pemetaan alokasi jadwal.

---

## 3. Matriks Otomatisasi 5 Pilar Master Data

| Entitas Master | Tabel Target | Sumber Data | Mekanisme Pembuatan Otomatis | Nilai Default / Aturan Khusus |
| :--- | :--- | :--- | :--- | :--- |
| **Guru** | `users` | Excel Guru | `User::create` dalam transaksi database | `role: teacher`, username: `nip`, password: hash `nip`, `fet_staff_id` terisi, `must_change_password: true`. |
| **Siswa** | `users` | Excel Siswa | `User::create` berelasi ke `class_id` | `role: student`, username: `nis`, password: hash `nis`, `is_held_back: false`, `must_change_password: true`. |
| **Kelas** | `classes` | Excel Siswa / PDF Kelas | `Classes::firstOrCreate(['name' => $cleanName])` | `level` ditentukan otomatis melalui ekspresi reguler (`10`, `11`, `12`), `next_class_id: null`. Diinisialisasi dari Excel Siswa, dengan fallback auto-create saat parsing PDF. |
| **Orang Tua** | `users` | Excel Siswa | `User::firstOrCreate` dari `nis` / `parent_phone` | `role: parent`, username: `P-{nis}`, password: hash `nis`, `linked_student_id` terhubung ke siswa, `phone_number` terisi jika ada. |
| **Ruangan** | `rooms` | `Jadwal_Ruangan.pdf` | `Rooms::firstOrCreate(['name' => $code])` | `capacity` diset default **36** (standar rombel SMK). Alias kode ruangan distandarisasi (misal: `LAB 16` $\rightarrow$ `L.16`). Tidak perlu diinput manual sebelum import jadwal. |
| **Mata Pelajaran** | `subjects` | `Jadwal_Kelas.pdf` | `Subject::firstOrCreate(['name' => $subjectName])` | Didaftarkan otomatis sebelum kalkulasi pemetaan baris jadwal KBM. Tidak perlu diinput manual sebelum import jadwal. Nama mapel dapat disunting kemudian via API. |

---

## 4. Pembaruan Aturan Prasyarat Master Data (`MasterDataPrerequisiteService`)

Kebijakan prasyarat master data disederhanakan secara konsisten:
- **Untuk Input Jadwal Manual (`POST /api/schedules`)**: Tetap mewajibkan ketersediaan data pada form input (guru, kelas, ruang, mapel).
- **Untuk Upload Import PDF (`POST /api/schedule-imports`)**: **HANYA mensyaratkan tersedianya Data Siswa dan Data Guru (dengan `fet_staff_id`)**. Seluruh master data lainnya (`classes`, `rooms`, `subjects`) **DILEPAS / TIDAK DISYARATKAN**.

```
[Pemeriksaan Prasyarat Upload Import PDF (POST /api/schedule-imports)]
   ├── 1. Siswa (role: student) >= 1?       ──> WAJIB TERPENUHI (Data Siswa aktif tersedia)
   ├── 2. Guru dengan fet_staff_id >= 1?     ──> WAJIB TERPENUHI (Data Guru aktif & ID FET tersedia)
   ├── 3. classes >= 1?                     ──> DILEPAS / TIDAK DISYARATKAN (Diisi dari Siswa / Auto-create)
   ├── 4. rooms >= 1?                       ──> DILEPAS / TIDAK DISYARATKAN (Diisi otomatis oleh Jadwal_Ruangan.pdf)
   └── 5. subjects >= 1?                    ──> DILEPAS / TIDAK DISYARATKAN (Diisi otomatis oleh Jadwal_Kelas.pdf)

[Pemeriksaan Konfirmasi Jadwal (POST /api/schedule-imports/{id}/confirm)]
   └── matched_count >= 1?                  ──> WAJIB TERPENUHI (Mencegah komit data kosong)
```

### Logika Evaluasi Prasyarat pada Service:
```php
// app/Services/MasterDataPrerequisiteService.php
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

---

## 5. Arsitektur Teknis Backend

### 5.1 Endpoint Baru (`routes/api.php`)
Dikelompokkan di bawah middleware `['auth:sanctum', 'throttle:api', 'role:vice_principal']`:

```php
Route::middleware(['auth:sanctum', 'throttle:api', 'role:vice_principal'])->group(function () {
    // Impor Guru
    Route::get('/teachers/import-template', [TeacherController::class, 'downloadTemplate']);
    Route::post('/teachers/import', [TeacherController::class, 'import']);

    // Impor Siswa & Kelas
    Route::get('/students/import-template', [StudentController::class, 'downloadTemplate']);
    Route::post('/students/import', [StudentController::class, 'import']);
});
```

---

### 5.2 Strategi Transaksi Basis Data (Atomic All-or-Nothing)
Untuk mencegah integritas parsial, impor berkas dieksekusi dalam blok `DB::transaction()`:
1. **Validasi Berkas Awal**: Memeriksa MIME type, ekstensi `.xlsx`, serta ukuran file ($\le 5\text{ MB}$).
2. **Pemeriksaan Duplikasi Lembar Kerja**: Memastikan tidak ada NIP/NIS ganda di dalam file Excel yang sama.
3. **Pemeriksaan Integritas Database**: Memastikan NIP/NIS belum terdaftar pada basis data.
4. **Rollback Otomatis**: Jika terdapat baris yang tidak valid, seluruh transaksi dibatalkan, dan sistem mengembalikan struktur JSON error terpadu:
   ```json
   {
       "success": false,
       "message": "Validasi berkas gagal pada beberapa baris.",
       "errors": [
           { "row": 14, "attribute": "nis", "message": "NIS 212210045 sudah terdaftar." },
           { "row": 22, "attribute": "gender", "message": "Nilai kolom gender harus L atau P." }
       ]
   }
   ```

---

### 5.3 Pembaruan Alur Worker PDF (`ParseSchedulePdfJob.php`)
Saat worker memproses array data jadwal hasil ekstraksi Python `pdf_parser.py`:

1. **Pra-Registrasi Ruangan Otomatis**:
   ```php
   // Ekstrak seluruh kode ruangan unik dari hasil parsing PDF ruangan/final
   $uniqueRooms = collect($parseData)
       ->pluck('ruang_final')
       ->filter()
       ->unique();

   foreach ($uniqueRooms as $roomCode) {
       Rooms::firstOrCreate(
           ['name' => trim($roomCode)],
           ['capacity' => 36]
       );
   }
   ```

2. **Pra-Registrasi Mata Pelajaran Otomatis**:
   ```php
   // Ekstrak seluruh nama mata pelajaran unik dari hasil parsing PDF kelas
   $uniqueSubjects = collect($parseData)
       ->pluck('mapel_mentah')
       ->filter()
       ->unique();

   foreach ($uniqueSubjects as $subjectName) {
       Subject::firstOrCreate(['name' => trim($subjectName)]);
   }
   ```

3. **Fallback Pra-Registrasi Kelas (Jika Ada Kelas Baru di PDF)**:
   ```php
   $uniqueClasses = collect($parseData)
       ->pluck('kelas_mentah')
       ->filter()
       ->unique();

   foreach ($uniqueClasses as $rawClass) {
       $cleanName = trim($rawClass);
       $level = '10';
       if (preg_match('/^XII\b/i', $cleanName)) {
           $level = '12';
       } elseif (preg_match('/^XI\b/i', $cleanName)) {
           $level = '11';
       }

       Classes::firstOrCreate(
           ['name' => $cleanName],
           ['level' => $level, 'next_class_id' => null]
       );
   }
   ```

4. **Pencocokan Jadwal (*Matching Phase*)**:
   Setelah langkah 1, 2, dan 3 selesai dieksekusi, pencarian `findClass()`, `findRoom()`, dan `findSubject()` dijalankan terhadap entitas yang sudah dipastikan eksis, menjamin *match rate* mendekati 100%.

---

## 6. Rencana Tahapan Eksekusi (Roadmap WBS)

### Tahap 1: Instalasi Dependensi Spreadsheet
* [ ] Tambahkan dependensi `spatie/simple-excel:^3.0` pada `composer.json` dan jalankan `composer update spatie/simple-excel`.
* [ ] Pastikan ekstensi `ZipArchive` dan `XMLReader` aktif di environment PHP.

### Tahap 2: Modul Impor Guru (`TeacherController`)
* [ ] Implementasikan method `downloadTemplate()` untuk mengunduh `guru_import_template.xlsx`.
* [ ] Implementasikan method `import()` dengan validasi streaming, NIP unik, nama, dan `fet_staff_id`.
* [ ] Auto-provisioning akun `User` dengan `role: teacher`, password hash NIP, dan `must_change_password: true`.
* [ ] Buat unit/feature test: `tests/Feature/TeacherImportTest.php`.

### Tahap 3: Modul Impor Siswa & Auto-Create Kelas (`StudentController`)
* [ ] Implementasikan method `downloadTemplate()` untuk mengunduh `siswa_import_template.xlsx`.
* [ ] Implementasikan method `import()` dengan validasi streaming, NIS unik, deteksi rombel, dan `gender`.
* [ ] Auto-create master kelas (`Classes::firstOrCreate`) dengan level otomatis (`10`, `11`, `12`).
* [ ] Auto-provisioning akun `User` siswa (`role: student`) dan akun orang tua (`role: parent`).
* [ ] Buat unit/feature test: `tests/Feature/StudentImportTest.php`.

### Tahap 4: Penyelarasan Prasyarat & Worker PDF Jadwal
* [ ] Perbarui `app/Services/MasterDataPrerequisiteService.php`: ubah `validateForPdfImport()` agar hanya mensyaratkan ketersediaan data siswa dan data guru dengan `fet_staff_id`.
* [ ] Perbarui `app/Jobs/ParseSchedulePdfJob.php` untuk menjalankan pra-registrasi otomatis `Rooms`, `Subject`, dan fallback `Classes`.
* [ ] Perbarui unit/feature test prasyarat di `tests/Feature/MasterDataPrerequisiteRuleTest.php` sesuai aturan baru (hanya siswa dan guru).
* [ ] Jalankan regresi test suite lengkap (`php artisan test`) untuk menjamin zero regression pada seluruh modul sistem.
