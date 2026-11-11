# Panduan Operasional Queue Worker & Standardisasi Export Data (SCP)

Dokumen ini memuat standar operasional pengelolaan proses latar belakang (*background queue worker*) dan standardisasi ekspor data pada project School Class Project (SCP).

---

## 1. Daftar Background Queue Jobs

Project SCP mengandalkan Laravel Queue untuk menangani tugas-tugas komputasi berat, AI generation, pemrosesan berkas, dan evaluasi asinkron:

| Nama Job | Lokasi File | Fungsi & Deskripsi |
| :--- | :--- | :--- |
| **`GenerateQuizFromPromptJob`** | `app/Jobs/GenerateQuizFromPromptJob.php` | Menghubungi Google Gemini API untuk menghasilkan paket kuis beserta kunci jawaban berdasarkan prompt & topik guru. |
| **`ExtractQuizFromDocumentJob`** | `app/Jobs/ExtractQuizFromDocumentJob.php` | Membaca dokumen materi (PDF/DOCX/TXT) dan mengekstrak butir soal pilihan ganda secara otomatis. |
| **`GradeQuizSubmissionJob`** | `app/Jobs/GradeQuizSubmissionJob.php` | Menilai dan mengevaluasi jawaban esai/uraian siswa secara semantik menggunakan AI. |
| **`ParseSchedulePdfJob`** | `app/Jobs/ParseSchedulePdfJob.php` | Membedah berkas PDF jadwal pelajaran yang diunggah Waka Kurikulum menjadi jadwal terstruktur rombel. |

---

## 2. Konfigurasi Lingkungan (`.env`)

Pastikan koneksi antrean diatur ke basis data:

```env
QUEUE_CONNECTION=database
```

Tabel pendukung antrean dikelola melalui migrasi standar Laravel:
- Tabel `jobs` (antrean aktif)
- Tabel `failed_jobs` (catatan kegagalan eksekusi)

Jika tabel belum tersedia, jalankan:
```bash
php artisan queue:table
php artisan queue:failed-table
php artisan migrate
```

---

## 3. Menjalankan Queue Worker

### A. Lingkungan Pengembangan Lokal (Local Dev)
Di terminal pengembangan, jalankan perintah worker berikut di direktori `scp/`:

```bash
php artisan queue:work --tries=3 --timeout=120 --sleep=3
```
- `--tries=3`: Mencoba ulang maksimal 3 kali sebelum mencatat ke `failed_jobs`.
- `--timeout=120`: Membatasi eksekusi maksimal 2 menit (cukup untuk panggilan API AI).
- `--sleep=3`: Waktu jeda 3 detik jika antrean kosong untuk menghemat sumber daya CPU/DB.

### B. Lingkungan Produksi Linux (Supervisor Daemon)
Gunakan **Supervisor** agar worker berjalan secara terus-menerus dan otomatis restart jika proses terhenti:

Buat berkas konfigurasi di `/etc/supervisor/conf.d/scp-worker.conf`:

```ini
[program:scp-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/school-class-project/scp/artisan queue:work database --sleep=3 --tries=3 --max-time=3600 --timeout=120
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/school-class-project/scp/storage/logs/queue-worker.log
stopwaitsecs=3600
```

Aktifkan konfigurasi supervisor:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start scp-worker:*
```

### C. Pemeliharaan & Reset Antrean Setelah Deployment
Setiap kali ada pembaruan kode pada `app/Jobs/`:
```bash
php artisan queue:restart
```

Untuk memantau antrean gagal:
```bash
# Cek daftar job gagal
php artisan queue:failed

# Retry semua job gagal
php artisan queue:retry all

# Bersihkan job gagal
php artisan queue:flush
```

---

## 4. Standardisasi Ekspor Data (Excel & Dokumen)

Untuk menjaga performa aplikasi dan mencegah *browser freeze* atau *memory exhaustion*:

### Aturan 1: Dataset Besar (> 100 Baris) $\rightarrow$ Backend Streaming (`SimpleExcelWriter`)
- Seluruh ekspor data agregat (rekap presensi bulanan, master data siswa, riwayat jurnal semester) **wajib** diproses di server melalui endpoint Laravel:
  - Contoh: `GET /api/attendance-recap/export` (menggunakan Spatie `SimpleExcelWriter`).
- **Alur Frontend:**
  1. Frontend memanggil endpoint dengan parameter filter dan opsi `responseType: 'blob'`.
  2. Frontend membuat object URL sementara (`window.URL.createObjectURL(blob)`) dan memicu unduhan berkas.
  3. Memori browser tetap ringan karena data dialirkan dalam bentuk *binary stream*.

### Aturan 2: Tabel Lokal Kecil (< 100 Baris) $\rightarrow$ Client-Side SheetJS
- Ekspor tabel lokal yang sudah ter-filter di layar dan memiliki ukuran kecil (< 100 baris) diizinkan menggunakan library client-side (`xlsx` / SheetJS).
- Dilarang keras melakukan fetch ribuan baris data JSON ke client hanya untuk diubah menjadi Excel di browser.

### Aturan 3: Penamaan Berkas Ekspor yang Baku
Gunakan format penamaan standar:
`[MODUL]_[SUB_ENTITAS]_[TANGGAL_ISO].xlsx`
- Contoh: `Rekap_Presensi_Kelas_X_RPL_1_2026-11-11.xlsx`
- Contoh: `Master_Data_Siswa_2026-11-11.xlsx`
