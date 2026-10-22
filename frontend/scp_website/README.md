# Dokumentasi Analisis UI/UX Prototype dan Sistem Backend SCP

**School Class Progress (SCP) — Front-End Web Architecture & System Readiness Document**  
**Acuan Analisis:** PRD v4.4, Master Plan Backend Fase 0–8, dan Kode Prototype `frontend/_Prototype/akademik-prototype`  
**Folder Dokumentasi:** `frontend/scp_website/`  
**Status Proyek:** Tahap Analisis & Perencanaan Selesai (Menunggu Konfirmasi untuk Memulai Implementasi Front-End)  

---

## 1. Daftar Dokumen Hasil Analisis

Dokumentasi hasil analisis disusun secara komprehensif ke dalam 8 dokumen terstruktur yang mencakup seluruh aspek sistem:

| No | Dokumen | Topik & Cakupan Utama | Tautan Berkas |
|:---:|---|---|:---:|
| **01** | **Pemahaman Sistem & Aturan Bisnis SCP** | Ringkasan pemahaman sistem SCP, arsitektur headless REST API, sentralisasi jadwal di Waka, import PDF FET, resolusi jam pelajaran dinamis, password re-confirmation, hak eksklusif Kesiswaan, presensi exception-based, kuis berbantuan AI, dan promosi kenaikan kelas. | [Buka Dokumen 01](./01_PEMAHAMAN_SISTEM_DAN_BISNIS_SCP.md) |
| **02** | **Analisis Prototype UI/UX** | Evaluasi struktur navigasi web, layout responsif (WebLayout), 14 komponen shared UI, kelebihan desain, kelemahan antarmuka, inkonsistensi styling, serta evaluasi halaman per peran. | [Buka Dokumen 02](./02_ANALISIS_PROTOTYPE_UI_UX.md) |
| **03** | **Analisis Backend & Spesifikasi API** | Daftar lengkap 40+ endpoint REST API, metode HTTP, skema request/response JSON, kode status (200, 201, 202, 401, 403, 404, 409, 422, 429), otentikasi Sanctum, rate limiting, dan kesiapan backend. | [Buka Dokumen 03](./03_ANALISIS_BACKEND_DAN_API.md) |
| **04** | **Pemetaan Role & Hak Akses Halaman** | Matriks otorisasi per peran (`vice_principal`, `teacher`, `kesiswaan`, `wali_kelas`, `student`, `parent`), hak mutasi vs read-only, logika auto-scoping data, dan route guarding. | [Buka Dokumen 04](./04_PEMETAAN_ROLE_DAN_AKSES_HALAMAN.md) |
| **05** | **Matriks Kesesuaian PRD, Prototype, & Backend** | Tabel komparasi tiga arah mencakup 34 modul fitur dengan indikator status: Sesuai Penuh (Aligned), Belum Lengkap (Partial), Gap Kritis (Major Gap), atau Perlu Konfirmasi. | [Buka Dokumen 05](./05_MATRIKS_KESESUAIAN_PRD_PROTOTYPE_BACKEND.md) |
| **06** | **Gap Analysis & Temuan Kritis** | Uraian kesenjangan fungsional, fitur yang belum ada di prototype (terutama kuis AI & exception-based presensi), inkonsistensi kontrak data, serta daftar pertanyaan teknis yang memerlukan konfirmasi pengguna (*Flagged for Confirmation*). | [Buka Dokumen 06](./06_GAP_ANALYSIS_DAN_TEMUAN_KRITIS.md) |
| **07** | **Rekomendasi Solusi & Desain Fitur Baru** | Rekomendasi perbaikan terklasifikasi (Wajib PRD, Integrasi Backend, Polish UX) dan spesifikasi antarmuka modal/layar baru (Modal Prompt AI, Ekstraksi Dokumen, Preview Soal, Override Nilai, Credential Modal, dsb.). | [Buka Dokumen 07](./07_REKOMENDASI_DAN_DESAIN_SOLUSI_UI_UX.md) |
| **08** | **Panduan Teknis Implementasi Front-End** | Panduan arsitektur direktori Front-End, konfigurasi Axios Client & Interceptor, standardisasi 5 UI States (Loading, Empty, Error, Forbidden, Step-up Auth), variabel lingkungan `.env`, dan roadmap sprint implementasi. | [Buka Dokumen 08](./08_PANDUAN_TEKNIS_IMPLEMENTASI_FRONTEND.md) |

