# Dokumen 02: Analisis Mendalam Prototype UI/UX

**Sumber Analisis:** `frontend/_Prototype/akademik-prototype`  
**Fokus Evaluasi:** Antarmuka Web Desktop & Tablet, Alur Interaksi, Konsistensi Desain, dan Komponen UI  

---

## 1. Ikhtisar Struktur Prototype

Prototype `akademik-prototype` dibangun menggunakan **React 19**, **Vite**, **Tailwind CSS v4**, **React Router v7**, dan pustaka ikon **Lucide React**. Prototype ini telah menyediakan visualisasi awal tata letak antarmuka web yang terorganisir ke dalam arsitektur komponen bersama (*shared components*) dan halaman spesifik per peran pengguna.

### 1.1 Struktur Direktori Utama Prototype
```
frontend/_Prototype/akademik-prototype/src/
├── components/
│   ├── shared/         # 14 Komponen UI atomik & molekuler (Button, Modal, Table, Badge, dsb.)
│   ├── web/            # Komponen tata letak web (Sidebar, TopBar, WebLayout)
│   └── mobile/         # Komponen eksperimen mobile (Header, Nav, Layout)
├── context/
│   └── AuthContext.jsx # Penyedia konteks simulasi autentikasi & role switcher
├── data/
│   └── dummyData.js    # Data statis (mock dataset jadwal, kelas, guru, kuis, siswa)
├── pages/web/
│   ├── Login.jsx                 # Halaman login terpadu + role selector demo
│   ├── Dashboard.jsx             # Beranda Waka (Putaran, Upacara, Log Siklus, Alert Jurnal)
│   ├── ScheduleManagement.jsx    # Matriks jadwal mingguan Waka + validasi bentrok
│   ├── UploadImport.jsx          # Unggah 2 berkas PDF FET + progress visual
│   ├── ReviewImport.jsx          # Tinjauan status matched/unmatched/conflict + resolusi
│   ├── MasterData.jsx            # Tabular CRUD Master Kelas, Ruang, Mapel, Guru, Siswa
│   ├── GradePromotion.jsx        # Pemetaan next_class_id, penandaan tinggal kelas, promosi
│   ├── MonitoringRecap.jsx       # Rekap presensi, jurnal KBM, dan delegasi guru piket
│   ├── teacher/                  # Halaman peran Guru (Jadwal, Jurnal, Kuis AI, Verifikasi Izin)
│   ├── student/                  # Halaman peran Siswa (Beranda, Pengajuan Izin, Kuis)
│   ├── parent/                   # Halaman peran Orang Tua (Monitoring Anak)
│   └── profile/                  # Halaman profil bersama (Email OTP, WA OTP, Google, Password)
└── styles/
    ├── tokens.css      # Variabel warna & tipografi bertema Exness-inspired
    └── global.css      # Reset CSS & styling global
```

---

## 2. Analisis Layout, Navigasi, dan Struktur Halaman

### 2.1 Pola Tata Letak (Web Layout)
- **Struktur Shell:** Menggunakan pola klasik modern `WebLayout` yang terdiri atas:
  - **Sidebar Tetap (Left Rail):** Lebar ~260px pada desktop, dapat dilipat (*collapsible/drawer*) pada resolusi tablet/mobile (< 1024px).
  - **TopBar Atas (Header):** Menampilkan breadcrumb/judul konteks aktif, badge status peran saat ini, saklar putaran/upacara cepat, notifikasi, dan avatar profil pengguna.
  - **Main Content Area:** Kontainer fleksibel dengan batas maksimum `max-w-6xl` atau `max-w-7xl` yang memiliki padding responsif (`px-4 sm:px-6 md:px-8 py-6`).
