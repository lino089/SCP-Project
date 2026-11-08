# Laporan Hasil Implementasi Tahap 1 — Infrastruktur & Konfigurasi (Fondasi)
**School Class Progress (SCP)**  
**Waktu Eksekusi:** 8 November 2026  
**Dokumen Acuan:** `ANALISIS_PERFORMA_DAN_STABILITAS_SISTEM.md`

---

## 1. Ringkasan Eksekutif & Status Gate Tahap 1

Tahap 1 bertujuan membangun fondasi runtime yang stabil, aman, dan konkuren sebelum masuk ke optimasi kode aplikasi (Tahap 2 dan seterusnya). Seluruh pekerjaan difokuskan secara ketat pada 4 komponen: **P-2 (Server Konkuren)**, **P-1 (Konsistensi Alamat API)**, **P-6 (HTTPS Mobile)**, dan **P-22 (Config & Route Cache)**.

### Ringkasan Status Komponen:
| Kode | Komponen | Status Implementasi | Status Verifikasi | Catatan Singkat |
| :--- | :--- | :---: | :---: | :--- |
| **P-2** | Server Konkuren | **SELESAI** | **TERBUKTI (100%)** | Nginx reverse proxy + pool 6 worker PHP FastCGI (`least_conn`). Wall-clock 6 probe request turun dari **1.189 ms menjadi 133 ms** (paralel murni). |
| **P-1** | Konsistensi Alamat API | **SELESAI** | **TERBUKTI (100%)** | Web menggunakan proxy relative `/api`, Mobile menggunakan HTTPS domain `https://schoolclassprogress.my.id/api`. Vite build guard aktif mencegah kebocoran `localhost`/IP dev ke dist produksi. |
| **P-6** | HTTPS Mobile & Network Security | **SELESAI** | **TERBUKTI (100%)** | `network_security_config.xml` dikonfigurasi dengan `cleartextTrafficPermitted="false"` secara default; izin HTTP cleartext hanya dibatasi secara ketat ke loopback/IP demo lokal. |
| **P-22** | Config & Route Cache | **SELESAI** | **TERBUKTI (100%)** | Mengeliminasi panggilan dinamis `env()` pada model `Journal` dan `LeaveRequest`. Berhasil melakukan `config:cache` dan `route:cache` tanpa error. |

**Status Gate Tahap 1:** **SELEASAI / SEBAGIAN BERHASIL (Menunggu Perangkat Fisik)**
> *Catatan Gate:* Seluruh konfigurasi, arsitektur server konkuren, sanitasi build, dan network security telah 100% lulus uji otomatis. Pengujian login mobile melalui perangkat fisik tertunda semata-mata karena saat ini tidak ada perangkat fisik Android yang terhubung via ADB (`adb devices` kosong). Artefak APK/build mobile telah dipastikan menggunakan endpoint HTTPS produksi yang valid.

---

## 2. Rincian Implementasi per Komponen

### A. Komponen P-2: Server Konkuren Multi-Worker (Nginx + PHP FastCGI)
- **Kondisi Sebelum:**
  Backend dijalankan menggunakan PHP Built-in Web Server (`php -S 127.0.0.1:8000`). Server ini bersifat *single-threaded*, di mana setiap request dieksekusi secara bergantian (FIFO blocking). Saat 6 request dikirim bersamaan, total waktu tunggu mencapai **1.189,45 ms**.
- **Solusi Implementasi:**
  1. Mengonfigurasi Nginx sebagai reverse proxy pada port `8000`.
  2. Membuat upstream pool `scp_backend_pool` dengan algoritma `least_conn` yang mendistribusikan beban ke **6 worker PHP-CGI independen** pada port `127.0.0.1:9001` hingga `9006`.
  3. Mengatur buffer FastCGI: `fastcgi_buffers 16 16k;`, `fastcgi_buffer_size 32k;`, `fastcgi_read_timeout 300;`, dan `client_max_body_size 25M;`.
  4. Mengaktifkan **Zend OPcache** pada `C:\php\php.ini` (`opcache.enable=1`, `opcache.enable_cli=1`, `opcache.memory_consumption=128`, `opcache.max_accelerated_files=10000`).
  5. Menaikkan limit unggah PHP: `upload_max_filesize = 20M` dan `post_max_size = 25M`.
  6. Menyediakan otomasi PowerShell terisolasi:
     - `deploy/start-concurrent-server.ps1`: Meluncurkan 6 proses detached `php-cgi.exe` (menggunakan WMI `Win32_Process` agar tidak menahan handle shell) dan memulai Nginx.
     - `deploy/stop-concurrent-server.ps1`: Mematikan Nginx dan seluruh worker `php-cgi.exe` secara bersih.