---

## 2. Ringkasan Eksekutif Temuan Analisis

### 2.1 Kondisi Prototype UI/UX Saat Ini
- **Kelebihan:** Prototype `akademik-prototype` memiliki fondasi visual yang sangat kuat. Desain modern, bersih, minimalis, dan terorganisir dengan token Tailwind CSS yang rapi. Komponen bersama (*shared components*) seperti `Table`, `Modal`, `PasswordModal`, `Badge`, `Button`, `Input`, `Select`, dan `FileUpload` telah tersedia dan memiliki kualitas tampilan yang tinggi.
- **Kelemahan & Kesenjangan:**
  1. *Modul Kuis AI Belum Lengkap:* Prototype hanya menyediakan form input metadata kuis, namun **sama sekali belum menyediakan antarmuka untuk 3 metode pembuatan soal AI** (Prompt AI, Ekstraksi Dokumen PDF/TXT, dan Manual), tahap preview penyuntingan butir soal, antarmuka review submission siswa, serta form override nilai oleh guru.
  2. *Payload Presensi Belum Exception-Based:* Prototype masih mengirimkan seluruh daftar siswa, belum disesuaikan dengan skema *exception-based* backend yang hanya mengirimkan siswa berhalangan hadir.
  3. *Atribut Master Data Belum Lengkap:* Form input guru belum memiliki field `fet_staff_id`, dan belum ada modal untuk menyalin password acak yang dihasilkan sistem saat pembuatan guru/siswa.
  4. *Inkonsistensi Format Kontrak Data:* Parameter hari pada jadwal masih menggunakan string teks (`'Senin'`), sementara backend mewajibkan angka ISO (`1` s.d. `5`).

### 2.2 Kesiapan Backend REST API SCP
- **Kondisi Backend:** Backend Laravel 13 telah mencapai penyelesaian Fase 0 hingga Fase 8 dengan status **100% lolos pengujian otomatis (automated tests pass)**.
- Seluruh 40+ endpoint fungsional yang dibutuhkan (Autentikasi Sanctum, Pengaturan Akademik, Jadwal Terpusat Waka, Import PDF FET, Master Data, Presensi Exception-Based, Perizinan Siswa, dan Kuis AI Hybrid) telah aktif dan siap dikonsumsi.
- **Temuan Kesenjangan Backend:** Ditemukan bahwa backend **belum memiliki endpoint resmi untuk pengubahan kata sandi mandiri** (`PATCH /api/me/password`), meskipun PRD dan prototype menuntut adanya alur perubahan kata sandi saat pengguna pertama kali login (`must_change_password`). Temuan ini telah ditandai sebagai hal yang memerlukan konfirmasi teknis.

---

## 3. Poin-Poin yang Memerlukan Konfirmasi Pengguna

Sebelum tahap implementasi Front-End dimulai, berikut adalah hal-hal penting yang perlu dikonfirmasi:

1. **Endpoint Ubah Kata Sandi (`/api/me/password`):** Apakah backend akan menambahkan endpoint ini terlebih dahulu, ataukah fitur ganti kata sandi di halaman profil ditunda sementara?
2. **Struktur URL Review Import:** Apakah disepakati menggunakan parameter rute dinamis `/web/review-import/:id` agar ramah penyegaran halaman (*refresh-friendly*)?
3. **Mekanisme Polling Asinkron:** Apakah disepakati menggunakan interval polling 3–4 detik untuk memantau status parsing PDF dan generasi soal AI (HTTP 202 Accepted)?
4. **Persetujuan Desain Modal Kuis AI:** Apakah rancangan modal pembuatan soal kuis AI (Prompt, Dokumen, Preview, Submissions Review) pada Dokumen 07 sudah disetujui untuk diimplementasikan?

---

> [!NOTE]
> Sesuai ketentuan dan batasan pekerjaan pada fase ini, **seluruh kode yang ada di project (backend, prototype, maupun web) tidak mengalami perubahan apa pun**. Pekerjaan difokuskan 100% pada analisis mendalam dan penyusunan dokumen perencanaan terpadu ini.
