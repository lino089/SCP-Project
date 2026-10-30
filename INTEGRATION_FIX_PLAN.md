# Rencana Perbaikan Integrasi Frontend–Backend SCP

> Dokumen ini disusun berdasarkan hasil analisis kode aktual pada `frontend/scp_web/src/` dan `scp/` (Laravel backend).
> Setiap temuan merujuk pada file dan nomor baris yang telah diverifikasi.

---

## Daftar Masalah & Prioritas

| # | Prioritas | Ringkasan | File Utama |
|---|-----------|-----------|------------|
| 1 | **P0** | `masterDataApi.getClasses()` tidak ada pada default export — `MonitoringRecapPage` crash | `MonitoringRecapPage.jsx` L68 |
| 2 | **P0** | Route `PATCH /api/me/password` tidak ada di backend — password tidak pernah berubah di DB | `api.php`, `api.js` L70, `AuthContext.jsx` L124-137, `ProfilePage.jsx` L158-182 |
| 3 | **P1** | Data kehadiran palsu saat `attendances` kosong di halaman Orang Tua | `ParentMonitoringPage.jsx` L77-78 |
| 4 | **P1** | Verifikasi OTP selalu dianggap berhasil meskipun API gagal | `ProfilePage.jsx` L86-89 & L129-132 |
| 5 | **P1** | Jadwal fallback tidak tergantikan saat database kosong (guard `raw.length > 0`) | `ScheduleManagementPage.jsx` L131, L230 |
| 6 | **P1** | Riwayat siklus & jurnal belum diisi tetap menampilkan data fallback | `DashboardWakaPage.jsx` L50, L53, L96 |
| 7 | **P2** | State awal Master Data diisi fallback hardcoded (12 kelas, 6 ruang, 7 mapel, 3 guru, 4 siswa) | `MasterDataPage.jsx` L133-137 |
| 8 | **P2** | State awal Kenaikan Kelas diisi fallback hardcoded | `GradePromotionPage.jsx` L48-49 |
| 9 | **P2** | State awal Review Import diisi fallback hardcoded (5 baris FET) | `ReviewImportPage.jsx` L85 |
| 10 | **P3** | Izin mengajar & delegasi guru disimpan di `localStorage`, bukan ke backend | `TeacherSchedulePage.jsx` L88-133 |
| 11 | **P3** | Progress upload import menggunakan `setTimeout` palsu, bukan polling status | `UploadImportPage.jsx` L69-80 |
| 12 | **P3** | Promosi kelas massal fallback ke simulasi offline saat API error | `GradePromotionPage.jsx` L175-187 |
| 13 | **P4** | Tombol demo login, `DEMO_PRESETS`, demo role switcher di TopBar | `LoginPage.jsx` L8-44, `TopBar.jsx` L58-64 & L190-221 |
| 14 | **P4** | Mock data lengkap di service layer (`journalApi`, `leaveApi`, `quizApi`) | `journalApi.js`, `leaveApi.js`, `quizApi.js` |

---

## Fase 1 — P0: Perbaikan Error Runtime Kritis

**Tujuan:** Menghilangkan crash dan memastikan fitur inti (ganti password, monitoring rekap) benar-benar berfungsi terhadap database.

**Tidak memiliki dependensi terhadap fase lain. Harus dikerjakan pertama.**

### 1a. Tambah route `PATCH /api/me/password` di backend

