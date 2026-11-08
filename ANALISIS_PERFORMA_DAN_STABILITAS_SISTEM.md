# ANALISIS PERFORMA & STABILITAS SISTEM
## School Class Project (SCP) — Backend Laravel ↔ Web React ↔ Mobile Capacitor

**Tanggal analisis:** 8 November 2026
**Revisi:** 1 (8 Nov 2026, 20:40 WIB) — koreksi §0.3, §1.3, §5 I-7, §7.1, dan Lampiran A setelah pengukuran ulang dengan `COUNT(*)` + `EXPLAIN (ANALYZE)` pada data nyata. Lihat "Catatan Revisi" di akhir Bagian 0.
**Lingkungan analisis:** `D:\MyUKK\SchoolClassProject` (branch `main`, working tree dengan 10 file termodifikasi + 6 file untracked)
**Sifat pekerjaan:** Analisis & dokumentasi saja. **Tidak ada satu pun file kode atau konfigurasi project yang diubah, ditambah, dihapus, atau dipindahkan** dalam proses analisis ini.

---

## 0. Metode, Cakupan, dan Tingkat Keyakinan

### 0.1 Metode
Analisis dilakukan read-only dengan cara:
1. Membaca `scp/routes/api.php` (121 definisi route) sebagai sumber kebenaran permukaan API.
2. Membaca seluruh 20 controller di `scp/app/Http/Controllers/API/`, 13 service di `scp/app/Services/`, 2 middleware, `bootstrap/app.php`, `AppServiceProvider`, dan konfigurasi `config/*`.
3. Membaca 44 migration untuk memetakan skema & indeks nyata.
4. Membaca lapisan service dan halaman di `frontend/scp_web` (39 halaman) dan `frontend/scp_mobile` (24 halaman).
5. **Pengukuran runtime read-only** terhadap backend yang sedang hidup di port 8000 (probe `GET /api/ping` konkuren) dan query katalog PostgreSQL read-only (`pg_indexes`, `pg_stat_user_tables`, `cache`).
6. Membaca artefak build (`frontend/*/dist`) dan konfigurasi Android untuk memverifikasi nilai yang benar-benar dikirim ke runtime.

### 0.2 Legenda tingkat keyakinan
| Label | Arti |
| --- | --- |
| **[TERBUKTI]** | Dapat dibuktikan langsung dari kode/konfigurasi/hasil pengukuran. Lokasi file:baris disertakan. |
| **[INDIKASI]** | Pola kuat mengarah ke masalah, tetapi dampaknya bergantung pada kondisi runtime/produksi yang belum dapat diuji dari sini. |
| **[PERLU PENGUJIAN]** | Hanya dapat dipastikan lewat pengujian pada lingkungan nyata (data produksi, perangkat fisik, VPS). |

### 0.3 Batasan yang harus dibaca lebih dulu
1. **Database lokal BERISI data nyata (koreksi 8 Nov 2026, 20:40 WIB).** Versi pertama dokumen ini menyatakan DB "hampir kosong" berdasarkan `pg_stat_user_tables.n_live_tup`. **Itu keliru**: di `db_scp` kolom `last_analyze`/`last_autoanalyze` bernilai NULL (statistik tidak pernah dikumpulkan), sehingga `n_live_tup` melaporkan 0 untuk semua tabel besar. Hitungan otoritatif `COUNT(*)`:

   | Tabel | Baris |
   | --- | --- |
   | `users` | **3.514** (2 waka · 90 guru · 1.711 siswa · 1.711 orang tua) |
   | `schedules` | **721** (semua pada siklus 1) |
   | `classes` / `rooms` / `subjects` | 48 / 53 / 84 |
   | `teacher_assignments` | 96 |
   | `academic_events` / `period_templates` | 48 / 48 |
   | `ai_quizzes` / `quiz_questions` | 3 / 13 |
   | `journals` | 1 |
   | `attendances`, `leave_requests`, `teacher_leave_requests`, `quiz_submissions` | 0 |

   Konsekuensinya, kesimpulan **tetap** (SQL bukan penyebab keluhan) tetapi **alasannya berbeda dan kini berbasis pengukuran, bukan asumsi**: `EXPLAIN (ANALYZE)` pada data nyata menunjukkan `GET /schedules` dengan 721 baris selesai dalam **0,41 ms**, pagination 15 baris **0,80 ms**, dan `COUNT(*)` per role **0,67–0,78 ms** (Index Only Scan). Uraian lengkap: `SCP_BASELINE_*/measurements/real-data-explain.txt`.
2. **Lingkungan produksi (VPS/Nginx/HTTPS) tidak tersedia untuk diuji**, sehingga seluruh klaim tentang produksi diberi label **[PERLU PENGUJIAN]** kecuali terbukti dari file konfigurasi.
3. **Tidak ada kredensial pengguna yang dipakai**; tidak ada login, tidak ada mutasi data, tidak ada perubahan skema. Akun pengguna **ada** (3.514), tetapi kredensialnya tidak saya ketahui dan tidak saya tebak — karena itu endpoint terautentikasi diukur pada jalur 401 (biaya bootstrap), bukan pada jalur data.
4. Angka waktu respons diukur pada backend lokal (`php -S`) di mesin developer, bukan pada server produksi.

### 0.4 Catatan Revisi (kesalahan analisis yang dikoreksi)
Transparansi atas apa yang awalnya salah, agar tidak terulang:

| Klaim versi pertama | Fakta | Penyebab kesalahan |
| --- | --- | --- |
| "DB lokal hampir kosong: `users=0`, `schedules=0`" | `users=3.514`, `schedules=721`, `classes=48`, `rooms=53`, `subjects=84` | Memakai `pg_stat_user_tables.n_live_tup` — di DB ini `last_analyze`/`last_autoanalyze` NULL, jadi estimasi 0 dan tidak pernah dikumpulkan. **Aturan: selalu `SELECT COUNT(*)`, jangan `n_live_tup`.** |
| "Karena kosong, lambatnya tidak mungkin dari query" | Kesimpulan sama, tetapi sekarang **berbasis ukur**: query inti 0,41–0,80 ms pada data nyata | Kesimpulan benar dengan alasan yang salah → harus diganti bukti |
| "Nama tabel kuis adalah `quizzes`" (tercatat di referensi skill, bukan di dokumen ini) | Model `Quiz` memakai `protected $table = 'ai_quizzes'`; migration `2026_10_20_000002_rebuild_quiz_tables` menghapus `quizzes` dan membuat `ai_quizzes`. Di DB hanya ada `ai_quizzes`, `quiz_questions`, `quiz_submissions` | Referensi lama tidak diperbarui setelah rebuild |
| "Endpoint terautentikasi tidak dapat diukur karena tidak ada user" | User **ada**; yang tidak ada adalah **kredensial**. Pengukuran tetap dilakukan pada jalur 401 (biaya bootstrap) | Menyamakan "tidak ada user" dengan "tidak ada akses" |

---

## 1. Ringkasan Eksekutif

### 1.1 Kondisi umum project
SCP adalah aplikasi Laravel 13 (API headless, Sanctum) yang dikonsumsi dua klien terpisah: web React 19 + Vite dan mobile React 19 + Capacitor (Android). Secara fungsional, arsitektur lapisan sudah benar (controller tipis, service untuk domain, scoping data dari token). **Masalah yang dilaporkan bukan berasal dari satu bug tunggal, melainkan dari enam lapisan kegagalan yang saling memperkuat.**