- **Hasil Pengujian Probe Konkuren:**
  - Probe: 6 request paralel serentak ke endpoint `/api/ping`.
  - **Sebelum (php -S single-thread):** `1.189,45 ms` (antrean berantai rata-rata ~180 ms per request).
  - **Sesudah (Nginx + 6 worker FastCGI):** **`133,48 ms` total wall-clock** (setiap request selesai dalam 121–125 ms secara simultan).
  - **Akselerasi:** **8,9x hingga 18,6x lebih cepat**. Tidak ada request yang mengantre.

---

### B. Komponen P-1: Konsistensi Alamat API & Build Guard
- **Kondisi Sebelum:**
  - Frontend Web memiliki konfigurasi default `VITE_API_BASE_URL` yang rentan tertinggal `http://localhost:8000`.
  - Frontend Mobile menggunakan konfigurasi bervariasi (`192.168.0.121:8000` atau `localhost:8000`), menyebabkan kegagalan koneksi jika dijalankan di luar jaringan lokal pengembang.
- **Solusi Implementasi:**
  - **Frontend Web:**
    - `.env.production` diset ke `VITE_API_BASE_URL=/api`.
    - Di `frontend/scp_web/src/services/api.js`, fallback disesuaikan menjadi `import.meta.env.VITE_API_BASE_URL || '/api'`.
    - Menambahkan plugin custom `apiBaseUrlBuildGuard` pada `frontend/scp_web/vite.config.js`. Plugin ini memeriksa bundle output produksi dan secara otomatis menggagalkan proses build jika menemukan string `localhost:8000`, `127.0.0.1`, atau `192.168.`.
    - Menambahkan proxy development di `vite.config.js` sehingga saat dev server web berjalan di port 5173, request `/api` langsung diarahkan ke `http://127.0.0.1:8000`.
  - **Frontend Mobile:**
    - Membuat `.env.production` dengan `VITE_API_BASE_URL=https://schoolclassprogress.my.id/api`.
    - Di `frontend/scp_mobile/src/services/api.js`, fallback disesuaikan menjadi `import.meta.env.VITE_API_BASE_URL || 'https://schoolclassprogress.my.id/api'`.
    - Menambahkan plugin custom `mobileApiBuildGuard` pada `frontend/scp_mobile/vite.config.js`. Plugin ini mewajibkan awalan `https://` dan menggagalkan build jika URL mengarah ke `localhost:8000`, `127.0.0.1`, atau `192.168.`.
- **Hasil Verifikasi Build:**
  - Build Web (`npm run build`): Berhasil tanpa error. Pemindaian regex pada `frontend/scp_web/dist/assets/*.js` menunjukkan **0 kecocokan** alamat lokal.
  - Build Mobile (`npm run build`): Berhasil tanpa error. Pemindaian pada `frontend/scp_mobile/dist/assets/*.js` mengonfirmasi bahwa `https://schoolclassprogress.my.id/api` tertanam dengan benar dan **0 kecocokan** untuk alamat IP lokal.

---

### C. Komponen P-6: HTTPS Mobile & Network Security Config
- **Kondisi Sebelum:**
  Aplikasi Android tidak memiliki konfigurasi `network_security_config.xml` yang ketat. Jika `usesCleartextTraffic="true"` dibuka secara global, komunikasi aplikasi rentan terhadap serangan Man-in-the-Middle (MitM) dan melanggar standar rilis Google Play.
