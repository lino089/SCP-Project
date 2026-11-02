# RANCANGAN TEKNIS TATA KELOLA MASTER DATA & RESOLUSI KONFLIK DEPENDENSI DATA
**School Control Platform (SCP)**  
*Dokumen Arsitektur & Spesifikasi Solusi CRUD, Relasi, Reset, dan Sinkronisasi Impor*

---

## 1. Ringkasan Permasalahan & Latar Belakang

Sistem School Control Platform (SCP) mengandalkan Master Data sebagai jangkar (*root entity*) dari seluruh aktivitas operasional sekolah. Dalam implementasi sistem akademik terintegrasi, entitas Master Data tidak berdiri sendiri, melainkan menjadi referensi fundamental bagi proses transaksional harian seperti jadwal pelajaran, presensi kehadiran siswa, jurnal mengajar guru, perizinan, hingga evaluasi pembelajaran (kuis otomatis).

### Akar Permasalahan Utama:
1. **Asimetri Kebutuhan Pengguna vs Integritas Relasional Database**:
   * Pengguna (khususnya Waka Kurikulum dan Waka Kesiswaan) memandang data guru, siswa, kelas, dan ruangan sebagai daftar administratif yang sewaktu-waktu perlu diperbarui, diganti, atau dihapus saat terjadi perubahan organisasi sekolah.
   * Di sisi database, baris-baris data tersebut telah mengikat ratusan hingga ribuan rekaman hukum/akademik historis (`journals`, `attendances`, `leave_requests`, `quiz_submissions`).
2. **Ketiadaan *Pre-Flight Dependency Validation***:
   * Eksekusi perintah `DELETE` langsung membentur *Foreign Key Constraint Violation* (`SQLSTATE[23000]: Integrity constraint violation: 1451 Cannot delete or update a parent row`), menghasilkan HTTP status `500 Internal Server Error` yang tidak informatif bagi pengguna.
3. **Bahaya *Cascade Delete* vs Bahaya *Orphan Records***:
   * Mengaktifkan `ON DELETE CASCADE` secara global akan melenyapkan riwayat kehadiran siswa dan jurnal mengajar guru secara permanen saat entitas master dihapus. Hal ini melanggar kepatuhan audit dan akreditasi sekolah.
   * Sebaliknya, menggunakan `ON DELETE SET NULL` menciptakan *orphan rows* (misalnya baris absensi tanpa siswa atau jurnal tanpa guru pengampu) yang merusak agregasi laporan rekapitulasi.
4. **Anomali Siklus Impor PDF Ruangan dan Jadwal**:
   * Proses impor dari `Jadwal_Kelas.pdf` dan `Jadwal_Ruangan.pdf` berpotensi memicu inkonsistensi penamaan string ruangan (misalnya perbedaan spasi/singkatan), yang mengakibatkan duplikasi entitas master ruangan atau memutus relasi jadwal berjalan.
5. **Kebijakan Akses Akun Master Nonaktif**:
   * Diperlukan kepastian keamanan sistem: apabila akun guru atau siswa dinonaktifkan karena mutasi/keluar, sesi login aktif wajib segera diputus (*instant token revocation*) dan akses login ditolak secara langsung.

---

## 2. Pemetaan Komprehensif Relasi & Ketergantungan Antar-Data

Berikut adalah peta menyeluruh keterkaitan relasional dari setiap entitas Master Data terhadap tabel-tabel operasional dan transaksional di dalam sistem SCP.

### 2.1. Matriks Ketergantungan Entitas

