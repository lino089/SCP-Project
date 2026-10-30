# Rencana Implementasi Fase 6: Auto-Registration Master Data pada PDF Schedule Worker

## 1. Ringkasan Eksekutif & Tujuan

### 1.1. Latar Belakang
Pada arsitektur SCP v4.0 sebelumnya, pembuatan jadwal pelajaran mengandalkan ketersediaan Master Data yang diisi secara manual oleh Waka Kurikulum sebelum dokumen jadwal dapat diproses. Pada alur baru SCP v4.5:
- Data **Guru** diimpor massal melalui spreadsheet Excel (Fase 3).
- Data **Siswa** diimpor massal via Excel sekaligus memicu pembuatan master **Kelas** berbasis rombel (*level detection*, Fase 4).
- Aturan prasyarat master data untuk upload PDF jadwal FET telah diselaraskan pada Fase 5 sehingga hanya mewajibkan keberadaan minimal 1 siswa aktif dan 1 guru aktif dengan `fet_staff_id`.

Namun, dokumen PDF jadwal FET dari SMKN 1 Bantul memuat puluhan kode ruangan fisik (misalnya: `12`, `L.16`, `OR`, `HALL`) dan puluhan nama mata pelajaran. Jika antrean worker `ParseSchedulePdfJob` tidak secara proaktif mendaftarkan ruangan dan mata pelajaran unik yang ditemukan dalam berkas PDF tersebut ke tabel database, maka saat proses pencocokan baris jadwal dijalankan, ratusan baris jadwal akan berstatus `unmatched` akibat ketiadaan entitas `Rooms` atau `Subject`. Kondisi ini menghalangi proses konfirmasi jadwal aktif (`POST /api/schedule-imports/{id}/confirm`).

### 1.2. Tujuan Fase 6
1. **Auto-Create Rooms:** Mengekstrak seluruh kode ruangan fisik unik (`ruang_final`) dari hasil ekstraksi PDF, lalu mendaftarkannya secara otomatis ke tabel `rooms` dengan kapasitas default **36** apabila ruangan tersebut belum ada di database.
2. **Auto-Create Subjects:** Mengekstrak seluruh nama mata pelajaran unik (`mapel_mentah`) dari hasil ekstraksi PDF, lalu mendaftarkannya secara otomatis ke tabel `subjects` apabila mata pelajaran tersebut belum terdaftar.
3. **Fallback Auto-Create Classes:** Mengekstrak nama rombel kelas (`kelas_mentah`) dari PDF sebagai jaring pengaman (*fallback*), mendaftarkan kelas yang belum terdaftar dengan deteksi tingkat (level 10, 11, atau 12) yang selaras dengan konvensi Fase 4.
4. **Reload Master Data Sebelum Matching:** Memuat ulang (*refresh*) seluruh koleksi master data (`$allClasses`, `$allSubjects`, `$allRooms`, `$allTeachers`) dari database tepat setelah proses registrasi otomatis selesai, sehingga perulangan pemetaan jadwal (*matching loop*) menggunakan data terbaru dan menghasilkan tingkat pencocokan (*match rate*) mendekati 100%.
5. **Integritas & Pencegahan Duplikasi:** Memastikan registrasi bersifat idempoten (*idempotent*), kebal terhadap variasi spasi (*whitespace-agnostic*), mengabaikan nilai kosong/placeholder, dan aman dari tumpang-tindih data yang serupa.

---

## 2. Analisis Kondisi Implementasi Saat Ini (*As-Is*)