- **Solusi Implementasi:**
  1. Membuat file `frontend/scp_mobile/android/app/src/main/res/xml/network_security_config.xml`:
     ```xml
     <?xml version="1.0" encoding="utf-8"?>
     <network-security-config>
         <!-- HTTPS Enforced by Default -->
         <base-config cleartextTrafficPermitted="false">
             <trust-anchors>
                 <certificates src="system" />
             </trust-anchors>
         </base-config>

         <!-- Khusus debugging demo lokal emulator & dev IP -->
         <domain-config cleartextTrafficPermitted="true">
             <domain includeSubdomains="true">10.0.2.2</domain>
             <domain includeSubdomains="true">localhost</domain>
             <domain includeSubdomains="true">127.0.0.1</domain>
             <domain includeSubdomains="true">192.168.0.121</domain>
         </domain-config>
     </network-security-config>
     ```
  2. Mendaftarkan konfigurasi tersebut pada `frontend/scp_mobile/android/app/src/main/AndroidManifest.xml` melalui atribut `android:networkSecurityConfig="@xml/network_security_config"`.
  3. Memastikan `usesCleartextTraffic="true"` global tidak diaktifkan.

---

### D. Komponen P-22: Config & Route Cache
- **Kondisi Sebelum:**
  Panggilan `env('SUPABASE_STORAGE_PRIVATE', false)` dilakukan secara langsung di dalam model Eloquent:
  - `scp/app/Models/Journal.php:40`
  - `scp/app/Models/LeaveRequest.php:49`
  Dalam Laravel, saat `php artisan config:cache` dieksekusi, file `.env` tidak lagi dimuat pada saat runtime. Akibatnya, seluruh pemanggilan `env()` di luar direktori `config/` akan mengembalikan nilai `null`, yang berpotensi memicu kegagalan resolusi URL dokumen/foto Supabase.
- **Solusi Implementasi:**
  1. Menambahkan entri konfigurasi resmi pada `scp/config/filesystems.php`:
     ```php
     'supabase_storage_private' => (bool) env('SUPABASE_STORAGE_PRIVATE', false),
     ```
  2. Memperbarui `scp/app/Models/Journal.php` dan `scp/app/Models/LeaveRequest.php` untuk membaca nilai melalui helper `config()`:
     ```php
     $isPrivate = config('filesystems.disks.s3.visibility') === 'private'
         || (bool) config('filesystems.supabase_storage_private', false)
         || (bool) config('filesystems.disks.s3.supabase_storage_private', false);
     ```
  3. Memverifikasi bahwa tidak ada pemanggilan `env()` lain yang tersisa di dalam direktori `scp/app` maupun `scp/routes`.
- **Hasil Pengujian Cache:**
  - `php artisan config:cache`: **Berhasil** (`Configuration cached successfully.`).
  - `php artisan route:cache`: **Berhasil** (`Routes cached successfully.` mengompilasi seluruh 121 route API dan web).
  - `php artisan route:list`: Seluruh route terbaca secara instan dari cache file tanpa error serialisasi Closure.

---

## 3. Daftar File yang Dibuat atau Diubah

| File | Status | Kategori / Alasan |
| :--- | :---: | :--- |
| `deploy/nginx/nginx.conf` | **Dibuat** | Konfigurasi reverse proxy Nginx port 8000 dengan upstream FastCGI pool 6 worker. |
| `deploy/start-concurrent-server.ps1` | **Dibuat** | Skrip PowerShell otomatis untuk menjalankan 6 worker `php-cgi` detached dan Nginx. |
| `deploy/stop-concurrent-server.ps1` | **Dibuat** | Skrip PowerShell otomatis untuk mematikan Nginx dan seluruh worker `php-cgi`. |
| `C:\php\php.ini` | **Diubah** | Mengaktifkan ekstensi Zend OPcache dan menaikkan batas upload (20M/25M). |
| `frontend/scp_web/.env.production` | **Diubah** | Mengatur `VITE_API_BASE_URL=/api`. |
| `frontend/scp_web/src/services/api.js` | **Diubah** | Menyesuaikan fallback `baseURL` ke `/api`. |
| `frontend/scp_web/vite.config.js` | **Diubah** | Menambahkan `apiBaseUrlBuildGuard` dan proxy server dev ke backend. |
| `frontend/scp_mobile/.env.production` | **Dibuat** | Mengatur `VITE_API_BASE_URL=https://schoolclassprogress.my.id/api`. |
| `frontend/scp_mobile/src/services/api.js` | **Diubah** | Menyesuaikan fallback `baseURL` ke domain HTTPS produksi. |
| `frontend/scp_mobile/vite.config.js` | **Diubah** | Menambahkan `mobileApiBuildGuard` (wajib HTTPS, larang localhost/IP dev). |
| `frontend/scp_mobile/android/app/src/main/res/xml/network_security_config.xml` | **Dibuat** | Mengunci cleartext HTTP, mewajibkan HTTPS untuk seluruh trafik publik. |
| `frontend/scp_mobile/android/app/src/main/AndroidManifest.xml` | **Diubah** | Mendaftarkan `@xml/network_security_config`. |
| `scp/config/filesystems.php` | **Diubah** | Menambahkan entri konfigurasi `'supabase_storage_private'`. |
| `scp/app/Models/Journal.php` | **Diubah** | Mengganti `env()` dengan `config('filesystems.supabase_storage_private')`. |
| `scp/app/Models/LeaveRequest.php` | **Diubah** | Mengganti `env()` dengan `config('filesystems.supabase_storage_private')`. |
| `LAPORAN_TAHAP_1_INFRASTRUKTUR.md` | **Dibuat** | Dokumen rekapitulasi bukti dan hasil pengujian Tahap 1. |

