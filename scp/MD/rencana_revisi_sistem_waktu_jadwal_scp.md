# Rencana Revisi Sistem Waktu Jadwal Berdasarkan PDF Jadwal Ruangan – SCP

**Proyek:** School Class Progress (SCP) — SMK Negeri 1 Bantul  
**Dokumen:** Perencanaan Teknis & Analisis Operasional Waktu Jadwal  
**Status:** Menunggu Persetujuan (*Draft Perencanaan — Belum Diimplementasikan*)  
**Tanggal Penyusunan:** 5 November 2026  

---

## 1. Ringkasan Tujuan Revisi

Revisi ini bertujuan untuk menyelaraskan seluruh sistem perhitungan, penyimpanan, penampilan, dan validasi waktu kegiatan belajar mengajar (KBM) pada aplikasi **School Class Progress (SCP)** agar **100% akurat mengikuti waktu operasional resmi sekolah** yang tercantum dalam dokumen **`Jadwal_Ruangan.pdf`** (serta berkorespondensi dengan **`Jadwal_Kelas.pdf`**).

Sasaran utama revisi meliputi:
1. **Menghilangkan kesalahan jam pulang ~16:00 / 16:45 WIB** yang selama ini muncul akibat asumsi durasi seragam 45 menit/JP dari label baris standar aplikasi pembuat jadwal (FET).
2. **Menetapkan jam mulai, jam selesai per periode, durasi per JP (35 menit / 40 menit), dan jam istirahat (Istirahat I & II)** sesuai tabel waktu resmi pada keseluruhan halaman `Jadwal_Ruangan.pdf`.
3. **Menghitung jam pulang secara dinamis** berdasarkan sesi pembelajaran terakhir yang benar-benar dijadwalkan pada masing-masing kelas/hari (misalnya pukul **15:10 WIB** untuk Senin–Kamis, **13:50 WIB** untuk Jumat reguler 8 JP, atau **11:25 WIB** bagi kelas yang sesi terakhirnya selesai pada Jam Ke-6 di hari Jumat seperti kelas `XII BR 2`).
4. **Memperbaiki logika resolusi waktu lintas hari** pada backend (`PeriodResolutionService` & `ScheduleController`) serta frontend (`timetableHelper.js`) tanpa mengganggu mekanisme **Putaran Jadwal (Putaran 1 & 2)**, **Upacara Hari Senin**, **Jurnal Mengajar**, **Presensi**, dan **Kalender Akademik**.

---

## 2. Hasil Analisis PDF Jadwal Ruangan

