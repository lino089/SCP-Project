# Dokumen Perencanaan: Perubahan Konten Informasi Section 02 / Kapabilitas Inti
**Aplikasi:** School Class Progress (SCP) — SMK Negeri 1 Bantul  
**Bagian yang Ditargetkan:** Khusus Section `02 / Kapabilitas Inti` (Bento Grid)  
**Tujuan Utama:** Mengubah penyampaian teknis IT menjadi bahasa yang sederhana, manusiawi, dan berorientasi pada manfaat nyata bagi seluruh warga sekolah.  
**Status:** Menunggu Persetujuan Pengguna Sebelum Implementasi Kode

---

## 1. Analisis Masalah Konten Saat Ini vs Arah Baru

### A. Kondisi Konten Saat Ini (Terlalu Teknis)
Saat ini teks pada 4 kartu Bento menggunakan istilah internal pemrograman yang hanya dipahami developer:
- `Python Subprocess Engine`, `$ scp-engine --process`, `Parsing cell coordinate matrices`, `Levenshtein: 0.98`.
- `WebSocket Real-Time Sync`, `Presensi Atomik`.
- `Google Gemini API Semantic Rubric`.
- `Zero-Conflict Engine & 5 Tipe Hari`.

**Dampaknya:** Guru, siswa, wali murid, dan pihak sekolah kesulitan memahami apa fungsi sebenarnya dan apa untungnya bagi kegiatan belajar-mengajar mereka sehari-hari.

### B. Arah Baru (Human-Centric & Multi-Role)
- Menggunakan bahasa operasional sekolah yang santun, lugas, dan mudah dipahami.
- Menjelaskan **manfaat langsung (*value proposition*)** dari fitur aplikasi.
- Membagi fokus ke **6 Role Nyata** yang ada di aplikasi SCP:
  1. **Waka (Kurikulum):** Pengaturan jadwal, kalender sekolah, dan keterisian jam mengajar.
  2. **Kesiswaan:** Verifikasi perizinan siswa, ketertiban absensi, dan pemantauan siswa bermasalah.
  3. **Guru Pengampu:** Jurnal mengajar cepat, presensi praktis, dan kemudahan evaluasi kuis.
  4. **Wali Kelas:** Rekap kehadiran dan pemantauan perkembangan belajar siswa di kelas perwaliannya.
  5. **Siswa:** Akses jadwal pelajaran terkini, pengajuan izin transparan, dan latihan soal online.
  6. **Orang Tua:** Pemantauan kepastian kehadiran anak di kelas secara langsung dan bebas cemas.

---

## 2. Pemetaan Fitur Nyata Aplikasi ke 6 Role Pengguna

Seluruh konten yang dirancang bersumber **100% dari fitur aktual yang telah ada** di kode aplikasi SCP:

| Role Pengguna | Halaman / Fitur Aktual di Aplikasi | Kebutuhan Utama | Manfaat yang Diangkat pada Konten |
| :--- | :--- | :--- | :--- |
| **Waka Kurikulum** | `/kurikulum/jadwal/import`, `/web/academic-calendar`, `/web/schedules` | Menyusun jadwal semester tanpa bentrok ruang & guru | Ekstraksi jadwal otomatis dari file PDF kurikulum tanpa ketik ulang manual. |
| **Guru Pengampu** | `/teacher/journal`, `/teacher/schedule`, `/teacher/quiz` | Mengisi jurnal & presensi tanpa makan waktu jam KBM | Presensi hitungan detik (cukup tandai yang berhalangan) & bantuan koreksi kuis esai. |
| **Kesiswaan** | `/teacher/permissions`, `/web/monitoring`, `/teacher/attendance-recap` | Menertibkan absensi & surat izin siswa | Verifikasi surat izin/dokter secara online dan rekap kehadiran otomatis tanpa tumpukan kertas. |
| **Wali Kelas** | `/teacher/attendance-recap`, `/teacher/permissions` | Memantau keaktifan siswa perwalian | Notifikasi langsung jika ada siswa perwalian tidak hadir di jam mata pelajaran tertentu. |
| **Siswa** | `/student/home`, `/student/schedule`, `/student/permissions`, `/student/quiz` | Kepastian jadwal, tugas saat guru berhalangan, kuis online | Jadwal selalu diperbarui di HP, pengajuan izin transparan, kelas tetap terisi guru inval. |
| **Orang Tua** | `/parent/monitoring`, `/parent/calendar` | Mengetahui keberadaan anak di sekolah | Notifikasi dan pemantauan real-time kehadiran anak per jam pelajaran dari rumah. |