| Entitas Master | Tabel DB & Indikator | Entitas Anak Langsung (*Direct Dependents*) | Tabel & Kolom Foreign Key | Tingkat Ketergantungan | Sifat Data Anak |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Guru (Teacher)** | `users`<br>(`role = 'teacher'`) | • Penugasan Guru<br>• Jadwal Pelajaran<br>• Wali Kelas<br>• Jurnal KBM<br>• Kuis Pembelajaran<br>• Cuti/Izin Guru | • `teacher_assignments.teacher_id`<br>• `schedules.teacher_id`<br>• `classes.homeroom_teacher_id`<br>• `journals.teacher_id`<br>• `quizzes.teacher_id`<br>• `teacher_leave_requests.teacher_id` | **Tier 1 (Kritis)** | • Operasional berjalan (`schedules`, `teacher_assignments`)<br>• Historis hukum/akademik (`journals`, `quizzes`, `teacher_leave_requests`) |
| **Siswa (Student)** | `users`<br>(`role = 'student'`) | • Presensi Kehadiran<br>• Pengajuan Izin/Sakit<br>• Lembar Jawaban Kuis<br>• Kode OTP Verifikasi | • `attendances.student_id`<br>• `leave_requests.student_id`<br>• `quiz_submissions.student_id`<br>• `otp_codes.user_id` | **Tier 1 (Kritis)** | • Historis permanen (`attendances`, `leave_requests`, `quiz_submissions`)<br>• Transien temporal (`otp_codes`) |
| **Kelas (Class)** | `classes` | • Anggota Siswa<br>• Penugasan Guru<br>• Jadwal Kelas<br>• Jurnal Kelas<br>• Target Kuis | • `users.class_id`<br>• `teacher_assignments.class_id`<br>• `schedules.class_id`<br>• `journals.class_id`<br>• `quizzes.class_id` / pivot | **Tier 1 (Kritis)** | • Struktur hierarki aktif<br>• Basis penempatan siswa |
| **Ruangan (Room)** | `rooms` | • Jadwal Pelajaran<br>• Jurnal Pembelajaran | • `schedules.room_id`<br>• `journals.room_id` | **Tier 2 (Tinggi)** | • Alokasi fisik ruang belajar |
| **Mata Pelajaran (Subject)** | `subjects` | • Penugasan Guru<br>• Jadwal Pelajaran<br>• Jurnal Mengajar<br>• Kuis & Materi | • `teacher_assignments.subject_id`<br>• `schedules.subject_id`<br>• `journals.subject_id`<br>• `quizzes.subject_id` | **Tier 1 (Kritis)** | • Kurikulum aktif & transkrip kompetensi |
| **Template Jam (Period)** | `period_templates` | • Jadwal Pelajaran | • `schedules.period_template_id` | **Tier 2 (Tinggi)** | • Struktur slot waktu harian |
| **Penugasan (Assignment)** | `teacher_assignments` | • Jadwal Pelajaran | Diperiksa secara logis oleh `MasterDataPrerequisiteService` & `AssignmentMiddleware` | **Tier 2 (Tinggi)** | • Prasyarat legalitas guru mengajar mapel di suatu kelas |

### 2.2. Diagram Alir Ketergantungan Data Relasional

```
                      ┌──────────────────────┐
                      │       classes        │
                      └──────────┬───────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │ (1:N)                 │ (1:N)                 │ (1:N)
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│ users (student) │    │teacher_assignment│    │     schedules     │
└────────┬────────┘    └─────────▲────────┘    └─────────▲─────────┘
         │                       │                       │
         ├──────────────┐        ├──────────────┐        │
         │ (1:N)        │ (1:N)  │              │        │
         ▼              ▼        ▼              ▼        │
┌────────────────┐ ┌───────────────┐  ┌──────────────────┐│
│  attendances   │ │leave_requests │  │     subjects     ││
└────────────────┘ └───────────────┘  └─────────┬────────┘│
         ▲                                      │         │
         │ (1:N)                                │         │
┌────────┴────────┐                             │         │
│    journals     │◄────────────────────────────┼─────────┘
└────────▲────────┘                             │
         │ (1:N)                                │
┌────────┴────────┐                             │
│     quizzes     │◄────────────────────────────┘
└────────┬────────┘
         │ (1:N)
         ▼
┌─────────────────┐
│quiz_submissions │
└─────────────────┘
```

---

## 3. Analisis Potensi Konflik, Akar Masalah & Dampak Sistemik

### 3.1. Kasus Data Guru (`users.role = 'teacher'`)
* **Skenario Masalah**: Waka menghapus akun guru yang pindah tugas atau memutasi guru di tengah semester.
* **Akar Masalah**: ID guru tertaut pada `teacher_assignments`, baris `schedules` yang aktif di kalender siswa, serta rekaman `journals` dan `quizzes`.
* **Dampak Sistemik**:
  * Jika menggunakan `RESTRICT` tanpa proteksi aplikasi: Terjadi error database 500 saat Waka menekan tombol delete.
  * Jika menggunakan `CASCADE`: Seluruh jurnal pembelajaran yang telah dibuat guru terhapus, menghilangkan bukti rekam jejak kerja guru untuk perhitungan tunjangan dan akreditasi.
  * Jika menggunakan `SET NULL`: Jurnal KBM kehilangan identitas pengampu (`teacher_id = NULL`), menghasilkan kekacauan laporan supervisi akademik.

### 3.2. Kasus Data Siswa (`users.role = 'student'`)
* **Skenario Masalah**: Siswa mutasi keluar sekolah, mengundurkan diri, atau terjadi kesalahan input ganda oleh staf tata usaha.
* **Akar Masalah**: ID siswa menjadi foreign key di tabel `attendances`, `leave_requests`, dan `quiz_submissions`.
* **Dampak Sistemik**:
  * Penghapusan siswa yang sudah memiliki riwayat presensi akan mengubah persentase agregasi kehadiran pada `MonitoringRecapPage`.
  * Lembar pengerjaan kuis siswa ikut lenyap, menyebabkan nilai statistik kelas pada guru mata pelajaran bergeser secara tidak valid.