- **Gaya Desain (Visual Aesthetic):** Mengadopsi prinsip desain institusional yang bersih (*clean, minimalist, utility-focused*) terinspirasi dari antarmuka modern (Exness / Linear style):
  - Palet warna netral didominasi abu-abu Slate/Gray (`gray-50`, `gray-100`, `gray-900`) dengan aksen emerald untuk sukses, amber untuk peringatan, rose/red untuk bahaya, dan biru/indigo untuk elemen interaktif utama.
  - Penggunaan angka numerik dan kode identitas (NIS, NIP, FET ID, Kode Ruang) dengan font mono (*tabular monospace*).
  - Border tipis (`border-gray-200/80`) dengan bayangan halus (*subtle elevation* `shadow-xs` / `shadow-2xs`).

### 2.2 Navigasi & Role Switching
- Prototype menyematkan **Quick Role Switcher** baik pada footer sidebar maupun dropdown TopBar. Fitur ini sangat efektif untuk mendemokan transisi antar 5 peran: Waka, Kesiswaan, Guru, Siswa, dan Orang Tua.
- **Kelemahan Navigasi:**
  1. *Peran Kesiswaan Dipisah Sebagai Top-Level Role:* Pada prototype, 'Kesiswaan' dibuat sebagai peran setara dengan 'Guru' atau 'Waka'. Padahal dalam PRD dan Backend, Kesiswaan adalah Guru yang memegang penugasan tambahan (`teacher_assignments.type = 'kesiswaan'`). Hal ini menimbulkan kebingungan antarmuka ketika seorang guru memiliki peran ganda (mengajar mapel sekaligus bertugas piket kesiswaan).
  2. *Menu Hardcoded:* Menu navigasi di `Sidebar.jsx` masih dikelompokkan dengan switch-case statis, belum mencerminkan data dinamis yang dikembalikan oleh endpoint `GET /api/me` (misalnya relasi `assignments`).

---

## 3. Analisis Komponen UI (`src/components/shared`)

Tabel evaluasi komponen bersama yang telah disediakan pada prototype:

| Nama Komponen | Fungsi & Deskripsi | Kelebihan Desain | Kekurangan / Hal yang Perlu Diperbaiki |
|---|---|---|---|
| `Button.jsx` | Tombol interaktif dengan varian (`primary`, `secondary`, `danger`, `ghost`) dan ukuran (`sm`, `md`, `lg`). | Mendukung slot icon Lucide kiri/kanan, transisi halus, state loading terintegrasi. | Belum memiliki varian khusus untuk tombol link atau status disabled yang jelas saat form belum valid. |
| `Input.jsx` | Bidang input teks, email, number, dan password. | Label rapi, teks bantuan (*hint*), styling border fokus kontras, dan pesan error inline. | Belum ada fitur tombol *toggle visibility* mata (show/hide password) pada input kata sandi. |
| `Select.jsx` | Dropdown pemilihan opsi kustom. | Desain bersih, opsi disabled, label jelas, konsisten dengan token input. | Menggunakan elemen `<select>` native browser, sehingga pada opsi yang panjang atau kompleks kurang fleksibel dibanding custom dropdown. |
| `Table.jsx` | Tabel data responsif dengan paginasi lokal. | Mendukung custom `renderCell`, perataan kolom (align left/center/right), empty state, dan navigasi halaman. | Paginasi masih bersifat lokal (client-side slicing); belum siap menerima struktur pagination metadata backend (`current_page`, `last_page`, `total`). |
| `Modal.jsx` | Dialog popup terpusat dengan backdrop overlay. | Ukuran fleksibel (`sm`, `md`, `lg`, `xl`), tombol close, footer kustom, animasi transisi lembut. | Belum ada trap focus (aksesibilitas keyboard) dan belum mencegah scroll latar belakang saat modal terbuka pada beberapa browser. |
| `PasswordModal.jsx` | Modal khusus untuk verifikasi ulang kata sandi (Step-Up Auth). | Sangat sesuai dengan kebutuhan PRD v4.4; memisahkan aksi sensitif dengan proteksi password. | Input password belum mendukung penanganan error spesifik dari backend (misal jika backend mengembalikan 422 password salah). |
| `Badge.jsx` | Penanda status berwarna (success, warning, error, neutral, default). | Varian warna lengkap, ukuran pas untuk sel tabel, kontras teks dan latar belakang terbaca dengan baik. | Belum ada varian dot indikator animasi (misal untuk status *parsing* atau *generating*). |
| `Tabs.jsx` | Komponen navigasi tab berbasis pill atau underline. | Mendukung badge penghitung data (*counter pill*), transisi tab aktif instan. | Desain scroll horizontal pada layar kecil belum dioptimalkan (dapat terpotong jika tab terlalu banyak). |
| `FileUpload.jsx` | Area drag-and-drop unggah berkas (PDF/Gambar). | Mendukung drag-and-drop, validasi tipe ekstensi visual, progress unggah, dan preview nama berkas. | Belum menampilkan estimasi ukuran berkas dan belum ada tombol hapus berkas terpilih secara langsung. |
| `ProgressBar.jsx` | Indikator progres linier bernilai persentase. | Animasi halus, label persentase opsional, pewarnaan kontekstual. | Bersifat statis murni; belum terhubung dengan mekanisme polling status asinkron backend. |
| `SearchInput.jsx` | Input pencarian dengan ikon kaca pembesar dan tombol reset silang (x). | Ergonomis, tombol clear instan, padding proporsional. | Belum memiliki fitur *debounce* bawaan untuk mencegah request berulang ke server saat mengetik cepat. |
| `EmptyState.jsx` | Ilustrasi dan pesan ketika dataset kosong. | Komposisi ikon, judul, deskripsi, dan tombol Call-to-Action (CTA) sangat baik. | Belum dibedakan antara kondisi "Data Benar-benar Belum Ada" dengan "Hasil Pencarian/Filter Tidak Ditemukan". |
| `ErrorState.jsx` | Tampilan kesalahan server atau koneksi terputus. | Pesan kesalahan manusiawi, tombol Coba Lagi (*Retry*). | Masih jarang digunakan pada halaman prototype (kebanyakan halaman belum menerapkan blok error). |
| `LoadingState.jsx` | Indikator loading spinner / teks memuat data. | Sederhana, terpusat. | Masih menggunakan spinner biasa; belum menyediakan *Skeleton Loading Table/Card* yang membuat transisi antarmuka terasa lebih mulus. |

---

## 4. Analisis Halaman per Halaman Prototype

### 4.1 Halaman Waka Kurikulum

#### A. Login (`pages/web/Login.jsx`)
- **Kelebihan:** Menyediakan card seleksi role cepat untuk demo, pendeteksi nama perangkat otomatis (`deviceName`), dan simulasi alur `must_change_password`.
- **Kekurangan:**
  - Belum ada integrasi riil dengan library Google Sign-In SDK untuk memicu `POST /api/auth/google`.
  - Belum ada penanganan form field-level validation error jika kredensial ditolak oleh backend (HTTP 401).

#### B. Dashboard Waka (`pages/web/Dashboard.jsx`)
- **Kelebihan:** 
  - Visualisasi ringkas saklar Putaran Aktif (Putaran 1 / Putaran 2) dan Status Upacara Hari Senin yang dilindungi oleh `PasswordModal`.
  - Tabel riwayat siklus (`Cycle History`) dan tabel peringatan keterlambatan jurnal (`Missing Journal Alert`).
- **Kekurangan:**
  - Tombol aksi pada missing journal hanya bersifat teks statis, belum ada tombol cepat untuk menghubungi guru atau menugaskan Guru Piket Kesiswaan.
  - Kartu metrik ringkasan (Total Kelas, Total Guru, Total Siswa, Persentase Kepatuhan Jurnal) belum ditampilkan di bagian atas dashboard.

