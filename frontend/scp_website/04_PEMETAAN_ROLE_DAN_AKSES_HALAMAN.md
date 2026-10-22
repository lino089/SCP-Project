# Dokumen 04: Pemetaan Role, Halaman, dan Hak Akses Pengguna

**Acuan Spesifikasi:** PRD v4.4 (Bagian 3) & Penegakan Otorisasi Backend SCP  
**Konsep Kunci:** Pemisahan antara *Role Sistem* (`users.role`) dan *Penugasan Tambahan* (`teacher_assignments`).  

---

## 1. Arsitektur Peran & Penugasan Pengguna (RBAC)

Pada sistem SCP, otorisasi pengguna tidak hanya bergantung pada kolom `users.role`, tetapi juga mempertimbangkan relasi penugasan struktural (`teacher_assignments`). Hal ini memungkinkan seorang guru memiliki peran ganda tanpa perlu membuat banyak akun terpisah.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TAKSONOMI PERAN & PENUGASAN SCP                      │
└────────────────────────────────────────────────────────────────────────┘

 [Role: vice_principal] ──► Waka Kurikulum (Manajer Sistem & Jadwal)
 
 [Role: teacher] ────────► Guru Mata Pelajaran (Base Role)
      │
      ├── Penugasan 1: [assignment: kesiswaan] ──► Guru Piket / Tim Kesiswaan
      │                                            (Hak Eksklusif Pengganti KBM,
      │                                             Verifikasi Izin, & Monitoring)
      │
      └── Penugasan 2: [assignment: wali_kelas]  ──► Wali Kelas (class_id tertentu)
                                                   (Monitoring Presensi Kelas Binaan;
                                                    DILARANG menggantikan KBM guru lain)

 [Role: student] ────────► Siswa Aktif (class_id tertentu)
 
 [Role: parent] ─────────► Orang Tua / Wali Siswa (linked_student_id)
