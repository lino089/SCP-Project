# Dokumen 01: Pemahaman Sistem dan Aturan Bisnis SCP

**School Class Progress (SCP) — Front-End Web Analysis & Architecture Preparation**  
**Acuan Spesifikasi:** Backend REST API PRD v4.4 & Implementasi Laravel 13  
**Target Platform:** Web Desktop / Tablet (Prioritas Tahap 1)  

---

## 1. Ringkasan Eksekutif & Tujuan Sistem

**School Class Progress (SCP)** adalah platform digital terpadu manajemen Kegiatan Belajar Mengajar (KBM) dan operasional akademik sekolah menengah kejuruan (studi kasus: SMK Negeri 1 Bantul). Sistem ini dirancang untuk menyatukan seluruh siklus hidup pembelajaran:
1. Pengelolaan jadwal terpusat dan import otomatis berkas FET Timetable (PDF).
2. Pembukaan sesi KBM, jurnal mengajar guru, dan verifikasi kehadiran (presensi) siswa berbasis pengecualian (*exception-based*).
3. Manajemen perizinan siswa (*leave requests*) dengan sinkronisasi otomatis ke jurnal harian.
4. Monitoring presensi lintas peran (Waka Kurikulum, Kesiswaan, Wali Kelas, Guru Mapel, Siswa, dan Orang Tua).
5. Sistem Asesmen / Kuis Terintegrasi AI (generasi soal via prompt, ekstraksi dokumen materi PDF/TXT, dan koreksi esai otomatis via AI Gateway).
6. Pengelolaan Master Data dan siklus kenaikan kelas serta kelulusan siswa.

Sistem backend SCP mengadopsi pendekatan **Headless REST API Provider** menggunakan Laravel 13, PostgreSQL, dan layanan asinkron Python worker. Seluruh aturan bisnis, otorisasi, dan validasi ditegakkan secara absolut di sisi server, sehingga Front-End Web (React.js) berperan sebagai antarmuka pengguna (*client consumer*) yang wajib menyajikan pengalaman interaktif yang konsisten, aman, dan responsif.

---

## 2. Karakteristik & Filosofi Arsitektur Sistem

Sistem SCP didesain dengan beberapa filosofi operasional fundamental yang harus dipahami oleh tim pengembang Front-End:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      ARSITEKTUR TINGGI SISTEM SCP                      │
└────────────────────────────────────────────────────────────────────────┘
            ▲                                        ▲
            │ (Web App / React)                      │ (Mobile / Flutter)
            ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        GATEWAY & OTENTIKASI                            │
│           Laravel Sanctum (Multi-device Bearer Token)                   │
│           Step-Up Authentication (Password Re-confirmation)           │
│           Rate Limiter (60 Request/Menit per Token)                    │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           CORE BUSINESS LOGIC                          │
│  - Jadwal Terpusat Waka (Putaran 1 & 2 Bersamaan)                      │
│  - Period Resolution Service (Jam Pelajaran Dinamis)                  │
│  - Hak Eksklusif Guru Kesiswaan (substitute_teacher_id)                │
│  - Presensi Exception-Based Atomik (PUT /journals/{id})                │
│  - Kuis Berbantuan AI Asinkron (Prompt, Dokumen, Koreksi Hybrid)       │
└────────────────────────────────────────────────────────────────────────┘
          │                                  │
          ▼                                  ▼