### 3.3. Kasus Data Ruangan (`rooms`)
* **Skenario Masalah**: Ruangan dinonaktifkan untuk renovasi, atau terjadi re-impor berkas PDF `Jadwal_Ruangan.pdf`.
* **Akar Masalah**: String nama ruangan pada PDF (misalnya "R. Lab 01" vs "Lab Komputer 1") sering kali tidak konsisten.
* **Dampak Sistemik**:
  * Re-impor PDF membuat record ruangan baru di tabel `rooms`, meninggalkan ruangan lama dalam kondisi terbengkalai.
  * Deteksi bentrok jadwal pada `ScheduleConflictService` gagal mendeteksi tabrakan ruang fisik karena sistem menganggap "R. Lab 01" dan "Lab Komputer 1" adalah dua ruangan yang berbeda.

### 3.4. Kasus Data Kelas (`classes`) & Mata Pelajaran (`subjects`)
* **Skenario Masalah**: Perubahan kurikulum yang menghapus suatu mata pelajaran, atau restrukturisasi rombel kelas.
* **Akar Masalah**: Menjadi simpul percabangan (*hub*) bagi penugasan guru, alokasi siswa, jadwal, dan jurnal.
* **Dampak Sistemik**: Menghapus satu kelas secara paksa akan memutuskan status rombel puluhan siswa sekaligus, menyebabkan modul absensi dan modul kenaikan kelas (`GradePromotionPage`) mengalami anomali *unassigned student*.

---

## 4. Analisis Alternatif Solusi Arsitektural

| Opsi Pendekatan | Cara Kerja | Kelebihan | Kelemahan | Kesimpulan |
| :--- | :--- | :--- | :--- | :--- |
| **Opsi 1: Pure Hard Delete & ON DELETE CASCADE** | Menghapus langsung baris master di database, dan membiarkan DBMS menghapus seluruh data anak secara berantai. | Implementasi sangat cepat dan tidak memerlukan logic pengecekan di backend. | **Bencana Kehilangan Data**: Menghapus riwayat legal (jurnal, absensi, nilai) secara permanen. | **DITOLAK** |
| **Opsi 2: Pure Restrict (ON DELETE RESTRICT)** | Menolak mutlak penghapusan di level foreign key jika ID master masih dirujuk. | Menjamin integritas referensial 100% dan mencegah data hilang. | Pengalaman pengguna (UX) sangat buruk: Waka tidak bisa membersihkan data guru/siswa nonaktif tanpa menghapus ribuan riwayat transaksi satu per satu. | **TIDAK CUKUP** |
| **Opsi 3: Generic Soft Delete (`deleted_at`)** | Menggunakan trait `SoftDeletes` pada semua model Master Data. | Data fisik tidak hilang, relasi historis tetap terjaga di level foreign key. | Masalah konflik *Unique Index* (misal: NIP atau NISN yang sama tidak bisa didaftarkan ulang jika record lama hanya di-soft-delete). | **PERLU MODIFIKASI** |
| **Opsi 4: Hybrid Governance Model (Rekomendasi)** | Mengombinasikan **Pre-flight Dependency Checking**, **Deaktivasi Operasional (`is_active`)**, **Instant Token Revocation**, dan **Safe Hard Delete Bersyarat**. | • Integritas historis 100% aman.<br>• UX jelas & transparan (memberikan rincian dependensi).<br>• Keamanan akun terjamin (blokir login & pemutusan sesi instan). | Membutuhkan pembuatan Service terdedikasi dan sedikit penyesuaian modal dialog frontend. | **DIPILIH** |

---

## 5. Rekomendasi Solusi Terbaik: *Hybrid Data Governance Model*

Model tata kelola yang direkomendasikan adalah **Hybrid Data Governance Model**, yang memadukan proteksi integritas level database dengan fleksibilitas alur kerja institusi sekolah:

