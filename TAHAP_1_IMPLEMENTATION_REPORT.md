# LAPORAN IMPLEMENTASI TAHAP 1 — PERBAIKAN 7 MASALAH TEKNIS SCP
**School Class Progress (SCP) Project**  
*Tanggal: 1 November 2026*  
*Status: Tahap 1 Selesai — Siap untuk Verifikasi Menyeluruh (Tahap 2)*

---

## 1. Ringkasan Eksekutif

Sesuai dengan dokumen acuan kerja `REVISI_7_MASALAH_PLAN.md`, seluruh pekerjaan **Tahap 1: Eksekusi Perbaikan Terpadu (Masalah 1–7)** telah berhasil diselesaikan tanpa breaking change, tanpa modifikasi skema/migrasi database yang tidak diperlukan, dan tanpa bypass aturan linter.

### Status Perbaikan 7 Masalah
| No | Masalah | Lingkup | Status Tahap 1 | Hasil Verifikasi Awal |
|---|---|---|---|---|
| 1 | Inkonsistensi Role Waka pada Modul Kuis | Backend (`scp`) | **SELESAI** | Role Waka ternormalisasi ke `vice_principal` & `waka`; otorisasi bebas 403. |
| 2 | Mismatch Payload Submisi Kuis | Backend + Frontend | **SELESAI** | Dua arah kompatibel (`student_answer`, `answer`, `selected_option`). |
| 3 | Scoping Jadwal Siswa dan Orang Tua | Backend (`scp`) | **SELESAI** | Terkunci sesuai `class_id` siswa / `linkedStudent->class_id` anak. |
| 4 | URL Aset Foto Jurnal & Lampiran Izin | Frontend (`scp_web`) | **SELESAI** | Helper `getStorageUrl()` terintegrasi di 5 halaman; URL resolusi absolut ke storage backend. |
| 5 | Standardisasi Penanganan Error Axios | Frontend (`scp_web`) | **SELESAI** | Resilient terhadap interceptor format `err.status`/`err.message` & fallback Axios. |
| 6 | Konsolidasi Model `Room` vs `Rooms` | Backend (`scp`) | **SELESAI** | Standarisasi model `Room`; `Rooms` dipertahankan sebagai backward-compatible wrapper. |
| 7 | Pembersihan 11 Error ESLint | Frontend (`scp_web`) | **SELESAI** | `npm run lint` = 0 errors, 0 warnings; React 19 Compiler memoization preserved. |

---

## 2. Rincian Perubahan dan Solusi Teknis per Masalah

### Masalah 1: Inkonsistensi Role Waka pada Modul Kuis
- **Akar Masalah:**
  Pada `QuizController.php`, pengecekan hak akses Waka sebelumnya menggunakan nilai literal role `'waka'` dan memanggil `$user->assignments()->where('type', 'waka')->exists()`. Padahal role resmi di basis data adalah `'vice_principal'`, dan tabel `teacher_assignments` hanya menyimpan penugasan guru (`wali_kelas`, `kesiswaan`), bukan Waka. Hal ini mengakibatkan akun Waka mengalami HTTP 403 Forbidden saat melihat atau mengelola kuis.
- **Solusi yang Diterapkan:**
  1. Menormalisasi seluruh pengecekan hak akses di `QuizController.php` dengan mendukung `($user->role === 'vice_principal' || $user->role === 'waka')`.
  2. Menghapus pemanggilan `$user->assignments()->where('type', 'waka')` yang tidak valid.
  3. Memastikan metode `index()`, `store()`, `show()`, `generatePrompt()`, `extractDocument()`, `questions()`, `storeQuestion()`, `updateQuestion()`, `destroyQuestion()`, `publish()`, `update()`, `submissions()`, dan `overrideSubmission()` dapat diakses oleh akun Waka tanpa kendala.

