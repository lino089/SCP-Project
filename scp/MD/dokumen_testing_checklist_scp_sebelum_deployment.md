# Dokumen Audit & Testing Checklist Seluruh Fitur School Class Progress (SCP) Sebelum Deployment

**Nama Proyek:** School Class Progress (SCP)  
**Versi Dokumen:** 1.0 (Pre-Deployment QA & UAT Guide)  
**Tanggal Penyusunan:** 6 November 2026  
**Arsitektur Sistem:** Backend Laravel 12 REST API (`scp/`) + Frontend React 19 Vite (`frontend/scp_web/`) + PostgreSQL (`db_scp`)  
**Status Dokumen:** Siap Digunakan untuk Pengujian Manual & Otomatis Pra-Deployment

---

## 1. Informasi Proyek dan Tujuan Testing

### 1.1 Gambaran Umum Sistem
**School Class Progress (SCP)** adalah platform manajemen operasional akademik sekolah menengah (SMK/SMA) terpadu yang mengelola jadwal pelajaran sistem putaran (*cycle 1–4*), jurnal mengajar guru berbasis bukti foto terkompresi, presensi siswa berbasis pengecualian (*exception-based attendance*), perizinan siswa dan guru (dengan tugas titipan), kalender akademik multi-cakupan, kenaikan kelas & tinggal kelas, hingga asesmen kuis berbantuan kecerdasan buatan (*AI-Assisted Quiz* menggunakan Google Gemini API).

### 1.2 Tujuan Penyusunan Dokumen Testing
Dokumen ini disusun sebagai panduan pengujian menyeluruh (*End-to-End Quality Assurance & User Acceptance Testing*) sebelum sistem dideploy ke server produksi sekolah, dengan tujuan:
1. Memastikan seluruh fitur pada setiap role (**Waka Kurikulum, Guru Pengampu, Guru Wali Kelas, Guru Kesiswaan/BK, Siswa, dan Orang Tua**) berjalan sesuai spesifikasi aktual pada source code.
2. Mengidentifikasi lebih awal apabila terdapat cacat logika (*bug*), kebocoran hak akses (*RBAC bypass*), ketidakkonsistenan data antarmodul, atau kegagalan integrasi pihak ketiga.
3. Menyediakan langkah pengujian yang konkret, terukur, dan berbasis checkbox (`- [ ]`) agar penguji dapat memvalidasi kesiapan sistem satu per satu tanpa menebak alur.
4. Menetapkan standar **Kriteria Kelayakan Deployment (Go / No-Go Criteria)** secara objektif.

### 1.3 Perbedaan Pengujian Otomatis vs Pengujian Manual pada Proyek SCP
- **Pengujian Otomatis (Backend PHPUnit):** Proyek telah memiliki **425 automated test cases** (`php artisan test`) yang menguji kontrak endpoint REST API, validasi database, dan logika bisnis inti di sisi server.
- **Pengujian Manual (Dokumen Ini):** Berfokus pada interaksi antarmuka pengguna (*UI/UX*), alur lintas halaman pada browser, unggah file fisik (Excel/PDF/Foto Kamera), integrasi kredensial layanan eksternal secara *live* (Google SSO, SMTP Email, Fonnte WhatsApp, Google AI Studio), serta kondisi batas jaringan dan perangkat nyata.

---

## 2. Ringkasan Hasil Audit Fitur

Berdasarkan audit menyeluruh terhadap kode sumber aktual pada `scp/routes/api.php`, `scp/app/Http/Controllers/Api/`, `scp/app/Services/`, serta `frontend/scp_web/src/`, berikut adalah peta kesiapan modul sistem:

| No | Modul Sistem | Komponen Backend Utama | Komponen Frontend Utama | Status Implementasi |
|---|---|---|---|---|
| 1 | **Autentikasi, SSO & Keamanan Sesi** | `AuthController`, `ForgotPasswordController`, `GoogleAuthService` | `LoginPage`, `ForgotPasswordPage`, `ChangePasswordPage` | **100% Berfungsi** (Membutuhkan `GOOGLE_CLIENT_ID` & SMTP untuk fitur eksternal) |
| 2 | **Profil, Verifikasi OTP & Tautan Akun** | `ProfileController`, `WhatsAppService`, `OtpCode` | `ProfilePage` | **100% Berfungsi** (OTP WA mendukung mode `fonnte` atau `log`) |
| 3 | **Dashboard & Pengaturan Akademik Waka** | `AcademicSettingController`, `MasterDataSummaryController` | `DashboardWakaPage`, `TopBar`, `Sidebar` | **100% Berfungsi** (Siklus 1–4, status upacara Senin, tahun ajaran) |
| 4 | **Master Data, Import Excel & Penugasan** | `SchoolClassController`, `RoomController`, `SubjectController`, `TeacherController`, `StudentController` | `MasterDataPage`, `TeacherAssignmentTab`, `ClassAssignmentEditModal`, `TeacherAssignmentImportModal` | **100% Berfungsi** (CRUD, Import Excel Guru/Siswa/Penugasan, kredensial awal) |
| 5 | **Smart Delete & Tempat Sampah (Recycle Bin)** | `RecycleBinController` | `MasterDataPage` (Tab Tempat Sampah), `DeleteConflictDialog`, `DeleteConfirmationModal` | **100% Berfungsi** (Deteksi dependensi FK, soft delete, restore, force delete) |
| 6 | **Manajemen Jadwal & Import PDF** | `ScheduleController`, `ScheduleImportController` | `ScheduleManagementPage`, `ScheduleImportPage` | **100% Berfungsi** (Matriks jadwal, deteksi bentrok real-time, ekstraksi PDF 3-tier matching) |
| 7 | **Kalender Akademik & Eksklusi KBM** | `AcademicEventController`, `AcademicExclusionService` | `AcademicCalendarPage`, `TeacherCalendarPage`, `StudentCalendarPage`, `ParentCalendarPage` | **100% Berfungsi** (4 tipe agenda, cakupan global/tingkat/kelas, blokir otomatis jurnal KBM) |
| 8 | **Kenaikan Kelas & Tinggal Kelas** | `SchoolClassController@promoteClasses`, `StudentController@holdBack` | `GradePromotionPage` | **100% Berfungsi** (Simulasi pemetaan rombel X→XI→XII→Lulus, tandai tinggal kelas) |
| 9 | **Jurnal KBM, Kamera & Presensi Siswa** | `JournalController`, `AttendanceController` | `TeacherDashboardPage`, `TeacherSchedulePage`, `TeacherJournalPage` | **100% Berfungsi** (Buka sesi, kompresi foto kamera/file, presensi exception-based, mode guru pengganti) |
| 10 | **Perizinan Siswa & Perizinan Guru** | `LeaveRequestController`, `TeacherLeaveRequestController` | `StudentPermissionPage`, `TeacherLeavePage`, `PermissionVerifyPage` | **100% Berfungsi** (Izin tidak masuk & izin keluar jam KBM, izin guru + tugas titipan, verifikasi multi-tab) |
| 11 | **Manajemen & Pengerjaan Kuis AI** | `QuizController`, `AIService`, `GenerateQuizFromPromptJob`, `ExtractQuizFromDocumentJob`, `GradeEssaySubmissionJob` | `TeacherQuizPage`, `StudentQuizPage` | **100% Berfungsi** (Generator Prompt AI, Ekstraksi Dokumen, Input Manual, Koreksi Semantik Esai AI, Override Nilai) |
| 12 | **Monitoring, Rekapitulasi & Ekspor Excel** | `AttendanceController`, `JournalController@dailyRecap` | `MonitoringRecapPage`, `ParentMonitoringPage`, `StudentHomePage` | **100% Berfungsi** (Filter presensi & jurnal, ekspor `.xlsx`, portal monitoring orang tua) |

---

## 3. Daftar Seluruh Fitur Berdasarkan Role

Sistem SCP menerapkan *Role-Based Access Control (RBAC)* dengan **4 role dasar** (`vice_principal` / `waka`, `teacher`, `student`, `parent`) serta **2 penugasan khusus (*assignments*)** pada role `teacher` yaitu **Wali Kelas (`wali_kelas`)** dan **Tim Kesiswaan/BK (`kesiswaan`)**.

> **Catatan Arsitektur Penting:** Di dalam database, pengguna bernama `"Administrator Sistem"` (`nis_nip: ADMIN001`) memiliki `role = vice_principal`. Tidak terdapat tabel/role `admin` terpisah di luar `vice_principal`.

### 3.1 Role: Waka Kurikulum (`vice_principal` / `waka`)
1. **Dashboard Waka (`/web/dashboard`):**
   - Ringkasan jumlah entitas Master Data (Kelas, Ruangan, Mapel, Guru, Siswa, Jadwal).
   - Pengaturan **Putaran Jadwal Aktif (Cycle 1–4)** dengan konfirmasi kata sandi.
   - Pengaturan **Status Hari Senin (Upacara Bendera vs KBM Normal)** dengan konfirmasi kata sandi.
   - Pengaturan **Tahun Ajaran & Semester Aktif** dengan konfirmasi kata sandi.
   - Tabel riwayat pergantian putaran jadwal (*Cycle History*).
   - Peringatan daftar sesi KBM yang terlambat mengisi jurnal (> 30 menit).
   - Banner informasi agenda kalender akademik aktif hari ini.
2. **Kalender Akademik (`/web/academic-calendar`):**
   - Pembuatan, pembaruan, dan penghapusan agenda akademik (`holiday`, `school_event`, `class_event`, `exam`).
   - Pengaturan cakupan terdampak: Seluruh Sekolah (`all`), Tingkat Kelas (`grade`: 10/11/12), atau Rombel Spesifik (`class`).
   - Pengaturan sakelar `disables_teaching` (meniadakan kewajiban KBM & pengisian jurnal).
3. **Manajemen Jadwal Pelajaran (`/web/schedules`):**
   - Tampilan matriks jadwal per kelas, filter tingkat (10/11/12), kelas, hari, dan siklus (1–4).
   - Penambahan, pengeditan, dan penghapusan slot jadwal dengan konfirmasi kata sandi.
   - Deteksi bentrok jadwal otomatis (*Teacher Conflict, Room Conflict, Class Slot Overlap*) beserta badge peringatan.
   - Reset seluruh jadwal pelajaran dengan konfirmasi kata sandi.
4. **Import Jadwal dari PDF (`/web/schedule-import` / `/kurikulum/jadwal/import`):**
   - Unggah dokumen PDF jadwal resmi sekolah.
   - Ekstraksi tabel otomatis dan pencocokan 3-Tier (*Matched, Unmatched, Conflict, Duplicate*).
   - Resolusi manual baris jadwal yang belum cocok (*unmatched*) dan pemetaan guru massal (*bulk teacher resolution*).
   - Konfirmasi penyimpanan (*commit*) jadwal ke putaran aktif dengan kata sandi.
5. **Master Data & Tempat Sampah (`/web/master-data`):**
   - **Tab Kelas:** CRUD kelas, tingkat, jurusan, dan penunjukan wali kelas.
   - **Tab Ruangan:** CRUD ruang kelas/lab beserta tipe (`theory` / `lab`) dan kapasitas.
   - **Tab Mata Pelajaran:** CRUD mata pelajaran dan kode mapel.
   - **Tab Guru:** CRUD akun guru, unduh template Excel, import guru massal, modal tampilkan kredensial password awal, *bulk delete* guru.
   - **Tab Siswa:** CRUD akun siswa & akun orang tua otomatis (`ORTU-{NIS}`), unduh template Excel, import siswa massal, *bulk delete* siswa.
   - **Tab Penugasan Guru (`TeacherAssignmentTab`):** Matriks penugasan Wali Kelas dan Guru BK/Kesiswaan per kelas, riwayat pergantian wali kelas, serta wizard import Excel penugasan (`WALI KELAS.xlsx`).
   - **Tab Tempat Sampah (`Recycle Bin`):** Daftar entitas terhapus (*soft-deleted*), pemeriksaan dependensi relasi, pemulihan data (*restore*), dan hapus permanen (*force delete*) dengan kata sandi.
   - **Reset Master Data:** Fitur pengosongan master data terproteksi kata sandi.
6. **Kenaikan Kelas (`/web/grade-promotion`):**
   - Pratinjau pemetaan otomatis kenaikan kelas (X → XI, XI → XII, XII → Alumni/Lulus).
   - Penandaan siswa **Tinggal Kelas (*Hold Back*)** per individu.
   - Eksekusi proses kenaikan kelas massal dengan proteksi kata sandi.
7. **Monitoring & Rekap (`/web/monitoring`) & Verifikasi Izin (`/teacher/permissions`):**
   - Akses penuh melihat rekap presensi seluruh kelas, ekspor Excel, rekap jurnal harian, menandai jam kosong (`teacher_absent`), serta menyetujui/menolak perizinan siswa dan guru.

### 3.2 Role: Guru Pengampu (`teacher`)
1. **Dashboard Guru (`/teacher/dashboard`):**
   - Statistik beban mengajar hari ini, total JP mingguan, jumlah jurnal belum diisi, dan status izin mengajar.
   - Daftar jadwal mengajar hari ini beserta tombol pintas **Isi Jurnal** atau **Detail**.
2. **Jadwal Mengajar (`/teacher/schedule`):**
   - Tabel dan matriks jadwal mengajar mingguan per siklus, filter hari, serta peringatan keterlambatan jurnal (`missing_journal`).
3. **Jurnal KBM & Presensi Siswa (`/teacher/journal`):**
   - Pembukaan sesi kelas (`POST /api/journals` berstatus `ongoing`).
   - Pengambilan foto dokumentasi KBM langsung melalui kamera perangkat (*WebRTC MediaDevices*) atau unggah file dengan kompresi otomatis (~800px–1280px JPEG).
   - Pencatatan presensi siswa berbasis pengecualian (*default Hadir*, guru cukup mengubah yang **Sakit, Izin, atau Alpa**) dengan sinkronisasi otomatis daftar siswa yang sudah memiliki izin disetujui (`approved_leaves`).
   - Pengisian catatan khusus per siswa (*student notes*) dan topik materi pembelajaran (minimal 10 karakter).
4. **Pengajuan Izin Mengajar (`/teacher/leave`):**
   - Pengajuan izin tidak mengajar (`sakit`, `izin_pribadi`, `dinas_luar`, `lainnya`) dengan memilih jadwal terdampak, mengunggah surat bukti, serta mengisi **Instruksi Tugas Titipan** beserta lampiran tugas untuk guru pengganti/piketan.
5. **Manajemen Kuis Berbantuan AI (`/teacher/quiz`):**
   - Pembuatan kuis baru (judul, kelas, tenggat waktu, batas percobaan).
   - **3 Metode Pembuatan Soal:**
     1. *Generator Prompt AI* (menentukan jumlah soal, tipe PG/Esai/Kombinasi, tingkat kesulitan).
     2. *Ekstraksi Dokumen AI* (unggah file PDF/DOCX/TXT untuk diekstrak menjadi butir soal).
     3. *Input Soal Manual* (tambah/edit/hapus soal satu per satu).
   - Publikasi kuis (`published`), penutupan/publikasi hasil (`published_result`), pemeriksaan lembar jawaban siswa, tinjauan analisis semantik AI pada soal esai, serta **Override Nilai Manual** oleh guru.
6. **Kalender Akademik Guru (`/teacher/calendar`):**
   - Melihat kalender agenda sekolah dan indikator hari bebas KBM.

### 3.3 Role: Guru Wali Kelas (`teacher` dengan penugasan `wali_kelas`)
Memiliki seluruh fitur **Guru Pengampu**, ditambah kewenangan khusus pada kelas binaannya:
1. **Mode Jadwal Kelas Binaan (`/teacher/schedule`):** Sakelar untuk beralih antara *"Jadwal Mengajar Saya"* dan *"Jadwal Kelas Binaan"*.
2. **Guru Pengganti / Ambil Alih Kelas (`/teacher/journal`):** Membuka sesi jurnal dan mengisi presensi sebagai `substitute_teacher` pada kelas binaannya apabila guru pengampu asli berhalangan hadir, lengkap dengan tampilan **Tugas Titipan** dari guru asli.
3. **Pantau Perizinan Kelas Binaan (`/teacher/permissions`):** Melihat daftar pengajuan izin siswa di kelas binaannya beserta dokumen bukti (mode baca/pantau; tombol Setujui/Tolak dikhususkan bagi Kesiswaan & Waka).
4. **Monitoring & Rekap Kelas Binaan (`/web/monitoring`):** Melihat rekap presensi dan jurnal khusus kelas yang diwalikannya.

### 3.4 Role: Guru Kesiswaan / BK (`teacher` dengan penugasan `kesiswaan`)
Memiliki seluruh fitur **Guru Pengampu**, ditambah kewenangan khusus pada kelas-kelas tanggung jawabnya:
1. **Verifikasi Perizinan Siswa & Guru (`/teacher/permissions`):**
   - Menyetujui (`approved`) atau menolak (`rejected` disertai alasan penolakan) pengajuan izin siswa (Tidak Masuk maupun Izin Keluar Jam Pelajaran).
   - Menyetujui atau menolak pengajuan izin mengajar guru pada tab Perizinan Guru.
2. **Penanganan Jam Kosong & Ambil Alih Kelas (`/teacher/journal`):**
   - Menekan tombol **Tandai Guru Berhalangan (`teacher_absent`)** pada jadwal yang gurunya tidak hadir.
   - Mengambil alih kelas sebagai guru pengganti (`substitute_teacher`) dan menyampaikan tugas titipan guru pengampu.
3. **Monitoring & Rekap Kesiswaan (`/web/monitoring`):**
   - Mengakses rekapitulasi ketidakhadiran siswa, memfilter berdasarkan tanggal/kelas/status, serta mengekspor laporan ke Excel (`.xlsx`).

### 3.5 Role: Siswa (`student`)
1. **Beranda Siswa (`/student/home`):**
   - Ringkasan persentase kehadiran pribadi, modal rincian riwayat ketidakadilan/presensi, daftar jadwal pelajaran hari ini, kuis aktif yang harus dikerjakan, dan banner agenda sekolah hari ini.
2. **Jadwal Pelajaran Siswa (`/student/schedule`):**
   - Matriks jadwal pelajaran kelasnya per siklus (1–4) beserta informasi ruang dan guru.
3. **Pengajuan Perizinan Siswa (`/student/permissions`):**
   - Mengajukan izin **Tidak Masuk Sekolah (`tidak_masuk`)** atau **Izin Keluar Jam Pelajaran (`izin_keluar`)** dengan memilih kategori (`sakit` / `izin`), rentang tanggal atau jam ke-X s/d ke-Y, alasan, serta unggah bukti foto/PDF.
   - Mengedit atau membatalkan pengajuan izin yang masih berstatus `pending`.
4. **Pengerjaan Kuis AI (`/student/quiz`):**
   - Mengerjakan kuis aktif dengan timer hitung mundur, penyimpanan draf jawaban otomatis di `sessionStorage`, pengumpulan jawaban, serta melihat rincian nilai dan umpan balik AI setelah hasil dipublikasikan guru (`published_result`).
5. **Kalender Akademik Siswa (`/student/calendar`):**
   - Melihat agenda kegiatan dan hari libur yang relevan dengan tingkat/kelasnya.

### 3.6 Role: Orang Tua / Wali Siswa (`parent`)
1. **Monitoring Anak (`/parent/monitoring`):**
   - Kartu profil siswa tertaut (`linkedStudent`), statistik kehadiran (Hadir, Sakit, Izin, Alpa), tabel riwayat presensi & surat izin anak, tabel nilai hasil kuis anak, serta matriks jadwal pelajaran kelas anak.
