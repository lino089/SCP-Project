# Rencana Penyelesaian Temuan Kritis Integrasi Frontend–Backend SCP (v1.0)

> **Status Dokumen:** Resmi & Terverifikasi per 31 Oktober 2026.  
> **Tujuan Dokumen:** Dokumen ini mendokumentasikan seluruh **temuan kritis, celah arsitektur (*architectural gaps*), dan potensi ketidaksesuaian kontrak data** yang diidentifikasi dari evaluasi mendalam terhadap [`INTEGRATION_FIX_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/INTEGRATION_FIX_PLAN.md). Dokumen ini melengkapi rencana integrasi yang sudah ada dengan menyajikan **langkah penyelesaian teknis terperinci, kebutuhan penyesuaian berlapis (backend & frontend), rujukan dokumen spesifikasi resmi, serta kriteria keberhasilan yang terukur**.

---

## Daftar Isi

1. [Matriks Pemetaan Temuan Kritis terhadap Fase Integrasi](#1-matriks-pemetaan-temuan-kritis-terhadap-fase-integrasi)
2. [Temuan 1: Ketidaksinkronan Form Manual Siswa (`gender` & `nisn`)](#2-temuan-1-ketidaksinkronan-form-manual-siswa-gender--nisn)
3. [Temuan 2: Ketidaksesuaian Kontrak Data & Broken Mapping pada `ReviewImportPage`](#3-temuan-2-ketidaksesuaian-kontrak-data--broken-mapping-pada-reviewimportpage)
4. [Temuan 3: Integrasi Prasyarat PDF v4.5 & Status Orphaned Code `prerequisiteHelper.js`](#4-temuan-3-integrasi-prasyarat-pdf-v45--status-orphaned-code-prerequisitehelperjs)
5. [Temuan 4: Ketiadaan Eager Loading Relasi Anak pada Profil Orang Tua (`AuthController::me`)](#5-temuan-4-ketiadaan-eager-loading-relasi-anak-pada-profil-orang-tua-authcontrollerme)
6. [Temuan 5: Format Serialisasi `FormData` & Validasi Duplikat pada Izin Guru](#6-temuan-5-format-serialisasi-formdata--validasi-duplikat-pada-izin-guru)
7. [Temuan 6: Residu Default State Kredensial Demo pada `LoginPage`](#7-temuan-6-residu-default-state-kredensial-demo-pada-loginpage)
8. [Matriks Ringkasan Berkas Terdampak & Urutan Eksekusi](#8-matriks-ringkasan-berkas-terdampak--urutan-eksekusi)

---

## 1. Matriks Pemetaan Temuan Kritis terhadap Fase Integrasi

Setiap temuan kritis berakar dari fase tertentu dalam [`INTEGRATION_FIX_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/INTEGRATION_FIX_PLAN.md) dan harus diselesaikan sebelum fase terkait dinyatakan selesai (*definition of done*):

| # | Kode Temuan | Judul Temuan Kritis | Lapisan Terdampak | Fase Terkait di Rencana Induk | Dampak Risiko jika Tidak Ditangani |
|:---:|:---:|---|:---:|:---:|---|
| 1 | **CRIT-01** | `store()` & `update()` manual siswa mengabaikan `gender` dan `nisn` | Backend API & Frontend UI | **Fase 3b (P2)** | Data jenis kelamin & NISN yang diinput manual hilang diam-diam (*silent data loss*). |
| 2 | **CRIT-02** | Properti mapper `ScheduleImportRow` tidak cocok dengan respon riil backend | Frontend Page (`ReviewImportPage`) | **Fase 3c & 4d (P2/P3)** | Seluruh baris preview import PDF tampil rusak (*undefined*) atau terabaikan. |
| 3 | **CRIT-03** | Helper prasyarat PDF belum ter-import dan belum memuat checklist dinamis | Frontend Utility & Page | **Fase 2e (P1)** | Waka tidak mengetahui pemenuhan prasyarat import PDF; upload berisiko gagal di worker. |
| 4 | **CRIT-04** | `AuthController::me` tidak memuat relasi `linkedStudent.schoolClass` | Backend API & Frontend Page | **Fase 2a (P1)** | Dashboard Orang Tua selalu jatuh ke nama siswa dummy (*Aisyah Putri Ramadhani*). |
| 5 | **CRIT-05** | Serialisasi array `schedule_ids` dalam `FormData` & penanganan error 422 duplikat | Frontend Service & Page | **Fase 4a (P3)** | Pengajuan izin guru gagal validasi HTTP 422 di backend atau memicu crash browser. |
| 6 | **CRIT-06** | State awal input form login terisi kredensial dummy Waka | Frontend Page (`LoginPage`) | **Fase 5b (P4)** | Form login terisi otomatis akun waka demo, merusak kesiapan lingkungan produksi. |