┌──────────────────┐               ┌─────────────────────────────────────┐
│ PostgreSQL 16+   │               │ ASYNC QUEUE WORKERS                 │
│ Database Primer  │               │ - ParseSchedulePdfJob (Python FET)  │
│ Soft Deletes     │               │ - GenerateQuizFromPromptJob (AI)    │
│ Single Source of │               │ - ExtractQuizFromDocumentJob (AI)   │
│ Truth            │               │ - GradeQuizSubmissionJob (Hybrid AI)│
└──────────────────┘               └─────────────────────────────────────┘
```

---

## 3. Aturan Bisnis Utama (Core Business Rules)

Berikut adalah aturan bisnis utama yang tertuang pada PRD v4.4 dan terkonfirmasi dalam kode backend:

### 3.1 Sentralisasi Penuh Pengelolaan Jadwal pada Waka Kurikulum
- **Hak Mutasi Mutlak:** Seluruh hak penambahan, pengubahan, dan penghapusan jadwal pelajaran (`schedules`) dipegang **eksklusif** oleh Waka Kurikulum (`role: vice_principal`).
- **Pencabutan Hak Guru:** Guru reguler **sama sekali tidak memiliki hak mutasi jadwal** (tidak ada endpoint `POST`, `PUT`, `DELETE /api/schedules` untuk guru). Guru hanya memiliki akses baca (*read-only*) atas jadwal mengajar pribadinya.
- **Dua Putaran Bersamaan:** Sekolah menerapkan model blok (Putaran 1 / Kejuruan dan Putaran 2 / Normatif-Adaptif). Kedua putaran jadwal disimpan bersamaan di basis data (kolom `cycle_type: 1|2`).

### 3.2 Prasyarat Mutlak Master Data Sebelum Input Jadwal (Pre-condition Gate)
- Sebelum Waka dapat menginput jadwal (baik manual maupun via import PDF), sistem mewajibkan seluruh Master Data terisi dan aktif:
  1. `classes` (Kelas) > 0
  2. `users` (Guru) > 0
  3. `subjects` (Mata Pelajaran) > 0
  4. `rooms` (Ruangan) > 0
  5. *Khusus Import PDF:* Minimal ada 1 guru yang telah memiliki atribut `fet_staff_id`.
- Jika salah satu master data belum terpenuhi, request langsung ditolak dengan status **HTTP 422 Unprocessable Entity** dengan rincian entitas yang kurang (`missing_entities`). Front-End wajib menampilkan peringatan interaktif dan mencegah form dibuka tanpa master data yang siap.

### 3.3 Verifikasi Ulang Kata Sandi (Password Re-confirmation Pattern)
- Menggantikan mekanisme *lock/unlock* global, SCP memberlakukan **Step-Up Authentication** pada aksi-aksi sensitif:
  1. Mutasi jadwal manual: `POST /api/schedules`, `PUT /api/schedules/{id}`, `DELETE /api/schedules/{id}`.
  2. Konfirmasi final commit import PDF: `POST /api/schedule-imports/{id}/confirm`.
  3. Perubahan status upacara hari Senin: `PATCH /api/academic-settings/monday-status`.
  4. Pengubahan putaran aktif KBM: `PATCH /api/academic-settings`.
- Pada setiap request tersebut, body request **wajib menyertakan parameter `password`**. Jika password salah, backend merespons **HTTP 422 Unprocessable Entity**, dan aksi dibatalkan tanpa perubahan data.

### 3.4 Resolusi Jam Pelajaran Dinamis (Period Templates)
- Jadwal pelajaran (`schedules`) **tidak menyimpan jam literal tetap** (`start_time` / `end_time`), melainkan menyimpan nomor periode pelajaran (`period_number`), durasi blok (`duration_periods`), dan hari (`day_of_week`).
- Jam riil dihitung dinamis oleh backend (`PeriodResolutionService`) berdasarkan `day_type`:
  - `senin_upacara`: Hari Senin dengan upacara bendera (KBM jam ke-1 dimulai pukul 08:00 WIB).
  - `senin_reguler`: Hari Senin tanpa upacara (diganti literasi/tadarus, KBM jam ke-1 dimulai 07:15 WIB).
  - `selasa`: Hari Selasa dengan literasi (KBM jam ke-1 dimulai 07:30 WIB).
  - `rabu_kamis`: Hari Rabu & Kamis (KBM jam ke-1 dimulai 07:15 WIB).
  - `jumat`: Hari Jumat pendek (KBM jam ke-1 dimulai 07:15 WIB, tiap JP berdurasi 40 menit).
- Status Senin upacara dikendalikan oleh saklar tunggal `system_configurations.monday_is_upacara` yang dapat diubah Waka kapan saja.

### 3.5 Import Jadwal Otomatis dari 2 Berkas PDF FET
- Alur import PDF:
  1. **Upload:** Waka mengunggah 2 berkas PDF sekaligus (PDF Jadwal Kelas & PDF Alokasi Ruang) serta memilih Putaran (`cycle_type: 1|2`). Status: `uploaded` (HTTP 202).
  2. **Parsing Asinkron:** Backend mengeksekusi script Python (`pdf_parser.py`) via queue worker berbasis koordinat sel tabel. Status: `parsing` -> `preview_ready`.
  3. **Pencocokan & Validasi Bentrok:** Dicocokkan ke master data via `fet_staff_id` guru, nama kelas, ruang, dan mapel. Menghasilkan status per baris: `matched`, `unmatched`, `conflict`, `duplicate`.
  4. **Resolusi Manual:** Waka memperbaiki baris tidak cocok lewat `PATCH /api/schedule-imports/{id}/rows/{row_id}` atau menandai `exclude: true`.
  5. **Konfirmasi Final:** Waka memasukkan password akun. Sistem memvalidasi `matched_count > 0` (ditolak 422 jika 0), melakukan *soft-delete* pada jadwal lama di putaran tersebut (*replace per putaran* tanpa merusak relasi jurnal lama), meng-insert baris baru dengan `source = 'imported'`, dan menghapus berkas PDF fisik.

### 3.6 Penanganan Guru Berhalangan Hadir & Hak Eksklusif Pengganti Kesiswaan
- **Hak Eksklusif Pengganti:** HANYA guru dengan penugasan struktural Kesiswaan (`teacher_assignments.type = 'kesiswaan'`) yang berhak menggantikan guru utama yang berhalangan hadir dalam pembukaan kelas, pengisian jurnal, dan presensi KBM (`substitute_teacher_id`).
- **Larangan Keras:** Wali Kelas maupun guru mapel lain yang tidak memiliki penugasan Kesiswaan **dilarang keras** membuka/mengisi jurnal guru lain (**HTTP 403 Forbidden**).
- **Penandaan Tanpa Pengganti (`teacher_absent`):** Jika jam pelajaran dibiarkan kosong, Guru Kesiswaan atau Waka menandai status jurnal sebagai `teacher_absent` lewat `PATCH /api/journals/{id}`.

### 3.7 Presensi Atomik & Berbasis Pengecualian (Exception-Based)
- Pengisian presensi disatukan ke dalam proses penyelesaian jurnal KBM (`PUT /api/journals/{id}`).
- Guru/Pengganti hanya mengirim daftar siswa yang **TIDAK HADIR** melalui array `exceptions` (`student_id`, `status: 'Sakit' | 'Izin' | 'Alpa'`).
- Seluruh siswa lain di kelas tersebut yang tidak masuk dalam daftar pengecualian **otomatis tercatat sebagai 'Hadir'** dalam satu transaksi atomik.
- Foto dokumentasi KBM wajib diunggah dan otomatis dikompresi di backend menjadi ~800px JPEG quality 35% (< 150KB).

### 3.8 Sinkronisasi Otomatis Perizinan ke Presensi Jurnal
- Saat sesi jurnal dibuka (`POST /api/journals`), sistem mencari pengajuan izin siswa yang berstatus `approved` dengan tipe `tidak_masuk` yang aktif pada tanggal tersebut.
- Data izin ini dikembalikan dalam `meta.approved_leaves` sehingga Front-End dapat langsung mengisi (*pre-fill*) status siswa tersebut sebagai Sakit atau Izin secara default (namun guru tetap dapat mengubahnya jika siswa ternyata masuk).
- Izin bertipe `keluar_sekolah` (*same-day*) **tidak mengubah status kehadiran** (tetap Hadir), hanya tercatat sebagai log izin keluar.

### 3.9 Sistem Kuis Berbantuan AI & Workflow Evaluasi Asinkron
- Mendukung **3 Metode Pembuatan Soal**:
  1. *Prompt AI:* Wajib konfigurasi ketat: `total_questions`, `question_types` (`multiple_choice`, `essay`, `combination`), `essay_count`, `mc_count` (penjumlahan kombinasi wajib konsisten).
  2. *Ekstraksi Dokumen:* Berkas PDF/TXT (maksimal 5MB) diparsing dan distrukturisasi oleh AI. Butir soal ambigu ditandai dengan flag `needs_review: true` beserta `review_note`.
  3. *Manual:* Penambahan butir soal satu per satu oleh guru.
- **Tahap Preview Wajib:** Kuis berada dalam status `draft_review`. Guru wajib meninjau, mengedit butir soal, sebelum melakukan konfirmasi publikasi (`published`).
- **Penilaian Hybrid Asinkron:** Pilihan ganda dikoreksi otomatis oleh sistem, sedangkan esai dinilai semantik oleh model AI (`ag/gemini-3.8-flash`).
- **Override & Publikasi Nilai:** Guru dapat meng-override nilai AI dengan pencatatan audit trail (`is_overridden`, `overridden_by`, `overridden_at`). Siswa dan orang tua **baru dapat melihat nilai dan umpan balik** setelah status kuis diubah menjadi `published_result`.

### 3.10 Siklus Kenaikan Kelas, Kelulusan, dan Retensi Data Lulusan
- Kenaikan kelas mengacu pada relasi rantai kelas `classes.next_class_id`.
- Siswa tinggal kelas ditandai secara individual sebelum eksekusi massal (`POST /api/students/{id}/hold-back`).
- Eksekusi kenaikan kelas massal (`POST /api/class-promotions`) memindahkan siswa ke `next_class_id` dan menetapkan tanggal kelulusan bagi kelas 12 (`next_class_id = null`).
- Sistem memiliki scheduled job harian yang secara otomatis menghapus permanen (*hard delete*) akun siswa dan data terkait **14 hari setelah tanggal kelulusan**.