#### C. Pengelolaan Jadwal (`pages/web/ScheduleManagement.jsx`)
- **Kelebihan:**
  - Tampilan matriks jadwal mingguan (Senin–Jumat) yang sangat informatif, menampilkan jam pelajaran, nama guru, ruang, dan rombel kelas.
  - Deteksi bentrok lokal (*conflict detection*) pada jadwal yang bertabrakan di slot yang sama.
  - Aksi tambah, edit, dan hapus jadwal dilindungi `PasswordModal`.
- **Kekurangan:**
  - Filter hari menggunakan string literal bahasa Indonesia (`'Senin'`, `'Selasa'`), sedangkan backend menggunakan angka integer ISO (`1` s.d. `5`).
  - Belum ada banner peringatan prasyarat Master Data (jika ada master data yang kosong sebelum membuat jadwal).
  - Tampilan jam masih menampilkan slot statis, belum mencerminkan jam riil hasil resolusi `PeriodResolutionService` yang bergeser saat upacara aktif/nonaktif.

#### D. Upload & Review Import Jadwal PDF (`UploadImport.jsx` & `ReviewImport.jsx`)
- **Kelebihan:**
  - Alur 2 langkah terpisah (Upload -> Review) sangat jelas.
  - Kartu statistik hasil ekstraksi: Matched (hijau), Unmatched (merah), Conflict (kuning).
  - Modal resolusi manual per baris untuk memetakan nama kelas, guru, ruang, dan mapel.
  - Opsi *Exclude / Abaikan* baris duplikat/tidak valid.
  - Konfirmasi commit dilindungi kata sandi akun Waka.
- **Kekurangan:**
  - Transisi dari Upload ke Review pada prototype mengandalkan state lokal tiruan (*mock timeout*), belum menerima parameter `import_id` dinamis dari backend.
  - Tidak ada polling status asinkron (`status: 'uploaded' -> 'parsing' -> 'preview_ready'`).
  - Belum ada validasi pencegahan konfirmasi jika `matched_count === 0` (aturan wajib PRD 5.16 & 5.17).

#### E. Master Data Akademik (`MasterData.jsx`)
- **Kelebihan:**
  - 5 Tab terpadu: Kelas, Ruang, Mapel, Guru, Siswa dengan indikator jumlah data (*counter*).
  - Modal Tambah, Edit, dan Hapus lengkap.
  - Modal khusus untuk mengelola penugasan tambahan guru (*Teacher Assignments*).
  - Pengecekan integritas dependensi sebelum menghapus (mencegah hapus jika entitas terikat jadwal).
- **Kekurangan:**
  - Pada pembuatan akun guru atau siswa, backend mengembalikan password acak yang di-generate sistem (`data.password`). Prototype belum memiliki **Modal Tampilan Kata Sandi Awal** untuk disalin Waka dan diberikan kepada pengguna bersangkutan.
  - Form input guru di prototype belum menyediakan input atribut `fet_staff_id` (nomor identitas staf FET yang krusial untuk import jadwal).

#### F. Kenaikan Kelas & Kelulusan (`GradePromotion.jsx`)
- **Kelebihan:**
  - Alur visual jelas: Pemetaan kelas tujuan (`next_class_id`), penandaan siswa tinggal kelas (*hold-back*), dan tombol eksekusi massal.
  - Tabel siswa yang akan naik/lulus/tinggal kelas dapat difilter secara dinamis.
- **Kekurangan:**
  - Belum ada rekapitulasi audit log setelah promosi dijalankan (berapa yang berhasil naik, tinggal kelas, dan lulus).

#### G. Monitoring & Rekapitulasi (`MonitoringRecap.jsx`)
- **Kelebihan:**
  - 2 Tab utama: Rekap Presensi Siswa dan Rekap Jurnal Mengajar Guru.
  - Modal penugasan / delegasi guru piket kesiswaan untuk mengambil alih kelas guru yang izin.
  - Modal preview foto dokumentasi KBM.