```
                                  [AKSI PENGGUNA: HAPUS MASTER DATA]
                                                   │
                                                   ▼
                                 [MasterDataDependencyService]
                                 Mengecek seluruh relasi tabel
                                                   │
                 ┌─────────────────────────────────┴─────────────────────────────────┐
                 ▼                                                                   ▼
       [TIDAK MEMILIKI RELASI]                                            [MEMILIKI KETERGANTUNGAN]
       (Data baru/salah input)                                                       │
                 │                                           ┌───────────────────────┴───────────────────────┐
                 ▼                                           ▼                                               ▼
         [HARD DELETE AMAN]                        [HANYA RELASI OPERASIONAL]                             [MEMILIKI REKAM HISTORIS LEGAL]
      Record dihapus permanen                      (Terkait Jadwal/Penugasan Aktif,                       (Ada Jurnal KBM, Presensi Siswa,
         dari database                                Belum Ada Jurnal/KBM)                                  Nilai Kuis, Catatan Izin)
                                                             │                                                               │
                                                             ▼                                                               ▼
                                                   [PERINGATAN DEPENDENSI]                                         [BLOKIR HARD DELETE]
                                                Tampilkan dialog rincian jadwal;                                Sediakan Tombol Aksi:
                                                Tawarkan opsi "Lepas Jadwal Dulu"                               "Nonaktifkan Entitas"
                                                atau "Batalkan Aksi"                                            (`is_active = false`)
                                                                                                                             │
                                                                                                                             ▼
                                                                                                                [EKSEKUSI DEAKTIVASI AMAN]
                                                                                                                1. Set `is_active = false`
                                                                                                                2. Cabut semua token sesi login
                                                                                                                3. Blokir percobaan login baru
                                                                                                                4. Sembunyikan dari dropdown aktif
                                                                                                                5. Pertahankan seluruh arsip lama
```

### Pilar Kebijakan Bisnis & Teknis:
1. **Pemisahan Antara "Data Kotor / Salah Input" vs "Data Historis Sekolah"**:
   * Jika data guru, siswa, ruangan, atau mapel baru dibuat dan belum pernah digunakan dalam KBM, sistem **mengizinkan Hard Delete** agar database tetap bersih.
   * Jika data sudah memiliki rekam jejak KBM (jurnal, presensi, kuis), sistem **secara mutlak memblokir penghapusan fisik**, dan mengalihkannya ke mekanisme **Deaktivasi Operasional (`is_active = false`)**.
2. **Pemutusan Sesi & Pemblokiran Login Instan (*Instant Token Revocation*)**:
   * Sesuai keputusan arsitektur: Begitu akun guru atau siswa diubah statusnya menjadi nonaktif (`is_active = false`), sistem secara atomik mencabut seluruh token Sanctum yang aktif (`$user->tokens()->delete()`).
   * Pada alur login (`AuthController`), sistem memeriksa flag `is_active`. Jika bernilai `false`, sistem langsung menolak autentikasi dengan status **HTTP 403 Forbidden** dan pesan eksplisit: *"Akun Anda telah dinonaktifkan. Silakan hubungi pihak tata usaha/Waka sekolah."*
3. **Penyaringan Otomatis pada Fitur Berjalan (*Scoped Active Query*)**:
   * Master data yang nonaktif otomatis disaring keluar dari dropdown pembuatan jadwal baru, form penugasan guru, dan presensi aktif harian.
   * Namun, ketika Waka atau Guru membuka rekap presensi bulan lalu, riwayat jurnal semester lalu, atau transkrip nilai kuis, data entitas nonaktif tetap muncul dengan label visual `[Nonaktif]` atau `[Alumni/Mutasi]` tanpa menyebabkan broken relation.

---

## 6. Spesifikasi Teknis Rancangan Mekanisme (CRUD, Safe Delete, Scoped Reset, Safe Import)

### 6.1. Spesifikasi Pre-Flight Dependency Checker (`MasterDataDependencyService`)

Service ini bertindak sebagai gerbang validasi sebelum operasi penghapusan atau perubahan status dijalankan.

#### Struktur Kontrak Respons Dependency Check (`/api/master/{entity}/{id}/dependencies`):
```json
{
  "success": true,
  "data": {
    "entity_id": 14,
    "entity_name": "Drs. Bambang Sudarmono",
    "entity_type": "teacher",
    "is_active": true,
    "can_hard_delete": false,
    "has_historical_records": true,
    "summary": "Data guru tidak dapat dihapus karena memiliki 42 riwayat jurnal mengajar dan 3 kuis aktif.",
    "dependencies": {
      "teacher_assignments": {
        "count": 2,
        "is_historical": false,
        "description": "2 penugasan kelas aktif"
      },
      "schedules": {
        "count": 6,
        "is_historical": false,
        "description": "6 slot jadwal pelajaran aktif"
      },
      "classes_as_homeroom": {
        "count": 1,
        "is_historical": false,
        "description": "Wali kelas aktif di XII TKJ 1"
      },
      "journals": {
        "count": 42,
        "is_historical": true,
        "description": "42 catatan jurnal pembelajaran KBM"
      },
      "quizzes": {
        "count": 3,
        "is_historical": true,
        "description": "3 kuis pembelajaran dibuat"
      }
    },
    "suggested_action": "deactivate"
  }
}
```