2. **Kalender Akademik Orang Tua (`/parent/calendar`):**
   - Melihat kalender akademik sekolah dan memfilter agenda berdasarkan anak tertaut.

---

## 4. Daftar Fitur yang Belum Selesai, Berupa Demo, atau Membutuhkan Konfigurasi Eksternal

Berdasarkan pemeriksaan kode sumber secara mendalam, berikut adalah komponen yang **masih berupa placeholder UI** atau **bergantung penuh pada konfigurasi layanan pihak ketiga** sehingga wajib diperhatikan saat pengujian:

| No | Nama Fitur / Elemen UI | Lokasi File | Kondisi Aktual di Source Code | Status Pengujian |
|---|---|---|---|---|
| 1 | **Tombol Pusat Bantuan & FAQ (`?`)** | `frontend/scp_web/src/components/layout/TopBar.jsx` (Baris 151–158) | Elemen `<button>` dengan ikon `HelpCircle` hanya bersifat dekoratif dan **belum memiliki atribut `onClick`**, modal, maupun halaman tujuan. | ** Demo / Placeholder UI** (Jangan diuji sebagai fungsi bisnis) |
| 2 | **Tombol Lonceng Notifikasi (`Bell`)** | `frontend/scp_web/src/components/layout/TopBar.jsx` (Baris 159–166) | Elemen `<button>` dengan ikon `Bell` belum memiliki *event handler* `onClick`, *dropdown drawer*, maupun endpoint API notifikasi in-app. | ** Demo / Placeholder UI** (Notifikasi aktual dikirim via WhatsApp/Email) |
| 3 | **Tombol Toggle Tema (`Sun`)** | `frontend/scp_web/src/components/layout/TopBar.jsx` (Baris 78–80, 142–150) | Menjalankan `document.documentElement.classList.toggle('dark')`, namun sistem desain menggunakan *Exness Precision Clean (Light Theme)* tanpa persistensi `localStorage` atau variabel CSS gelap penuh pada seluruh halaman. | ** Parsial / Kosmetik** (Prioritas Low) |
| 4 | **Pengiriman Pesan WhatsApp OTP & Alert Presensi (Fonnte)** | `scp/app/Services/WhatsAppService.php` & `scp/.env` | Di `.env` saat ini tertulis `WHATSAPP_DRIVER=log` dan `FONNTE_TOKEN=dummy_token`. Pada mode `log`, kode OTP tidak dikirim ke HP nyata melainkan ditulis ke `scp/storage/logs/laravel.log`. | ** Butuh Konfigurasi Eksternal** (Ubah ke `fonnte` + token aktif jika ingin uji kirim WA ke HP nyata) |
| 5 | **Login & Tautan Akun Google SSO** | `scp/app/Services/GoogleAuthService.php` & `frontend/scp_web/.env` | Membutuhkan `GOOGLE_CLIENT_ID` di `scp/.env` dan `VITE_GOOGLE_CLIENT_ID` di `frontend/scp_web/.env` yang terdaftar pada Google Cloud Console dengan *Authorized JavaScript Origins* sesuai domain/port. | ** Butuh Konfigurasi Eksternal** |
| 6 | **Pengiriman Email OTP (Lupa Sandi & Verifikasi Email)** | `scp/app/Http/Controllers/Api/ForgotPasswordController.php` & `scp/.env` | Menggunakan konfigurasi `MAIL_MAILER=smtp` (`smtp.gmail.com`). Jika kredensial SMTP tidak valid atau diblokir firewall, pengiriman OTP akan gagal kecuali `MAIL_MAILER=log`. | ** Butuh Konfigurasi Eksternal** |
| 7 | **Generator Soal & Penilaian Esai Kuis AI** | `scp/app/Services/AIService.php` & `scp/.env` | Menggunakan Google AI Studio (`gemini-3.1-flash-lite`) dengan kuota *Free Tier* (batas ~15 Request Per Menit). Jika melampaui batas RPM, API akan mengembalikan HTTP 429. | ** Aktif dengan Batas Rate Limit** |

---

## 5. Testing Checklist Berdasarkan Role

Gunakan daftar periksa cepat (*Quick Role Checklist*) di bawah ini untuk memastikan cakupan pengujian pada masing-masing akun pengguna:

### 5.1 Checklist Role Waka Kurikulum
- [ ] Login menggunakan NIP/Username Waka dan diarahkan ke `/web/dashboard`.
- [ ] Mengubah Putaran Jadwal Aktif (Cycle 1 s/d 4) dengan verifikasi password Waka.
- [ ] Mengubah status Hari Senin (Upacara Bendera vs KBM Normal) dan memeriksa perubahan slot jam pada halaman Jadwal.
- [ ] Mengubah Tahun Ajaran & Semester Aktif dan memastikan badge pada TopBar ikut berubah.
- [ ] Menambah, mengubah, dan menghapus Master Data Kelas, Ruangan, dan Mata Pelajaran.
- [ ] Mengunduh template Excel Guru, mengimpor file Excel Guru, dan melihat modal kredensial password awal.
- [ ] Mengunduh template Excel Siswa, mengimpor file Excel Siswa, dan memverifikasi terbentuknya akun Orang Tua (`ORTU-{NIS}`).
- [ ] Mengelola penugasan Wali Kelas dan Guru BK/Kesiswaan secara manual maupun lewat Import Excel Penugasan.
- [ ] Menghapus data Guru/Siswa/Kelas (masuk ke Tempat Sampah), memeriksa proteksi dependensi, memulihkan (*restore*), dan menghapus permanen (*force delete*).
- [ ] Menambahkan jadwal pelajaran secara manual dan memverifikasi deteksi bentrok (*Guru/Ruangan/Kelas*).
- [ ] Mengunggah file PDF Jadwal Pelajaran, melakukan resolusi baris *Unmatched/Conflict*, dan menyimpan (*commit*) jadwal.
- [ ] Membuat agenda Kalender Akademik dengan opsi `disables_teaching = true` dan memverifikasi dampaknya pada jadwal KBM.
- [ ] Menjalankan simulasi Kenaikan Kelas, menandai siswa Tinggal Kelas, dan mengeksekusi promosi kelas.

### 5.2 Checklist Role Guru Pengampu & Wali Kelas
- [ ] Login pertama kali dengan akun guru baru (status `must_change_password = true`) dan dipaksa mengganti kata sandi di `/change-password`.
- [ ] Melihat ringkasan jadwal mengajar hari ini dan peringatan jurnal belum terisi di `/teacher/dashboard`.
- [ ] Membuka sesi KBM di `/teacher/journal`, mengambil foto dokumentasi KBM via kamera/unggah file, mengubah status presensi siswa (Sakit/Izin/Alpa), mengisi catatan siswa, mengisi topik materi ($\ge$ 10 karakter), dan menyelesaikan jurnal.
- [ ] Mengajukan izin tidak mengajar di `/teacher/leave` beserta lampiran surat dan instruksi tugas titipan.
- [ ] Membuat kuis baru di `/teacher/quiz`, men-generate soal via Prompt AI, mengekstrak soal dari dokumen PDF/DOCX, menambah soal manual, dan mempublikasikan kuis.
- [ ] Memeriksa hasil pengerjaan kuis siswa, melihat skor & umpan balik esai dari AI, melakukan *override* nilai manual, dan mempublikasikan hasil kuis (`published_result`).
- [ ] *(Khusus Wali Kelas)* Beralih ke tampilan jadwal kelas binaan, mengambil alih kelas yang gurunya absen, dan memantau daftar surat izin siswa kelas binaannya.

### 5.3 Checklist Role Guru Kesiswaan / BK
- [ ] Membuka menu Verifikasi Perizinan (`/teacher/permissions`) dan menyetujui/menolak izin siswa (Tidak Masuk & Izin Keluar).
- [ ] Membuka tab Perizinan Guru pada `/teacher/permissions` dan menyetujui/menolak pengajuan izin guru.
- [ ] Membuka jadwal kelas yang gurunya tidak hadir, menekan tombol **Tandai Guru Berhalangan (`teacher_absent`)**, atau mengambil alih kelas untuk menyampaikan tugas titipan.
- [ ] Membuka halaman Monitoring & Rekap (`/web/monitoring`), memfilter presensi & jurnal harian, serta mengunduh laporan dalam format Excel (`.xlsx`).

### 5.4 Checklist Role Siswa
- [ ] Login menggunakan NIS Siswa, melewati wajib ganti password awal, dan masuk ke `/student/home`.
- [ ] Melihat persentase kehadiran, rincian riwayat presensi, dan jadwal pelajaran harian/mingguan.
- [ ] Mengajukan izin Tidak Masuk Sekolah dan Izin Keluar Jam Pelajaran beserta dokumen lampiran di `/student/permissions`.
- [ ] Mengedit atau menghapus pengajuan izin yang masih berstatus `pending`.
- [ ] Mengerjakan kuis aktif di `/student/quiz`, menguji ketahanan *autosave* saat halaman di-refresh, mengumpulkan jawaban, dan melihat nilai akhir setelah hasil dipublikasikan guru.

### 5.5 Checklist Role Orang Tua
- [ ] Login menggunakan username `ORTU-{NIS}` dan masuk ke `/parent/monitoring`.
- [ ] Memeriksa kesesuaian nama anak, NIS, kelas, statistik kehadiran, riwayat surat izin, jadwal pelajaran anak, dan nilai kuis anak yang telah dirilis.
- [ ] Melihat agenda sekolah pada `/parent/calendar`.

---

## 6. Testing Checklist Berdasarkan Modul

- [ ] **Modul 1: Autentikasi, Otorisasi & Keamanan Akun** (`TC-AUTH-001` s/d `TC-AUTH-012`)
- [ ] **Modul 2: Profil Pengguna, OTP & Integrasi Google SSO** (`TC-PROF-001` s/d `TC-PROF-008`)
- [ ] **Modul 3: Dashboard Waka & Konfigurasi Akademik** (`TC-WAKA-001` s/d `TC-WAKA-007`)
- [ ] **Modul 4: Master Data, Import Excel & Penugasan Guru** (`TC-MAST-001` s/d `TC-MAST-016`)
- [ ] **Modul 5: Smart Delete & Tempat Sampah / Recycle Bin** (`TC-TRSH-001` s/d `TC-TRSH-006`)
- [ ] **Modul 6: Manajemen Jadwal & Import PDF Jadwal** (`TC-SCHD-001` s/d `TC-SCHD-011`)
- [ ] **Modul 7: Kalender Akademik & Eksklusi KBM** (`TC-CAL-001` s/d `TC-CAL-007`)
- [ ] **Modul 8: Kenaikan Kelas & Tinggal Kelas** (`TC-PROM-001` s/d `TC-PROM-005`)
- [ ] **Modul 9: Jurnal KBM, Kamera & Presensi Siswa** (`TC-JRNL-001` s/d `TC-JRNL-012`)
- [ ] **Modul 10: Perizinan Siswa, Perizinan Guru & Verifikasi** (`TC-LEAV-001` s/d `TC-LEAV-011`)
- [ ] **Modul 11: Kuis Berbantuan AI & Penilaian Semantik** (`TC-QUIZ-001` s/d `TC-QUIZ-012`)
- [ ] **Modul 12: Monitoring, Rekapitulasi & Portal Siswa/Orang Tua** (`TC-MON-001` s/d `TC-MON-008`)


---

## 7. Test Case Setiap Fitur

Setiap test case di bawah ini dilengkapi checkbox (`- [ ]`) dan tabel 11 atribut standar. Kolom **Kategori Skenario** dicantumkan pada deskripsi skenario: **[Positif]**, **[Negatif]**, **[Batas/Boundary]**, **[Integrasi]**, atau **[Hak Akses]**.

---

### 7.1 Modul 1: Autentikasi, Otorisasi & Pemulihan Kata Sandi (`TC-AUTH`)

- [ ] **TC-AUTH-001** — Login Valid Multi-Identitas (NIP/NIS, Email, Nomor HP Guru)
- [ ] **TC-AUTH-002** — Login Gagal Kredensial Salah atau Kosong
- [ ] **TC-AUTH-003** — Login Ditolak untuk Akun Nonaktif / Terhapus di Tempat Sampah
- [ ] **TC-AUTH-004** — Paksaan Ganti Kata Sandi Awal (`must_change_password = true`)
- [ ] **TC-AUTH-005** — Validasi Batas Karakter Kata Sandi Baru (< 8 Karakter & Konfirmasi Tidak Cocok)
- [ ] **TC-AUTH-006** — Login Menggunakan Google SSO (Akun Sudah Tertaut)
- [ ] **TC-AUTH-007** — Login Google SSO Ditolak (Email Google Belum Terdaftar di Sistem)
- [ ] **TC-AUTH-008** — Alur Lupa Kata Sandi Mandiri via Email OTP (4 Tahap)
- [ ] **TC-AUTH-009** — Lupa Kata Sandi Ditolak karena Email Belum Terdaftar/Terverifikasi
- [ ] **TC-AUTH-010** — Pengujian Cooldown & Kedaluwarsa OTP Lupa Kata Sandi
- [ ] **TC-AUTH-011** — Pembatasan Rate Limiting (Brute Force Login / OTP Throttle)
- [ ] **TC-AUTH-012** — Logout dan Pencabutan Token Sanctum

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-AUTH-001** | Semua Role | Autentikasi (`/login`) | **[Positif]** Login menggunakan NIP/NIS, Email, atau No. HP (khusus Guru) yang valid | Akun aktif tersedia di database | 1. Buka halaman `/login`.<br>2. Masukkan `nis_nip` pada kolom Username/NIS/NIP.<br>3. Masukkan password yang benar.<br>4. Klik tombol **Masuk**.<br>5. Ulangi langkah 1–4 menggunakan alamat email dan nomor HP (`0812...`). | User: `ADMIN001` (Waka) atau NIP Guru aktif; Password: `password123` | Login berhasil (HTTP 200), token disimpan di `localStorage`, dan pengguna diarahkan ke beranda sesuai role masing-masing. | **Critical** | Not Tested | |
| **TC-AUTH-002** | Semua Role | Autentikasi (`/login`) | **[Negatif]** Login dengan kolom kosong atau kata sandi salah | Halaman `/login` terbuka | 1. Klik **Masuk** saat input kosong.<br>2. Masukkan `ADMIN001` dengan password `salah999`.<br>3. Klik **Masuk**. | Username: `ADMIN001`, Password: `salah999` | Sistem menolak login (HTTP 422/401) dan menampilkan pesan *"Username atau password salah"* tanpa me-refresh halaman. | **Critical** | Not Tested | |
| **TC-AUTH-003** | Guru / Siswa | Autentikasi (`/login`) | **[Negatif / Integrasi]** Login menggunakan akun yang telah di-*soft-delete* (berada di Tempat Sampah) | Waka telah menghapus akun Guru/Siswa ke Tempat Sampah | 1. Buka `/login`.<br>2. Masukkan NIP/NIS akun yang berada di Tempat Sampah beserta password-nya.<br>3. Klik **Masuk**. | Akun Guru/Siswa berstatus `deleted_at != null` | Login ditolak (HTTP 403) dengan pesan *"Akun Anda telah dinonaktifkan atau berada di tempat sampah. Silakan hubungi pihak Waka/Administrator sekolah."* | **Critical** | Not Tested | |
| **TC-AUTH-004** | Guru / Siswa / Ortu | Ganti Sandi Wajib (`/change-password`) | **[Positif / Hak Akses]** Akun baru hasil import/pembuatan dengan `must_change_password = true` dipaksa mengganti sandi sebelum mengakses menu lain | Akun baru dibuat / diimpor oleh Waka | 1. Login dengan akun baru dan password awal.<br>2. Amati pengalihan otomatis ke `/change-password`.<br>3. Coba ketik URL `/teacher/dashboard` atau `/student/home` secara paksa di address bar.<br>4. Isi password lama, password baru ($\ge$ 8 karakter), dan konfirmasi password.<br>5. Klik **Simpan Kata Sandi**. | Password lama: `<kredensial_awal>`, Password baru: `SekolahBaru2026!` | Pengaksesan URL lain diblokir dan dikembalikan ke `/change-password`. Setelah simpan berhasil, status `must_change_password` menjadi `false` dan pengguna diarahkan ke dashboard. | **Critical** | Not Tested | |
| **TC-AUTH-005** | Semua Role | Ganti Sandi Wajib (`/change-password`) | **[Batas / Negatif]** Mengisi password baru kurang dari 8 karakter atau sama dengan password lama | Pengguna berada di `/change-password` | 1. Masukkan password baru `1234567` (7 karakter).<br>2. Klik simpan dan amati pesan validasi.<br>3. Masukkan password baru yang persis sama dengan password lama. | Password uji: `1234567` | Sistem menolak penyimpanan dan menampilkan pesan validasi bahwa kata sandi minimal 8 karakter dan harus berbeda. | **High** | Not Tested | |
| **TC-AUTH-006** | Semua Role | Google SSO (`/login`) | **[Positif / Integrasi]** Login satu klik menggunakan akun Google yang sudah tertaut | `VITE_GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_ID` terkonfigurasi; akun sudah tertaut Google | 1. Buka `/login`.<br>2. Klik tombol **Lanjutkan dengan Google**.<br>3. Pilih akun Google yang telah ditautkan pada profil SCP. | Akun Google tertaut (`google_id != null`) | Backend memverifikasi Google ID Token, mengembalikan token Sanctum, dan mengarahkan pengguna langsung ke dashboard. | **High** | Not Tested | Prasyarat: Google Client ID aktif |
| **TC-AUTH-007** | Semua Role | Google SSO (`/login`) | **[Negatif]** Login dengan akun Google yang belum terdaftar/tertaut di database SCP | Akun Google belum pernah ditautkan ke user mana pun | 1. Buka `/login`.<br>2. Klik tombol **Lanjutkan dengan Google**.<br>3. Pilih email Google asing di luar sistem. | Email: `asing.belum.terdaftar@gmail.com` | Sistem menolak login (HTTP 404/403) dan menampilkan pesan error bahwa akun Google belum tertaut dengan akun SCP mana pun. | **High** | Not Tested | |
| **TC-AUTH-008** | Semua Role | Lupa Kata Sandi (`/forgot-password`) | **[Positif / Integrasi]** Pemulihan kata sandi 4 langkah menggunakan OTP Email | Akun memiliki email terverifikasi (`email_verified_at != null`) dan SMTP aktif | 1. Di `/login`, klik **Lupa Kata Sandi?**.<br>2. Masukkan NIS/NIP/Username lalu klik **Cari Akun**.<br>3. Pastikan email tersensor (`b***@gmail.com`) muncul, lalu klik **Kirim Kode OTP**.<br>4. Buka kotak masuk email (atau `laravel.log`), salin 6 digit OTP, dan verifikasi.<br>5. Masukkan password baru dan simpan. | Identitas: NIP Guru dengan email aktif; OTP: 6 digit angka | Password berhasil direset, seluruh token sesi lama dihapus, dan pengguna dapat login dengan password baru. | **High** | Not Tested | |
| **TC-AUTH-009** | Semua Role | Lupa Kata Sandi (`/forgot-password`) | **[Negatif]** Mencoba fitur lupa sandi pada akun yang belum menautkan email | Akun siswa/guru belum memiliki kolom `email` | 1. Buka `/forgot-password`.<br>2. Masukkan NIS siswa yang belum punya email.<br>3. Klik **Cari Akun**. | NIS siswa tanpa email | Sistem menolak melanjutkan ke pengiriman OTP dan menginformasikan bahwa akun belum memiliki email terverifikasi (hubungi Waka). | **Medium** | Not Tested | |
| **TC-AUTH-010** | Semua Role | Lupa Kata Sandi (`/forgot-password`) | **[Batas / Negatif]** Meminta ulang OTP sebelum jeda 1 menit atau memasukkan OTP yang sudah lewat 10 menit | Pengguna berada pada tahap input OTP di `/forgot-password` | 1. Setelah meminta OTP, segera kirim request ulang dalam waktu < 60 detik.<br>2. Masukkan kode OTP yang salah (`000000`) sebanyak 6 kali.<br>3. Masukkan kode OTP setelah lewat 10 menit. | Kode OTP salah: `000000` | Permintaan < 60 detik ditolak (HTTP 429 Cooldown). Percobaan salah berulang atau lewat 10 menit membatalkan OTP dan meminta kirim ulang. | **Medium** | Not Tested | |
| **TC-AUTH-011** | Semua Role | Keamanan API (`throttle:api`) | **[Batas / Keamanan]** Mengirim permintaan login gagal bertubi-tubi melebihi batas rate limit | Halaman `/login` terbuka | 1. Lakukan percobaan login gagal secara cepat > 10–60 kali dalam 1 menit. | Request beruntun | Server mengembalikan status HTTP 429 (*Too Many Requests*) untuk mencegah serangan *brute-force*. | **High** | Not Tested | |
| **TC-AUTH-012** | Semua Role | Logout (`TopBar`) | **[Positif / Keamanan]** Keluar dari akun dan memastikan token lama tidak bisa dipakai lagi | Pengguna sedang login | 1. Klik avatar inisial di pojok kanan atas `TopBar`.<br>2. Klik **Keluar Akun**.<br>3. Tekan tombol *Back* pada browser atau panggil `GET /api/me` dengan Bearer token lama. | Token Sanctum sebelum logout | Pengguna diarahkan ke `/login`, `localStorage` bersih, dan pemanggilan API dengan token lama menghasilkan HTTP 401 (*Unauthenticated*). | **Critical** | Not Tested | |

