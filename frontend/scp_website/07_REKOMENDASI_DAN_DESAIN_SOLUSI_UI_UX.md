# Dokumen 07: Rekomendasi Solusi & Desain Fitur Baru Front-End

**Fokus Dokumen:** Solusi Konkret, Desain Komponen Baru, dan Spesifikasi UI/UX untuk Mengatasi Kesenjangan Sistem.  
**Klasifikasi Rekomendasi:** (1) Wajib PRD, (2) Kebutuhan Integrasi Backend, (3) Peningkatan UI/UX.  

---

## 1. Klasifikasi Rekomendasi Perbaikan

### 1.1 Kebutuhan Wajib Berdasarkan PRD v4.4 (Mandatory Requirements)
1. **Penyempurnaan Modul Kuis AI Guru (`TeacherQuizWeb.jsx`):**
   - Wajib menambahkan antarmuka untuk 3 metode pembuatan soal (Prompt AI dengan konfigurasi ketat, Ekstraksi Dokumen PDF/TXT, dan Manual).
   - Wajib menyediakan antarmuka tahap preview untuk mengedit teks soal, opsi jawaban, rubrik esai, dan menghapus soal sebelum dipublikasikan.
   - Wajib menyediakan tabel pengumpulan kuis siswa (*submissions review*) dan form override nilai AI dengan catatan koreksi guru.
   - Wajib menyediakan tombol konfirmasi publikasi kuis (`published`) dan tombol rilis hasil akhir (`published_result`).
2. **Koreksi Presensi Exception-Based pada Jurnal (`TeacherJournalWeb.jsx`):**
   - Ubah antarmuka presensi agar hanya mengirimkan array siswa yang Sakit, Izin, atau Alpa.
   - Sambungkan data `meta.approved_leaves` dari backend agar otomatis mem-prefill status siswa yang memiliki surat izin resmi.
3. **Pemberlakuan Password Re-confirmation pada Seluruh Aksi Sensitif Waka:**
   - Sambungkan parameter `password` pada payload konfirmasi penggantian putaran jadwal, status upacara, mutasi jadwal manual, dan commit import PDF.
4. **Proteksi Konfirmasi Import Kosong:**
   - Kunci (*disable*) tombol commit import jika jumlah baris berstatus matched bernilai 0 (`matched_count === 0`).

---

### 1.2 Kebutuhan Integrasi Backend (Backend Integration Requirements)
1. **Penyesuaian Parameter Hari Jadwal:**
   - Konversikan nilai nama hari di Front-End (`'Senin'` s.d. `'Jumat'`) menjadi integer ISO (`1` s.d. `5`) saat memanggil API schedules.
2. **Standardisasi Status Presensi:**
   - Selaraskan nilai enum status kehadiran menjadi: `'Hadir'`, `'Sakit'`, `'Izin'`, `'Alpa'`.
3. **Penyelarasan Role & Penugasan Pengguna:**
   - Hapus `ROLES.KESISWAAN` sebagai top-level role terisolasi. Gunakan `user.role === 'teacher'` dan validasi array `user.assignments` untuk memunculkan hak akses Kesiswaan.
4. **Passing Parameter ID Batch pada Import Jadwal:**
   - Gunakan URL rute dinamis `/web/review-import/:id` agar halaman review dapat langsung memuat data batch import dari backend tanpa mengandalkan mock state.

---

### 1.3 Saran Peningkatan UI/UX (UI/UX Polish & Modern Improvements)
1. **Penerapan Skeleton Loading:**
   - Gantikan spinner sederhana dengan animasi kerangka data (*skeleton placeholder*) pada tabel jadwal, master data, dan kuis agar persepsi kecepatan aplikasi meningkat.
2. **Debounce pada Search Input:**
   - Tambahkan fungsi penundaan (*debounce* 300–400ms) pada komponen `SearchInput.jsx` untuk mencegah request pencarian berulang ke server saat pengguna mengetik.
3. **Modal Kredensial Pengguna Baru (Initial Password Modal):**
   - Sediakan modal popup yang menampilkan username dan password acak yang baru di-generate dengan tombol *Salin Kredensial* satu klik.
4. **Halaman Akses Ditolak (403 Forbidden State):**
   - Buat halaman khusus yang ramah ketika pengguna mencoba mengakses rute di luar wewenangnya dengan opsi kembali ke halaman beranda perannya.

---

## 2. Desain Komponen & Modal Baru yang Diperlukan

### 2.1 Modal Konfigurasi Kuis AI via Prompt (Metode 1)
Komponen modal ini dipanggil saat guru memilih opsi *"Generate Soal via Prompt AI"*:

```
┌────────────────────────────────────────────────────────────────────────┐
│ MODAL: Buat Soal Kuis dengan AI Prompt                                 │
├────────────────────────────────────────────────────────────────────────┤
│ Judul Kuis: Kuis Persamaan Kuadrat (Kelas X RPL 1)                     │
│                                                                        │
│ 1. Instruksi / Prompt Materi (Wajib):                                  │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Buatkan soal matematika materi persamaan kuadrat, diskriminan,    │ │
│ │ dan sifat akar-akar kuadrat dengan studi kasus terapan...          │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ 2. Konfigurasi Jumlah & Komposisi Soal:                                │
│    Total Butir Soal: [ 10 ] butir (min 1, maks 50)                     │
│                                                                        │
│    Tipe Soal:                                                          │
│    ( ) Pilihan Ganda Penuh   ( ) Esai Penuh   (●) Kombinasi PG & Esai   │
│                                                                        │
│    Komposisi Kombinasi:                                                │
│    - Soal Pilihan Ganda : [ 7 ] butir                                  │
│    - Soal Esai          : [ 3 ] butir                                  │
│    *(Validasi: 7 + 3 = 10 ✓ Komposisi Valid)*                          │
│                                                                        │
│ 3. Tingkat Kesulitan:                                                  │
│    [ Sedang (Menengah)                 ▼ ]                             │
│                                                                        │
│ 4. Catatan Tambahan Guru (Opsional):                                   │
│    [ Sertakan rumus diskriminan pada kunci jawaban esai...           ] │
├────────────────────────────────────────────────────────────────────────┤
│ [Batal]                                   [⚡ Generate Soal via AI (202)]│
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Modal Ekstraksi Kuis dari Dokumen PDF/TXT (Metode 2)
Komponen modal untuk mengunggah dokumen soal yang sudah ada agar dipetakan oleh AI:

```
┌────────────────────────────────────────────────────────────────────────┐
│ MODAL: Ekstraksi Soal Kuis dari Dokumen Materi                         │
├────────────────────────────────────────────────────────────────────────┤
│ Unggah berkas soal latihan atau bank soal untuk diimpor otomatis oleh  │
│ sistem evaluasi AI (didukung PDF dan TXT, maksimal 5MB).              │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │                     📄 Tarik & Lepas Berkas ke Sini                │ │
│ │                  atau [Pilih Berkas Dokumen (PDF / TXT)]           │ │
│ │                                                                    │ │
│ │   Berkas Terpilih: Modul_Latihan_Bab3_Aljabar.pdf (1.8 MB)         │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ℹ️ Catatan Sistem:                                                     │
│ - AI akan mengekstrak struktur asli soal, pilihan opsi, dan kunci.    │
│ - Soal yang buram atau ambigu akan otomatis ditandai `Needs Review`    │
│   agar dapat Anda periksa kembali sebelum kuis dipublikasikan.         │
├────────────────────────────────────────────────────────────────────────┤
│ [Batal]                                       [🚀 Mulai Ekstraksi Dokumen]│
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Antarmuka Tahap Preview Soal Kuis (`draft_review`)
Pada tahap preview kuis, guru dapat melihat, mengoreksi, dan menghapus butir soal:

```
┌────────────────────────────────────────────────────────────────────────┐
│ DETAIL KUIS (DRAFT REVIEW): Dasar Pemrograman Web                      │
├────────────────────────────────────────────────────────────────────────┤
│ Status: [Draft Review]  •  Kelas: X RPL 2  •  Total Soal: 8 Butir      │
│ [ + Tambah Soal Manual ]   [ ⚡ Re-generate AI ]   [ 📢 Publikasikan Kuis ] │
├────────────────────────────────────────────────────────────────────────┤
│ 1. [PG] Apa kepanjangan dari singkatan HTML?                           │
│    A. Hyper Text Markup Language (Kunci ✓)                             │
│    B. High Tech Modern Language                                        │
│    C. Hyperlinks and Text Management                                   │
│    D. Home Tool Multi Language                                         │
│    [✏️ Edit Soal]  [🗑️ Hapus]                                         │
├────────────────────────────────────────────────────────────────────────┤
│ 2. [ESAI] Jelaskan perbedaan metode HTTP GET dan POST!                 │
│    ⚠️ Flag Ambigu: Nomor soal asli buram pada dokumen (Periksa Opsi)   │
│    Rubrik Kata Kunci: GET parameter URL, POST request body tertutup.   │
│    [✏️ Koreksi Soal]  [🗑️ Hapus]                                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2.4 Modal Review Submissions & Override Nilai Guru
Layar pengelolaan nilai saat siswa telah mengerjakan kuis:

```
┌────────────────────────────────────────────────────────────────────────┐
│ DAFTAR PENGUMPULAN SISWA: Kuis Algoritma & Struktur Data               │
├────────────────────────────────────────────────────────────────────────┤
│ Filter Status: [ Semua Status ▼ ]            [ 📢 Rilis Nilai ke Siswa ]│
├────┬──────────────────┬─────────┬───────────┬─────────┬────────────────┤
│ No │ Nama Siswa       │ Percob. │ Status AI │ Skor AI │ Aksi           │
├────┼──────────────────┼─────────┼───────────┼─────────┼────────────────┤
│ 01 │ Aisyah Putri R.  │ Ke-1    │ Graded    │ 85.00   │ [ Koreksi Nilai ]│
│ 02 │ Bagas Prasetyo   │ Ke-2    │ Graded    │ 92.50   │ [ Koreksi Nilai ]│
│ 03 │ Cantika Dewi     │ Ke-1    │ Pending ⏳│ -       │ [ Tunggu AI... ]│
└────┴──────────────────┴─────────┴───────────┴─────────┴────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ MODAL: Koreksi Nilai Siswa (Override Nilai AI)                         │
├────────────────────────────────────────────────────────────────────────┤
│ Siswa: Aisyah Putri Ramadhani (NIS: 2024001) - Percobaan ke-1         │
│                                                                        │
│ Soal Esai: "Jelaskan fungsi closure pada bahasa Dart!"                 │
│ Jawaban Siswa: "Closure adalah fungsi yang dapat mengakses variabel di │
│ luar lingkup leksikalnya meskipun fungsi luar telah selesai dieksekusi"│
│                                                                        │
│ Skor Awal AI : [ 85 ] / 100                                            │
│ Umpan Balik AI: "Jawaban tepat secara konseptual, contoh kode nihil."  │
│                                                                        │
│ Nilai Baru Guru (Override) : [ 90 ] / 100                              │
│ Catatan Umpan Balik Guru   :                                           │
│ [ Jawaban konsep sangat jelas dan tepat. Nilai dinaikkan 5 poin.     ] │
├────────────────────────────────────────────────────────────────────────┤
│ [Batal]                                        [ Simpan Perubahan Nilai ]│
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2.5 Modal Kredensial Akun Baru (Initial Password Modal)
Ditampilkan kepada Waka Kurikulum segera setelah akun guru atau siswa berhasil dibuat:

```
┌────────────────────────────────────────────────────────────────────────┐
│ MODAL: Akun Berhasil Dibuat! 🎉                                        │
├────────────────────────────────────────────────────────────────────────┤
│ Akun pengguna baru telah berhasil didaftarkan ke sistem SCP.           │
│ Simpan dan serahkan kredensial sementara ini kepada yang bersangkutan. │
│                                                                        │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ Peran Akun    : Guru Mata Pelajaran                                │ │
│ │ Nama Lengkap  : Bambang Supriyadi, S.Pd.                           │ │
│ │ Username / NIP: 198005122008011003                                 │ │
│ │ Kata Sandi    : k8X#m9L2                                           │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ⚠️ PENTING: Kata sandi ini hanya ditampilkan sekali. Pengguna wajib    │
│ memperbarui kata sandi saat pertama kali login ke sistem.              │
├────────────────────────────────────────────────────────────────────────┤
│ [Tutup]                                        [📋 Salin Kredensial]   │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2.6 Modal Edit Pengajuan Izin Siswa Pending
Siswa dapat mengoreksi izin selama belum disetujui/ditolak oleh Kesiswaan:

```
┌────────────────────────────────────────────────────────────────────────┐
│ MODAL: Perbarui Pengajuan Perizinan                                    │
├────────────────────────────────────────────────────────────────────────┤
│ Status Permohonan: [ Menunggu Persetujuan ]                            │
│                                                                        │
│ Jenis Izin : (●) Tidak Masuk Sekolah    ( ) Keluar Sekolah (Same-Day)  │
│ Kategori   : (●) Sakit                  ( ) Keperluan Keluarga / Lain  │
│                                                                        │
│ Tanggal Mulai   : [ 2026-10-24 ]                                       │
│ Tanggal Selesai : [ 2026-10-26 ]                                       │
│                                                                        │
│ Surat Dokter / Dokumen: [ surat_dokter_revisi.pdf ] (Ganti Berkas)     │
├────────────────────────────────────────────────────────────────────────┤
│ [Batal]                                          [ Simpan Perubahan ]  │
└────────────────────────────────────────────────────────────────────────┘
```
