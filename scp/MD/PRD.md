Product Requirements Document (PRD)

School Class Progress (SCP) — Backend-Focused Edition

Versi Dokumen: 4.4 — Jadwal Terpusat di Waka, Import Jadwal Otomatis dari PDF, Resolusi Jam Pelajaran Dinamis, Password Re-confirmation

Fase Pengembangan: Uji Kompetensi Keahlian (UKK) RPL — SMK Negeri 1 Bantul

Tech Stack: Laravel 13 (Backend REST API) · Laravel Sanctum (Auth) · PostgreSQL (Database) · Supabase Storage (File Storage) · Queue Worker (proses asinkron AI & parsing PDF) · Python (subprocess parser PDF jadwal, dipanggil dari queue worker Laravel) · Twilio (OTP WhatsApp) · Google Sign-In (OAuth) — React.js (Web) & Flutter (Mobile) sebagai konsumen API.

# Catatan Revisi Versi 4.4

Dokumen ini merevisi v4.3 berdasarkan hasil wawancara lanjutan dengan Waka Kurikulum SMK Negeri 1 Bantul. Perubahan utama:

Pengelolaan jadwal SEPENUHNYA berpindah ke Waka. Guru kehilangan seluruh hak mutasi jadwal (tambah/edit/hapus) yang sebelumnya ada di dokumen use case awal — Guru kini hanya melihat jadwalnya (read-only).

Fitur baru: Import Jadwal otomatis dari 2 file PDF (jadwal mapel per kelas & jadwal ruangan) yang dihasilkan aplikasi FET milik Waka, dengan alur parse -> preview -> resolusi manual -> konfirmasi -> commit.

Parsing PDF menggunakan Python (dijalankan sebagai subprocess dari queue worker Laravel), dengan ekstraksi berbasis struktur/koordinat tabel — bukan urutan teks linear — untuk menghindari data yang tercampur akibat cell tabel yang kompleks.

Jam pelajaran tidak lagi disimpan sebagai waktu literal tetap di schedules, melainkan sebagai nomor periode yang di-resolve lewat tabel period_templates — mengakomodasi jam yang bergeser karena upacara/literasi/tadarus/Jumat pendek.

Tabel master baru: subjects (mata pelajaran), menggantikan pendekatan teks bebas, untuk mendukung rekap jurnal per mapel.

Fitur Lock Schedule (is_schedule_locked) DIHAPUS — digantikan mekanisme password re-confirmation pada seluruh aksi mutasi jadwal (edit/hapus manual, konfirmasi import, ubah status upacara mingguan).

Re-import jadwal bersifat replace penuh, namun di-scope PER PUTARAN (cycle_type) dan dieksekusi via soft-delete — bukan hard-delete — agar riwayat jurnal yang merujuk jadwal lama tidak rusak.

File PDF mentah dihapus dari Supabase Storage segera setelah proses import dikonfirmasi berhasil; metadata & hasil parsing tetap disimpan sebagai audit log.

# 1. Informasi Project

Nama Project: School Class Progress (SCP)

Deskripsi Project: Backend API RESTful terpusat untuk mengelola jadwal (termasuk import otomatis dari PDF), presensi siswa, jurnal mengajar guru, perizinan siswa, master data akademik, siklus kenaikan kelas & kelulusan, dan evaluasi Kuis AI.

Tujuan Project: Menyediakan satu sumber kebenaran (single source of truth) berupa REST API yang aman, konsisten, dan efisien — siap dikonsumsi oleh client apapun (Web/Mobile) tanpa perubahan logika bisnis di sisi server.

Target Pengguna API: Waka Kurikulum, Guru (termasuk yang merangkap Wali Kelas dan/atau Kesiswaan/BK), Siswa, Orang Tua.

Scope Dokumen: Fokus penuh pada Backend. Frontend (React/Flutter) hanya disinggung sebagai konteks konsumen API.

# 2. Gambaran Sistem & Arsitektur