### 6.2. Logika Safe Delete pada Controller Master Data

Implementasi pada controller (contoh: `TeacherController`):
```php
public function destroy(int $id, MasterDataDependencyService $dependencyService): JsonResponse
{
    $teacher = User::where('role', 'teacher')->findOrFail($id);
    $check = $dependencyService->checkTeacherDependencies($teacher->id);

    if (!$check['can_hard_delete']) {
        return response()->json([
            'message' => 'Data tidak dapat dihapus karena memiliki ketergantungan relasi.',
            'dependency_report' => $check,
            'suggestion' => 'Gunakan opsi nonaktifkan (deactivate) agar riwayat akademik tetap terjaga.'
        ], Response::HTTP_CONFLICT); // 409 Conflict
    }

    // Jika clean dari dependensi, lakukan hard delete aman dalam transaksi
    DB::transaction(function () use ($teacher) {
        $teacher->tokens()->delete();
        $teacher->delete();
    });

    return response()->json([
        'message' => 'Data guru berhasil dihapus permanen karena tidak memiliki data turunan.'
    ]);
}
```

### 6.3. Logika Deaktivasi & Pemblokiran Login Instan

Endpoint: `POST /api/master/{entity}/{id}/toggle-status`

```php
public function toggleStatus(int $id): JsonResponse
{
    return DB::transaction(function () use ($id) {
        $user = User::findOrFail($id);
        $user->is_active = !$user->is_active;
        $user->save();

        // JIKA STATUS MENJADI NONAKTIF: Cabut seluruh sesi aktif seketika
        if (!$user->is_active) {
            $user->tokens()->delete();
        }

        return response()->json([
            'message' => $user->is_active ? 'Entitas berhasil diaktifkan kembali.' : 'Entitas dinonaktifkan dan seluruh sesi login aktif telah dicabut.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'is_active' => $user->is_active
            ]
        ]);
    });
}
```

#### Modifikasi pada `AuthController::login`:
```php
// Di dalam AuthController.php setelah verifikasi password berhasil:
if (!$user->is_active) {
    return response()->json([
        'message' => 'Akun Anda telah dinonaktifkan. Silakan hubungi pihak tata usaha/Waka sekolah untuk informasi lebih lanjut.'
    ], Response::HTTP_FORBIDDEN); // 403 Forbidden
}
```

### 6.4. Mekanisme Reset Bertingkat (*Scoped Academic Reset*)

Aksi reset Master Data dibagi menjadi 3 cakupan operasional terkendali melalui `AcademicResetService` dengan proteksi autentikasi kata sandi ganda:

#### 1. Scope: `RESET_TRIAL_DATA` (Pembersihan Data Uji Coba)
* **Kebutuhan**: Saat sekolah selesai melakukan pelatihan/simulasi sistem sebelum tahun ajaran dimulai.
* **Tabel yang Dibersihkan**:
  * `attendances` (Presensi uji coba)
  * `journals` (Jurnal mengajar simulasi)
  * `quiz_submissions` & `quiz_questions` & `quizzes` (Kuis uji coba)
  * `leave_requests` & `teacher_leave_requests` (Izin uji coba)
* **Status Master Data**: Guru, Siswa, Kelas, Ruangan, Mapel, dan Jadwal tetap utuh 100%.

#### 2. Scope: `RESET_SEMESTER_SCHEDULE` (Pergantian Semester)
* **Kebutuhan**: Akhir semester di mana struktur jadwal mata pelajaran berubah total, namun master guru dan siswa tetap.
* **Prasyarat**: Laporan rekap presensi dan jurnal semester berjalan telah dikunci/dicatat statusnya.
* **Tabel yang Dibersihkan**:
  * `schedule_import_rows` & `schedule_imports` (Staging impor lama)
  * `schedules` (Jadwal operasional semester lama diarsipkan/dibersihkan)
  * `teacher_assignments` (Penugasan mengajar lama dilepas)
* **Status Master Data**: Seluruh data master guru, ruangan, kelas, dan siswa tetap aman. Riwayat jurnal masa lalu tetap mengacu pada `journals` yang sudah memiliki snapshot data.

#### 3. Scope: `CLASS_PROMOTION_AND_GRADUATION` (Siklus Kenaikan Kelas Tahunan)
* **Kebutuhan**: Tutup tahun ajaran.
* **Alur Eksekusi**:
  * Siswa kelas 12: Ditandai status `graduated = true`, `is_active = false`, dicabut sesi login-nya.
  * Siswa kelas 10 & 11: Dipromosikan ke tingkat berikutnya (`grade_level + 1`) ke kelas tujuan sesuai mapping Waka.
  * Siswa tidak naik kelas: Ditandai dengan `is_held_back = true` dan tetap di tingkat yang sama.
  * Seluruh mutasi dicatat dalam tabel `cycle_history`.