---

## 2. Temuan 1: Ketidaksinkronan Form Manual Siswa (`gender` & `nisn`)

### 2.1 Identifikasi Masalah & Analisis Risiko
* **Deskripsi:**  
  Pada [`INTEGRATION_FIX_PLAN.md` Bab 3b Butir 3](file:///D:/MyUKK/SchoolClassProject/INTEGRATION_FIX_PLAN.md#L218-L221), diinstruksikan untuk menambahkan field **Jenis Kelamin** (`gender`: dropdown `'L'` / `'P'`) dan **NISN** (`nisn`: input teks opsional maks 20 digit) pada modal Tambah/Edit Siswa di [`MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx).  
  Namun, pada controller backend [`StudentController.php`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/StudentController.php):
  - Method `import()` ([L80-270](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/StudentController.php#L80-L270)) **sudah** memproses dan menyimpan kolom `gender` serta `nisn`.
  - Method manual `store()` ([L414-435](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/StudentController.php#L414-L435)) dan `update()` ([L463-484](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/StudentController.php#L463-L484)) **hanya** menerima dan memvalidasi `name`, `nis`, dan `class_id`. Kolom `gender` dan `nisn` diabaikan sepenuhnya dalam array pembuatan maupun pembaruan instance model `User`.
* **Rujukan Dokumen Spesifikasi:**
  - [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) Bab 5.4 & 9.3 (Master Data Siswa & Kebutuhan Identitas Nasional NISN).
  - [`scp/MD/NewFeature.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/NewFeature.md) Bab 2.1 & 5.1 (Spesifikasi Ekstensi Kolom Siswa: Jenis Kelamin & NISN).
  - Migrasi Database: [`2026_10_30_000001_add_gender_and_nisn_to_users_table.php`](file:///D:/MyUKK/SchoolClassProject/scp/database/migrations/2026_10_30_000001_add_gender_and_nisn_to_users_table.php).
  - Model Eloquent: [`scp/app/Models/User.php` L24-25](file:///D:/MyUKK/SchoolClassProject/scp/app/Models/User.php#L24-L25) (sudah terdaftar pada attribute `$fillable`).
  - Pengujian Otomatis: [`scp/tests/Feature/UserGenderAndNisnSchemaTest.php`](file:///D:/MyUKK/SchoolClassProject/scp/tests/Feature/UserGenderAndNisnSchemaTest.php).

### 2.2 Rencana Penyelesaian

#### A. Kebutuhan Penyesuaian Backend (`scp/`)
1. **Perbarui `StudentController::store` ([`scp/app/Http/Controllers/API/StudentController.php` L414-458](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/StudentController.php#L414-L458)):**
   - Tambahkan aturan validasi:
     ```php
     'gender' => 'nullable|string|in:L,P',
     'nisn' => [
         'nullable',
         'string',
         'max:20',
         Rule::unique('users', 'nisn')->whereNull('deleted_at'),
     ],
     ```
   - Masukkan atribut ke `User::create`:
     ```php
     'gender' => $request->filled('gender') ? strtoupper(trim($request->gender)) : null,
     'nisn' => $request->filled('nisn') ? trim($request->nisn) : null,
     ```
2. **Perbarui `StudentController::update` ([`scp/app/Http/Controllers/API/StudentController.php` L463-500](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/StudentController.php#L463-L500)):**
   - Tambahkan aturan validasi unik dengan pengecualian ID siswa aktif:
     ```php
     'gender' => 'nullable|string|in:L,P',
     'nisn' => [
         'nullable',
         'string',
         'max:20',
         Rule::unique('users', 'nisn')->ignore($student->id)->whereNull('deleted_at'),
     ],
     ```
   - Perbarui payload `$student->update`:
     ```php
     'gender' => $request->has('gender') ? ($request->gender ? strtoupper(trim($request->gender)) : null) : $student->gender,
     'nisn' => $request->has('nisn') ? ($request->nisn ? trim($request->nisn) : null) : $student->nisn,
     ```
3. **Pembaruan Pengujian Otomatis:**
   - Tambahkan pengujian `test_waka_can_create_student_with_gender_and_nisn` dan `test_waka_can_update_student_gender_and_nisn` pada [`scp/tests/Feature/StudentManagementTest.php`](file:///D:/MyUKK/SchoolClassProject/scp/tests/Feature/StudentManagementTest.php).

#### B. Kebutuhan Penyesuaian Frontend (`frontend/scp_web/`)
1. **Form Tambah & Edit Siswa di [`MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx):**
   - Tambahkan input `gender` dengan pilihan `L` (Laki-laki) dan `P` (Perempuan).
   - Tambahkan input teks `nisn` dengan batasan numerik 10 digit, placeholder `"Contoh: 0081234567"`.
   - Pastikan fungsi `handleOpenEdit` memetakan properti `gender: item.gender || ''` dan `nisn: item.nisn || ''` ke `formData`.
2. **Tabel Data Siswa di [`MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx):**
   - Tampilkan kolom **NISN** dan badge gender (`L` berwarna biru muda, `P` berwarna merah muda/ungu) untuk mempermudah audit data.

### 2.3 Kriteria Keberhasilan & Hasil yang Diharapkan
- Siswa yang dibuat atau diedit secara manual melalui modal form menyimpan nilai `gender` dan `nisn` ke tabel `users`.
- Percobaan input NISN yang duplikat dengan siswa aktif lain memicu respons HTTP 422 dan pesan error tampil pada input NISN di form.
- Integrasi impor Excel maupun input form manual memiliki kesetaraan skema data 100%.

---

## 3. Temuan 2: Ketidaksesuaian Kontrak Data & Broken Mapping pada `ReviewImportPage`

### 3.1 Identifikasi Masalah & Analisis Risiko
* **Deskripsi:**  
  Pada [`ReviewImportPage.jsx` L152-167](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx#L152-L167), mapper data hasil parsing PDF mengasumsikan properti yang **berbeda total dari format JSON yang dikembalikan oleh backend** [`ScheduleImportController::show`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/ScheduleImportController.php#L74-L104):
  
  | Properti yang Dicari Frontend Saat Ini | Properti Aktual dari Backend SCP v4.5 | Keterangan & Sumber Backend |
  |---|---|---|
  | `r.status` atau `r.is_matched` | `r.match_status` | Nilai enum lowercase: `'matched'`, `'unmatched'`, `'conflict'`, `'duplicate'`. |
  | `r.raw_class_name` | `r.matched_class?.name \|\| r.raw_data?.kelas_mentah` | Backend menyimpan data hasil ekstraksi di kolom JSON `raw_data`. |
  | `r.raw_teacher_code` | `r.matched_teacher?.fet_staff_id \|\| r.raw_data?.fet_staff_id` | Kode guru tersimpan di `raw_data.fet_staff_id` atau relasi `matchedTeacher`. |
  | `r.raw_subject_name` | `r.matched_subject?.name \|\| r.raw_data?.mapel_mentah` | Mata pelajaran mentah tersimpan di `raw_data.mapel_mentah`. |
  | `r.raw_room_name` | `r.matched_room?.name \|\| r.raw_data?.ruang_final` | Ruangan mentah tersimpan di `raw_data.ruang_final`. |
  | `r.day` / `r.day_of_week_text` | `r.day_of_week` | Nilai berupa integer `1` (Senin) sampai `5` (Jumat). |
  | `r.is_excluded` | `r.resolved_by_waka && r.match_status === 'duplicate'` | Aksi exclude mengubah status baris menjadi `'duplicate'`. |
  | Pengecekan URL `id === 'latest'` | URL harus memuat numeric ID riil | [`ReviewImportPage.jsx` L145](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx#L145) melakukan abort jika ID bernilai `'latest'`. |

* **Rujukan Dokumen Spesifikasi:**
  - [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) Bab 9.3 (Spesifikasi Preview & Konfirmasi Import Jadwal).
  - [`scp/MD/NewFeature.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/NewFeature.md) Bab 1.2 & 4 (Struktur Staging & Skema JSON Baris Jadwal).
  - Controller: [`ScheduleImportController.php` L74-155](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/ScheduleImportController.php#L74-L155).
  - Job: [`ParseSchedulePdfJob.php` L176-190](file:///D:/MyUKK/SchoolClassProject/scp/app/Jobs/ParseSchedulePdfJob.php#L176-L190).
  - Model: [`ScheduleImportRow.php`](file:///D:/MyUKK/SchoolClassProject/scp/app/Models/ScheduleImportRow.php).

### 3.2 Rencana Penyelesaian

#### A. Kebutuhan Penyesuaian Frontend (`ReviewImportPage.jsx`)
1. **Konversi Nomor Hari ke Teks:**
   - Gunakan kamus hari terpusat:
     ```javascript
     const NUMBER_TO_DAY = { 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu' };
     ```
2. **Refactor Mapper Baris Hasil Impor ([L153-166](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx#L153-L166)):**
   ```javascript
   const mapped = res.data.rows.map((r) => {
     const raw = r.raw_data || {};
     const matchStatus = (r.match_status || 'unmatched').toLowerCase();
     
     // Normalisasi status ke format kapital UI ('Matched', 'Unmatched', 'Conflict', 'Excluded')
     let normalizedStatus = 'Unmatched';
     if (matchStatus === 'matched') normalizedStatus = 'Matched';
     else if (matchStatus === 'conflict') normalizedStatus = 'Conflict';
     else if (matchStatus === 'duplicate') normalizedStatus = 'Excluded';

     return {
       id: r.id,
       day: NUMBER_TO_DAY[r.day_of_week] || 'Senin',
       day_of_week: r.day_of_week,
       period_number: r.period_number || 1,
       duration_periods: r.duration_periods || 1,
       className: r.matched_class?.name || raw.kelas_mentah || 'Kelas Tidak Terpetakan',
       teacherFetId: r.matched_teacher?.fet_staff_id || raw.fet_staff_id || '-',
       teacherName: r.matched_teacher?.name || raw.guru_mentah || 'Guru Tidak Dikenal',
       subjectName: r.matched_subject?.name || raw.mapel_mentah || 'Mata Pelajaran Belum Cocok',
       roomName: r.matched_room?.name || raw.ruang_final || 'Ruang Belum Cocok',
       status: normalizedStatus,
       match_status: matchStatus,
       is_excluded: matchStatus === 'duplicate' || Boolean(r.resolved_by_waka && matchStatus === 'duplicate'),
       room_source_conflict: Boolean(r.room_source_conflict),
     };
   });
   ```
3. **Penyelarasan Navigasi pada [`UploadImportPage.jsx` L287](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/UploadImportPage.jsx#L287):**
   - Pastikan navigasi selalu membawa ID numerik dari respons upload (`res.data.id`), dan tidak pernah melewatkan string literal `'latest'`.
4. **Pembersihan State Awal:**
   - Ganti `useState(FALLBACK_IMPORT_ROWS)` menjadi `useState([])`.

### 3.3 Kriteria Keberhasilan & Hasil yang Diharapkan
- Halaman Review Import memuat seluruh entri jadwal hasil ekstraksi PDF dari tabel database `schedule_import_rows` secara akurat.
- Tab filter status (*Semua, Matched, Unmatched, Conflict*) menghitung kuantitas baris secara presisi sesuai nilai kolom `match_status`.
- Baris yang diexclude ter-update secara atomik ke backend via `PATCH /schedule-imports/{id}/rows/{row_id}` dengan payload `{ exclude: true }`.

---

## 4. Temuan 3: Integrasi Prasyarat PDF v4.5 & Status Orphaned Code `prerequisiteHelper.js`

### 4.1 Identifikasi Masalah & Analisis Risiko
* **Deskripsi:**  
  File [`prerequisiteHelper.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/prerequisiteHelper.js) saat ini sama sekali **tidak di-import oleh halaman mana pun di frontend**.  
  Selain berstatus sebagai *orphaned code*, isi fungsi validator di dalamnya masih mengecek prasyarat penyusunan jadwal manual lama: mewajibkan data kelas, ruangan, mata pelajaran, dan guru.  
  Sesuai arsitektur SCP v4.5 Zero-Manual, berkas PDF FET bertindak sebagai sumber pendaftaran otomatis (*auto-registration*) ruangan belajar dan mata pelajaran. Oleh karena itu, backend [`MasterDataPrerequisiteService::validateForPdfImport`](file:///D:/MyUKK/SchoolClassProject/scp/app/Services/MasterDataPrerequisiteService.php#L39-L70) hanya memeriksa:
  1. Keberadaan minimal 1 siswa aktif.
  2. Keberadaan minimal 1 guru aktif.
  3. Keberadaan minimal 1 guru aktif yang telah memiliki `fet_staff_id`.
* **Rujukan Dokumen Spesifikasi:**
  - [`scp/MD/NewFeature.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/NewFeature.md) Bab 1.1, 1.2 & 4 (Kebijakan Zero-Manual Master Data v4.5).
  - Service Backend: [`scp/app/Services/MasterDataPrerequisiteService.php` L39-70](file:///D:/MyUKK/SchoolClassProject/scp/app/Services/MasterDataPrerequisiteService.php#L39-L70).
  - Test Backend: [`scp/tests/Feature/MasterDataPrerequisiteRuleTest.php`](file:///D:/MyUKK/SchoolClassProject/scp/tests/Feature/MasterDataPrerequisiteRuleTest.php).

### 4.2 Rencana Penyelesaian

#### A. Kebutuhan Penyesuaian Frontend (`prerequisiteHelper.js`)
Refactor [`frontend/scp_web/src/utils/prerequisiteHelper.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/prerequisiteHelper.js) dengan mengekspor dua validator terpisah:
1. `checkPdfImportPrerequisites({ students = [], teachers = [] })`:
   - Mengecek `students.length > 0` (Kriteria: Siswa Aktif).
   - Mengecek `teachers.length > 0` (Kriteria: Guru Aktif).
   - Mengecek `teachers.some(t => t.fet_staff_id && String(t.fet_staff_id).trim() !== '')` (Kriteria: Guru dengan FET ID).
   - Mengembalikan `{ isReady: boolean, missingEntities: string[], checks: { hasStudents, hasTeachers, hasFetStaffId } }`.
2. Pertahankan `checkManualSchedulePrerequisites` untuk kebutuhan penyusunan jadwal manual pada [`ScheduleManagementPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx).

#### B. Kebutuhan Penyesuaian Frontend (`UploadImportPage.jsx`)
1. **Load Data Prasyarat saat Mount ([`UploadImportPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/UploadImportPage.jsx)):**
   - Muat `studentApi.getStudents({ per_page: 1 })` dan `teacherApi.getTeachers({ per_page: 100 })`.
   - Simpan hasil evaluasi prasyarat ke state lokal: `prerequisiteStatus`.
2. **Komponen Banner Checklist Prasyarat:**
   - Tampilkan banner visual di atas formulir upload:
     - [x] Data Siswa Aktif Terdaftar (Jumlah: $N$ siswa).
     - [x] Data Guru & Kode Staf FET Terisi (Jumlah: $M$ guru dengan FET ID).
     - [i] *Catatan: Master Ruangan dan Mata Pelajaran akan didaftarkan secara otomatis oleh sistem saat berkas PDF diproses.*
3. **Proteksi Tombol Unggah:**
   - Nonaktifkan tombol *"Mulai Proses Impor & Ekstraksi"* jika prasyarat PDF belum terpenuhi, disertai tautan langsung untuk mengimpor siswa atau mengisi FET ID guru di halaman Master Data.

### 4.3 Kriteria Keberhasilan & Hasil yang Diharapkan
- Banner prasyarat muncul secara dinamis dan akurat sesuai data riil database.
- Tombol unggah terproteksi dari pengiriman formulir yang berujung error HTTP 422 di server.
- Helper `prerequisiteHelper.js` terintegrasi penuh dan reusable.

---

## 5. Temuan 4: Ketiadaan Eager Loading Relasi Anak pada Profil Orang Tua (`AuthController::me`)

### 5.1 Identifikasi Masalah & Analisis Risiko
* **Deskripsi:**  
  Di [`ParentMonitoringPage.jsx` L23-32](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx#L23-L32), informasi anak diambil dari `user.linkedStudent`:
  ```javascript
  studentName: user?.linkedStudent?.name || user?.child_name || 'Aisyah Putri Ramadhani',
  nis: user?.linkedStudent?.nis_nip || user?.child_nis || '2024001',
  className: user?.linkedStudent?.schoolClass?.name || user?.child_class || 'X-RPL-1',
  ```
  Pada backend [`AuthController::me` L57-65](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/AuthController.php#L57-L65), implementasi saat ini adalah:
  ```php
  $user = $request->user()->load('assignments');
  ```
  Backend **tidak melakukan eager load** terhadap relasi `linkedStudent` beserta rombel kelasnya (`linkedStudent.schoolClass`).  
  Akibatnya, saat akun orang tua login secara riil, `user.linkedStudent` bernilai `undefined`, memicu fallback string hardcoded *"Aisyah Putri Ramadhani"* dan *"X-RPL-1"*.
* **Rujukan Dokumen Spesifikasi:**
  - [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) Bab 5.12, 5.13 & 9.1 (Portal Monitoring Orang Tua & Otomasi Akun Ortu).
  - Controller Backend: [`scp/app/Http/Controllers/API/AuthController.php` L57-65](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/AuthController.php#L57-L65).
  - Model Relasi: [`scp/app/Models/User.php` L109-112](file:///D:/MyUKK/SchoolClassProject/scp/app/Models/User.php#L109-L112) (`public function linkedStudent(): BelongsTo`).

### 5.2 Rencana Penyelesaian

#### A. Kebutuhan Penyesuaian Backend (`scp/app/Http/Controllers/API/AuthController.php`)
Perbarui method `me()` agar memuat relasi siswa bagi pengguna dengan peran orang tua:
```php
public function me(Request $request): JsonResponse
{
    $user = $request->user()->load('assignments');

    if ($user->role === 'parent') {
        $user->load([
            'linkedStudent:id,name,nis_nip,class_id,gender',
            'linkedStudent.schoolClass:id,name,level',
        ]);
    }

    return response()->json([
        'success' => true,
        'message' => 'Data profil berhasil diambil',
        'data' => $user,
    ], 200);
}
```

#### B. Kebutuhan Penyesuaian Frontend (`ParentMonitoringPage.jsx`)
1. Bersihkan fallback string demo hardcoded pada useMemo `child`:
   ```javascript
   const child = useMemo(() => {
     const student = user?.linkedStudent;
     return {
       studentName: student?.name || 'Siswa Belum Ditautkan',
       nis: student?.nis_nip || '-',
       className: student?.schoolClass?.name || 'Kelas Belum Ditentukan',
       guardianName: user?.name || 'Wali Siswa',
       academicYear: '2025/2026 Ganjil',
       isLinked: Boolean(user?.linked_student_id && student),
     };
   }, [user]);
   ```
2. Tambahkan banner peringatan jika akun orang tua belum terhubung ke data siswa manapun di database (`!child.isLinked`).

### 5.3 Kriteria Keberhasilan & Hasil yang Diharapkan
- Akun orang tua yang login menampilkan nama lengkap anak dan kelas riil yang tersimpan di basis data.
- Tidak ada lagi nama dummy *"Aisyah Putri Ramadhani"* atau *"Bambang Sulistyo"* jika data tidak ada di database.

---

## 6. Temuan 5: Format Serialisasi `FormData` & Validasi Duplikat pada Izin Guru

### 6.1 Identifikasi Masalah & Analisis Risiko
* **Deskripsi:**  
  Pengalihan pengajuan izin guru dari `localStorage` ke backend [`TeacherLeaveRequestController::store`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/TeacherLeaveRequestController.php#L114-L199) melibatkan pengiriman berkas surat izin (`attachment`) dan berkas materi tugas siswa (`task_attachment`), sehingga request wajib menggunakan format multipart `FormData`.  
  Pada `TeacherLeaveRequestController.php` L118-124:
  ```php
  if ($request->has('schedule_ids') && is_string($request->input('schedule_ids'))) {
      $decoded = json_decode($request->input('schedule_ids'), true);
      if (is_array($decoded)) {
          $request->merge(['schedule_ids' => $decoded]);
      }
  }
  ```
  Jika frontend mengirim array JavaScript secara naif melalui `formData.append('schedule_ids', idsArray)`, nilai tersebut dapat terkonversi menjadi string koma atau objek invalid yang memicu kegagalan validasi `schedule_ids.* integer`.  
  Selain itu, backend memiliki aturan pencegahan duplikasi ketat ([L155-165](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/TeacherLeaveRequestController.php#L155-L165)) yang menolak izin jika guru telah memiliki izin berstatus `pending` atau `approved` pada tanggal yang sama (HTTP 422).
* **Rujukan Dokumen Spesifikasi:**
  - [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) Bab 5.7 & 9.6 (Penanganan Izin Guru & Delegasi Tugas).
  - [`scp/MD/SCP_MULTIKELAS_KESISWAAN_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/SCP_MULTIKELAS_KESISWAAN_PLAN.md) Bab 2 & 4.1.
  - Controller: [`TeacherLeaveRequestController.php` L114-199](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/TeacherLeaveRequestController.php#L114-L199).
  - Test Backend: [`scp/tests/Feature/TeacherLeaveRequestTest.php`](file:///D:/MyUKK/SchoolClassProject/scp/tests/Feature/TeacherLeaveRequestTest.php).

### 6.2 Rencana Penyelesaian

#### A. Kebutuhan Penyesuaian Frontend Service Layer (`leaveApi.js` atau `teacherLeaveApi.js`)
Buat fungsi service dengan header multipart eksplisit:
```javascript
export const submitTeacherLeaveRequest = async (data) => {
  const formData = new FormData();
  formData.append('date', data.date);
  formData.append('reason', data.reason);

  if (Array.isArray(data.schedule_ids) && data.schedule_ids.length > 0) {
    formData.append('schedule_ids', JSON.stringify(data.schedule_ids.map(Number)));
  }

  if (data.attachment instanceof File) {
    formData.append('attachment', data.attachment);
  }

  if (data.task_instruction) {
    formData.append('task_instruction', data.task_instruction);
  }

  if (data.task_attachment instanceof File) {
    formData.append('task_attachment', data.task_attachment);
  }

  return api.post('/teacher-leave-requests', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
```

#### B. Kebutuhan Penyesuaian Frontend Halaman (`TeacherSchedulePage.jsx`)
1. Hapus total baris penyimpanan `localStorage.setItem('teacher_leave_active', ...)` dan `localStorage.setItem('delegated_classes', ...)`.
2. Tangkap error respons validasi HTTP 422 (terutama jika terjadi duplikasi izin pada tanggal target) dan tampilkan langsung di dalam modal form izin.
3. Tambahkan tab riwayat izin pengajar mandiri yang memanggil `GET /api/teacher-leave-requests` untuk memantau apakah izin sudah disetujui atau ditolak oleh Kesiswaan/Waka.

### 6.3 Kriteria Keberhasilan & Hasil yang Diharapkan
- Permohonan izin guru beserta berkas terunggah ke direktori storage backend (`teacher_leaves/letters` dan `teacher_leaves/tasks`).
- Record izin tersimpan di tabel `teacher_leave_requests` dengan status awal `pending`.
- Notifikasi error yang jelas muncul jika pengajar mengajukan izin lebih dari satu kali pada tanggal yang sama.

---

## 7. Temuan 6: Residu Default State Kredensial Demo pada `LoginPage`

### 7.1 Identifikasi Masalah & Analisis Risiko
* **Deskripsi:**  
  Pada [`LoginPage.jsx` L51-52](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx#L51-L52), inisialisasi state login dideklarasikan sebagai berikut:
  ```javascript
  const [username, setUsername] = useState('12345678');
  const [password, setPassword] = useState('password');
  ```
  Pada rencana pembersihan Fase 5b ([`INTEGRATION_FIX_PLAN.md` Bab 5b](file:///D:/MyUKK/SchoolClassProject/INTEGRATION_FIX_PLAN.md#L319-L325)), hanya diinstruksikan untuk menghapus konstanta `DEMO_PRESETS`, fungsi `handleQuickDemoLogin`, dan tombol pemilihan role demo.  
  Jika inisialisasi state di atas tidak diubah, form login akan tetap otomatis terisi NIP Waka dummy (`12345678`) dan kata sandi dummy (`password`) saat pertama kali dibuka oleh pengguna.
* **Rujukan Dokumen Spesifikasi:**
  - [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) Bab 5.1 & 9.1 (Standar Keamanan Otentikasi & Login Bersih).

### 7.2 Rencana Penyelesaian

#### A. Kebutuhan Penyesuaian Frontend (`LoginPage.jsx`)
1. Ubah inisialisasi state menjadi string kosong:
   ```javascript
   const [username, setUsername] = useState('');
   const [password, setPassword] = useState('');
   ```
2. Hapus seluruh dependensi terhadap `DEMO_PRESETS` dan `selectedDemo`.
3. Tambahkan atribut `autoComplete="username"` dan `autoComplete="current-password"` pada field input.

### 7.3 Kriteria Keberhasilan & Hasil yang Diharapkan
- Halaman login tampil bersih tanpa input dummy otomatis.
- Pengguna wajib memasukkan kredensial NIP/NIS riil mereka sendiri.

---

## 8. Matriks Ringkasan Berkas Terdampak & Urutan Eksekusi

Berikut adalah urutan pelaksanaan perbaikan terintegrasi (Backend + Frontend) yang menggabungkan seluruh temuan kritis ke dalam alur kerja utama:

```mermaid
flowchart TD
    subgraph Tahap 1: Runtime Kritis & Otentikasi Dasar
        T1A["Fase 1a: PATCH /api/me/password & swallow 404"]
        T1B["Fase 1b: Fix import classApi MonitoringRecapPage"]
        T1C["CRIT-04: Eager load linkedStudent di AuthController::me"]
    end

    subgraph Tahap 2: Integritas Data & Prasyarat Zero-Manual v4.5
        T2A["Fase 2a: Nol-kan default presensi ParentMonitoring"]
        T2B["Fase 2b: Bersihkan catch OTP ProfilePage"]
        T2C["Fase 2c & 2d: Hapus guard fallback jadwal & dashboard Waka"]
        T2D["CRIT-03: Refactor prerequisiteHelper & pasang banner di UploadImportPage"]
    end

    subgraph Tahap 3: Master Data & Staging Import
        T3A["CRIT-01: Update StudentController store/update (gender & nisn)"]
        T3B["Fase 3a & 3b: UI Import Excel Guru & Siswa di MasterDataPage"]
        T3C["Fase 3c: Kosongkan initial state FALLBACK_*"]
        T3D["CRIT-02: Fix data mapping ScheduleImportRow di ReviewImportPage"]
    end

    subgraph Tahap 4: Operasional Guru, Multirole & Polling
        T4A["CRIT-05: FormData & JSON schedule_ids di TeacherSchedulePage"]
        T4B["Fase 4b: Panel Verifikasi Izin Guru (Tab 2) & Proteksi Wali Kelas"]
        T4C["Fase 4c: Dukungan multirole Wali Kelas di jadwal/jurnal"]
        T4D["Fase 4d: Polling status riil upload PDF FET"]
    end

    subgraph Tahap 5: Pembersihan Total Demo & Mock Data
        T5A["CRIT-06: Kosongkan state awal username/password di LoginPage"]
        T5B["Fase 5a: Hapus DEMO_PRESETS & Quick Demo Login"]
        T5C["Fase 5b: Hapus Role Switcher UKK di TopBar"]
        T5D["Fase 5c: Hapus seluruh mock dataset di quizApi, leaveApi, journalApi"]
    end

    Tahap 1 --> Tahap 2
    Tahap 2 --> Tahap 3
    Tahap 3 --> Tahap 4
    Tahap 4 --> Tahap 5
```

### Rekapitulasi Berkas yang Wajib Disentuh:

1. **Backend (`scp/`):**
   - [`scp/app/Http/Controllers/API/StudentController.php`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/StudentController.php) — Tambahkan `gender` & `nisn` pada `store()` dan `update()`.
   - [`scp/app/Http/Controllers/API/AuthController.php`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/AuthController.php) — Eager load `linkedStudent.schoolClass` untuk role `parent` di `me()`.
   - [`scp/tests/Feature/StudentManagementTest.php`](file:///D:/MyUKK/SchoolClassProject/scp/tests/Feature/StudentManagementTest.php) — Tambah test case validasi manual `gender` & `nisn`.

2. **Frontend (`frontend/scp_web/`):**
   - [`frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx) — Perbaiki import `classApi`.
   - [`frontend/scp_web/src/context/AuthContext.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx) — Tangani password riil, hapus `loginWithDemo`.
   - [`frontend/scp_web/src/pages/profile/ProfilePage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx) — Hapus swallow 404 password & catch OTP palsu.
   - [`frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx) — Default 0 kehadiran, bersihkan fallback string nama siswa dummy.
   - [`frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx) — Default `[]`, hapus guard dummy.
   - [`frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx) — Default `[]`, hapus guard dummy.
   - [`frontend/scp_web/src/utils/prerequisiteHelper.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/prerequisiteHelper.js) — Implementasi `checkPdfImportPrerequisites`.
   - [`frontend/scp_web/src/pages/waka/UploadImportPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/UploadImportPage.jsx) — Checklist banner prasyarat, polling riil, navigasi numeric ID.
   - [`frontend/scp_web/src/pages/waka/ReviewImportPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx) — Perbaiki data mapping `raw_data`, `match_status`, dan integer hari.
   - [`frontend/scp_web/src/services/masterDataApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js) — Method download template & import Excel guru & siswa.
   - [`frontend/scp_web/src/pages/waka/MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx) — Modal impor Excel, input `gender` & `nisn`, inisialisasi `[]`.
   - [`frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx) — Ganti `localStorage` dengan API `teacher-leave-requests`, selector kelas binaan.
   - [`frontend/scp_web/src/pages/teacher/PermissionVerifyPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/PermissionVerifyPage.jsx) — Tab 2 verifikasi izin guru, proteksi read-only wali kelas.
   - [`frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx) — Sembunyikan aksi `teacher_absent` bagi Wali Kelas murni.
   - [`frontend/scp_web/src/pages/waka/GradePromotionPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/GradePromotionPage.jsx) — Inisialisasi `[]`, hapus simulasi offline.
   - [`frontend/scp_web/src/pages/auth/LoginPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx) — Hapus presets demo, tombol demo, inisialisasi `username`/`password` ke `''`.
   - [`frontend/scp_web/src/components/layout/TopBar.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx) — Hapus dropdown role switcher UKK.
   - [`frontend/scp_web/src/context/authConstants.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/authConstants.js) — Hapus `DEMO_PROFILES`.
   - [`frontend/scp_web/src/services/quizApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/quizApi.js) — Hapus ratusan baris mock data & integrasikan Gemini AI riil.
   - [`frontend/scp_web/src/services/leaveApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/leaveApi.js) — Hapus mock data perizinan siswa.
   - [`frontend/scp_web/src/services/journalApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/journalApi.js) — Hapus mock data jurnal & jadwal.