Backend Laravel 13 dibangun sebagai API Provider murni (headless). React (Web) dan Flutter (Mobile) mengonsumsi endpoint yang identik, dengan hak akses ditegakkan sepenuhnya di sisi backend.

## Asumsi & Ketentuan Sistem

Timezone Asia/Jakarta (WIB) untuk seluruh perhitungan waktu.

Tabel classes bersifat permanen lintas tahun ajaran.

Akun Waka pertama dibuat via database seeder saat instalasi awal.

File (foto jurnal, bukti izin, PDF jadwal sementara) disimpan di Supabase Storage.

Proses yang memanggil layanan eksternal/berat (AI generate/koreksi kuis, parsing PDF jadwal) berjalan asinkron lewat queue worker.

PENGELOLAAN JADWAL SEPENUHNYA MILIK WAKA. Guru tidak memiliki hak input/edit/hapus jadwal dalam bentuk apapun — baik manual maupun otomatis. Waka memasukkan jadwal lewat input manual atau import PDF, untuk Putaran 1 dan Putaran 2 secara terpisah.

Jadwal sekolah mengikuti struktur PDF yang selalu konsisten dari aplikasi FET milik Waka — struktur tabel tetap sama antar periode, hanya isinya (guru/mapel/ruang/kelas) yang berubah.

# 3. Role & Hak Akses API

| Role / Penugasan | Data yang Dilihat (GET) | Aksi / Mutasi Utama |
| --- | --- | --- |
| Waka Kurikulum | Semua jadwal (Put 1 & 2), rekap jurnal, rekap presensi, seluruh master data, log siklus, hasil preview import jadwal. | CRUD Master Data (termasuk mapel), input/edit/hapus jadwal manual (password wajib), import & konfirmasi jadwal dari PDF (password wajib), kelola penugasan guru, kenaikan kelas & kelulusan, toggle Putaran & status upacara mingguan (password wajib). |
| Guru (dasar) | Jadwal mandiri (read-only), siswa di kelasnya, submission & soal Kuis AI miliknya. | Buka kelas & presensi, jurnal, buat/review/publish Kuis AI, override skor AI. TIDAK ADA hak mutasi jadwal. |
| Guru + assignment Kesiswaan/BK | Seluruh pengajuan izin, bukti surat, rekap presensi siswa sekolah. | Verifikasi status izin, menandai jurnal teacher_absent. |
| Guru + assignment Wali Kelas | Data kelas yang diampu. | Mengisi presensi pengganti saat teacher_absent pada kelasnya. |
| Siswa | Rekap absen mandiri, status izin mandiri, nilai & feedback kuis mandiri. | Ajukan/edit/batalkan izin (selama pending), mengerjakan Kuis AI, tautkan email/Google/HP. |
| Orang Tua | Rekap absen, status izin, & nilai kuis anak (via linked_student_id). | Read-only atas data anak. Bisa tautkan email/Google/HP akun sendiri. |

# 4. Konteks Frontend (Ringkas)

React.js (Web): dipakai Waka, termasuk layar khusus upload 2 PDF jadwal dan layar review/preview hasil parsing sebelum konfirmasi import.

Flutter (Mobile): role operasional harian (Guru, Siswa/Ortu). Guru TIDAK punya layar edit jadwal lagi — hanya kalender jadwal read-only.

Kedua client mengonsumsi endpoint REST yang identik pada bagian 9.

# 5. Detail Fitur & Business Logic

## 5.1 Auto-Provisioning Akun

Username Siswa = NIS, Username Guru = NIP (wajib diisi saat input data master, unik).

Password random 8 karakter, ditampilkan sekali di response, must_change_password dipaksa true.

Akun Orang Tua dibuat otomatis mengikuti input data Siswa.

## 5.2 Verifikasi Kontak Mandiri (Email, Google, No. HP)

Email nullable & self-linked lewat POST /api/me/email + verifikasi kode.

Google Sign-In via POST /api/me/google-link (id_token), auto-mengisi email jika kosong.

