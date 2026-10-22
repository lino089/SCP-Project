# Dokumen 08: Catatan & Panduan Teknis Implementasi Front-End

**Fokus Dokumen:** Panduan Arsitektur Front-End, Standar State Management, Konfigurasi HTTP Client, Penanganan UI States, dan Tahapan Rencana Eksekusi.  
**Tech Stack Rekomendasi:** React 19 · Vite · Tailwind CSS v4 · Axios / Fetch · Lucide React · React Router v7.  

---

## 1. Arsitektur Direktori Front-End Terstruktur

Untuk memastikan kode Front-End bersih, dapat diuji (*testable*), dan mudah dirawat, struktur direktori `frontend/scp_web/src/` disarankan ditata sebagai berikut:

```
src/
├── api/                        # HTTP Client, Axios Interceptor & API Services
│   ├── axiosClient.js          # Instance Axios dasar (BaseURL, Timeout, Headers)
│   ├── authApi.js              # Endpoint login, logout, me, kontak OTP, google
│   ├── scheduleApi.js          # Endpoint schedules, period templates, missing alert
│   ├── importApi.js            # Endpoint PDF schedule import, preview, resolve, commit
│   ├── masterDataApi.js        # Endpoint classes, rooms, subjects, teachers, students
│   ├── journalApi.js           # Endpoint journals, presensi exception-based, absensi guru
│   ├── leaveApi.js             # Endpoint leave requests & verifikasi kesiswaan
│   └── quizApi.js              # Endpoint kuis AI (prompt, dokumen, preview, submit, override)
├── assets/                     # Gambar statis, logo institusi, ikon SVG
├── components/                 # Komponen antarmuka modular
│   ├── common/                 # Komponen atomik (Button, Input, Select, Badge, Card, Modal)
│   ├── layout/                 # Shell aplikasi (WebLayout, Sidebar, TopBar, Breadcrumb)
│   ├── feedback/               # Status antarmuka (SkeletonTable, EmptyState, ErrorBanner, Toast)
│   └── modals/                 # Dialog terisolasi (PasswordModal, CredentialModal, ConflictModal)
├── context/                    # Penyedia State Global Aplikasi
│   ├── AuthContext.jsx         # Sesi token, data user aktif, perizinan role & assignments
│   └── NotificationContext.jsx # Toast pemberitahuan global & alert keterlambatan
├── hooks/                      # Custom React Hooks
│   ├── useDebounce.js          # Penundaan input pencarian (300ms)
│   ├── useApi.js               # Wrapper fetch dengan loading & error handler seragam
│   └── usePermission.js        # Helper pengecekan role & penugasan kesiswaan/wali kelas
├── pages/                      # Halaman Tampilan Berdasarkan Modul & Peran
│   ├── auth/                   # Login, Force Change Password
│   ├── waka/                   # Dashboard, Schedules, UploadImport, ReviewImport, MasterData, Promotions
│   ├── teacher/                # TeacherSchedule, TeacherJournal, TeacherQuiz, PermissionVerify
│   ├── student/                # StudentHome, StudentPermission, StudentQuiz
│   ├── parent/                 # ParentMonitoring
│   └── profile/                # ProfileSettings (Kontak, Keamanan)
├── routes/                     # Konfigurasi Navigasi & Pelindung Rute (Guards)
│   ├── AppRoutes.jsx           # Peta rute aplikasi
│   └── ProtectedRoute.jsx      # Pelindung otorisasi berbasis user.role & assignments
├── utils/                      # Helper & Fungsi Pembantu Murni
│   ├── dateHelper.js           # Konversi ISO Day (1=Senin..5=Jumat), waktu WIB
│   ├── formatHelper.js         # Format NISN, NIP, Rupiah, Persentase
│   └── errorMapper.js          # Parsing error 422 dari backend ke field-level form
└── styles/
    ├── tokens.css              # Variabel tema warna, bayangan, font mono
    └── index.css               # Utilitas Tailwind CSS
```