### 2.1. Alur Kerja PDF Schedule Worker Saat Ini
Berdasarkan pemeriksaan langsung pada berkas [`app/Jobs/ParseSchedulePdfJob.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Jobs/ParseSchedulePdfJob.php), alur kerja saat ini adalah:

```mermaid
flowchart TD
    Start[Job Dispatched: ParseSchedulePdfJob] --> UpdateStatus[Update status = 'parsing']
    UpdateStatus --> ExecPython[Eksekusi Process python script/pdf_parser.py]
    ExecPython --> ParseJSON{Output JSON valid?}
    ParseJSON -- Tidak --> MarkFailed[Update status = 'failed' & Log Error]
    ParseJSON -- Ya --> PreloadData[Preload Master Data:<br>Classes::all(), User(teacher)->get(), Subject::all(), Rooms::all()]
    PreloadData --> MatchingLoop[Loop foreach parseData:<br>findClass, findTeacher, findSubject, findRoom]
    MatchingLoop --> EvalMatch{Semua entitas ditemukan & tidak ada konflik sumber ruang?}
    EvalMatch -- Tidak --> StatusUnmatched[match_status = 'unmatched']
    EvalMatch -- Ya --> CheckConflicts[Cek Bentrok Jadwal Intra-batch & DB]
    CheckConflicts -- Ada Bentrok --> StatusConflict[match_status = 'conflict']
    CheckConflicts -- Aman --> StatusMatched[match_status = 'matched']
    StatusUnmatched --> SaveRow[Simpan ScheduleImportRow]
    StatusConflict --> SaveRow
    StatusMatched --> SaveRow
    SaveRow --> FinishAll{Semua baris selesai?}
    FinishAll -- Belum --> MatchingLoop
    FinishAll -- Ya --> MarkReady[Update status = 'preview_ready']
```

### 2.2. Masalah dan Ketidaksesuaian yang Ditemukan
1. **Ketiadaan Tahap Auto-Registration:**
   Antara langkah ekstraksi JSON (`$parseData`) dan pemuatan master data (`PreloadData`), sistem saat ini langsung membaca isi tabel database apa adanya. Jika tabel `rooms` dan `subjects` belum diisi manual oleh Waka, koleksi `$allRooms` dan `$allSubjects` bernilai kosong (0 record).
2. **Mayoritas Baris Menjadi `unmatched`:**
   Saat pemanggilan `findRoom()` dan `findSubject()` dieksekusi pada perulangan baris, nilai `$matchedRoom` dan `$matchedSubject` akan bernilai `null`. Baris 117–120 menandai:
   ```php
   $hasMissingEntity = !$matchedClass || !$matchedTeacher || !$matchedSubject || !$matchedRoom;
   if ($hasMissingEntity || $roomSourceConflict) {
       $matchStatus = 'unmatched';
   }
   ```
   Hal ini menyebabkan hampir 100% baris jadwal berstatus `unmatched` apabila Waka belum mendaftarkan ruangan dan mapel secara manual.
3. **Blokade pada Tahap Konfirmasi Jadwal:**
   Sesuai logika `ScheduleImportController::confirm()`, konfirmasi impor ke jadwal aktif (`POST /api/schedule-imports/{id}/confirm`) mewajibkan adanya baris yang berstatus `matched` minimal 1 baris. Jika seluruh baris `unmatched`, konfirmasi gagal dengan status HTTP 422: *"Konfirmasi gagal. Tidak ada baris jadwal yang berstatus matched"*.
4. **Data Master Guru Tetap Menjadi Acuan Validasi Utama:**
   Data Guru **tidak boleh** dibuat otomatis karena akun guru membutuhkan hak akses login, NIP, nomor telepon, dan `fet_staff_id`. Namun, untuk Ruangan, Mata Pelajaran, dan Kelas (fallback), pendaftaran otomatis adalah solusi tuntas untuk menyempurnakan alur ingest jadwal FET.

---

## 3. Rancangan Alur Kerja Setelah Perubahan (*To-Be*)

Pada alur baru Fase 6, disisipkan tahapan **Auto-Registration & Collection Reload** segera setelah proses Python parser menghasilkan array `$parseData` yang valid.

```mermaid
flowchart TD
    ExtractSuccess[Python Parser menghasilkan array parseData] --> StepAutoRegister[Blok Auto-Registration Master Data]
    
    subgraph AutoRegistration [Tahap Auto-Registration Mandiri]
        StepAutoRegister --> RegRooms[1. Auto-Create Rooms:<br>Ekstrak ruang_final unik, filter valid, cek via findRoom, create capacity=36]
        RegRooms --> RegSubjects[2. Auto-Create Subjects:<br>Ekstrak mapel_mentah unik, filter valid, cek via findSubject, create name]
        RegSubjects --> RegClasses[3. Fallback Auto-Create Classes:<br>Ekstrak kelas_mentah unik, filter valid, cek via findClass, regex level 10/11/12]
    end

    RegClasses --> ReloadMasterData[Reload Master Data Collections:<br>Classes::all(), Subject::all(), Rooms::all(), User::where role=teacher]
    
    ReloadMasterData --> MatchingLoop[Matching Loop Baris Jadwal]
    
    subgraph MatchingProcess [Pencocokan Presisi]
        MatchingLoop --> FindAll[findClass, findTeacher, findSubject, findRoom mengenali data baru]
        FindAll --> MatchEval{Semua entitas cocok?}
        MatchEval -- Ya --> ConflictEval{Cek bentrok?}
        ConflictEval -- Aman --> SetMatched[match_status = 'matched']
        ConflictEval -- Bentrok --> SetConflict[match_status = 'conflict']
        MatchEval -- Tidak --> SetUnmatched[match_status = 'unmatched' - guru belum diimpor]
    end
    
    SetMatched --> CreateRow[ScheduleImportRow::create]
    SetConflict --> CreateRow
    SetUnmatched --> CreateRow
    CreateRow --> MarkDone[Update status = 'preview_ready']
```

---

## 4. Rincian Implementasi Teknis

### 4.1. Auto-Create Rooms
* **Atribut Sumber:** `$row['ruang_final']` (dengan fallback ke `$row['ruang_kelas']` jika `ruang_final` tidak diset).
* **Sanitasi & Filter Input:**
  * Abaikan nilai `null`, string kosong `""`, atau spasi kosong murni.
  * Lakukan pembersihan spasi: `$roomCode = trim((string)$rawCode)`.
* **Pengecekan Keberadaan (*Duplicate Prevention*):**
  * Periksa keberadaan menggunakan method cerdas eksisting `$this->findRoom($existingRooms, $roomCode)`.
  * **Penting:** Jika di database sudah ada record `"Ruang 12"` dan di PDF muncul kode `"12"`, pemanggilan `findRoom()` akan mengembalikan instance `"Ruang 12"`. Dengan demikian, sistem **TIDAK AKAN** membuat record duplikat `"12"`.
  * Jika `findRoom()` mengembalikan `null`, buat record baru:
    ```php
    $newRoom = Rooms::create([
        'name' => $roomCode,
        'capacity' => 36,
    ]);
    $existingRooms->push($newRoom);
    ```
* **Kapasitas Default:** Wajib bernilai **36**.
* **Model & Tabel:** `App\Models\Rooms`, tabel `rooms`. Kolom `name` dan `capacity` sudah terdaftar dalam `$fillable`.

### 4.2. Auto-Create Subjects
* **Atribut Sumber:** `$row['mapel_mentah']`.
* **Sanitasi & Filter Input:**
  * Abaikan nilai `null`, string kosong `""`, atau placeholder non-mapel seperti `"-x-"`, `"---"`.
  * Lakukan pembersihan spasi: `$subjectName = trim((string)$rawSubject)`.
* **Pengecekan Keberadaan (*Duplicate Prevention*):**
  * Periksa keberadaan menggunakan `$this->findSubject($existingSubjects, $subjectName)`.
  * Jika nama mata pelajaran telah ada (baik kecocokan persis maupun kecocokan kata signifikan), jangan buat ulang.
  * Jika `findSubject()` mengembalikan `null`, buat record baru:
    ```php
    $newSubject = Subject::create([
        'name' => $subjectName,
    ]);
    $existingSubjects->push($newSubject);
    ```
* **Model & Tabel:** `App\Models\Subject`, tabel `subjects`. Kolom `name` sudah terdaftar dalam `$fillable`.

### 4.3. Auto-Create Classes (Fallback)
* **Atribut Sumber:** `$row['kelas_mentah']`.
* **Latar Belakang:** Sebagian besar kelas seharusnya sudah dibuat saat impor siswa (Fase 4). Namun, jika ada kelas tertentu yang ada di jadwal FET tetapi belum memiliki data siswa (misalnya kelas baru atau perbedaan penulisan), worker bertindak sebagai jaring pengaman (*safety net*).
* **Sanitasi & Normalisasi:**
  * Bersihkan spasi ganda: `$cleanClassName = trim(preg_replace('/\s+/', ' ', (string)$rawClass))`.
  * Abaikan string kosong.
* **Deteksi Tingkat Kelas (*Level Detection*):**
  Selaras 100% dengan algoritma regex Fase 4 (`StudentController.php`):
  ```php
  if (preg_match('/^XII(\s|-|_|$)/i', $cleanClassName)) {
      $level = '12';
  } elseif (preg_match('/^XI(\s|-|_|$)/i', $cleanClassName)) {
      $level = '11';
  } elseif (preg_match('/^X(\s|-|_|$)/i', $cleanClassName)) {
      $level = '10';
  } elseif (preg_match('/^12(\s|-|_|$)/', $cleanClassName)) {
      $level = '12';
  } elseif (preg_match('/^11(\s|-|_|$)/', $cleanClassName)) {
      $level = '11';
  } elseif (preg_match('/^10(\s|-|_|$)/', $cleanClassName)) {
      $level = '10';
  } else {
      $level = '10'; // Fallback default
  }
  ```
* **Pengecekan Keberadaan:**
  * Gunakan `$this->findClass($existingClasses, $cleanClassName)`.
  * Jika belum ada:
    ```php
    $newClass = Classes::create([
        'name' => $cleanClassName,
        'level' => $level,
        'next_class_id' => null,
    ]);
    $existingClasses->push($newClass);
    ```
* **Model & Tabel:** `App\Models\Classes`, tabel `classes`. Kolom `name`, `level`, dan `next_class_id` sudah terdaftar dalam `$fillable`.

### 4.4. Mekanisme Reload Master Data Sebelum Matching Loop
Setelah blok auto-registration di atas selesai dijalankan:
```php
// Wajib reload master data dari database untuk memastikan koleksi
// memuat seluruh ID record baru dan timestamps yang konsisten
$allClasses = Classes::all();
$allSubjects = Subject::all();
$allRooms = Rooms::all();
$allTeachers = User::where('role', 'teacher')->get();
```
Dengan memuat ulang koleksi secara penuh sebelum `foreach ($parseData as $row)` dimulai:
- Objek `$allRooms` telah mencakup seluruh ruangan yang baru dibuat beserta `id` primernya.
- Objek `$allSubjects` telah mencakup seluruh mapel baru beserta `id` primernya.
- Objek `$allClasses` telah mencakup seluruh kelas baru beserta `id` primernya.
- Pemetaan `matched_room_id`, `matched_subject_id`, dan `matched_class_id` pada baris `schedule_import_rows` akan terisi secara valid.

---

## 5. Analisis Integrasi, Keamanan & Konsistensi Data

| Pertanyaan Kritis | Hasil Analisis & Keputusan Arsitektur |
|---|---|
| **1. Dukungan skema tabel & model?** | Model `Rooms`, `Subject`, dan `Classes` sudah memiliki `$fillable` yang tepat (`name`, `capacity`, `level`, `next_class_id`) dan mendukung `SoftDeletes`. Tidak memerlukan migration baru. |
| **2. Pelanggaran constraint kolom wajib?** | Semua kolom wajib memiliki nilai yang jelas: `Rooms` (`capacity = 36`), `Classes` (`level` terdeteksi regex, `next_class_id = null`), `Subject` (`name`). Tidak ada pelanggaran `NOT NULL` atau foreign key. |
| **3. Pencocokan data serupa?** | Menggunakan method matching cerdas (`findRoom`, `findSubject`, `findClass`) sebelum melakukan `create()`. Contoh: jika di DB sudah ada `"Ruang 12"`, parser menemukan `"12"`, `findRoom` mencocokkannya sehingga ruangan baru `"12"` tidak dibuat. |
| **4. Penanganan entitas kosong/invalid?** | Nilai `null`, string kosong `""`, atau placeholder non-data (`"-x-"`, `"---"`) difilter secara ketat. Baris jadwal dengan entitas tidak lengkap akan berstatus `unmatched` secara semantik benar. |
| **5. Pencegahan duplikasi perulangan batch?** | Menggunakan `pluck()->filter()->unique()` pada data mentah, dan segera melakukan `$existingCollection->push($newModel)` setiap kali ada entitas baru dibuat. |
| **6. Keamanan konkurensi antar worker?** | Pendaftaran auto-create dibungkus dalam blok `DB::transaction()` untuk menjamin atomisitas. |
| **7. Penanganan kegagalan database?** | Jika terjadi database error saat auto-create, ditangkap dalam `try ... catch`, status import diperbarui menjadi `failed`, pesan kesalahan dicatat ke log Laravel, dan proses matching dibatalkan. |
| **8. Dampak terhadap impor PDF yang sudah berjalan?** | Positif dan bebas regresi: meningkatkan rasio baris `matched` mendekati 100%, sehingga Waka dapat langsung mengonfirmasi impor tanpa terhalang baris yang tertolak karena ruangan/mapel belum terdaftar. |

---

## 6. Daftar File yang Terdampak

| No | File Path | Status | Deskripsi Perubahan |
|:--:|---|:---:|---|
| 1 | `app/Jobs/ParseSchedulePdfJob.php` | Diubah | Menyisipkan method `autoRegisterMasterData($parseData)` (auto-create rooms, subjects, classes), diikuti reload master data sebelum loop matching dijalankan. |
| 2 | `tests/Feature/ParseSchedulePdfJobTest.php` | Diubah | Menambahkan skenario pengujian auto-registration: verifikasi pembuatan rooms (kapasitas 36), subjects, fallback classes, pencegahan duplikasi, dan pencocokan jadwal tanpa pra-seeding ruangan/mapel. |
| 3 | `MD/Development.md` | Diubah | Mendokumentasikan implementasi Fase 6 pada Bagian 79. |

> **Pengendalian Ketat:** Tidak ada perubahan pada skrip Python (`script/pdf_parser.py`), controller API, tabel database, maupun migration.

---

## 7. Rencana Pengujian Komprehensif

Rangkaian pengujian pada [`tests/Feature/ParseSchedulePdfJobTest.php`](file:///d:/MyUKK\SchoolClassProject\scp\tests\Feature\ParseSchedulePdfJobTest.php) akan diperluas untuk mencakup skenario:

### 7.1. Pengujian Unit & Logika Auto-Registration
1. **Skenario Auto-Create Rooms:**
   - Database ruangan awalnya kosong (0 record).
   - Diberikan parse data dengan kode ruangan `['12', 'L.16', 'OR', '12']`.
   - **Ekspektasi:** Tabel `rooms` terisi 3 record (`12`, `L.16`, `OR`), masing-masing berkapasitas default 36. Kode `'12'` tidak terduplikasi.
2. **Skenario Idempotensi Rooms (Menggunakan Ruangan Eksis):**
   - Di database sudah ada ruangan `'Ruang 12'`.
   - Parse data memuat kode `'12'`.
   - **Ekspektasi:** Jumlah ruangan di tabel tetap 1 (`'Ruang 12'`). Tidak ada penambahan ruangan baru bernama `'12'`.
3. **Skenario Auto-Create Subjects:**
   - Database mapel awalnya kosong (0 record).
   - Diberikan parse data dengan mapel `['Matematika', 'Bahasa Indonesia', 'Matematika', '-x-']`.
   - **Ekspektasi:** Tabel `subjects` terisi 2 record (`Matematika`, `Bahasa Indonesia`). Placeholder `'-x-'` diabaikan, dan `'Matematika'` tidak terduplikasi.
4. **Skenario Fallback Auto-Create Classes:**
   - Database kelas awalnya kosong (0 record).
   - Diberikan parse data dengan kelas `['X RPL 1', 'XI TKJ 2', 'XII MM 1', 'X RPL 1']`.
   - **Ekspektasi:** Tabel `classes` terisi 3 record dengan level masing-masing `'10'`, `'11'`, `'12'`. Kelas `'X RPL 1'` tidak terduplikasi.
5. **Skenario Penanganan Data Kosong / Null:**
   - Parse data memuat entitas bernilai `null` atau whitespace.
   - **Ekspektasi:** Tidak ada record ruangan, mapel, atau kelas dengan nama kosong yang tersimpan ke database.

### 7.2. Pengujian Integrasi End-to-End Worker
6. **Skenario Parse Job dengan Master Data Minimum (Siswa & Guru Saja):**
   - Database hanya memuat akun Siswa dan akun Guru (dengan `fet_staff_id`). Tabel `rooms`, `subjects`, dan `classes` sengaja dikosongkan (0 record).
   - Jalankan `ParseSchedulePdfJob::handle()`.
   - **Ekspektasi:**
     - Status import bertransisi menjadi `preview_ready`.
     - Tabel `rooms` terisi seluruh kode ruangan dari PDF dengan kapasitas 36.
     - Tabel `subjects` terisi seluruh nama mata pelajaran unik dari PDF.
     - Tabel `classes` terisi seluruh rombel kelas unik dari PDF.
     - Baris yang memiliki guru terdaftar langsung berstatus `matched` dan memiliki `matched_room_id`, `matched_subject_id`, serta `matched_class_id` yang valid.

---

## 8. Kriteria Keberhasilan (*Acceptance Criteria*)

Implementasi Fase 6 dinyatakan selesai dan berhasil apabila:

1. [ ] **Auto-Registration Ruangan Berfungsi:** Antrean worker mengekstrak seluruh kode ruangan fisik unik dari PDF dan menyimpannya ke tabel `rooms` dengan kapasitas default 36 tanpa duplikasi.
2. [ ] **Auto-Registration Mapel Berfungsi:** Antrean worker mengekstrak seluruh nama mata pelajaran unik dari PDF dan menyimpannya ke tabel `subjects` tanpa duplikasi.
3. [ ] **Fallback Auto-Registration Kelas Berfungsi:** Antrean worker mengekstrak kelas yang belum ada dan mendaftarkannya dengan penentuan tingkat (`level = '10'/'11'/'12'`) yang tepat.
4. [ ] **Reload Koleksi Berhasil:** Master data dimuat ulang dari database sebelum perulangan pencocokan jadwal, sehingga entitas yang baru dibuat langsung dikenali oleh method pencocokan.
5. [ ] **Status Import Siap Konfirmasi:** Baris jadwal yang memiliki guru terdaftar berhasil mendapatkan relasi `matched_room_id`, `matched_subject_id`, dan `matched_class_id`, serta berstatus `matched`.
6. [ ] **Zero Regression:** Seluruh test suite pada `ParseSchedulePdfJobTest`, `ScheduleImportTest`, `MasterDataPrerequisiteRuleTest`, dan modul terkait lulus 100% (Green).
7. [ ] **Dokumentasi Lengkap:** Seluruh detail perubahan tercatat rapi pada [Development.md](file:///d:/MyUKK/SchoolClassProject/scp/MD/Development.md) Bagian 79.

---

## 9. Analisis Risiko & Mitigasi

| No | Potensi Risiko | Dampak Teknis | Strategi Mitigasi Terencana |
|:--:|---|---|---|
| 1 | **Duplikasi nama ruangan akibat perbedaan format (misal `"12"` vs `"Ruang 12"`)** | Terdapat dua data ruangan yang merujuk pada fisik ruangan yang sama. | Menggunakan method pencocokan cerdas eksisting `$this->findRoom()` terhadap data database sebelum memutuskan melakukan `create()`. |
| 2 | **String kosong atau placeholder tersimpan sebagai nama master data** | Muncul mapel atau ruangan bernama `""` atau `"-x-"` di database. | Menerapkan filter ketat `filled()`, `trim()`, dan blacklisting placeholder non-entitas sebelum auto-create. |
| 3 | **Pencocokan masih membaca koleksi lama (*stale in-memory collection*)** | Baris jadwal tetap berstatus `unmatched` meskipun data sudah tersimpan di database. | Menjalankan pemuatan ulang penuh (`Rooms::all()`, `Subject::all()`, `Classes::all()`) tepat setelah auto-registration selesai dan sebelum matching loop dimulai. |
| 4 | **Kegagalan parsial di tengah registrasi batch** | Data master setengah tersimpan saat query gagal. | Membungkus proses auto-registration dalam `DB::transaction()` agar operasi bersifat all-or-nothing. |

---

## 10. Urutan Tahapan Implementasi

1. **Tahap 1:** Memperbarui [`app/Jobs/ParseSchedulePdfJob.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Jobs/ParseSchedulePdfJob.php):
   - Menambahkan method `autoRegisterMasterData(array $parseData)`.
   - Memanggil `autoRegisterMasterData()` tepat setelah JSON parser tervalidasi.
   - Memuat ulang koleksi `$allClasses`, `$allSubjects`, `$allRooms`, dan `$allTeachers`.
2. **Tahap 2:** Memperbarui [`tests/Feature/ParseSchedulePdfJobTest.php`](file:///d:/MyUKK/SchoolClassProject/scp/tests/Feature/ParseSchedulePdfJobTest.php):
   - Menambahkan test case auto-creation dan pencegahan duplikasi.
   - Memverifikasi integrasi parsing PDF dengan master data ruangan/mapel awal kosong.
3. **Tahap 3:** Eksekusi pengujian otomatis dan verifikasi zero-regression (`ParseSchedulePdfJobTest`, `ScheduleImportTest`, `MasterDataPrerequisiteRuleTest`).
4. **Tahap 4:** Dokumentasi teknis pada [Development.md](file:///d:/MyUKK/SchoolClassProject/scp/MD/Development.md) Bagian 79.