No. HP self-linked via OTP WhatsApp (Twilio): POST /api/me/phone + verifikasi OTP.

## 5.3 Resolusi Jam Pelajaran (Period Templates)

schedules TIDAK menyimpan waktu literal (start_time/end_time), melainkan day_of_week + period_number + duration_periods (jumlah slot berurutan yang dipakai, default 1 — beberapa mapel menempati 2 slot berurutan). Waktu aktual dihitung dinamis lewat tabel period_templates, karena jam mulai periode pertama berbeda-beda tergantung hari dan kondisi mingguan:

| day_type | Kondisi | Ketentuan |
| --- | --- | --- |
| senin_upacara | Senin, ada upacara bendera minggu ini | Siswa masuk gerbang pukul 07:00, jam pelajaran pertama dimulai 08:00 |
| senin_reguler | Senin, tidak ada upacara (diganti tadarus/pendalaman iman) | Jam pelajaran pertama dimulai 07:15 |
| selasa | Selasa (selalu ada literasi) | Jam pelajaran pertama dimulai 07:30 |
| rabu_kamis | Rabu & Kamis (pendalaman iman/tadarus) | Jam pelajaran pertama dimulai 07:15 |
| jumat | Jumat | Jam pelajaran pertama dimulai 07:15, tiap JP berdurasi 40 menit (lebih singkat dari hari lain) |

Status Senin (upacara/reguler) ditentukan oleh SATU setting tunggal system_configurations.monday_is_upacara (default true), yang dapat diubah Waka KAPAN SAJA (tidak terikat siklus mingguan otomatis) lewat endpoint khusus yang mewajibkan konfirmasi password (lihat 5.4).

Setiap perubahan day_of_week + period_number pada suatu schedule di-resolve ke waktu aktual saat dibutuhkan (tampilan jadwal, perhitungan alert keterlambatan jurnal 5.6, dsb) dengan melihat period_templates sesuai day_type yang berlaku saat itu.

## 5.4 Password Re-confirmation untuk Aksi Sensitif Jadwal

Menggantikan fitur Lock Schedule (dihapus di versi ini, lihat Catatan Revisi). Karena hanya Waka yang memegang hak mutasi jadwal, perlindungan dipindah dari mekanisme lock/unlock global menjadi verifikasi ulang password Waka pada titik aksi yang sensitif:

POST, PUT, DELETE /api/schedules (mutasi manual jadwal oleh Waka).

POST /api/schedule-imports/{id}/confirm (commit hasil import PDF).

PATCH /api/academic-settings/monday-status (ubah status upacara mingguan).

Seluruh endpoint di atas mewajibkan field password pada body request, diverifikasi ulang terhadap password akun Waka yang sedang login sebelum aksi dieksekusi. Password salah -> 422, aksi dibatalkan, tidak ada perubahan data.

## 5.5 Manajemen Siklus/Putaran & Riwayat

Setiap perubahan active_cycle lewat PATCH /api/academic-settings otomatis tercatat ke cycle_history. Jadwal Putaran 1 dan Putaran 2 disimpan BERSAMAAN di tabel schedules (dibedakan kolom cycle_type), tidak saling menimpa — Waka menginput/mengimpor keduanya secara terpisah, dan saat mengedit jadwal, Waka terlebih dahulu memilih konteks Putaran mana yang ingin diubah.

## 5.6 Dashboard Alert Keterlambatan Jurnal

GET /api/schedules?status=missing_journal mencari jadwal hari ini (WIB) yang waktu selesainya (hasil resolusi period_templates) + 30 menit sudah lewat namun jurnal belum completed. Jadwal berstatus teacher_absent dikecualikan.

## 5.7 Penanganan Guru Berhalangan Hadir

journals.status mendukung teacher_absent, ditandai oleh Guru dengan assignment Kesiswaan/BK atau Waka.

Presensi kelas tersebut tetap wajib diisi (default Hadir kecuali ditandai) oleh Guru dengan assignment terkait kelas tersebut.

