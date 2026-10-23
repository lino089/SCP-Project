# Kredensial Akun Pengujian Multi-Role (SCP Web)

Dokumen ini memuat daftar akun pengujian (*test accounts*) untuk setiap peran pengguna di aplikasi Front-End Website **School Class Project (SCP)** (`frontend/scp_web`). Akun-akun ini telah terdaftar di **Database Backend Laravel** (melalui `DatabaseSeeder.php`) dan tersedia sebagai preset instan pada **Halaman Login & TopBar Quick Switcher**.

---

## 1. Tabel Kredensial Akun (1 User Per Role)

| No | Peran / Role | Nama Pengguna | ID Pengguna (NIS / NIP) | Password Default | Penugasan / Konteks | Halaman Utama & Akses Fitur |
|:---:|:---|:---|:---|:---|:---|:---|
| 1 | **Waka Kurikulum**<br>`role: vice_principal` | **Waka Kurikulum** | `12345678` | `password` | Administrator Kurikulum & Akademik | • Dashboard Waka (`/web/dashboard`)<br>• Jadwal Pelajaran (`/web/schedules`)<br>• Import Berkas FET (`/web/upload-import`)<br>• Master Data (`/web/master-data`)<br>• Kenaikan Kelas (`/web/grade-promotion`) |
| 2 | **Guru Mata Pelajaran**<br>`role: teacher` | **Drs. Ahmad Fauzi, M.Pd.** | `197803122005011002` | `password123` | Guru Pengampu & Wali Kelas X-RPL-1<br>`fet_staff_id: AFAUZI` | • Kalender KBM Read-Only (`/teacher/schedule`)<br>• Sesi KBM & Presensi Exception (`/teacher/journal`)<br>• Form Izin Mengajar Guru & Delegasi Tugas |
| 3 | **Guru Kesiswaan (Piket)**<br>`role: teacher` | **Budi Santoso, M.Kom.** | `198211102008011005` | `password123` | Tim Kesiswaan & Guru Piket<br>`fet_staff_id: BSANTOSO` | • Mode Ambil Alih Kelas Pengganti (`/teacher/journal`)<br>• Pembaca Instruksi Tugas Titipan Guru Izin<br>• Penanda Jam Kosong (`teacher_absent`) |
| 4 | **Siswa**<br>`role: student` | **Aisyah Putri Ramadhani** | `2024001` | `password123` | Siswa Aktif Kelas X-RPL-1 | • Beranda & Presensi Siswa (`/student/home`)<br>• Pengajuan Izin Mandiri (`/student/permissions`)<br>• Pengerjaan Kuis AI (`/student/quiz`) |
| 5 | **Orang Tua / Wali**<br>`role: parent` | **Bambang Sulistyo** | `W-2024001` | `password123` | Orang Tua dari Aisyah Putri Ramadhani | • Monitoring Kehadiran Anak (`/parent/monitoring`) |

---

## 2. Cara Menguji Akun di Aplikasi

### Metode A: Melalui Halaman Login (`/login`)
1. Buka browser dan arahkan ke `http://localhost:5173/login`.
2. Pada bagian **"Pilih Peran Akun (Preset Demo)"**, klik radio button salah satu peran yang ingin diuji:
   - `Waka Kurikulum`
   - `Guru Pengampu / Wali Kelas`
   - `Guru Kesiswaan (Piket)`
   - `Siswa`
   - `Orang Tua / Wali`
3. Field **ID Pengguna** dan **Kata Sandi** akan terisi otomatis.
4. Klik salah satu tombol masuk:
   - **"Masuk ke Akun (API)"**: Mengautentikasi langsung ke server Laravel backend menggunakan token Sanctum asli.
   - **"Masuk Cepat (Demo Offline)"**: Masuk instan secara lokal tanpa memerlukan backend Laravel yang sedang berjalan.

---

### Metode B: Melalui Dropdown TopBar (Quick Role Switcher)
Saat Anda sudah berada di dalam aplikasi dan ingin berganti peran tanpa harus logout:
1. Klik avatar profil di sudut kanan atas header (**TopBar**).
2. Di dalam menu dropdown, lihat bagian **"Uji Cepat Peran (UKK)"**.
3. Klik peran yang diinginkan (misal: beralih dari *Guru* ke *Guru Kesiswaan* untuk menguji skenario ambil alih kelas piket).
4. Sesi akan langsung diperbarui, badge peran akan berubah, dan Anda diarahkan ke rute beranda peran terkait.

---

## 3. Skenario Pengujian Kunci per Fase

### Skenario Fase 3: Pengelolaan Jadwal & Import FET (Akun Waka Kurikulum)
- Login sebagai **Waka Kurikulum** (`12345678`).
- Buka menu **Jadwal Pelajaran**: lihat visualisasi matriks jadwal mingguan dan seleksi putaran (Putaran 1 & Putaran 2).
- Buka menu **Import Jadwal PDF**: coba upload berkas PDF FET atau buka halaman review import (`/web/review-import/1`).

### Skenario Fase 4: KBM, Presensi & Ambil Alih Piket
- **Sebagai Guru Pengampu (`197803122005011002`):**
  1. Buka menu **Jadwal Mengajar**: amati alokasi jam KBM harian (Senin–Jumat) dan matriks mingguan.
  2. Klik tombol **"Ajukan Izin Hari Ini"**: isi alasan dan instruksi tugas titipan siswa, lalu submit.
  3. Klik tombol **"Buka Kelas / Isi Jurnal"**: buka sesi KBM, amati prefill otomatis siswa yang berizin resmi, lakukan presensi dengan default "Hadir", lalu unggah dokumentasi foto terkompresi.
- **Sebagai Guru Kesiswaan (`198211102008011005`):**
  1. Beralih ke akun **Guru Kesiswaan**.
  2. Buka menu **Jurnal KBM & Presensi**: amati banner gelap **"Ambil Alih Kelas KBM oleh Tim Kesiswaan (Piket)"** dan kotak **"Tugas Titipan Guru Pengampu Asli"**.
  3. Coba aksi penandaan jam kosong via tombol **"Tandai Guru Berhalangan (Jam Kosong)"**.