### 6.5. Mekanisme Impor Master Data & Jadwal yang Aman

Untuk menghindari konflik duplikasi entitas master ruangan dan guru saat proses ekstraksi PDF:

1. **Normalisasi String & Alias Matching**:
   * Nama ruangan diubah menjadi bentuk kanonikal: *lowercase*, menghapus tanda baca titik/strip, dan spasi tunggal (contoh: `"R. LAB-01"` -> `"lab 01"`).
   * Pada tabel `rooms`, sediakan kolom `alias_codes` (JSON array), misalnya: `["lab kom 1", "lab komputer 1", "r.lab 1"]`.
2. **Prinsip Upsert (Bukan Drop-and-Recreate)**:
   * Proses impor tidak boleh menghapus tabel master `rooms` atau `users`.
   * Sistem mencocokkan ruangan dari PDF berdasarkan kode/alias. Jika ditemukan, gunakan `id` yang sudah ada.
   * Jika ditemukan nama ruangan baru yang belum terdaftar: Simpan ke tabel staging `schedule_import_rows` dengan status `UNRESOLVED_ROOM`.
   * Frontend menampilkan antarmuka *Resolution Mapping Dialog* agar Waka dapat memilih:
     * Opsi A: *"Petakan 'R. Komputer Baru' ke ruangan yang sudah ada: [Dropdown Ruangan]"*
     * Opsi B: *"Buat ruangan baru di master data dengan nama tersebut."*

---

## 7. Diagram Alir Kerja Sistem Setelah Solusi Diterapkan

### 7.1. Alur Penghapusan & Deaktivasi Master Data

```
[Waka membuka Master Data Page]
               │
               ▼
   [Klik Icon / Tombol "Hapus"]
               │
               ▼
[Request: GET /api/master/{type}/{id}/dependencies]
               │
               ├──────────────────────────────────────────┐
               ▼                                          ▼
   [can_hard_delete == true]                  [can_hard_delete == false]
               │                                          │
               ▼                                          ▼
    [Modal Konfirmasi Standar]                 [Buka DeleteConflictDialog]
    "Data belum memiliki relasi.               Menampilkan ringkasan:
     Hapus data secara permanen?"              - X Jurnal Pembelajaran
               │                               - Y Catatan Kehadiran
               ├──────────────────┐            - Z Jadwal Aktif
               ▼                  ▼                       │
          [Klik Batal]       [Klik Hapus]                 ├─────────────────────────────────┐
               │                  │                       ▼                                 ▼
            [Batal]               ▼                  [Klik Batal]              [Klik "Nonaktifkan Entitas"]
                          [DELETE /api/...]                                                 │
                          (Record Dihapus)                                                  ▼
                                                                               [POST /api/.../toggle-status]
                                                                               1. Update `is_active = false`
                                                                               2. Revoke Sanctum Tokens
                                                                               3. Tutup Modal & Refresh Table
```

### 7.2. Alur Login Guard untuk Akun Nonaktif

```
               [Siswa / Guru Membuka Login Page]
                               │
                               ▼
            [Input Identitas & Password Akun]
                               │
                               ▼
                   [POST /api/auth/login]
                               │
                               ▼
               [Kredensial Password Cocok?]
                               │
                ┌──────────────┴──────────────┐
                ▼ TIDAK                       ▼ YA
      [HTTP 401 Unauthorized]       [Periksa User->is_active]
                                              │
                               ┌──────────────┴──────────────┐
                               ▼ FALSE                       ▼ TRUE
                     [HTTP 403 Forbidden]          [Generate Sanctum Token]
                     "Akun Anda telah              "Login Berhasil"
                     dinonaktifkan..."             Masuk ke Dashboard
```

---

## 8. Daftar Rinci File, Tabel, Model, Service, dan Endpoint yang Perlu Disesuaikan

### 8.1. Database Migrations
* `scp/database/migrations/2026_11_02_000001_add_is_active_to_master_tables.php`:
  * Menambahkan kolom `is_active` (boolean, default true) pada tabel `users`, `rooms`, `classes`, dan `subjects`.
  * Menambahkan index `['role', 'is_active']` pada `users`.
* `scp/database/migrations/2026_11_02_000002_add_aliases_to_rooms_table.php`:
  * Menambahkan kolom `aliases` (json, nullable) pada tabel `rooms` untuk normalisasi parser PDF.