---

## 3. Rancangan Struktur & Salinan Teks (Copywriting) Section 02

### A. Header Section 02
- **Section Tag:** `02 / Solusi Terpadu Sekolah`
- **Headline Utama:**  
  *Satu Sistem yang Memudahkan Seluruh Warga Sekolah.*
- **Sub-headline:**  
  *Mulai dari Waka Kurikulum, Guru, Kesiswaan, Wali Kelas, hingga Siswa dan Orang Tua di rumah—semua terhubung dalam alur kegiatan akademik yang rapi dan transparan.*
- **Indikator 6 Role (Pill Bar):**  
  Tampilan badge ringkas di bawah judul untuk menegaskan cakupan role:  
  `[ Waka Kurikulum ]` &middot; `[ Kesiswaan ]` &middot; `[ Guru Pengampu ]` &middot; `[ Wali Kelas ]` &middot; `[ Siswa ]` &middot; `[ Orang Tua ]`

---

### B. Kartu Bento 1 (Kolom 7 - Kiri Atas)
> **Fokus Role:** Waka Kurikulum & Guru Pengampu  
> **Tema:** Otomatisasi Jadwal Pelajaran & Ruangan

- **Judul Kartu:** **Penyusunan Jadwal Cepat & Bebas Bentrok**
- **Badge Label:** `Waka Kurikulum & Guru` (Warna Emerald lembut)
- **Deskripsi Ringkas:**  
  *Tim kurikulum cukup memasukkan dokumen jadwal dari aplikasi jadwal sekolah. Sistem langsung menata jam mengajar puluhan guru dan ruang kelas/lab secara otomatis tanpa perlu input manual satu per satu.*
- **Penyesuaian Micro-UI:**
  - **Sisi Kiri (Dropzone):**  
    - Judul file contoh: `Jadwal_Pelajaran_Semester_Genap.pdf` dan `Jadwal_Penggunaan_Bengkel_Lab.pdf`.  
    - Teks instruksi: *Tinggal pilih berkas jadwal sekolah dari kurikulum*.
  - **Sisi Kanan (Kotak Proses Alur / Friendly Process Window):**  
    Mengubah perintah kode terminal menjadi log bahasa manusia yang elegan:  
    - Baris 1: `▶ Memulai penataan jadwal sekolah...`  
    - Baris 2: `✓ Membaca 142 jam pelajaran seluruh jenjang kelas`  
    - Baris 3: `✓ Menghubungkan 78 guru pengampu ke mata pelajaran`  
    - Baris 4: `✓ 0 jadwal bentrok! Jadwal resmi siap digunakan guru & siswa`  
    - Baris 5: `Status: Jadwal langsung aktif di akun masing-masing guru`

---

### C. Kartu Bento 2 (Kolom 5 - Kanan Atas)
> **Fokus Role:** Guru Pengampu, Siswa, & Orang Tua  
> **Tema:** Jurnal Mengajar Praktis & Notifikasi Kehadiran

- **Judul Kartu:** **Jurnal Mengajar Praktis & Terpantau Orang Tua**
- **Badge Label:** `Guru, Siswa & Orang Tua`
- **Deskripsi Ringkas:**  
  *Guru dapat mengisi jurnal KBM dan mendata kehadiran siswa dalam hitungan detik. Di saat yang sama, orang tua di rumah dapat memantau kepastian belajar anak secara langsung dan tenang.*