---

### 7.2 Modul 2: Profil Pengguna, OTP Kontak & Tautan Google (`TC-PROF`)

- [ ] **TC-PROF-001** — Verifikasi Email Mandiri via OTP di Halaman Profil
- [ ] **TC-PROF-002** — Penolakan Email Duplikat Milik Pengguna Lain
- [ ] **TC-PROF-003** — Verifikasi Nomor WhatsApp via OTP (Fonnte / Log Driver)
- [ ] **TC-PROF-004** — Normalisasi Format Nomor Telepon (`08...`, `+628...`, `628...`)
- [ ] **TC-PROF-005** — Menautkan Akun Google (*Link Google*) dari Halaman Profil
- [ ] **TC-PROF-006** — Penolakan Menautkan Akun Google yang Sudah Dipakai User Lain
- [ ] **TC-PROF-007** — Melepas Tautan Google (*Unlink Google*) dengan Konfirmasi Password
- [ ] **TC-PROF-008** — Mengubah Kata Sandi Mandiri dari Halaman Profil

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-PROF-001** | Semua Role | Profil (`/profile`) | **[Positif]** Menambahkan dan memverifikasi alamat email menggunakan 6 digit OTP | Login sebagai pengguna; SMTP / Log mail aktif | 1. Buka `/profile`.<br>2. Masukkan alamat email baru pada kartu Verifikasi Email.<br>3. Klik **Kirim Kode OTP**.<br>4. Masukkan 6 digit OTP yang diterima ke kolom verifikasi lalu klik **Verifikasi**. | Email: `guru.uji@gmail.com`; OTP: 6 digit | Status email berubah menjadi **Terverifikasi** (badge hijau) dan tersimpan di database (`email_verified_at` terisi). | **High** | Not Tested | |
| **TC-PROF-002** | Semua Role | Profil (`/profile`) | **[Negatif]** Memasukkan alamat email yang sudah dipakai oleh pengguna lain | Email `terpakai@sekolah.id` sudah dimiliki User A | 1. Login sebagai User B dan buka `/profile`.<br>2. Masukkan `terpakai@sekolah.id` lalu klik **Kirim Kode OTP**. | Email: `terpakai@sekolah.id` | Sistem menolak (HTTP 422) dengan pesan *"Alamat email sudah digunakan oleh pengguna lain."* | **High** | Not Tested | |
| **TC-PROF-003** | Semua Role | Profil (`/profile`) | **[Positif / Integrasi]** Memverifikasi nomor WhatsApp menggunakan kode OTP | Login sebagai pengguna; `WHATSAPP_DRIVER=log` atau `fonnte` aktif | 1. Buka `/profile` pada bagian Nomor WhatsApp.<br>2. Masukkan nomor HP `081234567890` lalu klik **Kirim OTP WhatsApp**.<br>3. Ambil 6 digit OTP dari WhatsApp (atau dari `scp/storage/logs/laravel.log` jika driver `log`).<br>4. Masukkan kode OTP dan klik **Verifikasi**. | Nomor: `081234567890`; OTP: 6 digit | Nomor telepon berhasil disimpan pada profil pengguna dan berstatus **Terverifikasi**. | **High** | Not Tested | Cek `.env` untuk driver WA |
| **TC-PROF-004** | Guru | Profil & Login | **[Batas / Integrasi]** Normalisasi format nomor HP (`0812...`, `+62812...`, `62812...`) saat disimpan dan dipakai login | Guru memverifikasi nomor HP di `/profile` | 1. Masukkan nomor dengan format `+62 812-9988-7766` dan verifikasi.<br>2. Logout, lalu coba login di `/login` menggunakan `081299887766`. | Input: `+62 812-9988-7766`, Login: `081299887766` | `WhatsAppService::normalizeNumber` & `User::normalizePhoneNumber` menyamakan format nomor sehingga login tetap berhasil dan duplikasi nomor dengan awalan berbeda dicegah. | **Medium** | Not Tested | |
| **TC-PROF-005** | Semua Role | Profil (`/profile`) | **[Positif]** Menautkan akun Google ke profil SCP | Pengguna belum menautkan Google (`google_id == null`) | 1. Buka `/profile`.<br>2. Pada bagian Tautan Akun Google, klik tombol **Continue with Google**.<br>3. Pilih akun Google pribadi. | Akun Google aktif | Status berubah menjadi **Terhubung**, menampilkan email Google yang ditautkan. | **Medium** | Not Tested | |
| **TC-PROF-006** | Semua Role | Profil (`/profile`) | **[Negatif]** Menautkan akun Google yang sudah terhubung ke akun SCP lain | Akun Google X sudah ditautkan ke User A | 1. Login sebagai User B, buka `/profile`.<br>2. Klik **Continue with Google** dan pilih Akun Google X. | Akun Google X | Sistem menolak (HTTP 422) dengan pesan bahwa akun Google tersebut sudah ditautkan ke pengguna lain. | **High** | Not Tested | |
| **TC-PROF-007** | Semua Role | Profil (`/profile`) | **[Positif / Negatif]** Melepas tautan akun Google dengan verifikasi kata sandi akun | Akun sudah terhubung dengan Google | 1. Klik tombol **Lepas Tautan** di `/profile`.<br>2. Pada modal konfirmasi, masukkan password yang salah → pastikan ditolak.<br>3. Masukkan password yang benar lalu konfirmasi. | Password salah vs Password benar | Saat password salah muncul pesan *"Kata sandi tidak valid"*. Saat password benar, `google_id` dikosongkan dan tombol tautan muncul kembali. | **Medium** | Not Tested | |
| **TC-PROF-008** | Semua Role | Profil (`/profile`) | **[Positif / Negatif]** Mengganti kata sandi dari menu Profil | Pengguna berada di `/profile` | 1. Isi Kata Sandi Saat Ini dengan sandi yang salah → klik Simpan (pastikan gagal).<br>2. Isi Kata Sandi Saat Ini dengan benar, Kata Sandi Baru `SandiBaru2026#`, dan Konfirmasi yang cocok → klik Simpan. | Sandi baru: `SandiBaru2026#` | Kata sandi berhasil diperbarui dan pengguna tetap dapat beraktivitas atau login ulang dengan sandi baru. | **High** | Not Tested | |

---

### 7.3 Modul 3: Dashboard Waka & Konfigurasi Akademik (`TC-WAKA`)

- [ ] **TC-WAKA-001** — Akurasi Kartu Statistik Ringkasan Master Data di Dashboard Waka
- [ ] **TC-WAKA-002** — Pergantian Putaran Jadwal Aktif (Cycle 1–4) dengan Konfirmasi Password
- [ ] **TC-WAKA-003** — Penolakan Pergantian Putaran Jadwal jika Password Waka Salah
- [ ] **TC-WAKA-004** — Pergantian Status Hari Senin (Upacara Bendera vs KBM Normal)
- [ ] **TC-WAKA-005** — Perubahan Tahun Ajaran & Semester Aktif serta Sinkronisasi ke TopBar Seluruh User
- [ ] **TC-WAKA-006** — Pencatatan Riwayat Pergantian Siklus (*Cycle History*)
- [ ] **TC-WAKA-007** — Pemantauan Daftar Keterlambatan Jurnal (`Missing Journals`) di Dashboard Waka

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-WAKA-001** | Waka | Dashboard Waka (`/web/dashboard`) | **[Positif / Integrasi]** Memeriksa kesesuaian angka pada 6 kartu ringkasan (Kelas, Ruang, Mapel, Guru, Siswa, Jadwal) dengan jumlah riil di Master Data | Login sebagai Waka | 1. Buka `/web/dashboard` dan catat angka pada ke-6 kartu.<br>2. Buka `/web/master-data` dan cocokkan jumlah tab Kelas, Ruang, Mapel, Guru, dan Siswa. | Data di DB (`48 kelas`, dll.) | Seluruh angka pada kartu statistik Dashboard Waka sama persis dengan jumlah data aktif (tidak termasuk data di Tempat Sampah). | **High** | Not Tested | |
| **TC-WAKA-002** | Waka | Dashboard Waka (`/web/dashboard`) | **[Positif / Integrasi]** Mengubah Putaran Jadwal Aktif dari Putaran 1 ke Putaran 2 | Putaran aktif saat ini = 1 | 1. Di `/web/dashboard`, pilih **Putaran 2** pada kontrol Putaran Jadwal.<br>2. Masukkan kata sandi Waka pada modal konfirmasi lalu klik **Konfirmasi**.<br>3. Login sebagai Guru dan Siswa di tab browser lain, periksa jadwal yang tampil. | Target Cycle: `2`, Password Waka valid | Putaran aktif berubah menjadi **Putaran 2**, tercatat di *Riwayat Pergantian Putaran*, dan jadwal default Guru/Siswa beralih ke Putaran 2. | **Critical** | Not Tested | |
| **TC-WAKA-003** | Waka | Dashboard Waka (`/web/dashboard`) | **[Negatif]** Mengubah Putaran Jadwal dengan kata sandi Waka yang salah | Modal konfirmasi password terbuka | 1. Pilih Putaran 3.<br>2. Masukkan password `salah123` lalu klik **Konfirmasi**. | Password: `salah123` | Perubahan ditolak (HTTP 422/403), pesan kesalahan tampil di dalam modal, dan putaran tetap pada nilai semula. | **High** | Not Tested | |
| **TC-WAKA-004** | Waka | Dashboard Waka (`/web/dashboard`) | **[Positif / Integrasi]** Mengubah status Hari Senin antara "Minggu Upacara" dan "KBM Normal" | Login sebagai Waka | 1. Klik toggle/tombol ubah status Hari Senin di `/web/dashboard`.<br>2. Masukkan password Waka.<br>3. Buka `/web/schedules`, filter hari **Senin**, dan amati baris jam ke-1 / kegiatan pagi. | `monday_is_upacara`: `true` $\leftrightarrow$ `false` | Status berhasil diperbarui; tampilan slot waktu pagi hari Senin pada tabel jadwal menyesuaikan secara dinamis. | **High** | Not Tested | |
| **TC-WAKA-005** | Waka | Dashboard Waka & TopBar | **[Positif / Integrasi]** Mengubah Tahun Ajaran & Semester Aktif dan memverifikasi perubahan di `TopBar` | Login sebagai Waka | 1. Di `/web/dashboard`, klik tombol edit Tahun Ajaran.<br>2. Ubah menjadi `2026/2027` dan Semester `Genap`.<br>3. Konfirmasi dengan password Waka.<br>4. Refresh halaman atau login ulang, lalu periksa badge di `TopBar`. | Tahun: `2026/2027`, Semester: `Genap` | Data `SystemConfiguration` diperbarui; badge di kanan atas `TopBar` menampilkan `2026/2027 Genap` untuk seluruh role. | **High** | Not Tested | Kembalikan ke `2025/2026 Ganjil` setelah uji |
| **TC-WAKA-006** | Waka | Dashboard Waka (`/web/dashboard`) | **[Positif]** Memeriksa tabel Riwayat Pergantian Putaran setelah mengubah siklus | TC-WAKA-002 telah dijalankan | 1. Lihat tabel **Riwayat Pergantian Putaran** di bagian bawah `/web/dashboard`. | Data histori siklus | Baris baru muncul menampilkan putaran sebelumnya, putaran baru, nama eksekutor (Waka), serta waktu perubahan secara akurat. | **Medium** | Not Tested | |
| **TC-WAKA-007** | Waka | Dashboard Waka (`/web/dashboard`) | **[Positif]** Memantau daftar jadwal yang terlambat mengisi jurnal (> 30 menit setelah jam selesai) | Terdapat jadwal hari ini yang jamnya sudah lewat > 30 menit tanpa jurnal `completed` | 1. Buka `/web/dashboard` pada jam sekolah setelah sesi KBM berakhir.<br>2. Periksa panel peringatan keterlambatan jurnal. | Jadwal tanpa jurnal selesai | Daftar kelas, mata pelajaran, dan nama guru yang belum menyelesaikan jurnal tampil dengan akurat. | **Medium** | Not Tested | |

---

### 7.4 Modul 4: Master Data, Import Excel & Penugasan Guru (`TC-MAST`)