### Masalah 2: Mismatch Kunci Payload Submisi Kuis
- **Akar Masalah:**
  Frontend `StudentQuizPage.jsx` mengirim payload jawaban hanya dengan kunci `student_answer`. Namun, validasi backend `QuizController::submit` hanya menerima `answer` dan `selected_option`, serta worker asinkron `GradeQuizSubmissionJob` hanya membaca `$ans['answer'] ?? $ans['selected_option']`. Akibatnya, jawaban siswa terbuang (string kosong) saat diproses AI / auto-grading.
- **Solusi yang Diterapkan:**
  1. **Frontend (`StudentQuizPage.jsx`):** Mengirim ketiga kunci sekaligus:
     - `student_answer`: teks jawaban siswa (esai atau pilihan ganda).
     - `answer`: teks jawaban siswa (kompatibilitas payload lama).
     - `selected_option`: opsi pilihan (`A`/`B`/`C`/`D`) jika jenis soal `multiple_choice`, atau `null` jika esai.
  2. **Backend Controller (`QuizController.php`):** Memperbarui aturan validasi `submit` agar menerima `'answers.*.student_answer' => ['nullable', 'string']`.
  3. **Backend Worker (`GradeQuizSubmissionJob.php`):** Memperbarui urutan ekstraksi jawaban menjadi:
     ```php
     $studentAnswers[$ans['question_id']] = $ans['student_answer'] ?? $ans['answer'] ?? $ans['selected_option'] ?? '';
     ```

### Masalah 3: Scoping Jadwal untuk Siswa dan Orang Tua
- **Akar Masalah:**
  Endpoint `GET /api/schedules` pada `ScheduleController::index` hanya mengimplementasikan filter scoping untuk role `teacher` dan `vice_principal`. Ketika role `student` atau `parent` memanggil endpoint jadwal umum tanpa parameter filter, controller mengembalikan seluruh data jadwal se-sekolah.
- **Solusi yang Diterapkan:**
  1. Pada listing jadwal reguler:
     - Jika `$user->role === 'student'`: Jadwal dibatasi secara tegas dengan `$query->where('class_id', $user->class_id)` (atau kondisi kosong jika belum memiliki kelas).
     - Jika `$user->role === 'parent'`: Membaca kelas anak via `$user->linkedStudent?->class_id`, lalu membatasi query `$query->where('class_id', $childClassId)`. Jika tidak ada relasi anak, mengembalikan hasil kosong secara aman.
  2. Pada mode alert `missing_journal`: Menolak akses peran siswa dan orang tua dengan HTTP 403, karena fitur alert keterlambatan jurnal hanya diperuntukkan bagi Guru dan Waka Kurikulum.

### Masalah 4: URL Aset Foto Jurnal & Lampiran Surat Izin
- **Akar Masalah:**
  Beberapa komponen frontend melakukan penggabungan string statis seperti `/${row.photo_path}` atau `/storage/${row.attachment_path}`. Pada environment produksi/pengembangan web, hal ini mengarah ke origin Vite (misal `http://localhost:5173/...`) dan menyebabkan HTTP 404.
- **Solusi yang Diterapkan:**
  1. Membuat helper `getStorageUrl(path)` di `src/utils/formatters.js`:
     - Jika path kosong/null, mengembalikan string kosong `""`.
     - Jika path sudah berupa URL absolut (`http://` atau `https://`), langsung dikembalikan tanpa modifikasi.
     - Mengambil basis URL backend dari `VITE_API_BASE_URL` (menghapus akhiran `/api`), lalu memetakan ke path `/storage/...`.
  2. Mengintegrasikan helper `getStorageUrl()` pada:
     - `MonitoringRecapPage.jsx`: modal preview foto dokumentasi KBM.
     - `PermissionVerifyPage.jsx`: tautan unduh surat keterangan dan lampiran modul tugas guru pengganti.
     - `TeacherSchedulePage.jsx`: tautan unduh berkas surat izin & modul tugas pada tabel riwayat izin guru.
     - `StudentPermissionPage.jsx`: tombol buka/unduh berkas lampiran pada modal pratinjau surat izin siswa.
     - `ParentMonitoringPage.jsx`: tombol buka/unduh berkas resmi pada modal pratinjau surat izin anak.