Query alert (5.6) mengecualikan status ini.

## 5.8 Presensi: Payload Ringkas (Exception-Based)

Guru hanya mengirim siswa yang TIDAK hadir di PUT /api/journals/{id}. Sisanya otomatis Hadir. attendances.status ENUM: Hadir, Sakit, Izin, Alpa.

## 5.9 Sinkronisasi Perizinan ke Presensi

Saat guru membuka kelas, siswa dengan leave_requests Approved bertipe tidak_masuk (start_date <= tanggal <= end_date) otomatis ter-pre-fill Sakit/Izin sebagai default (Guru bisa override manual). Izin bertipe keluar_sekolah TIDAK mengubah status presensi (tetap Hadir), hanya tercatat sebagai log terpisah.

## 5.10 Perizinan: 2 Tipe x 2 Kategori

| Field | Berlaku Untuk | Keterangan |
| --- | --- | --- |
| type | Semua | ENUM: tidak_masuk, keluar_sekolah |
| category | Semua | ENUM: sakit, lainnya |
| start_date, end_date | tidak_masuk | Rentang tanggal, mendukung multi-hari |
| departure_time, expected_return_time | keluar_sekolah | Same-day |

Siswa dapat edit/batalkan pengajuan selama status pending. verified_by & verified_at tercatat sebagai audit trail. Validasi file: jpg/jpeg/png/pdf, maks 2MB.

## 5.11 Kompresi Foto Jurnal

Resize lebar maksimum ~800px, re-encode JPEG quality ~30-40%, target akhir idealnya di bawah ~150KB (dapat di-tuning tanpa mengubah arsitektur).

## 5.12 Manajemen Master Data & Penugasan Guru

Waka memiliki CRUD penuh atas classes, rooms, students, teachers, DAN subjects (baru). /api/teachers, /api/students beroperasi pada tabel users terfilter role, bukan tabel terpisah.

Data guru kini menyertakan fet_staff_id (nomor ID resmi guru dari daftar staf sekolah yang juga dipakai aplikasi FET Waka) — nullable, unique. Field ini yang jadi kunci pencocokan utama saat import jadwal (5.17), lebih andal dibanding pencocokan nama.

Penghapusan (DELETE) memakai soft-delete; DITOLAK (409) bila entitas masih direferensikan schedule aktif.

Penugasan tambahan guru (Kesiswaan/BK, Wali Kelas) diatur via POST/DELETE /api/teachers/{id}/assignments.

## 5.13 Kenaikan Kelas & Kelulusan

classes.next_class_id menentukan kelas tujuan kenaikan; NULL = kelas akhir.

Waka menandai siswa tidak naik via POST /api/students/{id}/hold-back sebelum POST /api/class-promotions dijalankan (bulk, akhir tahun ajaran).

Siswa di kelas akhir yang lulus: users.graduation_date diisi Waka. Job harian menghapus PERMANEN (hard delete) akun & data siswa 14 hari setelah graduation_date.

## 5.14 Workflow Evaluasi Kuis AI (Asinkron)

POST /api/quizzes (due_date, max_attempts) -> generating -> job asinkron -> quiz_questions -> draft_review.

Guru review/edit soal (GET/PUT .../questions), tandai reviewed lalu published.

Siswa submit (attempt_number, batas sesuai max_attempts, ditolak jika lewat due_date) -> koreksi AI asinkron -> graded.

Guru review semua submission, override skor/feedback (tercatat overridden_by/at), publish hasil (published_result).

Tipe essay: correct_answer diisi rubrik/kata kunci, bukan jawaban literal.

## 5.15 Rekap Presensi & Izin

GET /api/attendances dan GET /api/leave-requests auto-scoped berdasarkan role & assignment dari token, bukan dari parameter client.

## 5.16 Import Jadwal dari PDF

