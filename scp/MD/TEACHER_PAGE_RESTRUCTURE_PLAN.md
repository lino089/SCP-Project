# Rencana Implementasi: Pembaruan & Pemisahan Menu Halaman Role Guru

## 1. Latar Belakang & Tujuan
Saat ini, navigasi untuk role **Guru** menggabungkan fungsi Dashboard, Jadwal Mengajar, dan Perizinan Guru ke dalam satu halaman tunggal (`TeacherSchedulePage.jsx`). Pada halaman tersebut, fitur perizinan guru (pengajuan izin tidak mengajar dan riwayat izin) masih disajikan dalam bentuk tombol pop-up modal di bagian header kalender jadwal, sedangkan guru belum memiliki halaman Dashboard mandiri yang merangkum kegiatan mengajar hari ini.

Tujuan dari pembaruan ini adalah:
1. **Pemisahan Menu Mandiri:** Memisahkan menu **Dashboard**, **Jadwal Mengajar**, dan **Izin Mengajar** menjadi 3 menu/halaman terpisah di sidebar navigasi dengan struktur yang tertata jelas.
2. **Dashboard Guru Khusus Hari Ini:** Membangun halaman Dashboard Guru yang menampilkan jadwal mengajar **khusus hari ini saja**, mengadopsi konsep dan kejelasan visual Dashboard Siswa (`StudentHomePage.jsx`) dengan data riil dari backend.
3. **Penyempurnaan Jadwal Mengajar:** Membersihkan halaman Jadwal Mengajar dari modal pop-up perizinan agar berfokus penuh pada eksplorasi matriks timetable mingguan.
4. **Halaman Izin Mengajar Mandiri:** Menyediakan halaman khusus perizinan guru (`TeacherLeavePage`) untuk mengajukan izin, mengunggah surat keterangan & tugas titipan, serta memantau status persetujuan dari Kesiswaan/Waka.

---

## 2. Analisis Struktur Saat Ini vs Target Struktur Baru

### A. Kondisi Navigasi Saat Ini (Sidebar Guru)
- `Jadwal Mengajar` (`/teacher/schedule`) &larr; *Overcrowded: menampung jadwal mingguan, modal pengajuan izin, dan modal riwayat izin*
- `Jurnal KBM & Presensi` (`/teacher/journal`)
- `Manajemen Kuis AI` (`/teacher/quiz`)
- `Verifikasi Perizinan` (`/teacher/permissions`) *(khusus Kesiswaan / Wali Kelas)*
- `Monitoring Kesiswaan` (`/web/monitoring`) *(khusus Kesiswaan)*

### B. Target Struktur Navigasi Baru (Sidebar Guru)
```text
MENU GURU (& KESISWAAN / WALI KELAS)
├── 📊 Dashboard              -> /teacher/dashboard  (BARU: Jadwal hari ini, metrik harian, quick actions)
├── 📅 Jadwal Mengajar        -> /teacher/schedule   (Matriks jadwal mingguan Putaran 1 & 2, bebas modal pop-up)
├── 📝 Izin Mengajar Saya     -> /teacher/leave      (BARU: Pengajuan izin mandiri & riwayat izin guru)
├── 📖 Jurnal KBM & Presensi  -> /teacher/journal    (Tetap berjalan)
├── ❓ Manajemen Kuis AI      -> /teacher/quiz       (Tetap berjalan)
├── 🛡️ Verifikasi Perizinan   -> /teacher/permissions (Khusus Kesiswaan/Wali Kelas memverifikasi izin SISWA)
└── 👁️ Monitoring Kesiswaan   -> /web/monitoring     (Khusus Tim Kesiswaan)
```

---

## 3. Rincian Desain & Fungsionalitas Halaman Baru

### A. Halaman Dashboard Guru (`TeacherDashboardPage.jsx`)
Mengacu pada referensi Dashboard Siswa (`StudentHomePage.jsx`), Dashboard Guru akan terdiri dari:
1. **Header Portal & Profil Guru:**
   - Greeting personal: *"Selamat Bertugas, [Nama Guru]"*.
   - Badge informasi: NIP, Beban Mengajar Total, serta Status Penugasan (Guru Mata Pelajaran, Wali Kelas X RPL 1, atau Tim Kesiswaan).
   - Indikator tanggal & waktu real-time: Hari, Tanggal format Indonesia, Jam.
2. **Empat Kartu Metrik Harian Guru:**
   - **Sesi Mengajar Hari Ini:** Jumlah jam pelajaran (JP) dan sesi kelas yang harus diampu hari ini.
   - **Beban Mengajar Mingguan:** Total JP teralokasi pada semester berjalan (misal: *24 JP / minggu*).
   - **Jurnal Menunggu Pengisian:** Jumlah sesi KBM yang telah selesai namun belum diisi jurnalnya (*missing journal alert*).
   - **Status Izin Hari Ini:** Status normal / sedang dalam masa perizinan yang disetujui kesiswaan.