- **Penyesuaian Micro-UI:**
  - Header kartu: Label kelas `XII RPL 1` & status `SEDANG BELAJAR DI KELAS` (ikon kamera/live).
  - Info KBM: *Pemrograman Web & Perangkat Bergerak* &bull; *Sisa waktu: 01:24:10*.
  - Kotak Statistik Presensi Sekali Klik:  
    - `Hadir: 34` (Hijau) &bull; `Izin: 1` (Kuning) &bull; `Alfa: 0` (Merah).
  - Progress Ring (Tengah Bawah):  
    - Angka persentase: `97%`.  
    - Label bawah: `Kehadiran Hari Ini` (sebelumnya `SYNCED`).

---

### D. Kartu Bento 3 (Kolom 5 - Kiri Bawah)
> **Fokus Role:** Guru Pengampu, Siswa, & Wali Kelas  
> **Tema:** Latihan Soal, Bantuan Koreksi, & Evaluasi Belajar

- **Judul Kartu:** **Latihan Soal & Penilaian Berbantuan Cerdas**
- **Badge Label:** `Guru, Siswa & Wali Kelas`
- **Deskripsi Ringkas:**  
  *Guru terbantu dalam mengoreksi latihan soal esai berdasarkan rubrik jawaban yang telah ditentukan. Siswa segera menerima evaluasi nilai yang transparan, dan Wali Kelas mudah memantau ketuntasan belajar perwaliannya.*
- **Penyesuaian Micro-UI:**
  - Tab Switch: `Nilai Rata-rata Siswa` vs `Rubrik Kunci Jawaban`.
  - Header Info Grafik:  
    - Judul: *Jam Belajar Paling Produktif* &bull; Jam: `08:30 WIB`.  
    - Legend: Titik hitam: *Kelas Teori*, Titik hijau: *Bengkel / Lab Praktik*.
  - Sparkline Chart: Menampilkan grafik tren keaktifan jam belajar di sekolah dari jam `07:00` hingga `15:00`.

---

### E. Kartu Bento 4 (Kolom 7 - Kanan Bawah)
> **Fokus Role:** Kesiswaan, Guru Pengganti (Inval), Wali Kelas, & Siswa  
> **Tema:** Penugasan Guru Inval, Verifikasi Izin Siswa, & Kalender Sekolah

- **Judul Kartu:** **Kelas Tetap Produktif & Surat Izin Teratur**
- **Badge Label:** `Kesiswaan, Wali Kelas & Guru Inval`
- **Deskripsi Ringkas:**  
  *Bila guru berhalangan dinas atau sakit, jam belajar langsung dialihkan ke guru pengganti (inval) lengkap dengan materi tugas titipan agar tidak ada jam kosong. Pengajuan izin siswa pun diverifikasi online dengan rapi.*
- **Penyesuaian Micro-UI:**
  - Header strip: `Jadwal Harian: Rabu (10 Jam Pelajaran)`
  - Baris Timeline (Gantt 10 JP):  
    - Kotak J1 & J2: *Belajar Normal*.  
    - Kotak J3: *Guru Berhalangan (Izin Dinas)*.  
    - Kotak J4: *Guru Pengganti (Inval Bersama Tugas)*.  
    - Kotak IST: *Istirahat*.  
    - Kotak J5 - J9: *Belajar Normal*.
  - Kotak Penugasan Pengganti:  
    - Judul: *Pengalihan Otomatis Guru Pengganti (Inval)*  
    - Detail teks: *Guru Utama: Izin Dinas → Guru Pengganti: Drs. Budi (Materi & Lembar Kerja Siswa Siap)*  
    - Badge Status: `Kelas Terisi & Siap` (Hijau).

---

## 4. Tabel Perbandingan Sebelum & Sesudah (Before vs After)