Fitur inti baru versi ini. Waka mengunggah 2 file PDF sekaligus per satu batch import: PDF jadwal mapel per kelas (sumber utama: mapel, guru, hari, nomor jam) dan PDF jadwal ruangan (sumber cross-check: ruang per kelas per jam). Struktur kedua PDF konsisten antar periode/semester (hanya isinya berubah), sehingga parser dapat dibuat berbasis struktur tabel yang tetap.

## Alur Proses:

1) Upload — Waka mengunggah kedua PDF + memilih cycle_type (Putaran 1/2) yang dituju. File disimpan sementara di Supabase Storage. Record schedule_imports dibuat, status uploaded.

2) Parsing asinkron — Job queue Laravel memanggil script Python sebagai subprocess (Symfony Process), mengirim path kedua file. Python mengekstrak tabel berdasarkan koordinat/struktur sel (bukan urutan teks linear) agar tidak tercampur akibat sel gabungan. Output: JSON terstruktur per baris (kelas, hari, nomor jam, durasi slot, mapel, guru + fet_staff_id jika ada, kode ruang dari kedua sumber). Status -> parsing lalu preview_ready.

3) Pemetaan ke master data — tiap baris dicocokkan ke classes, subjects, users (guru, via fet_staff_id sebagai kunci utama, fallback nama), rooms. Ruang dicocokkan silang dari kedua PDF; jika keduanya sepakat -> matched, jika beda/kosong -> unmatched dengan kandidat.

4) Validasi bentrok — baris matched diuji lewat logika anti-tabrakan (5.3-lama, kini berbasis rentang period_number) terhadap sesama baris hasil parsing maupun jadwal existing pada cycle_type yang sama.

5) Preview — Waka memanggil GET /api/schedule-imports/{id} untuk melihat ringkasan: baris matched (siap commit), unmatched (perlu resolusi), conflict (bentrok).

6) Resolusi manual — Waka mengoreksi baris unmatched satu per satu lewat PATCH /api/schedule-imports/{id}/rows/{row_id}, atau meng-exclude baris tertentu.

7) Konfirmasi — Waka memanggil POST /api/schedule-imports/{id}/confirm dengan password. Backend re-validasi sekali lagi, lalu dalam satu transaksi: seluruh schedules existing pada cycle_type yang sama di-soft-delete (deleted_at diisi, TIDAK dihapus permanen agar journals lama tetap valid), dan seluruh baris hasil resolusi final di-insert sebagai schedules baru (source=imported, import_batch_id terisi).

8) Pembersihan — setelah commit sukses, kedua file PDF dihapus dari Supabase Storage (file_path dikosongkan); record schedule_imports & schedule_import_rows tetap disimpan sebagai audit log hasil parsing.

Import manual (non-PDF) tetap tersedia lewat POST /api/schedules biasa untuk koreksi ad-hoc satu baris, juga mewajibkan password (5.4).

6. Database Concept (PostgreSQL)