Pemeriksaan menyeluruh telah dilakukan terhadap seluruh halaman dokumen referensi pada direktori `scp/MD/PDF/`:
- [`Jadwal_Ruangan.pdf`](file:///d:/MyUKK/SchoolClassProject/scp/MD/PDF/Jadwal_Ruangan.pdf) (3 halaman, mencakup seluruh 48 rombel kelas dari tingkat X, XI, dan XII).
- [`Jadwal_Kelas.pdf`](file:///d:/MyUKK/SchoolClassProject/scp/MD/PDF/Jadwal_Kelas.pdf) (49 halaman: 1 halaman daftar isi + 48 halaman jadwal masing-masing rombel kelas).

### 2.1. Karakteristik & Struktur `Jadwal_Ruangan.pdf`
- **Identitas Dokumen:** *"JADWAL RUANG PUTARAN 1 SEMESTER GANJIL TAHUN PELAJARAN 2026/2027 SMK NEGERI 1 BANTUL"*, ditandatangani oleh Kepala Sekolah SMK Negeri 1 Bantul (Raharjo, S.IP., M.Pd., NIP. 196904041989031010, tertanggal Bantul, 13 Juli 2026).
- **Cakupan Halaman:**
  - **Halaman 1:** Memuat tabel jadwal ruangan dan kolom `Waktu` untuk hari **Senin** (Pra-KBM Upacara + Jam Ke-1 s/d 10) dan hari **Selasa** (Pra-KBM Literasi + Jam Ke-1 s/d 10) untuk 48 rombel.
  - **Halaman 2:** Memuat tabel jadwal ruangan dan kolom `Waktu` untuk hari **Rabu** (Jam Ke-1 s/d 10) dan hari **Kamis** (Jam Ke-1 s/d 10) untuk 48 rombel.
  - **Halaman 3:** Memuat tabel jadwal ruangan dan kolom `Waktu` untuk hari **Jumat** (Jam Ke-1 s/d 8) untuk 48 rombel, dilengkapi legenda kode ruangan (`L.1` s/d `L.22`, `L.IPA`, `L.PB`, `OR`, `HALL`).

### 2.2. Temuan Kunci Operasional Waktu Sekolah
1. **Prinsip Penyeragaman Jam Pulang Senin–Kamis (15:10 WIB):**
   Sekolah merancang durasi tiap jam pelajaran (JP) secara adaptif agar meskipun hari Senin terdapat **Upacara Bendera (60 menit)** dan hari Selasa terdapat **Literasi (30 menit)**, jam berakhirnya pelajaran ke-10 (jam pulang Senin–Kamis) **selalu jatuh tepat pada pukul 15:10 WIB**:
   - **Hari Senin:** Upacara `07:00 - 08:00` (60 mnt). Agar tetap pulang pukul `15:10`, durasi JP 1–6 dan JP 8–10 dipadatkan menjadi **35 menit/JP**, sedangkan JP 7 (`12:45 - 13:25`) berdurasi **40 menit**.
   - **Hari Selasa:** Literasi `07:00 - 07:30` (30 mnt). Durasi JP 1–7 adalah **40 menit/JP**, sedangkan JP 8–10 setelah pukul 13:25 dipadatkan menjadi **35 menit/JP** sehingga berakhir pukul **15:10 WIB**.
   - **Hari Rabu & Kamis:** KBM Jam Ke-1 dimulai pukul `07:15`. Seluruh JP 1–10 berdurasi konsisten **40 menit/JP**, sehingga berakhir tepat pukul **15:10 WIB**.
2. **Hari Jumat Hanya 8 Jam Pelajaran (Pulang Maksimal 13:50 WIB):**
   - KBM dimulai pukul `07:15`.
   - JP 1–5 berdurasi **40 menit/JP**, sedangkan JP 6 (`10:50 - 11:25`) serta JP 7–8 (`12:40 - 13:50`) berdurasi **35 menit/JP**.
   - Istirahat II (Sholat Jumat) berlangsung selama **75 menit** (`11:25 - 12:40`).
   - Tidak ada Jam Ke-9 dan Jam Ke-10 pada hari Jumat (pada `Jadwal_Kelas.pdf` ditandai `-x-`).
3. **Jam Istirahat Konsisten Dua Kali Sehari:**
   - **Istirahat I (Pagi):** Selalu berdurasi **15 menit** setelah Jam Ke-3 berakhir (`09:45 - 10:00` pada Senin, `09:30 - 09:45` pada Selasa, dan `09:15 - 09:30` pada Rabu, Kamis, Jumat).
   - **Istirahat II (Siang/Ishoma):** Berdurasi **60 menit** setelah Jam Ke-6 berakhir (`11:45 - 12:45` pada Senin & Selasa, `11:30 - 12:30` pada Rabu & Kamis), serta **75 menit** pada hari Jumat (`11:25 - 12:40`).
4. **Temuan Anomali Penulisan pada PDF:**
   - **Anomali 1 (Selasa Jam Ke-10):** Pada Halaman 1 hari Selasa, Jam Ke-9 tertulis `14.00 - 14.35`, tetapi Jam Ke-10 tertulis **`14.45 - 15.10`** (terdapat celah waktu 10 menit tanpa keterangan antara `14:35` dan `14:45`, serta durasi JP 10 menjadi 25 menit). Pada hari Senin yang memiliki struktur jam siang identik (Jam 7 `12.45-13.25`, Jam 8 `13.25-14.00`, Jam 9 `14.00-14.35`), Jam Ke-10 tertulis **`14.35 - 15.10`** (35 menit). Hal ini memerlukan konfirmasi apakah `14.45` pada Selasa Jam 10 merupakan salah ketik (*typo*) di PDF yang seharusnya `14.35 - 15.10`.
   - **Anomali 2 (Selasa Jam Ke-2):** Tertulis `08.10 - 0850` (tanpa tanda titik pemisah pada `0850`), yang secara jelas berarti `08:10 - 08:50`.
   - **Anomali 3 (Kelas `XII BR 2` pada Hari Jumat Jam Ke-7 & Ke-8):** Pada `Jadwal_Kelas.pdf` (Halaman 48), kelas `XII BR 2` di hari Jumat hanya memiliki jadwal sampai Jam Ke-6 (`10:50 - 11:25`, Mapel Pilihan BR), sedangkan Jam Ke-7 dan Ke-8 berisi tanda `'---'` (kosong/tidak ada KBM, sehingga siswa kelas `XII BR 2` pulang pukul **11:25 WIB**). Namun pada tabel `Jadwal_Ruangan.pdf` (Halaman 3), kolom `12 BR 2` pada Jam Ke-7 dan Ke-8 masih tertulis kode ruang `L.6`.

---

## 3. Rekap Waktu Asli Setiap Periode Pembelajaran

Berikut adalah rekapitulasi lengkap waktu asli dari `Jadwal_Ruangan.pdf` untuk setiap hari operasional sekolah:

### 3.1. Hari Senin (Dengan Upacara Bendera)
| Urutan / Slot | Jenis Sesi | Waktu Mulai | Waktu Selesai | Durasi | Keterangan |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Pra-KBM** | Kegiatan Pagi | `07:00` | `08:00` | 60 menit | **UPACARA BENDERA** |
| **Jam Ke-1** | KBM (JP 1) | `08:00` | `08:35` | 35 menit | Sesi Pagi 1 |
| **Jam Ke-2** | KBM (JP 2) | `08:35` | `09:10` | 35 menit | Sesi Pagi 1 |
| **Jam Ke-3** | KBM (JP 3) | `09:10` | `09:45` | 35 menit | Sesi Pagi 1 |
| **IST I** | **Istirahat I** | **`09:45`** | **`10:00`** | **15 menit** | **Istirahat Pertama** |
| **Jam Ke-4** | KBM (JP 4) | `10:00` | `10:35` | 35 menit | Sesi Pagi 2 |
| **Jam Ke-5** | KBM (JP 5) | `10:35` | `11:10` | 35 menit | Sesi Pagi 2 |
| **Jam Ke-6** | KBM (JP 6) | `11:10` | `11:45` | 35 menit | Sesi Pagi 2 |
| **IST II** | **Istirahat II** | **`11:45`** | **`12:45`** | **60 menit** | **Istirahat Kedua (Ishoma Dhuhur)** |
| **Jam Ke-7** | KBM (JP 7) | `12:45` | `13:25` | 40 menit | Sesi Siang (40 menit) |
| **Jam Ke-8** | KBM (JP 8) | `13:25` | `14:00` | 35 menit | Sesi Siang |
| **Jam Ke-9** | KBM (JP 9) | `14:00` | `14:35` | 35 menit | Sesi Siang |
| **Jam Ke-10** | KBM (JP 10) | `14:35` | `15:10` | 35 menit | **Jam Pulang Senin: 15:10 WIB** |

### 3.2. Hari Selasa (Dengan Literasi Pagi)
| Urutan / Slot | Jenis Sesi | Waktu Mulai | Waktu Selesai | Durasi | Keterangan |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Pra-KBM** | Kegiatan Pagi | `07:00` | `07:30` | 30 menit | **LITERASI** |
| **Jam Ke-1** | KBM (JP 1) | `07:30` | `08:10` | 40 menit | Sesi Pagi 1 |
| **Jam Ke-2** | KBM (JP 2) | `08:10` | `08:50` | 40 menit | Sesi Pagi 1 (di PDF tertulis `08.10 - 0850`) |
| **Jam Ke-3** | KBM (JP 3) | `08:50` | `09:30` | 40 menit | Sesi Pagi 1 |
| **IST I** | **Istirahat I** | **`09:30`** | **`09:45`** | **15 menit** | **Istirahat Pertama** |
| **Jam Ke-4** | KBM (JP 4) | `09:45` | `10:25` | 40 menit | Sesi Pagi 2 |
| **Jam Ke-5** | KBM (JP 5) | `10:25` | `11:05` | 40 menit | Sesi Pagi 2 |
| **Jam Ke-6** | KBM (JP 6) | `11:05` | `11:45` | 40 menit | Sesi Pagi 2 |
| **IST II** | **Istirahat II** | **`11:45`** | **`12:45`** | **60 menit** | **Istirahat Kedua (Ishoma Dhuhur)** |
| **Jam Ke-7** | KBM (JP 7) | `12:45` | `13:25` | 40 menit | Sesi Siang |
| **Jam Ke-8** | KBM (JP 8) | `13:25` | `14:00` | 35 menit | Sesi Siang |
| **Jam Ke-9** | KBM (JP 9) | `14:00` | `14:35` | 35 menit | Sesi Siang |
| **Jam Ke-10** | KBM (JP 10) | `14:35`* | `15:10` | 35 menit* | *Di PDF tertulis `14.45 - 15.10` (**Butuh Konfirmasi**). **Jam Pulang: 15:10 WIB** |

### 3.3. Hari Rabu & Kamis
| Urutan / Slot | Jenis Sesi | Waktu Mulai | Waktu Selesai | Durasi | Keterangan |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Pra-KBM** | Pembiasaan Pagi | `07:00` | `07:15` | 15 menit | Tadarus / Doa Pagi sebelum JP 1 |
| **Jam Ke-1** | KBM (JP 1) | `07:15` | `07:55` | 40 menit | Sesi Pagi 1 |
| **Jam Ke-2** | KBM (JP 2) | `07:55` | `08:35` | 40 menit | Sesi Pagi 1 |
| **Jam Ke-3** | KBM (JP 3) | `08:35` | `09:15` | 40 menit | Sesi Pagi 1 |
| **IST I** | **Istirahat I** | **`09:15`** | **`09:30`** | **15 menit** | **Istirahat Pertama** |
| **Jam Ke-4** | KBM (JP 4) | `09:30` | `10:10` | 40 menit | Sesi Pagi 2 |
| **Jam Ke-5** | KBM (JP 5) | `10:10` | `10:50` | 40 menit | Sesi Pagi 2 |
| **Jam Ke-6** | KBM (JP 6) | `10:50` | `11:30` | 40 menit | Sesi Pagi 2 |
| **IST II** | **Istirahat II** | **`11:30`** | **`12:30`** | **60 menit** | **Istirahat Kedua (Ishoma Dhuhur)** |
| **Jam Ke-7** | KBM (JP 7) | `12:30` | `13:10` | 40 menit | Sesi Siang |
| **Jam Ke-8** | KBM (JP 8) | `13:10` | `13:50` | 40 menit | Sesi Siang |
| **Jam Ke-9** | KBM (JP 9) | `13:50` | `14:30` | 40 menit | Sesi Siang |
| **Jam Ke-10** | KBM (JP 10) | `14:30` | `15:10` | 40 menit | **Jam Pulang Rabu & Kamis: 15:10 WIB** |

### 3.4. Hari Jumat (Maksimal 8 JP)
| Urutan / Slot | Jenis Sesi | Waktu Mulai | Waktu Selesai | Durasi | Keterangan |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Pra-KBM** | Pembiasaan Pagi | `07:00` | `07:15` | 15 menit | Pembiasaan / Senam / Jumat Bersih |
| **Jam Ke-1** | KBM (JP 1) | `07:15` | `07:55` | 40 menit | Sesi Pagi 1 |
| **Jam Ke-2** | KBM (JP 2) | `07:55` | `08:35` | 40 menit | Sesi Pagi 1 |
| **Jam Ke-3** | KBM (JP 3) | `08:35` | `09:15` | 40 menit | Sesi Pagi 1 |
| **IST I** | **Istirahat I** | **`09:15`** | **`09:30`** | **15 menit** | **Istirahat Pertama** |
| **Jam Ke-4** | KBM (JP 4) | `09:30` | `10:10` | 40 menit | Sesi Pagi 2 |
| **Jam Ke-5** | KBM (JP 5) | `10:10` | `10:50` | 40 menit | Sesi Pagi 2 |
| **Jam Ke-6** | KBM (JP 6) | `10:50` | `11:25` | 35 menit | Sesi Pagi 2 (35 menit; jam pulang `XII BR 2`) |
| **IST II** | **Istirahat II** | **`11:25`** | **`12:40`** | **75 menit** | **Istirahat Sholat Jumat** |
| **Jam Ke-7** | KBM (JP 7) | `12:40` | `13:15` | 35 menit | Sesi Siang (35 menit) |
| **Jam Ke-8** | KBM (JP 8) | `13:15` | `13:50` | 35 menit | **Jam Pulang Jumat Reguler: 13:50 WIB** |
| **Jam Ke-9** | *Tidak Ada (`-x-`)* | — | — | — | Di luar alokasi KBM hari Jumat |
| **Jam Ke-10** | *Tidak Ada (`-x-`)* | — | — | — | Di luar alokasi KBM hari Jumat |

---

## 4. Perbandingan Waktu PDF dengan Konfigurasi Sistem Saat Ini

Tabel berikut memperlihatkan perbandingan langsung antara konfigurasi sistem SCP saat ini ([`PeriodTemplateSeeder.php`](file:///d:/MyUKK/SchoolClassProject/scp/database/seeders/PeriodTemplateSeeder.php) & [`timetableHelper.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/timetableHelper.js)) dengan waktu asli pada [`Jadwal_Ruangan.pdf`](file:///d:/MyUKK/SchoolClassProject/scp/MD/PDF/Jadwal_Ruangan.pdf):

| Hari / Slot | Waktu Sistem Saat Ini (`period_templates`) | Waktu Asli PDF (`Jadwal_Ruangan.pdf`) | Selisih / Ketidaksesuaian |
| :--- | :---: | :---: | :--- |
| **SENIN (`senin_upacara`)** | | | |
| Durasi per JP | 45 menit rata | **35 menit** (JP 7 = 40 mnt) | Durasi per JP kelebihan 10 menit |
| Jam Ke-1 s/d Ke-3 | `08:00 - 10:15` | **`08:00 - 09:45`** | Meleset 30 menit di akhir sesi pagi 1 |
| Istirahat I | `10:15 - 10:45` (30 mnt) | **`09:45 - 10:00` (15 mnt)** | Istirahat I di sistem kelebihan 15 menit |
| Jam Ke-4 s/d Ke-6 | `10:45 - 13:45` (terpotong istirahat di JP 5) | **`10:00 - 11:45`** | Di sistem Istirahat II ditaruh setelah JP 5, padahal di PDF setelah JP 6! |
| Istirahat II | `12:15 - 13:00` (setelah JP 5) | **`11:45 - 12:45` (setelah JP 6)** | Posisi & durasi Istirahat II salah |
| Jam Ke-7 s/d Ke-10 | `13:45 - 16:45` | **`12:45 - 15:10`** | **Jam pulang meleset +95 menit (16:45 vs 15:10)** |
| **SELASA (`selasa`)** | | | |
| Durasi per JP | 45 menit rata | **40 menit (JP 1–7), 35 menit (JP 8–10)** | Durasi per JP kelebihan 5–10 menit |
| Jam Ke-1 s/d Ke-3 | `07:30 - 09:45` | **`07:30 - 09:30`** | Meleset 15 menit |
| Istirahat I | `09:45 - 10:15` (30 mnt) | **`09:30 - 09:45` (15 mnt)** | Istirahat I kelebihan 15 menit |
| Jam Ke-4 s/d Ke-6 | `10:15 - 13:15` (terpotong istirahat di JP 5) | **`09:45 - 11:45`** | Di sistem Istirahat II ditaruh setelah JP 5, padahal di PDF setelah JP 6! |
| Istirahat II | `11:45 - 12:30` (45 mnt, setelah JP 5) | **`11:45 - 12:45` (60 mnt, setelah JP 6)** | Posisi & durasi Istirahat II salah |
| Jam Ke-7 s/d Ke-10 | `13:15 - 16:15` | **`12:45 - 15:10`** | **Jam pulang meleset +65 menit (16:15 vs 15:10)** |
| **RABU & KAMIS (`rabu_kamis`)** | | | |
| Durasi per JP | 45 menit rata | **40 menit rata** | Durasi per JP kelebihan 5 menit |
| Jam Ke-1 s/d Ke-3 | `07:15 - 09:30` | **`07:15 - 09:15`** | Meleset 15 menit |
| Istirahat I | `09:30 - 10:00` (30 mnt) | **`09:15 - 09:30` (15 mnt)** | Istirahat I kelebihan 15 menit |
| Jam Ke-4 s/d Ke-6 | `10:00 - 12:15` | **`09:30 - 11:30`** | Meleset 45 menit |
| Istirahat II | `12:15 - 13:00` (45 mnt) | **`11:30 - 12:30` (60 mnt)** | Waktu & durasi Istirahat II berbeda |
| Jam Ke-7 s/d Ke-10 | `13:00 - 16:00` | **`12:30 - 15:10`** | **Jam pulang meleset +50 menit (16:00 vs 15:10)** |
| **JUMAT (`jumat`)** | | | |
| Jumlah Periode Aktif | 10 JP (JP 1 s/d JP 10) | **8 JP (JP 1 s/d JP 8)** | Kelebihan 2 periode fiktif (JP 9 & 10) |
| Istirahat I | `09:15 - 09:45` (30 mnt) | **`09:15 - 09:30` (15 mnt)** | Istirahat I kelebihan 15 menit |
| Jam Ke-4 s/d Ke-6 | `09:45 - 11:45` (40 mnt/JP) | **`09:30 - 11:25` (JP 6 = 35 mnt)** | Selesai sesi pagi meleset 20 menit |
| Istirahat II (Jumat) | `11:45 - 13:00` (75 mnt) | **`11:25 - 12:40` (75 mnt)** | Bergeser 20 menit |
| Jam Ke-7 s/d Ke-8 | `13:00 - 14:20` (40 mnt/JP) | **`12:40 - 13:50` (35 mnt/JP)** | **Jam pulang Jumat meleset +30 s/d +110 menit** |

---

## 5. Identifikasi Penyebab Ketidaksesuaian

Berdasarkan evaluasi menyeluruh terhadap kode backend dan frontend SCP, ditemukan **5 akar penyebab teknis** mengapa jadwal yang tampil tidak sesuai dengan PDF Jadwal Ruangan:

1. **Kesalahan Referensi Waktu Awal pada `PeriodTemplateSeeder.php`:**
   - Pada saat pengembangan awal, tabel `period_templates` diisi mengacu pada angka jam yang tercetak di kolom kiri `Jadwal_Kelas.pdf` hasil ekspor *software* FET (`07:15`, `08:00`, `08:45`, ..., `14:45 - 16:00`).
   - Padahal di *software* FET, angka tersebut hanyalah label urutan baris (1 s/d 10) dengan asumsi statis 45 menit/JP, sedangkan jadwal operasional riil sekolah dengan pembedaan durasi per hari (35/40 menit) dituangkan secara resmi di `Jadwal_Ruangan.pdf`.
2. **Kesalahan Posisi Istirahat II pada Hari Senin dan Selasa di `PeriodTemplateSeeder.php`:**
   - Pada `PeriodTemplateSeeder.php` saat ini, untuk hari `senin_upacara` dan `selasa`, Istirahat II diletakkan di antara **Jam Ke-5 dan Jam Ke-6**, sedangkan di `Jadwal_Ruangan.pdf` Istirahat II pada seluruh hari (Senin s/d Jumat) selalu terletak di antara **Jam Ke-6 dan Jam Ke-7**.
3. **Pengabaian Kolom `Waktu` pada Script Parser Python (`scp/script/pdf_parser.py`):**
   - Pada fungsi `parse_ruangan_pdf()` ([`pdf_parser.py`](file:///d:/MyUKK/SchoolClassProject/scp/script/pdf_parser.py#L96-L132)), pembacaan kolom langsung melompat dari `row[1]` (`Jam`) ke `range(3, len(row))` (kolom kelas), sehingga `row[2]` yang berisi **`Waktu`** (`08.00 - 08.35`, dst.) serta baris `IST` (`ISTIRAHAT I`, `ISTIRAHAT II`) tidak pernah diekstrak maupun divalidasi.
4. **Bug Resolusi Hari pada `ScheduleController.php` dan `PeriodResolutionService.php`:**
   - Pada [`ScheduleController.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/ScheduleController.php#L219), setiap item jadwal dipetakan menggunakan:
     ```php
     $scheduleArray['resolved_times'] = $this->periodResolver->getScheduleTimes($schedule, $referenceDate);
     ```
   - Di dalam [`PeriodResolutionService::getScheduleTimes()`](file:///d:/MyUKK/SchoolClassProject/scp/app/Services/PeriodResolutionService.php#L61-L86), penentuan `day_type` memanggil `resolveDayType($date)` yang menggunakan `$date->dayOfWeekIso` (hari dari tanggal referensi saat API dipanggil), **bukan `$schedule->day_of_week`** (hari milik jadwal itu sendiri).
   - **Dampak fatal:**
     - Jika pengguna membuka jadwal mingguan pada hari Senin, maka jadwal hari Selasa, Rabu, Kamis, dan Jumat semuanya dihitung menggunakan jam hari Senin!
     - Jika pengguna membuka jadwal pada hari Sabtu atau Minggu (`dayOfWeekIso = 6` atau `7`), `resolveDayType()` mengembalikan `null`, sehingga seluruh `resolved_times` bernilai `null`!
5. **Duplikasi Hardcode Slot & Rumus Fallback Kasar di Frontend:**
   - File [`timetableHelper.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/timetableHelper.js#L130-L205) menyimpan konstanta `MONDAY_CEREMONY_SLOTS`, `SENIN_REGULER_SLOTS`, `TUESDAY_SLOTS`, `STANDARD_SLOTS`, dan `FRIDAY_SLOTS` dengan durasi 45 menit/JP (berakhir pukul 16:00–16:45) serta 10 slot pada hari Jumat.
   - File [`StudentHomePage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/student/StudentHomePage.jsx#L135-L145) dan [`TeacherDashboardPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherDashboardPage.jsx#L153-L164) memiliki fungsi `formatScheduleTime()` yang menggunakan rumus `7 + (period - 1) * 0.75` (asumsi 45 menit/JP tanpa istirahat) apabila `resolved_times` bernilai `null`.

---

## 6. Rancangan Mekanisme Penyesuaian Waktu

Untuk memastikan sistem bekerja akurat sesuai `Jadwal_Ruangan.pdf` di seluruh kondisi operasional, dirancang mekanisme terpadu sebagai berikut:

### 6.1. Pembaruan Master `period_templates` Sesuai Waktu Asli PDF
Memperbarui data `period_templates` agar merepresentasikan waktu mulai dan selesai setiap periode secara presisi:
1. **`senin_upacara` (10 Periode):**
   - JP 1: `08:00:00 - 08:35:00` | JP 2: `08:35:00 - 09:10:00` | JP 3: `09:10:00 - 09:45:00`
   - *(Istirahat I: `09:45 - 10:00`)*
   - JP 4: `10:00:00 - 10:35:00` | JP 5: `10:35:00 - 11:10:00` | JP 6: `11:10:00 - 11:45:00`
   - *(Istirahat II: `11:45 - 12:45`)*
   - JP 7: `12:45:00 - 13:25:00` | JP 8: `13:25:00 - 14:00:00` | JP 9: `14:00:00 - 14:35:00` | JP 10: `14:35:00 - 15:10:00`
2. **`senin_reguler` (10 Periode — Saat Upacara Senin Nonaktif):**
   - Menyesuaikan dengan pola reguler 40 menit/JP (`07:15:00 - 15:10:00`) atau tetap `08:00:00 - 15:10:00` dengan pembinaan pagi (menunggu konfirmasi Anda pada Bagian 13).
3. **`selasa` (10 Periode):**
   - JP 1: `07:30:00 - 08:10:00` | JP 2: `08:10:00 - 08:50:00` | JP 3: `08:50:00 - 09:30:00`
   - *(Istirahat I: `09:30 - 09:45`)*
   - JP 4: `09:45:00 - 10:25:00` | JP 5: `10:25:00 - 11:05:00` | JP 6: `11:05:00 - 11:45:00`
   - *(Istirahat II: `11:45 - 12:45`)*
   - JP 7: `12:45:00 - 13:25:00` | JP 8: `13:25:00 - 14:00:00` | JP 9: `14:00:00 - 14:35:00` | JP 10: `14:35:00 - 15:10:00` *(atau `14:45:00 - 15:10:00` sesuai konfirmasi Bagian 13)*.
4. **`rabu_kamis` (10 Periode):**
   - JP 1: `07:15:00 - 07:55:00` | JP 2: `07:55:00 - 08:35:00` | JP 3: `08:35:00 - 09:15:00`
   - *(Istirahat I: `09:15 - 09:30`)*
   - JP 4: `09:30:00 - 10:10:00` | JP 5: `10:10:00 - 10:50:00` | JP 6: `10:50:00 - 11:30:00`
   - *(Istirahat II: `11:30 - 12:30`)*
   - JP 7: `12:30:00 - 13:10:00` | JP 8: `13:10:00 - 13:50:00` | JP 9: `13:50:00 - 14:30:00` | JP 10: `14:30:00 - 15:10:00`
5. **`jumat` (Hanya 8 Periode — JP 1 s/d JP 8):**
   - JP 1: `07:15:00 - 07:55:00` | JP 2: `07:55:00 - 08:35:00` | JP 3: `08:35:00 - 09:15:00`
   - *(Istirahat I: `09:15 - 09:30`)*
   - JP 4: `09:30:00 - 10:10:00` | JP 5: `10:10:00 - 10:50:00` | JP 6: `10:50:00 - 11:25:00`
   - *(Istirahat II / Sholat Jumat: `11:25 - 12:40`)*
   - JP 7: `12:40:00 - 13:15:00` | JP 8: `13:15:00 - 13:50:00`
   - *(Periode 9 dan 10 dihapus dari `day_type = 'jumat'` agar sistem mengenali bahwa hari Jumat hanya memiliki 8 JP dan slot 9–10 otomatis berstatus `-x-` / di luar jam KBM).*

### 6.2. Perbaikan Resolusi Waktu Berdasarkan Hari Jadwal (`day_of_week`)
- Memperbaiki `PeriodResolutionService::getScheduleTimes(Schedule $schedule, ?Carbon $date = null)` agar menentukan `day_type` berdasarkan **`$schedule->day_of_week`** (1 = Senin s/d 5 = Jumat), bukan semata-mata hari dari `$date` saat request dilakukan.
- Dengan demikian:
  - Jadwal hari Senin selalu di-resolve dengan template Senin (`senin_upacara` atau `senin_reguler`).
  - Jadwal hari Selasa selalu di-resolve dengan template `selasa`.
  - Jadwal hari Rabu & Kamis selalu di-resolve dengan template `rabu_kamis`.
  - Jadwal hari Jumat selalu di-resolve dengan template `jumat`.
  - Resolusi waktu tetap berjalan akurat meskipun diakses pada hari Sabtu/Minggu.

### 6.3. Perhitungan Jam Pulang Dinamis Berdasarkan Sesi Terakhir
- Jam pulang suatu kelas pada suatu hari **tidak pernah di-hardcode**, melainkan dihitung secara dinamis dari `end_time` sesi pembelajaran terakhir yang terjadwal pada kelas dan hari tersebut:
  $$\text{Jam Pulang}(kelas, hari) = \max_{s \in \text{Jadwal}(kelas, hari)} \big(\text{end\_time}(s.\text{period\_number} + s.\text{duration\_periods} - 1)\big)$$
- Contoh hasil perhitungan otomatis:
  - Kelas `X RPL 1` pada hari Senin (sesi terakhir selesai di JP 10) &rarr; Jam pulang = **`15:10 WIB`**.
  - Kelas `X RPL 1` pada hari Jumat (sesi terakhir selesai di JP 8) &rarr; Jam pulang = **`13:50 WIB`**.
  - Kelas `XII BR 2` pada hari Jumat (sesi terakhir selesai di JP 6 karena JP 7–8 kosong `---`) &rarr; Jam pulang = **`11:25 WIB`**.

### 6.4. Representasi Waktu Istirahat (Break Intervals)
- Menyediakan metadata waktu istirahat resmi per `day_type` (baik melalui API `/api/period-templates` atau konstanta terstruktur di `timetableHelper.js`):
  - **Istirahat I:** Setelah Jam Ke-3 (`09:45-10:00` Senin, `09:30-09:45` Selasa, `09:15-09:30` Rabu–Jumat).
  - **Istirahat II:** Setelah Jam Ke-6 (`11:45-12:45` Senin–Selasa, `11:30-12:30` Rabu–Kamis, `11:25-12:40` Jumat).
- Jika suatu jadwal multi-JP melintasi waktu istirahat (misalnya jadwal 4 JP dari Jam Ke-3 s/d Jam Ke-6), rentang waktu mulai–selesai tetap menggunakan `start_time` JP awal dan `end_time` JP akhir sesuai tabel PDF, sembari sistem memahami adanya jeda istirahat di antaranya.

---

## 7. Rancangan Validasi dan Pencocokan Data

Untuk menjamin integritas antara dokumen PDF dan database, dirancang mekanisme ekstraksi dan validasi berlapis:

### 7.1. Ekstraksi & Validasi Waktu pada `pdf_parser.py`
1. Memperbarui `parse_ruangan_pdf()` pada [`scp/script/pdf_parser.py`](file:///d:/MyUKK/SchoolClassProject/scp/script/pdf_parser.py) agar membaca kolom `Waktu` (`row[2]`) untuk setiap baris periode (`1..10`), baris kegiatan pagi (`UPACARA BENDERA`, `LITERASI`), dan baris istirahat (`IST`).
2. Menormalisasi format waktu PDF (mengubah titik `.` menjadi `:`, memperbaiki penulisan tanpa titik seperti `0850` menjadi `08:50`, dan menghapus spasi berlebih seperti `08.00 -08.35` menjadi `08:00 - 08:35`).
3. Mengecek konsistensi kronologis:
   - Memastikan setiap periode memiliki `start_time < end_time`.
   - Memastikan `end_time` periode $k$ sama dengan `start_time` periode $k+1$ (atau sama dengan `start_time` Istirahat jika diselingi `IST`).
   - Memperingatkan (*warning report*) apabila ditemukan celah waktu tak bertuan (seperti anomali Selasa Jam Ke-9 `14:00 - 14:35` ke Jam Ke-10 `14:45 - 15:10`).

### 7.2. Validasi Silang `Jadwal_Kelas.pdf` vs `Jadwal_Ruangan.pdf`
1. Memeriksa apakah setiap sel `(kelas, hari, jam_ke)` yang terisi mata pelajaran di `Jadwal_Kelas.pdf` memiliki alokasi ruangan di `Jadwal_Ruangan.pdf`.
2. Memeriksa sebaliknya: apakah ada sel di `Jadwal_Ruangan.pdf` yang mencantumkan ruangan padahal di `Jadwal_Kelas.pdf` sel tersebut bertanda kosong (`---` atau `-x-`), seperti kasus **`XII BR 2` Hari Jumat Jam Ke-7 & Ke-8** (di `Jadwal_Kelas.pdf` kosong `---`, di `Jadwal_Ruangan.pdf` tertulis `L.6`).
3. Memastikan tidak ada jadwal pada hari Jumat yang menempati Jam Ke-9 atau Jam Ke-10.

### 7.3. Validasi Terhadap Data Jadwal yang Sudah Tersimpan di Database
Dari hasil pemeriksaan *read-only* terhadap tabel `schedules` yang saat ini sudah tersimpan di database SCP:
- **Putaran 1:** Terdapat total **721 baris jadwal** (Senin: 151, Selasa: 148, Rabu: 145, Kamis: 152, Jumat: 125).
- Rentang periode pada Senin–Kamis adalah `period_number` 1 s/d 10.
- Rentang periode pada Jumat adalah `period_number` 1 s/d 8 (tidak ada data jadwal hari Jumat yang melebihi periode 8).
- Karena tabel `schedules` menyimpan nomor periode (`period_number` dan `duration_periods`) dan me-resolve waktu secara dinamis melalui `period_templates`, **tidak ada data jadwal kelas/guru/ruangan yang rusak atau perlu dihapus**, melainkan seluruh 721 jadwal tersebut akan langsung memiliki waktu mulai, waktu selesai, dan jam pulang yang akurat begitu `period_templates` dan `PeriodResolutionService` diperbarui.

---

## 8. Analisis Dampak terhadap Fitur Lain

Berikut adalah analisis dampak revisi waktu terhadap seluruh modul di ekosistem SCP:

| No | Fitur / Halaman | Dampak Revisi Waktu | Tindakan Penyesuaian |
| :-: | :--- | :--- | :--- |
| 1 | **Jadwal Waka Kurikulum** (`ScheduleManagementPage.jsx`) | Kartu jadwal saat ini menampilkan waktu hingga `16:00 / 16:45`, dan pada hari Jumat menampilkan slot kosong untuk Jam Ke-9 & Ke-10. | Dengan pembaruan `period_templates` dan `timetableHelper.js`, kartu jadwal otomatis menampilkan waktu asli PDF (selesai `15:10` Senin–Kamis, `13:50` Jumat) dan slot 9–10 Jumat otomatis bertanda `-x-` (*off*). |
| 2 | **Jadwal Mengajar Guru** (`TeacherSchedulePage.jsx`) | Jam mengajar guru pada matriks maupun modal detail bergeser ke waktu riil PDF. | Otomatis tersinkronisasi melalui `ScheduleTimetableMatrix` dan `resolveSlotTime()`. |
| 3 | **Jadwal Pelajaran Siswa** (`StudentSchedulePage.jsx`) | Waktu tiap sesi pelajaran dan modal detail sesi mengikuti waktu asli PDF. | Otomatis tersinkronisasi; dapat ditambahkan indikator jam istirahat dan jam pulang harian per hari. |
| 4 | **Beranda Siswa & Dashboard Guru** (`StudentHomePage.jsx`, `TeacherDashboardPage.jsx`) | Daftar "Jadwal Pembelajaran Hari Ini" mengambil waktu dari `item.resolved_times`. | Setelah bug `PeriodResolutionService` diperbaiki dan fallback `formatScheduleTime` diarahkan ke `resolveSlotTime()`, jam sesi hari ini tampil 100% akurat di semua hari. |
| 5 | **Dashboard Akademik Waka & Monitoring Keterlambatan Jurnal** (`ScheduleController@index`) | Batas waktu toleransi keterlambatan pengisian jurnal adalah `end_time + 30 menit` (`isSchedulePastTolerance`). | Dengan waktu PDF yang lebih awal (mis. JP 10 selesai `15:10` bukan `16:00`), batas toleransi jurnal JP 10 menjadi **`15:40 WIB`** (bukan `16:30`). Deteksi keterlambatan jurnal menjadi jauh lebih presisi sesuai jam operasional nyata. |
| 6 | **Jurnal Mengajar & Presensi Siswa** (`JournalController`, `AttendanceController`, `TeacherJournalPage.jsx`) | Jurnal dan presensi terikat pada `schedule_id` dan `date` (bukan timestamp jam statis). | **Aman 100%.** Seluruh riwayat jurnal dan presensi yang sudah tersimpan tidak akan rusak atau kehilangan relasi. |
| 7 | **Rekap Kegiatan & Monitoring Orang Tua** (`MonitoringRecapPage.jsx`, `ParentMonitoringPage.jsx`) | Menampilkan status kehadiran dan jam sesi pembelajaran. | Tetap kompatibel penuh; jam sesi yang ditampilkan mengacu pada template periode terbaru. |
| 8 | **Kalender Akademik** (`AcademicCalendarExclusionService`) | Pengecualian KBM berbasis tanggal (`start_date` s/d `end_date`) dan tingkat/kelas. | Tidak terpengaruh secara negatif; perbaikan `ScheduleController` justru memastikan resolusi tanggal jadwal mingguan (`$scheduleDate`) dan resolusi jam berjalan selaras. |

---

## 9. Kebutuhan Perubahan Backend dan Frontend

### 9.1. Backend (Laravel)
1. **[`scp/database/seeders/PeriodTemplateSeeder.php`](file:///d:/MyUKK/SchoolClassProject/scp/database/seeders/PeriodTemplateSeeder.php):**
   - Memperbarui daftar waktu `start_time` dan `end_time` untuk `senin_upacara`, `senin_reguler`, `selasa`, `rabu_kamis` (masing-masing 10 periode, selesai `15:10:00`) dan `jumat` (8 periode, selesai `13:50:00`), serta menghapus periode 9 dan 10 pada `day_type = 'jumat'`.
2. **[`scp/app/Services/PeriodResolutionService.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Services/PeriodResolutionService.php):**
   - Menambahkan metode `resolveDayTypeForDayOfWeek(int $dayOfWeek, ?bool $mondayIsUpacara = null): ?string`.
   - Memperbarui `getScheduleTimes(Schedule $schedule, ?Carbon $date = null)` agar memprioritaskan `$schedule->day_of_week` dalam menentukan `day_type`, sehingga resolusi jam selalu akurat sesuai hari jadwal tersebut.
3. **[`scp/app/Http/Controllers/API/ScheduleController.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/ScheduleController.php):**
   - Memastikan pemetaan `resolved_times` pada endpoint `GET /api/schedules` menggunakan `$scheduleDate` / `$schedule->day_of_week` yang tepat.
   - Memvalidasi pada `store()` dan `update()` bahwa jadwal hari Jumat (`day_of_week = 5`) tidak boleh melebihi periode ke-8 (`period_number + duration_periods - 1 <= 8`).
4. **[`scp/script/pdf_parser.py`](file:///d:/MyUKK/SchoolClassProject/scp/script/pdf_parser.py):**
   - Menambahkan fungsi ekstraksi waktu dan istirahat dari kolom `Waktu` (`row[2]`) pada `Jadwal_Ruangan.pdf` untuk keperluan validasi otomatis saat proses import PDF.

### 9.2. Frontend (React)
1. **[`frontend/scp_web/src/utils/timetableHelper.js`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/utils/timetableHelper.js):**
   - Memperbarui konstanta `MONDAY_CEREMONY_SLOTS`, `SENIN_REGULER_SLOTS`, `TUESDAY_SLOTS`, `STANDARD_SLOTS` (10 slot sesuai PDF, selesai `15:10`), dan `FRIDAY_SLOTS` (8 slot sesuai PDF, selesai `13:50`).
   - Menambahkan konstanta/helper `BREAK_SCHEDULES` (jadwal Istirahat I dan Istirahat II per tipe hari) dan helper `getDismissalTimeForDay(schedules, dayName, mondayIsUpacara, periodTemplates)` untuk menghitung jam pulang aktual berdasarkan sesi terakhir yang dijadwalkan.
2. **[`frontend/scp_web/src/components/schedule/ScheduleTimetableMatrix.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/schedule/ScheduleTimetableMatrix.jsx) & [`ScheduleManagementPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx):**
   - Menampilkan informasi rentang waktu riil pada kolom slot apabila difilter pada satu hari spesifik, serta menampilkan indikator baris/informasi waktu **Istirahat I** (setelah Jam Ke-3) dan **Istirahat II** (setelah Jam Ke-6).
3. **[`frontend/scp_web/src/pages/student/StudentHomePage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/student/StudentHomePage.jsx) & [`frontend/scp_web/src/pages/teacher/TeacherDashboardPage.jsx`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherDashboardPage.jsx):**
   - Mengganti rumus fallback manual `45 menit` di `formatScheduleTime()` dengan pemanggilan `resolveSlotTime()` dari `timetableHelper.js`.

---

## 10. Kebutuhan Perubahan Database

- **Struktur Tabel (Schema Migration): TIDAK DIPERLUKAN PERUBAHAN STRUKTUR TABEL.**
  - Tabel `period_templates` saat ini (`id`, `day_type`, `period_number`, `start_time`, `end_time`, `created_at`, `updated_at`) dengan *unique index* `(day_type, period_number)` sudah 100% mendukung penyimpanan waktu bervariasi per periode (baik 35 menit maupun 40 menit) dan mendukung jumlah periode berbeda antarhari (10 periode untuk Senin–Kamis, 8 periode untuk Jumat).
- **Pembaruan Data Konfigurasi (`period_templates`):**
  - Cukup dijalankan melalui pembaruan [`PeriodTemplateSeeder.php`](file:///d:/MyUKK/SchoolClassProject/scp/database/seeders/PeriodTemplateSeeder.php) (menggunakan `upsert` + penghapusan record `day_type = 'jumat'` untuk `period_number IN (9, 10)`).
  - **Tidak ada penghapusan atau reset** terhadap tabel `schedules`, `journals`, `attendances`, maupun `users`.

---

## 11. Skenario Pengujian dan Kriteria Keberhasilan

### 11.1. Skenario Pengujian (Unit, Feature & UI)
1. **Unit Test `PeriodResolutionServiceTest`:**
   - Menguji resolusi waktu `senin_upacara` JP 1 (`08:00:00 - 08:35:00`), JP 7 (`12:45:00 - 13:25:00`), dan JP 10 (`14:35:00 - 15:10:00`).
   - Menguji resolusi waktu `selasa` JP 1 (`07:30:00 - 08:10:00`), JP 8 (`13:25:00 - 14:00:00`), dan JP 10 (selesai `15:10:00`).
   - Menguji resolusi waktu `rabu_kamis` JP 1 (`07:15:00 - 07:55:00`) s/d JP 10 (`14:30:00 - 15:10:00`).
   - Menguji resolusi waktu `jumat` JP 1 (`07:15:00 - 07:55:00`), JP 6 (`10:50:00 - 11:25:00`), dan JP 8 (`13:15:00 - 13:50:00`).
   - Menguji bahwa `getScheduleTimes()` tetap mengembalikan waktu yang benar untuk jadwal hari Senin–Jumat meskipun dipanggil ketika tanggal referensi berada di hari Minggu.
2. **Feature Test `PeriodResolutionTest` & `ScheduleReadAndAlertTest`:**
   - Memastikan perhitungan *missing journal alert* (`end_time + 30 menit`) mengikuti waktu PDF baru.
   - Memastikan respons `GET /api/schedules` mengirimkan `resolved_times` yang sesuai dengan `day_of_week` masing-masing item jadwal.
3. **Verifikasi UI Multi-Role (Waka, Guru, Siswa):**
   - Memastikan tidak ada lagi jadwal yang menampilkan jam selesai pukul `16:00`, `16:15`, atau `16:45`.
   - Memastikan pada matriks jadwal hari Jumat, slot Jam Ke-9 dan Ke-10 otomatis ditandai `-x-` (di luar jam KBM).

### 11.2. Kriteria Keberhasilan
- Seluruh waktu mulai dan selesai setiap periode di seluruh halaman (Waka, Guru, Siswa, Dashboard) cocok 100% dengan `Jadwal_Ruangan.pdf`.
- Jam pulang terakhir untuk Senin–Kamis adalah **15:10 WIB**, Jumat reguler adalah **13:50 WIB**, dan untuk kelas yang selesai lebih awal (seperti `XII BR 2` di hari Jumat) mengikuti sesi terakhirnya (**11:25 WIB**).
- Seluruh pengujian otomatis PHPUnit dan build produksi Vite berjalan lulus 100% tanpa regresi.

---

## 12. Tahapan Implementasi

Setelah Anda memberikan persetujuan atas rencana ini, implementasi akan dilakukan secara bertahap:
1. **Tahap 1 — Pembaruan Seeder & Data `period_templates`:** Memperbarui `PeriodTemplateSeeder.php` sesuai waktu asli PDF, menghapus slot 9–10 pada hari Jumat di tabel `period_templates`, dan menjalankan seeder tanpa menyentuh data jadwal (`schedules`).
2. **Tahap 2 — Perbaikan Layanan Resolusi Waktu Backend:** Memperbarui `PeriodResolutionService.php` dan `ScheduleController.php` agar resolusi waktu selalu berbasis `day_of_week` jadwal dan memvalidasi batas 8 JP pada hari Jumat.
3. **Tahap 3 — Pembaruan Utilitas & Komponen Jadwal Frontend:** Memperbarui `timetableHelper.js`, `StudentHomePage.jsx`, `TeacherDashboardPage.jsx`, `ScheduleTimetableMatrix.jsx`, dan `ScheduleManagementPage.jsx` (termasuk visualisasi waktu istirahat & jam pulang).
4. **Tahap 4 — Peningkatan Parser & Validasi PDF:** Memperbarui `pdf_parser.py` agar turut mengekstrak dan memvalidasi kolom `Waktu` dari `Jadwal_Ruangan.pdf`.
5. **Tahap 5 — Penyesuaian Unit/Feature Test & Verifikasi Menyeluruh:** Memperbarui asersi waktu pada `PeriodResolutionTest.php` dan `PeriodResolutionServiceTest.php`, lalu menjalankan seluruh test suite serta build frontend.

---

## 13. Daftar Masalah dan Keputusan yang Memerlukan Konfirmasi Anda

Sebelum saya memulai implementasi, mohon konfirmasi keputusan Anda untuk **4 poin temuan berikut**:

### Keputusan 1: Anomali Waktu Hari Selasa Jam Ke-10 pada `Jadwal_Ruangan.pdf`
Pada `Jadwal_Ruangan.pdf` Halaman 1 (Hari Selasa), tertulis:
- Jam Ke-8: `13.25 - 14.00` (35 menit)
- Jam Ke-9: `14.00 - 14.35` (35 menit)
- Jam Ke-10: **`14.45 - 15.10`** (ada jeda kosong 10 menit dari `14.35` ke `14.45`, dan durasi menjadi 25 menit; sedangkan pada hari Senin dengan pola jam siang yang identik tertulis **`14.35 - 15.10`** [35 menit]).
- **Opsi A (Direkomendasikan):** Gunakan **`14:35 - 15:10`** (35 menit, menyambung langsung dari akhir Jam Ke-9 `14:35` tanpa celah waktu hilang, konsisten dengan hari Senin).
- **Opsi B:** Ikuti teks literal PDF apa adanya yaitu **`14:45 - 15:10`** (25 menit, dengan jeda 10 menit antara Jam Ke-9 dan Jam Ke-10).

### Keputusan 2: Pengaturan Waktu untuk Mode `senin_reguler` (Saat Upacara Hari Senin Dinonaktifkan)
Di `Jadwal_Ruangan.pdf`, tabel hari Senin mencantumkan jadwal dengan Upacara Bendera (`07:00 - 08:00`, KBM mulai `08:00 - 15:10`). Namun sistem SCP memiliki tombol *toggle* **Upacara Hari Senin (Aktif / Nonaktif)**. Jika pada minggu tertentu Upacara Hari Senin diatur **Nonaktif** (`senin_reguler`):
- **Opsi A (Direkomendasikan):** Gunakan struktur waktu reguler seperti hari Rabu/Kamis (`07:15 - 15:10`, 40 menit/JP, Istirahat I `09:15-09:30`, Istirahat II `11:30-12:30`), sehingga KBM dimulai pukul `07:15` dan jam pulang tetap pukul **`15:10 WIB`**.
- **Opsi B:** Gunakan struktur waktu yang sama persis dengan `senin_upacara` (`08:00 - 15:10`, 35 menit/JP), di mana slot `07:00 - 08:00` dialihkan untuk Pembinaan Wali Kelas / Apel Pagi.

### Keputusan 3: Penanganan Ketidaksesuaian Data Kelas `XII BR 2` pada Hari Jumat Jam Ke-7 & Ke-8
Dari hasil pencocokan silang kedua PDF:
- Pada `Jadwal_Kelas.pdf` (Halaman 48), kelas **`XII BR 2`** hari Jumat hanya memiliki KBM sampai Jam Ke-6 (`10:50 - 11:25`), sedangkan Jam Ke-7 dan Ke-8 berisi tanda `'---'` (kosong/tidak ada KBM).
- Pada `Jadwal_Ruangan.pdf` (Halaman 3), kolom `12 BR 2` pada Jam Ke-7 dan Ke-8 masih mencantumkan ruang `L.6`.
- Saat ini di database SCP, jadwal `XII BR 2` hari Jumat mengikuti `Jadwal_Kelas.pdf` (berakhir di Jam Ke-6 pukul **`11:25 WIB`** karena tidak ada mapel/guru di Jam 7–8).
- **Opsi A (Direkomendasikan):** Pertahankan mengikuti `Jadwal_Kelas.pdf` (selesai di Jam Ke-6 pukul `11:25 WIB`), dan tandai perbedaan ruangan tanpa KBM tersebut sebagai *warning/info* pada validator import.
- **Opsi B:** Perlakukan sebagai konflik yang wajib diselesaikan manual saat import.

### Keputusan 4: Tampilan Baris Waktu Istirahat pada Tabel Matriks Jadwal Frontend
Saat ini matriks jadwal (`ScheduleTimetableMatrix`) menampilkan baris `Jam Masuk (07:00 WIB)` diikuti langsung oleh baris `Jam Ke-1` s/d `Jam Ke-10` tanpa pemisah visual untuk **Istirahat I** (setelah Jam Ke-3) dan **Istirahat II** (setelah Jam Ke-6).
- **Opsi A (Direkomendasikan):** Tambahkan baris pemisah visual ringan (*subtle break row*) untuk **Istirahat I** (setelah Jam Ke-3) dan **Istirahat II / Ishoma** (setelah Jam Ke-6) lengkap dengan keterangan jam istirahat masing-masing hari agar struktur tabel di website selaras dengan tampilan `Jadwal_Ruangan.pdf`.
- **Opsi B:** Jangan tambahkan baris istirahat di tengah tabel matriks; cukup tampilkan informasi jam istirahat pada bagian header/legenda jadwal saja.