- [ ] **TC-MAST-001** — CRUD Master Data Kelas (Tambah, Edit, Validasi Duplikat Nama Kelas)
- [ ] **TC-MAST-002** — CRUD Master Data Ruangan (Teori vs Lab & Kapasitas)
- [ ] **TC-MAST-003** — CRUD Master Data Mata Pelajaran (Validasi Kode Mapel Unik)
- [ ] **TC-MAST-004** — Tambah Guru Manual & Tampilan Modal Kredensial Password Awal
- [ ] **TC-MAST-005** — Import Guru dari File Excel Resmi & Penanganan Baris Duplikat
- [ ] **TC-MAST-006** — Import Guru dengan Format File Salah (`.pdf` / `.csv` / Kolom Rusak)
- [ ] **TC-MAST-007** — Tambah Siswa Manual & Pembuatan Otomatis Akun Orang Tua (`ORTU-{NIS}`)
- [ ] **TC-MAST-008** — Import Siswa Massal dari File Excel & Sinkronisasi Kelas
- [ ] **TC-MAST-009** — Penugasan Wali Kelas Manual pada Tab Penugasan Guru
- [ ] **TC-MAST-010** — Pencegahan Satu Guru Menjadi Wali Kelas di Dua Rombel Berbeda
- [ ] **TC-MAST-011** — Penugasan Guru BK / Kesiswaan ke Beberapa Kelas Binaan
- [ ] **TC-MAST-012** — Riwayat Pergantian Wali Kelas per Rombel (`ClassAssignmentEditModal`)
- [ ] **TC-MAST-013** — Wizard Import Excel Penugasan Wali Kelas & Guru BK (`WALI KELAS.xlsx`)
- [ ] **TC-MAST-014** — Resolusi Manual Baris *Unmatched* pada Wizard Import Penugasan
- [ ] **TC-MAST-015** — Penghapusan Massal (*Bulk Delete*) Guru/Siswa dengan Laporan Berhasil vs Gagal
- [ ] **TC-MAST-016** — Fitur Reset Master Data dengan Konfirmasi Kata Sandi Waka

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-MAST-001** | Waka | Master Data Kelas (`/web/master-data`) | **[Positif & Negatif]** Menambah kelas baru, mengedit nama kelas, dan mencoba menambah nama kelas yang sudah ada | Login sebagai Waka, buka tab **Kelas** | 1. Klik **Tambah Kelas**, isi Nama `X RPL 9`, Tingkat `10`, lalu Simpan.<br>2. Klik ikon Edit pada `X RPL 9`, ubah menjadi `X RPL 10`, lalu Simpan.<br>3. Coba tambah kelas lagi dengan nama `X RPL 10` (duplikat). | Nama: `X RPL 9` $\rightarrow$ `X RPL 10`, Tingkat: `10` | Penambahan dan pengeditan berhasil; saat mencoba duplikat `X RPL 10`, sistem menolak (HTTP 422) dengan pesan nama kelas sudah terdaftar. | **High** | Not Tested | |
| **TC-MAST-002** | Waka | Master Data Ruangan (`/web/master-data`) | **[Positif & Batas]** Menambah ruangan teori dan laboratorium beserta validasi kapasitas | Buka tab **Ruangan** | 1. Klik **Tambah Ruangan**, isi Kode `R-99`, Nama `Lab Komputer Uji`, Tipe `lab`, Kapasitas `36`, lalu Simpan.<br>2. Coba tambah ruangan dengan kapasitas `-5` atau kosong. | Kode: `R-99`, Tipe: `lab`, Kapasitas: `36` vs `-5` | Ruangan `R-99` tersimpan; input kapasitas negatif atau kode duplikat ditolak oleh validasi. | **High** | Not Tested | |
| **TC-MAST-003** | Waka | Master Data Mapel (`/web/master-data`) | **[Positif & Negatif]** Menambah mata pelajaran baru dan menguji keunikan kode mapel | Buka tab **Mata Pelajaran** | 1. Klik **Tambah Mapel**, isi Kode `MPL-UJI`, Nama `Pemrograman Web Lanjut`, lalu Simpan.<br>2. Coba tambah mapel lain dengan kode `MPL-UJI`. | Kode: `MPL-UJI` | Mapel baru tersimpan; percobaan kode kembar ditolak dengan pesan validasi. | **High** | Not Tested | |
| **TC-MAST-004** | Waka | Master Data Guru (`/web/master-data`) | **[Positif]** Menambah akun guru secara manual dan memeriksa modal kredensial awal | Buka tab **Guru** | 1. Klik **Tambah Guru**.<br>2. Isi NIP `199001012026011099`, Nama `Budi Santoso, S.Kom.`, Kode Guru `BS99`.<br>3. Klik **Simpan**. | NIP: `199001012026011099`, Nama: `Budi Santoso, S.Kom.` | Akun guru berhasil dibuat dan `InitialCredentialModal` muncul menampilkan username/NIP beserta password acak awal yang dapat disalin. | **Critical** | Not Tested | Catat password awal untuk uji login |
| **TC-MAST-005** | Waka | Import Excel Guru (`/web/master-data`) | **[Positif / Integrasi]** Mengunduh template Excel Guru dan mengimpor data guru secara massal | Buka tab **Guru** | 1. Klik **Unduh Template** dan isi 3 baris data guru baru + 1 baris NIP yang sudah ada.<br>2. Klik **Import Excel**, pilih file tersebut, dan proses. | File `.xlsx` berisi 3 guru baru & 1 duplikat | Sistem berhasil mengimpor guru baru, memperbarui/melewati data duplikat sesuai aturan, dan menampilkan ringkasan hasil import beserta daftar kredensial awal. | **High** | Not Tested | |
| **TC-MAST-006** | Waka | Import Excel Guru/Siswa | **[Negatif]** Mengunggah file bukan Excel (`.pdf` / `.jpg`) atau file Excel dengan header kolom tidak sesuai | Modal Import terbuka | 1. Pilih file `.pdf` atau file Excel kosong tanpa header standar.<br>2. Klik **Upload / Import**. | File `dokumen.pdf` / Excel salah format | Sistem menolak file (HTTP 422) dengan pesan error validasi format berkas tanpa menyebabkan server *crash* (HTTP 500). | **Medium** | Not Tested | |
| **TC-MAST-007** | Waka | Master Data Siswa (`/web/master-data`) | **[Positif / Integrasi]** Menambah siswa baru dan memverifikasi pembuatan otomatis akun Orang Tua | Buka tab **Siswa** | 1. Klik **Tambah Siswa**.<br>2. Isi NIS `998877`, Nama `Andi Pratama`, Jenis Kelamin `L`, Kelas `X RPL 1`.<br>3. Simpan dan periksa modal kredensial awal. | NIS: `998877`, Nama: `Andi Pratama` | Akun Siswa (`998877`) DAN akun Orang Tua (`ORTU-998877`) yang tertaut (`linked_student_id`) otomatis terbentuk beserta password awalnya. | **Critical** | Not Tested | |
| **TC-MAST-008** | Waka | Import Excel Siswa (`/web/master-data`) | **[Positif / Batas]** Mengimpor ratusan data siswa dari Excel dan memverifikasi pemetaan kelas otomatis | Buka tab **Siswa** | 1. Klik **Import Siswa**, unggah file Excel daftar siswa per rombel.<br>2. Amati proses dan ringkasan hasil import. | File Excel Siswa resmi | Siswa berhasil masuk ke kelas masing-masing, jumlah siswa pada tab Kelas bertambah, dan akun `ORTU-{NIS}` terbuat otomatis. | **High** | Not Tested | |
| **TC-MAST-009** | Waka | Penugasan Guru (`/web/master-data`) | **[Positif]** Menetapkan Wali Kelas pada suatu rombel melalui `ClassAssignmentEditModal` | Buka tab **Penugasan Guru** | 1. Klik tombol **Kelola / Edit** pada baris kelas `X RPL 1`.<br>2. Pilih guru yang belum menjadi wali kelas pada dropdown **Wali Kelas**.<br>3. Klik **Simpan Wali Kelas**. | Kelas: `X RPL 1`, Guru: `Budi Santoso, S.Kom.` | Guru berhasil ditetapkan sebagai Wali Kelas `X RPL 1`, tabel matriks penugasan terupdate, dan kartu statistik *"Kelas Memiliki Wali"* bertambah. | **High** | Not Tested | |
| **TC-MAST-010** | Waka | Penugasan Guru (`/web/master-data`) | **[Negatif / Batas]** Mencoba menugaskan guru yang sudah menjadi Wali Kelas di kelas A untuk menjadi Wali Kelas di kelas B | Guru X sudah menjadi Wali Kelas di `X RPL 1` | 1. Buka modal edit penugasan pada kelas `X RPL 2`.<br>2. Buka dropdown **Wali Kelas** dan cari nama Guru X. | Guru X (Wali Kelas `X RPL 1`) | Nama Guru X berstatus *disabled* dengan keterangan `(Sudah Wali Kelas di X RPL 1)` dan backend menolak jika dipaksa via API (HTTP 422). | **High** | Not Tested | |
| **TC-MAST-011** | Waka | Penugasan Guru (`/web/master-data`) | **[Positif]** Menambahkan dan mencabut penugasan Guru BK / Kesiswaan pada suatu kelas | Modal edit penugasan kelas terbuka | 1. Pilih seorang guru pada dropdown **Tambah Guru BK** lalu klik **Tambah**.<br>2. Pastikan nama guru masuk ke daftar BK kelas tersebut.<br>3. Klik tombol hapus/cabut pada daftar BK jika ingin melepas penugasan. | Guru BK terpilih | Satu guru BK dapat ditugaskan ke banyak kelas sekaligus; penambahan dan pencabutan langsung tercermin pada matriks dan hak akses akun guru tersebut. | **High** | Not Tested | |
| **TC-MAST-012** | Waka | Penugasan Guru (`/web/master-data`) | **[Positif]** Memeriksa pencatatan Riwayat Pergantian Wali Kelas ketika wali kelas diganti | Kelas `X RPL 1` sudah memiliki Wali Kelas A | 1. Buka modal edit penugasan `X RPL 1`.<br>2. Ganti Wali Kelas dari Guru A ke Guru B lalu simpan.<br>3. Lihat bagian **Riwayat Penugasan Kelas Ini** di dalam modal. | Pergantian Guru A $\rightarrow$ Guru B | Riwayat mencatat tanggal selesai Guru A dan tanggal aktif Guru B secara akurat tanpa merusak histori jurnal lama. | **Medium** | Not Tested | |
| **TC-MAST-013** | Waka | Import Excel Penugasan (`/web/master-data`) | **[Positif / Integrasi]** Mengimpor file `WALI KELAS 2026.2027.xlsx` menggunakan Wizard Import 3-Tier | Buka tab **Penugasan Guru**, file Excel tersedia | 1. Klik tombol **Import Excel Penugasan**.<br>2. Unggah file `.xlsx` resmi sekolah.<br>3. Tinjau tabel pratinjau pencocokan otomatis (Kelas, Wali Kelas, Guru BK).<br>4. Klik **Konfirmasi & Terapkan Penugasan**. | File `WALI KELAS 2026.2027.xlsx` | Seluruh 48 rombel kelas berhasil dipetakan dengan Wali Kelas dan Guru BK masing-masing dalam satu transaksi atomik. | **High** | Not Tested | |
| **TC-MAST-014** | Waka | Import Excel Penugasan (`/web/master-data`) | **[Batas / Integrasi]** Melakukan pemetaan manual (*manual mapping*) pada baris yang berstatus *Unmatched / Perlu Review* saat pratinjau import | Terdapat nama guru di Excel dengan ejaan berbeda dari DB | 1. Saat berada di langkah Pratinjau Wizard Import, cari baris berstatus kuning/merah.<br>2. Pilih guru yang sesuai melalui dropdown resolusi manual pada baris tersebut.<br>3. Lanjutkan **Commit**. | Baris *unmatched* | Status baris berubah menjadi *Siap Disimpan* dan data penugasan berhasil di-commit ke guru yang dipilih. | **Medium** | Not Tested | |
| **TC-MAST-015** | Waka | Master Data Guru/Siswa | **[Positif & Integrasi]** Menghapus beberapa data sekaligus (*Bulk Delete*) ketika sebagian data memiliki jadwal KBM aktif | Buka tab **Guru**, pilih 2 guru (1 guru tanpa jadwal, 1 guru punya jadwal aktif) | 1. Centang checkbox pada kedua baris guru.<br>2. Klik **Hapus Terpilih**, konfirmasi dialog, dan masukkan password Waka.<br>3. Periksa modal **Laporan Penghapusan Massal**. | 1 Guru bebas relasi + 1 Guru punya jadwal | Sistem menghapus guru yang bebas relasi, memblokir penghapusan guru yang masih punya jadwal aktif, dan menampilkan modal laporan (`1 berhasil, 1 gagal beserta alasannya`). | **High** | Not Tested | |
| **TC-MAST-016** | Waka | Reset Master Data (`/web/master-data`) | **[Negatif & Keamanan]** Menguji proteksi kata sandi pada fitur Reset Master Data | Buka `/web/master-data` | 1. Klik tombol **Reset Master Data** (jika diuji, gunakan password salah terlebih dahulu).<br>2. Masukkan password yang salah dan klik konfirmasi. | Password: `salah123` | Sistem menolak eksekusi reset (HTTP 422/403) dan seluruh data master tetap aman. *(Jangan jalankan dengan password benar pada DB produksi!).* | **Critical** | Not Tested | Hati-hati: Fitur destruktif |

---

### 7.5 Modul 5: Smart Delete & Tempat Sampah / Recycle Bin (`TC-TRSH`)

- [ ] **TC-TRSH-001** — Penolakan Hapus Entitas yang Memiliki Ketergantungan Aktif (`DeleteConflictDialog`)
- [ ] **TC-TRSH-002** — Penghapusan Lunak (*Soft Delete*) Entitas ke Tempat Sampah
- [ ] **TC-TRSH-003** — Filter Daftar Tempat Sampah Berdasarkan Jenis Entitas
- [ ] **TC-TRSH-004** — Pemulihan Data (*Restore*) dari Tempat Sampah
- [ ] **TC-TRSH-005** — Hapus Permanen (*Force Delete*) dengan Proteksi Password & Riwayat Legal
- [ ] **TC-TRSH-006** — Penolakan Hapus Permanen jika Kata Sandi Waka Salah

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-TRSH-001** | Waka | Smart Delete (`/web/master-data`) | **[Negatif / Integrasi]** Mencoba menghapus Kelas, Ruangan, Mapel, atau Guru yang masih terikat pada Jadwal KBM aktif | Entitas memiliki relasi di tabel `schedules` | 1. Pada tab Kelas/Guru/Ruangan/Mapel, klik ikon **Hapus (Trash)** pada item yang sedang dipakai di jadwal.<br>2. Amati dialog yang muncul. | Kelas/Guru yang memiliki jadwal aktif | Sistem memanggil `/api/master/{entity}/{id}/dependencies` dan menampilkan `DeleteConflictDialog` yang merinci jumlah jadwal/siswa terkait serta menolak penghapusan. | **Critical** | Not Tested | |
| **TC-TRSH-002** | Waka | Smart Delete (`/web/master-data`) | **[Positif]** Menghapus entitas yang tidak memiliki halangan relasi aktif sehingga pindah ke Tempat Sampah | Data uji (`X RPL 10` atau Guru Uji) tidak punya jadwal aktif | 1. Klik ikon **Hapus** pada `X RPL 10`.<br>2. Konfirmasi pada `DeleteConfirmationModal`.<br>3. Periksa angka badge pada tab **Tempat Sampah**. | Kelas `X RPL 10` | Item hilang dari tab Kelas utama, angka badge tab **Tempat Sampah** bertambah 1, dan kolom `deleted_at` terisi di database. | **High** | Not Tested | |
| **TC-TRSH-003** | Waka | Tempat Sampah (`/web/master-data`) | **[Positif]** Memfilter isi Tempat Sampah berdasarkan jenis entitas (Kelas, Ruang, Mapel, Guru, Siswa) | Terdapat beberapa jenis data di Tempat Sampah | 1. Buka tab **Tempat Sampah**.<br>2. Pilih filter kategori satu per satu dan gunakan kotak pencarian. | Filter: `Semua`, `Kelas`, `Guru`, `Siswa` | Tabel hanya menampilkan item yang sesuai dengan filter kategori dan kata kunci pencarian. | **Low** | Not Tested | |
| **TC-TRSH-004** | Waka | Tempat Sampah (`/web/master-data`) | **[Positif / Integrasi]** Memulihkan (*Restore*) data dari Tempat Sampah kembali ke daftar aktif | `X RPL 10` atau `Guru Uji` berada di Tempat Sampah | 1. Pada tab **Tempat Sampah**, klik tombol **Pulihkan (Restore)** pada baris `X RPL 10`.<br>2. Buka kembali tab **Kelas**. | Item di Tempat Sampah | Item keluar dari Tempat Sampah, kembali muncul di tab **Kelas** dalam keadaan utuh, dan jika item tersebut adalah Guru/Siswa maka akunnya bisa login kembali. | **High** | Not Tested | |
| **TC-TRSH-005** | Waka | Tempat Sampah (`/web/master-data`) | **[Positif / Keamanan]** Menghapus data secara permanen (*Force Delete*) dari Tempat Sampah dengan konfirmasi password Waka | Item uji tanpa riwayat jurnal legal berada di Tempat Sampah | 1. Klik tombol **Hapus Permanen** pada item uji di tab Tempat Sampah.<br>2. Masukkan kata sandi Waka pada `PasswordModal` lalu konfirmasi. | Item uji + Password Waka valid | Baris data benar-benar dihapus dari tabel database (`forceDelete`) dan tidak lagi muncul di Tempat Sampah. | **High** | Not Tested | |
| **TC-TRSH-006** | Waka | Tempat Sampah (`/web/master-data`) | **[Negatif / Integrasi]** Mencoba *Force Delete* dengan password salah atau pada akun yang memiliki riwayat jurnal/presensi legal | Item berada di Tempat Sampah | 1. Klik **Hapus Permanen**, masukkan password salah → pastikan gagal.<br>2. Periksa peringatan `has_legal_history` pada item yang pernah memiliki riwayat akademik. | Password salah | Penghapusan permanen dibatalkan dan data tetap berada di Tempat Sampah. | **High** | Not Tested | |

---

### 7.6 Modul 6: Manajemen Jadwal & Import PDF Jadwal (`TC-SCHD`)

- [ ] **TC-SCHD-001** — Pengecekan Prasyarat Master Data Sebelum Menambah Jadwal
- [ ] **TC-SCHD-002** — Menambahkan Jadwal Pelajaran Baru Secara Manual dengan Konfirmasi Password
- [ ] **TC-SCHD-003** — Deteksi Bentrok Guru (*Teacher Conflict*) pada Hari, Siklus, dan Jam yang Sama
- [ ] **TC-SCHD-004** — Deteksi Bentrok Ruangan (*Room Conflict*) pada Hari, Siklus, dan Jam yang Sama
- [ ] **TC-SCHD-005** — Deteksi Bentrok Jam Kelas (*Class Period Overlap*)
- [ ] **TC-SCHD-006** — Mengedit & Menghapus Slot Jadwal dengan Konfirmasi Password
- [ ] **TC-SCHD-007** — Filter Matriks Jadwal Berdasarkan Putaran (1–4), Tingkat, Kelas, dan Hari
- [ ] **TC-SCHD-008** — Unggah & Ekstraksi Dokumen PDF Jadwal Pelajaran Resmi
- [ ] **TC-SCHD-009** — Resolusi Baris *Unmatched / Conflict* & *Bulk Teacher Resolution* pada Import Jadwal
- [ ] **TC-SCHD-010** — Konfirmasi (*Commit*) Hasil Import Jadwal ke Database dengan Password Waka
- [ ] **TC-SCHD-011** — Pembatalan / Penghapusan Sesi Draft Import Jadwal

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-SCHD-001** | Waka | Manajemen Jadwal (`/web/schedules`) | **[Batas]** Peringatan prasyarat jika salah satu Master Data (Kelas/Ruang/Mapel/Guru) masih 0 | Master data terisi lengkap (atau simulasi kosong) | 1. Buka `/web/schedules`.<br>2. Periksa fungsi `checkMasterDataPrerequisites`. | Master Data aktif | Jika seluruh master data tersedia, tombol **Tambah Jadwal** aktif. Jika ada yang kosong, muncul peringatan prasyarat yang mengarahkan ke Master Data. | **Medium** | Not Tested | |
| **TC-SCHD-002** | Waka | Manajemen Jadwal (`/web/schedules`) | **[Positif]** Menambahkan jadwal pelajaran baru pada slot kosong dengan konfirmasi password Waka | Buka `/web/schedules` | 1. Klik **Tambah Jadwal** (atau klik sel kosong pada tabel).<br>2. Pilih Putaran `1`, Hari `Senin`, Jam Mulai `1`, Durasi `2 JP`, Kelas `X RPL 1`, Mapel, Guru, dan Ruangan yang tidak bentrok.<br>3. Klik Simpan, masukkan password Waka pada `PasswordModal`, lalu konfirmasi. | Slot bebas bentrok + Password Waka | Jadwal berhasil disimpan (HTTP 201), langsung tampil sebagai kartu jadwal pada matriks kelas `X RPL 1` beserta rentang waktu (`07:00 - 08:30`). | **Critical** | Not Tested | |
| **TC-SCHD-003** | Waka | Manajemen Jadwal (`/web/schedules`) | **[Negatif / Integrasi]** Menjadwalkan Guru yang sama di dua kelas berbeda pada Putaran, Hari, dan Jam yang beririsan | Guru A sudah mengajar di `X RPL 1` pada Senin Putaran 1 Jam 1–2 | 1. Tambah jadwal baru untuk kelas `X RPL 2` pada Senin Putaran 1 Jam 2–3 dengan memilih **Guru A**.<br>2. Amati peringatan bentrok di UI dan coba simpan ke backend. | Guru A pada jam beririsan | Sistem mendeteksi tabrakan jadwal guru (baik melalui `detectScheduleConflicts` di UI maupun validasi 422 di `ScheduleController`). | **Critical** | Not Tested | |
| **TC-SCHD-004** | Waka | Manajemen Jadwal (`/web/schedules`) | **[Negatif / Integrasi]** Menjadwalkan Ruangan yang sama untuk dua kelas berbeda pada waktu yang beririsan | Ruang `R-01` sudah dipakai `X RPL 1` pada Senin Putaran 1 Jam 1–2 | 1. Tambah jadwal untuk `X RPL 2` pada Senin Putaran 1 Jam 1–2 menggunakan Ruang `R-01`. | Ruang `R-01` pada jam sama | Sistem menandai adanya bentrok ruangan (*Room Conflict*) dan mencegah duplikasi pemakaian ruang fisik. | **High** | Not Tested | |
| **TC-SCHD-005** | Waka | Manajemen Jadwal (`/web/schedules`) | **[Negatif / Batas]** Menambahkan jadwal yang menumpuk pada jam pelajaran yang sudah terisi di kelas yang sama | `X RPL 1` sudah memiliki jadwal Senin Jam 1–3 | 1. Coba tambahkan jadwal lain untuk `X RPL 1` pada Senin Jam 2–4. | Kelas `X RPL 1`, Jam 2–4 | Sistem menolak atau menandai bentrok slot waktu pada kelas yang sama. | **High** | Not Tested | |
| **TC-SCHD-006** | Waka | Manajemen Jadwal (`/web/schedules`) | **[Positif]** Mengedit durasi/ruangan jadwal dan menghapus jadwal dengan konfirmasi password | Terdapat kartu jadwal pada matriks | 1. Klik kartu jadwal pada matriks untuk membuka modal Edit.<br>2. Ubah ruangan atau durasi, simpan dengan password Waka.<br>3. Buka kembali kartu jadwal uji, klik **Hapus**, dan konfirmasi dengan password Waka. | Kartu jadwal uji | Pembaruan dan penghapusan jadwal berjalan mulus dan tampilan matriks langsung tersinkronisasi. | **High** | Not Tested | |
| **TC-SCHD-007** | Waka | Manajemen Jadwal (`/web/schedules`) | **[Positif]** Memfilter matriks jadwal berdasarkan Putaran (1–4), Tingkat (10/11/12), Kelas, Hari, dan Pencarian | Jadwal tersedia di database | 1. Klik tab Putaran 1, 2, 3, dan 4 secara bergantian.<br>2. Pilih Tingkat `11`, pilih Hari `Jumat`, dan ketik nama guru/mapel di kolom cari.<br>3. Klik tombol **Reset Filter**. | Berbagai kombinasi filter | Tabel menampilkan transisi halus tanpa *flicker*, memfilter kartu jadwal secara tepat, dan menampilkan baris istirahat (`ScheduleBreakRow`) sesuai hari. | **Medium** | Not Tested | |
| **TC-SCHD-008** | Waka | Import Jadwal PDF (`/web/schedule-import`) | **[Positif / Integrasi]** Mengunggah file PDF jadwal resmi sekolah untuk diekstrak menjadi baris pratinjau | File PDF jadwal standar sekolah tersedia | 1. Buka `/web/schedule-import`.<br>2. Pilih Putaran target dan unggah file PDF jadwal.<br>3. Tunggu proses ekstraksi selesai dan periksa halaman Review Import. | File `.pdf` jadwal pelajaran | Backend mengekstrak jadwal ke tabel `schedule_import_rows` dan mengelompokkan status menjadi *Matched, Unmatched, Conflict, atau Duplicate*. | **High** | Not Tested | |
| **TC-SCHD-009** | Waka | Review Import Jadwal (`/web/schedule-import/:id`) | **[Positif / Integrasi]** Menyelesaikan baris jadwal berstatus *Unmatched* secara individu maupun *Bulk Teacher Resolution* | Sesi import PDF memiliki baris *Unmatched* | 1. Pada halaman review import, klik tombol resolusi pada baris *Unmatched*.<br>2. Petakan kode/nama guru, mapel, atau ruangan ke data Master Data yang benar.<br>3. Gunakan fitur **Resolusi Guru Massal** untuk memetakan kode guru sekaligus. | Baris *Unmatched* | Seluruh baris yang dipetakan berubah status menjadi **Matched** (Hijau) dan siap di-commit. | **High** | Not Tested | |
| **TC-SCHD-010** | Waka | Review Import Jadwal (`/web/schedule-import/:id`) | **[Positif]** Mengonfirmasi (*Commit*) hasil import jadwal ke tabel jadwal utama dengan kata sandi Waka | Baris jadwal pada sesi import sudah *Matched* | 1. Klik tombol **Simpan / Commit Jadwal**.<br>2. Masukkan kata sandi Waka pada `PasswordModal`.<br>3. Periksa hasilnya di `/web/schedules`. | Password Waka valid | Seluruh baris jadwal yang *Matched* berhasil dimasukkan ke tabel `schedules` pada putaran terkait. | **High** | Not Tested | |
| **TC-SCHD-011** | Waka | Review Import Jadwal (`/web/schedule-import/:id`) | **[Positif]** Membatalkan/menghapus sesi import jadwal yang belum di-commit | Sesi draft import tersedia | 1. Klik tombol **Batalkan / Hapus Import** pada halaman review.<br>2. Konfirmasi dialog pembatalan. | Draft import ID | Sesi import dihapus dari database (`DELETE /api/schedule-imports/{id}`) tanpa memengaruhi jadwal aktif yang sudah ada. | **Low** | Not Tested | |