| Nama Tabel | Fungsi | Field Kunci / Relasi (Ringkas) |
| --- | --- | --- |
| users | Data pengguna lintas role & kontak opsional. | id, role (ENUM), nis_nip (unique), fet_staff_id (nullable, unique, khusus guru), password, must_change_password, email/google_id/phone_number (nullable+verifikasi), linked_student_id, class_id, graduation_date, deleted_at |
| classes | Master kelas, permanen lintas tahun ajaran. | id, name, level, next_class_id (FK self, nullable), deleted_at |
| rooms | Master ruang. | id, name, capacity, deleted_at |
| subjects | Master mata pelajaran. (Baru) | id, name, deleted_at |
| teacher_assignments | Penugasan tambahan guru (multirole). | id, user_id, type (ENUM: kesiswaan/wali_kelas), class_id (nullable) |
| period_templates | Jam pasti per nomor periode, per tipe hari. (Baru) | id, day_type (ENUM: senin_upacara/senin_reguler/selasa/rabu_kamis/jumat), period_number, start_time, end_time |
| schedules | Jadwal per Putaran, waktu direpresentasikan sbg periode. | id, teacher_id, class_id, room_id, subject_id, day_of_week, period_number, duration_periods (default 1), cycle_type, source (ENUM: manual/imported), import_batch_id (nullable), deleted_at |
| schedule_imports | Batch proses import PDF jadwal. (Baru) | id, waka_id, cycle_type, file_path_kelas, file_path_ruangan (nullable stlh sukses), status (ENUM: uploaded/parsing/preview_ready/confirmed/failed), parser_version, created_at |
| schedule_import_rows | Baris hasil parsing per batch. (Baru) | id, import_id (FK), raw_data (JSON), matched_class_id/teacher_id/room_id/subject_id (nullable), day_of_week, period_number, duration_periods, match_status (ENUM: matched/unmatched/conflict/duplicate), room_source_conflict (boolean), resolved_by_waka (boolean) |
| cycle_history | Log riwayat pergantian Putaran. | id, cycle_number, started_at, ended_at, changed_by |
| journals | Jurnal mengajar per tanggal. | id, schedule_id, date, topic_description, photo_path (terkompresi), status (ENUM: ongoing/completed/teacher_absent), substitute_teacher_id. Unique (schedule_id, date). |
| leave_requests | Perizinan siswa (2 tipe x 2 kategori). | id, student_id, applicant_id, type, category, start_date, end_date, departure_time, expected_return_time, status_approval, document_path, verified_by, verified_at |
| attendances | Presensi individual harian (exception-based). | id, journal_id, student_id, status (ENUM: Hadir/Sakit/Izin/Alpa), date |
| system_configurations | Konfigurasi status Putaran aktif & status upacara mingguan. | id, active_cycle, monday_is_upacara (boolean, default true) |
| otp_codes | Kode OTP verifikasi email & No. HP. | id, user_id, code, purpose (ENUM: email/phone), expires_at |
| ai_quizzes | Metadata, status, & aturan pengerjaan kuis. | id, teacher_id, class_id, title, status, due_date, max_attempts |
| quiz_questions | Soal individual hasil AI. | id, quiz_id, question_text, options (JSON), correct_answer, question_type |
| quiz_submissions | Jawaban siswa, hasil AI, override Guru. | id, quiz_id, student_id, attempt_number, answers_payload (JSON), grading_status, ai_score, ai_feedback, is_overridden, overridden_by, overridden_at. Unique (quiz_id, student_id, attempt_number). |
| personal_access_tokens | Token API Sanctum dengan expiry. | id, tokenable_id, token, name, expires_at |

Catatan: kolom is_schedule_locked pada system_configurations DIHAPUS pada versi ini (lihat 5.4).

# 7. Autentikasi API & Standar Response

## Mekanisme Multi-Device (Sanctum)

POST /api/login: { username, password, device_name } -> Bearer Token + expires_at.

Token tidak dipakai 30 hari -> otomatis invalid. must_change_password memaksa ganti password di login pertama.

## Password Re-confirmation Pattern

Endpoint yang tergolong aksi sensitif (5.4) mewajibkan field password tambahan pada body request, terlepas dari Bearer Token yang sudah valid. Ini adalah lapisan verifikasi kedua (step-up authentication), bukan pengganti otentikasi token.

## Standar Format Response JSON

Sukses: { "success": true, "message": "...", "data": { ... }, "meta": { ... } }

Error (berlaku utk semua kode status termasuk 401/403/404/422/500): { "success": false, "message": "...", "errors": { "field": ["..."] } }

## Standar Pagination & Rate Limiting

Endpoint list mendukung ?page=&per_page= (default 15) dengan meta { current_page, per_page, total, last_page }. Throttle 60 request/menit per token untuk endpoint terautentikasi.

# 8. Proses Terjadwal (Scheduled Jobs)