**Masalah:**
Frontend memanggil `api.patch('/me/password', data)` ([`api.js` L70](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/api.js#L70)), tetapi route ini **tidak ada** di [`scp/routes/api.php`](file:///D:/MyUKK/SchoolClassProject/scp/routes/api.php). Akibatnya:
- [`AuthContext.jsx` L129-133](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx#L129-L133): catch block menelan error 404 dan tetap menjalankan `updateUserProfile({ must_change_password: false })` di L136, sehingga user dianggap sudah ganti password padahal belum.
- [`ProfilePage.jsx` L172-176](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx#L172-L176): catch block juga menampilkan pesan sukses saat mendapat 404.

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `scp/routes/api.php` | **Tambah** | Route `Route::patch('/me/password', [ProfileController::class, 'changePassword']);` di dalam group `auth:sanctum` (setelah L41) |
| `scp/app/Http/Controllers/API/ProfileController.php` | **Tambah method** | Method `changePassword(Request $request)` — validasi `current_password`, `new_password`, `new_password_confirmation`, verifikasi password lama via `Hash::check()`, update password via `$user->update(['password' => Hash::make(...)])`, kembalikan response JSON sukses |
| `frontend/scp_web/src/context/AuthContext.jsx` | **Edit L129-133** | Hapus kondisi `if (err.status !== 404)` — semua error harus di-throw agar caller tahu gagal. Baris `updateUserProfile({ must_change_password: false })` (L136) hanya boleh dijalankan di blok `try` setelah API berhasil |
| `frontend/scp_web/src/pages/profile/ProfilePage.jsx` | **Edit L172-176** | Hapus blok `if (err.status === 404) { setPasswordSuccess(true); ... }` — jangan pernah tampilkan sukses saat endpoint gagal |

**Kriteria keberhasilan:**
- `PATCH /api/me/password` merespons 200 saat password lama benar dan password baru valid
- Password benar-benar berubah di tabel `users` (verifikasi via `php artisan tinker`)
- Frontend menampilkan error jika password lama salah; menampilkan sukses hanya saat API berhasil
- Flow `must_change_password` tidak bisa di-bypass

---

### 1b. Perbaiki pemanggilan `masterDataApi.getClasses()` di MonitoringRecapPage

**Masalah:**
[`MonitoringRecapPage.jsx` L68](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx#L68) memanggil:
```js
masterDataApi.getClasses({ per_page: 50 }).catch(() => ({ data: [] }))
```
Namun [`masterDataApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js) memiliki default export berupa objek nested:
```js
export default { classes: classApi, rooms: roomApi, ... }
```
Sehingga `masterDataApi.getClasses` bernilai `undefined` → `TypeError` → `Promise.all` gagal → seluruh data (attendances, journals, classes) tidak ter-load.

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx` | **Edit import** (baris awal file) | Ganti `import masterDataApi from '...'` menjadi `import { classApi } from '../../services/masterDataApi';` |
| `frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx` | **Edit L68** | Ganti `masterDataApi.getClasses(...)` menjadi `classApi.getClasses(...)` |

**Kriteria keberhasilan:**
- Halaman Monitoring Rekap Waka ter-load tanpa error di console
- Data kehadiran, jurnal, dan kelas ter-fetch dari API
- `Promise.all` berhasil resolve

---

## Fase 2 — P1: Integritas Data & UI yang Menyesatkan

**Tujuan:** Menghilangkan data palsu yang ditampilkan kepada pengguna saat database kosong atau API gagal.

**Dependensi:** Fase 1 harus selesai (khususnya 1b untuk MonitoringRecapPage).

### 2a. Hapus data kehadiran palsu di ParentMonitoringPage

**Masalah:**
[`ParentMonitoringPage.jsx` L77-78](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/parent/ParentMonitoringPage.jsx#L77-L78):
```js
if (attendances.length === 0) {
  return { hadir: 42, sakit: 3, izin: 2, alpa: 1 };
}
```
Saat belum ada data presensi, UI menampilkan 42 hadir, 3 sakit, 2 izin, 1 alpa — data ini sepenuhnya fiktif dan bisa memicu alert palsu tentang ketidakhadiran anak.

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `ParentMonitoringPage.jsx` | **Edit L78** | Ganti `{ hadir: 42, sakit: 3, izin: 2, alpa: 1 }` menjadi `{ hadir: 0, sakit: 0, izin: 0, alpa: 0 }` |

**Kriteria keberhasilan:**
- Saat database kosong, ringkasan kehadiran menampilkan semua nol
- Tidak ada alert palsu tentang ketidakhadiran

---

### 2b. Perbaiki catch block verifikasi OTP di ProfilePage

**Masalah:**
- [`ProfilePage.jsx` L86-89](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx#L86-L89): Saat verifikasi email OTP gagal (catch), kode tetap menjalankan `setEmailVerified(true)` dan `updateUserProfile({ email_verified_at: ... })`.
- [`ProfilePage.jsx` L129-132](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx#L129-L132): Hal sama terjadi untuk verifikasi nomor WhatsApp.

Artinya email dan nomor telepon dianggap terverifikasi meskipun OTP salah atau API gagal.

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `ProfilePage.jsx` | **Edit L86-89** | Ganti isi catch block menjadi `setEmailError('Verifikasi gagal. Periksa kode OTP Anda.');` — jangan set verified |
| `ProfilePage.jsx` | **Edit L129-132** | Ganti isi catch block menjadi `setWaError('Verifikasi gagal. Periksa kode OTP Anda.');` — jangan set verified |

**Kriteria keberhasilan:**
- OTP yang salah menampilkan pesan error dan **tidak** menandai kontak sebagai terverifikasi
- OTP yang benar tetap memverifikasi kontak secara normal

---

### 2c. Hapus guard `raw.length > 0` di ScheduleManagementPage

**Masalah:**
[`ScheduleManagementPage.jsx` L131](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx#L131): State diinisialisasi dengan `FALLBACK_SCHEDULES` (4 jadwal dummy, definisi di L31-L116).
[`ScheduleManagementPage.jsx` L230](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ScheduleManagementPage.jsx#L230): Guard `if (raw.length > 0)` menyebabkan saat database kosong (0 jadwal), fallback dummy tetap ditampilkan karena `setScheduleList(mapped)` tidak dipanggil.

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `ScheduleManagementPage.jsx` | **Edit L131** | Ganti `useState(FALLBACK_SCHEDULES)` menjadi `useState([])` |
| `ScheduleManagementPage.jsx` | **Edit L230** | Hapus guard `if (raw.length > 0)` — langsung jalankan mapping dan `setScheduleList(mapped)` untuk semua hasil termasuk array kosong |

**Kriteria keberhasilan:**
- Saat database kosong, halaman menampilkan empty state (bukan jadwal dummy)
- Saat database berisi jadwal, data real ditampilkan
- Konstanta `FALLBACK_SCHEDULES` boleh tetap ada sebagai referensi tapi tidak digunakan sebagai initial state

---

### 2d. Hapus guard `list.length > 0` di DashboardWakaPage

**Masalah:**
- [`DashboardWakaPage.jsx` L50](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx#L50): `useState(FALLBACK_HISTORY)` — diisi 2 entri riwayat dummy (L8-L23).
- [`DashboardWakaPage.jsx` L53](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx#L53): `useState(FALLBACK_MISSING_JOURNALS)` — diisi 2 entri jurnal dummy (L25-L40).
- [`DashboardWakaPage.jsx` L96](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx#L96): `if (list.length > 0) setHistoryList(list)` — saat API mengembalikan array kosong, fallback dummy tetap tampil.

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `DashboardWakaPage.jsx` | **Edit L50** | Ganti `useState(FALLBACK_HISTORY)` menjadi `useState([])` |
| `DashboardWakaPage.jsx` | **Edit L53** | Ganti `useState(FALLBACK_MISSING_JOURNALS)` menjadi `useState([])` |
| `DashboardWakaPage.jsx` | **Edit L96** | Hapus guard `if (list.length > 0)` — langsung `setHistoryList(list)` |

**Kriteria keberhasilan:**
- Saat belum ada riwayat siklus, tabel menampilkan "Belum ada riwayat perubahan putaran jadwal" (empty state yang sudah ada di L461)
- Data real dari API ditampilkan saat tersedia

---

## Fase 3 — P2: Hapus Fallback Hardcoded sebagai Initial State

**Tujuan:** Menghilangkan data dummy sebagai initial state. Semua halaman harus memulai dengan array kosong dan menunggu data dari API.

**Dependensi:** Tidak ada dependensi ketat, namun sebaiknya dikerjakan setelah Fase 2 karena pola perbaikannya serupa.

### 3a. MasterDataPage — inisialisasi semua list dengan `[]`

**Masalah:**
[`MasterDataPage.jsx` L133-137](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx#L133-L137): Lima state diinisialisasi dengan fallback constants yang didefinisikan di L35-L125 (total 32 entri data dummy).

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `MasterDataPage.jsx` | **Edit L133** | `useState(FALLBACK_CLASSES)` → `useState([])` |
| `MasterDataPage.jsx` | **Edit L134** | `useState(FALLBACK_ROOMS)` → `useState([])` |
| `MasterDataPage.jsx` | **Edit L135** | `useState(FALLBACK_SUBJECTS)` → `useState([])` |
| `MasterDataPage.jsx` | **Edit L136** | `useState(FALLBACK_TEACHERS)` → `useState([])` |
| `MasterDataPage.jsx` | **Edit L137** | `useState(FALLBACK_STUDENTS)` → `useState([])` |

> Konstanta `FALLBACK_*` (L35-L125) boleh tetap ada di file sebagai referensi struktur data. Tidak perlu dihapus.

**Kriteria keberhasilan:**
- Saat halaman dimuat dengan database kosong, setiap tab menampilkan empty state
- Saat backend berjalan dan database terisi, data real ditampilkan
- Tidak ada data dummy yang muncul di UI

---

### 3b. GradePromotionPage — inisialisasi list dengan `[]`

**Masalah:**
[`GradePromotionPage.jsx` L48-49](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/GradePromotionPage.jsx#L48-L49):
```js
const [classList, setClassList] = useState(FALLBACK_CLASSES);   // 12 kelas dummy
const [studentList, setStudentList] = useState(FALLBACK_STUDENTS); // 5 siswa dummy
```

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `GradePromotionPage.jsx` | **Edit L48** | `useState(FALLBACK_CLASSES)` → `useState([])` |
| `GradePromotionPage.jsx` | **Edit L49** | `useState(FALLBACK_STUDENTS)` → `useState([])` |

**Kriteria keberhasilan:**
- Halaman kenaikan kelas dimulai kosong dan menunggu data API
- Pemetaan kelas dan siswa menggunakan data real

---

### 3c. ReviewImportPage — inisialisasi rows dengan `[]`

**Masalah:**
[`ReviewImportPage.jsx` L85](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx#L85): `useState(FALLBACK_IMPORT_ROWS)` — 5 baris FET dummy (L17-L78).

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `ReviewImportPage.jsx` | **Edit L85** | `useState(FALLBACK_IMPORT_ROWS)` → `useState([])` |

**Kriteria keberhasilan:**
- Halaman review import dimulai kosong; data hanya muncul setelah fetch dari backend
- Statistik (matched/unmatched/conflict) menunjukkan 0 saat belum ada data

---

## Fase 4 — P3: Ganti Simulasi localStorage & setTimeout dengan Integrasi API

**Tujuan:** Fitur-fitur yang saat ini hanya disimulasikan di sisi client perlu dihubungkan ke backend.

**Dependensi:** Fase 1-3 harus selesai. Fase ini mungkin memerlukan penambahan endpoint backend baru.

### 4a. Izin mengajar & delegasi guru — ganti localStorage dengan API

**Masalah:**
[`TeacherSchedulePage.jsx` L88-133](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx#L88-L133): Seluruh proses pengajuan izin guru dan delegasi kelas disimpan ke `localStorage` (`teacher_leave_active`, `teacher_leave_reason`, `teacher_leave_tasks`, `delegated_classes`). Tidak ada endpoint backend yang menangani fitur ini.

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `scp/routes/api.php` | **Tambah** | Endpoint baru untuk pengajuan izin guru (contoh: `POST /api/teacher-leaves`) di group `role:teacher` |
| `scp/app/Http/Controllers/API/` | **Buat** | Controller baru `TeacherLeaveController` dengan method `store`, atau tambahkan ke controller yang sudah ada |
| Tabel database (migration) | **Buat** | Migration baru untuk tabel `teacher_leaves` (jika belum ada), atau gunakan tabel yang sesuai |
| `TeacherSchedulePage.jsx` | **Edit L88-133** | Ganti seluruh blok `localStorage.setItem(...)` dengan panggilan API `POST /api/teacher-leaves` |
| `TeacherSchedulePage.jsx` | **Edit L47-49** | Ganti inisialisasi state dari `localStorage.getItem(...)` menjadi fetch dari API |
| `TeacherSchedulePage.jsx` | **Edit L135-140** | Ganti `handleCancelLeave` dari `localStorage.removeItem(...)` menjadi panggilan API (PATCH/DELETE) |

> **Catatan:** Perubahan ini membutuhkan persetujuan karena melibatkan pembuatan migration dan controller baru. Alternatif: nonaktifkan fitur izin guru di UI jika belum waktunya diimplementasikan.

**Kriteria keberhasilan:**
- Data izin guru tersimpan di database, bukan di `localStorage`
- Guru piket/kesiswaan dapat melihat daftar delegasi dari database
- Data persisten antar perangkat dan sesi browser

---

### 4b. Progress upload import — ganti setTimeout dengan polling

**Masalah:**
[`UploadImportPage.jsx` L69-80](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/UploadImportPage.jsx#L69-L80): Setelah upload berhasil (HTTP 202), progress bar diatur oleh `setTimeout` (1.2s → 90%, 2.4s → 100%) alih-alih melakukan polling `GET /api/schedule-imports/{id}` untuk cek status parsing yang sesungguhnya.

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `UploadImportPage.jsx` | **Edit L69-80** | Ganti dua `setTimeout` dengan loop polling `GET /api/schedule-imports/{id}` (endpoint sudah ada di `api.php` L104) setiap 1-2 detik hingga status `completed` atau `failed` |
| `UploadImportPage.jsx` | **Edit L92-102** | Hapus fallback `catch` yang mensimulasikan progress offline |

**Kriteria keberhasilan:**
- Progress bar mencerminkan status parsing sesungguhnya dari backend
- Error parsing ditampilkan jika backend gagal memproses file
- Tidak ada `setTimeout` palsu untuk menggerakkan progress bar

---

### 4c. Promosi kelas massal — hapus simulasi offline

**Masalah:**
[`GradePromotionPage.jsx` L175-187](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/GradePromotionPage.jsx#L175-L187): Saat API `POST /api/class-promotions` gagal, catch block menghitung hasil promosi secara lokal dari data fallback dan menampilkannya seolah berhasil.

**Perubahan yang diperlukan:**

| File | Aksi | Detail |
|------|------|--------|
| `GradePromotionPage.jsx` | **Edit L175-184** | Ganti isi catch block dengan pesan error yang jelas (contoh: `setPromotionError('Promosi gagal. Periksa koneksi backend.')`) dan **jangan** set `promotionResult` |

**Kriteria keberhasilan:**
- Saat API gagal, UI menampilkan error, bukan hasil simulasi
- Promosi hanya dianggap berhasil jika backend mengembalikan response sukses

---

## Fase 5 — P4: Pembersihan Infrastruktur Demo & Mock Data

**Tujuan:** Membersihkan data mock dan fitur demo yang tidak diperlukan untuk produksi.

**Dependensi:** Semua fase sebelumnya harus selesai. **Fase ini memerlukan diskusi** — fitur demo mungkin sengaja dipertahankan untuk keperluan evaluasi UKK.

> **PENTING:** Sebelum mengerjakan fase ini, konfirmasi apakah:
> - Mode demo (`DEMO_PRESETS`, tombol "Masuk Cepat Mode Demo") perlu dipertahankan untuk ujian UKK
> - Mock data di service layer diperlukan sebagai offline fallback
> - Role switcher di TopBar adalah fitur evaluasi yang disengaja

### 5a. Bersihkan DEMO_PRESETS & tombol demo login (jika disetujui)

**Lokasi:**
- [`LoginPage.jsx` L8-44](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx#L8-L44): Konstanta `DEMO_PRESETS` (5 akun demo)
- [`LoginPage.jsx` L126-145](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx#L126-L145): Render tombol pemilihan role demo
- [`LoginPage.jsx` L198-207](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx#L198-L207): Tombol "Masuk Cepat Mode Demo"
- [`LoginPage.jsx` L102-108](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx#L102-L108): Handler `handleQuickDemoLogin`

**Jika dihapus:**
| File | Aksi | Detail |
|------|------|--------|
| `LoginPage.jsx` | **Hapus L8-44** | Hapus konstanta `DEMO_PRESETS` |
| `LoginPage.jsx` | **Hapus** | Hapus render tombol demo dan handler-nya |
| `context/authConstants.js` | **Evaluasi** | Periksa apakah `DEMO_PROFILES` (L10-59) masih diperlukan; hapus jika tidak |

---

### 5b. Bersihkan demo role switcher di TopBar (jika disetujui)

**Lokasi:**
- [`TopBar.jsx` L58-64](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx#L58-L64): Handler `handleSelectDemoRole`
- [`TopBar.jsx` L190-221](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx#L190-L221): Section "Uji Cepat Peran (UKK)" dengan 5 tombol role

**Jika dihapus:**
| File | Aksi | Detail |
|------|------|--------|
| `TopBar.jsx` | **Hapus L58-64** | Hapus function `handleSelectDemoRole` |
| `TopBar.jsx` | **Hapus L190-221** | Hapus section "Uji Cepat Peran (UKK)" dari dropdown menu |

---

### 5c. Bersihkan mock data di service layer (jika disetujui)

**Lokasi dan cakupan:**

| File | Konstanta Mock | Baris | Jumlah Data |
|------|----------------|-------|-------------|
| [`journalApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/journalApi.js) | `MOCK_TEACHER_SCHEDULES` | L10-113 | 6 jadwal |
| [`journalApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/journalApi.js) | `MOCK_STUDENTS_CLASS_1` | L115-148 | 32 siswa |
| [`leaveApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/leaveApi.js) | `MOCK_LEAVE_REQUESTS` | L10-79 | 3 permintaan izin |
| [`leaveApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/leaveApi.js) | `MOCK_ATTENDANCES` | L82-213 | 5 kehadiran |
| [`quizApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/quizApi.js) | `MOCK_QUIZZES` | L11-60 | 3 kuis |
| [`quizApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/quizApi.js) | `MOCK_QUESTIONS` | L63-185 | 10 soal (3 kuis) |
| [`quizApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/quizApi.js) | `MOCK_SUBMISSIONS` | L188-301 | 3 pengerjaan |

**Jika dihapus:** Seluruh function di service layer yang merujuk ke mock data perlu di-refactor agar langsung memanggil API backend. Setiap function harus menggunakan Axios instance dari `api.js` alih-alih mengembalikan data dari konstanta mock.

**Jika dipertahankan:** Tambahkan komentar yang jelas bahwa mock data hanya digunakan untuk mode demo/offline dan pastikan tidak mencemari data real saat backend tersedia.

---

## Urutan Pengerjaan & Ketergantungan

```
Fase 1 (P0)  ──►  Fase 2 (P1)  ──►  Fase 3 (P2)  ──►  Fase 4 (P3)  ──►  Fase 5 (P4)
  │                  │                  │                  │                  │
  ├─ 1a (backend)    ├─ 2a             ├─ 3a             ├─ 4a *           ├─ 5a **
  ├─ 1b (frontend)   ├─ 2b             ├─ 3b             ├─ 4b             ├─ 5b **
  │                  ├─ 2c             ├─ 3c             ├─ 4c             ├─ 5c **
  │                  └─ 2d             │                  │                 │
  │                                    │                  │                 │
  * = butuh migration/controller baru               ** = butuh konfirmasi
```

**Keterangan:**
- Fase 1 → 2: Fase 2c (ScheduleManagementPage) dan 2d (DashboardWakaPage) secara teknis independen dari Fase 1, namun dijadwalkan setelahnya untuk memastikan flow login dan monitoring dasar sudah benar
- Fase 3 independen secara teknis tetapi mengikuti pola yang sama dengan Fase 2
- Fase 4a membutuhkan pembuatan backend baru (migration + controller)
- Fase 5 membutuhkan keputusan apakah mode demo dipertahankan atau dihapus

---

## Ringkasan File yang Akan Berubah

### Frontend (`frontend/scp_web/src/`)

| File | Fase | Jenis Perubahan |
|------|------|-----------------|
| `pages/waka/MonitoringRecapPage.jsx` | 1b | Edit import & pemanggilan API |
| `pages/profile/ProfilePage.jsx` | 1a, 2b | Hapus fallback 404 & catch OTP |
| `context/AuthContext.jsx` | 1a | Hapus swallow error 404 |
| `pages/parent/ParentMonitoringPage.jsx` | 2a | Ganti default summary ke nol |
| `pages/waka/ScheduleManagementPage.jsx` | 2c | Init `[]`, hapus guard |
| `pages/waka/DashboardWakaPage.jsx` | 2d | Init `[]`, hapus guard |
| `pages/waka/MasterDataPage.jsx` | 3a | Init semua list `[]` |
| `pages/waka/GradePromotionPage.jsx` | 3b, 4c | Init `[]`, hapus simulasi |
| `pages/waka/ReviewImportPage.jsx` | 3c | Init `[]` |
| `pages/teacher/TeacherSchedulePage.jsx` | 4a | Ganti localStorage → API |
| `pages/waka/UploadImportPage.jsx` | 4b | Ganti setTimeout → polling |
| `pages/auth/LoginPage.jsx` | 5a | Hapus demo (jika disetujui) |
| `components/layout/TopBar.jsx` | 5b | Hapus role switcher (jika disetujui) |
| `services/journalApi.js` | 5c | Hapus mock (jika disetujui) |
| `services/leaveApi.js` | 5c | Hapus mock (jika disetujui) |
| `services/quizApi.js` | 5c | Hapus mock (jika disetujui) |
| `context/authConstants.js` | 5a | Hapus DEMO_PROFILES (jika disetujui) |

### Backend (`scp/`)

| File | Fase | Jenis Perubahan |
|------|------|-----------------|
| `routes/api.php` | 1a, 4a | Tambah route password & teacher-leaves |
| `app/Http/Controllers/API/ProfileController.php` | 1a | Tambah method `changePassword` |
| Controller baru (TeacherLeaveController) | 4a | Buat baru (jika disetujui) |
| Migration baru (teacher_leaves) | 4a | Buat baru (jika disetujui) |

---

## Catatan Penting

1. **Fase 1-3** hanya melibatkan perubahan pada file yang sudah ada — tidak perlu membuat file baru
2. **Fase 4a** adalah satu-satunya perubahan yang memerlukan pembuatan file backend baru (controller + migration). Diperlukan konfirmasi sebelum eksekusi
3. **Fase 5** sepenuhnya opsional dan bergantung keputusan apakah mode demo diperlukan untuk evaluasi UKK
4. Semua konstanta `FALLBACK_*` dan `MOCK_*` **tidak dihapus dari file** pada Fase 2-3, hanya dicopot dari `useState()`. Penghapusan definisi dilakukan di Fase 5 jika disetujui
5. Dokumen ini tidak mencakup penambahan seeder, perubahan `.env`, perubahan arsitektur, atau refactoring di luar cakupan integrasi