```

---

## 2. Matriks Hak Akses Halaman & Menu Navigasi

Tabel berikut memetakan ketersediaan menu navigasi dan hak akses halaman web berdasarkan peran dan penugasan pengguna:

| Modul / Rute Halaman | Waka Kurikulum (`vice_principal`) | Guru Reguler (`teacher`) | Guru + Kesiswaan (`assignment: kesiswaan`) | Guru + Wali Kelas (`assignment: wali_kelas`) | Siswa (`student`) | Orang Tua (`parent`) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Dashboard Utama** (`/web/dashboard`) | **Akses Penuh** (Kelola Putaran, Upacara, Alert) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) |
| **Manajemen Jadwal** (`/web/schedules`) | **CRUD Penuh** (Input, Edit, Hapus + Password) | Ditolak (403) *(Gunakan Kalender)* | Ditolak (403) *(Hanya View)* | Ditolak (403) | Ditolak (403) | Ditolak (403) |
| **Import Jadwal PDF** (`/web/upload-import`) | **Akses Penuh** (Upload 2 PDF, Trigger Parse) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) |
| **Review Import Jadwal** (`/web/review-import`) | **Akses Penuh** (Resolusi, Exclude, Commit) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) |
| **Master Data Akademik** (`/web/master-data`) | **CRUD Penuh** (Kelas, Ruang, Mapel, Guru, Siswa) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) |
| **Kenaikan Kelas & Kelulusan** (`/web/grade-promotion`) | **Akses Penuh** (Hold-back, Eksekusi Promosi) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) |
| **Monitoring & Delegasi Piket** (`/web/monitoring`) | **Akses Penuh** (Seluruh Sekolah) | Ditolak (403) | **Akses Penuh** (Ambil Alih Kelas, Tandai Absen) | Read-Only (Hanya Kelas Binaan) | Ditolak (403) | Ditolak (403) |
| **Kalender Jadwal Mengajar** (`/teacher/schedule`) | Ditolak (403) | **Read-Only** (Jadwal Pribadi) | **Read-Only** (Jadwal Pribadi) | **Read-Only** (Jadwal Pribadi) | Ditolak (403) | Ditolak (403) |
| **Jurnal KBM & Presensi** (`/teacher/journal`) | Hanya Tandai `teacher_absent` | **Buka & Selesai** (Jadwal Sendiri) | **Buka & Selesai** (Jadwal Sendiri ATAU Guru Pengganti) | **Buka & Selesai** (Jadwal Sendiri SAJA) | Ditolak (403) | Ditolak (403) |
| **Manajemen Kuis AI** (`/teacher/quiz`) | Read-Only Seluruh Kuis | **CRUD Penuh** (Kuis Milik Sendiri) | **CRUD Penuh** (Kuis Milik Sendiri) | **CRUD Penuh** (Kuis Milik Sendiri) | Ditolak (403) | Ditolak (403) |
| **Verifikasi Perizinan Siswa** (`/teacher/permissions`) | Read-Only Seluruh Izin | Ditolak (403) | **Akses Penuh** (Approve / Reject Seluruh Izin) | Read-Only (Kelas Binaan, Tanpa Tombol Verifikasi) | Ditolak (403) | Ditolak (403) |
| **Beranda Siswa** (`/student/home`) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) | **Akses Penuh** (Statistik Pribadi) | Ditolak (403) |
| **Pengajuan Perizinan Siswa** (`/student/permissions`) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) | **Akses Penuh** (Ajukan, Edit Pending, Batal) | Ajukan atas nama anak |
| **Pengerjaan Kuis AI** (`/student/quiz`) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) | **Akses Penuh** (Kerjakan Soal, Lihat Nilai Akhir) | Ditolak (403) |
| **Monitoring Orang Tua** (`/parent/monitoring`) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) | Ditolak (403) | **Read-Only** (Presensi, Izin, Nilai Kuis Anak) |
| **Profil & Pengaturan Akun** (`/profile`) | **Akses Penuh** | **Akses Penuh** | **Akses Penuh** | **Akses Penuh** | **Akses Penuh** | **Akses Penuh** |

---

## 3. Rincian Hak Akses & Aturan Bisnis per Peran

### 3.1 Waka Kurikulum (`role: vice_principal`)
- **Tanggung Jawab:** Pengelola kurikulum sekolah, jadwal pelajaran, konfigurasi kalender akademik, dan integritas master data.
- **Aksi Khusus:**
  - Menentukan putaran jadwal yang aktif (Putaran 1 vs Putaran 2) via `PATCH /api/academic-settings`.
  - Mengubah status upacara hari Senin via `PATCH /api/academic-settings/monday-status`.
  - Mengunggah berkas PDF FET, meninjau hasil pencocokan, meresolusi bentrok, dan mengonfirmasi commit jadwal final.
  - Menginput atau mengubah jadwal pelajaran manual dengan proteksi verifikasi kata sandi (*Password Re-confirmation*).
  - Melakukan promosi kenaikan kelas dan kelulusan massal akhir tahun ajaran.
  - Memantau kepatuhan pengisian jurnal sekolah dan melihat peringatan jadwal terlambat (*Missing Journal Alerts*).

### 3.2 Guru Reguler (`role: teacher`)
- **Tanggung Jawab:** Melaksanakan KBM sesuai jadwal yang telah ditetapkan Waka, mengisi jurnal mengajar, mencatat kehadiran siswa, dan menyelenggarakan asesmen kuis AI.
- **Batasan Mutlak:**
  - **Sama sekali tidak memiliki hak mutasi jadwal** (tidak dapat menambah, mengubah, atau menghapus jadwal di `/web/schedules`).
  - Hanya dapat membuka sesi jurnal dan presensi untuk **jadwal miliknya sendiri**.
  - Dilarang membuka atau mengisi jurnal guru lain (**HTTP 403 Forbidden**).
  - Hanya dapat mengelola soal kuis dan mereview submission untuk kuis yang dibuatnya sendiri.

### 3.3 Guru dengan Penugasan Kesiswaan (`assignment: kesiswaan`)
- **Tanggung Jawab:** Mengawasi kedisiplinan dan perizinan siswa sekolah, memantau kehadiran harian, serta bertindak sebagai Guru Piket Kesiswaan.
- **Hak Eksklusif Pengganti Mengajar (PRD v4.4 Revisi):**
  - Menjadi **SATU-SATUNYA** peran yang berhak bertindak sebagai Guru Pengganti (`substitute_teacher_id`) saat guru mata pelajaran utama berhalangan hadir (*teacher absent*).
  - Membuka sesi KBM kelas pengganti, mencatat materi/tugas titipan, mengunggah foto KBM, dan mengisi presensi exception-based.
  - Jika kelas tidak ada pengganti, berhak menandai status jurnal menjadi `teacher_absent`.
- **Hak Verifikasi Izin:**
  - Menyetujui (*Approve*) atau menolak (*Reject*) seluruh pengajuan izin siswa sekolah (`PATCH /api/leave-requests/{id}`).
  - Melihat rekapitulasi presensi dan jurnal mengajar di seluruh kelas sekolah.

### 3.4 Guru dengan Penugasan Wali Kelas (`assignment: wali_kelas`)
- **Tanggung Jawab:** Membina siswa di kelas tertentu (`class_id`).
- **Batasan Mutlak Berdasarkan PRD v4.4:**
  - **TIDAK MEMILIKI HAK** untuk menggantikan guru yang berhalangan hadir dalam pembukaan kelas atau pengisian jurnal mengajar (ditegakkan HTTP 403 di backend).
  - Tidak memiliki wewenang untuk menyetujui/menolak perizinan siswa (hak verifikasi eksklusif milik Kesiswaan).
- **Hak Akses:**
  - Memantau rekap presensi dan riwayat perizinan khusus pada kelas binaannya (*auto-scoped*).
  - Memantau peringatan kehadiran (*attendance warnings*) bagi siswa yang banyak alpa/sakit di kelasnya.

### 3.5 Siswa (`role: student`)
- **Tanggung Jawab:** Mengikuti KBM, memantau kehadiran mandiri, mengajukan perizinan jika berhalangan hadir, dan mengerjakan kuis pembelajaran.
- **Hak Akses:**
  - Melihat rekapitulasi kehadiran mandiri (*auto-scoped*).
  - Mengajukan perizinan (*tidak masuk* atau *keluar sekolah*) beserta lampiran surat bukti.
  - Mengedit atau membatalkan pengajuan izin selama statusnya masih `pending`.
  - Mengerjakan kuis aktif kelasnya (`status: published`) selama belum melewati tenggat (*due date*) dan sisa percobaan (*max attempts*) masih tersedia.
  - Melihat hasil skor akhir dan umpan balik setelah kuis berstatus `published_result`.

### 3.6 Orang Tua / Wali (`role: parent`)
- **Tanggung Jawab:** Mendampingi dan memantau perkembangan akademik anak.
- **Hak Akses:**
  - Melihat rekapitulasi presensi dan riwayat izin anaknya (`linked_student_id`).
  - Mengajukan perizinan atas nama anaknya.
  - Melihat hasil capaian nilai kuis anak setelah status kuis `published_result`.
  - Menautkan kontak mandiri (Email, WhatsApp, Google SSO) untuk menerima notifikasi akademik.

---

## 4. Rekomendasi Implementasi pada Front-End Web

### 4.1 Route Guarding & Dynamic Menu Rendering
Front-End Web wajib mengimplementasikan komponen pembungkus rute (*Route Guard*) yang memeriksa dua atribut dari state autentikasi pengguna:
1. `user.role`: Memastikan role pengguna cocok dengan rute target (misal: hanya `vice_principal` yang dapat membuka rute `/web/*` manajemen kurikulum).
2. `user.assignments`: Memeriksa array objek penugasan (contoh: `user.assignments.some(a => a.type === 'kesiswaan')`).
   - Jika pengguna adalah guru dengan penugasan kesiswaan, tampilkan menu tambahan: **"Monitoring & Delegasi Piket"** dan **"Verifikasi Perizinan Siswa"**.
   - Jika guru memiliki penugasan wali kelas, sediakan tab filter cepat: **"Kelas Binaan Saya (X RPL 1)"**.

### 4.2 Tampilan "Akses Ditolak" (HTTP 403 State)
Jika pengguna memaksa masuk melalui pengetikan URL langsung ke rute yang tidak diizinkan, Front-End tidak boleh mengalami *blank screen*, melainkan wajib merender komponen **ForbiddenState (403)** dengan penjelasan yang bersahabat serta tombol kembali ke beranda perannya masing-masing.