---

### 7.7 Modul 7: Kalender Akademik & Eksklusi KBM (`TC-CAL`)

- [ ] **TC-CAL-001** — Membuat Agenda Hari Libur Nasional (`scope_type = all`, `disables_teaching = true`)
- [ ] **TC-CAL-002** — Membuat Agenda Khusus Tingkat (`scope_type = grade`, misal Kelas 12 Ujian)
- [ ] **TC-CAL-003** — Membuat Agenda Khusus Rombel Tertentu (`scope_type = class`, misal Kunjungan Industri)
- [ ] **TC-CAL-004** — Membuat Kegiatan Sekolah Tanpa Meniadakan KBM (`disables_teaching = false`)
- [ ] **TC-CAL-005** — Validasi Tanggal Berakhir Tidak Boleh Lebih Awal dari Tanggal Mulai
- [ ] **TC-CAL-006** — Verifikasi Blokir Otomatis Pembukaan Jurnal KBM pada Kelas yang Terdampak Agenda Libur/Eksklusi
- [ ] **TC-CAL-007** — Mengedit & Menghapus Agenda Kalender Akademik

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-CAL-001** | Waka | Kalender Akademik (`/web/academic-calendar`) | **[Positif]** Menambahkan agenda Libur Nasional untuk seluruh sekolah yang meniadakan KBM | Login sebagai Waka, buka `/web/academic-calendar` | 1. Klik **Tambah Agenda**.<br>2. Isi Judul `Libur Hari Raya Uji`, Tipe `holiday`, Tanggal Mulai & Selesai = Hari Ini, Cakupan `Seluruh Sekolah (all)`, centang **Tiadakan KBM Reguler (`disables_teaching`)**.<br>3. Klik **Simpan**. | Tipe: `holiday`, Scope: `all`, Disables Teaching: `true` | Agenda tampil pada kalender bulan berjalan dan tercatat membebaskan seluruh kelas dari kewajiban KBM pada tanggal tersebut. | **Critical** | Not Tested | |
| **TC-CAL-002** | Waka | Kalender Akademik (`/web/academic-calendar`) | **[Positif]** Menambahkan agenda Ujian khusus tingkat kelas 12 (`scope_type = grade`) | Buka `/web/academic-calendar` | 1. Klik **Tambah Agenda**.<br>2. Isi Judul `Ujian Sekolah Kelas XII`, Tipe `exam`, Cakupan `Tingkat Kelas (grade)`, centang tingkat `12`, aktifkan `disables_teaching`.<br>3. Simpan. | Scope: `grade`, Target: `[12]` | Hanya jadwal kelas tingkat 12 yang berstatus *Dikecualikan dari KBM*, sedangkan kelas 10 dan 11 tetap melaksanakan KBM normal. | **High** | Not Tested | |
| **TC-CAL-003** | Waka | Kalender Akademik (`/web/academic-calendar`) | **[Positif]** Menambahkan agenda khusus untuk rombel tertentu (`scope_type = class`) | Buka `/web/academic-calendar` | 1. Klik **Tambah Agenda**.<br>2. Isi Judul `Kunjungan Industri X RPL 1`, Tipe `class_event`, Cakupan `Rombel Spesifik (class)`, pilih `X RPL 1`, aktifkan `disables_teaching`.<br>3. Simpan. | Scope: `class`, Target: `X RPL 1` | Hanya kelas `X RPL 1` yang dibebaskan dari KBM pada tanggal tersebut; kelas `X RPL 2` tetap wajib KBM. | **High** | Not Tested | |
| **TC-CAL-004** | Waka | Kalender Akademik (`/web/academic-calendar`) | **[Positif / Batas]** Menambahkan kegiatan sekolah dengan `disables_teaching = false` | Buka `/web/academic-calendar` | 1. Buat agenda `Sosialisasi Literasi Pagi`, Tipe `school_event`, matikan centang `disables_teaching`.<br>2. Simpan dan periksa jadwal guru. | Disables Teaching: `false` | Agenda tampil di kalender seluruh role sebagai informasi, namun jadwal KBM dan kewajiban isi jurnal guru **tetap aktif**. | **Medium** | Not Tested | |
| **TC-CAL-005** | Waka | Kalender Akademik (`/web/academic-calendar`) | **[Negatif / Batas]** Mengisi Tanggal Selesai lebih awal daripada Tanggal Mulai | Modal Tambah Agenda terbuka | 1. Isi Tanggal Mulai `2026-11-20` dan Tanggal Selesai `2026-11-15`.<br>2. Klik **Simpan**. | Start: `2026-11-20`, End: `2026-11-15` | Sistem menolak penyimpanan dan menampilkan pesan error validasi tanggal. | **Medium** | Not Tested | |
| **TC-CAL-006** | Guru / Waka | Integrasi Kalender $\rightarrow$ Jurnal (`/teacher/journal`) | **[Integrasi / Negatif]** Guru mencoba membuka sesi jurnal atau Kesiswaan menandai jam kosong pada kelas yang sedang terkena agenda eksklusi KBM | Agenda `disables_teaching = true` aktif hari ini untuk `X RPL 1` | 1. Login sebagai Guru pengampu `X RPL 1`.<br>2. Lihat badge status jadwal di `/teacher/dashboard` dan `/teacher/schedule`.<br>3. Buka `/teacher/journal` untuk jadwal tersebut atau tembak langsung `POST /api/journals`. | Jadwal kelas `X RPL 1` pada hari libur/eksklusi | UI menampilkan banner kuning **KBM Dikecualikan** beserta nama agenda; pemanggilan API `POST /api/journals` ditolak dengan HTTP 422 (`TEACHING_DISABLED_BY_EVENT`). | **Critical** | Not Tested | |
| **TC-CAL-007** | Waka | Kalender Akademik (`/web/academic-calendar`) | **[Positif]** Mengedit dan menghapus agenda kalender akademik | Agenda uji tersedia | 1. Klik tombol Edit pada agenda uji, ubah judulnya lalu simpan.<br>2. Klik tombol Hapus pada agenda uji lalu konfirmasi pada `ConfirmDialog`. | Agenda uji | Perubahan tersimpan dan setelah dihapus, status eksklusi KBM pada kelas terkait otomatis dicabut kembali menjadi normal. | **High** | Not Tested | |

---

### 7.8 Modul 8: Kenaikan Kelas & Tinggal Kelas (`TC-PROM`)

- [ ] **TC-PROM-001** — Pratinjau Pemetaan Otomatis Rombel (X → XI, XI → XII, XII → Lulus)
- [ ] **TC-PROM-002** — Menandai dan Membatalkan Status Siswa Tinggal Kelas (*Hold Back*)
- [ ] **TC-PROM-003** — Eksekusi Kenaikan Kelas Massal dengan Konfirmasi Kata Sandi Waka
- [ ] **TC-PROM-004** — Penolakan Eksekusi Kenaikan Kelas jika Kata Sandi Waka Salah
- [ ] **TC-PROM-005** — Verifikasi Riwayat Kelas Siswa (`StudentClassHistory`) & Status Alumni Kelas XII Setelah Promosi

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-PROM-001** | Waka | Kenaikan Kelas (`/web/grade-promotion`) | **[Positif]** Memeriksa tabel simulasi pemetaan kelas asal ke kelas tujuan berdasarkan tingkat dan jurusan | Login sebagai Waka, buka `/web/grade-promotion` | 1. Periksa daftar kelas Tingkat 10, 11, dan 12.<br>2. Klik salah satu kelas (misal `X RPL 1`) untuk melihat daftar siswa dan kolom transisi (`X RPL 1 → XI RPL 1`, `XII RPL 1 → Lulus`). | Rombel kelas 10, 11, dan 12 | Sistem memetakan kelas tujuan yang sejurusan secara akurat dan menampilkan jumlah siswa naik kelas vs lulus vs tinggal kelas. | **High** | Not Tested | |
| **TC-PROM-002** | Waka | Kenaikan Kelas (`/web/grade-promotion`) | **[Positif]** Menandai seorang siswa sebagai **Tinggal Kelas** dan membatalkannya kembali | Daftar siswa dalam kelas terbuka di `/web/grade-promotion` | 1. Centang checkbox **Tandai Tinggal Kelas** pada salah satu siswa.<br>2. Amati perubahan teks transisi menjadi `X RPL 1 → X RPL 1 (Tetap)` dan status `Tinggal Kelas` berwarna merah.<br>3. Hapus centang untuk mengembalikan ke status `Naik Kelas`. | Siswa uji | Status `is_held_back` tersimpan secara real-time ke server (`POST /api/students/{id}/hold-back`) dan angka penghitung siswa tinggal kelas terupdate. | **High** | Not Tested | |
| **TC-PROM-003** | Waka | Kenaikan Kelas (`/web/grade-promotion`) | **[Positif / Integrasi]** Mengeksekusi proses kenaikan kelas massal dengan kata sandi Waka | Pemetaan kelas sudah sesuai (disarankan diuji pada database staging/backup) | 1. Klik tombol **Proses Kenaikan Kelas**.<br>2. Isi Tahun Ajaran baru dan masukkan password Waka.<br>3. Konfirmasi eksekusi. | Tahun ajaran baru + Password Waka | Siswa tingkat 10 naik ke 11, tingkat 11 naik ke 12, tingkat 12 lulus/nonaktif, sedangkan siswa berstatus `is_held_back` tetap tinggal di tingkat kelas semula. | **Critical** | Not Tested | **Penting:** Backup DB sebelum uji ini |
| **TC-PROM-004** | Waka | Kenaikan Kelas (`/web/grade-promotion`) | **[Negatif]** Mengeksekusi kenaikan kelas dengan kata sandi Waka yang salah | Modal konfirmasi eksekusi terbuka | 1. Masukkan password `salah999` lalu klik konfirmasi. | Password: `salah999` | Eksekusi dibatalkan (HTTP 422/403) dan tidak ada satu pun data kelas siswa yang berubah. | **High** | Not Tested | |
| **TC-PROM-005** | Waka | Integrasi Kenaikan Kelas $\rightarrow$ Master Data | **[Integrasi]** Memeriksa pencatatan `student_class_histories` setelah kenaikan kelas dieksekusi | TC-PROM-003 telah dijalankan | 1. Buka `/web/master-data` tab **Siswa**.<br>2. Periksa kelas siswa yang baru dinaikkan dan riwayat kelasnya. | Data siswa pasca promosi | Kelas aktif siswa telah berpindah ke tingkat berikutnya dan histori kelas lama tercatat di tabel `student_class_histories`. | **Medium** | Not Tested | |


---

### 7.9 Modul 9: Jurnal KBM, Kamera & Presensi Siswa (`TC-JRNL`)

- [ ] **TC-JRNL-001** — Membuka Sesi Kelas KBM Baru (`POST /api/journals` Status `ongoing`)
- [ ] **TC-JRNL-002** — Sinkronisasi Otomatis Status Siswa yang Memiliki Izin Disetujui (`approved_leaves`) Saat Sesi Dibuka
- [ ] **TC-JRNL-003** — Pengambilan Foto Dokumentasi KBM Menggunakan Kamera Langsung (*Live WebRTC Camera*)
- [ ] **TC-JRNL-004** — Unggah File Foto Dokumentasi & Kompresi Otomatis di Sisi Klien (`compressImage`)
- [ ] **TC-JRNL-005** — Pencatatan Presensi *Exception-Based* (Hadir, Sakit, Izin, Alpa) & Catatan Siswa
- [ ] **TC-JRNL-006** — Validasi Batas Minimum Deskripsi Topik Materi (< 10 Karakter Ditolak)
- [ ] **TC-JRNL-007** — Validasi Wajib Unggah Foto Bukti Dokumentasi KBM Saat Menyelesaikan Jurnal
- [ ] **TC-JRNL-008** — Penyelesaian Jurnal KBM Atomik (`PUT /api/journals/{id}` Status `completed`)
- [ ] **TC-JRNL-009** — Melanjutkan Sesi Jurnal yang Masih Berstatus `ongoing` (*Resume Session*)
- [ ] **TC-JRNL-010** — Mode Guru Pengganti (*Substitute Teacher*) oleh Wali Kelas atau Tim Kesiswaan + Tampilan Tugas Titipan
- [ ] **TC-JRNL-011** — Penandaan Status Guru Berhalangan Hadir / Jam Kosong (`teacher_absent`) oleh Kesiswaan/Waka
- [ ] **TC-JRNL-012** — Penolakan Akses Jurnal oleh Guru Lain yang Bukan Pengampu, Bukan Wali Kelas, dan Bukan Kesiswaan

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-JRNL-001** | Guru | Jurnal KBM (`/teacher/journal`) | **[Positif]** Guru pengampu membuka sesi kelas KBM pada jadwal aktifnya | Login sebagai Guru; memiliki jadwal di kelas `X RPL 1` | 1. Dari `/teacher/dashboard` atau `/teacher/schedule`, klik **Isi Jurnal** pada jadwal `X RPL 1`.<br>2. Klik tombol **Mulai & Buka Kelas Sekarang**. | Jadwal aktif guru | Sesi jurnal berhasil dibuat dengan status `ongoing`, daftar seluruh siswa kelas `X RPL 1` dimuat dengan status default **Hadir**. | **Critical** | Not Tested | |
| **TC-JRNL-002** | Guru | Jurnal KBM (`/teacher/journal`) | **[Integrasi]** Siswa yang sudah memiliki surat izin `approved` pada hari tersebut otomatis terisi Sakit/Izin saat guru membuka kelas | Siswa A di `X RPL 1` memiliki izin `approved` kategori `sakit` hari ini | 1. Buka sesi kelas `X RPL 1` di `/teacher/journal`.<br>2. Cari baris nama Siswa A pada tabel presensi. | Siswa A dengan izin `approved` | Status presensi Siswa A otomatis terpilih **Sakit** (bukan Hadir) beserta badge indikator izin terverifikasi dari `meta.approved_leaves`. | **High** | Not Tested | |
| **TC-JRNL-003** | Guru | Kamera KBM (`/teacher/journal`) | **[Positif]** Mengambil foto dokumentasi kelas langsung dari kamera laptop/perangkat | Perangkat memiliki webcam/kamera & izin browser diberikan | 1. Pada form jurnal aktif, klik **Buka Kamera Langsung**.<br>2. Uji tombol ganti arah kamera (Depan/Belakang jika tersedia).<br>3. Klik **Ambil Foto**. | Tangkapan kamera WebRTC | Stream kamera berhenti otomatis setelah jepretan, pratinjau foto tampil di form beserta ukuran file hasil kompresi (dalam KB). | **High** | Not Tested | |
| **TC-JRNL-004** | Guru | Kompresi Foto (`/teacher/journal`) | **[Batas]** Mengunggah file foto beresolusi besar (misal 4 MB) dan memeriksa hasil kompresi klien | File foto `.jpg`/`.png` berukuran 3–5 MB | 1. Klik area unggah file foto KBM dan pilih foto berukuran 4 MB.<br>2. Periksa informasi ukuran file terkompresi di bawah pratinjau. | Foto 4 MB | Utilitas `compressImage` mengecilkan dimensi & ukuran file menjadi ratusan KB (~800–1280px JPEG) sehingga proses *upload* ke server cepat dan ringan. | **Medium** | Not Tested | |
| **TC-JRNL-005** | Guru | Presensi Siswa (`/teacher/journal`) | **[Positif]** Mengubah status kehadiran beberapa siswa menjadi Sakit, Izin, dan Alpa serta mengisi catatan perilaku/akademik siswa | Form jurnal terbuka | 1. Ubah Siswa 1 menjadi **Sakit**, Siswa 2 **Izin**, Siswa 3 **Alpa**.<br>2. Ketik catatan pada kolom Catatan Siswa (baik pada siswa Hadir maupun Absen).<br>3. Amati perubahan angka ringkasan (`Hadir, Sakit, Izin, Alpa`) di bagian atas tabel. | 1 Sakit, 1 Izin, 1 Alpa + catatan teks | Angka penghitung `counts` berubah secara *real-time* sesuai jumlah masing-masing status. | **Critical** | Not Tested | |
| **TC-JRNL-006** | Guru | Validasi Jurnal (`/teacher/journal`) | **[Negatif / Batas]** Mencoba menyelesaikan jurnal dengan deskripsi topik materi kosong atau kurang dari 10 karakter | Form jurnal terbuka, foto sudah diunggah | 1. Ketik topik `Matematika` (9 karakter) atau kosongkan.<br>2. Klik **Simpan & Selesaikan Jurnal**. | Topik: `Matematika` (9 karakter) | Sistem menolak pengiriman dan menampilkan pesan *"Deskripsi topik materi pembelajaran wajib diisi minimal 10 karakter."* | **High** | Not Tested | |
| **TC-JRNL-007** | Guru | Validasi Jurnal (`/teacher/journal`) | **[Negatif]** Mencoba menyelesaikan jurnal tanpa melampirkan foto dokumentasi KBM | Form jurnal terbuka, topik sudah diisi $\ge$ 10 karakter, foto kosong | 1. Pastikan belum ada foto yang diambil/diunggah.<br>2. Klik **Simpan & Selesaikan Jurnal**. | Foto: `null` | Sistem menolak penyimpanan dan menampilkan pesan *"Wajib mengunggah minimal 1 foto bukti dokumentasi KBM."* | **High** | Not Tested | |
| **TC-JRNL-008** | Guru | Penyelesaian Jurnal (`/teacher/journal`) | **[Positif / Integrasi]** Menyimpan penyelesaian jurnal secara atomik dan melihat detail jurnal yang telah selesai | Topik $\ge$ 10 karakter, foto terunggah, presensi diatur | 1. Klik **Simpan & Selesaikan Jurnal**.<br>2. Pastikan layar konfirmasi penyelesaian tampil.<br>3. Kembali ke `/teacher/schedule`, pastikan badge jadwal berubah menjadi **Jurnal Selesai (Hijau)**.<br>4. Klik jadwal tersebut lalu klik **Lihat Detail Jurnal & Catatan Siswa**. | Topik: `bab 1 persamaan kuadrat dan latihan soal`, Foto JPEG, Presensi | Jurnal berstatus `completed`, hanya siswa yang tidak hadir/bercatatan yang disimpan ke tabel `attendances` (*exception-based*), dan foto bukti tampil dengan benar saat dilihat kembali. | **Critical** | Not Tested | |
| **TC-JRNL-009** | Guru | Resume Jurnal (`/teacher/journal`) | **[Positif / Kondisi Khusus]** Keluar dari halaman saat jurnal berstatus `ongoing`, lalu masuk kembali untuk melanjutkan pengisian | Guru sudah klik *Buka Kelas*, namun belum klik *Selesaikan Jurnal* | 1. Setelah klik *Mulai & Buka Kelas Sekarang*, pindah ke menu `/teacher/schedule`.<br>2. Pastikan status jadwal tertulis **Sedang Berlangsung (`ongoing`)**.<br>3. Klik kembali jadwal tersebut, lalu klik tombol **Lanjutkan Presensi & Jurnal**. | Jurnal berstatus `ongoing` | Sesi jurnal yang sama (`journalId` tetap) terbuka kembali tanpa membuat duplikat baris jurnal baru di database. | **High** | Not Tested | |
| **TC-JRNL-010** | Wali Kelas / Kesiswaan | Mode Guru Pengganti (`/teacher/journal`) | **[Positif / Integrasi]** Wali Kelas atau Guru Kesiswaan mengambil alih kelas yang gurunya sedang izin dan melihat **Tugas Titipan** | Guru asli telah mengajukan izin dengan instruksi tugas titipan pada jadwal tersebut | 1. Login sebagai Wali Kelas atau Guru Kesiswaan.<br>2. Buka jadwal kelas terkait.<br>3. Periksa kotak informasi **Tugas Titipan Guru Pengampu**.<br>4. Klik **Mulai Presensi & Ambil Alih Kelas**, isi presensi & foto, lalu selesaikan jurnal. | Akun Wali Kelas / Kesiswaan | Kotak tugas titipan beserta lampiran tampil jelas; jurnal tercatat dengan `substitute_teacher_id` berisi ID guru pengganti, dan topik boleh menggunakan teks default pendampingan. | **High** | Not Tested | |
| **TC-JRNL-011** | Kesiswaan / Waka | Jam Kosong (`/teacher/journal`) | **[Positif / Integrasi]** Menandai jadwal sebagai **Guru Berhalangan Hadir (`teacher_absent`)** baik sebelum maupun sesudah sesi dibuka | Login sebagai Kesiswaan atau Waka | 1. Buka jadwal kelas yang gurunya tidak hadir di `/teacher/journal`.<br>2. Klik tombol **Tandai Guru Berhalangan**.<br>3. Konfirmasi dialog peringatan.<br>4. Periksa status jadwal di `/teacher/schedule` dan `/web/monitoring`. | Jadwal tanpa guru hadir | Baik saat `journalId` masih `null` (via `POST /api/journals`) maupun sudah ada (via `PATCH /api/journals/{id}`), status berubah menjadi `teacher_absent` (badge merah **Guru Berhalangan**). | **Critical** | Not Tested | |
| **TC-JRNL-012** | Guru Lain | Hak Akses Jurnal (`/teacher/journal`) | **[Hak Akses / Negatif]** Guru biasa mencoba membuka atau mengisi jurnal milik guru lain di kelas yang bukan perwaliannya | Login sebagai Guru B (bukan pengampu jadwal, bukan Wali Kelas, bukan Kesiswaan) | 1. Oper objek jadwal milik Guru A ke `/teacher/journal` atau panggil `POST /api/journals` dengan `schedule_id` milik Guru A. | `schedule_id` milik Guru A | UI menampilkan halaman `ForbiddenState` (*Akses Ditolak*), dan backend mengembalikan HTTP 403. | **Critical** | Not Tested | |

