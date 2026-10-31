# Rencana Implementasi Terperinci: Tahap 4 — Testing & Validasi Sistem (Quality Assurance & Zero-Regression)

**Dokumen Rencana:** `MD/TAHAP_4_IMPLEMENTATION_PLAN.md`  
**Proyek:** School Class Progress (SCP) — Backend REST API  
**Versi Target:** SCP v4.5 (Ekstensi Multirole Guru & Kesiswaan — Tahap 4)  
**Dokumen Acuan:** `MD/SCP_MULTIKELAS_KESISWAAN_PLAN.md` (Bab 4, Bab 5, Bab 6, Bab 7 Tahap 4, Bab 8), `MD/TAHAP_1_IMPLEMENTATION_PLAN.md`, `MD/TAHAP_2_IMPLEMENTATION_PLAN.md`, `MD/TAHAP_3_IMPLEMENTATION_PLAN.md`  
**Peran:** Senior Laravel Backend Developer & Software QA Engineer  
**Status Dokumen:** Usulan Rencana Detail (Menunggu Persetujuan Pengguna Sebelum Eksekusi)  

---

## DAFTAR ISI

1. [Tujuan dan Ruang Lingkup Tahap 4](#1-tujuan-dan-ruang-lingkup-tahap-4)
2. [Kondisi Aktual Implementasi Tahap 1–3 (Fakta Pemeriksaan)](#2-kondisi-aktual-implementasi-tahap-13-fakta-pemeriksaan)
3. [Daftar 27 Skenario Pengujian Kanonikal & Pemetaan Berkas Test](#3-daftar-27-skenario-pengujian-kanonikal--pemetaan-berkas-test)
4. [Detail Spesifikasi Setiap Skenario Pengujian](#4-detail-spesifikasi-setiap-skenario-pengujian)
   - 4.1 Test Suite 1: `WaliKelasAccessTest.php` (10 Skenario)
   - 4.2 Test Suite 2: `TeacherLeaveRequestTest.php` (11 Skenario)
   - 4.3 Test Suite 3: `CounselorAccessTest.php` (6 Skenario)
5. [Kebutuhan Data Testing, Factory, Seeder & Mocking](#5-kebutuhan-data-testing-factory-seeder--mocking)
6. [Strategi Pengujian Otorisasi, Keamanan & Data Isolation](#6-strategi-pengujian-otorisasi-keamanan--data-isolation)
7. [Strategi Pengujian Regresi (Zero-Regression Baseline)](#7-strategi-pengujian-regresi-zero-regression-baseline)
8. [Urutan Pengerjaan Implementasi Bertahap](#8-urutan-pengerjaan-implementasi-bertahap)
9. [Daftar Berkas yang Dibuat / Dimodifikasi](#9-daftar-berkas-yang-dibuat--dimodifikasi)
10. [Perintah Pengujian CLI](#10-perintah-pengujian-cli)
11. [Kriteria Keberhasilan (*Acceptance Criteria*)](#11-kriteria-keberhasilan-acceptance-criteria)
12. [Risiko Teknis, Temuan Lapangan & Hal yang Membutuhkan Keputusan](#12-risiko-teknis-temuan-lapangan--hal-yang-membutuhkan-keputusan)

---

## 1. Tujuan dan Ruang Lingkup Tahap 4

### 1.1 Tujuan Utama
Tahap 4 adalah fase penjaminan kualitas (*Software Quality Assurance & Automated Testing*) dan validasi menyeluruh untuk memastikan:
1. **Otorisasi Presisi Tiga Peran:** Memastikan bahwa hak operasional guru multiperan (Wali Kelas, Tim Kesiswaan/BK, dan Guru Pengampu Reguler) tereksekusi dengan benar sesuai batas wewenangnya, serta tidak ada celah pembocoran data (*data leakage*) atau eskalasi hak akses (*privilege escalation*).
2. **Kelengkapan 27 Skenario Kanonikal:** Memvalidasi secara otomatis seluruh 27 skenario pengujian yang telah digariskan dalam bab 7.4.2 dan bab 8 dokumen induk `SCP_MULTIKELAS_KESISWAAN_PLAN.md`.
3. **Zero-Regression Terverifikasi:** Memastikan bahwa seluruh rangkaian uji otomatis eksisting (baseline 199+ tests pada PRD, saat ini 276 tests terdaftar di repositori) tetap **100% Passed (Hijau)** tanpa ada kegagalan fungsi, regresi rute, maupun kerusakan skema database.

### 1.2 Ruang Lingkup Pengerjaan (In-Scope)
Fokus pengerjaan dibatasi secara tegas pada pengujian otomatis di direktori `tests/Feature/`:
1. **Penyelarasan & Penyempurnaan `tests/Feature/WaliKelasAccessTest.php`:**
   - Memastikan 10 skenario hak akses Wali Kelas (Jadwal, Jurnal Pengganti, Proteksi Jam Kelas Lain, Larangan `teacher_absent`, Penyelesaian Jurnal, Read-Only Izin Siswa Kelas Binaan, Larangan Approve Izin Siswa, Rekap Presensi Ter-scope) tercakup 100%.
2. **Penyelarasan & Penyempurnaan `tests/Feature/TeacherLeaveRequestTest.php`:**
   - Memastikan 11 skenario pengajuan izin guru (Pengajuan Mandiri, Larangan Mengajukan Jadwal Orang Lain, Proteksi Duplikasi Tanggal Sama, Upload Berkas Surat & Tugas, Scoping Index Guru, Proteksi Detail Izin Guru Lain, Akses Kesiswaan/Waka, Approval Kesiswaan, Rejection Kesiswaan/Waka, Larangan Approval Guru Biasa, Pengajuan oleh Wali Kelas) tercakup 100%.
3. **Pembuatan Baru `tests/Feature/CounselorAccessTest.php`:**
   - Membangun 6 skenario hak akses khusus Tim Kesiswaan/BK (Rekap Presensi Lintas Seluruh Kelas, Membuka Jurnal Pengganti Kelas Mana Pun, Menyelesaikan Jurnal Pengganti, Menandai Status `teacher_absent`, Melihat dan Menyetujui Izin Siswa Seluruh Kelas, Penolakan Guru Reguler Membuka Jurnal Kelas Lain).

### 1.3 Batasan Ketat (Strictly Out-of-Scope)
- **Dilarang memodifikasi kode inti backend:** Tidak mengubah controller, model, migration, routes, maupun middleware backend selama penulisan test, kecuali jika ditemukan bug kritis pada implementasi yang disetujui pengguna untuk diperbaiki.
- **Dilarang mengubah basis data produksi/development:** Seluruh pengujian berjalan di lingkungan testing terisolasi (SQLite in-memory dengan trait `RefreshDatabase`).
- **Dilarang mengubah aturan bisnis:** Menjaga keaslian aturan bisnis dan batasan keamanan sebagaimana telah disepakati pada Tahap 1, 2, dan 3.

---

## 2. Kondisi Aktual Implementasi Tahap 1–3 (Fakta Pemeriksaan)

Berdasarkan pemeriksaan langsung terhadap baris kode aktual pada repositori SCP:

### 2.1 Tahap 1 — Skema Data & Helper Model (Status: 100% Selesai & Terverifikasi)
- Tabel `teacher_leave_requests` telah aktif melalui migration `database/migrations/2026_10_31_000001_create_teacher_leave_requests_table.php`.
- Model `TeacherLeaveRequest` telah terkonfigurasi dengan `$fillable`, `$casts` (`schedule_ids` array, `date`, `verified_at`), serta relasi `teacher()` dan `approvedBy()`.
- Model `User` telah dilengkapi relasi `teacherLeaveRequests()` dan helper `homeroomClassIds()`, `isKesiswaan()`, serta `isWaliKelas()`.
- Test suite `tests/Feature/TeacherLeaveRequestSchemaTest.php` aktif dan 100% lulus (5 tests).

### 2.2 Tahap 2 — Perluasan Akses Wali Kelas pada Controller Existing (Status: 100% Selesai & Terverifikasi)
- `app/Http/Controllers/API/JournalController.php`:
  - `index()`: Otomatis me-load jurnal dari jadwal kelas binaan (`homeroomClassIds()`), jurnal pribadi, dan jurnal pengganti.
  - `show()`: Mengizinkan Wali Kelas melihat detail jurnal kelas binaannya (`isWaliKelasOfClass`).
  - `store()`: Mengizinkan Wali Kelas membuka sesi KBM darurat pada kelas binaannya sebagai `substitute_teacher_id`, namun **secara tegas menolak** aksi `teacher_absent` (HTTP 403). Menolak kelas non-binaan (HTTP 403).
  - `update()`: Mengizinkan Wali Kelas menyelesaikan jurnal yang dibukanya sebagai substitute, dan menolak pengambilalihan jurnal guru lain.
- `app/Http/Controllers/API/ScheduleController.php`:
  - `index()`: Mengizinkan Wali Kelas meminta jadwal seluruh mapel pada kelas binaannya via `?class_id=X`. Jika di luar binaannya atau kosong, otomatis fallback ke jadwal mengajarnya sendiri.

### 2.3 Tahap 3 — Controller & Endpoint Izin Guru (Status: 100% Selesai & Terverifikasi)
- `app/Http/Controllers/API/TeacherLeaveRequestController.php` telah dibangun dengan 5 method: `index()`, `show()`, `store()`, `approve()`, `reject()`.
- Rute terdaftar pada `routes/api.php` dengan pembagian role Sanctum yang presisi.
- Proteksi kepemilikan jadwal (`schedule_ids`), pencegahan duplikasi pending/approved di tanggal yang sama, penyimpanan berkas ke disk `public`, dan status lock berjalan sempurna.

### 2.4 Status Pengujian Eksisting Saat Ini
- Eksekusi `php artisan test` terakhir: **276 tests passed, 0 failures, 1409 assertions (100% Hijau)**.
- Seluruh 199+ test baseline awal tetap lolos tanpa regresi.

---

## 3. Daftar 27 Skenario Pengujian Kanonikal & Pemetaan Berkas Test

Berikut adalah pemetaan 27 skenario pengujian kanonikal sesuai Bab 7.4.2 dan Bab 8 dokumen induk `SCP_MULTIKELAS_KESISWAAN_PLAN.md`:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      MATRIKS 27 SKENARIO PENGUJIAN TAHAP 4                             │
├────────────────────────────────┬──────────────────────────┬────────────────────────────┤
│ Berkas Test Target             │ Jumlah Skenario Kanonikal│ Fokus Pengujian            │
├────────────────────────────────┼──────────────────────────┼────────────────────────────┤
│ 1. WaliKelasAccessTest.php     │ 10 Skenario (S01 – S10)  │ Hak Akses & Batasan Wali   │
│ 2. TeacherLeaveRequestTest.php │ 11 Skenario (S11 – S21)  │ Alur Perizinan Guru        │
│ 3. CounselorAccessTest.php     │  6 Skenario (S22 – S27)  │ Wewenang Penuh Kesiswaan   │
├────────────────────────────────┼──────────────────────────┼────────────────────────────┤
│ TOTAL KANONIKAL                │ 27 Skenario Lengkap      │ End-to-End Multirole Guard │
└────────────────────────────────┴──────────────────────────┴────────────────────────────┘
```

### Tabel Pemetaan Skenario Kanonikal ke Nama Method Test

| ID | File Test | Nama Method Skenario | Endpoint yang Diuji | Status Target |
|:---:|---|---|---|:---:|
| **S01** | `WaliKelasAccessTest` | `test_homeroom_teacher_can_view_schedules_of_their_class` | `GET /api/schedules?class_id={id}` | 200 OK |
| **S02** | `WaliKelasAccessTest` | `test_homeroom_teacher_cannot_view_schedules_of_other_classes` | `GET /api/schedules?class_id={other_id}` | 200 OK (Fallback) |
| **S03** | `WaliKelasAccessTest` | `test_homeroom_teacher_can_view_journals_of_their_class` | `GET /api/journals?class_id={id}` | 200 OK |
| **S04** | `WaliKelasAccessTest` | `test_homeroom_teacher_can_open_session_for_their_class` | `POST /api/journals` | 201 Created |
| **S05** | `WaliKelasAccessTest` | `test_homeroom_teacher_cannot_open_session_for_other_class` | `POST /api/journals` | 403 Forbidden |
| **S06** | `WaliKelasAccessTest` | `test_homeroom_teacher_cannot_mark_teacher_absent` | `POST /api/journals` (status: absent) | 403 Forbidden |
| **S07** | `WaliKelasAccessTest` | `test_homeroom_teacher_can_complete_journal_they_opened` | `PUT /api/journals/{id}` | 200 OK |
| **S08** | `WaliKelasAccessTest` | `test_homeroom_teacher_can_view_leave_requests_of_their_class` | `GET /api/leave-requests` | 200 OK (Scoped) |
| **S09** | `WaliKelasAccessTest` | `test_homeroom_teacher_cannot_approve_student_leave_request` | `PATCH /api/leave-requests/{id}` | 403 Forbidden |
| **S10** | `WaliKelasAccessTest` | `test_homeroom_teacher_can_view_attendance_recap_scoped_to_their_class` | `GET /api/attendances` | 200 OK (Scoped) |
| **S11** | `TeacherLeaveRequestTest` | `test_teacher_can_submit_leave_request_with_valid_schedules` | `POST /api/teacher-leave-requests` | 201 Created |
| **S12** | `TeacherLeaveRequestTest` | `test_teacher_cannot_submit_leave_request_for_others_schedule` | `POST /api/teacher-leave-requests` | 422 Unprocessable |
| **S13** | `TeacherLeaveRequestTest` | `test_teacher_cannot_submit_duplicate_leave_on_same_date` | `POST /api/teacher-leave-requests` | 422 Unprocessable |
| **S14** | `TeacherLeaveRequestTest` | `test_teacher_can_submit_leave_with_task_and_attachments` | `POST /api/teacher-leave-requests` (files) | 201 Created |
| **S15** | `TeacherLeaveRequestTest` | `test_teacher_can_view_only_their_own_leave_requests` | `GET /api/teacher-leave-requests` | 200 OK (Scoped) |
| **S16** | `TeacherLeaveRequestTest` | `test_teacher_cannot_view_others_leave_request_detail` | `GET /api/teacher-leave-requests/{id}` | 403 Forbidden |
| **S17** | `TeacherLeaveRequestTest` | `test_counselor_can_view_all_teachers_leave_requests` | `GET /api/teacher-leave-requests` | 200 OK (All) |
| **S18** | `TeacherLeaveRequestTest` | `test_counselor_can_approve_teacher_leave_request` | `PATCH /api/teacher-leave-requests/{id}/approve` | 200 OK |
| **S19** | `TeacherLeaveRequestTest` | `test_counselor_can_reject_teacher_leave_request` | `PATCH /api/teacher-leave-requests/{id}/reject` | 200 OK |
| **S20** | `TeacherLeaveRequestTest` | `test_regular_teacher_cannot_approve_or_reject_leave_request` | `PATCH /api/teacher-leave-requests/{id}/approve` | 403 Forbidden |
| **S21** | `TeacherLeaveRequestTest` | `test_homeroom_teacher_can_also_submit_teaching_leave_request` | `POST /api/teacher-leave-requests` | 201 Created |
| **S22** | `CounselorAccessTest` | `test_counselor_can_view_all_students_attendance` | `GET /api/attendances` | 200 OK (All Classes) |
| **S23** | `CounselorAccessTest` | `test_counselor_can_open_substitute_journal_for_any_class` | `POST /api/journals` | 201 Created |
| **S24** | `CounselorAccessTest` | `test_counselor_can_complete_substitute_journal` | `PUT /api/journals/{id}` | 200 OK |
| **S25** | `CounselorAccessTest` | `test_counselor_can_mark_teacher_absent` | `POST /api/journals` (status: absent) | 201 Created |
| **S26** | `CounselorAccessTest` | `test_counselor_can_view_and_approve_all_student_leaves` | `GET & PATCH /api/leave-requests/{id}` | 200 OK |
| **S27** | `CounselorAccessTest` | `test_non_counselor_teacher_cannot_act_as_substitute_for_other_class` | `POST /api/journals` | 403 Forbidden |

---

## 4. Detail Spesifikasi Setiap Skenario Pengujian

### 4.1 Test Suite 1: `WaliKelasAccessTest.php` (10 Skenario)

#### Skenario S01: Wali Kelas Melihat Jadwal Kelas Binaannya
- **Method:** `test_homeroom_teacher_can_view_schedules_of_their_class()`
- **Tujuan:** Memvalidasi bahwa Wali Kelas yang memfilter jadwal dengan `?class_id={id_kelas_binaan}` dapat melihat seluruh jadwal mata pelajaran pada kelas tersebut, termasuk jadwal yang diajar oleh guru lain.
- **Prekondisi:** User adalah Wali Kelas dari Kelas A. Terdapat Jadwal 1 (diajar Guru Lain di Kelas A) dan Jadwal 2 (diajar Guru Lain di Kelas B).
- **Aksi:** `Sanctum::actingAs($waliKelas)` -> `GET /api/schedules?class_id={$classA->id}`.
- **Assert:** HTTP 200, array data mengandung Jadwal 1, dan tidak mengandung Jadwal 2.

#### Skenario S02: Wali Kelas Mencoba Melihat Jadwal Kelas Lain
- **Method:** `test_homeroom_teacher_cannot_view_schedules_of_other_classes()`
- **Tujuan:** Memvalidasi mekanisme pertahanan (*safe fallback*) jika Wali Kelas mengirimkan `?class_id={id_kelas_lain}`.
- **Prekondisi:** User adalah Wali Kelas dari Kelas A. Mencoba meminta jadwal Kelas B.
- **Aksi:** `GET /api/schedules?class_id={$classB->id}`.
- **Assert:** HTTP 200, sistem secara otomatis mengabaikan permohonan kelas luar dan fallback hanya menampilkan jadwal mengajar pribadi milik wali kelas tersebut.

#### Skenario S03: Wali Kelas Melihat Daftar Jurnal Kelas Binaannya
- **Method:** `test_homeroom_teacher_can_view_journals_of_their_class()`
- **Tujuan:** Memvalidasi bahwa Wali Kelas dapat melihat riwayat jurnal KBM yang dilaksanakan di kelas binaannya oleh guru manapun.
- **Prekondisi:** Terdapat Jurnal A (di Kelas A, dibuat Guru Lain) dan Jurnal B (di Kelas B, dibuat Guru Lain).
- **Aksi:** `GET /api/journals?class_id={$classA->id}`.
- **Assert:** HTTP 200, respons memuat Jurnal A, dan tidak memuat Jurnal B.

#### Skenario S04: Wali Kelas Membuka Sesi KBM Kelas Binaannya
- **Method:** `test_homeroom_teacher_can_open_session_for_their_class()`
- **Tujuan:** Memvalidasi wewenang Wali Kelas membuka sesi KBM darurat pada kelas binaannya ketika guru pengampu berhalangan.
- **Prekondisi:** Terdapat jadwal milik guru lain di Kelas A yang belum memiliki jurnal.
- **Aksi:** `POST /api/journals` dengan payload `schedule_id` jadwal tersebut, `status: teaching`.
- **Assert:** HTTP 201 Created, record tersimpan di database dengan `substitute_teacher_id === $waliKelas->id`.

#### Skenario S05: Wali Kelas Ditolak Membuka Sesi KBM Kelas Lain
- **Method:** `test_homeroom_teacher_cannot_open_session_for_other_class()`
- **Tujuan:** Memvalidasi isolasi batas wewenang Wali Kelas terhadap kelas yang bukan tanggung jawabnya.
- **Prekondisi:** Terdapat jadwal di Kelas B (bukan kelas binaan wali kelas).
- **Aksi:** `POST /api/journals` untuk jadwal Kelas B.
- **Assert:** HTTP 403 Forbidden. Tidak ada jurnal baru yang terbentuk.

#### Skenario S06: Wali Kelas Ditolak Menandai `teacher_absent`
- **Method:** `test_homeroom_teacher_cannot_mark_teacher_absent()`
- **Tujuan:** Memvalidasi aturan bahwa Wali Kelas dilarang keras menandai status guru berhalangan hadir (`teacher_absent`), karena wewenang tersebut mutlak milik Kesiswaan dan Waka Kurikulum.
- **Prekondisi:** Jadwal di Kelas A.
- **Aksi:** `POST /api/journals` dengan payload `status: teacher_absent`.
- **Assert:** HTTP 403 Forbidden dengan pesan eksplisit: *"Hanya Guru Kesiswaan atau Waka Kurikulum yang berhak menandai status guru berhalangan hadir."*

#### Skenario S07: Wali Kelas Menyelesaikan Jurnal yang Dibukanya
- **Method:** `test_homeroom_teacher_can_complete_journal_they_opened()`
- **Tujuan:** Memvalidasi bahwa Wali Kelas yang telah membuka jurnal pengganti di kelasnya berhak mengisi materi, mengunggah dokumentasi foto, dan menyelesaikan presensi siswa.
- **Prekondisi:** Jurnal berstatus `teaching` dengan `substitute_teacher_id = $waliKelas->id`.
- **Aksi:** `PUT /api/journals/{id}` dengan payload `topic_description`, berkas foto dokumentasi, dan array `attendances`.
- **Assert:** HTTP 200 OK, jurnal berstatus `completed`, presensi siswa tersimpan.

#### Skenario S08: Wali Kelas Melihat Daftar Izin Siswa Kelas Binaannya
- **Method:** `test_homeroom_teacher_can_view_leave_requests_of_their_class()`
- **Tujuan:** Memvalidasi bahwa pemanggilan endpoint `GET /api/leave-requests` oleh Wali Kelas otomatis ter-scope hanya menampilkan data perizinan siswa di kelas binaannya.
- **Prekondisi:** Siswa 1 (Kelas A) mengajukan izin. Siswa 2 (Kelas B) mengajukan izin.
- **Aksi:** `GET /api/leave-requests`.
- **Assert:** HTTP 200 OK, data hanya memuat izin Siswa 1, izin Siswa 2 tidak disertakan.

#### Skenario S09: Wali Kelas Ditolak Memverifikasi Izin Siswa
- **Method:** `test_homeroom_teacher_cannot_approve_student_leave_request()`
- **Tujuan:** Memvalidasi integritas kebijakan sekolah bahwa persetujuan/penolakan izin siswa adalah hak eksklusif Kesiswaan & Waka, sedangkan Wali Kelas hanya berhak membaca (*read-only*).
- **Prekondisi:** Terdapat izin Siswa Kelas A berstatus `pending`.
- **Aksi:** `PATCH /api/leave-requests/{id}` dengan payload `status: approved`.
- **Assert:** HTTP 403 Forbidden. Status izin siswa tetap `pending`.

#### Skenario S10: Wali Kelas Melihat Rekap Presensi Ter-scope ke Kelas Binaan
- **Method:** `test_homeroom_teacher_can_view_attendance_recap_scoped_to_their_class()`
- **Tujuan:** Memvalidasi bahwa pemanggilan `GET /api/attendances` oleh Wali Kelas secara otomatis mengunci query ke siswa-siswa kelas binaannya.
- **Prekondisi:** Presensi tercatat untuk Siswa Kelas A dan Siswa Kelas B.
- **Aksi:** `GET /api/attendances`.
- **Assert:** HTTP 200 OK, seluruh data presensi yang dikembalikan memiliki relasi siswa dengan `class_id === $classA->id`.

---

### 4.2 Test Suite 2: `TeacherLeaveRequestTest.php` (11 Skenario)

#### Skenario S11: Guru Mengajukan Izin dengan Jadwal Milik Sendiri
- **Method:** `test_teacher_can_submit_leave_request_with_valid_schedules()`
- **Tujuan:** Memvalidasi guru dapat mengajukan izin mengajar dengan memilih jadwal mengajarnya sendiri.
- **Prekondisi:** Jadwal A memiliki `teacher_id === $teacherA->id`.
- **Aksi:** `POST /api/teacher-leave-requests` dengan payload `date`, `reason`, `schedule_ids: [$scheduleA->id]`.
- **Assert:** HTTP 201 Created, record berstatus `pending`, `schedule_ids` tersimpan.

#### Skenario S12: Guru Ditolak Mengajukan Izin atas Jadwal Guru Lain
- **Method:** `test_teacher_cannot_submit_leave_request_for_others_schedule()`
- **Tujuan:** Memvalidasi pencegahan kecurangan di mana guru mencoba memanipulasi izin atas jadwal milik rekan sejawatnya.
- **Prekondisi:** Jadwal B memiliki `teacher_id === $teacherB->id`.
- **Aksi:** Guru A mengirim `POST /api/teacher-leave-requests` dengan `schedule_ids: [$scheduleB->id]`.
- **Assert:** HTTP 422 Unprocessable Content dengan pesan kegagalan kepemilikan jadwal.

#### Skenario S13: Pencegahan Pengajuan Izin Duplikat pada Tanggal Sama
- **Method:** `test_teacher_cannot_submit_duplicate_leave_on_same_date()`
- **Tujuan:** Memvalidasi bahwa guru yang telah memiliki izin berstatus `pending` atau `approved` pada tanggal X tidak dapat mengirim pengajuan izin baru lagi pada tanggal X.
- **Prekondisi:** Guru A telah memiliki izin pada tanggal `2026-11-05` berstatus `pending`.
- **Aksi:** Guru A mengirim `POST /api/teacher-leave-requests` pada tanggal `2026-11-05`.
- **Assert:** HTTP 422 Unprocessable Content.

#### Skenario S14: Guru Mengajukan Izin Disertai Lampiran Surat & Tugas Titipan
- **Method:** `test_teacher_can_submit_leave_with_task_and_attachments()`
- **Tujuan:** Memvalidasi pengunggahan berkas bukti surat izin dan modul soal tugas titipan untuk siswa.
- **Prekondisi:** Menggunakan `UploadedFile::fake()->create('surat.pdf', 500)` dan `UploadedFile::fake()->create('soal.pdf', 300)`.
- **Aksi:** `POST /api/teacher-leave-requests` via multipart form data.
- **Assert:** HTTP 201 Created, `attachment_path` dan `task_attachment_path` terisi, berkas fisik terverifikasi eksis pada disk `'public'`.

#### Skenario S15: Guru Reguler Hanya Melihat Izin Miliknya Sendiri
- **Method:** `test_teacher_can_view_only_their_own_leave_requests()`
- **Tujuan:** Memvalidasi pemisahan privasi data izin antar guru pada endpoint index.
- **Prekondisi:** Guru A dan Guru B masing-masing memiliki data perizinan.
- **Aksi:** Guru A memanggil `GET /api/teacher-leave-requests`.
- **Assert:** HTTP 200 OK, daftar hanya berisi izin Guru A, data Guru B tidak bocor.

#### Skenario S16: Guru Ditolak Melihat Detail Izin Guru Lain
- **Method:** `test_teacher_cannot_view_others_leave_request_detail()`
- **Tujuan:** Memvalidasi perlindungan endpoint detail terhadap akses tidak sah dari sesama guru.
- **Prekondisi:** Izin milik Guru B tersimpan di database.
- **Aksi:** Guru A memanggil `GET /api/teacher-leave-requests/{id_milik_guru_b}`.
- **Assert:** HTTP 403 Forbidden.

#### Skenario S17: Kesiswaan Dapat Melihat Seluruh Izin Guru
- **Method:** `test_counselor_can_view_all_teachers_leave_requests()`
- **Tujuan:** Memvalidasi akses monitoring komprehensif bagi Tim Kesiswaan terhadap seluruh izin guru di sekolah.
- **Prekondisi:** Izin Guru A dan Guru B tersimpan di database.
- **Aksi:** User Kesiswaan memanggil `GET /api/teacher-leave-requests`.
- **Assert:** HTTP 200 OK, respons memuat seluruh izin Guru A dan Guru B.

#### Skenario S18: Kesiswaan Menyetujui Izin Guru (`approve`)
- **Method:** `test_counselor_can_approve_teacher_leave_request()`
- **Tujuan:** Memvalidasi alur persetujuan izin guru oleh Tim Kesiswaan.
- **Prekondisi:** Izin Guru A berstatus `pending`.
- **Aksi:** User Kesiswaan memanggil `PATCH /api/teacher-leave-requests/{id}/approve`.
- **Assert:** HTTP 200 OK, status berubah menjadi `approved`, `approved_by` tercatat ID Kesiswaan, dan `verified_at` terisi timestamp.

#### Skenario S19: Kesiswaan Menolak Izin Guru (`reject`)
- **Method:** `test_counselor_can_reject_teacher_leave_request()`
- **Tujuan:** Memvalidasi alur penolakan izin guru oleh Tim Kesiswaan.
- **Prekondisi:** Izin Guru A berstatus `pending`.
- **Aksi:** User Kesiswaan memanggil `PATCH /api/teacher-leave-requests/{id}/reject`.
- **Assert:** HTTP 200 OK, status berubah menjadi `rejected`, `approved_by` tercatat ID Kesiswaan, dan `verified_at` terisi timestamp.

#### Skenario S20: Guru Reguler Ditolak Memverifikasi Izin Guru Lain
- **Method:** `test_regular_teacher_cannot_approve_or_reject_leave_request()`
- **Tujuan:** Memvalidasi bahwa guru non-kesiswaan tidak dapat menyetujui atau menolak izin rekan sesama guru.
- **Prekondisi:** Izin Guru A berstatus `pending`.
- **Aksi:** Guru B mencoba memanggil endpoint approve dan reject.
- **Assert:** HTTP 403 Forbidden.

#### Skenario S21: Wali Kelas yang Mengajar Dapat Mengajukan Izin
- **Method:** `test_homeroom_teacher_can_also_submit_teaching_leave_request()`
- **Tujuan:** Memvalidasi bahwa guru yang memiliki tugas tambahan sebagai Wali Kelas tetap dapat menggunakan fitur pengajuan izin mengajar untuk jadwal mata pelajarannya sendiri.
- **Prekondisi:** User adalah Wali Kelas dan memiliki jadwal mengajar di kelas lain.
- **Aksi:** Wali Kelas memanggil `POST /api/teacher-leave-requests`.
- **Assert:** HTTP 201 Created, record izin tersimpan dengan benar.

---

### 4.3 Test Suite 3: `CounselorAccessTest.php` (6 Skenario)

#### Skenario S22: Kesiswaan Melihat Rekap Presensi Lintas Seluruh Kelas
- **Method:** `test_counselor_can_view_all_students_attendance()`
- **Tujuan:** Memvalidasi bahwa Tim Kesiswaan memiliki akses monitoring presensi global tanpa dibatasi sekat kelas binaan.
- **Prekondisi:** Terdapat data presensi di Kelas X RPL 1 dan Kelas XI TKJ 1.
- **Aksi:** User Kesiswaan memanggil `GET /api/attendances`.
- **Assert:** HTTP 200 OK, data memuat presensi dari seluruh kelas tanpa pembatasan.

#### Skenario S23: Kesiswaan Membuka Jurnal Pengganti di Kelas Mana Pun
- **Method:** `test_counselor_can_open_substitute_journal_for_any_class()`
- **Tujuan:** Memvalidasi wewenang operasional Kesiswaan untuk turun tangan membuka sesi KBM pengganti pada kelas kosong mana pun di sekolah.
- **Prekondisi:** Terdapat jadwal KBM milik Guru Reguler yang berhalangan di kelas manapun.
- **Aksi:** User Kesiswaan memanggil `POST /api/journals` dengan `status: teaching`.
- **Assert:** HTTP 201 Created, jurnal berhasil dibuka dengan `substitute_teacher_id = $kesiswaan->id`.

#### Skenario S24: Kesiswaan Menyelesaikan Jurnal Pengganti yang Dibukanya
- **Method:** `test_counselor_can_complete_substitute_journal()`
- **Tujuan:** Memvalidasi Kesiswaan dapat mengunggah foto KBM, menuliskan materi, dan mencatat absensi pada jurnal pengganti yang diampunya.
- **Prekondisi:** Jurnal pengganti berstatus `teaching` dengan `substitute_teacher_id = $kesiswaan->id`.
- **Aksi:** User Kesiswaan memanggil `PUT /api/journals/{id}`.
- **Assert:** HTTP 200 OK, status jurnal berubah menjadi `completed`.

#### Skenario S25: Kesiswaan Menandai Status Guru Berhalangan Hadir (`teacher_absent`)
- **Method:** `test_counselor_can_mark_teacher_absent()`
- **Tujuan:** Memvalidasi hak resmi Kesiswaan mencatat status absen guru pada sesi KBM saat jam pelajaran kosong tanpa pengganti.
- **Prekondisi:** Terdapat jadwal KBM pada hari berjalan.
- **Aksi:** User Kesiswaan memanggil `POST /api/journals` dengan `status: teacher_absent`.
- **Assert:** HTTP 201 Created, jurnal tercatat dengan status `teacher_absent`.

#### Skenario S26: Kesiswaan Memantau & Menyetujui Izin Siswa Seluruh Kelas
- **Method:** `test_counselor_can_view_and_approve_all_student_leaves()`
- **Tujuan:** Memvalidasi alur verifikasi perizinan siswa (sakit/keluar sekolah) oleh Tim Kesiswaan secara multi-kelas.
- **Prekondisi:** Terdapat pengajuan izin siswa Kelas X RPL 1 berstatus `pending`.
- **Aksi:** User Kesiswaan memanggil `GET /api/leave-requests` lalu memanggil `PATCH /api/leave-requests/{id}` dengan `status_approval: approved`.
- **Assert:** HTTP 200 OK, status izin siswa berubah menjadi `approved`, `verified_by` tercatat ID Kesiswaan.

#### Skenario S27: Guru Biasa Ditolak Menjadi Guru Pengganti di Kelas Lain Tanpa Wewenang
- **Method:** `test_non_counselor_teacher_cannot_act_as_substitute_for_other_class()`
- **Tujuan:** Memvalidasi bahwa guru biasa yang bukan pengampu asli, bukan wali kelas, dan bukan kesiswaan dilarang keras membuka jurnal di kelas orang lain.
- **Prekondisi:** Jadwal milik Guru A di Kelas X. Guru C (guru biasa tanpa penugasan kesiswaan/wali kelas).
- **Aksi:** Guru C memanggil `POST /api/journals` untuk jadwal tersebut.
- **Assert:** HTTP 403 Forbidden.

---

## 5. Kebutuhan Data Testing, Factory, Seeder & Mocking

### 5.1 Isolasi Lingkungan Database
- Pengujian menggunakan basis data in-memory SQLite yang terisolasi (`:memory:`) melalui konfigurasi `phpunit.xml`.
- Setiap class test menggunakan trait `Illuminate\Foundation\Testing\RefreshDatabase` untuk mereset seluruh tabel secara instan sebelum setiap test dieksekusi, sehingga **100% independen dan tidak menyentuh database PostgreSQL development**.

### 5.2 Seeder & Konfigurasi Sistem
- Seeder `PeriodTemplateSeeder::class` dijalankan di `setUp()` untuk menyediakan template jam pelajaran (jam ke-1 s.d. jam ke-10).
- Model `SystemConfiguration` diinisialisasi di `setUp()` dengan:
  ```php
  SystemConfiguration::create([
      'id' => 1,
      'active_cycle' => 1,
      'monday_is_upacara' => true,
  ]);
  ```

### 5.3 Mocking Penyimpanan Berkas (*Storage Fake*)
- Pemanggilan `Storage::fake('public')` di `setUp()` memastikan berkas upload (`attachment`, `task_attachment`, foto dokumentasi KBM) hanya disimpan dalam memori virtual pengujian dan tidak mengotori direktori `storage/app/public` sistem operasi.

### 5.4 Penyiapan Master Data Dummy
Untuk setiap skenario pengujian, entitas relasi dibuat secara minimal dan presisi:
- Model `User` dibuat dengan `role: teacher`, `vice_principal`, atau `student` via `Hash::make('password123')`.
- Model `TeacherAssignment` dibuat dengan `'type' => 'wali_kelas'` atau `'type' => 'kesiswaan'` untuk mengaktifkan status multirole.
- Model `Classes`, `Rooms` (dengan atribut wajib `capacity`), dan `Subject` dibuat langsung untuk merelasikan `Schedule` (dengan atribut wajib `source => 'manual'` dan `cycle_type => 1`).

---

## 6. Strategi Pengujian Otorisasi, Keamanan & Data Isolation

Pengujian otorisasi disusun dengan strategi segitiga pembuktian:

```
                  ┌────────────────────────┐
                  │    AKSES DIIZINKAN     │
                  │   (Positive Access)    │
                  │  HTTP 200 / HTTP 201   │
                  └───────────┬────────────┘
                              │
               ▲              │              ▲
              ╱               ▼               ╲
             ╱                                 ╲
┌───────────┴────────────┐         ┌────────────┴───────────┐
│     AKSES DITOLAK      │◄───────►│    VALIDASI BISNIS     │
│  (Negative Permission) │         │  (Integrity & Payload) │
│        HTTP 403        │         │        HTTP 422        │
└────────────────────────┘         └────────────────────────┘
```

1. **Positive Test (Wewenang Sah):**
   - Memastikan pengguna yang memiliki peran yang tepat (misal: Wali Kelas pada kelas binaannya, Kesiswaan pada multi-kelas, Guru pada jadwal pribadinya) memperoleh respons sukses (200/201).
2. **Negative Authorization Test (Penolakan Pelanggaran):**
   - Memastikan bahwa saat pengguna mencoba melompati batas perannya (misal: Wali Kelas mencoba meng-approve izin siswa, atau guru biasa mencoba membuka kelas orang lain), sistem segera memotong eksekusi dan mengembalikan **HTTP 403 Forbidden**.
3. **Business Validation Guard (Integritas Data):**
   - Memastikan input yang tidak valid (misal: memilih jadwal guru lain, pengajuan izin duplikat pada tanggal yang sama, atau re-approve izin yang sudah approved) ditolak dengan **HTTP 422 Unprocessable Content**.
4. **Data Isolation (Anti Kebocoran Data):**
   - Memastikan bahwa filter otomatis Eloquent bekerja transparan: Guru A tidak dapat melihat data izin Guru B di index, dan Wali Kelas Kelas A tidak dapat melihat data presensi siswa Kelas B.

---

## 7. Strategi Pengujian Regresi (Zero-Regression Baseline)

### 7.1 Sasaran Regresi
- **Target Dokumen Utama:** Memastikan seluruh 199+ test suite awal tetap 100% lulus.
- **Target Kondisi Aktual:** Saat ini repositori memiliki **276 tests** aktif dengan 1409 assertions. Target implementasi Tahap 4 adalah memastikan **seluruh 276+ tests eksisting tetap 100% passed (Zero Failure)** setelah test suite baru ditambahkan dan diselaraskan.

### 7.2 Area Uji Regresi Utama
Rangkaian regresi mencakup modul-modul kritis berikut:
1. `AuthTest` & `RateLimitingTest`: Login, token Sanctum, throttling API.
2. `AcademicSettingTest` & `ClassPromotionTest`: Pengaturan siklus waka kurikulum & kenaikan kelas.
3. `SchoolClassTest`, `SubjectTest`, `RoomTest`, `TeacherManagementTest`: Master data CRUD.
4. `ScheduleTest`, `ScheduleImportTest`, `FourFilesEndToEndScheduleWorkflowTest`: Manajemen jadwal dan impor excel/pdf.
5. `JournalAttendanceTest` & `JournalAndAttendanceTest`: Siklus jurnal reguler guru mapel dan presensi siswa.
6. `LeaveRequestFeatureTest` & `LeaveRequestSyncTest`: Siklus perizinan siswa oleh orang tua/siswa.
7. `QuizFeatureTest`, `QuizWorkflowTest`: Sistem kuis berbantuan AI.

---

## 8. Urutan Pengerjaan Implementasi Bertahap

Pelaksanaan implementasi Tahap 4 akan dijalankan secara bertahap dan sistematis:

```
[Langkah 1] Penyelarasan Berkas tests/Feature/WaliKelasAccessTest.php
    ├── Verifikasi 10 skenario kanonikal (S01 – S10)
    └── Menambahkan skenario S08 (leave requests), S09 (larangan approve), S10 (presensi scoped)
            │
[Langkah 2] Penyelarasan Berkas tests/Feature/TeacherLeaveRequestTest.php
    ├── Verifikasi 11 skenario kanonikal (S11 – S21)
    └── Menambahkan skenario S21 (pengajuan izin oleh wali kelas yang mengajar)
            │
[Langkah 3] Pembuatan Berkas tests/Feature/CounselorAccessTest.php
    ├── Kerangka test case & setup multirole kesiswaan
    └── Implementasi 6 skenario kanonikal kesiswaan (S22 – S27)
            │
[Langkah 4] Verifikasi Sintaks & Eksekusi Per File Test
    ├── php artisan test --filter=WaliKelasAccessTest
    ├── php artisan test --filter=TeacherLeaveRequestTest
    └── php artisan test --filter=CounselorAccessTest
            │
[Langkah 5] Eksekusi Pengujian Penuh (Full Zero-Regression Verification)
    └── php artisan test (Target: 280+ tests passed, 0 failures)
```

---

## 9. Daftar Berkas yang Dibuat / Dimodifikasi

| No | Path Berkas | Tipe Perubahan | Deskripsi Perubahan |
|:---:|---|:---:|---|
| 1 | `tests/Feature/WaliKelasAccessTest.php` | **Modifikasi / Penyelarasan** | Melengkapi skenario S08, S09, dan S10 agar genap memenuhi 10 skenario kanonikal Wali Kelas. |
| 2 | `tests/Feature/TeacherLeaveRequestTest.php` | **Modifikasi / Penyelarasan** | Menambahkan skenario S21 (Wali Kelas mengajukan izin mengajar) agar memenuhi 11 skenario kanonikal izin guru. |
| 3 | `tests/Feature/CounselorAccessTest.php` | **Dibuat Baru** | Membangun seluruh 6 skenario pengujian kanonikal untuk wewenang Tim Kesiswaan/BK. |

> [!NOTE]
> Tidak ada berkas produksi di luar folder `tests/Feature/` yang akan disentuh atau diubah selama pengerjaan Tahap 4.

---

## 10. Perintah Pengujian CLI

Berikut adalah perintah CLI yang akan dijalankan pada tahap eksekusi:

### 10.1 Pengujian Per Modul Test (Terisolasi)
```bash
# 1. Menjalankan test suite Wali Kelas
php artisan test --filter=WaliKelasAccessTest

# 2. Menjalankan test suite Izin Guru
php artisan test --filter=TeacherLeaveRequestTest

# 3. Menjalankan test suite Kesiswaan / BK
php artisan test --filter=CounselorAccessTest
```

### 10.2 Pengujian Keseluruhan 27 Skenario Baru
```bash
php artisan test --filter="WaliKelasAccess|TeacherLeaveRequest|CounselorAccess"
```

### 10.3 Pengujian Penuh Sistem (Zero-Regression Run)
```bash
php artisan test
```

---

## 11. Kriteria Keberhasilan (*Acceptance Criteria*)

Tahap 4 dinyatakan **Selesai dan Berhasil Penuh** apabila:

- [ ] Seluruh **27 skenario pengujian kanonikal** terpetakan dan terimplementasi dengan rapi pada ketiga berkas test.
- [ ] Pengujian `tests/Feature/WaliKelasAccessTest.php` lulus 100% (10 skenario kanonikal + skenario verifikasi detail).
- [ ] Pengujian `tests/Feature/TeacherLeaveRequestTest.php` lulus 100% (11 skenario kanonikal + variasi parsing form-data).
- [ ] Pengujian `tests/Feature/CounselorAccessTest.php` lulus 100% (6 skenario kanonikal kesiswaan).
- [ ] Eksekusi `php artisan test` secara menyeluruh menghasilkan status **100% Passed (Zero Failure)** dengan total minimal 280+ tests dan 1400+ assertions.
- [ ] Tidak ada perubahan skema database atau efek samping pada data produksi.

---

## 12. Risiko Teknis, Temuan Lapangan & Hal yang Membutuhkan Keputusan

### 12.1 Temuan Lapangan Hasil Analisis
1. **Pemisahan Test Suite Kesiswaan:**
   Fitur-fitur yang mendukung peran Tim Kesiswaan sebelumnya telah diuji secara parsial di dalam `LeaveRequestFeatureTest.php` dan `JournalAndAttendanceTest.php`. Dengan dibuatnya `CounselorAccessTest.php`, seluruh pengujian peran Kesiswaan kini memiliki rumah uji yang terpusat, konsisten, dan mudah dirawat.
2. **Kebutuhan Kolom `capacity` pada `rooms` dan `source` pada `schedules`:**
   Pada database SQLite in-memory, kolom `rooms.capacity` dan `schedules.source` bersifat NOT NULL. Pengaturan data fixture di `CounselorAccessTest.php` wajib menyediakan nilai default (misal `capacity: 36` dan `source: 'manual'`) agar tidak memicu integrity constraint violation.

### 12.2 Hal yang Membutuhkan Konfirmasi / Keputusan Pengguna
1. **Penyelarasan `WaliKelasAccessTest.php`:**
   Saat ini berkas `WaliKelasAccessTest.php` yang dibuat pada Tahap 2 telah memiliki 10 test (termasuk pengujian detail jurnal). Skenario nomor 8, 9, 10 dari dokumen induk (melihat izin siswa kelas binaan, larangan approve izin siswa, dan rekap presensi ter-scope) akan ditambahkan ke dalam file tersebut sehingga file tersebut memiliki total 13 method pengujian yang sangat lengkap. Apakah Anda menyetujui pendekatan ini? *(Rekomendasi: Ya, sangat disarankan untuk menjaga kelengkapan pengujian)*.
2. **Kesiapan Memulai Eksekusi:**
   Rencana implementasi di atas telah dirancang secara presisi tanpa ada perubahan kode produksi. Jika Anda menyetujui dokumen perencanaan ini, silakan berikan konfirmasi persetujuan agar implementasi kode test Tahap 4 dapat segera dieksekusi.