### 8.2. Backend Models (`/scp/app/Models/`)
* `User.php`:
  * Tambahkan cast `'is_active' => 'boolean'`.
  * Tambahkan `scopeActive($query)`.
  * Definisikan relasi: `teacherAssignments()`, `schedules()`, `journals()`, `attendances()`, `leaveRequests()`, `quizzes()`.
* `Room.php` / `Rooms.php`:
  * Standarisasi penamaan model (gunakan satu model tunggal `Room.php` dengan table reference `rooms`).
  * Tambahkan `scopeActive($query)` dan relasi `schedules()`.
* `Classes.php`:
  * Tambahkan `scopeActive($query)`, relasi `students()`, `teacherAssignments()`, `schedules()`.
* `Subject.php`:
  * Tambahkan `scopeActive($query)`, relasi `teacherAssignments()`, `schedules()`, `quizzes()`.

### 8.3. Backend Services (`/scp/app/Services/`)
* `scp/app/Services/MasterDataDependencyService.php` **(BARU)**:
  * Berisi logika inspeksi dependensi untuk `teacher`, `student`, `room`, `class`, dan `subject`.
* `scp/app/Services/AcademicResetService.php` **(BARU)**:
  * Menjalankan operasi reset terkendali per cakupan (*Trial, Schedule, Academic Year*) dalam balutan `DB::transaction`.
* `scp/app/Services/ScheduleConflictService.php`:
  * Penyesuaian agar hanya memeriksa konflik pada ruangan dan guru yang berstatus aktif.
* `scp/app/Jobs/ParseSchedulePdfJob.php`:
  * Integrasi alias matching ruangan sebelum menyimpan ke `schedule_import_rows`.

### 8.4. Backend Controllers & Endpoints (`/scp/app/Http/Controllers/API/`)
* `AuthController.php`:
  * Menambahkan pengecekan `!$user->is_active` saat proses login.
* `TeacherController.php`, `StudentController.php`, `RoomController.php`, `SchoolClassController.php`, `SubjectController.php`:
  * Memodifikasi method `destroy()` agar memanggil `MasterDataDependencyService`.
  * Menambahkan method `toggleStatus(Request $request, $id)`.
  * Menambahkan method `checkDependencies($id)`.
* `WakaResetController.php` **(BARU)**:
  * Endpoint aman: `POST /api/waka/reset-scoped` dengan validasi password Waka.

#### Ringkasan Endpoint Baru:
| Method | Endpoint | Deskripsi | Hak Akses |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/master/{entity}/{id}/dependencies` | Memeriksa detail ketergantungan relasi sebelum hapus | Waka |
| `POST` | `/api/master/{entity}/{id}/toggle-status` | Mengaktifkan / Menonaktifkan entitas & revoke token | Waka |
| `POST` | `/api/waka/reset-scoped` | Menjalankan reset terkendali dengan verifikasi sandi | Waka |

### 8.5. Frontend Web (`/frontend/scp_web/`)
* `src/services/masterDataApi.js`:
  * Tambahkan fungsi `checkDependencies(entity, id)`, `toggleStatus(entity, id)`, dan `executeScopedReset(payload)`.
* `src/pages/waka/MasterDataPage.jsx`:
  * Tambahkan kolom status `Badge` (Aktif / Nonaktif).
  * Update tombol aksi: Aksi hapus memicu pengecekan dependensi terlebih dahulu.
  * Tambahkan tombol "Nonaktifkan / Aktifkan".
* `src/pages/waka/components/DeleteConflictDialog.jsx`:
  * Perbarui agar menampilkan visual breakdown relasi secara elegan dan menyediakan opsi de-aktivasi instan.
* `src/components/shared/ConfirmDialog.jsx`:
  * Tambahkan varian dialog bertipe `DangerWithAlternative` (Hapus vs Nonaktifkan).

---

## 9. Roadmap & Tahapan Implementasi Bertahap

```
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 1: DEPENDENCY CHECKER & RESTRUKTURISASI DESTROY (PRIORITAS 1)     │
│ Target: Mencegah SQLSTATE Error 500 dan melindungi data historis       │
│ • Buat MasterDataDependencyService.php                                 │
│ • Tambahkan endpoint GET /api/master/{entity}/{id}/dependencies        │
│ • Refactor method destroy() pada semua Controller Master Data          │
│ • Hubungkan DeleteConflictDialog.jsx di Frontend Waka                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 2: DEAKTIVASI ENTITAS & PEMUTUSAN SESI INSTAN (PRIORITAS 1)       │
│ Target: Menyediakan jalan keluar bagi Waka untuk mutasi guru/siswa     │
│ • Migrasi kolom is_active pada users, rooms, classes, subjects         │
│ • Implementasikan POST /api/master/{entity}/{id}/toggle-status         │
│ • Pasang revocation: $user->tokens()->delete() saat deaktivasi         │
│ • Tambahkan login guard pada AuthController.php (403 Forbidden)        │
│ • Tambahkan toggle switch dan filter status di Frontend MasterDataPage │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 3: IMPORT HARDENING & NORMALISASI RUANGAN (PRIORITAS 2)           │
│ Target: Mencegah duplikasi data ruangan saat re-impor jadwal           │
│ • Migrasi kolom aliases pada tabel rooms                               │
│ • Perbaiki parsing PDF agar mencocokkan alias nama ruangan             │
│ • Sediakan dialog Resolution Mapping di Frontend ReviewImportPage      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 4: SCOPED RESET PIPELINE & AUDIT TRAIL (PRIORITAS 3)              │
│ Target: Mekanisme reset semester dan tahun ajaran baru yang aman       │
│ • Buat AcademicResetService.php                                        │
│ • Pasang proteksi password konfirmasi ganda pada WakaResetController   │
│ • Buat antarmuka manajemen reset di halaman Dashboard Waka             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Matriks Skenario Pengujian (*Test Matrix & Automated Assertions*)