### 1.2 Temuan paling menentukan (dengan bukti)
| # | Temuan | Bukti | Dampak |
| --- | --- | --- | --- |
| **A1** | **Base URL API pada artefak build salah.** Web `dist/` dan `.env.production` memakai `http://localhost:8000/api`; mobile `dist/` memakai `http://192.168.0.121:8000/api` (IP LAN developer). | `frontend/scp_web/.env.production:4`, `frontend/scp_web/dist/assets/*.js` (2 kemunculan `http://localhost:8000/api`), `frontend/scp_mobile/.env:1`, `frontend/scp_mobile/dist/assets/Badge-Cwwa2Egz.js` | Setiap build yang didistribusikan menunjuk ke mesin pengguna sendiri / IP LAN yang tidak dapat dijangkau dari luar. Semua request gagal atau menggantung. **Ini penyebab paling langsung dari "koneksi gagal".** |
| **A2** | **Backend dijalankan dengan `php -S` (single-threaded).** | Command line proses PID 29964: `C:\php\php.exe -S 0.0.0.0:8000 resources/server.php`; pengukuran 6 request konkuren → 210/423/596/778/1006/**1185 ms** berurutan (selisih ±180 ms/req) | Semua request **diantrikan**. Satu request panjang memblokir seluruh aplikasi. Ini pola persis "kadang gagal, beberapa saat kemudian tersambung lagi tanpa perubahan". |
| **A3** | **Pekerjaan panjang dijalankan sinkron di dalam request HTTP.** AI generate (timeout AI 60 s), ekstraksi dokumen, parsing PDF jadwal, dan grading kuis memakai `dispatchSync`. | `QuizController.php:301,399,823`; `ScheduleImportController.php:62`; `AI_TIMEOUT=60` di `.env`; `config/services.php:42` | Request bertahan 20–90 detik. Dikombinasikan A2 → seluruh API membeku selama proses AI/PDF berjalan. |
| **A4** | **Timeout klien (15 s) lebih pendek daripada durasi kerja backend (sampai 60–120 s).** | `frontend/scp_web/src/services/api.js:6`, `frontend/scp_mobile/src/services/api.js:11` | Klien menyerah lebih dulu, backend tetap menyelesaikan pekerjaan. Data **tersimpan** tetapi UI melaporkan gagal → "data kosong padahal ada di database". |
| **A5** | **Rate limiter 60/menit dipakai bersama oleh web + mobile + semua tab, sementara halaman melakukan polling 1,5 detik dan 4–6 request paralel saat mount.** | `AppServiceProvider.php:26` (`Limit::perMinute(60)->by(user id)`), `routes/api.php:46`, `ScheduleImportPage.jsx:383` (interval 1500 ms, hingga 80 iterasi) | Lonjakan melewati 60/menit → **429** → UI menampilkan "gagal terhubung" → pulih otomatis setelah jendela 60 detik. Persis gejala yang dilaporkan. |
| **A6** | **Kegagalan jaringan/timeout diperlakukan sebagai sesi tidak valid → token dihapus & user dipaksa logout.** | `scp_web/src/context/AuthContext.jsx:43-51`; `scp_mobile/src/context/AuthContext.jsx:64-72` | Satu timeout atau 502/429 saat transien = logout paksa. User harus login ulang padahal tidak ada masalah kredensial. |
| **A7** | **Mobile Android memblokir koneksi HTTP polos** (tidak ada `usesCleartextTraffic` / `networkSecurityConfig`, `targetSdk 36`). | `frontend/scp_mobile/android/app/src/main/AndroidManifest.xml` (hanya `INTERNET`), manifest gabungan hasil build juga tanpa atribut tersebut | Di perangkat, seluruh request ke `http://192.168.0.121:8000` ditolak WebView. **Kegagalan 100% pada mobile, bukan intermiten.** |
| **A8** | **Beberapa halaman membaca respons API dengan kontrak yang salah sehingga data yang ada tidak pernah dirender.** | `MonitoringRecapPage.jsx:118` (`res.data.success` — selalu `undefined`), `scp_mobile/.../StudentPermissionPage.jsx:279` (`res.data.data...`) | Panel rekap harian dan banner agenda libur **tidak pernah tampil** meskipun API mengembalikan data. |

### 1.3 Kesimpulan utama
> **Sumber masalah dominan bukan query database dan bukan "backend lambat" secara umum.** Sumber dominan adalah **kombinasi tiga hal: (a) konfigurasi alamat API pada artefak yang dipakai klien, (b) backend yang hanya mampu melayani satu request pada satu waktu sementara beberapa endpoint memang dirancang berjalan lama secara sinkron, dan (c) klien yang tidak memiliki strategi timeout/retry/deduplikasi sehingga setiap gangguan kecil berubah menjadi kegagalan permanen di mata pengguna (logout, halaman kosong, pesan gagal).**

Masalah lapisan data (indeks hilang, N+1 minor, pagination tidak dibatasi) **ada dan nyata**, tetapi pada data yang ada sekarang terbukti **bukan** penyebab utama: seluruh query inti selesai di bawah 1 ms (721 jadwal = 0,41 ms; 1.711 baris `users` = 0,78 ms). Temuan tersebut masuk kategori risiko yang harus dibereskan **sebelum volume presensi/jurnal tumbuh** (`journals` saat ini hanya 1 baris, `attendances` 0 baris), bukan sebagai penyebab gejala sekarang.

---

## 2. Hasil Analisis Backend (Laravel API)

### 2.1 Profil teknis
| Aspek | Nilai aktual | Sumber |
| --- | --- | --- |
| Framework | Laravel 13 (skeleton `bootstrap/app.php`, tanpa `Http/Kernel.php`) | `bootstrap/app.php` |
| PHP | 8.4.13 (CLI, NTS) | `php -v` |
| Database | PostgreSQL 18, `db_scp` @ `127.0.0.1:5432` | `.env`, `config/database.php` |
| Auth | Sanctum token, `expiration = 43200` menit (30 hari) | `config/sanctum.php:53` |
| Session / Cache / Queue | `database` / `database` / `database` | `.env` |
| Filesystem default | `s3` (Supabase) | `.env` |
| Timezone aplikasi | `Asia/Jakarta` | `config/app.php:68` |
| Config cache | **Tidak ada** (`bootstrap/cache/` hanya `packages.php` & `services.php`) | `ls bootstrap/cache` |
| Jumlah route API | 121 | `routes/api.php` |

### 2.2 Endpoint lambat / berjalan panjang

#### B-1 · Pekerjaan AI & parsing PDF dieksekusi sinkron di dalam request **[TERBUKTI — Critical]**
| Lokasi | Operasi | Batas waktu internal |
| --- | --- | --- |
| `QuizController.php:301` | `GenerateQuizFromPromptJob::dispatchSync()` | `AI_TIMEOUT=60` detik (`config/services.php:42`) |
| `QuizController.php:399` | `ExtractQuizFromDocumentJob::dispatchSync()` | 60 detik + ekstraksi PDF |
| `QuizController.php:823` | `GradeQuizSubmissionJob::dispatchSync()` | 60 detik / submission |
| `ScheduleImportController.php:62` | `ParseSchedulePdfJob::dispatchSync()` | tidak dibatasi di kode |

Kode memiliki dua cabang: `dispatch()` (asinkron) **hanya** ketika `app('queue')` adalah `QueueFake` (lingkungan tes). Pada runtime nyata selalu masuk cabang `dispatchSync`. Komentar di `QuizController.php:299` menyatakan alasan pemilihan sinkron: "agar soal langsung tersedia tanpa tergantung queue worker". Konsekuensinya:

- `POST /api/quizzes/{id}/generate-prompt` dapat berjalan 20–60 detik.
- `POST /api/schedule-imports` menahan request selama seluruh parsing PDF dua berkas selesai.
- Karena `QUEUE_CONNECTION=database` dan tabel `jobs` berisi 0 baris (diverifikasi via SQL), **tidak ada worker** yang berjalan — konfigurasi asinkron memang tidak pernah dipakai.

**Efek berantai:** dengan backend single-thread (lihat I-1), satu operasi AI memblokir **semua** endpoint lain, termasuk `/api/me` yang dipanggil setiap kali aplikasi dibuka. Ini menjelaskan halaman yang "berhenti pada kondisi loading" secara global, bukan hanya pada halaman kuis.

> Catatan penting: PRD mensyaratkan pemrosesan asinkron via queue. Implementasi menyimpang. Ini **divergensi dokumen vs kode**, bukan sekadar pilihan teknis.

#### B-2 · Rate limiting 60/menit per user, dibagi lintas klien **[TERBUKTI — High]**
`AppServiceProvider.php:26`:
```php
Limit::perMinute(60)->by($request->user()?->id ?: $request->ip())
```
- Kunci limiter = **user id**, bukan perangkat/sesi. Web + mobile + semua tab pada akun yang sama memakai kuota yang sama.
- Konsumsi per halaman (lihat §3.4): dashboard waka 5 request, dashboard guru 6 request, monitoring 4 request.
- `ScheduleImportPage.jsx:383` melakukan polling setiap **1.500 ms** hingga 80 iterasi → **40 request/menit hanya dari polling**, ditambah request lain pada halaman yang sama.
- Di mode development, `StrictMode` (`main.jsx:7`) menggandakan setiap efek mount → 2× lipat.
- Ambang 60/menit dapat terlampaui; respons 429 ditangani `api.js` sebagai pesan "Terlalu banyak permintaan".

**Ini adalah penjelasan paling masuk akal untuk gejala "koneksi gagal, lalu beberapa saat kemudian normal kembali tanpa perubahan"**: jendela rate limit adalah 60 detik, sehingga pulih sendiri.

#### B-3 · Cache & rate limiter disimpan di database **[TERBUKTI — Medium]**
`CACHE_STORE=database`. Bukti tidak langsung dari isi tabel `cache` (read-only): baris `laravel-cache-<hash>` dan `laravel-cache-<hash>:timer` — pasangan khas Laravel untuk `RateLimiter`/atomic lock.

Konsekuensi: **setiap** request terautentikasi melakukan minimal 1 SELECT + 1 UPDATE pada tabel `cache` hanya untuk pencatatan rate limit, sebelum menyentuh data bisnis. Karena dashboard mengirim 4–6 request paralel dengan kunci limiter yang **sama** (user id sama), terjadi kontensi baris (row lock) pada satu baris `cache`. Ini memperkuat efek B-2 dan I-1.

#### B-4 · Pagination tidak dibatasi pada beberapa endpoint **[TERBUKTI — Medium]**
| Endpoint | Batas `per_page` | Risiko |
| --- | --- | --- |
| `GET /attendances` (`AttendanceController.php:105`) | **tidak divalidasi sama sekali** | `?per_page=100000` mengembalikan seluruh tabel presensi → memori server + payload besar + waktu serialisasi JSON. |
| `GET /schedules` (`ScheduleController.php:54`) | `max:1000`, plus `all=1` tanpa batas | `all=1` untuk guru/waka mengambil seluruh jadwal satu siklus dalam satu respons. |
| `GET /journals` (`JournalController.php:103`) | `max` tidak dibatasi di validasi | dipanggil dengan `per_page=100` oleh halaman monitoring. |
| `GET /rooms|subjects|teachers` | `max:100` | daftar dropdown terpotong pada 100 (dan 15 bila `per_page` tidak dikirim — lihat W-4). |
| `GET /students` (`StudentController.php:440`) | `max:5000` | cukup besar untuk satu respons. |

#### B-5 · Indeks database tidak lengkap untuk jalur query utama **[TERBUKTI — Medium]**
Hasil `pg_indexes` (read-only) pada DB aktual:

| Tabel | Indeks yang ada | Indeks yang **hilang** namun dibutuhkan |
| --- | --- | --- |
| `journals` | PK, `unique(schedule_id, date)` | **tidak ada indeks pada `date`** padahal filter utama adalah `whereDate('date', …)` (`JournalController.php:78`, `ScheduleController.php:75,161`, `AttendanceController` via relasi). Dashboard & monitoring memindai tabel penuh. |
| `attendances` | PK, `(student_id, date)` | **tidak ada indeks `journal_id`** (FK tidak otomatis berindeks di PostgreSQL) padahal `JournalController::show` memuat `attendances.student` per jurnal, dan `Attendance::where('journal_id', …)->delete()` di `JournalController.php:501`. Selain itu **tidak ada unique `(journal_id, student_id)`** → duplikasi presensi secara teknis mungkin bila dua penulisan berjalan bersamaan. |
| `schedules` | `(cycle_type, day_of_week)`, `(day_of_week, cycle_type)`, `teacher_id`, `class_id`, `room_id` | cukup untuk pola query saat ini; **dua indeks komposit tersebut redundan** (biaya tulis ekstra). |
| `users` | cukup lengkap (role/class/name/phone) | — |

Pada volume data saat ini (0 siswa, 0 jadwal) dampaknya nol. Risiko nyata muncul saat data sekolah terisi (ribuan `attendances`, ratusan `journals`) — terutama `journals(date)` yang menjadi filter default hampir semua halaman monitoring.

#### B-6 · Pola query berulang (N+1 ringan & query ganda) **[TERBUKTI — Medium]**
1. **Helper otorisasi yang menembak DB setiap pemanggilan.** `User::isKesiswaan()`, `hasAssignment()`, `isWaliKelas()`, `homeroomClassIds()`, `assignments()` — semuanya mengeksekusi query (`app/Models/User.php:111-160`). Dipanggil berulang dalam satu request:
   - `AttendanceController.php:53-60`: hingga `isKesiswaan()` + `isWaliKelas()` + `homeroomClassIds()` = 3 query tambahan sebelum query utama.
   - `JournalController.php:55-72`: `isKesiswaan()` + `isWaliKelas()` + `homeroomClassIds()`.
   - `AcademicEventController.php` `myCalendar`: `$user->assignments()` dipanggil **3 kali** (baris ±301, 314, 315) + `->where(...)->exists()` 2 kali.
2. **Query di dalam closure filter.** `AcademicEventController.php:273`: `Classes::whereIn(...)->get()` dieksekusi **per event** ketika waka memakai filter `grade`. Untuk 46 event = 46 query.
3. **`SystemConfiguration::first()` dipanggil 8 kali** di seluruh aplikasi; pada `ScheduleController::index` sendirian 2–3 kali (baris 63, 146, 217) + `PeriodResolutionService` baris 48 memanggilnya lagi ketika `mondayIsUpacara` tidak diteruskan.
4. **Eager loading sebagian sudah benar** — `schedule.subject`, `schedule.schoolClass`, `attendances.student` dsb. memakai `with([...])` dengan kolom terbatas. **Ini bukan sumber utama masalah**, tetapi memperlihatkan gaya penulisan yang tidak konsisten: ada bagian yang sangat dioptimalkan, ada bagian yang lupa.

#### B-7 · `/academic-settings` khusus waka tetapi dipanggil oleh halaman guru **[TERBUKTI — Medium]**
`routes/api.php` menempatkan `GET /academic-settings` di grup `role:vice_principal`. `TeacherDashboardPage.jsx:82` tetap memanggilnya lebih dulu, di dalam `try/catch` yang menelan error. Akibatnya **setiap** pembukaan dashboard guru menghasilkan satu request yang dijamin 403, plus log error di backend. Nilainya hanya `active_cycle`, yang sebenarnya sudah tersedia dari `GET /me`.

#### B-8 · `POST /login` tidak di-throttle **[TERBUKTI — Medium]**
`routes/api.php:35` berada **di luar** grup `auth:sanctum, throttle:api`. Tidak ada limiter pada login, sementara `BCRYPT_ROUNDS=12` (≈200–300 ms CPU per percobaan). Pada backend single-thread, rentetan percobaan login (disengaja maupun karena retry UI) menjadi vektor kehabisan kapasitas: 20 percobaan = ±6 detik di mana API tidak melayani siapa pun.

#### B-9 · Sinkronisasi izin → presensi hanya terjadi saat jurnal diselesaikan **[TERBUKTI — Medium, butuh ruling]**
Tidak ada `Attendance::create/update` di `LeaveRequestController`. Sinkronisasi izin → status presensi (`sakit` → `Sakit`, lainnya → `Izin`) hanya terjadi saat guru menyelesaikan jurnal (`JournalController.php:476-505`). Konsekuensi: izin yang **disetujui setelah** jurnal ditutup tidak akan pernah tercermin di presensi. Ini konsisten dengan keluhan "sinkronisasi data belum konsisten", tetapi perlu keputusan bisnis: apakah approval harus memicu resync, atau cukup mencegah guru menutup jurnal lebih dulu.

#### B-10 · Penulisan presensi: hapus-semua-lalu-insert tanpa proteksi duplikat **[TERBUKTI — Medium]**
`JournalController.php:501-503`:
```php
Attendance::where('journal_id', $journal->id)->delete();
Attendance::insert($attendanceData);
```
Operasi ini efisien (bulk insert, bukan N+1) — **kualitasnya baik**. Yang hilang adalah `unique(journal_id, student_id)` sebagai jaring pengaman integritas data. Bila dua request penyelesaian jurnal berjalan bersamaan (mis. double-click, atau retry otomatis setelah timeout 15 s — lihat A4), hasil akhirnya bisa berisi baris ganda untuk siswa yang sama, yang akan menggelembungkan angka rekap kehadiran.

#### B-11 · Duplikasi & route ganda **[TERBUKTI — Low]**
- `GET /cycle-history` dan `GET /academic-settings/cycle-history` menunjuk method yang sama.
- `DELETE /quizzes/{id}` didefinisikan **dua kali**: di grup `vice_principal` **dan** grup `teacher` (`routes/api.php`). Perilaku efektif bergantung pada urutan registrasi dan belum dapat dipastikan tanpa uji runtime — **[PERLU PENGUJIAN]**.
- `AttendanceController` tidak memvalidasi `per_page` sama sekali, sementara controller lain konsisten memvalidasi. Ketidakkonsistenan ini menyulitkan auditing.

#### B-12 · Kualitas baik yang perlu dipertahankan (agar tidak salah generalisasi)
Supaya rencana perbaikan tidak "membongkar yang sudah benar":
- `AcademicCalendarExclusionService` dan `PeriodResolutionService` sudah memakai **cache statis per-request** untuk mencegah N+1 saat memetakan jadwal (`AcademicCalendarExclusionService.php:18`, `PeriodResolutionService.php:17`).
- `AttendanceRecapController` memakai **agregasi SQL** (`COUNT(CASE WHEN ...)`) + `keyBy` + `unique`, bukan loop per siswa.
- `MasterDataSummaryController::index` memakai `count()` per tabel (6 query ringan) — bukan `get()->count()`.
- Response envelope `{success, message, data, meta}` konsisten dan `bootstrap/app.php` memusatkan penanganan 401/403/404/422/500.
- Ada 67 file tes (Feature + Unit), termasuk `PeriodResolutionBenchmarkTest.php` yang menguji jumlah query `GET /schedules` ≤ 15 — basis yang bagus untuk menambahkan tes performa & regresi.

---

## 3. Hasil Analisis Frontend Web (React)

### 3.1 Konvensi yang sudah benar
`src/services/api.js` membuat satu instance axios dengan interceptor respons yang mengembalikan `response.data`. Artinya setiap `api.get()` me-resolve ke envelope `{success, message, data, meta}`. Mayoritas halaman sudah mengikuti konvensi ini (`res.success`, `res.data`).

### 3.2 Temuan

#### W-1 · Base URL produksi salah **[TERBUKTI — Critical]**
`frontend/scp_web/.env.production:4`:
```
VITE_API_BASE_URL=http://localhost:8000/api
```
Dan artefak build yang sudah ada memuat nilai yang sama (`dist/assets/*.js`, 2 kemunculan). Bila `dist/` ini disajikan (nginx/Docker sesuai `DEPLOYMENT.md`), setiap pengguna akan memanggil `localhost` **mesin pengguna sendiri** → `ERR_CONNECTION_REFUSED` konsisten. Ini bukan bug intermiten; ini kegagalan total pada lingkungan yang disajikan dari perangkat lain.

#### W-2 · Logout paksa pada setiap error jaringan **[TERBUKTI — Critical]**
`scp_web/src/context/AuthContext.jsx:43-51`:
```js
} catch {
  // If token invalid, clean up local cache
  localStorage.removeItem('scp_token');
  ...
  setToken(null); setUser(null);
}
```
`/me` gagal karena **apa pun** (timeout 15 s, 429, 500, jaringan putus, backend single-thread sedang sibuk) menghasilkan konsekuensi yang sama dengan token tidak valid: sesi dihapus.

Di `login()` (baris 100-120) juga ada fallback yang lebih berbahaya: bila `getMe()` gagal, `user` diisi objek minimal `{nis_nip, must_change_password}` — tanpa `role`. Akibatnya `hasRole()` bernilai false untuk semua role → `RoleRoute` mengalihkan ke halaman default → user melihat halaman kosong/redirect berulang, sementara token masih sah.

#### W-3 · Rekap harian tidak pernah dirender **[TERBUKTI — High]**
`scp_web/src/pages/waka/MonitoringRecapPage.jsx:118`:
```js
if (res?.data?.success && res.data.data) { setDailyRecapData(res.data.data); }
```
Interceptor sudah mengembalikan `response.data`, sehingga `res.success` ada di `res`, dan `res.data` **adalah** payload rekap (`JournalController.php:638-665`). `res.data.success` selalu `undefined` → blok tidak pernah dieksekusi → panel rekap harian selalu kosong meski API mengembalikan `metrics`, `compliance_rate`, dan `items`.

#### W-4 · Dropdown resolusi import terpotong 15 baris **[TERBUKTI — High]**
`scp_web/src/pages/waka/ScheduleImportPage.jsx:254-257`:
```js
classApi.getClasses(), roomApi.getRooms(), subjectApi.getSubjects(), teacherApi.getTeachers()
```
Tanpa `per_page`. Backend default `15` dan maksimum `100` (`RoomController.php:19`, `SubjectController.php:19`, `TeacherController.php:286`), serta `classes` mendukung `all` yang tidak dipakai.

Konsekuensi langsung: pada sekolah dengan >15 guru/ruang/kelas/mapel, **daftar pilihan untuk menyelesaikan baris import tidak lengkap** → waka menilai "datanya tidak ada" padahal ada di database. Ini persis salah satu keluhan yang dilaporkan, dan terbukti dari kode (bukan dugaan).

Catatan: halaman lain sudah benar (`ScheduleManagementPage.jsx:149-152` dan `MasterDataPage.jsx:177-198` memakai `per_page: 100`), sehingga masalah ini terlokalisasi pada `ScheduleImportPage`.

#### W-5 · Tanggal UTC dipakai untuk request bertanggal **[TERBUKTI — High]**
Pola `new Date().toISOString().split('T')[0]` menghasilkan tanggal **UTC**. Antara 00:00–06:59 WIB nilainya masih tanggal kemarin, sedangkan backend memakai `Asia/Jakarta`. Lokasi terbukti:
- `DashboardWakaPage.jsx:85`
- `StudentHomePage.jsx:72`
- `ParentMonitoringPage.jsx:50`
- `StudentSchedulePage.jsx` (`todayStr`), `StudentPermissionPage.jsx`, `TeacherJournalPage.jsx`

Gejala: pada pagi hari, menu "jadwal hari ini", "agenda hari ini", dan pengecekan libur memakai tanggal yang salah → **UI kosong padahal data untuk hari itu ada**. Setelah pukul 07:00 WIB masalah ini "hilang sendiri" — ciri khas bug tanggal UTC, dan cocok dengan keluhan intermiten berdasarkan waktu.

#### W-6 · Tidak ada pembatalan request / proteksi race condition **[TERBUKTI — High]**
Tidak ada satu pun penggunaan `AbortController`, `signal`, atau token urutan request di seluruh `frontend/scp_web/src` dan `frontend/scp_mobile/src` (hasil grep: 0 kemunculan).

Pada halaman yang memuat ulang data saat filter berubah (mis. `ScheduleManagementPage.jsx:335-369` memakai `setTimeout` debounce 3×, `MonitoringRecapPage`, `AcademicCalendarPage`), respons lama yang datang belakangan akan menimpa respons baru (`setState` dari closure usang). Gejala yang terlihat pengguna: **data yang tampil tidak sesuai filter yang dipilih**, atau berkedip antara dua hasil.

#### W-7 · Fan-out request per halaman + `Promise.all` yang gagal-total **[TERBUKTI — Medium]**
| Halaman | Request saat mount | Pola kegagalan |
| --- | --- | --- |
| `DashboardWakaPage.jsx:91-96` | 5 (settings, summary, history, missing journals, exemption) | `Promise.all` — satu gagal (mis. 429) → seluruh dashboard jadi error state, 4 respons sukses dibuang |
| `TeacherDashboardPage.jsx:92-107` | 6 (settings [403], jadwal hari, jadwal minggu, missing journals, izin guru, exemption) | idem + satu request **pasti** 403 |
| `StudentHomePage.jsx:75-80` | 4 | idem |
| `ParentMonitoringPage.jsx:59-65` | 5 | idem |
| `MonitoringRecapPage.jsx:83-87` | 3 + rekap harian saat tanggal dipilih | `attRes`/`jourRes` tanpa `.catch` → `Promise.all` gagal-total |
| `ScheduleImportPage.jsx` | 2 + 4 + detail batch | 4 request master data + polling |

Hanya sebagian yang memakai `.catch(() => ({data: []}))`. Artinya **satu gangguan kecil di satu endpoint menghapus seluruh isi halaman**. Dikombinasikan dengan A5 (429) dan A2 (antrean), ini adalah mekanisme utama "halaman kosong padahal data ada".

#### W-8 · Pengambilan data yang menduplikasi pekerjaan server **[TERBUKTI — Medium]**
`TeacherDashboardPage.jsx:92-103` mengambil **dua kali** jadwal: `{day, cycle, all:1, per_page:50}` dan `{cycle, all:1, per_page:200}`. Daftar "hari ini" adalah subset dari daftar mingguan, dan keduanya menjalankan `ScheduleController::index` yang memetakan setiap baris lewat `mapScheduleItem` (termasuk resolusi jam + cek pengecualian). Ini menggandakan beban terberat pada endpoint jadwal hanya untuk halaman pertama yang dibuka guru.

#### W-9 · Fallback jurnal mengambil jadwal pertama, bukan jadwal aktif **[TERBUKTI — Medium]**
`TeacherJournalPage.jsx:78-83`:
```js
journalApi.getTeacherSchedules({ per_page: 1 })
  .then((res) => { if (res.success && res.data?.length) setSchedule(res.data[0]); })
```
`GET /schedules` diurutkan `day_of_week, period_number` (`ScheduleController.php:268`), sehingga `data[0]` adalah **jadwal Senin jam pertama** dari siklus aktif — bukan jam pelajaran yang sedang berlangsung. Jika halaman dibuka tanpa `location.state` (mis. refresh halaman, bookmark, atau dari menu), guru dapat membuka jurnal untuk kelas/mapel yang salah. Ini juga berpotensi melahirkan jurnal pada tanggal yang tidak diharapkan.

#### W-10 · Kontrak respons yang berbeda antar endpoint membuat frontend menebak **[INDIKASI — Medium]**
Beberapa endpoint mengembalikan bentuk berbeda tanpa penanda seragam:
- `GET /academic-events/check-exemption` → objek di `data` (`AcademicEventController.php:618-630`).
- `GET /academic-events/my-calendar` → objek di `data` (bukan list).
- `GET /academic-events` → list.
- `GET /schedules?status=missing_journal` → list + `meta.total_missing` (tanpa pagination), sedangkan mode reguler memakai pagination.

Akibatnya setiap halaman menulis logika pembongkaran sendiri-sendiri (`res?.data ?? res`, `Array.isArray(res.data) ? … : res.data.data`, dst). Di web sebagian besar benar; di mobile tidak (lihat M-3). Setiap endpoint baru menambah peluang kesalahan baca.

#### W-11 · Hal kecil lain yang terbukti
- **`StrictMode` aktif di mode dev** (`main.jsx:7`): setiap efek mount dijalankan dua kali → **semua request GET berlipat dua di dev**, memperparah A2/A5. Tidak berlaku pada build produksi (perlu dicatat agar tidak salah menyimpulkan produksi ikut terdampak).
- **Tidak ada retry dengan backoff** di mana pun: satu kegagalan = satu kegagalan permanen dari sudut pandang UI.
- **`setTimeout` untuk toast tanpa cleanup** (`DashboardWakaPage.jsx:81-89`, `AcademicCalendarPage.jsx:61-67`, dll.) → `setState` setelah unmount (peringatan konsol, bukan kebocoran serius).
- **`window.confirm`/`alert`** masih dipakai di beberapa halaman padahal ada `ConfirmDialog` — inkonsistensi UX, bukan performa.
- **`/change-password` berada di luar `ProtectedRoute`** dan memanggil API tanpa sesi → 401 + pesan error yang membingungkan bila dibuka langsung.

---

## 4. Hasil Analisis Frontend Mobile (React + Capacitor Android)

### 4.1 Konteks penting
`frontend/scp_mobile` **bukan Flutter** (dokumen PRD masih menyebut Flutter — itu divergensi dokumen). Stack aktual: React 19 + Capacitor, `capacitor.config.json` (`appId id.my.schoolclassprogress.app`, `webDir dist`), folder `android/` ada namun **untracked** di git.

### 4.2 Temuan

#### M-1 · Mobile tidak dapat menghubungi backend sama sekali **[TERBUKTI — Critical]**
Dua lapisan kegagalan yang berdiri sendiri-sendiri:

1. **Alamat API = IP LAN developer.**
   `frontend/scp_mobile/.env:1` → `VITE_API_BASE_URL=http://192.168.0.121:8000/api`, dan nilai ini sudah **tertanam di artefak build** (`dist/assets/Badge-Cwwa2Egz.js`). Perangkat yang tidak berada di Wi-Fi yang sama tidak akan pernah mencapai alamat ini.

2. **Android memblokir HTTP polos.**
   `android/app/src/main/AndroidManifest.xml` hanya mendeklarasikan `android.permission.INTERNET`. Tidak ada `android:usesCleartextTraffic="true"`, tidak ada `android:networkSecurityConfig`, dan manifest gabungan hasil build (`build/intermediates/merged_manifest/debug/.../AndroidManifest.xml`) menunjukkan `targetSdkVersion="36"`. Sejak `targetSdk ≥ 28`, cleartext HTTP diblokir secara default; WebView Capacitor juga memuat app dari origin `https://localhost`, sehingga request ke `http://…` kena blokir cleartext **dan** mixed-content.

**Kesimpulan:** selama mobile memakai HTTP ke IP LAN, kegagalan koneksi bersifat **sistematis, bukan intermiten**. Bila di lapangan gejala terlihat "kadang bisa", maka kemungkinan besar yang dipakai adalah build lain (misal versi web di browser ponsel, atau build dengan `.env` berbeda) — perlu dikonfirmasi **[PERLU PENGUJIAN]**.

#### M-2 · Logout paksa pada gangguan jaringan (lebih sering terjadi di mobile) **[TERBUKTI — High]**
`scp_mobile/src/context/AuthContext.jsx:64-72` mengulang pola web: `catch` apa pun → hapus token & user. Pada jaringan seluler (handover Wi-Fi ↔ seluler, sinyal lemah, background/foreground), timeout 15 detik jauh lebih sering terjadi. Akibatnya **mobile jauh lebih sering "tiba-tiba logout"** daripada web meski backendnya sama.

#### M-3 · Pembacaan respons salah → banner agenda tidak pernah tampil **[TERBUKTI — High]**
`scp_mobile/src/pages/student/StudentPermissionPage.jsx:279`:
```js
if (res?.data?.data?.disabling_event) { const dev = res.data.data.disabling_event; ... }
```
Sesuai `AcademicEventController.php:618-630`, payload ada di `res.data.disabling_event`. Jadi kondisi selalu false → peringatan "tanggal bertepatan agenda sekolah" tidak pernah muncul. Web melakukan hal yang benar (`StudentPermissionPage.jsx:99-101` memakai `res?.data ?? res`), sehingga ini **divergensi web vs mobile** — bukti bahwa logika yang sama diimplementasikan dua kali dengan hasil berbeda.

#### M-4 · Lapisan service mobile memuat panggilan ke route yang tidak ada **[TERBUKTI — Medium/Laten]**
Dibandingkan terhadap `routes/api.php`:
| Panggilan di service mobile | Route di backend | Status |
| --- | --- | --- |
| `POST /confirm-password` (`academicEventApi.js:22`, `masterDataApi.js:116`) | tidak ada; yang ada `POST /me/verify-password` | **404** bila dipakai |
| `GET /schedules/{id}/students` (`journalApi.js:45`) | tidak ada (hanya `GET /schedules`) | **404** |
| `GET/POST/PUT/DELETE /parents…` (`masterDataApi.js:95-99`) | tidak ada | **404** |
| `GET/POST/PUT/DELETE /teacher-assignments…` (`masterDataApi.js:103-107`) | tidak ada (yang ada `/teachers/{id}/assignments`) | **404** |
| `GET /rooms|classes|subjects|teachers|students|schedules/{id}` (`masterDataApi.js`, `scheduleApi.js`) | tidak ada route `show` untuk entitas tersebut | **404** |

Saat ini sebagian besar method tersebut **tidak dipanggil halaman mana pun** (hasil grep terhadap 24 halaman). Yang perlu diwaspadai: `PasswordSheet.jsx:52` akan memanggil `confirmPassword` bila prop `verifyWithBackend` bernilai true — dan prop itu hanya dipasang di `Phase1RouteShell.jsx:459`. Bila shell tersebut diaktifkan kembali, semua konfirmasi kata sandi akan gagal 404. **[INDIKASI — Laten]**

#### M-5 · Perilaku transport identik dengan web namun tanpa penyesuaian mobile **[TERBUKTI — Medium]**
`scp_mobile/src/services/api.js` memakai `timeout: 15000` yang sama, tanpa retry, tanpa penanganan khusus untuk kondisi offline/background. Tidak ada antrean request offline. Untuk aplikasi mobile, 15 detik tanpa retry berarti setiap perpindahan jaringan berpotensi menjadi kegagalan yang terlihat pengguna.

#### M-6 · Yang **tidak** ditemukan (agar tidak salah tuduh)
- Tidak ada polling agresif di mobile (hanya countdown OTP/profil).
- Tidak ada kebocoran `setInterval` pada halaman data (semua timer punya cleanup).
- Mobile **tidak** memakai `sessionStorage` untuk batch import, sehingga tidak ada masalah lintas-tab.
- `days`/`per_page` pada pemanggilan data master di mobile relatif wajar; masalah keterpotongan dropdown 15 baris (W-4) **tidak** ditemukan di mobile.

---

## 5. Hasil Analisis Integrasi & Infrastruktur

### 5.1 Peta alur data (ringkas)
```
PostgreSQL 18 (db_scp, 127.0.0.1:5432)
        │  Eloquent + agregasi SQL
        ▼
Laravel 13 API  ── php -S 0.0.0.0:8000  (single-threaded, tanpa config cache, tanpa queue worker)
        │  Sanctum Bearer token, CORS: allow *
        │  cache/ratelimit: tabel `cache` di DB yang sama
        ├──► Web React (Vite dev :5173 / dist via Nginx)  VITE_API_BASE_URL=http://localhost:8000/api
        └──► Mobile Capacitor (Android, targetSdk 36)     VITE_API_BASE_URL=http://192.168.0.121:8000/api
                                                          Supabase S3 (asset) via AWS_ENDPOINT
```

### 5.2 Temuan

#### I-1 · Backend single-threaded — **terbukti lewat pengukuran** **[TERBUKTI — Critical]**
Proses yang melayani port 8000 adalah PHP built-in server:
```
C:\php\php.exe -S 0.0.0.0:8000 ...\resources\server.php
```
Bukti antrean (probe read-only `GET /api/ping`, tanpa autentikasi, tanpa sentuhan data):

```
single request  : 415 ms / 216 ms / 238 ms (berurutan)
6 CONCURRENT    : #0 210ms  #1 423ms  #2 596ms  #3 778ms  #4 1006ms  #5 1185ms
WALL 6 request  : 1189 ms   ← tepat menjumlah, bukan paralel
```
Selisih antar-request ≈ 180–190 ms konstan = tanda tangan **antrean FIFO satu worker**.

Implikasi:
- Halaman dengan 5 request paralel **secara efektif berjalan berurutan** (±1–2 detik hanya untuk transport pada mesin lokal).
- Setiap operasi AI/PDF (20–90 detik, lihat B-1) **membekukan seluruh API** untuk semua pengguna. Selama itu, `/api/me` pun timeout 15 detik → memicu W-2/M-2 (logout paksa). Inilah rantai lengkap "aplikasi macet lalu bisa sendiri".
- `PHP_CLI_SERVER_WORKERS` dikomentari di `.env` dan pada Windows tidak didukung, sehingga penambahan worker bukan solusi yang bisa diandalkan.

**Catatan kejujuran analitis:** ini kondisi **lingkungan demo/development**. Bila pengguna mengalami gejala yang sama pada VPS produksi, penyebabnya berbeda (kemungkinan PHP-FPM `pm.max_children` kecil, atau Nginx proxy timeout) dan **harus diverifikasi terpisah** **[PERLU PENGUJIAN]**. Namun karena seluruh artefak frontend saat ini menunjuk ke `localhost`/IP LAN, sangat mungkin yang diuji di lapangan juga backend dev ini.

#### I-2 · Tidak ada queue worker; konfigurasi queue tidak bermakna **[TERBUKTI — High]**
`QUEUE_CONNECTION=database`, tabel `jobs` = 0 baris, tidak ada proses `artisan queue:work`. Semua job dipanggil `dispatchSync`. Jadi sistem tidak memiliki jalur eksekusi asinkron sama sekali, meski skema database dan konfigurasi menyiratkan sebaliknya. Ini **titik kritis** untuk perbaikan B-1: memindahkan job ke `dispatch()` tanpa worker hanya akan menghasilkan kuis yang berhenti di status `generating`.

#### I-3 · Konfigurasi klien tidak konsisten satu sama lain **[TERBUKTI — Critical]**
| Klien | Base URL aktif | Konsekuensi |
| --- | --- | --- |
| Web `.env` (dev) | `http://localhost:8000/api` | benar hanya bila browser dan backend di mesin yang sama |
| Web `.env.production` | `http://localhost:8000/api` | **salah** untuk deployment apa pun selain localhost |
| Web `dist/` (build yang ada) | `http://localhost:8000/api` | salah |
| Mobile `.env` | `http://192.168.0.121:8000/api` | salah di luar Wi-Fi tersebut |
| Mobile `dist/` | `http://192.168.0.121:8000/api` | salah |

Web dan mobile **tidak berbagi satu sumber konfigurasi**, sehingga setiap perubahan alamat API harus dilakukan dua kali dan mudah terlupa — persis yang terjadi.

#### I-4 · CORS bukan penyebabnya **[TERBUKTI — bukan masalah]**
Probe `OPTIONS /api/login` dengan `Origin: http://localhost:5173` membalas `204` dengan `Access-Control-Allow-Origin: *`. Tidak ada `config/cors.php` (memakai default framework) — untuk aplikasi token-based ini cukup. **Jangan menghabiskan waktu memperbaiki CORS.**

#### I-5 · HTTPS/SSL & reverse proxy tidak ada di jalur yang dipakai **[TERBUKTI — Medium]**
`frontend/scp_web/deploy/nginx/default.conf` menyediakan konfigurasi statis SPA, tetapi blok `location /api/` untuk reverse proxy ke Laravel **dikomentari**. Tidak ada konfigurasi TLS. Selama mobile masih HTTP, M-1 tidak bisa diselesaikan tanpa HTTPS.

#### I-6 · Timezone & tanggal: dua sumber kebenaran yang berbeda **[TERBUKTI — High]**
Backend: `config/app.php:68` = `Asia/Jakarta`, dan semua perhitungan tanggal memakai `Carbon::now('Asia/Jakarta')`. Frontend web & mobile: `new Date().toISOString()` (UTC) untuk mengirim `date`. Selisih 7 jam ini menyebabkan permintaan data "hari ini" pada 00:00–06:59 WIB menunjuk ke hari sebelumnya. **Ini bukan sekadar bug tampilan: nilai `date` dikirim ke backend dan dipakai untuk filter jurnal/presensi/agenda.**

#### I-7 · Data yang ada cukup untuk mengukur SQL, tetapi tidak untuk mensimulasikan beban penuh **[KOREKSI — batasan]**
Versi pertama bagian ini menyatakan "database lokal kosong". **Itu salah** (lihat §0.3). Kondisi sebenarnya:

| Kelompok data | Kondisi | Implikasi pengukuran |
| --- | --- | --- |
| Master data (`users` 3.514, `classes` 48, `rooms` 53, `subjects` 84, `teacher_assignments` 96) | **terisi, skala nyata** | query master data & jadwal **dapat** diukur dan hasilnya <1 ms |
| `schedules` 721 (semua siklus 1) | terisi | endpoint terberat (`GET /schedules?all=1`) terukur: 0,41 ms di DB |
| `journals` 1, `attendances` 0 | **praktis kosong** | perilaku pada volume 8.000 jurnal / 250.000 presensi **belum terukur** |
| `leave_requests`, `teacher_leave_requests`, `quiz_submissions` | 0 | alur perizinan & hasil kuis belum terukur dengan data |

Artinya: klaim "query lambat" **sudah terbantah untuk tabel master & jadwal** (diukur), tetapi **belum terbantah** untuk tabel transaksional yang masih kosong. Skrip pengukuran skalabilitas pada `dataset-plan.md` tetap relevan — bukan karena DB kosong, melainkan karena `journals`/`attendances` belum berisi.

#### I-8 · Respons API tidak seragam untuk kasus list vs objek **[INDIKASI — Medium]**
Lihat W-10. Ditambah: `meta` pada `missing_journal` berisi `total_missing` (bukan `total`/`last_page`), sehingga komponen `Pagination` bersama tidak bisa dipakai seragam.

#### I-9 · Aset & storage **[INDIKASI — Low]**
`FILESYSTEM_DISK=s3` dengan endpoint Supabase. `Journal::photo_url` dan `LeaveRequest::document_url` adalah accessor absolut, tetapi `TeacherLeaveRequest` tidak punya accessor sehingga frontend menyusun URL sendiri dari `VITE_STORAGE_BASE_URL`. Bila env berbeda antar klien (web vs mobile), URL berkas bisa menunjuk host yang salah — relevan untuk "dokumen tidak tampil".

---

## 6. Identifikasi Root Cause

### 6.1 Kelompok A — Penyebab utama yang sudah terbukti (wajib diperbaiki lebih dulu)
| Kode | Root cause | Komponen terdampak | Bukti |
| --- | --- | --- | --- |
| RC-1 | **Alamat API pada artefak yang dipakai klien salah** (`localhost` di build web, IP LAN di build mobile) | Web, Mobile, Infra | W-1, M-1, I-3 |
| RC-2 | **Backend hanya melayani satu request sekaligus** (`php -S`) | Backend, Infra, semua klien | I-1 (pengukuran) |
| RC-3 | **Kerja panjang dijalankan sinkron** (AI, PDF, grading) | Backend | B-1 |
| RC-4 | **Timeout klien 15 s < durasi kerja server 60–120 s** | Web, Mobile | A4, B-1 |
| RC-5 | **Rate limit 60/menit per user dipakai bersama + polling 1,5 s + fan-out 4–6 request** | Backend, Web | B-2, W-7 |
| RC-6 | **Setiap error jaringan diperlakukan sebagai sesi berakhir** | Web, Mobile | W-2, M-2 |
| RC-7 | **Mobile Android memblokir HTTP polos** | Mobile, Infra | M-1 |

### 6.2 Kelompok B — Penyebab yang menyebabkan "data ada tapi tampil kosong"
| Kode | Root cause | Bukti |
| --- | --- | --- |
| RC-8 | Kontrak pembongkaran respons salah (`res.data.success`, `res.data.data`) | W-3, M-3 |
| RC-9 | Default pagination 15 dipakai untuk daftar dropdown | W-4 |
| RC-10 | Tanggal UTC vs `Asia/Jakarta` | W-5, I-6 |
| RC-11 | `Promise.all` gagal-total: satu endpoint gagal mengosongkan seluruh halaman | W-7 |
| RC-12 | Fallback "jadwal pertama" pada halaman jurnal | W-9 |
| RC-13 | Izin yang disetujui setelah jurnal ditutup tidak pernah disinkronkan ke presensi | B-9 |

### 6.3 Kelompok C — Risiko yang belum berdampak (skala data masih kecil)
| Kode | Root cause | Bukti |
| --- | --- | --- |
| RC-14 | Indeks hilang: `journals(date)`, `attendances(journal_id)`, unique `(journal_id, student_id)` | B-5 |
| RC-15 | N+1 ringan & query berulang pada helper otorisasi | B-6 |
| RC-16 | `per_page` tidak dibatasi pada `GET /attendances` | B-4 |
| RC-17 | Cache/rate limit di database → tulis per request & kontensi baris | B-3 |
| RC-18 | `POST /login` tanpa rate limit | B-8 |
| RC-19 | Tidak ada proteksi race condition pada request klien | W-6 |

### 6.4 Kelompok D — Belum dapat dipastikan (butuh pengujian)
| Kode | Hal yang belum pasti | Cara memastikan |
| --- | --- | --- |
| U-1 | Perilaku nyata `DELETE /quizzes/{id}` yang terdefinisi ganda | Uji integrasi dengan dua role |
| U-2 | Apakah build yang dipakai di lapangan adalah `dist/` yang ada di repo | Cek timestamp/version build di perangkat |
| U-3 | Apakah gejala juga muncul di VPS produksi, dan dengan konfigurasi FPM/Nginx apa | Profil produksi + APM/log |
| U-4 | Dampak nyata `journals(date)` tanpa indeks | `EXPLAIN ANALYZE` pada dataset menyerupai produksi |
| U-5 | Apakah `Phase1RouteShell` masih dipakai | Telusuri `AppRouter.jsx` |

---

## 7. Dampak Permasalahan

### 7.1 Dampak terhadap performa
| Masalah | Dampak terukur/perkiraan |
| --- | --- |
| RC-2 (single-thread) | Throughput = 1 request/±0,2 s. 5 request paralel pada satu dashboard = ±1,2 s wall-clock. Dengan operasi AI 30 s, **seluruh API tidak melayani siapa pun selama 30 s**. |
| RC-3 + RC-4 | 1 klik "Generate soal AI" berpotensi menghasilkan **1 timeout klien**, 1 pekerjaan server yang tetap selesai, dan (bila user mengulang) **1 kuis duplikat**. |
| RC-5 | Setiap ±40–60 request/menit dari satu akun memicu 429; dengan 2 tab terbuka, ambang ini realistis terlampaui. |
| RC-17 | +2 query DB (1 SELECT, 1 UPDATE) per request terautentikasi hanya untuk rate limit. |
| RC-14/15/16 | Terukur tidak berdampak pada data sekarang (721 jadwal = 0,41 ms; index-only scan pada 1.711 siswa = 0,78 ms). Risiko nyata muncul saat `journals`/`attendances` terisi (kini 1 dan 0 baris). |

### 7.2 Dampak terhadap kestabilan
- **Sesi tidak stabil:** timeout biasa → logout paksa (RC-6). Ini yang paling merusak pengalaman dan paling mungkin dilaporkan sebagai "koneksi tidak stabil".
- **Hasil kerja hilang dari sudut pandang pengguna:** jurnal selesai, kuis ter-generate, import ter-parse — tetapi UI menyatakan gagal (RC-4). Pengguna mengulang → data duplikat (`attendances` tanpa unique, kuis ganda).
- **Perilaku berbeda antar klien:** web benar, mobile salah untuk kasus yang sama (RC-8). Ini menciptakan kesan "backend tidak konsisten", padahal backend mengembalikan bentuk yang sama.

### 7.3 Dampak terhadap pengalaman pengguna
| Peran | Dampak konkret |
| --- | --- |
| Waka | Dashboard kosong/error saat 1 dari 5 endpoint gagal; dropdown import terpotong 15 baris sehingga resolusi baris mustahil; rekap harian tidak pernah tampil. |
| Guru | Logout tiba-tiba; dashboard memuat 6 request (1 pasti 403); jurnal bisa terisi pada kelas/jadwal yang salah bila dibuka dari menu; AI generate terasa "gagal" padahal soal sudah jadi. |
| Siswa | Jadwal & agenda "hari ini" kosong pada pagi hari (UTC); banner libur tidak muncul di mobile; permohonan izin tidak memperingatkan bentrok agenda. |
| Orang tua | Data presensi/anak bisa kosong karena tanggal UTC; sesi sering terputus di mobile. |
| Operator/Dev | Log penuh 403/500 yang sebenarnya normal; sulit membedakan "gagal jaringan" dari "gagal otorisasi" karena keduanya berujung pada hal yang sama di UI. |

---

## 8. Rencana Perbaikan (Improvement Plan)

> Semua item di bawah adalah **rekomendasi**. Belum ada yang diterapkan. Setiap item menyebutkan komponen/file yang perlu disentuh agar dapat diperkirakan dampaknya.

### 8.1 Perbaikan transport & konfigurasi (prioritas tertinggi)

**P-1 · Satukan sumber alamat API, dan jangan pernah `localhost` di artefak build**
- Komponen: `frontend/scp_web/.env*`, `frontend/scp_mobile/.env*`, `vite.config.js` (kedua app), `frontend/scp_web/deploy/nginx/default.conf`, dokumentasi `DEPLOYMENT.md`.
- Rekomendasi:
  1. Produksi web: gunakan **path relatif** `/api` + reverse proxy Nginx (`location /api/ { proxy_pass http://127.0.0.1:8000/api/; }`) sehingga satu domain, tanpa CORS, tanpa URL absolut yang bisa salah.
  2. Mobile: gunakan **domain HTTPS publik** (bukan IP LAN). Sediakan `.env.development` untuk IP LAN agar dev tetap mudah.
  3. Tambahkan validasi build-time: gagalkan `npm run build` bila `VITE_API_BASE_URL` mengandung `localhost` atau IP privat pada mode production.
- Verifikasi keberhasilan: `grep -r "localhost\|192.168" dist/assets/*.js` → nol hasil.

**P-2 · Sediakan server yang benar (bukan `php -S`)**
- Komponen: lingkungan (bukan kode) — Nginx + PHP-FPM, atau setidaknya `php artisan serve` di balik proxy dengan jumlah worker memadai; dokumentasikan langkah ini.
- Untuk pengembangan lokal yang realistis: gunakan **Herd/Laragon/Nginx+FPM** agar perilaku konkuren mirip produksi, supaya bug konkurensi tidak "hilang" di dev.
- Verifikasi: ulangi probe 6 request konkuren → wall-clock harus mendekati 1× waktu satu request, bukan 6×.

**P-3 · Pindahkan pekerjaan panjang ke queue (dan jalankan worker)**
- Komponen: `QuizController.php:280-430, 800-830`, `ScheduleImportController.php:52-77`, job classes, `config/queue.php`, dokumentasi operasional.
- Rekomendasi: pakai `dispatch()` (bukan `dispatchSync`), kembalikan `202 Accepted` + `{status: 'generating'}`, jalankan `php artisan queue:work` sebagai service (systemd/Supervisor). Worker harus dinyalakan **sebelum** perubahan ini dirilis — jika tidak, kuis akan berhenti di status `generating`.
- Alternatif sementara bila worker tidak memungkinkan: tetap sinkron, tetapi **naikkan timeout klien khusus endpoint AI** (`timeout: 120000`) dan tampilkan progres yang jujur. Ini hanya penambal, bukan solusi.

**P-4 · Selaraskan strategi timeout & retry di klien**
- Komponen: `frontend/scp_web/src/services/api.js:6`, `frontend/scp_mobile/src/services/api.js:11`, `quizApi.js`, `scheduleImportApi.js`.
- Rekomendasi: timeout default 15 s untuk endpoint baca; endpoint berat (AI, import) memakai timeout eksplisit ≥ durasi maksimum server; tambahkan **retry eksponensial (maks 2×) hanya untuk GET** dan hanya untuk error jaringan/5xx/429 (bukan 4xx logika); hormati `Retry-After` pada 429.

**P-5 · Pisahkan "gagal jaringan" dari "sesi berakhir"**
- Komponen: `scp_web/src/context/AuthContext.jsx:43-51`, `LoginPage`/`login()` fallback, `scp_mobile/src/context/AuthContext.jsx:64-72`, `services/api.js` (interceptor 401/5xx).
- Rekomendasi: hapus token **hanya** pada `401` yang benar-benar berasal dari validasi token (bukan pada timeout/`ERR_NETWORK`/5xx/429). Jika `/me` gagal karena jaringan: pertahankan sesi, gunakan cache `scp_user` di `localStorage`, tampilkan banner "gagal menyegarkan sesi" + tombol coba lagi. Hapus fallback user parsial `{nis_nip}` yang tidak punya `role`.

**P-6 · Perbaiki mobile agar bisa bicara HTTP/HTTPS**
- Komponen: `frontend/scp_mobile/.env`, `android/app/src/main/AndroidManifest.xml` (atau `network_security_config.xml`), `capacitor.config.json`.
- Rekomendasi utama: **HTTPS** untuk API (menyelesaikan cleartext + mixed content + keamanan token sekaligus). Bila harus HTTP untuk demo: tambahkan `network_security_config` yang membatasi cleartext hanya ke domain/IP lokal (`domain-config cleartextTrafficPermitted="true"`) — jangan `usesCleartextTraffic="true"` global di build produksi.

**P-7 · Turunkan dan sebarkan beban rate limiter**
- Komponen: `AppServiceProvider.php:26`, `routes/api.php:46`, `ScheduleImportPage.jsx:383`.
- Rekomendasi: (a) naikkan batas untuk endpoint baca (mis. 240/menit) dan pertahankan batas ketat untuk mutasi; (b) kunci limiter per **token/device**, bukan hanya user id; (c) ubah polling import menjadi **backoff adaptif** (1,5 s → 3 s → 5 s) dan hentikan polling saat tab tidak aktif (`document.visibilityState`); (d) tambahkan jitter agar beberapa tab tidak menembak bersamaan.

**P-8 · Batasi dan validasi pagination**
- Komponen: `AttendanceController.php:105`, `JournalController.php:103`, `ScheduleController.php:54`.
- Rekomendasi: validasi `per_page` dengan `min:1|max:100` (atau `max` spesifik endpoint), dokumentasikan default 15, dan sediakan parameter `all=1` eksplisit hanya untuk endpoint yang memang butuh seluruh data (seperti `classes`).

### 8.2 Perbaikan "data ada tapi tampil kosong"

**P-9 · Standarkan kontrak respons & helper pembongkaran**
- Komponen: semua `services/*.js`, `MonitoringRecapPage.jsx:118`, `StudentPermissionPage.jsx:279` (mobile), `ParentMonitoringPage`, `DashboardWakaPage`.
- Rekomendasi: (a) tetapkan satu konvensi: interceptor mengembalikan envelope, payload selalu di `res.data`; (b) buat helper tunggal `unwrap(res)` di `src/utils/` dan gunakan di seluruh halaman; (c) perbaiki dua baris yang terbukti salah; (d) tambahkan aturan lint (`no-restricted-syntax`) untuk melarang pola `res.data.data` dan `res.data.success`.

**P-10 · Lengkapi pemanggilan master data untuk dropdown**
- Komponen: `ScheduleImportPage.jsx:254-257`.
- Rekomendasi: gunakan `per_page: 100` (atau `all` untuk kelas) **dan** tampilkan indikator bila `meta.total > jumlah yang dimuat`, sehingga keterpotongan terlihat, bukan tersembunyi.

**P-11 · Satukan perhitungan tanggal lokal**
- Komponen: `src/utils/` (kedua app), `DashboardWakaPage.jsx:85`, `StudentHomePage.jsx:72`, `ParentMonitoringPage.jsx:50`, `StudentSchedulePage`, `StudentPermissionPage`, `TeacherJournalPage`.
- Rekomendasi: satu util `todayLocalISO()` yang menghitung tanggal dengan offset Asia/Jakarta (atau `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta'})`), dipakai di semua tempat; idealnya backend menerima `date` opsional dan default ke `now('Asia/Jakarta')` (sudah begitu) sehingga klien tidak perlu mengirim tanggal untuk kasus "hari ini".

**P-12 · Ubah `Promise.all` menjadi `Promise.allSettled` pada pemuatan dashboard**
- Komponen: `DashboardWakaPage.jsx:91-96`, `TeacherDashboardPage.jsx:92-107`, `StudentHomePage.jsx:75-80`, `ParentMonitoringPage.jsx:59-65`, `MonitoringRecapPage.jsx:83-87`.
- Rekomendasi: render bagian yang berhasil, tampilkan error **per-kartu** (bukan seluruh halaman), dan sediakan tombol "muat ulang" per bagian. Ini sendiri sudah menghilangkan mayoritas keluhan "halaman kosong".

**P-13 · Hilangkan request yang pasti gagal & duplikat**
- Komponen: `TeacherDashboardPage.jsx:82` (hapus `getSettings()`, ambil `active_cycle` dari `/me`), `TeacherDashboardPage.jsx:92-103` (cukup satu request jadwal mingguan, turunkan "hari ini" dari situ di klien), `TeacherJournalPage.jsx:78-83` (jangan fallback ke `data[0]`; minta jadwal hari ini/saat ini, atau arahkan pengguna memilih jadwal).

**P-14 · Rapikan race condition**
- Komponen: semua halaman dengan filter (minimal `ScheduleManagementPage`, `MonitoringRecapPage`, `AcademicCalendarPage`, `MasterDataPage`).
- Rekomendasi: `AbortController` di setiap efek pemuatan; atau simpan `requestId` dan abaikan respons yang bukan terbaru.

**P-15 · Sinkronkan presensi saat izin disetujui (butuh ruling bisnis)**
- Komponen: `LeaveRequestController::update` (approve), `JournalController` (sinkronisasi saat ini).
- Rekomendasi: setelah approval, perbarui `attendances` untuk jurnal pada rentang tanggal izin bila jurnal sudah `completed`; atau ubah aturan agar approval wajib sebelum jurnal ditutup. **Perlu keputusan user sebelum implementasi.**

### 8.3 Perbaikan data layer (antisipasi skala)

**P-16 · Tambahkan indeks yang hilang (satu migration baru, tanpa mengubah data)**
- `journals`: indeks pada `date`.
- `attendances`: indeks pada `journal_id`; unique `(journal_id, student_id)` **setelah** membersihkan duplikat yang mungkin ada.
- Hapus salah satu indeks komposit `schedules` yang redundan (`(cycle_type, day_of_week)` vs `(day_of_week, cycle_type)`).
- Verifikasi: `EXPLAIN ANALYZE` sebelum/sesudah pada dataset menyerupai produksi.

**P-17 · Kurangi query berulang pada helper otorisasi**
- Komponen: `app/Models/User.php` (`isKesiswaan`, `isWaliKelas`, `homeroomClassIds`, `hasAssignment`).
- Rekomendasi: memoize hasil per instance (`$this->cachedAssignments ??= $this->assignments()->get()`), sehingga 3–5 pemanggilan dalam satu request menjadi 1 query. Ganti `$user->assignments()->where(...)->exists()` berulang di `AcademicEventController` dengan satu pembacaan koleksi.

**P-18 · Hilangkan query di dalam loop**
- Komponen: `AcademicEventController.php:273`.
- Rekomendasi: gunakan `$classTargetMap` yang **sudah** disiapkan di baris 239-241 (saat ini hanya dipakai untuk nama kelas) untuk memetakan level tanpa query.

**P-19 · Pindahkan cache/rate limiter ke store yang tepat**
- Komponen: `.env` (`CACHE_STORE`), `config/cache.php`.
- Rekomendasi: untuk produksi gunakan Redis (atau `file` bila Redis tidak tersedia); `database` tidak ideal untuk rate limiting konkuren. Jika tetap `database`, sadari biaya +2 query/request.

**P-20 · Rate limit pada `POST /login`**
- Komponen: `routes/api.php:35-38`, `AppServiceProvider` (limiter `login`).
- Rekomendasi: `throttle:login` = 5/menit per IP+username, dengan pesan 429 yang jelas.

**P-21 · Bersihkan dead code & duplikasi kontrak**
- Hapus/benahi method service mobile yang menunjuk route tidak ada (`/parents`, `/teacher-assignments`, `/{entity}/{id}`, `/schedules/{id}/students`, `/confirm-password`).
- Satukan alias route ganda (`/cycle-history` vs `/academic-settings/cycle-history`) dan selesaikan duplikasi `DELETE /quizzes/{id}`.

### 8.4 Perbaikan operasional
**P-22 · Aktifkan config/route cache di produksi** (`php artisan config:cache && route:cache && view:cache`) — mengurangi bootstrap per request.
**P-23 · Tambahkan observability:** log terstruktur untuk request lambat (middleware `duration > 1000ms`), metrik 429/5xx, dan health endpoint yang juga memeriksa DB + queue (`/up` saat ini hanya menandakan aplikasi hidup).
**P-24 · Dokumentasikan "cara menjalankan yang benar"** (Nginx+FPM, worker queue, env per lingkungan) di `DEPLOYMENT.md` agar konfigurasi keliru tidak terulang.

---

## 9. Prioritas Perbaikan

### Critical — aplikasi tidak dapat dipakai / kehilangan pekerjaan pengguna
| ID | Item | Alasan |
| --- | --- | --- |
| RC-1 / P-1 | Alamat API pada artefak build (web `localhost`, mobile IP LAN) | Tanpa ini, tidak ada klien yang bisa mencapai backend di luar mesin lokal. |
| RC-2 / P-2 | Backend single-threaded | Membuat seluruh sistem rentan macet total; terbukti lewat pengukuran. |
| RC-6 / P-5 | Logout paksa pada error jaringan | Merusak sesi pengguna secara sistematis; penyebab langsung keluhan "koneksi tidak stabil". |
| RC-7 / P-6 | Cleartext HTTP diblokir di Android | Mobile tidak berfungsi di perangkat nyata. |
| RC-3 / P-3 | Job panjang sinkron | Membekukan API + memicu timeout massal. |

### High — fitur tampak rusak / data tidak tampil
| ID | Item |
| --- | --- |
| RC-4 / P-4 | Timeout klien vs durasi server (AI, import) |
| RC-5 / P-7 | Rate limit 60/menit + polling 1,5 s + fan-out |
| RC-8 / P-9 | Kontrak pembongkaran respons salah (W-3, M-3) |
| RC-9 / P-10 | Dropdown terpotong 15 baris |
| RC-10 / P-11 | Tanggal UTC vs Asia/Jakarta |
| RC-11 / P-12 | `Promise.all` gagal-total |
| RC-13 / P-15 | Sinkronisasi izin → presensi (butuh ruling) |
| RC-19 / P-14 | Race condition pada filter |

### Medium — risiko & kualitas
| ID | Item |
| --- | --- |
| RC-12 / P-13 | Fallback "jadwal pertama" pada jurnal + request duplikat/403 |
| RC-15 / P-17 | Query berulang helper otorisasi |
| RC-16 / P-8 | Pagination tak dibatasi |
| RC-17 / P-19 | Cache/rate limit di database |
| RC-18 / P-20 | Login tanpa rate limit |
| RC-14 / P-16 | Indeks hilang (jalankan sebelum data produksi tumbuh) |
| P-22 / P-23 | Config cache & observability |

### Low — kebersihan & konsistensi
| ID | Item |
| --- | --- |
| RC-21 / P-21 | Dead code, route ganda, alias |
| — | `StrictMode` ganda di dev (dokumentasikan, jangan "diperbaiki" dengan mematikan StrictMode) |
| — | Cleanup `setTimeout` toast; seragamkan `ConfirmDialog` |
| — | `/change-password` di luar `ProtectedRoute` |
| — | `PeriodResolutionService` memanggil `SystemConfiguration::first()` berulang |

---

## 10. Tahapan Implementasi (berdasarkan dependensi)

> Prinsip: **jangan mengubah perilaku bisnis dan transport pada saat yang sama**. Setiap tahap harus dapat diverifikasi sendiri dan tidak menimbulkan masalah baru.

### Tahap 0 — Persiapan & baseline (tanpa perubahan perilaku)
1. Bekukan build saat ini sebagai baseline; catat versi commit.
2. Siapkan dataset uji menyerupai produksi (skrip seeder, bukan data produksi).
3. Pasang pengukuran: waktu respons per endpoint, jumlah query (pakai `DB::listen` di middleware dev), hitungan 429/5xx.
4. **Gate:** baseline tercatat; tidak ada perubahan kode.

### Tahap 1 — Infrastruktur & konfigurasi (fondasi)
Dependensi: tidak ada.
1. P-2: jalankan backend dengan Nginx + PHP-FPM (atau server konkuren setara) di lingkungan pengujian.
2. P-1: satukan alamat API (web `/api` via proxy, mobile domain HTTPS), tambahkan guard build.
3. P-6: HTTPS untuk mobile (atau `network_security_config` terbatas untuk demo).
4. P-22: aktifkan config/route cache di lingkungan uji.
5. **Gate:** probe konkuren menunjukkan paralelisme; build web & mobile menunjuk host yang benar; aplikasi mobile dapat login dari perangkat fisik.

### Tahap 2 — Lifecycle request & sesi (tanpa menyentuh fitur)
Dependensi: Tahap 1 (agar pengujian konkuren bermakna).
1. P-3: pindahkan AI/PDF/grading ke queue + jalankan worker (worker **dulu**, lalu ubah dispatch).
2. P-4: timeout per-endpoint + retry GET terbatas.
3. P-5: pisahkan 401 dari kegagalan jaringan; hapus fallback user parsial.
4. P-7: naikkan batas baca, kunci limiter per token, polling adaptif.
5. **Gate:** simulasi AI 60 s tidak membuat halaman lain gagal; tidak ada logout saat jaringan diputus 20 s; 429 tidak muncul pada alur normal.

### Tahap 3 — Kebenaran data di klien
Dependensi: Tahap 2 (agar kegagalan transport tidak lagi menyamarkan bug data).
1. P-9: helper `unwrap` tunggal + perbaiki W-3 & M-3 + aturan lint.
2. P-11: util tanggal lokal, ganti seluruh `toISOString()`.
3. P-10: lengkapi `per_page` pada dropdown import.
4. P-12: `allSettled` + error per-kartu di 5 halaman dashboard.
5. P-13: hapus request pasti-403 & duplikat; perbaiki fallback jurnal.
6. P-14: `AbortController` pada halaman berfilter.
7. **Gate:** setiap halaman menampilkan data yang sama dengan isi database pada dataset uji; cek silang web vs mobile.

### Tahap 4 — Data layer (setelah klien stabil)
Dependensi: Tahap 3 (agar efek peningkatan terukur, bukan tertutup bug UI).
1. P-16: migration indeks (dengan pembersihan duplikat lebih dulu pada `attendances`).
2. P-17/P-18: memoize helper otorisasi; hilangkan query dalam loop.
3. P-8: validasi `per_page`.
4. P-19/P-20: store cache & rate limit login.
5. **Gate:** `EXPLAIN ANALYZE` menunjukkan index scan; jumlah query per request turun (tes benchmark diperluas).

### Tahap 5 — Konsistensi bisnis (butuh persetujuan)
Dependensi: Tahap 3–4.
1. P-15: keputusan & implementasi sinkronisasi izin → presensi.
2. P-21: bersihkan dead code & duplikasi route/kontrak.
3. P-24: perbarui dokumentasi deployment.

### Tahap 6 — Hardening
1. P-23: observability & alarm.
2. Uji beban ringan (mis. 50 pengguna konkuren) dan uji ketahanan jaringan.
3. Review ulang prioritas berdasarkan data produksi.

---

## 11. Strategi Pengujian & Validasi

### 11.1 Prinsip
Setiap perbaikan harus memiliki **bukti sebelum/sesudah** yang dapat diulang. Jangan menerima "sudah diperbaiki" tanpa angka atau rekaman. Gunakan dataset uji berskala (bukan DB kosong) agar hasil bermakna.

### 11.2 Matriks pengujian per perbaikan

| Perbaikan | Jenis uji | Cara & kriteria lulus |
| --- | --- | --- |
| P-1 alamat API | Statis + E2E | `grep -r "localhost\|192.168" dist/assets/*.js` → kosong; build produksi diakses dari perangkat lain berhasil login. |
| P-2 server konkuren | Beban | Ulangi probe 6 request konkuren: wall-clock ≤ 1,5× waktu satu request (sebelumnya 6×). |
| P-3 queue | Integrasi + operasional | Matikan worker → kuis berhenti di `generating` (diharapkan); nyalakan worker → kuis selesai; `GET /quizzes/{id}` tidak memblokir request lain (uji paralel dengan `/api/me`). |
| P-4 timeout/retry | Chaos | Matikan backend 20 s; GET harus retry 2× lalu menampilkan error yang jelas; POST tidak boleh retry otomatis. AI dengan AI_TIMEOUT=60 harus berhasil tanpa timeout klien. |
| P-5 sesi | Chaos + UI | Putus jaringan 20 s (DevTools offline / mode pesawat), buka halaman → **tidak** logout; token masih ada; banner muncul; setelah jaringan pulih, sesi berlanjut tanpa login. 401 asli (token dihapus manual) tetap logout. |
| P-6 mobile HTTP | Perangkat fisik | Pasang APK di perangkat **di luar** Wi-Fi developer → login berhasil via HTTPS; tidak ada error cleartext di `adb logcat` (`WebView: Mixed Content`). |
| P-7 rate limit | Beban + skenario | Buka 3 tab dashboard + halaman import; jalankan polling penuh → tidak ada 429 pada alur normal; matikan tab (visibility hidden) → polling berhenti. |
| P-8 pagination | API | `GET /attendances?per_page=100000` → 422; `per_page=50` → 50 baris. |
| P-9 unwrap | UI + snapshot | Monitoring waka: panel rekap harian menampilkan `compliance_rate` yang **sama** dengan respons API (bandingkan Network tab vs layar). Mobile: banner agenda muncul saat tanggal bertepatan agenda `disables_teaching`. |
| P-10 dropdown | Data | Buat 20+ guru/ruang/kelas; buka impor jadwal; semua entri muncul di dropdown; bila >100 tampil indikator. |
| P-11 tanggal | Unit + manual | Unit test `todayLocalISO()` untuk waktu 2026-11-08T00:30+07:00 → `"2026-11-08"` (bukan `2026-11-07`). Manual: ubah jam sistem ke 01:00 WIB, buka beranda siswa → jadwal hari ini benar. |
| P-12 allSettled | Chaos UI | Blokir satu endpoint (DevTools request blocking) → bagian lain tetap tampil; hanya kartu terkait menampilkan error + tombol ulang. |
| P-13 request duplikat | Jaringan | Buka dashboard guru → Network tab: **tidak ada** 403 pada `/academic-settings`; jumlah request jadwal = 1, bukan 2. |
| P-14 race condition | Manual cepat | Ganti filter kelas 5× dalam 1 detik → data akhir harus sesuai filter terakhir; tidak ada kedipan hasil lama. |
| P-15 sinkronisasi izin | Integrasi DB | Skenario: jurnal selesai → izin disetujui → `attendances.status` harus `Sakit`/`Izin` sesuai kategori (atau sesuai ruling user). |
| P-16 indeks | DB | `EXPLAIN (ANALYZE, BUFFERS)` pada query `WHERE date = ?` → Index Scan; unique `(journal_id, student_id)` menolak insert duplikat. |
| P-17 query berulang | Query count | Perluas `PeriodResolutionBenchmarkTest` ke `AttendanceController::index` dan `AcademicEventController::myCalendar`; tetapkan ambang (mis. ≤ 12 query). |
| P-20 login limit | Keamanan | 6 percobaan login salah dalam 1 menit → 429 pada percobaan ke-6; login benar setelah jendela berakhir. |
| P-23 observability | Operasional | Slow-log menangkap request > 1 s dengan path + durasi + user id; tidak memuat password/token. |

### 11.3 Uji regresi yang wajib dijalankan
- Seluruh 67 tes Laravel (`php artisan test`) harus tetap hijau setelah setiap tahap.
- `PeriodResolutionBenchmarkTest` diperluas dan dijadikan gate untuk Tahap 4.
- Uji kontrak API (web **dan** mobile terhadap backend yang sama), karena divergensi W-3/M-3 membuktikan bahwa satu implementasi benar tidak menjamin yang lain benar.

### 11.4 Uji lintas-peran (matriks minimal)
| Peran | Halaman | Yang divalidasi |
| --- | --- | --- |
| waka | dashboard, jadwal, import, master data, monitoring, kalender | tidak ada halaman kosong; rekap harian tampil; dropdown lengkap |
| guru (reguler) | dashboard, jadwal, jurnal, izin, kuis | tidak ada 403; jurnal menunjuk jadwal yang benar; AI tidak timeout |
| guru (kesiswaan/wali kelas) | monitoring, verifikasi izin, rekap presensi | data ter-scope benar; tidak ada 403 salah |
| siswa | beranda, jadwal, izin, kuis | tanggal benar pada 00:00–06:59 WIB; banner agenda muncul |
| orang tua | monitoring, kalender | data anak benar; sesi tidak putus saat jaringan naik-turun |

### 11.5 Kriteria penerimaan akhir (definition of done)
1. Tidak ada artefak build yang menunjuk `localhost` atau IP privat.
2. Tidak ada logout paksa saat gangguan jaringan ≤ 30 detik.
3. Tidak ada 429 pada alur penggunaan normal (termasuk import jadwal penuh).
4. Operasi AI/PDF berjalan tanpa memblokir endpoint lain (dibuktikan dengan request paralel).
5. Setiap angka pada UI cocok dengan respons API pada dataset uji, di web **dan** mobile.
6. Tanggal yang dikirim klien selalu tanggal Asia/Jakarta.
7. Seluruh tes otomatis hijau dan benchmark query memenuhi ambang.

---

## Lampiran A — Ringkasan bukti pengukuran

**A.1 Identifikasi proses backend**
```
C:\php\php.exe  -S 0.0.0.0:8000 D:\MyUKK\SchoolClassProject\scp\vendor\laravel\framework\src\Illuminate\Foundation\Console/../resources/server.php
```

**A.2 Probe konkurensi (`GET /api/ping`, read-only, tanpa autentikasi)**
```
sequential per-request : 415ms, 216ms, 238ms
concurrent #0          : 210ms  ok
concurrent #1          : 423ms  ok
concurrent #2          : 596ms  ok
concurrent #3          : 778ms  ok
concurrent #4          : 1006ms ok
concurrent #5          : 1185ms ok
WALL for 6 concurrent  : 1189ms
```
Interpretasi: waktu selesai bertambah ~185 ms secara linier → antrean satu worker.

**A.3 Ukuran data (DIKOREKSI — `COUNT(*)`, bukan `n_live_tup`)**
```
users                   3514   (vice_principal 2, teacher 90, student 1711, parent 1711)
schedules                721   (semua cycle_type = 1; Senin 151, Selasa 148, Rabu 145, Kamis 152, Jumat 125)
classes                   48
rooms                     53
subjects                  84
teacher_assignments       96
academic_events           48
period_templates          48
ai_quizzes                 3
quiz_questions            13
journals                   1
attendances                0
leave_requests             0
teacher_leave_requests     0
quiz_submissions           0
```
Versi pertama lampiran ini menampilkan `users=0`, `schedules=0` dari `pg_stat_user_tables.n_live_tup`. Nilai itu **tidak valid** karena statistik tabel belum pernah dikumpulkan (`last_analyze` NULL).

**A.3b Waktu eksekusi query pada data nyata (`EXPLAIN ANALYZE`)**
```
GET /schedules?all=1&cycle=1  (721 baris, sort 109kB)  Execution: 0,412 ms  (Seq Scan 0,136 ms)
GET /schedules?per_page=15                             Execution: 0,804 ms  (Index Scan)
COUNT(*) teacher                                        Execution: 0,784 ms  (Index Only Scan)
COUNT(*) student (1.711 baris)                          Execution: 0,669 ms  (Index Only Scan)
journals WHERE date = ...                               Execution: 0,080 ms  (Seq Scan, 1 baris)
attendances ORDER BY date DESC LIMIT 100                Execution: 0,075 ms  (0 baris)
Planning Time per query: 1,4–5,9 ms  ← lebih besar daripada Execution Time
```
Kesimpulan: pada mesin ini **biaya perencanaan query (planning) 3–70× lebih besar daripada eksekusinya**. Artinya penambahan query (N+1) lebih mahal karena *planning*, bukan karena pemindaian data.

**A.4 Indeks `journals` & `attendances` (read-only, `pg_indexes`)**
```
journals    : journals_pkey, journals_schedule_id_date_unique
attendances : attendances_pkey, attendances_student_id_date_index
```
Tidak ada indeks `journals(date)`, tidak ada indeks `attendances(journal_id)`, tidak ada unique `(journal_id, student_id)`.

**A.5 CORS (read-only, `OPTIONS /api/login`)**
```
HTTP/1.0 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST
```
→ CORS bukan penyebab masalah.

**A.6 Nilai konfigurasi build yang beredar**
```
scp_web/dist/assets/*.js         : http://localhost:8000/api   (2 kemunculan)
scp_mobile/dist/assets/*.js      : http://192.168.0.121:8000/api (1 kemunculan)
scp_web/.env.production          : VITE_API_BASE_URL=http://localhost:8000/api
scp_mobile/.env                  : VITE_API_BASE_URL=http://192.168.0.121:8000/api
```

---

## Lampiran B — Daftar file yang dirujuk

**Backend**
- `scp/routes/api.php` (35, 46)
- `scp/bootstrap/app.php`, `scp/app/Providers/AppServiceProvider.php` (26)
- `scp/app/Http/Controllers/API/ScheduleController.php` (54, 63, 100, 145-147, 215-268)
- `scp/app/Http/Controllers/API/JournalController.php` (55-72, 78, 103-104, 476-505, 534-665)
- `scp/app/Http/Controllers/API/QuizController.php` (280, 301, 399, 823)
- `scp/app/Http/Controllers/API/ScheduleImportController.php` (52-77)
- `scp/app/Http/Controllers/API/AttendanceController.php` (53-60, 105)
- `scp/app/Http/Controllers/API/AcademicEventController.php` (270-280, 301-320, 358, 585-631)
- `scp/app/Http/Controllers/API/TeacherController.php` (286-290), `RoomController.php` (19), `SubjectController.php` (19), `StudentController.php` (440)
- `scp/app/Services/AcademicCalendarExclusionService.php`, `PeriodResolutionService.php`
- `scp/app/Models/User.php` (111-160)
- `scp/config/sanctum.php` (53), `scp/config/app.php` (68), `scp/config/services.php` (42)
- `scp/database/migrations/*` (indeks & kolom)
- `scp/tests/Feature/PeriodResolutionBenchmarkTest.php`

**Web**
- `frontend/scp_web/src/services/api.js`, `quizApi.js`, `scheduleImportApi.js`, `masterDataApi.js`
- `frontend/scp_web/src/context/AuthContext.jsx` (43-51, 100-120)
- `frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx` (83-87, 118)
- `frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx` (85, 91-96)
- `frontend/scp_web/src/pages/waka/ScheduleImportPage.jsx` (254-257, 383)
- `frontend/scp_web/src/pages/teacher/TeacherDashboardPage.jsx` (82, 92-107)
- `frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx` (78-83)
- `frontend/scp_web/src/pages/student/StudentHomePage.jsx` (72-80)
- `frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx` (50-65)
- `frontend/scp_web/.env`, `.env.production`, `dist/assets/*.js`, `deploy/nginx/default.conf`

**Mobile**
- `frontend/scp_mobile/src/services/api.js` (11), `masterDataApi.js` (95-107), `journalApi.js` (45), `academicEventApi.js` (22)
- `frontend/scp_mobile/src/context/AuthContext.jsx` (64-72)
- `frontend/scp_mobile/src/pages/student/StudentPermissionPage.jsx` (279)
- `frontend/scp_mobile/src/components/shared/PasswordSheet.jsx` (52)
- `frontend/scp_mobile/.env`, `capacitor.config.json`, `android/app/src/main/AndroidManifest.xml`, `dist/assets/*.js`

---

## Penutup

Dokumen ini berhenti pada tahap **analisis, dokumentasi, dan rencana perbaikan**. Tidak ada implementasi, refactor, instalasi paket, perubahan dependency, migrasi, maupun perubahan konfigurasi yang dilakukan.

Tiga hal yang paling menentukan urutan pekerjaan:
1. **Perbaiki alamat API pada artefak build dan pastikan backend dijalankan dengan server konkuren** — tanpa ini, semua perbaikan lain tidak dapat diverifikasi.
2. **Pisahkan "gagal jaringan" dari "sesi berakhir"** — ini satu perubahan kecil dengan dampak terbesar pada persepsi kestabilan.
3. **Pindahkan pekerjaan AI/PDF ke queue dan jalankan worker** — ini menghilangkan pembekuan API yang menjadi akar keluhan "loading sangat lambat".

Masalah database (indeks, N+1, pagination) nyata tetapi berada di urutan setelahnya, karena pada volume data saat ini bukan penyebab gejala — dan tetap harus dikerjakan **sebelum** data sekolah terisi penuh.

Menunggu keputusan dan persetujuan sebelum tahap implementasi dimulai.