- **Kekurangan:**
  - Filter belum sepenuhnya mencerminkan query parameter backend (`date`, `class_id`, `status: Hadir|Sakit|Izin|Alpa`).
  - Belum ada tombol ekspor data (misal cetak laporan presensi / PDF / Excel).

---

### 4.2 Halaman Guru (`pages/web/teacher/`)

#### A. Kalender Jadwal Guru (`TeacherScheduleWeb.jsx`)
- **Kelebihan:** Tampilan kalender harian & mingguan yang rapi, indikator status jurnal (Sudah Diisi vs Belum Diisi), serta modal pengajuan izin berhalangan hadir mengajar.
- **Kekurangan:** Seluruh aksi edit jadwal telah dihilangkan sesuai PRD (read-only), namun belum menampilkan jam riil hasil resolusi jam dinamis.

#### B. Jurnal KBM & Presensi Kelas (`TeacherJournalWeb.jsx`)
- **Kelebihan:**
  - Alur pembukaan kelas berjalan (*ongoing*), pengisian topik materi, presensi siswa berbasis toggle status, dan unggah foto dokumentasi.
  - Mendukung *Mode Piket Kesiswaan* untuk mengambil alih kelas guru yang berhalangan hadir.
- **Kekurangan:**
  - Payload presensi pada prototype masih mengirim seluruh data siswa, belum disesuaikan dengan format **Exception-Based** backend (hanya mengirim array siswa Sakit/Izin/Alpa).
  - Belum mengonsumsi data `meta.approved_leaves` dari backend untuk otomatis mem-prefill siswa yang sudah disetujui izinnya.

#### C. Manajemen Kuis AI (`TeacherQuizWeb.jsx`)
- **Kelebihan:** Tabel daftar kuis, filter tab (Semua, Dipublikasi, Draft), dan modal pratinjau detail soal.
- **Kekurangan Sangat Kritis (Kesenjangan Utama):**
  - Hanya ada form input judul, kelas, batas waktu, dan percobaan.
  - **Sama sekali belum ada antarmuka untuk 3 metode pembuatan soal**:
    1. Modal Konfigurasi Prompt AI (input prompt, jumlah total, pilihan ganda, esai).
    2. Modal Unggah Dokumen Materi (PDF/TXT via parser AI).
    3. Form Input Butir Soal Manual.
  - Belum ada kemampuan mengedit atau menghapus butir soal pada tahap review kuis.
  - Belum ada layar / tabel untuk melihat jawaban siswa (*submissions*) dan melakukan override nilai/feedback AI.
  - Belum ada tombol rilis hasil penilaian kuis ke siswa (`published_result`).

#### D. Verifikasi Perizinan Siswa (`PermissionVerifyWeb.jsx`)
- **Kelebihan:** Filter tab status (Menunggu, Disetujui, Ditolak), pembeda izin tidak masuk (rentang tanggal) vs keluar sekolah (jam keluar/kembali), dan modal pratinjau surat bukti.
- **Kekurangan:** Aksi verifikasi hanya dapat dilakukan oleh Kesiswaan/Waka, tetapi halaman ini diletakkan di menu guru umum tanpa proteksi penugasan di antarmuka.

---

### 4.3 Halaman Siswa & Orang Tua (`pages/web/student/` & `parent/`)

#### A. Beranda Siswa (`StudentHomeWeb.jsx`)
- **Kelebihan:** Card ucapan selamat datang personal, 4 kartu ringkasan kehadiran (Hadir, Sakit, Izin, Alpa), jadwal pelajaran hari ini, dan daftar kuis aktif.
- **Kekurangan:** Belum ada tombol pintas untuk langsung membuka riwayat detail presensi bulanan.

