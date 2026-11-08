# PANDUAN DEPLOYMENT & OPERASIONAL SISTEM (DEPLOYMENT.md)
## School Class Progress (SCP)
**Tanggal Rilis:** 9 November 2026  
**Revisi:** Tahap 4–6 Final Hardening  

---

## 1. Arsitektur & Topologi Sistem

Aplikasi School Class Progress (SCP) dibangun dengan arsitektur multi-layer:
- **Backend API:** Laravel 11 (PHP 8.2+) dengan arsitektur RESTful API envelope.
- **Web Frontend:** React 19 + Vite + Tailwind CSS (`frontend/scp_web`).
- **Mobile Frontend:** React 19 + Capacitor / Android Webview (`frontend/scp_mobile`).
- **Database:** PostgreSQL 16+ (Database `db_scp`).
- **Web Server & Reverse Proxy:** Nginx dengan load balancing FastCGI ke 6 worker pool konkuren.
- **Asynchronous Processing:** Laravel Queue Worker (`database` connection).
- **Cache & Rate Limiting:** File Cache Store (`storage/framework/cache/data`) atau Redis untuk produksi skala besar.

```
                           [ Klien Pengguna ]
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
            Frontend Web (Browser)      Frontend Mobile (APK/Capacitor)
            (Proxy: /api -> :8000)      (Base: https://.../api)
                     │                           │
                     └─────────────┬─────────────┘
                                   ▼
                         Nginx Reverse Proxy (:8000)
                     ┌─────────────┼─────────────┐
                     ▼             ▼             ▼
                PHP FastCGI   PHP FastCGI   PHP FastCGI (Pool :9001 - :9006)
                     └─────────────┬─────────────┘
                                   ▼
                            Laravel Backend (scp/)
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
            PostgreSQL Database             Queue Worker
                 (db_scp)               (Background Worker)
```

---

## 2. Kebutuhan Lingkungan (Prerequisites)

1. **PHP:** Versi 8.2 ke atas dengan ekstensi: `pdo_pgsql`, `pgsql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `curl`, `fileinfo`.
2. **PostgreSQL:** PostgreSQL 15/16/17/18 aktif pada port 5432.
3. **Nginx:** Nginx for Windows / Linux dengan modul `http_fastcgi_module`.
4. **Node.js & NPM:** Node.js v20+ dan npm 10+.
5. **Android SDK & JDK:** OpenJDK 17/21 dan Android Build Tools 34+ untuk kompilasi mobile.

---

## 3. Menjalankan Server Konkuren & Queue Worker

### 3.1 Menjalankan Server Konkuren Nginx + FastCGI Pool
SCP tidak boleh dijalankan dengan `php artisan serve` tunggal di lingkungan pengujian konkurensi atau produksi karena sifat worker tunggalnya yang memblokir request lain.

Gunakan skrip automasi yang telah disediakan pada direktori `deploy/`:
```powershell
# Menjalankan Nginx + 6 worker PHP FastCGI (port 9001-9006)
powershell -File "deploy/start-concurrent-server.ps1"
```
Skrip ini akan:
1. Memeriksa ketersediaan port 8000 dan 9001–9006.
2. Membuka 6 proses worker `php-cgi.exe` pada background.
3. Memulai Nginx reverse proxy yang membagi beban secara *round-robin* ke seluruh worker.

Untuk menghentikan:
```powershell
powershell -File "deploy/stop-concurrent-server.ps1"
```

### 3.2 Menjalankan Laravel Queue Worker
Seluruh tugas berat (seperti penilaian otomatis AI, parsing materi, rendering PDF rekap, dan bulk processing) diproses di latar belakang menggunakan worker antrean.

Jalankan worker antrean secara persisten:
```powershell
powershell -File "deploy/start-queue-worker.ps1"
```
Parameter worker operasional:
`php artisan queue:work --sleep=2 --tries=3 --timeout=180`

Untuk menghentikan:
```powershell
powershell -File "deploy/stop-queue-worker.ps1"
```

---

## 4. Konfigurasi Environment (`.env`)

### 4.1 Backend (`scp/.env`)
Pastikan pengaturan berikut terkunci dengan benar:
```ini
APP_ENV=production
APP_DEBUG=false
APP_URL=https://schoolclassprogress.my.id

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=db_scp
DB_USERNAME=postgres
DB_PASSWORD="your_secure_password"

CACHE_STORE=file
QUEUE_CONNECTION=database
SESSION_DRIVER=file

# Keamanan OTP & Notifikasi
WHATSAPP_DRIVER=fonnte
FONNTE_TOKEN=your_fonnte_token
```

### 4.2 Frontend Web (`frontend/scp_web/.env.production`)
```ini
VITE_API_BASE_URL=/api
```
*Catatan Keamanan:* Terdapat **Security Build Guard** pada `vite.config.js`. Build produksi akan otomatis ditolak jika `VITE_API_BASE_URL` berisi alamat lokal (`localhost`, `127.0.0.1`, `192.168.x.x`). Web produksi wajib menggunakan relative path `/api` yang di-proxy oleh server web.

### 4.3 Frontend Mobile (`frontend/scp_mobile/.env.production`)
```ini
VITE_API_BASE_URL=https://schoolclassprogress.my.id/api
```
*Catatan Keamanan:* Terdapat **Security Build Guard** pada mobile `vite.config.js`. Build produksi Android APK wajib mengarah ke domain publik HTTPS yang valid.

---

## 5. Prosedur Build & Deployment Frontend

### 5.1 Build Frontend Website
```bash
cd frontend/scp_web
npm ci
npm run build
```
File build statis akan dihasilkan pada direktori `frontend/scp_web/dist/`. Arahkan direktori root Nginx untuk domain web ke folder ini.

### 5.2 Build Frontend Mobile (Android APK)
```bash
cd frontend/scp_mobile
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```
File APK siap rilis akan berada pada `android/app/build/outputs/apk/release/app-release.apk`.

---

## 6. Prosedur Cache & Optimalisasi Produksi

Setelah kode diperbarui pada server produksi, jalankan perintah optimalisasi Laravel berikut:
```bash
cd scp

# 1. Bersihkan cache lama
php artisan config:clear
php artisan route:clear
php artisan view:clear

# 2. Kunci cache konfigurasi dan routing
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 3. Jalankan migrasi basis data (bila ada skema baru)
php artisan migrate --force

# 4. Restart queue worker agar memuat kode terbaru
php artisan queue:restart
```

---

## 7. Prosedur Backup & Pemeliharaan Basis Data

Direktori `deploy/backups/` disediakan untuk menyimpan dump data berkala.
Perintah pencadangan:
```powershell
$env:PGPASSWORD = "your_password"
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h 127.0.0.1 -p 5432 -U postgres -d db_scp -F p -f "deploy/backups/db_scp_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
```