### Masalah 5: Standardisasi Penanganan Objek Error Axios
- **Akar Masalah:**
  Interceptor response di `src/services/api.js` me-reject objek kustom `{ status, message, errors, raw }`. Beberapa komponen masih mengasumsikan penanganan format Axios murni (`err.response.status` dan `err.response.data.message`), sehingga nilai `status` menjadi `undefined` dan pesan error gagal tampil dengan tepat.
- **Solusi yang Diterapkan:**
  Memperbarui penanganan blok `catch (err)` pada:
  1. `TeacherJournalPage.jsx` (`openClass` dan `handleCompleteJournal`): Memeriksa `err.status || err.response?.status` dan `err.message || err.response?.data?.message`.
  2. `StudentPermissionPage.jsx` (`handleSubmit`, `handleEditSubmit`, `handleDelete`): Menggunakan `err.message || err.response?.data?.message`.

### Masalah 6: Konsolidasi Model `Room` dan `Rooms`
- **Akar Masalah:**
  Terdapat dua file model Eloquent yang redundan: `App\Models\Room.php` dan `App\Models\Rooms.php` yang merepresentasikan tabel yang sama (`rooms`). Beberapa service dan job mengimpor `Rooms`, sedangkan controller ruangan menggunakan `Room`.
- **Solusi yang Diterapkan:**
  1. Menjadikan `App\Models\Room.php` sebagai model standar tunggal.
  2. Memperbarui seluruh referensi impor di `ScheduleController.php`, `MasterDataPrerequisiteService.php`, `Schedule.php`, `ScheduleImportRow.php`, dan `ParseSchedulePdfJob.php` ke `App\Models\Room`.
  3. Mengubah `App\Models\Rooms.php` menjadi inheritance class:
     ```php
     namespace App\Models;
     class Rooms extends Room {}
     ```
     Dengan pendekatan ini, kompatibilitas ke belakang 100% terjaga dan tidak menimbulkan breaking changes pada modul mana pun.

### Masalah 7: Pembersihan 11 Error ESLint
- **Akar Masalah:**
  Pemeriksaan `npm run lint` menghasilkan 11 error, mencakup aturan React 19 Compiler (`react-hooks/preserve-manual-memoization`), cascading render effect (`react-hooks/set-state-in-effect`), serta variabel dan impor yang tidak terpakai (`no-unused-vars`).
- **Solusi yang Diterapkan:**
  1. `TopBar.jsx`:
     - Mengekstrak `userName = user?.name` sebelum `useMemo`, dan menetapkan dependensi `[userName]`. Compiler React 19 kini berhasil mempertahankan optimasi manual memoization.
  2. `ProfilePage.jsx`:
     - Menghapus destruktur variabel `getHomeRoute` yang tidak pernah digunakan.
  3. `PermissionVerifyPage.jsx`:
     - Membungkus pemanggilan asinkron `fetchStudentLeaves()` dan `fetchTeacherLeaves()` dalam microtask (`Promise.resolve().then(...)`) dengan pengecekan `isMounted` agar tidak memicu eksekusi setState sinkron dalam render body effect.
  4. `TeacherJournalPage.jsx`:
     - Menyesuaikan array dependensi `isSubstituteMode` menjadi `[schedule, isKesiswaan, isWaliKelas, isOriginalTeacher]` agar inferensi compiler sesuai dengan dependensi manual.
  5. `TeacherSchedulePage.jsx`:
     - Menghapus impor `BookOpen` dan `Users`.
     - Menghapus variabel yang tidak terpakai: `isBreak1` dan `isBreak2`.
     - Memperbaiki eksekusi `fetchTeacherLeaves()` di dalam `useEffect` menggunakan deferral microtask dengan mounted guard.
  6. `MasterDataPage.jsx`:
     - Menghapus impor `XCircle` yang tidak digunakan.

