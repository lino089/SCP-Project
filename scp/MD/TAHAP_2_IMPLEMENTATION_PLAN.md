# Rencana Implementasi Terperinci: Tahap 2 — Perluasan Akses Wali Kelas pada Controller Existing

**Dokumen Rencana:** `MD/TAHAP_2_IMPLEMENTATION_PLAN.md`  
**Proyek:** School Class Progress (SCP) — Backend REST API  
**Versi Target:** SCP v4.5 (Ekstensi Multirole Guru & Kesiswaan — Tahap 2)  
**Dokumen Acuan:** `MD/SCP_MULTIKELAS_KESISWAAN_PLAN.md` (Bab 2.1, Bab 4.2, Bab 5.3, Bab 7 Tahap 2), `MD/PRD.md`  
**Status Dokumen:** Usulan Rencana Detail (Menunggu Persetujuan Pengguna Sebelum Eksekusi)  

---

## DAFTAR ISI

1. [Tujuan dan Ruang Lingkup Tahap 2](#1-tujuan-dan-ruang-lingkup-tahap-2)
2. [Kondisi Aktual Kedua Controller (Terverifikasi)](#2-kondisi-aktual-kedua-controller-terverifikasi)
3. [Analisis Setiap Method yang Dimodifikasi](#3-analisis-setiap-method-yang-dimodifikasi)
   - 3.1 `JournalController::index` (Listing Jurnal Ter-scoped)
   - 3.2 `JournalController::show` (Detail Jurnal Kelas Binaan)
   - 3.3 `JournalController::store` (Membuka Sesi KBM Kelas Binaan)
   - 3.4 `JournalController::update` (Menyelesaikan Jurnal & Presensi Siswa)
   - 3.5 `ScheduleController::index` (Listing Jadwal Kelas Binaan)
4. [Daftar File yang Terdampak Beserta Perubahan yang Direncanakan](#4-daftar-file-yang-terdampak-beserta-perubahan-yang-direncanakan)
5. [Rincian Matriks Otorisasi Sebelum vs Sesudah Perubahan](#5-rincian-matriks-otorisasi-sebelum-vs-sesudah-perubahan)
6. [Urutan Pengerjaan Implementasi Bertahap](#6-urutan-pengerjaan-implementasi-bertahap)
7. [Risiko Keamanan, Konflik Test Eksisting & Strategi Mitigasi](#7-risiko-keamanan-konflik-test-eksisting--strategi-mitigasi)
8. [Hal-Hal yang Membutuhkan Konfirmasi Pengguna](#8-hal-hal-yang-membutuhkan-konfirmasi-pengguna)
9. [Rencana Verifikasi dan Perintah Pengujian CLI](#9-rencana-verifikasi-dan-perintah-pengujian-cli)
10. [Kriteria Keberhasilan (*Acceptance Criteria*)](#10-kriteria-keberhasilan-acceptance-criteria)
11. [Batasan Ketat Pengerjaan (*Out-of-Scope*)](#11-batasan-ketat-pengerjaan-out-of-scope)

---

## 1. Tujuan dan Ruang Lingkup Tahap 2

### 1.1 Tujuan Utama
Memperluas hak akses operasional guru yang memiliki penugasan tambahan sebagai **Wali Kelas** pada controller yang telah berjalan (`JournalController` dan `ScheduleController`) agar dapat:
1. Mengawasi dan memantau riwayat seluruh jurnal mata pelajaran di kelas binaannya.
2. Membuka sesi KBM darurat (sebagai guru pengganti / inval wali kelas) jika kelas binaannya kosong, dan mencatat akun wali kelas sebagai `substitute_teacher_id`.
3. Menyelesaikan jurnal KBM yang dibukanya (mengisi deskripsi materi, kompresi foto dokumentasi KBM, dan absensi exception-based siswa binaannya).
4. Melihat jadwal pelajaran seluruh guru dan mata pelajaran pada kelas yang diampunya (`GET /api/schedules?class_id={id_kelas_binaan}`).

Seluruh perluasan hak akses ini dirancang secara presisi agar **tidak mengganggu atau membocorkan data** jadwal/jurnal guru reguler, hak kesiswaan lintas sekolah, maupun wewenang administratif Waka Kurikulum.

### 1.2 Ruang Lingkup Pengerjaan (In-Scope Tahap 2)
Fokus secara ketat hanya pada dua berkas controller eksisting:
1. `app/Http/Controllers/API/JournalController.php` (Method: `index`, `show`, `store`, `update`)
2. `app/Http/Controllers/API/ScheduleController.php` (Method: `index`)
3. Penyesuaian skenario pengujian pada test suite yang terdampak akibat evolusi kebijakan akses wali kelas.

### 1.3 Batasan Ketat (Strictly Out-of-Scope pada Tahap 2)
- **Tidak menyentuh `LeaveRequestController`:** Kebijakan bahwa Wali Kelas **hanya berhak membaca (read-only)** izin siswa kelas binaannya dan **dilarang memverifikasi (approve/reject)** izin siswa tetap dipertahankan 100%.
- **Tidak menyentuh `TeacherLeaveRequestController`:** Pembuatan controller izin guru dan rute-rutenya dialokasikan secara khusus ke **Tahap 3**.
- **Tidak mengubah skema basis data:** Skema tabel `journals` dan `schedules` sudah siap dan tidak memerlukan migrasi baru.
- **Tidak mengubah `AssignmentMiddleware`:** Seluruh validasi kelas binaan dievaluasi di level Eloquent model query menggunakan helper `homeroomClassIds()` dari Tahap 1.

---

## 2. Kondisi Aktual Kedua Controller (Terverifikasi)

Hasil inspeksi langsung terhadap baris kode aktual:

### 2.1 Kondisi Aktual `JournalController.php`
- **Method `index()` (Baris 45–57):**
  Saat ini hanya memeriksa `$isWaka` dan `$isKesiswaan`. Jika user adalah guru biasa, query dikunci secara kaku:
  `WHERE (schedule.teacher_id = user.id OR substitute_teacher_id = user.id)`.
  *Kelemahan:* Wali Kelas yang ingin memantau keterlaksanaan KBM kelas binaannya tidak dapat melihat jurnal mapel lain di kelas tersebut.
- **Method `show()` (Baris 118–130):**
  Otorisasi mengevaluasi:
  `if (!$isWaka && !$isKesiswaan && !$isOriginalTeacher && !$isSubstitute && !$isStudentInClass && !$isParentOfClass) -> HTTP 403`.
  *Kelemahan:* Wali Kelas ditolak melihat detail jurnal KBM kelas binaannya jika bukan dia yang mengajar mata pelajaran tersebut.
- **Method `store()` (Baris 155–167 & 203):**
  Terdapat gerbang otorisasi:
  `if (!$isOriginalTeacher && !$isKesiswaan && !$isWaka) -> return 403`.
  Bahkan terdapat komentar eksplisit: *"Wali Kelas dan Guru lain dilarang keras (HTTP 403)"*.
  Pada penentuan substitute (baris 203):
  `$substituteTeacherId = (!$isOriginalTeacher && $isKesiswaan) ? $user->id : null;`.
  *Kelemahan:* Wali Kelas yang mendapati jam kosong di kelas binaannya tidak dapat membuka sesi KBM pengganti.
- **Method `update()` (Baris 295–305):**
  Variabel `$isAuthorizedSubstitute` didefinisikan secara kaku:
  `$isAuthorizedSubstitute = ($journal->substitute_teacher_id === $user->id && $user->isKesiswaan());`.
  *Kelemahan:* Sekalipun ada jurnal pengganti, jika user bukan Kesiswaan, ditolak dengan HTTP 403.
- **Method `markTeacherAbsent()` (Baris 255–263):**
  Sudah terlindungi ketat hanya untuk `$isKesiswaan || $isWaka`. *Kondisi ini sudah benar dan akan dipertahankan.*

### 2.2 Kondisi Aktual `ScheduleController.php`
- **Method `index()` (Baris 141–156):**
  Pada Mode 2 (Listing Jadwal Reguler), kode saat ini:
  ```php
  if ($user->role === 'teacher') {
      $query->where('teacher_id', $user->id);
  }
  ...
  if ($request->filled('class_id')) {
      $query->where('class_id', $request->input('class_id'));
  }
  ```
  *Kelemahan:* Jika seorang Wali Kelas mengirimkan `GET /api/schedules?class_id=5` (kelas binaannya), query menghasilkan:
  `WHERE teacher_id = user.id AND class_id = 5`.
  Wali Kelas hanya melihat jam mengajarnya sendiri di kelas itu, bukan jadwal pelajaran komprehensif kelas binaannya.

---

## 3. Analisis Setiap Method yang Dimodifikasi

### 3.1 `JournalController::index` (Listing Jurnal Ter-scoped)

#### Logika Saat Ini:
```php
$isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
$isWaka = ($user->role === 'vice_principal');

if (!$isWaka && !$isKesiswaan) {
    $query->where(function ($q) use ($user) {
        $q->whereHas('schedule', function ($sq) use ($user) {
            $sq->where('teacher_id', $user->id);
        })->orWhere('substitute_teacher_id', $user->id);
    });
}
```

#### Rencana Perubahan:
Mengintegrasikan helper `homeroomClassIds()` yang dibuat pada Tahap 1:
```php
$isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
$isWaka = ($user->role === 'vice_principal');

if (!$isWaka && !$isKesiswaan) {
    if ($user->isWaliKelas()) {
        $waliClassIds = $user->homeroomClassIds();
        $query->where(function ($q) use ($user, $waliClassIds) {
            $q->whereHas('schedule', function ($sq) use ($user, $waliClassIds) {
                // Melihat seluruh jurnal dari jadwal di kelas binaannya ATAU jadwal mengajarnya sendiri
                $sq->whereIn('class_id', $waliClassIds)
                   ->orWhere('teacher_id', $user->id);
            })->orWhere('substitute_teacher_id', $user->id); // ATAU jurnal di mana dia menjadi guru pengganti
        });
    } else {
        // Guru reguler tanpa tugas wali kelas
        $query->where(function ($q) use ($user) {
            $q->whereHas('schedule', function ($sq) use ($user) {
                $sq->where('teacher_id', $user->id);
            })->orWhere('substitute_teacher_id', $user->id);
        });
    }
}
```
**Analisis Keamanan:**
- Filter `?class_id=` dan `?date=` yang ada di bawahnya tetap berlaku normal.
- Jika Wali Kelas meminta `?class_id={kelas_lain}`, query akan otomatis ter-filter hanya menampilkan jadwal mengajarnya sendiri di kelas lain tersebut (jika ada), sehingga data jurnal guru lain di kelas luar tetap aman.

---

### 3.2 `JournalController::show` (Detail Jurnal Kelas Binaan)

#### Rencana Perubahan:
Menambahkan evaluasi penugasan wali kelas terhadap kelas jadwal jurnal:
```php
$isWaka = ($user->role === 'vice_principal');
$isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
$isOriginalTeacher = ($journal->schedule->teacher_id === $user->id);
$isSubstitute = ($journal->substitute_teacher_id === $user->id);
$isWaliKelasOfClass = ($user->role === 'teacher' && $user->isWaliKelas($journal->schedule->class_id));
$isStudentInClass = ($user->role === 'student' && $user->class_id === $journal->schedule->class_id);
$isParentOfClass = ($user->role === 'parent' && $user->linkedStudent?->class_id === $journal->schedule->class_id);

if (!$isWaka && !$isKesiswaan && !$isOriginalTeacher && !$isSubstitute && !$isWaliKelasOfClass && !$isStudentInClass && !$isParentOfClass) {
    return response()->json([
        'success' => false,
        'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melihat detail jurnal ini.',
    ], 403);
}
```
**Analisis Keamanan:**
Wali Kelas hanya diizinkan membuka detail jurnal jika `journal->schedule->class_id` cocok dengan kelas binaannya. Percobaan membuka jurnal kelas lain akan tetap menghasilkan HTTP 403 Forbidden.

---

### 3.3 `JournalController::store` (Membuka Sesi KBM Kelas Binaan)

#### Rencana Perubahan:
1. **Evaluasi Otorisasi:**
   ```php
   $isOriginalTeacher = ($schedule->teacher_id === $user->id);
   $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());
   $isWaka = ($user->role === 'vice_principal');
   $isWaliKelasOfClass = ($user->role === 'teacher' && $user->isWaliKelas($schedule->class_id));

   // Gerbang otorisasi pembuka sesi:
   if (!$isOriginalTeacher && !$isKesiswaan && !$isWaka && !$isWaliKelasOfClass) {
       return response()->json([
           'success' => false,
           'message' => 'Akses ditolak. Hanya guru pengajar jadwal, Guru Kesiswaan, atau Wali Kelas terkait yang berhak membuka atau menggantikan jadwal ini.',
       ], 403);
   }
   ```
2. **Proteksi Penandaan `teacher_absent`:**
   Wali Kelas **dilarang keras** menandai jadwal sebagai `teacher_absent` (kewenangan eksklusif Kesiswaan & Waka):
   ```php
   if ($request->input('status') === 'teacher_absent') {
       if (!$isKesiswaan && !$isWaka) {
           return response()->json([
               'success' => false,
               'message' => 'Hanya Guru Kesiswaan atau Waka Kurikulum yang berhak menandai status guru berhalangan hadir (teacher_absent).',
           ], 403);
       }
       ...
   }
   ```
3. **Pencatatan Guru Pengganti (`substitute_teacher_id`):**
   Jika sesi KBM dibuka bukan oleh guru pengampu asli, periksa apakah dibuka oleh Kesiswaan atau Wali Kelas kelas binaan tersebut:
   ```php
   $substituteTeacherId = (!$isOriginalTeacher && ($isKesiswaan || $isWaliKelasOfClass)) ? $user->id : null;

   $journal = Journal::firstOrCreate(
       ['schedule_id' => $schedule->id, 'date' => $today],
       [
           'status' => 'ongoing',
           'substitute_teacher_id' => $substituteTeacherId,
       ]
   );

   // Jika record jurnal sudah terbentuk sebelumnya dan dibuka oleh Wali Kelas/Kesiswaan:
   if (!$isOriginalTeacher && ($isKesiswaan || $isWaliKelasOfClass) && is_null($journal->substitute_teacher_id)) {
       $journal->update(['substitute_teacher_id' => $user->id]);
   }
   ```

---

### 3.4 `JournalController::update` (Menyelesaikan Jurnal & Presensi Siswa)

#### Rencana Perubahan:
Memperluas definisi `$isAuthorizedSubstitute`:
```php
$isOriginalTeacher = ($journal->schedule->teacher_id === $user->id);
$isAuthorizedSubstitute = ($journal->substitute_teacher_id === $user->id) && (
    $user->isKesiswaan() || $user->isWaliKelas($journal->schedule->class_id)
);

if (!$isOriginalTeacher && !$isAuthorizedSubstitute) {
    return response()->json([
        'success' => false,
        'message' => 'Akses ditolak. Anda tidak memiliki izin untuk mengisi atau menyelesaikan jurnal ini.',
    ], 403);
}
```
**Analisis Integritas:**
- Wali Kelas **hanya dapat menyelesaikan jurnal yang memang tercatat atas nama dirinya sebagai guru pengganti** (`substitute_teacher_id === user.id`).
- Wali Kelas tidak dapat membajak jurnal yang sedang berlangsung milik guru pengampu asli jika guru pengampu asli yang membukanya (`substitute_teacher_id` bernilai `null` atau ID guru lain).
- Seluruh presensi exception-based (Sakit, Izin, Alpa) dan kompresi foto KBM ~800px tetap berjalan atomik melalui `DB::transaction`.

---

### 3.5 `ScheduleController::index` (Listing Jadwal Kelas Binaan)

#### Rencana Perubahan:
Pada Mode 2 (Listing Jadwal Reguler, baris 140–156):
```php
// Scoping akses jadwal:
if ($user->role === 'teacher') {
    $homeroomIds = $user->homeroomClassIds();
    $isRequestingOwnHomeroom = $request->filled('class_id') && in_array($request->integer('class_id'), $homeroomIds);

    if ($isRequestingOwnHomeroom) {
        // Wali Kelas meminta jadwal kelas binaannya: buka akses seluruh mapel pada kelas tersebut
        $query->where('class_id', $request->integer('class_id'));
    } else {
        // Guru biasa, ATAU Wali Kelas tanpa filter class_id, ATAU meminta kelas lain di luar binaannya:
        // Wajib dikunci hanya jadwal mengajar pribadinya
        $query->where('teacher_id', $user->id);
        
        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        }
    }
} elseif ($user->role === 'vice_principal') {
    if ($request->filled('teacher_id')) {
        $query->where('teacher_id', $request->input('teacher_id'));
    }
    if ($request->filled('class_id')) {
        $query->where('class_id', $request->input('class_id'));
    }
}
```
**Analisis Keamanan & Fallback:**
- Kasus 1: Wali Kelas memanggil `GET /api/schedules?class_id=1` (di mana kelas 1 adalah kelas binaannya) $\rightarrow$ Mengembalikan seluruh jadwal kelas 1 (seluruh guru dan mapel).
- Kasus 2: Wali Kelas memanggil `GET /api/schedules` (tanpa `class_id`) $\rightarrow$ Mengembalikan jadwal mengajarnya sendiri.
- Kasus 3: Wali Kelas memanggil `GET /api/schedules?class_id=99` (bukan kelas binaannya) $\rightarrow$ Otomatis dialihkan menerapkan filter `where teacher_id = user.id AND class_id = 99`. Jika tidak mengajar di sana, data kosong. Tidak ada kebocoran jadwal kelas lain.

---

## 4. Daftar File yang Terdampak Beserta Perubahan yang Direncanakan

| No | Lokasi Berkas | Status | Rencana Perubahan Spesifik |
|:--:|---|:---:|---|
| 1 | `app/Http/Controllers/API/JournalController.php` | **Dimodifikasi** | - Perluasan scope query `index()` untuk Wali Kelas.<br>- Penambahan otorisasi `show()` untuk kelas binaan.<br>- Penambahan otorisasi `store()` untuk membuka KBM pengganti kelas binaan.<br>- Penegasan proteksi `teacher_absent` tetap eksklusif Kesiswaan/Waka.<br>- Perluasan otorisasi `update()` untuk menyelesaikan jurnal pengganti oleh Wali Kelas. |
| 2 | `app/Http/Controllers/API/ScheduleController.php` | **Dimodifikasi** | - Scoping dinamis pada `index()`: membuka jadwal multi-guru jika `class_id` adalah kelas binaan Wali Kelas, dan fallback aman ke jadwal pribadi jika bukan. |
| 3 | `tests/Feature/WaliKelasAccessTest.php` | **Dibuat Baru** | - 10 skenario automated test suite khusus untuk memverifikasi seluruh matriks hak akses Wali Kelas. |
| 4 | `tests/Feature/JournalAndAttendanceTest.php` | **Disesuaikan (Menunggu Konfirmasi)** | - Menyesuaikan 2 skenario pengujian lama yang sebelumnya menegaskan bahwa wali kelas dilarang membuka kelas binaannya. |

---

## 5. Rincian Matriks Otorisasi Sebelum vs Sesudah Perubahan

| Aksi / Endpoint | Kondisi Awal (Sebelum Tahap 2) | Kondisi Baru (Setelah Tahap 2) |
|---|---|---|
| **Lihat Riwayat Jurnal Kelas Binaan** (`GET /api/journals?class_id={id}`) | ❌ Ditolak / Hanya melihat jadwal mengajar pribadi | ✅ **Diizinkan** bagi Wali Kelas pada kelas binaannya |
| **Lihat Detail Jurnal Kelas Binaan** (`GET /api/journals/{id}`) | ❌ HTTP 403 Forbidden | ✅ **Diizinkan (HTTP 200)** bagi Wali Kelas pada kelas binaannya |
| **Buka Sesi KBM Kelas Binaan (Inval)** (`POST /api/journals`) | ❌ HTTP 403 Forbidden | ✅ **Diizinkan (HTTP 201)**, tercatat sebagai `substitute_teacher_id` |
| **Tandai Status `teacher_absent`** (`POST /api/journals` / `PATCH`) | ❌ HTTP 403 Forbidden | ❌ **Tetap Ditolak (HTTP 403)** (Eksklusif Kesiswaan & Waka) |
| **Selesaikan Jurnal KBM yang Dibuka** (`PUT /api/journals/{id}`) | ❌ HTTP 403 Forbidden | ✅ **Diizinkan (HTTP 200)** jika `substitute_teacher_id === auth()->id()` |
| **Buka / Selesaikan Jurnal Kelas Lain** | ❌ HTTP 403 Forbidden | ❌ **Tetap Ditolak (HTTP 403)** |
| **Lihat Seluruh Jadwal Kelas Binaan** (`GET /api/schedules?class_id={id}`) | ❌ Ter-filter hanya jadwal mengajar pribadinya | ✅ **Diizinkan** melihat seluruh mata pelajaran di kelas binaannya |
| **Lihat Seluruh Jadwal Kelas Lain** | ❌ Hanya jadwal mengajar pribadinya | ❌ **Tetap Dibatasi** hanya jadwal mengajar pribadinya |
| **Verifikasi (Approve/Reject) Izin Siswa** | ❌ HTTP 403 Forbidden | ❌ **Tetap Ditolak (HTTP 403)** (Eksklusif Kesiswaan & Waka) |

---

## 6. Urutan Pengerjaan Implementasi Bertahap

Untuk menjamin keamanan dan stabilitas kode, implementasi Tahap 2 akan dilakukan dalam 4 langkah terstruktur:

```
[Langkah 1: Modifikasi ScheduleController.php]
    └── Sesuaikan method index() dengan evaluasi isRequestingOwnHomeroom
    └── Lakukan pengecekan syntax via php -l
             │
[Langkah 2: Modifikasi JournalController.php]
    └── Sesuaikan method index(), show(), store(), dan update()
    └── Pastikan proteksi teacher_absent tetap terkunci rapat
    └── Lakukan pengecekan syntax via php -l
             │
[Langkah 3: Pembuatan Test Suite tests/Feature/WaliKelasAccessTest.php]
    └── Susun 10 skenario pengujian komprehensif hak akses Wali Kelas
    └── Eksekusi php artisan test --filter=WaliKelasAccessTest
             │
[Langkah 4: Penyelarasan Test Suite Eksisting & Verifikasi Regresi Penuh]
    └── Jalankan seluruh test suite proyek via php artisan test
    └── Pastikan zero-regression tercapai 100%
```

---

## 7. Risiko Keamanan, Konflik Test Eksisting & Strategi Mitigasi

### 7.1 Konflik Kebijakan dengan Test Suite Eksisting (`JournalAndAttendanceTest.php`)
- **Masalah:** Pada test suite eksisting [JournalAndAttendanceTest.php](file:///d:/MyUKK\SchoolClassProject\scp\tests\Feature\JournalAndAttendanceTest.php), terdapat 2 pengujian:
  1. `test_wali_kelas_is_forbidden_from_opening_or_substituting_journal` (baris 256)
  2. `test_wali_kelas_cannot_complete_journal_of_other_teacher` (baris 431)
  Kedua test ini dibuat berdasarkan spesifikasi lama (PRD v4.4) yang saat itu melarang keras Wali Kelas menyentuh jurnal kelas binaannya.
- **Konsekuensi:** Begitu kita mengizinkan Wali Kelas membuka dan menyelesaikan jurnal kelas binaannya pada Tahap 2, kedua test lama tersebut akan gagal (karena mengharapkan HTTP 403, padahal kebijakan baru menghasilkan HTTP 201 dan 200).
- **Strategi Mitigasi:**
  Test tersebut diselaraskan maknanya:
  - Menguji bahwa Wali Kelas **dilarang membuka jurnal pada KELAS LAIN yang bukan binaannya** (tetap menghasilkan HTTP 403).
  - Menambahkan pengujian bahwa Wali Kelas **diizinkan membuka jurnal pada KELAS BINAANNYA** (menghasilkan HTTP 201).
  *(Hal ini dikonsultasikan secara eksplisit pada Bab 8).*

### 7.2 Risiko Pembajakan Sesi Jurnal (*Session Hijacking*)
- **Potensi Risiko:** Wali Kelas menyelesaikan jurnal yang sedang berjalan milik guru pengampu asli.
- **Mitigasi:** Pengecekan pada `JournalController::update()` mewajibkan kondisi:
  `$journal->substitute_teacher_id === $user->id`.
  Jika jurnal tersebut dibuka oleh guru pengampu asli (di mana `substitute_teacher_id` bernilai `null`), Wali Kelas **tidak berhak menyelesaikannya**. Wali kelas hanya dapat menyelesaikan sesi yang memang dibuka oleh dirinya sebagai guru pengganti.

### 7.3 Risiko Kebocoran Jadwal Pelajaran Kelas Lain
- **Potensi Risiko:** Wali Kelas mencoba mengintip jadwal kelas lain melalui manipulasi parameter URL `GET /api/schedules?class_id=X`.
- **Mitigasi:** Validasi ketat `in_array($request->integer('class_id'), $user->homeroomClassIds())`. Jika kelas ID bukan milik binaannya, sistem secara otomatis memaksa query menyertakan `WHERE teacher_id = user.id`.

---

## 8. Hal-Hal yang Membutuhkan Konfirmasi Pengguna

Sebelum implementasi kode Tahap 2 dimulai, mohon konfirmasi Anda terhadap 2 keputusan teknis berikut:

### Konfirmasi 1: Penyelarasan 2 Skenario Pengujian pada `JournalAndAttendanceTest.php`
- **Penjelasan:** Dua metode pengujian lama (`test_wali_kelas_is_forbidden_from_opening_or_substituting_journal` dan `test_wali_kelas_cannot_complete_journal_of_other_teacher`) secara eksplisit menegakkan larangan lama. Agar test suite sistem tetap 100% hijau, skenario tersebut perlu diselaraskan konteksnya menjadi: *"Wali Kelas dilarang membuka atau menyelesaikan jurnal pada KELAS LAIN di luar binaannya"*.
- **Pertanyaan untuk Anda:** *Apakah Anda menyetujui penyesuaian target kelas pada kedua metode pengujian di `JournalAndAttendanceTest.php` tersebut agar mencerminkan penolakan pada kelas lain di luar binaan?*

### Konfirmasi 2: Perilaku Endpoint Alert `missing_journal` untuk Wali Kelas
- **Penjelasan:** Pada `ScheduleController::index()`, terdapat mode khusus `?status=missing_journal` (Mode 1) yang memberikan alert jadwal yang terlambat diisi jurnalnya lebih dari 30 menit.
- **Pilihan Desain:**
  - **Opsi A (Rekomendasi Arsitek):** Tetap hanya menampilkan alert jadwal mengajar pribadi milik guru tersebut. Pengawasan menyeluruh terhadap kelas yang belum diisi jurnal tetap menjadi wewenang Kesiswaan dan Waka.
  - **Opsi B:** Memperluas alert sehingga Wali Kelas juga menerima daftar jadwal kelas binaannya yang belum diisi jurnal oleh guru mapel lain.
- **Pertanyaan untuk Anda:** *Apakah Anda memilih Opsi A (fokus jadwal mengajar pribadi) atau Opsi B (mencakup jadwal mapel lain di kelas binaan)?*

---

## 9. Rencana Verifikasi dan Perintah Pengujian CLI

Setelah implementasi Tahap 2 selesai dilakukan, verifikasi wajib dijalankan melalui tahapan:

1. **Pemeriksaan Syntax PHP:**
   ```bash
   php -l app/Http/Controllers/API/JournalController.php
   php -l app/Http/Controllers/API/ScheduleController.php
   ```

2. **Eksekusi Test Suite Khusus Wali Kelas (Tahap 2):**
   ```bash
   php artisan test --filter=WaliKelasAccessTest
   ```
   *(Ekspektasi: 10 skenario lolos 100% / Hijau)*

3. **Eksekusi Pengujian Regresi Terkait Jurnal & Jadwal:**
   ```bash
   php artisan test --filter=JournalAndAttendanceTest
   php artisan test --filter=ScheduleReadAndAlertTest
   ```
   *(Ekspektasi: Seluruh pengujian terkait jurnal dan jadwal lolos 100%)*

4. **Eksekusi Pengujian Penuh Sistem (*Zero-Regression Check*):**
   ```bash
   php artisan test
   ```
   *(Ekspektasi: Seluruh 250+ pengujian lolos tanpa kegagalan)*

---

## 10. Kriteria Keberhasilan (*Acceptance Criteria*)

Tahap 2 dinyatakan **SELESAI dan LULUS** apabila memenuhi kriteria objektif berikut:

- [ ] Wali Kelas berhasil memanggil `GET /api/schedules?class_id={id_binaan}` dan menerima seluruh jadwal mapel kelas binaannya.
- [ ] Wali Kelas yang memanggil `GET /api/schedules?class_id={id_kelas_lain}` hanya menerima jadwal mengajarnya sendiri di kelas tersebut (tidak bocor).
- [ ] Wali Kelas berhasil memanggil `GET /api/journals` dan melihat jurnal dari seluruh mata pelajaran di kelas binaannya.
- [ ] Wali Kelas berhasil memanggil `GET /api/journals/{id}` untuk melihat detail jurnal kelas binaannya (HTTP 200).
- [ ] Wali Kelas berhasil membuka sesi KBM kelas binaannya via `POST /api/journals` (HTTP 201) dan otomatis tercatat sebagai `substitute_teacher_id`.
- [ ] Wali Kelas yang mencoba menandai status `teacher_absent` ditolak dengan status HTTP 403.
- [ ] Wali Kelas yang mencoba membuka sesi jurnal kelas lain ditolak dengan status HTTP 403.
- [ ] Wali Kelas berhasil menyelesaikan jurnal pengganti yang dibukanya via `PUT /api/journals/{id}` lengkap dengan dokumentasi foto dan presensi siswa (HTTP 200).
- [ ] Wali Kelas dilarang menyelesaikan jurnal yang dibuka oleh guru pengampu asli (HTTP 403).
- [ ] Guru reguler tanpa tugas wali kelas tetap terisolasi hanya pada jadwal dan jurnal miliknya sendiri.
- [ ] Test suite `WaliKelasAccessTest` lulus 100% (10 skenario hijau).
- [ ] Seluruh test suite sistem lolos tanpa regresi.

---

## 11. Batasan Ketat Pengerjaan (*Out-of-Scope*)

1. **Dilarang memulai Tahap 3:** Jangan membuat `TeacherLeaveRequestController.php` atau menambahkan route baru di `routes/api.php`.
2. **Dilarang memodifikasi rute perizinan siswa:** Endpoint `/api/leave-requests` tidak diubah perilakunya.
3. **Dilarang refactoring di luar lingkup:** Kode di luar method target pada `JournalController` dan `ScheduleController` tidak disentuh.

---

*Dokumen ini disusun sebagai panduan teknis resmi Tahap 2. Seluruh implementasi kode ditangguhkan sampai dokumen ini diperiksa dan disetujui secara eksplisit oleh Pengguna.*