---

### 7.10 Modul 10: Perizinan Siswa, Perizinan Guru & Verifikasi (`TC-LEAV`)

- [ ] **TC-LEAV-001** — Siswa Mengajukan Izin Tidak Masuk Sekolah (`tidak_masuk`) Beserta Bukti Surat
- [ ] **TC-LEAV-002** — Siswa Mengajukan Izin Keluar Jam Pelajaran (`izin_keluar`) dengan Rentang Jam Ke-X s/d Ke-Y
- [ ] **TC-LEAV-003** — Validasi Negatif Pengajuan Izin Siswa (Tanpa Lampiran / Jam Selesai < Jam Mulai)
- [ ] **TC-LEAV-004** — Siswa Mengedit atau Membatalkan Pengajuan Izin yang Masih `pending`
- [ ] **TC-LEAV-005** — Penolakan Edit/Hapus Izin Siswa Setelah Berstatus `approved` atau `rejected`
- [ ] **TC-LEAV-006** — Guru Mengajukan Izin Tidak Mengajar Beserta Pilihan Jadwal & Tugas Titipan (`/teacher/leave`)
- [ ] **TC-LEAV-007** — Verifikasi Setujui (`approved`) Izin Siswa oleh Guru Kesiswaan / Waka (`/teacher/permissions`)
- [ ] **TC-LEAV-008** — Verifikasi Tolak (`rejected`) Izin Siswa Beserta Alasan Penolakan Wajib
- [ ] **TC-LEAV-009** — Pratinjau & Unduh Dokumen Bukti Izin (Gambar & PDF) pada Halaman Verifikasi
- [ ] **TC-LEAV-010** — Verifikasi Setujui/Tolak Pengajuan Izin Guru oleh Waka / Kesiswaan
- [ ] **TC-LEAV-011** — Pembatasan Hak Akses Wali Kelas pada Halaman `/teacher/permissions` (Hanya Baca/Pantau, Tidak Bisa Klik Setujui/Tolak)

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-LEAV-001** | Siswa | Perizinan Siswa (`/student/permissions`) | **[Positif]** Mengajukan izin Tidak Masuk Sekolah (`sakit` / `izin`) dengan unggah foto surat dokter/orang tua | Login sebagai Siswa | 1. Buka `/student/permissions` lalu klik **Ajukan Izin Baru**.<br>2. Pilih Jenis `Tidak Masuk Sekolah`, Kategori `Sakit`, Tanggal Mulai & Selesai = Hari Ini.<br>3. Isi alasan dan unggah file gambar/PDF bukti.<br>4. Klik **Kirim Pengajuan**. | Jenis: `tidak_masuk`, Kategori: `sakit`, File: `surat_dokter.jpg` | Pengajuan berhasil disimpan dengan status **Menunggu Verifikasi (`pending`)** dan tampil pada tabel riwayat izin siswa. | **Critical** | Not Tested | |
| **TC-LEAV-002** | Siswa | Perizinan Siswa (`/student/permissions`) | **[Positif]** Mengajukan Izin Keluar Saat KBM (`izin_keluar`) pada jam pelajaran tertentu | Login sebagai Siswa | 1. Klik **Ajukan Izin Baru**.<br>2. Pilih Jenis `Izin Keluar Jam Pelajaran`, pilih Jam Mulai `3` sampai Jam Selesai `5`, isi alasan `Dispensasi Lomba`, dan unggah surat.<br>3. Klik **Kirim Pengajuan**. | Jenis: `izin_keluar`, Jam: `3 s/d 5` | Pengajuan tersimpan dengan informasi rentang jam pelajaran (`Jam ke-3 s/d ke-5`). | **High** | Not Tested | |
| **TC-LEAV-003** | Siswa | Perizinan Siswa (`/student/permissions`) | **[Negatif / Batas]** Mengajukan izin tanpa lampiran bukti atau mengisi Jam Selesai lebih kecil dari Jam Mulai (misal Jam 6 s/d Jam 2) | Modal Ajukan Izin terbuka | 1. Kosongkan file bukti lalu klik Kirim.<br>2. Pilih `izin_keluar`, isi Jam Mulai `6` dan Jam Selesai `2`, lalu klik Kirim. | Tanpa file; Jam `6` s/d `2` | Sistem menolak pengajuan dan menampilkan pesan validasi yang jelas pada kolom terkait. | **High** | Not Tested | |
| **TC-LEAV-004** | Siswa | Perizinan Siswa (`/student/permissions`) | **[Positif]** Membatalkan/menghapus pengajuan izin yang masih berstatus `pending` | Siswa memiliki pengajuan berstatus `pending` | 1. Pada baris izin berstatus `pending`, klik tombol **Hapus / Batalkan**.<br>2. Konfirmasi penghapusan. | Izin berstatus `pending` | Pengajuan izin berhasil dihapus dari daftar (`DELETE /api/leave-requests/{id}`). | **Medium** | Not Tested | |
| **TC-LEAV-005** | Siswa | Perizinan Siswa (`/student/permissions`) | **[Negatif / Hak Akses]** Mencoba menghapus pengajuan izin yang sudah disetujui (`approved`) atau ditolak (`rejected`) | Izin siswa sudah diverifikasi oleh Kesiswaan | 1. Periksa kolom aksi pada baris izin berstatus `approved` di UI.<br>2. Coba panggil `DELETE /api/leave-requests/{id}` secara paksa. | Izin berstatus `approved` | Tombol hapus tidak ditampilkan di UI, dan backend menolak penghapusan izin yang sudah diverifikasi (HTTP 422/403). | **High** | Not Tested | |
| **TC-LEAV-006** | Guru | Perizinan Guru (`/teacher/leave`) | **[Positif / Integrasi]** Guru mengajukan izin tidak mengajar dengan memilih jadwal terdampak dan melampirkan tugas titipan | Login sebagai Guru yang memiliki jadwal pada tanggal target | 1. Buka `/teacher/leave` lalu klik **Ajukan Izin Mengajar**.<br>2. Pilih Tanggal Izin (pastikan jadwal mengajar pada hari tersebut otomatis muncul).<br>3. Centang jadwal kelas yang ditinggalkan, pilih Kategori `dinas_luar`, isi Alasan, isi **Instruksi Tugas Titipan**, serta unggah surat tugas & file soal tugas.<br>4. Klik **Kirim Pengajuan**. | Tanggal aktif mengajar, Kategori: `dinas_luar`, Tugas titipan | Pengajuan izin guru berhasil dibuat berstatus `pending` beserta keterkaitan ke jadwal yang dipilih. | **High** | Not Tested | |
| **TC-LEAV-007** | Kesiswaan / Waka | Verifikasi Izin (`/teacher/permissions`) | **[Positif / Integrasi]** Menyetujui (`approved`) pengajuan izin siswa | Login sebagai Guru Kesiswaan atau Waka; terdapat izin siswa `pending` | 1. Buka `/teacher/permissions` tab **Perizinan Siswa**.<br>2. Filter status `Menunggu (Pending)`.<br>3. Klik tombol **Setujui (Centang)** pada baris pengajuan siswa. | Izin siswa `pending` | Status berubah menjadi **Disetujui (`approved`)**, tercatat nama verifikator (`verified_by`), dan izin tersebut langsung terintegrasi saat guru membuka jurnal kelas (lihat `TC-JRNL-002`). | **Critical** | Not Tested | |
| **TC-LEAV-008** | Kesiswaan / Waka | Verifikasi Izin (`/teacher/permissions`) | **[Positif & Negatif]** Menolak (`rejected`) pengajuan izin siswa dengan kewajiban mengisi alasan penolakan | Terdapat izin siswa `pending` | 1. Klik tombol **Tolak (X)** pada baris pengajuan izin.<br>2. Coba kirim penolakan dengan alasan kosong → pastikan ditolak.<br>3. Isi alasan penolakan `Surat bukti buram / tidak terbaca` lalu konfirmasi. | Alasan penolakan teks | Status berubah menjadi **Ditolak (`rejected`)** dan alasan penolakan dapat dilihat oleh Siswa maupun Orang Tua. | **High** | Not Tested | |
| **TC-LEAV-009** | Kesiswaan / Waka / Wali Kelas | Verifikasi Izin (`/teacher/permissions`) | **[Positif]** Membuka modal pratinjau dokumen bukti izin (Gambar `.jpg`/`.png` dan dokumen `.pdf`) | Pengajuan izin memiliki lampiran | 1. Klik tombol **Lihat Bukti (Ikon Mata)** pada baris perizinan.<br>2. Amati pemuatan dokumen di dalam modal dan uji tombol **Unduh / Buka di Tab Baru**. | Lampiran gambar & PDF | Dokumen berhasil dimuat melalui `getStorageUrl` (dengan *fallback* otomatis jika path berbeda) tanpa *broken image*. | **Medium** | Not Tested | |
| **TC-LEAV-010** | Kesiswaan / Waka | Verifikasi Izin Guru (`/teacher/permissions`) | **[Positif / Integrasi]** Menyetujui atau menolak pengajuan izin mengajar guru pada tab Perizinan Guru | Terdapat pengajuan izin guru berstatus `pending` | 1. Di `/teacher/permissions`, klik tab kategori **Perizinan Guru**.<br>2. Tinjau detail jadwal terdampak dan lampiran tugas titipan.<br>3. Klik **Setujui** atau **Tolak**. | Pengajuan izin guru `pending` | Status izin guru berubah menjadi `approved` / `rejected`, dan indikator di Dashboard Guru (`Sedang Izin`) ikut terupdate. | **High** | Not Tested | |
| **TC-LEAV-011** | Wali Kelas | Hak Akses Verifikasi (`/teacher/permissions`) | **[Hak Akses]** Wali Kelas (yang bukan Kesiswaan) membuka `/teacher/permissions` | Login sebagai Guru Wali Kelas murni | 1. Buka `/teacher/permissions`.<br>2. Periksa daftar siswa yang tampil dan kolom aksi. | Akun Wali Kelas `X RPL 1` | Hanya menampilkan siswa dari kelas binaannya (`X RPL 1`) dalam mode **Pantau Saja** (tombol Setujui/Tolak disembunyikan dan API `PATCH /api/leave-requests/{id}` menolak dengan HTTP 403 jika dipaksa). | **Critical** | Not Tested | |

---

### 7.11 Modul 11: Kuis Berbantuan AI & Penilaian Semantik (`TC-QUIZ`)

