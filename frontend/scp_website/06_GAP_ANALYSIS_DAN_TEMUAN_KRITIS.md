# Dokumen 06: Gap Analysis dan Daftar Temuan Kritis

**Tujuan Dokumen:** Mengidentifikasi secara terperinci seluruh kesenjangan (*gaps*), inkonsistensi arsitektur, dan kebutuhan yang belum terpenuhi antara PRD v4.4, Prototype UI/UX, dan Backend REST API SCP.  

---

## 1. Kesenjangan Utama Prototype (Fitur Ada di Backend & PRD, Belum Ada di Prototype)

Kesenjangan pada prototype UI/UX terbagi ke dalam dua kelompok: **Kesenjangan Kritis (Fungsional Utama Terpotong)** dan **Kesenjangan Minor (Penyempurnaan Alur)**.

### 1.1 Kesenjangan Kritis pada Modul Kuis AI (`TeacherQuizWeb.jsx`)
Modul Kuis Berbantuan AI merupakan salah satu rubrik penilaian utama UKK (PRD Bagian 5.14 & 10), namun prototype saat ini hanya menyediakan antarmuka pembuatan metadata awal kuis (judul, kelas, deadline). Fitur-fitur vital berikut belum tersedia:
1. **Antarmuka 3 Metode Pembuatan Soal:**
   - *Metode 1 (Prompt AI):* Tidak ada modal konfigurasi prompt yang memvalidasi `total_questions`, `question_types` (`multiple_choice`, `essay`, `combination`), `mc_count`, dan `essay_count`.
   - *Metode 2 (Ekstraksi Dokumen):* Tidak ada komponen pengunggahan berkas soal (PDF/TXT maks 5MB) dan indikator status parsing AI.
   - *Metode 3 (Manual):* Tidak ada form input butir soal satu per satu (teks soal, opsi A-D, kunci jawaban).
2. **Tahap Preview & Penyuntingan Butir Soal:**
   - Guru belum dapat mengedit teks soal, mengganti opsi jawaban, memperbarui rubrik esai, atau menghapus soal yang tidak sesuai pada tahap `draft_review`.
   - Tidak ada penanda visual untuk soal ambigu (`needs_review: true` beserta `review_note`) hasil ekstraksi dokumen.
3. **Layar Tinjauan Pengumpulan (*Submissions Review*) & Koreksi Guru:**
   - Guru tidak memiliki antarmuka untuk melihat daftar siswa yang telah mengumpulkan jawaban beserta nomor percobaannya (`attempt_number`).
   - Tidak ada modal atau form untuk melakukan **Override Nilai AI** (`PATCH /api/quiz-submissions/{id}`) dengan catatan umpan balik guru.
4. **Tombol Aksi Publikasi & Rilis Hasil:**
   - Tidak ada tombol untuk mengubah status kuis dari `draft_review` menjadi `published`.
   - Tidak ada tombol untuk merilis hasil akhir kuis ke siswa dan orang tua (`status: published_result`).

### 1.2 Kesenjangan pada Modul Jurnal & Presensi Kelas (`TeacherJournalWeb.jsx`)
1. **Payload Presensi Masih Bersifat Menyeluruh (*All Students*):**
   - Prototype mengumpulkan status seluruh siswa dan mengirimkannya, sedangkan backend API mewajibkan pendekatan **Exception-Based** (hanya mengirim array siswa yang Sakit, Izin, atau Alpa; siswa lain otomatis Hadir).
2. **Pengabaian Data `meta.approved_leaves`:**
   - Saat sesi KBM dibuka (`POST /api/journals`), backend mengembalikan daftar siswa yang sudah memiliki izin resmi (*approved*). Prototype belum mengonsumsi data ini untuk secara otomatis mem-prefill status siswa tersebut di form presensi.

### 1.3 Kesenjangan pada Modul Master Data (`MasterData.jsx`)
1. **Atribut `fet_staff_id` Guru Belum Diinput:**
   - Form pembuatan/pengeditan guru di prototype belum menyediakan input `fet_staff_id`. Padahal field ini adalah kunci pencocokan utama pada alur import jadwal PDF FET.
2. **Ketiadaan Modal Tampilan Kata Sandi Awal (*Initial Password Modal*):**
   - Sistem backend SCP menerapkan *auto-provisioning* di mana password akun guru dan siswa di-generate acak (8 karakter) dan dikembalikan sekali pada respons pembuatan (`data.password`).
   - Prototype belum memiliki modal konfirmasi yang menampilkan kata sandi acak tersebut agar dapat langsung disalin (*copy to clipboard*) oleh Waka untuk diserahkan ke guru/siswa bersangkutan.

### 1.4 Kesenjangan pada Modul Perizinan Siswa (`StudentPermissionWeb.jsx`)
- Siswa belum memiliki antarmuka modal untuk **mengedit data perizinan** yang masih berstatus `pending` (`PATCH /api/leave-requests/{id}`). Saat ini prototype hanya menyediakan opsi pembatalan/penghapusan.

---

## 2. Inkonsistensi Desain & Kontrak Data (Contract Inconsistencies)