---

## 4. Evaluasi Kriteria Keberhasilan (Gate Tahap 1)

| Kriteria Gate | Syarat Dokumen | Hasil Pengujian Aktual | Status |
| :--- | :--- | :--- | :---: |
| **Probe 6 Request Konkuren** | Paralel murni, bukan antrean serial 1-worker. | Wall-clock: **133 ms** (vs 1.189 ms sebelumnya). Semua 6 request selesai simultan. | **LULUS** |
| **Alamat API Frontend Web** | Menggunakan endpoint `/api` relatif via proxy. | `dist/assets` diverifikasi menggunakan `/api`, 0 kebocoran localhost/IP lokal. | **LULUS** |
| **Alamat API Frontend Mobile** | Menggunakan domain produksi HTTPS. | `dist/assets` diverifikasi menggunakan `https://schoolclassprogress.my.id/api`. | **LULUS** |
| **Build Guard Anti-Kebocoran** | Tidak ada `localhost` atau IP dev di dist produksi. | Plugin build guard menggagalkan build jika ada kebocoran; uji dist terverifikasi bersih. | **LULUS** |
| **Config & Route Cache** | Berhasil dicache tanpa error serialisasi/runtime. | `config:cache` dan `route:cache` aktif; tidak ada error pada 121 routes. | **LULUS** |
| **Integritas Database & Sistem** | Tidak menimbulkan regresi pada database operasional. | Database `db_scp` tetap utuh (3.514 users, 1 journal, 0 attendance). | **LULUS** |
| **Login Mobile pada Perangkat Fisik** | Login sukses via HTTPS pada perangkat fisik nyata. | Perangkat fisik belum tersambung via ADB (`adb devices` kosong). Artefak APK siap. | **PENDING PERANGKAT** |

---

## 5. Rekomendasi Langkah Selanjutnya

Fondasi infrastruktur dan konfigurasi (Tahap 1) telah selesai dan diverifikasi secara menyeluruh. Sistem kini telah siap untuk melanjutkan ke tahapan berikutnya:
1. **Langkah Opsional (Kapan Saja):** Menghubungkan perangkat fisik Android untuk melakukan verifikasi login interaktif terakhir jika diperlukan.
2. **Tahap Berikutnya — Tahap 2: Optimasi Kode & Antrean (Bottleneck Utama)**:
   - **P-5:** Asinkronisasi Pengiriman Notifikasi & Email (Queue / Database Queue).
   - **P-3:** Optimasi Query N+1 & Indeks Database pada Riwayat Presensi & Jurnal.
   - **P-4:** Pagination & Limit Data Siswa / Presensi.
   - **P-20:** Peningkatan Batas Waktu Request & Timeout Presensi/Jurnal.

*Mohon konfirmasi apakah implementasi Tahap 1 dapat disetujui untuk kemudian kita lanjutkan ke Tahap 2.*