---

## 2. Konfigurasi HTTP Client & Interceptor (Axios)

Instance Axios wajib dikonfigurasi dengan dua lapis pencegat (*interceptor*):
1. **Request Interceptor:** Menyematkan Bearer Token dari `localStorage` / cookie aman secara otomatis pada setiap request keluar.
2. **Response Interceptor:** Menangani kode kesalahan global secara terpusat:
   - **401 Unauthorized:** Token kedaluwarsa atau tidak sah -> Bersihkan sesi dan redirect pengguna ke halaman `/login`.
   - **403 Forbidden:** Hak akses ditolak -> Tampilkan pesan peringatan atau arahkan ke komponen *ForbiddenState*.
   - **422 Unprocessable Entity:** Kesalahan validasi -> Lewatkan kamus `errors` ke pemanggil form agar pesan kesalahan muncul tepat di bawah input yang bersangkutan.
   - **429 Too Many Requests:** Batas laju 60 req/menit tercapai -> Tangkap header `Retry-After` dan tampilkan toast: *"Terlalu banyak permintaan. Silakan tunggu X detik."*

Contoh implementasi `axiosClient.js`:
```javascript
import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 detik batas waktu default
});

// Request Interceptor: Injeksi Bearer Token
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('scp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Penanganan Error Global
axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      localStorage.removeItem('scp_token');
      localStorage.removeItem('scp_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }

    return Promise.reject(data || error);
  }
);

export default axiosClient;
```

---

## 3. Standarisasi Lima Kondisi Antarmuka (UI States)

Aplikasi Front-End yang profesional wajib menangani 5 kondisi status antarmuka pada setiap layar yang menampilkan data dari server:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   LIMA KONDISI ANTARMUKA (UI STATES)                   │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Loading State   : Skeleton placeholder (tabel/kartu), bukan spinner │
│ 2. Empty State     : Ilustrasi bersih + judul + deskripsi + tombol CTA  │
│ 3. Error State     : Pesan kesalahan manusiawi + tombol "Coba Lagi"     │
│ 4. Forbidden (403) : Layar khusus hak akses tidak cukup + tombol pulang│
│ 5. Step-Up Auth    : Modal input password sebelum request sensitif     │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Loading State (Skeleton Placeholder):**
   - Saat tabel jadwal atau master data sedang memuat data (`isLoading = true`), jangan biarkan layar kosong atau hanya menampilkan spinner kecil di tengah.
   - Gunakan `SkeletonRow` dengan animasi *pulse* abu-abu terang yang menyerupai bentuk baris data asli agar tidak terjadi lonjakan tata letak (*layout shift*).
2. **Empty State (Kondisi Kosong):**
   - Bedakan kondisi:
     - *Belum Ada Data Sama Sekali:* Tampilkan tombol tambah baru ("Belum ada data jadwal. Mulai dengan membuat jadwal atau import PDF.").
     - *Hasil Pencarian / Filter Nihil:* Tampilkan tombol reset filter ("Tidak ada jadwal yang cocok dengan kata kunci pencarian Anda. [Reset Filter]").
3. **Error State (Kondisi Kesalahan Server / Koneksi):**
   - Jika endpoint mengembalikan error 500 atau koneksi terputus, sajikan kartu kesalahan yang informatif dengan tombol **"Coba Muat Ulang"** yang memicu re-fetch data.
4. **Forbidden State (HTTP 403 Access Denied):**
   - Jika pengguna sengaja mengetikkan URL Waka padahal login sebagai Siswa atau Guru biasa, cegah akses di level `ProtectedRoute` dan render komponen `ForbiddenState` dengan teks:
     *"Akses Terbatas: Halaman ini memerlukan wewenang khusus Waka Kurikulum."*
