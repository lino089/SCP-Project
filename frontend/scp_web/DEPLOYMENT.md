# Panduan Deployment Produksi — School Class Project (SCP) Web

Dokumen ini memuat panduan teknis untuk melakukan kompilasi, penyajian, dan *deployment* aplikasi Front-End Website **School Class Project (SCP)** ke lingkungan produksi (*production*) maupun pengujian ujian kompetensi keahlian (*staging/UKK*).

---

## 1. Prasyarat Lingkungan Server

- **Node.js:** Versi 18 LTS atau 20 LTS (disarankan >= 20.x).
- **Package Manager:** `npm` (>= 9.x).
- **Web Server:** Nginx (disarankan), Apache HTTP Server, atau Caddy.
- **Backend API:** Laravel SCP backend aktif berjalan di port 8000 atau domain terpisah.

---

## 2. Langkah Kompilasi Produksi (Production Build)

1. Masuk ke direktori web:
   ```bash
   cd frontend/scp_web
   ```

2. Pastikan seluruh dependensi terpasang:
   ```bash
   npm install
   ```

3. Jalankan audit linter:
   ```bash
   npm run lint
   ```
   *Pastikan menghasilkan `0 errors, 0 warnings`.*

4. Konfigurasi endpoint API produksi pada berkas `.env.production`:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api
   ```
   *(Atau sesuaikan dengan domain server API produksi, misal: `/api` jika menggunakan reverse proxy Nginx).*

5. Jalankan proses kompilasi bundel:
   ```bash
   npm run build
   ```
   *Output kompilasi statis akan dihasilkan pada direktori `dist/` dengan ukuran modular yang terpecah melalui route code-splitting.*

---

## 3. Opsi Penyajian Web Server

### Opsi A: Deployment Menggunakan Nginx (Disarankan)

Salin seluruh isi folder `dist/` ke web root server Nginx (contoh: `/var/www/scp_web/dist` atau `/usr/share/nginx/html`).

Gunakan konfigurasi Nginx yang telah disediakan pada `deploy/nginx/default.conf`:

```nginx
server {
    listen 80;
    server_name scp.smk.sch.id;

    root /var/www/scp_web/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Caching Static Assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # SPA Fallback Rewrite (Mencegah HTTP 404 pada rute dalam)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Reverse Proxy API Laravel (Opsional jika satu host)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Uji dan muat ulang konfigurasi Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### Opsi B: Deployment Menggunakan Apache (.htaccess)

Jika menggunakan web server Apache, pastikan modul `mod_rewrite` aktif dan letakkan berkas `.htaccess` pada root direktori publik `dist/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

### Opsi C: Pengujian Cepat Lokal / Presentasi UKK (Node.js Static Server)

Untuk pengujian mandiri cepat atau presentasi rubrik UKK tanpa instalasi Nginx:

```bash
# Menggunakan utilitas vite preview
npm run preview -- --port 3000 --host

# ATAU menggunakan pustaka serve
npx serve -s dist -l 3000
```
Buka browser pada alamat `http://localhost:3000`.

---

## 4. Checklist Kesiapan Deployment (Production Sign-Off)

| Item Pemeriksaan | Target Standar | Status |
|:---|:---|:---:|
| **Linting** | `0 errors, 0 warnings` (`eslint .`) | Terpenuhi |
| **Vite Build** | Bersih tanpa peringatan chunk > 500 kB | Terpenuhi |
| **SPA Fallback Rewrite** | `try_files $uri $uri/ /index.html;` aktif di web server | Terpenuhi |
| **Token Sanitasi** | Tidak ada token atau password di console log peramban | Terpenuhi |
| **Error Boundary** | Menangkap fatal crash dan menyediakan pemulihan | Terpenuhi |
| **Aksesibilitas** | Memenuhi standar WCAG AA (kontras >= 4.5:1, keyboard nav, ARIA) | Terpenuhi |