- [ ] **TC-QUIZ-001** — Guru Membuat Wadah Kuis Baru (Status `draft_review`)
- [ ] **TC-QUIZ-002** — Generator Soal via Prompt AI (Pilihan Ganda, Esai, dan Kombinasi) dengan Google Gemini
- [ ] **TC-QUIZ-003** — Validasi Komposisi Jumlah Soal Prompt AI (Jumlah PG + Esai $\neq$ Total Soal)
- [ ] **TC-QUIZ-004** — Generator Soal via Ekstraksi Dokumen (`.pdf` / `.docx` / `.txt`)
- [ ] **TC-QUIZ-005** — Menambah, Mengedit, dan Menghapus Butir Soal Secara Manual pada Pratinjau Kuis
- [ ] **TC-QUIZ-006** — Penolakan Publikasi Kuis yang Belum Memiliki Butir Soal (0 Soal)
- [ ] **TC-QUIZ-007** — Publikasi Kuis (`published`) agar Tampil di Halaman Siswa Kelas Terkait
- [ ] **TC-QUIZ-008** — Siswa Mengerjakan Kuis Aktif, Penyimpanan Draft `sessionStorage`, & Pengumpulan Jawaban
- [ ] **TC-QUIZ-009** — Pembatasan Maksimal Percobaan Pengerjaan Kuis (`max_attempts`) oleh Siswa
- [ ] **TC-QUIZ-010** — Penilaian Otomatis Pilihan Ganda & Koreksi Semantik Esai oleh AI (`GradeEssaySubmissionJob`)
- [ ] **TC-QUIZ-011** — Guru Meninjau Lembar Jawaban Siswa & Melakukan *Override* Nilai Manual
- [ ] **TC-QUIZ-012** — Publikasi Hasil Kuis (`published_result`) & Tampilan Rincian Nilai di Akun Siswa/Orang Tua

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-QUIZ-001** | Guru | Manajemen Kuis (`/teacher/quiz`) | **[Positif]** Membuat kuis baru untuk kelas yang diampu | Login sebagai Guru, buka `/teacher/quiz` | 1. Klik **Buat Kuis Baru**.<br>2. Isi Judul `Kuis Algoritma Dasar`, pilih Kelas `X RPL 1`, Tanggal Batas, dan Maksimal Percobaan `2`.<br>3. Klik **Simpan & Lanjutkan**. | Judul: `Kuis Algoritma Dasar`, Kelas: `X RPL 1` | Kuis berhasil dibuat dengan status `draft_review` dan modal Generator Soal langsung terbuka otomatis. | **High** | Not Tested | |
| **TC-QUIZ-002** | Guru | Generator Prompt AI (`/teacher/quiz`) | **[Positif / Integrasi]** Menghasilkan soal kombinasi (PG + Esai) secara otomatis menggunakan Google Gemini (`gemini-3.1-flash-lite`) | `AI_API_KEY` valid di `scp/.env`; modal generator terbuka | 1. Pilih tab **Prompt AI**.<br>2. Isi Instruksi Materi: `Konsep dasar variabel, tipe data, dan percabangan if-else dalam pemrograman`.<br>3. Pilih Tipe `Kombinasi`, Total Soal `5`, Jumlah PG `3`, Jumlah Esai `2`, Kesulitan `Sedang`.<br>4. Klik **Generate Soal dengan AI**. | Prompt pemrograman, 3 PG + 2 Esai | Dalam ~2–5 detik, AI menghasilkan tepat 3 soal PG (lengkap dengan opsi A–D & kunci jawaban) dan 2 soal Esai (lengkap dengan rubrik/kunci jawaban), lalu membuka modal Pratinjau Soal. | **Critical** | Not Tested | Prasyarat: Internet & `AI_API_KEY` aktif |
| **TC-QUIZ-003** | Guru | Generator Prompt AI (`/teacher/quiz`) | **[Negatif / Batas]** Mengisi jumlah PG + Esai yang tidak sama dengan Total Soal pada mode Kombinasi | Modal Generator Prompt terbuka | 1. Pilih Tipe `Kombinasi`, isi Total Soal `5`, Jumlah PG `2`, Jumlah Esai `2` (total 4 $\neq$ 5).<br>2. Periksa pesan error dan coba klik tombol Generate. | Total: `5`, PG: `2`, Esai: `2` | UI menampilkan peringatan komposisi tidak valid dan mencegah pengiriman request ke API. | **Medium** | Not Tested | |
| **TC-QUIZ-004** | Guru | Ekstraksi Dokumen AI (`/teacher/quiz`) | **[Positif / Integrasi]** Mengekstrak butir soal dari file materi/soal berbentuk `.pdf`, `.docx`, atau `.txt` | File dokumen materi/soal tersedia | 1. Pada modal generator, pilih tab **Ekstraksi Dokumen**.<br>2. Unggah file `.pdf` atau `.docx` materi pelajaran.<br>3. Atur jumlah soal yang diinginkan lalu klik **Ekstrak Soal**. | File `materi_jaringan.pdf` | Sistem mengekstrak teks dokumen, mengirimkan ke AI, dan menyimpan butir soal yang dihasilkan ke dalam kuis. | **High** | Not Tested | |
| **TC-QUIZ-005** | Guru | Kelola Butir Soal (`/teacher/quiz`) | **[Positif]** Menambah soal secara manual, mengedit teks/kunci jawaban soal hasil AI, dan menghapus butir soal | Modal Pratinjau / Kelola Soal terbuka | 1. Klik **Tambah Soal Manual**, isi pertanyaan PG/Esai baru lalu simpan.<br>2. Klik **Edit** pada salah satu soal hasil AI, ubah redaksi kalimatnya lalu simpan.<br>3. Klik **Hapus** pada satu butir soal. | Perubahan teks soal | Penambahan, pengeditan, dan penghapusan butir soal tersimpan secara persisten di database. | **High** | Not Tested | |
| **TC-QUIZ-006** | Guru | Publikasi Kuis (`/teacher/quiz`) | **[Negatif]** Mencoba mempublikasikan kuis yang masih memiliki 0 butir soal | Kuis baru dibuat tanpa soal | 1. Tutup modal generator tanpa membuat soal.<br>2. Klik tombol **Publikasikan** pada kuis yang memiliki `0 soal`. | Kuis dengan 0 soal | Sistem menolak publikasi (HTTP 422) dengan pesan *"Kuis belum memiliki butir soal. Harap tambahkan atau generate soal terlebih dahulu."* | **High** | Not Tested | |
| **TC-QUIZ-007** | Guru | Publikasi Kuis (`/teacher/quiz`) | **[Positif / Integrasi]** Mempublikasikan kuis yang sudah memiliki soal sehingga statusnya menjadi `published` | Kuis memiliki $\ge$ 1 butir soal | 1. Klik tombol **Publikasikan Kuis**.<br>2. Login sebagai Siswa di kelas `X RPL 1` dan buka `/student/Home` serta `/student/quiz`. | Kuis `X RPL 1` | Status kuis berubah menjadi `published`, dan kuis langsung tampil pada daftar asesmen aktif di akun siswa `X RPL 1` (serta tidak tampil di kelas lain). | **Critical** | Not Tested | |
| **TC-QUIZ-008** | Siswa | Pengerjaan Kuis (`/student/quiz`) | **[Positif]** Siswa membuka kuis, menjawab soal PG & Esai, berpindah nomor soal, dan mengumpulkan jawaban | Login sebagai Siswa `X RPL 1`; kuis berstatus `published` | 1. Buka `/student/quiz` dan klik **Kerjakan Kuis**.<br>2. Pilih opsi jawaban pada soal PG dan ketik jawaban uraian pada soal Esai.<br>3. Refresh halaman browser di tengah pengerjaan → pastikan jawaban yang sudah diketik tidak hilang (tersimpan di `sessionStorage`).<br>4. Klik **Kumpulkan Jawaban** dan konfirmasi. | Jawaban PG & Esai siswa | Jawaban terkirim ke server (`POST /api/quizzes/{id}/submissions`), draf `sessionStorage` dibersihkan, dan layar konfirmasi pengumpulan tampil. | **Critical** | Not Tested | |
| **TC-QUIZ-009** | Siswa | Batas Percobaan (`/student/quiz`) | **[Batas / Negatif]** Siswa mencoba mengerjakan ulang kuis ketika jatah `max_attempts` sudah habis | `max_attempts = 1` dan siswa sudah pernah submit 1 kali | 1. Setelah mengumpulkan kuis, coba klik atau panggil ulang endpoint submit kuis yang sama. | Percobaan ke-2 pada kuis `max_attempts = 1` | Sistem menolak pengumpulan ulang karena batas kesempatan pengerjaan telah tercapai. | **High** | Not Tested | |
| **TC-QUIZ-010** | Guru / Sistem | Koreksi AI (`/teacher/quiz`) | **[Positif / Integrasi]** Memeriksa hasil penilaian otomatis PG dan penilaian semantik Esai oleh AI | Siswa telah mengumpulkan kuis (TC-QUIZ-008) | 1. Login kembali sebagai Guru pengampu, buka `/teacher/quiz`.<br>2. Klik tombol ** Hasil / Submissions** pada kuis tersebut.<br>3. Klik **Detail Jawaban** pada nama siswa. | Lembar jawaban siswa | Soal PG dinilai secara eksak; soal Esai memperoleh skor poin dan paragraf **Analisis Semantik AI (`ai_feedback`)** yang menjelaskan alasan penilaian jawaban siswa. | **Critical** | Not Tested | |
| **TC-QUIZ-011** | Guru | Override Nilai (`/teacher/quiz`) | **[Positif]** Guru mengubah/menyesuaikan skor akhir siswa secara manual dan menambahkan catatan guru | Modal Detail Lembar Jawaban Siswa terbuka | 1. Pada bagian **Override Nilai & Catatan Guru**, ubah skor menjadi `95` dan isi catatan `Penjelasan logika sangat baik`.<br>2. Klik **Simpan Penyesuaian Nilai**. | Skor Override: `95`, Catatan Guru | Nilai `teacher_override_score` dan `final_score` diperbarui menjadi `95` beserta catatan guru. | **High** | Not Tested | |
| **TC-QUIZ-012** | Guru / Siswa / Ortu | Publikasi Hasil (`/teacher/quiz` & `/student/quiz`) | **[Positif / Integrasi]** Guru mengubah status kuis menjadi **Publikasikan Hasil (`published_result`)** dan siswa/orang tua melihat nilai akhir | Penilaian kuis selesai | 1. Sebagai Guru, klik **Publikasikan Hasil** pada kuis.<br>2. Login sebagai Siswa, buka `/student/quiz`, klik **Lihat Hasil**.<br>3. Login sebagai Orang Tua siswa tersebut, buka `/parent/monitoring` tab **Nilai Kuis**. | Status: `published_result` | Siswa dapat melihat nilai akhir, rincian benar/salah tiap soal, umpan balik AI, serta catatan guru; Orang Tua dapat melihat nilai kuis anaknya di portal monitoring. | **High** | Not Tested | |

---

### 7.12 Modul 12: Monitoring, Rekapitulasi & Portal Siswa/Orang Tua (`TC-MON`)

- [ ] **TC-MON-001** — Filter Rekap Presensi Siswa Berdasarkan Tanggal, Kelas, Status, dan Kata Kunci (`/web/monitoring`)
- [ ] **TC-MON-002** — Ekspor Data Rekap Presensi ke Berkas Excel (`.xlsx`)
- [ ] **TC-MON-003** — Rekapitulasi Harian Kepatuhan Jurnal KBM & Pratinjau Bukti Foto (`/web/monitoring` Tab Jurnal)
- [ ] **TC-MON-004** — Akurasi Persentase Kehadiran & Rincian Riwayat Presensi di Beranda Siswa (`/student/home`)
- [ ] **TC-MON-005** — Tampilan Jadwal Pelajaran Siswa Berdasarkan Siklus Aktif (`/student/schedule`)
- [ ] **TC-MON-006** — Sinkronisasi Data Anak Tertaut pada Portal Monitoring Orang Tua (`/parent/monitoring`)
- [ ] **TC-MON-007** — Penanganan Kondisi Akun Orang Tua yang Belum Ditautkan ke Siswa (`linked_student_id = null`)
- [ ] **TC-MON-008** — Filter Kalender Akademik Berdasarkan Anak pada Akun Orang Tua (`/parent/calendar`)

| Test Case ID | Role | Modul/Fitur | Skenario | Prasyarat | Langkah Pengujian | Data Uji | Hasil yang Diharapkan | Prioritas | Status | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| **TC-MON-001** | Waka / Kesiswaan | Monitoring & Rekap (`/web/monitoring`) | **[Positif]** Memfilter rekap ketidakhadiran siswa berdasarkan tanggal, kelas, dan status (Sakit/Izin/Alpa) | Terdapat data presensi hasil pengisian jurnal | 1. Buka `/web/monitoring` tab **Rekap Presensi**.<br>2. Pilih Tanggal hari ini, Kelas `X RPL 1`, dan Status `Sakit`.<br>3. Ketik nama siswa pada kolom pencarian. | Filter kombinasi | Tabel menampilkan daftar siswa yang sesuai dengan kriteria filter beserta informasi jam pelajaran, mata pelajaran, dan catatan guru. | **High** | Not Tested | |
| **TC-MON-002** | Waka / Kesiswaan | Ekspor Excel (`/web/monitoring`) | **[Positif]** Mengunduh laporan rekap presensi menjadi file Excel (`.xlsx`) | Tabel rekap presensi memiliki data | 1. Klik tombol **Export Excel** di kanan atas tabel `/web/monitoring`.<br>2. Buka file `.xlsx` yang terunduh di aplikasi spreadsheet. | Data tabel presensi | File `.xlsx` berhasil terunduh dan berisi kolom-kolom data presensi yang rapi serta sesuai dengan filter yang sedang aktif. | **Medium** | Not Tested | |
| **TC-MON-003** | Waka / Kesiswaan | Rekap Jurnal (`/web/monitoring`) | **[Positif]** Memeriksa rekap kepatuhan pengisian jurnal harian dan membuka foto bukti KBM | Buka `/web/monitoring`, klik tab **Rekap Jurnal KBM** | 1. Pilih tanggal pelaksanaan KBM.<br>2. Periksa kartu ringkasan (Total Sesi, Selesai, Berlangsung, Jam Kosong, Dikecualikan).<br>3. Klik tombol **Lihat Foto** pada baris jurnal yang sudah selesai. | Jurnal KBM harian | Statistik kepatuhan tampil akurat, deskripsi topik dapat diperluas (*expand*), dan modal foto dokumentasi KBM tampil dengan jelas. | **High** | Not Tested | |
| **TC-MON-004** | Siswa | Beranda Siswa (`/student/home`) | **[Positif / Integrasi]** Memeriksa kesesuaian ringkasan kehadiran dan jadwal hari ini di beranda siswa | Login sebagai Siswa | 1. Buka `/student/home`.<br>2. Klik kartu **Ringkasan Kehadiran** untuk membuka modal riwayat presensi.<br>3. Cocokkan status Sakit/Izin/Alpa dengan yang diinput guru pada jurnal. | Akun Siswa `X RPL 1` | Persentase dan jumlah rincian presensi di akun siswa sama persis dengan catatan jurnal guru. | **High** | Not Tested | |
| **TC-MON-005** | Siswa | Jadwal Siswa (`/student/schedule`) | **[Positif]** Melihat jadwal pelajaran mingguan kelas siswa dan mengganti tab putaran (Cycle 1–4) | Login sebagai Siswa | 1. Buka `/student/schedule`.<br>2. Beralih antar tab Putaran 1, 2, 3, dan 4 serta filter hari. | Jadwal kelas siswa | Hanya jadwal milik kelas siswa tersebut yang tampil beserta nama guru, mapel, ruangan, dan jam pelajaran. | **High** | Not Tested | |
| **TC-MON-006** | Orang Tua | Monitoring Anak (`/parent/monitoring`) | **[Positif / Integrasi]** Orang tua memantau kehadiran, riwayat surat izin, nilai kuis, dan jadwal pelajaran anaknya | Login menggunakan akun `ORTU-{NIS}` | 1. Buka `/parent/monitoring`.<br>2. Periksa informasi identitas anak di bagian atas.<br>3. Buka tab **Riwayat Kehadiran**, **Riwayat Perizinan**, **Nilai Kuis**, dan **Jadwal Kelas** secara bergantian. | Akun `ORTU-998877` | Seluruh tab menampilkan data milik anak yang tertaut secara *real-time* dan terisolasi dari data siswa lain. | **Critical** | Not Tested | |
| **TC-MON-007** | Orang Tua | Monitoring Anak (`/parent/monitoring`) | **[Batas / Negatif]** Login menggunakan akun role `parent` yang `linked_student_id`-nya kosong/terputus | Akun parent tanpa `linked_student_id` | 1. Buka `/parent/monitoring`. | `linked_student_id = null` | Halaman tidak mengalami *crash* (`TypeError`), melainkan menampilkan informasi bahwa siswa belum ditautkan ke akun orang tua. | **Medium** | Not Tested | |
| **TC-MON-008** | Orang Tua | Kalender Orang Tua (`/parent/calendar`) | **[Positif]** Melihat agenda kalender akademik yang berdampak pada kelas anak | Login sebagai Orang Tua | 1. Buka `/parent/calendar`.<br>2. Klik salah satu agenda pada kalender untuk membuka `AcademicEventDetailModal`. | Agenda sekolah | Kalender menampilkan agenda yang relevan dengan tingkat/kelas anak beserta keterangan apakah KBM ditiadakan atau tidak. | **Low** | Not Tested | |

---

## 8. Skenario Integrasi Antarfitur (End-to-End Workflows)

Selain menguji modul secara terpisah, lakukan **4 Skenario Alur Kerja Terpadu (E2E)** berikut dari hulu ke hilir:

###- [ ] **E2E-01: Siklus Penuh Operasional KBM & Presensi Berbasis Perizinan**
1. **Waka Kurikulum** mengimpor data Guru dan Siswa di `/web/master-data`, lalu mem-plotting jadwal kelas `X RPL 1` pada Putaran 1 di `/web/schedules`.
2. **Siswa A** (`X RPL 1`) login ke `/student/permissions` dan mengajukan izin **Tidak Masuk Sekolah (Sakit)** untuk hari ini beserta foto surat dokter.
3. **Guru Kesiswaan** login ke `/teacher/permissions`, memeriksa foto surat dokter Siswa A, lalu menekan tombol **Setujui (`approved`)**.
4. **Guru Pengampu** login ke `/teacher/dashboard`, memilih jadwal `X RPL 1`, dan menekan **Mulai & Buka Kelas Sekarang** di `/teacher/journal`.
   - *Titik Verifikasi 1:* Pastikan status Siswa A otomatis terisi **Sakit** berkat integrasi `approved_leaves`.
5. **Guru Pengampu** mengubah status **Siswa B** menjadi **Alpa**, mengambil foto kelas dengan kamera, mengisi materi pembelajaran, dan menekan **Simpan & Selesaikan Jurnal**.
6. **Waka / Kesiswaan** membuka `/web/monitoring` dan memastikan jurnal `X RPL 1` berstatus **Selesai**, Siswa A tercatat Sakit, dan Siswa B tercatat Alpa.
7. **Orang Tua Siswa B** login ke `/parent/monitoring` dan melihat anaknya tercatat **Alpa** pada mata pelajaran tersebut hari ini.
- **Uji Kegagalan Tengah Jalan (Failure Impact):** Jika pada Langkah 3 Guru Kesiswaan **Menolak (`rejected`)** izin Siswa A, pastikan pada Langkah 4 status default Siswa A di jurnal guru tetap **Hadir** (tidak otomatis menjadi Sakit).

###- [ ] **E2E-02: Siklus Penuh Izin Guru, Tugas Titipan & Pengambilalihan Kelas oleh Wali Kelas/Kesiswaan**
1. **Guru Pengampu Asli** login ke `/teacher/leave`, memilih jadwal mengajar hari ini di `X RPL 1`, mengisi alasan `Dinas Luar`, menuliskan instruksi **Tugas Titipan** (`Kerjakan modul halaman 25–30`), mengunggah file lampiran soal, dan mengirim pengajuan.
2. **Waka / Kesiswaan** membuka `/teacher/permissions` tab **Perizinan Guru**, lalu menyetujui izin guru tersebut.
3. **Wali Kelas `X RPL 1`** (atau Guru Kesiswaan) membuka jadwal kelas `X RPL 1` dan masuk ke `/teacher/journal`.
   - *Titik Verifikasi 1:* Pastikan kotak **Tugas Titipan** dari Guru Asli tampil lengkap beserta tautan unduh lampirannya.
   - *Titik Verifikasi 2:* Pastikan tombol utama berubah menjadi **Mulai Presensi & Ambil Alih Kelas**.
4. **Wali Kelas** membuka kelas, mendata presensi siswa, mengunggah foto pendampingan kelas, dan menyelesaikan jurnal.
5. **Waka Kurikulum** memeriksa `/web/monitoring` tab Jurnal dan memastikan sesi tersebut tercatat selesai dengan informasi Guru Pengganti (`substitute_teacher`).

###- [ ] **E2E-03: Siklus Penuh Asesmen Kuis AI dari Pembuatan hingga Laporan Nilai Orang Tua**
1. **Guru Pengampu** membuat kuis baru di `/teacher/quiz` untuk kelas `X RPL 1`, menggunakan **Generator Prompt AI** (3 PG + 2 Esai), meninjau soal yang dihasilkan Gemini, lalu menekan **Publikasikan Kuis**.
2. **Siswa `X RPL 1`** login ke `/student/quiz`, mengerjakan ke-5 soal tersebut, dan mengumpulkan jawaban.
3. **Backend (`AIService`)** menilai soal PG secara instan dan menilai jawaban Esai siswa secara semantik beserta feedback analisisnya.
4. **Guru Pengampu** membuka daftar *Submissions* di `/teacher/quiz`, meninjau skor AI, melakukan sedikit penyesuaian (*override*) nilai, lalu menekan **Publikasikan Hasil (`published_result`)**.
5. **Siswa** dan **Orang Tua Siswa** membuka halaman kuis/monitoring masing-masing dan memverifikasi nilai akhir beserta pembahasan umpan balik AI sudah dapat dilihat.
- **Uji Kegagalan Tengah Jalan (Failure Impact):** Jika saat Langkah 3 koneksi ke API Google Gemini terputus atau *timeout*, pastikan pengumpulan jawaban siswa (`QuizSubmission`) **tetap berhasil tersimpan** (skor PG tetap terhitung, sedangkan skor esai dapat di-*override* manual oleh guru tanpa menghilangkan jawaban siswa).

###- [ ] **E2E-04: Siklus Pergantian Tahun Ajaran, Kenaikan Kelas & Penugasan Wali Kelas**
1. **Waka Kurikulum** membuka `/web/grade-promotion`, menandai 1 siswa di `X RPL 1` sebagai **Tinggal Kelas**, lalu mengeksekusi **Proses Kenaikan Kelas** dengan kata sandi Waka.
2. **Waka Kurikulum** membuka `/web/dashboard` dan memperbarui Tahun Ajaran menjadi tahun berikutnya.
3. **Siswa yang Naik Kelas** login ke `/student/home` dan memverifikasi kelasnya telah berubah menjadi `XI RPL 1` serta jadwal yang tampil adalah jadwal `XI RPL 1`.
4. **Siswa yang Tinggal Kelas** login dan memverifikasi kelasnya tetap di tingkat `X`.

---

## 9. Skenario Pengujian Keamanan dan Hak Akses (RBAC & Security Audit)

Lakukan pengujian penetrasi hak akses berikut untuk memastikan tidak ada kebocoran otorisasi baik melalui manipulasi URL browser maupun pemanggilan API langsung (Postman / cURL / Fetch DevTools):