| Komponen | Konten Saat Ini (Teknis IT) | Rekomendasi Konten Baru (Bahasa Manusia & Multi-Role) |
| :--- | :--- | :--- |
| **Header Section** | `02 / Kapabilitas Inti`<br>*Dirancang untuk ketertiban dan akurasi harian sekolah kejuruan.* | `02 / Solusi Terpadu Sekolah`<br>*Satu Sistem yang Memudahkan Seluruh Warga Sekolah.*<br>*(Ditambah pill 6 role: Waka, Kesiswaan, Guru, Wali Kelas, Siswa, Orang Tua)* |
| **Bento 1 Title** | `Ekstraksi Otomatis 2 Berkas PDF Jadwal FET` | `Penyusunan Jadwal Cepat & Bebas Bentrok` |
| **Bento 1 Badge** | `Python Subprocess Engine` | `Untuk: Waka Kurikulum & Guru` |
| **Bento 1 Terminal** | `$ scp-engine --process inputs/`<br>`Parsing cell coordinate matrices`<br>`Levenshtein: 0.98` | `▶ Menyelaraskan berkas jadwal sekolah...`<br>`✓ Membaca 142 JP seluruh tingkatan kelas`<br>`✓ 0 jadwal bentrok terdeteksi` |
| **Bento 2 Title** | `Jurnal KBM & Presensi Atomik` | `Jurnal Mengajar Praktis & Terpantau Orang Tua` |
| **Bento 2 Subtitle**| `WEBSOCKET REAL-TIME SYNC` | `Untuk: Guru, Siswa & Orang Tua` |
| **Bento 2 Metric** | `97% SYNCED` | `97% Kehadiran Hari Ini` |
| **Bento 3 Title** | `Asesmen Esai AI & Analitik KBM` | `Latihan Soal & Penilaian Berbantuan Cerdas` |
| **Bento 3 Subtitle**| `GOOGLE GEMINI API SEMANTIC RUBRIC` | `Untuk: Guru, Siswa & Wali Kelas` |
| **Bento 3 Tabs** | `Nilai Rata-rata` / `Rubrik AI` | `Nilai Siswa` / `Panduan Kunci Jawaban` |
| **Bento 4 Title** | `Kalender Akademik & Tugas Titipan (Inval)` | `Kelas Tetap Produktif & Surat Izin Teratur` |
| **Bento 4 Subtitle**| `ZERO-CONFLICT ENGINE & 5 TIPE HARI` | `Untuk: Kesiswaan, Wali Kelas & Guru Inval` |
| **Bento 4 Action** | `Resolusi Konflik Otomatis` | `Pengalihan Guru Pengganti (Inval)` |
| **Bento 4 Status** | `Auto Resolved` | `Kelas Terisi & Siap` |

---

## 5. Batasan & Keamanan Perubahan

1. **Section Lain Tidak Disentuh:**
   - Section 0 (Sticky Glass Navbar) &rarr; Tetap utuh.
   - Section 1 (Hero & 3D Window Frame) &rarr; Tetap utuh dengan URL `schoolclassprogress.my.id`.
   - Section 2 (Metric Ribbon Strip) &rarr; Tetap utuh.
   - Section 3 (Section 01 / Fondasi Arsitektur & Pipeline 4 Step) &rarr; Tetap utuh.
   - Section 5 (Section 03 / Keandalan & Keamanan Data) &rarr; Tetap utuh.
   - Section 6 (Structured Footer) &rarr; Tetap utuh.
2. **Layout & Desain Konsisten:**
   - Komposisi 12-kolom bento grid (7 + 5 / 5 + 7) tetap dipertahankan.
   - Elemen interaktif mikro (tombol simulasi play, tab switch, hover card, sparkline SVG) tetap berjalan, hanya teks dan keterangannya yang diubah menjadi informatif dan ramah.
3. **Kepatuhan Data Riil:**
   - Tidak ada fitur yang dikarang. Seluruh penugasan inval, verifikasi izin kesiswaan, presensi exception-based, kuis Gemini esai, dan kalender akademik merupakan fitur yang memang ada di dalam aplikasi SCP.

---

> Mohon tinjau rencana konten ini. Jika Anda menyetujui susunan judul, deskripsi, dan contoh teks di atas, saya akan segera melanjutkan ke tahap implementasi pada komponen Landing Page.