Untuk menjamin tidak ada regresi atau celah kerusakan data, rangkaian pengujian otomatis (*Feature Tests*) berikut wajib diimplementasikan di `/scp/tests/Feature/MasterDataSafetyTest.php`:

| ID Tes | Kategori | Skenario Uji | Kondisi Awal | Aksi yang Dijalankan | Hasil yang Diharapkan (*Assertions*) |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Guru | Hapus guru tanpa relasi apa pun | Guru baru terdaftar, belum punya jadwal/jurnal | `DELETE /api/teachers/{id}` | • HTTP 200 OK.<br>• Record guru terhapus dari tabel `users`. |
| **TC-02** | Guru | Hapus guru yang memiliki catatan jurnal | Guru memiliki 10 riwayat jurnal KBM | `DELETE /api/teachers/{id}` | • **HTTP 409 Conflict**.<br>• Data guru tetap ada di database.<br>• Payload JSON menyertakan detail 10 jurnal. |
| **TC-03** | Keamanan | Deaktivasi guru & pemutusan sesi | Guru sedang login (memiliki Sanctum token aktif) | `POST /api/teachers/{id}/toggle-status` | • `users.is_active` menjadi `false`.<br>• Seluruh token di `personal_access_tokens` terhapus.<br>• Request berikutnya dengan token lama menghasilkan **HTTP 401 Unauthorized**. |
| **TC-04** | Keamanan | Percobaan login oleh akun nonaktif | Siswa/Guru berstatus `is_active = false` | `POST /api/auth/login` (email & password benar) | • **HTTP 403 Forbidden**.<br>• Pesan: *"Akun Anda telah dinonaktifkan..."*.<br>• Token baru tidak diterbitkan. |
| **TC-05** | Siswa | Hapus siswa yang memiliki absensi | Siswa memiliki 20 catatan di `attendances` | `DELETE /api/students/{id}` | • **HTTP 409 Conflict**.<br>• Record siswa dan absensi tidak boleh terhapus. |
| **TC-06** | Ruangan | Hapus ruangan yang sedang dipakai jadwal | Ruangan terdaftar di jadwal aktif hari Selasa | `DELETE /api/rooms/{id}` | • **HTTP 409 Conflict**.<br>• Menampilkan slot jadwal yang menggunakan ruangan tersebut. |
| **TC-07** | Impor | Re-impor PDF jadwal dengan ruangan yang sama | Ruangan "Lab Komputer" sudah ada di database | Jalankan job `ParseSchedulePdfJob` dengan file PDF | • ID ruangan lama tetap dipertahankan.<br>• Tidak ada pembuatan record ruangan duplikat di tabel `rooms`. |
| **TC-08** | Reset | Reset jadwal semester baru | Terdapat data presensi semester lalu & jadwal aktif | Eksekusi `POST /api/waka/reset-scoped` (scope: schedule) | • Jadwal direset/dikosongkan.<br>• Master guru, siswa, kelas tetap aman.<br>• Riwayat jurnal dan absensi semester lalu tidak terhapus. |
| **TC-09** | Transaksi | Kegagalan di tengah operasi batch | Mengirim mutasi batch dengan 1 baris invalid | Eksekusi endpoint batch update | • Transaksi DB dibatalkan secara total (`DB::rollBack`).<br>• Tidak ada record yang tersimpan setengah-setengah (*Zero Partial Writes*). |