| No | Lokasi Temuan | Implementasi Prototype | Kontrak Data Backend API | Dampak & Rekomendasi Solusi |
|---|---|---|---|---|
| **1** | Format Hari Jadwal | Menggunakan string literal: `'Senin'`, `'Selasa'`, `'Rabu'`, `'Kamis'`, `'Jumat'`. | Menggunakan angka integer ISO: `1` (Senin) s.d. `5` (Jumat). | Filter dan payload jadwal gagal validasi (HTTP 422). Front-End wajib melakukan mapping: `{'Senin': 1, 'Selasa': 2, ...}`. |
| **2** | Status Presensi | Menggunakan variasi string lowercase / capitalize. | Menggunakan ENUM sensitif huruf besar: `'Hadir'`, `'Sakit'`, `'Izin'`, `'Alpa'`. | Backend menolak nilai status selain 4 opsi tersebut. Front-End wajib menyelaraskan nilai opsi select/button. |
| **3** | Pemisahan Role Kesiswaan | Dibuat sebagai role terpisah di `AuthContext` (`ROLES.KESISWAAN = 'kesiswaan'`). | Role di database adalah `'teacher'`; Kesiswaan adalah penugasan di `teacher_assignments`. | Menu dan hak akses di Front-End harus berbasis kombinasi `user.role === 'teacher'` dan keberadaan penugasan kesiswaan. |
| **4** | Parameter Password pada Aksi Sensitif | Sebagian modal konfirmasi hanya melakukan simulasi timeout tanpa mengirim field `password` ke payload. | Backend mewajibkan field `password: "..."` pada body mutasi jadwal, import, dan saklar upacara. | Aksi ditolak dengan status HTTP 422 jika password tidak disertakan di payload request. |
| **5** | Transisi Alur Import PDF | Halaman `UploadImport` berpindah ke `ReviewImport` tanpa membawa ID batch import. | Endpoint review mewajibkan parameter ID batch: `GET /api/schedule-imports/{id}`. | Gunakan state navigasi React Router (`navigate('/web/review-import', { state: { importId } })`) atau URL dinamis (`/web/review-import/:id`). |

---

## 3. Kesenjangan Sisi Backend (Kebutuhan yang Belum Didukung API)

Selama analisis mendalam terhadap kode backend `scp/app/Http/Controllers/API`, ditemukan beberapa kebutuhan penting yang belum memiliki endpoint pendukung di sisi server:

### 3.1 Ketiadaan Endpoint Ganti Kata Sandi (`PATCH /api/me/password`)
- **Temuan:**
  - PRD Bagian 7 menyatakan: *"must_change_password memaksa ganti password di login pertama."*
  - Prototype `ProfileWeb.jsx` telah menyediakan form visual "Ubah Kata Sandi" (`oldPassword`, `newPassword`, `confirmPassword`).
  - Halaman `Login.jsx` memiliki state deteksi `mustChangePassword`.
  - **Namun, pada file `routes/api.php`, sama sekali belum terdaftar endpoint untuk mengubah kata sandi pengguna** (tidak ada rute `PATCH /api/me/password` atau `POST /api/me/change-password`).
- **Rekomendasi:** Backend perlu menambahkan satu endpoint sederhana `PATCH /api/me/password` yang memvalidasi kata sandi lama, memeriksa kecocokan kata sandi baru (minimal 8 karakter), memperbarui hash di database, dan mengubah `must_change_password` menjadi `false`.

### 3.2 Ketiadaan Parameter Tanggal Kelulusan Dinamis pada Promosi Kelas
- **Temuan:**
  - Pada `GradePromotion.jsx`, prototype menyediakan input tanggal kelulusan (`graduationDate: '2026-06-20'`).
  - Pada backend `SchoolClassController::promoteClasses` (baris 162), penetapan tanggal kelulusan di-hardcode menggunakan tanggal saat request dijalankan: `'graduation_date' => now()->toDateString()`.
- **Rekomendasi:** Perlu konfirmasi apakah backend akan menerima body opsional `{ graduation_date }` pada endpoint `POST /api/class-promotions`, ataukah Front-End cukup menampilkan informasi bahwa tanggal kelulusan otomatis tercatat per hari eksekusi.

---

## 4. Hal-Hal yang Perlu Dikonfirmasi (Flagged for Confirmation)

Berikut adalah daftar pertanyaan teknis dan keputusan desain yang membutuhkan konfirmasi dari Pengguna sebelum tahap implementasi dimulai:

> [!IMPORTANT]
> **Daftar Hal yang Memerlukan Konfirmasi Pengguna:**

1. **Konfirmasi Rute Ubah Kata Sandi (Change Password):**
   - *Pertanyaan:* Apakah tim backend akan membuatkan endpoint baru `PATCH /api/me/password`, ataukah fitur ubah kata sandi di halaman profil ditunda terlebih dahulu pada tahap 1 ini?
2. **Struktur URL Halaman Review Import:**
   - *Pertanyaan:* Apakah alur Review Import lebih disukai menggunakan rute statis dengan state internal (`/web/review-import`) atau rute dinamis yang ramah bookmark/refresh (`/web/review-import/:id`)?
3. **Mekanisme Polling vs Webhook untuk AI & PDF Parsing:**
   - *Pertanyaan:* Mengingat proses parsing PDF dan generate soal AI berjalan asinkron via queue worker (HTTP 202 Accepted), apakah Front-End disepakati menggunakan polling berkala (misal: tiap 3–5 detik hingga status berubah menjadi `preview_ready` / `draft_review`)?
4. **Tampilan Siswa Lulus pada Akun Orang Tua:**
   - *Pertanyaan:* Sesuai aturan PRD 5.13 & 8, akun siswa yang telah lulus akan di-hard-delete setelah 14 hari. Bagaimana pengalaman antarmuka untuk Orang Tua setelah akun anak terhapus? Apakah akun orang tua otomatis ikut nonaktif atau menampilkan pesan arsip kelulusan?
5. **Kebijakan Tautan Google SSO Baru:**
   - *Pertanyaan:* Apakah pendaftaran akun baru diperbolehkan melalui Google Sign-In, ataukah Google SSO murni hanya sebagai jalur alternatif masuk bagi akun yang sudah dibuatkan oleh Waka (auto-provisioning)?