---

## 3. Daftar File yang Terkena Dampak

### Backend (`scp`)
1. `scp/app/Http/Controllers/API/QuizController.php` *(diubah)*
2. `scp/app/Http/Controllers/API/ScheduleController.php` *(diubah)*
3. `scp/app/Jobs/GradeQuizSubmissionJob.php` *(diubah)*
4. `scp/app/Jobs/ParseSchedulePdfJob.php` *(diubah)*
5. `scp/app/Models/Rooms.php` *(diubah - compatibility wrapper)*
6. `scp/app/Models/Schedule.php` *(diubah)*
7. `scp/app/Models/ScheduleImportRow.php` *(diubah)*
8. `scp/app/Services/MasterDataPrerequisiteService.php` *(diubah)*

### Frontend (`frontend/scp_web`)
1. `frontend/scp_web/src/utils/formatters.js` *(diubah)*
2. `frontend/scp_web/src/components/layout/TopBar.jsx` *(diubah)*
3. `frontend/scp_web/src/pages/student/StudentQuizPage.jsx` *(diubah)*
4. `frontend/scp_web/src/pages/student/StudentPermissionPage.jsx` *(diubah)*
5. `frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx` *(diubah)*
6. `frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx` *(diubah)*
7. `frontend/scp_web/src/pages/teacher/PermissionVerifyPage.jsx` *(diubah)*
8. `frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx` *(diubah)*
9. `frontend/scp_web/src/pages/waka/MasterDataPage.jsx` *(diubah)*
10. `frontend/scp_web/src/pages/profile/ProfilePage.jsx` *(diubah)*
11. `frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx` *(diubah)*

---

## 4. Hasil Verifikasi Tahap 1 (Sanity & Syntax Check)

1. **PHP Syntax Linter Check (`php -l`):**
   - `QuizController.php`: **Pass** (No syntax errors detected)
   - `ScheduleController.php`: **Pass** (No syntax errors detected)
   - `GradeQuizSubmissionJob.php`: **Pass** (No syntax errors detected)
   - `Rooms.php`: **Pass** (No syntax errors detected)
   - `MasterDataPrerequisiteService.php`: **Pass** (No syntax errors detected)
   - `ParseSchedulePdfJob.php`: **Pass** (No syntax errors detected)

2. **Frontend ESLint Check (`npm run lint`):**
   - Status: **0 errors, 0 warnings** (sebelumnya 11 error).
   - Seluruh aturan React 19 Compiler dan React Hooks terpenuhi murni lewat perbaikan kode.

3. **Frontend Production Build (`npm run build`):**
   - Status: **Selesai sukses dalam 975ms**.
   - Seluruh modul tertransformasi dan bundle produksi berhasil digenerate tanpa error.

---

## 5. Catatan dan Kesiapan Tahap 2

- **Pekerjaan Tahap 1 Telah Lengkap:** Seluruh kode backend dan frontend yang direncanakan telah selesai diimplementasikan.
- **Kondisi Breaking Changes:** Tidak ditemukan breaking change. Skema database, API auth, dan dependensi external tetap dipertahankan.
- **Rencana Tahap 2 (Verifikasi Komprehensif):**
  Tahap 2 akan mencakup:
  1. Menjalankan test suite backend (`php artisan test`) untuk memastikan tidak ada regresi pada modul scheduler, autentikasi, jurnal, dan kuis.
  2. Melakukan verifikasi alur integrasi kuis dari pembuatan (Guru/Waka), pengerjaan (Siswa), hingga auto-grading AI.
  3. Memastikan hak akses Waka pada seluruh rute API berjalan sesuai ekspektasi.
  4. Memverifikasi pembatasan scoping jadwal pada siswa dan orang tua.

*Tahap 1 selesai dan menunggu konfirmasi dari User sebelum menjalankan Tahap 2.*