5. **Step-Up Authentication (Password Re-confirmation):**
   - Buat fungsi pembungkus modal `withPasswordConfirm(actionCallback, options)` sehingga setiap tombol sensitif (Ubah Putaran, Status Upacara, Hapus Jadwal, Commit Import) memunculkan `PasswordModal`, menangkap password pengguna, dan menyematkannya ke payload request.

---

## 4. Konfigurasi Lingkungan Proyek (`.env`)

Berkas konfigurasi lingkungan Front-End (`frontend/scp_web/.env.example`):

```bash
# URL Basis API Backend Laravel SCP
VITE_API_BASE_URL=http://127.0.0.1:8000/api

# Identitas Aplikasi
VITE_APP_NAME="School Class Progress (SCP)"
VITE_APP_VERSION="1.0.0"

# Kredensial Google Single Sign-On (Client ID Google Cloud Console)
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com

# Konfigurasi Polling Asinkron (Milidetik)
VITE_ASYNC_POLL_INTERVAL=4000
VITE_ASYNC_POLL_MAX_ATTEMPTS=30
```

---

## 5. Tahapan Eksekusi Front-End Berikutnya (Roadmap)

Setelah analisis dan dokumentasi ini dikonfirmasi oleh pengguna, tahap implementasi Front-End disarankan dibagi ke dalam 4 *Sprint* terukur:

```
[SPRINT 1: Fondasi, Shell Layout & Autentikasi]
  ├── Setup Axios Client, Interceptor, & State AuthContext
  ├── Porting Komponen Shared & Tokens Tailwind dari Prototype
  ├── Halaman Login Terpadu + Google SSO + Deteksi must_change_password
  └── Proteksi Rute (ProtectedRoute) & Navigasi Dinamis Sidebar
       │
[SPRINT 2: Modul Waka Kurikulum & Master Data]
  ├── CRUD Master Data (Kelas, Ruang, Mapel, Guru + fet_staff_id, Siswa)
  ├── Modal Tampilan Kata Sandi Awal Pengguna Baru
  ├── Dashboard Waka: Saklar Putaran & Upacara + Password Re-confirmation
  ├── Matriks Jadwal Mingguan + Resolusi Jam Dinamis KBM
  ├── Alur Import PDF FET: Upload 2 PDF -> Preview Asinkron -> Resolusi -> Commit
  └── Kenaikan Kelas Massal & Penandaan Siswa Tinggal Kelas
       │
[SPRINT 3: Modul KBM, Jurnal, Presensi & Perizinan]
  ├── Kalender Jadwal Mengajar Guru (Read-Only)
  ├── Pembukaan Kelas Ongoing + Prefill Siswa Izin (meta.approved_leaves)
  ├── Form Jurnal KBM Atomik + Kompresi Foto ~800px + Presensi Exception-Based
  ├── Penanganan Guru Izin: Hak Eksklusif Pengganti Kesiswaan & Tandai Absent
  ├── Pengajuan Izin Siswa (2 Tipe x 2 Kategori + Upload Bukti) & Edit Pending
  └── Layar Verifikasi Perizinan Khusus Guru Kesiswaan
       │
[SPRINT 4: Sistem Kuis AI, Monitoring, Profil & Final Polish]
  ├── Inisialisasi Kuis Guru + 3 Metode Pembuatan Soal (Prompt, Dokumen, Manual)
  ├── Tahap Preview, Koreksi, & Publikasi Kuis (draft_review -> published)
  ├── Pengerjaan Kuis Siswa + Penanganan Asinkron Koreksi AI (202 Accepted)
  ├── Layar Submissions Review Guru + Override Nilai AI + Rilis Hasil
  ├── Monitoring Rekap Presensi & Jurnal Mengajar Sekolah
  ├── Profil Pengguna: Verifikasi OTP Email, WhatsApp, Google Link
  └── Pengujian Komprehensif Antarmuka, Responsivitas, & Uji Coba UKK
```