| Job | Frekuensi | Fungsi |
| --- | --- | --- |
| Pembersihan Akun Lulusan | Harian | Hard delete akun & data siswa dengan graduation_date + 14 hari <= hari ini. |
| Pembersihan OTP Kedaluwarsa | Harian | Menghapus baris otp_codes yang sudah lewat expires_at. |
| Job Antrian AI & Parsing PDF (Queue Worker) | Terus-menerus (daemon) | Memproses generate/koreksi Kuis AI serta parsing PDF jadwal secara asinkron. |

Pembersihan file PDF jadwal (setelah import sukses) dilakukan SINKRON di dalam endpoint konfirmasi, bukan job terjadwal. Proses Kenaikan Kelas dipicu manual oleh Waka, bukan otomatis.

# 9. Spesifikasi Endpoint REST API (Resource-Based)

## 9.1 Autentikasi, Profil & Verifikasi Kontak

POST /api/login | Public.

POST /api/logout | Auth.

GET /api/me | Auth | Termasuk daftar teacher_assignments.

POST /api/me/email, POST /api/me/email/verify | Auth.

POST /api/me/google-link | Auth.

POST /api/me/phone, POST /api/me/phone/verify | Auth.

## 9.2 Setting Akademik & Riwayat

GET & PATCH /api/academic-settings | Auth (Waka) | Mengatur active_cycle; PATCH tercatat ke cycle_history.

PATCH /api/academic-settings/monday-status | Auth (Waka) | Body: { is_upacara, password }. (Baru)

GET /api/cycle-history | Auth (Waka).

## 9.3 Master Data & Penugasan

GET /api/classes, /api/rooms, /api/students, /api/teachers, /api/subjects | Auth | Pagination. (subjects baru)

POST /api/classes, /api/rooms, /api/students, /api/teachers, /api/subjects | Auth (Waka) | Untuk students/teachers, auto-provisioning akun berjalan (5.1); teachers menyertakan fet_staff_id.

PUT & DELETE (soft-delete) untuk seluruh entitas di atas | Auth (Waka) | DELETE ditolak 409 jika masih direferensikan schedule aktif.

POST /api/teachers/{id}/assignments, DELETE /api/teachers/{id}/assignments/{assignment_id} | Auth (Waka).

POST /api/students/{id}/hold-back, POST /api/class-promotions | Auth (Waka).

## 9.4 Jadwal (Schedules) — Sepenuhnya Milik Waka

GET /api/schedules | Auth | Query: ?cycle=1|2, ?day=. Guru melihat jadwalnya (read-only), Waka melihat & mengelola seluruh. Pagination.

GET /api/schedules?status=missing_journal | Auth (Guru/Waka) | Alert jurnal terlambat berbasis waktu hasil resolusi period_templates, mengecualikan teacher_absent.

POST /api/schedules | Auth (Waka) | Body termasuk password. Input manual satu baris jadwal (di luar alur import PDF), cek bentrok berbasis rentang period_number -> 201 atau 422.

PUT & DELETE /api/schedules/{id} | Auth (Waka) | Body/param termasuk password (5.4).

## 9.5 Import Jadwal dari PDF (Baru)

POST /api/schedule-imports | Auth (Waka) | Multipart: { cycle_type, file_kelas, file_ruangan } -> memicu parsing asinkron, 202 Accepted.

GET /api/schedule-imports/{id} | Auth (Waka) | Polling status & hasil preview (matched/unmatched/conflict rows).

PATCH /api/schedule-imports/{id}/rows/{row_id} | Auth (Waka) | Resolusi manual satu baris (pilih class_id/teacher_id/room_id/subject_id yang benar, atau exclude).

POST /api/schedule-imports/{id}/confirm | Auth (Waka) | Body: { password } -> commit final: soft-delete schedules lama pada cycle_type terkait, insert baris final, hapus file PDF dari storage.

DELETE /api/schedule-imports/{id} | Auth (Waka) | Membatalkan proses import yang belum dikonfirmasi.

## 9.6 Perizinan & Presensi

POST /api/leave-requests | Auth (Siswa) | Body sesuai tipe (5.10), multipart untuk bukti.