- [ ] **TC-SEC-001 — Akses URL Halaman Waka oleh Role Guru/Siswa/Ortu:**
  - *Langkah:* Login sebagai Siswa atau Guru, lalu ketik `/web/master-data`, `/web/schedules`, atau `/web/grade-promotion` di address bar browser.
  - *Ekspektasi:* `RoleRoute` memblokir akses dan mengalihkan pengguna kembali ke halaman beranda rolenya masing-masing.
- [ ] **TC-SEC-002 — Pemanggilan Endpoint Mutasi Waka oleh Token Guru/Siswa:**
  - *Langkah:* Gunakan Bearer Token milik Siswa/Guru untuk memanggil `POST /api/classes`, `DELETE /api/teachers/1`, atau `PATCH /api/academic-settings`.
  - *Ekspektasi:* Middleware `role:vice_principal` menolak request secara mutlak dengan status **HTTP 403 Forbidden**.
- [ ] **TC-SEC-003 — Isolasi Data Antar-Siswa & Antar-Orang Tua (IDOR Check):**
  - *Langkah:* Login sebagai Siswa A, lalu coba panggil `GET /api/attendances?student_id={id_siswa_B}` atau `DELETE /api/leave-requests/{id_izin_siswa_B}`.
  - *Ekspektasi:* Controller melakukan *auto-scoping* berdasarkan `$request->user()->id` sehingga Siswa A hanya menerima datanya sendiri dan mendapat HTTP 403/404 saat mencoba memodifikasi milik Siswa B.
- [ ] **TC-SEC-004 — Isolasi Kelas pada Guru BK / Kesiswaan & Wali Kelas:**
  - *Langkah:* Login sebagai Guru A yang hanya menjadi Wali Kelas `X RPL 1`. Coba buka jurnal atau setujui izin siswa dari kelas `XI TKJ 2`.
  - *Ekspektasi:* Sistem menolak pembukaan jurnal kelas yang bukan ampuannya dan menolak persetujuan izin siswa oleh akun yang tidak memiliki penugasan `kesiswaan`.
- [ ] **TC-SEC-005 — Pencabutan Penugasan Secara Langsung (*Live Role Revocation*):**
  - *Langkah:* Guru X sedang memiliki penugasan `kesiswaan`. Waka mencabut penugasan `kesiswaan` Guru X di `/web/master-data`. Tanpa logout, Guru X mencoba menyetujui izin siswa di `/teacher/permissions`.
  - *Ekspektasi:* Pengecekan `$user->hasAssignment('kesiswaan')` di backend langsung membaca database terbaru dan menolak aksi tersebut dengan HTTP 403.
- [ ] **TC-SEC-006 — Proteksi Konfirmasi Kata Sandi pada Seluruh Operasi Kritis Waka:**
  - *Langkah:* Coba lakukan tambah/edit/hapus jadwal, ubah siklus jadwal, hapus permanen tempat sampah, kenaikan kelas, atau reset master data tanpa menyertakan field `password` atau dengan `password` yang salah.
  - *Ekspektasi:* Seluruh operasi kritis wajib gagal (HTTP 422/403).

---

## 10. Skenario Pengujian Kondisi Khusus & Ketahanan Sistem (Edge Cases)

- [ ] **TC-EDGE-001 — Penekanan Tombol Submit Berkali-kali (*Double / Rapid Click*):**
  - *Langkah:* Saat membuka jurnal KBM, mengirim pengajuan izin, atau men-generate soal AI, klik tombol submit 5 kali secara cepat.
  - *Ekspektasi:* State `isSubmitting` / `isGenerating` langsung menonaktifkan (*disable*) tombol pada klik pertama; di sisi backend `Journal::firstOrCreate(['schedule_id', 'date'])` mencegah terbentuknya 2 jurnal ganda untuk jadwal dan tanggal yang sama.
- [ ] **TC-EDGE-002 — Dua Pengguna Mengakses Sesi Jurnal yang Sama Secara Bersamaan (*Race Condition*):**
  - *Langkah:* Guru Pengampu Asli dan Guru Kesiswaan membuka halaman `/teacher/journal` untuk jadwal kelas yang sama pada detik yang bersamaan. Guru Asli menyelesaikan jurnal lebih dulu, lalu Guru Kesiswaan menekan tombol *Tandai Guru Berhalangan*.
  - *Ekspektasi:* `JournalController@markTeacherAbsent` memeriksa `if ($journal->status === 'completed')` dan menolak perubahan menjadi `teacher_absent` dengan HTTP 422 (*"Jurnal KBM sudah berstatus completed"*).
- [ ] **TC-EDGE-003 — Refresh Browser Saat Sedang Mengerjakan Kuis Siswa:**
  - *Langkah:* Siswa menjawab 4 dari 5 soal kuis di `/student/quiz`, lalu menekan `F5 (Refresh)` atau tidak sengaja menutup tab dan membukanya kembali.
  - *Ekspektasi:* Jawaban yang telah dipilih dipulihkan dari `sessionStorage` (`quiz_draft_{quizId}`) sehingga siswa tidak perlu mengulang dari awal.
- [ ] **TC-EDGE-004 — Sesi Token Kedaluwarsa (HTTP 401) Saat Pengguna Sedang Mengisi Form:**
  - *Langkah:* Hapus/cabut token pengguna dari tabel `personal_access_tokens` di database saat pengguna sedang berada di halaman dashboard/form, lalu klik salah satu aksi simpan.
  - *Ekspektasi:* Interceptor Axios pada `services/api.js` menangkap respons HTTP 401, membersihkan state sesi yang usang, dan mengarahkan pengguna kembali ke `/login` dengan aman.
- [ ] **TC-EDGE-005 — Koneksi Internet Terputus / Offline Saat Mengunggah Foto Jurnal:**
  - *Langkah:* Pada DevTools Browser (Tab Network), ubah mode menjadi **Offline** tepat sebelum menekan *Simpan & Selesaikan Jurnal*.
  - *Ekspektasi:* Aplikasi menangkap error jaringan, menampilkan pesan peringatan koneksi tanpa menghapus teks topik dan foto yang sudah disiapkan di form, sehingga guru cukup menekan simpan ulang saat koneksi pulih.
- [ ] **TC-EDGE-006 — Gangguan / Rate Limit (HTTP 429) pada Layanan Google AI Studio:**
  - *Langkah:* Lakukan request generate soal kuis AI secara berturut-turut melebihi 15 RPM atau ubah sementara `AI_API_KEY` menjadi tidak valid.
  - *Ekspektasi:* `AIService` menangkap status 429/401, mengembalikan pesan bahasa Indonesia yang ramah (*"Batas kuota permintaan AI tercapai..."*), mengembalikan status kuis dari `generating` ke `draft_review`, dan tidak membuat status kuis macet selamanya.
- [ ] **TC-EDGE-007 — Penghapusan Data yang Memiliki Riwayat Akademik Legal:**
  - *Langkah:* Coba hapus permanen (*force delete*) akun Guru atau Siswa yang sudah memiliki rekaman jurnal/presensi dari Tempat Sampah.
  - *Ekspektasi:* Sistem mendeteksi flag `has_legal_history` dan memblokir penghapusan permanen yang dapat merusak integritas rekapitulasi historis.

---

## 11. Daftar Risiko dan Potensi Bug yang Perlu Diwaspadai Saat Deployment

Berdasarkan hasil pemeriksaan kode sumber dan konfigurasi proyek saat ini, berikut adalah daftar risiko teknis yang **wajib diperiksa pada server tujuan sebelum sistem dirilis ke pengguna**:

| No | Area Risiko | Deskripsi Temuan pada Proyek | Dampak Jika Diabaikan | Mitigasi Sebelum Deployment |
|---|---|---|---|---|
| 1 | **Konfigurasi SSL cURL (`AI_VERIFY_SSL` & `GOOGLE_VERIFY_SSL`)** | Di `scp/.env` lokal, `AI_VERIFY_SSL=false` dan `GOOGLE_VERIFY_SSL=false` diaktifkan untuk mengatasi sertifikat CA lokal Windows. | Di server produksi Linux, menonaktifkan verifikasi SSL menurunkan keamanan koneksi HTTPS ke Google API. | Pada server produksi Linux yang memiliki `ca-certificates` terbaru, ubah `AI_VERIFY_SSL=true` dan `GOOGLE_VERIFY_SSL=true`. |
| 2 | **Driver WhatsApp Masih Mode `log`** | Di `scp/.env`, `WHATSAPP_DRIVER=log` dan `FONNTE_TOKEN=dummy_token`. | Pengguna yang meminta OTP WhatsApp di halaman `/profile` tidak akan menerima pesan WA di HP mereka. | Masukkan `FONNTE_TOKEN` aktif dari dashboard Fonnte dan ubah `WHATSAPP_DRIVER=fonnte` saat produksi. |
| 3 | **Symbolic Link Storage (`storage:link`)** | Bukti foto jurnal KBM dan dokumen surat izin disimpan di `storage/app/public/`. | Jika `php artisan storage:link` belum dijalankan di server produksi, seluruh foto jurnal dan surat izin akan gagal dimuat (HTTP 404). | Pastikan menjalankan `php artisan storage:link` dan memeriksa izin folder `storage/` (`chmod 775`). |
| 4 | **Batas Ukuran Upload Server (`upload_max_filesize` & Nginx `client_max_body_size`)** | Pengguna mengunggah file PDF Jadwal, Excel Siswa, Dokumen Kuis, dan Foto Kamera. | Default PHP (`2M`) atau Nginx (`1M`) di server produksi dapat memblokir upload file dengan error HTTP 413 (*Payload Too Large*). | Setel `upload_max_filesize = 15M`, `post_max_size = 20M` di `php.ini` dan `client_max_body_size 20M;` di Nginx. |
| 5 | **Batas Kuota RPM Google AI Studio Free Tier** | Model `gemini-3.1-flash-lite` Free Tier memiliki batas sekitar 15 Request Per Menit (RPM) untuk 1 API Key. | Jika > 15 guru menekan tombol *Generate Soal AI* atau puluhan siswa mengumpulkan esai pada menit yang persis bersamaan, sebagian request akan terkena HTTP 429. | Sosialisasikan agar pembuatan soal AI dilakukan saat persiapan mengajar, atau gunakan antrean/queue worker jika trafik serentak sangat tinggi. |
| 6 | **Kesesuaian `APP_URL`, `FRONTEND_URL`, dan CORS** | Saat ini `.env` mengarah ke `http://localhost:8000` dan `http://localhost:5173`. | Jika domain produksi belum didaftarkan pada `config/cors.php` / `SANCTUM_STATEFUL_DOMAINS` dan `VITE_API_BASE_URL`, request API dari frontend akan terkena blokir CORS. | Sesuaikan `APP_URL`, `VITE_API_BASE_URL`, dan konfigurasi CORS dengan domain HTTPS resmi sekolah. |
| 7 | **Ikon Bantuan (`?`) dan Lonceng Notifikasi di TopBar** | Kedua ikon di `TopBar.jsx` belum memiliki aksi klik (placeholder). | Pengguna mungkin mengira tombol tersebut rusak saat diklik. | Catat sebagai fitur kosmetik tahap berikutnya atau sembunyikan sementara jika tidak ingin membingungkan pengguna saat UAT. |

---

## 12. Urutan Pelaksanaan Testing yang Disarankan

Agar pengujian berjalan efisien dan tidak terkendala ketergantungan data (*data dependency*), ikuti urutan pelaksanaan berikut dari Tahap A hingga Tahap F:

1. **Tahap A — Persiapan & Pengujian Autentikasi Dasar (`TC-AUTH` & `TC-PROF`):**
   - Uji login Waka (`ADMIN001`), ganti password, profil, OTP Email/WA, dan Google SSO.
2. **Tahap B — Konfigurasi Akademik & Penyediaan Master Data (`TC-WAKA`, `TC-MAST`, `TC-TRSH`):**
   - Atur Tahun Ajaran, Semester, dan Putaran Jadwal Aktif di Dashboard Waka.
   - Uji CRUD & Import Excel untuk Kelas, Ruangan, Mapel, Guru, Siswa, serta Penugasan Wali Kelas & Guru BK.
   - Uji Smart Delete dan pemulihan data di Tempat Sampah.
3. **Tahap C — Penyusunan Jadwal & Kalender Akademik (`TC-SCHD` & `TC-CAL`):**
   - Uji plotting jadwal manual, deteksi bentrok, dan Import PDF Jadwal.
   - Buat agenda Kalender Akademik (baik kegiatan biasa maupun libur yang meniadakan KBM).
4. **Tahap D — Operasional Harian KBM, Presensi & Perizinan (`TC-LEAV` & `TC-JRNL`):**
   - Gunakan akun Siswa untuk mengajukan izin, akun Kesiswaan untuk memverifikasi izin, dan akun Guru untuk membuka kelas, mengambil foto kamera, mencatat presensi, serta menyelesaikan jurnal.
   - Uji skenario Izin Guru + Tugas Titipan + Ambil Alih Kelas oleh Wali Kelas/Kesiswaan + Jam Kosong.
5. **Tahap E — Asesmen Kuis AI & Monitoring Lintas Role (`TC-QUIZ` & `TC-MON`):**
   - Gunakan akun Guru untuk membuat & men-generate Kuis AI, akun Siswa untuk mengerjakan kuis, akun Guru untuk meninjau & mempublikasikan nilai, serta akun Orang Tua/Waka untuk memeriksa Monitoring & Ekspor Excel.
6. **Tahap F — Pengujian Keamanan, Edge Cases & Kenaikan Kelas (`TC-SEC`, `TC-EDGE`, `TC-PROM`):**
   - Lakukan uji akses silang antar-role (RBAC), uji kondisi jaringan terputus/klik ganda, dan terakhir jalankan simulasi serta eksekusi Kenaikan Kelas (pada database salinan/staging).

---

## 13. Rekapitulasi Hasil Pengujian

Gunakan tabel rekapitulasi ini untuk merangkum status pengujian sebelum mengambil keputusan deployment:

|Kode Modul | Nama Modul / Kelompok Pengujian | Total Test Case | Prioritas Critical | Prioritas High | Prioritas Medium | Prioritas Low | Jumlah Pass | Jumlah Fail | Jumlah Blocked | Persentase Lulus (%) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `TC-AUTH` | Autentikasi, Otorisasi & Lupa Sandi | 12 | 5 | 5 | 2 | 0 | 0 | 0 | 0 | 0% |
| `TC-PROF` | Profil Pengguna, OTP & Google SSO | 8 | 0 | 5 | 3 | 0 | 0 | 0 | 0 | 0% |
| `TC-WAKA` | Dashboard Waka & Pengaturan Akademik | 7 | 1 | 4 | 2 | 0 | 0 | 0 | 0 | 0% |
| `TC-MAST` | Master Data, Import Excel & Penugasan | 16 | 3 | 11 | 2 | 0 | 0 | 0 | 0 | 0% |
| `TC-TRSH` | Smart Delete & Tempat Sampah (Recycle Bin) | 6 | 1 | 4 | 0 | 1 | 0 | 0 | 0 | 0% |
| `TC-SCHD` | Manajemen Jadwal & Import PDF Jadwal | 11 | 2 | 6 | 2 | 1 | 0 | 0 | 0 | 0% |
| `TC-CAL` | Kalender Akademik & Eksklusi KBM | 7 | 2 | 3 | 2 | 0 | 0 | 0 | 0 | 0% |
| `TC-PROM` | Kenaikan Kelas & Tinggal Kelas | 5 | 1 | 3 | 1 | 0 | 0 | 0 | 0 | 0% |
| `TC-JRNL` | Jurnal KBM, Kamera & Presensi Siswa | 12 | 5 | 6 | 1 | 0 | 0 | 0 | 0 | 0% |
| `TC-LEAV` | Perizinan Siswa, Guru & Verifikasi | 11 | 3 | 6 | 2 | 0 | 0 | 0 | 0 | 0% |
| `TC-QUIZ` | Kuis Berbantuan AI & Penilaian Semantik | 12 | 4 | 7 | 1 | 0 | 0 | 0 | 0 | 0% |
| `TC-MON` | Monitoring, Rekapitulasi & Portal Ortu | 8 | 1 | 4 | 2 | 1 | 0 | 0 | 0 | 0% |
| `E2E` | Skenario Integrasi Antarfitur (End-to-End) | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0% |
| `TC-SEC` | Keamanan & Hak Akses (RBAC Audit) | 6 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0% |
| `TC-EDGE` | Kondisi Khusus & Ketahanan Sistem | 7 | 2 | 4 | 1 | 0 | 0 | 0 | 0 | 0% |
| **TOTAL** | **Seluruh Skenario Pengujian SCP** | **132** | **40** | **68** | **21** | **3** | **0** | **0** | **0** | **0%** |

---

## 14. Kriteria Kelayakan Deployment (Go / No-Go Decision Criteria)

Sistem **School Class Progress (SCP)** dinyatakan **LAYAK DEPLOY (GO FOR PRODUCTION)** apabila memenuhi seluruh persyaratan mutlak berikut:

### 14.1 Kriteria Kualitas Pengujian (Testing Gate)
- [ ] **100% Test Case berprioritas `Critical` (40 Test Case)** telah diuji dan berstatus **PASS** (0 Fail, 0 Blocked).
- [ ] Minimal **95% Test Case berprioritas `High` (68 Test Case)** berstatus **PASS**, dan tidak ada kegagalan yang menyebabkan kehilangan data atau salah perhitungan presensi/nilai.
- [ ] Seluruh **4 Skenario End-to-End (`E2E-01` s/d `E2E-04`)** dan **6 Skenario Keamanan RBAC (`TC-SEC-001` s/d `TC-SEC-006`)** lulus tanpa kebocoran hak akses antar-role.
- [ ] Seluruh pengujian otomatis backend (`php artisan test` — 425 tests) dan build produksi frontend (`npm run build`) lulus 100% tanpa error.

### 14.2 Kriteria Kesiapan Lingkungan Produksi (Infrastructure & Configuration Gate)
- [ ] File `.env` produksi pada backend (`scp/.env`) telah diatur dengan `APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY` terisi, dan koneksi database PostgreSQL produksi yang terproteksi.
- [ ] Perintah `php artisan migrate --force`, `php artisan storage:link`, `php artisan config:cache`, dan `php artisan route:cache` telah dijalankan dengan sukses di server.
- [ ] Kredensial layanan eksternal produksi telah diverifikasi aktif:
  - **Google AI Studio:** `AI_API_KEY` aktif dan `AI_MODEL=gemini-3.1-flash-lite` merespons JSON dengan normal.
  - **SMTP Email:** Pengiriman email OTP lupa sandi dan verifikasi email berhasil masuk ke kotak masuk pengguna.
  - **WhatsApp Gateway (Fonnte):** `FONNTE_TOKEN` aktif dan `WHATSAPP_DRIVER=fonnte` berhasil mengirim pesan ke nomor nyata.
  - **Google OAuth SSO:** `GOOGLE_CLIENT_ID` dan `VITE_GOOGLE_CLIENT_ID` telah mengizinkan domain HTTPS produksi sekolah.
- [ ] Mekanisme *backup* otomatis database PostgreSQL harian (`pg_dump`) dan direktori `storage/app/public` telah disiapkan sebelum pengguna sekolah mulai memasukkan data operasional nyata.

---

### Lembar Persetujuan Kelayakan Deployment (Sign-Off)

| Peran | Nama Lengkap | Keputusan (`LAYAK` / `TUNDA`) | Tanggal | Catatan / Syarat Tambahan |
|---|---|---|---|---|
| **Pengembang Utama / QA Lead** | | | | |
| **Perwakilan Waka Kurikulum** | | | | |
| **Administrator Server Sekolah** | | | | |