#### B. Pengajuan Perizinan Siswa (`StudentPermissionWeb.jsx`)
- **Kelebihan:** Form dinamis sesuai 2 tipe (tidak masuk vs keluar sekolah) x 2 kategori (sakit vs lainnya), upload bukti surat, dan tabel riwayat pengajuan.
- **Kekurangan:** Belum ada modal untuk mengedit pengajuan izin yang masih berstatus `pending` (hanya ada tombol hapus/batal).

#### C. Pengerjaan Kuis Siswa (`StudentQuizWeb.jsx`)
- **Kelebihan:** Antarmuka pengerjaan soal interaktif bernomor, navigasi butir soal, dan kartu skor akhir.
- **Kekurangan:** 
  - Penilaian dilakukan langsung di sisi client secara acak, belum terhubung ke sistem antrean asinkron backend (`POST /submissions` mengembalikan 202).
  - Belum mendukung soal bertipe esai.
  - Nilai langsung ditampilkan seketika, melanggar aturan PRD bahwa nilai baru boleh dilihat setelah kuis berstatus `published_result`.

#### D. Monitoring Orang Tua (`ParentMonitoringWeb.jsx`)
- **Kelebihan:** 3 Tab terstruktur: Rekapitulasi Kehadiran, Riwayat Izin, dan Capaian Nilai Kuis Anak.
- **Kekurangan:** Belum ada pemilih anak (*child selector*) jika orang tua memiliki lebih dari satu anak di sekolah yang sama.

---

### 4.4 Halaman Profil & Pengaturan Akun (`ProfileWeb.jsx`)
- **Kelebihan:**
  - Card identitas akun yang elegan.
  - Form verifikasi mandiri Email (kirim OTP & verifikasi).
  - Form verifikasi WhatsApp (kirim OTP & verifikasi).
  - Tombol penautan akun Google SSO.
  - Form ganti kata sandi.
- **Kekurangan:**
  - Form ganti kata sandi belum memiliki padanan endpoint di backend (perlu konfirmasi teknis).
  - Indikator kontak terverifikasi (badge hijau) belum terhubung ke atribut model `User` (`email_verified_at`, `phone_number`, `google_id`).

---

## 5. Ringkasan Evaluasi UI/UX

```
┌────────────────────────────────────────────────────────────────────────┐
│                      RINGKASAN SKOR EVALUASI PROTOTYPE                 │
├────────────────────────────────┬─────────┬─────────────────────────────┤
│ Aspek Evaluasi                 │ Skor    │ Catatan Kunci               │
├────────────────────────────────┼─────────┼─────────────────────────────┤
│ 1. Estetika & Konsistensi UI   │ 9.0/10  │ Sangat rapi, modern, token  │
│                                │         │ warna serasi, font mono pas │
├────────────────────────────────┼─────────┼─────────────────────────────┤
│ 2. Kelengkapan Komponen Shared │ 8.5/10  │ 14 komponen dasar tersedia, │
│                                │         │ siap dikembangkan           │
├────────────────────────────────┼─────────┼─────────────────────────────┤
│ 3. Kesesuaian Alur Waka        │ 8.5/10  │ Putaran, PDF import, dan    │
│                                │         │ jadwal sudah sangat matang  │
├────────────────────────────────┼─────────┼─────────────────────────────┤
│ 4. Kesesuaian Alur Kuis AI     │ 4.0/10  │ GAP BESAR: Belum ada 3 mode │
│                                │         │ generate, preview, override │
├────────────────────────────────┼─────────┼─────────────────────────────┤
│ 5. Kesesuaian Presensi & Jurnal│ 7.0/10  │ Alur visual baik, payload   │
│                                │         │ belum exception-based       │
├────────────────────────────────┼─────────┼─────────────────────────────┤
│ 6. Penanganan State Sistem     │ 5.0/10  │ Belum ada skeleton, error   │
│                                │         │ boundary, 403 screen        │
└────────────────────────────────┴─────────┴─────────────────────────────┘
```