GET /api/leave-requests | Auth (Kesiswaan: semua + filter status; Siswa/Ortu: auto-scoped) | Pagination.

PATCH /api/leave-requests/{id} | Auth (Kesiswaan: verifikasi; Siswa pemilik: edit selama pending).

DELETE /api/leave-requests/{id} | Auth (Siswa pemilik, hanya selama pending).

GET /api/attendances | Auth (Waka/Kesiswaan: semua + filter; Siswa/Ortu: auto-scoped) | Pagination.

## 9.7 Jurnal (KBM)

GET /api/journals | Auth (Waka: semua; Guru: milik sendiri) | Pagination.

POST /api/journals | Auth (Guru: buka kelas & sync presensi; Kesiswaan/Waka: menandai teacher_absent).

PUT /api/journals/{id} | Auth (Guru pemilik) | Multipart: foto (dikompresi), topik, attendances (exception-based).

PATCH /api/journals/{id} | Auth (Kesiswaan/Waka) | Menandai teacher_absent pada jurnal yang sudah dibuka.

## 9.8 Evaluasi Kuis AI

GET /api/quizzes | Auth (Guru: miliknya; Siswa: published kelasnya) | Pagination.

POST /api/quizzes | Auth (Guru) | due_date, max_attempts -> generate asinkron.

GET /api/quizzes/{id} | Auth | Polling status.

GET & PUT /api/quizzes/{id}/questions[/{question_id}] | Auth (Guru) | Review & edit soal.

PATCH /api/quizzes/{id} | Auth (Guru) | Ubah status/due_date/max_attempts.

POST /api/quizzes/{id}/submissions | Auth (Siswa) | Ditolak 422 jika melebihi attempt/due_date.

GET /api/quizzes/{id}/submissions | Auth (Guru) | Review semua submission.

PATCH /api/quiz-submissions/{id} | Auth (Guru) | Override skor/feedback, audit trail.

GET /api/quizzes/{id}/submissions/me | Auth (Siswa/Ortu) | Hasil final setelah published_result.

# 10. Acceptance Criteria (Rubrik Penilaian UKK)

| Fitur Utama | Kriteria Kelulusan (Checklist) |
| --- | --- |
| API Security | Request tanpa Bearer Token ditolak universal (401); rate limiting aktif. |
| Jadwal Milik Waka | Guru tidak memiliki endpoint mutasi jadwal apapun; seluruh mutasi hanya lewat akun Waka dan mewajibkan password re-confirmation. |
| Import Jadwal PDF | Sistem berhasil mem-parsing 2 file PDF contoh, menghasilkan preview matched/unmatched/conflict yang akurat, dan mengizinkan Waka meresolusi baris unmatched sebelum commit. |
| Replace Per Putaran | Konfirmasi import hanya meng-soft-delete jadwal pada cycle_type yang sesuai; jurnal historis yang merujuk jadwal lama tetap dapat diakses (tidak orphan/rusak). |
| Resolusi Jam Pelajaran | Waktu aktual suatu periode dihitung benar sesuai day_type yang berlaku (termasuk saat monday_is_upacara diubah Waka). |
| Auto-Provisioning Akun | Input data Siswa otomatis membuat akun Siswa + Orang Tua dengan password auto-generate & must_change_password. |
| Multirole Guru | Satu akun Guru dapat memegang lebih dari satu teacher_assignment sekaligus. |
| Sinkronisasi Izin | Izin tidak_masuk Approved terisi otomatis pada rentang tanggalnya; izin keluar_sekolah tidak mengubah status hadir. |
| Presensi Exception-Based | Siswa yang tidak disebut guru pada payload otomatis tercatat Hadir. |
| Kuis AI Asinkron | Proses AI tidak memblokir response HTTP; batas percobaan & deadline ditegakkan. |
| Kenaikan Kelas & Kelulusan | Promosi kelas & hard delete akun lulusan berjalan sesuai aturan retensi 14 hari. |