3. **Aksi Cepat Guru (Quick Actions):**
   - **Buka Jurnal KBM:** Pintasan cepat membuka kelas yang sedang berlangsung.
   - **Ajukan Izin Mengajar:** Pintasan membuka halaman formulir izin jika berhalangan hadir.
   - **Kalender Mingguan:** Pintasan menuju matriks jadwal lengkap.
   - **Manajemen Kuis AI:** Pintasan membuat modul evaluasi kuis.
4. **Jadwal KBM Khusus Hari Ini (Today's Schedule Widget):**
   - **Filter Otomatis:** Hanya memanggil dan menampilkan jadwal mengajar untuk hari berjalan (`day_of_week = today`) dan putaran aktif (`cycle_type = active_cycle`).
   - **Tampilan Daftar Sesi:** Setiap card sesi memuat rentang jam riil (misal *07:00 - 09:15 WIB*), jam ke-..., nama mata pelajaran, rombel kelas (misal *X RPL 1*), ruang belajar, dan badge status jurnal (Selesai Disimpan / Belum Dimulai).
   - **Tombol Aksi Langsung:** Tombol *"Buka Jurnal KBM"* pada masing-masing card jadwal yang langsung mengarahkan guru ke halaman jurnal kelas tersebut.
   - **Empty State:** Jika hari ini tidak ada jadwal mengajar (atau hari libur/akhir pekan), menampilkan visual state informatif *"Tidak ada jadwal KBM aktif untuk hari ini"*.

### B. Halaman Jadwal Mengajar (`TeacherSchedulePage.jsx`)
- Membersihkan tombol "Ajukan Izin Hari Ini" dan "Riwayat Izin Saya" dari header jadwal.
- Membersihkan modal pengajuan izin dan modal riwayat izin dari komponen ini (karena sudah dipindahkan ke halaman tersendiri).
- Mengganti tombol header dengan tautan navigasi *"Kelola Izin Mengajar &rarr;"* atau *"Kembali ke Dashboard"*.
- Mempertahankan fungsionalitas utama: Matriks Timetable Mingguan, switcher Putaran 1 & Putaran 2, filter Hari, pencarian rombel/mapel/ruang, serta switcher konteks multi-role Wali Kelas (Jadwal Mengajar Saya vs Jadwal Kelas Binaan).

### C. Halaman Izin Mengajar Guru (`TeacherLeavePage.jsx`)
- Halaman mandiri khusus perizinan guru (tidak lagi berbentuk modal kecil di halaman jadwal).
- **Bagian Atas (Header & Statistik):**
   - Tombol utama kuning Exness (`#FFDE02`): **"+ Ajukan Izin Mengajar Baru"**.
   - 4 Card Metrik Izin: Total Pengajuan, Disetujui, Menunggu Verifikasi, Ditolak.
- **Formulir Pengajuan Izin Guru:**
   - Pilihan tanggal izin (default hari ini).
   - Pilihan kategori alasan (Sakit, Dinas Luar, Keperluan Keluarga / Mendesak).
   - Pemilihan jam mengajar yang ditinggalkan (auto-detect jadwal hari tersebut).
   - Upload surat keterangan / surat dinas resmi (disimpan ke Supabase Storage `s3` disk & sinkron lokal).
   - Instruksi tugas titipan mandiri untuk kelas / guru piket.
   - Upload berkas modul / soal tugas lampiran.
- **Tabel & Riwayat Pengajuan Izin Guru:**
   - Filter tab: *Semua*, *Menunggu Verifikasi*, *Disetujui*, *Ditolak*.
   - Kolom: No, Tanggal Izin, Kategori & Alasan, Jadwal Ditinggalkan, Surat & Dokumen Tugas, Status Persetujuan, Aksi.
   - Pratinjau Dokumen Surat & Dokumen Tugas menggunakan viewer gambar / PDF interaktif yang sudah distandardisasi.

---

## 4. Analisis Komponen, Routing & Backend API

### A. Routing & Navigasi Frontend
| Rute URL | Komponen Halaman | Hak Akses | Deskripsi |
|---|---|---|---|
| `/teacher/dashboard` | `TeacherDashboardPage.jsx` | Teacher | Dashboard utama guru (Jadwal hari ini, metrik harian) |
| `/teacher/schedule` | `TeacherSchedulePage.jsx` | Teacher | Kalender & Matriks jadwal KBM mingguan |
| `/teacher/leave` | `TeacherLeavePage.jsx` | Teacher | Pengajuan izin mengajar & riwayat izin pribadi guru |
| `/teacher/journal` | `TeacherJournalPage.jsx` | Teacher | Pengisian jurnal & presensi KBM |
| `/teacher/quiz` | `TeacherQuizPage.jsx` | Teacher | Manajemen kuis evaluasi AI |
| `/teacher/permissions` | `PermissionVerifyPage.jsx` | Teacher (Kesiswaan/Wali Kelas) | Verifikasi berkas perizinan siswa |
| `/web/monitoring` | `MonitoringRecapPage.jsx` | Teacher (Kesiswaan), Waka | Monitoring pelaksanaan KBM & rekap kehadiran |

### B. Backend API yang Digunakan (Data Riil, Tanpa Dummy)
1. **Jadwal Hari Ini & Jadwal Mingguan:**
   - `GET /api/schedules?day={dayOfWeek}&cycle={activeCycle}`
   - Otomatis ter-scoped oleh backend hanya untuk `teacher_id = auth()->id()`.
   - Menghasilkan relasi `schoolClass`, `room`, `subject`, dan `journals`.
2. **Keterlambatan Jurnal:**
   - `GET /api/schedules?status=missing_journal` (untuk metrik jurnal yang butuh pengisian).
3. **Pengaturan Akademik & Hari Upacara:**
   - `GET /api/academic-settings` (mendapatkan `active_cycle`, `monday_is_upacara`, dan `period_templates`).
4. **Perizinan Guru:**
   - `GET /api/teacher-leave-requests`: Mengambil riwayat izin yang diajukan oleh guru yang sedang login.
   - `POST /api/teacher-leave-requests`: Menyimpan permohonan izin baru beserta upload berkas surat dan berkas tugas.
5. **Auth & Default Landing Page:**
   - `AuthContext.jsx`: Fungsi `getHomeRoute()` untuk role `teacher` diarahkan ke `/teacher/dashboard`.

---

## 5. Rencana Tahapan Implementasi

### Tahap 1: Pembuatan Halaman Dashboard Guru
1. Buat file `frontend/scp_web/src/pages/teacher/TeacherDashboardPage.jsx`.
2. Buat file `frontend/scp_web/src/pages/teacher/TeacherDashboard.css` dengan styling konsisten Exness Precision Fintech.
3. Integrasikan pemanggilan API data riil:
   - Mengambil jadwal hari berjalan via `journalApi.getTeacherSchedules({ day, cycle })`.
   - Mengambil alert jurnal via `journalApi.getMissingJournals()`.
   - Mengambil status izin hari ini via `leaveApi.getTeacherLeaveRequests()`.
4. Render layout: Greeting header, 4 kartu metrik, barisan quick actions, dan widget jadwal pembelajaran hari ini.

### Tahap 2: Pembuatan Halaman Izin Mengajar Guru Mandiri
1. Buat file `frontend/scp_web/src/pages/teacher/TeacherLeavePage.jsx`.
2. Buat file `frontend/scp_web/src/pages/teacher/TeacherLeave.css`.
3. Pindahkan logika form pengajuan izin dan tabel riwayat izin dari `TeacherSchedulePage.jsx` ke halaman baru ini.
4. Hubungkan dengan modal viewer gambar surat / PDF yang mendukung Supabase Storage.

### Tahap 3: Penyempurnaan Halaman Jadwal Mengajar
1. Bersihkan modal perizinan dan tombol-tombol izin pop-up dari header `TeacherSchedulePage.jsx`.
2. Ganti tombol header dengan tautan bersih yang mengarahkan ke halaman Izin Mengajar jika guru ingin mengajukan izin.
3. Pastikan matriks timetable mingguan dan switcher kelas binaan wali kelas tetap berfungsi normal.

### Tahap 4: Pembaruan Routing & Navigasi
1. Perbarui `frontend/scp_web/src/routes/AppRouter.jsx` untuk mendaftarkan rute `/teacher/dashboard` dan `/teacher/leave`.
2. Perbarui `frontend/scp_web/src/components/layout/Sidebar.jsx` untuk menampilkan menu:
   - Dashboard
   - Jadwal Mengajar
   - Izin Mengajar Saya
3. Perbarui `frontend/scp_web/src/components/layout/TopBar.jsx` untuk pemetaan breadcrumb `/teacher/dashboard` dan `/teacher/leave`.
4. Perbarui `frontend/scp_web/src/context/AuthContext.jsx` agar redirect login guru mengarah ke `/teacher/dashboard`.

### Tahap 5: Pengujian & Verifikasi Menyeluruh
1. **Pengujian Build Frontend:** Eksekusi `npm run build` di `frontend/scp_web` untuk memastikan bundling Vite sukses tanpa error.
2. **Pengujian Hak Akses & Navigasi:** Verifikasi bahwa guru reguler, guru kesiswaan, dan wali kelas memiliki navigasi yang presisi sesuai hak aksesnya.
3. **Pengujian Data Riil:** Verifikasi bahwa data jadwal hari ini, beban mengajar, dan riwayat izin berasal dari database PostgreSQL tanpa data dummy.
4. **Verifikasi Responsivitas:** Uji tampilan layout pada resolusi desktop, tablet, dan mobile.

---

## 6. Konfirmasi Persetujuan
Rencana ini dirancang secara terisolasi tanpa mengubah skema database dan tanpa merusak alur kerja yang sudah berjalan. Implementasi kode hanya akan dimulai setelah rencana ini ditinjau dan disetujui oleh pengguna.
