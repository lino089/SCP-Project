# Dokumen 03: Analisis Backend dan Spesifikasi API SCP

**Sumber Analisis:** Source Code Backend `scp/` & Dokumen Rencana Teknis `scp/MD/`  
**Framework:** Laravel 13 (Headless REST API Provider) · PostgreSQL 16 · Laravel Sanctum  
**Status Backend Terkini:** Fase 0 s.d. Fase 8 Selesai Diimplementasikan (100% Automated Test Passed)  

---

## 1. Standar Format Request & Response

Seluruh komunikasi data antara Front-End Web dan Backend REST API SCP mengikuti format standar JSON yang konsisten di semua endpoint:

### 1.1 Format Respons Sukses (HTTP 200 / 201 / 202)
```json
{
  "success": true,
  "message": "Pesan deskriptif keberhasilan operasi.",
  "data": {
    // Objek tunggal atau array entitas hasil operasi
  },
  "meta": {
    // Metadata opsional (misal: pagination, filter status, summary counts)
    "current_page": 1,
    "per_page": 15,
    "total": 45,
    "last_page": 3
  }
}
```

### 1.2 Format Respons Gagal / Error (HTTP 400 / 401 / 403 / 404 / 409 / 422 / 429 / 500)
```json
{
  "success": false,
  "message": "Pesan deskriptif penyebab kegagalan.",
  "errors": {
    // Kamus kesalahan spesifik per-field (terutama pada HTTP 422)
    "password": [
      "Kata sandi salah. Tindakan dibatalkan demi keamanan."
    ],
    "classes": [
      "Master data kelas masih kosong. Waka wajib mendaftarkan kelas terlebih dahulu."
    ]
  }
}
```

### 1.3 Kode Status HTTP yang Diterapkan Backend
- **200 OK:** Pengambilan data sukses (GET), pembaruan data sukses (PUT/PATCH), atau penghapusan sukses (DELETE).
- **201 Created:** Sumber daya baru berhasil disimpan ke basis data (POST).
- **202 Accepted:** Permintaan diterima dan sedang diproses secara asinkron di latar belakang oleh antrean worker (misal: upload PDF jadwal, generate prompt AI, submit kuis siswa).
- **401 Unauthorized:** Request tidak menyertakan Bearer Token yang sah, token telah kedaluwarsa, atau kredensial login salah.
- **403 Forbidden:** Pengguna terautentikasi tetapi tidak memiliki hak akses / otorisasi atas sumber daya terkait (misal: guru biasa mencoba mutasi jadwal atau menggantikan kelas tanpa penugasan kesiswaan).
- **404 Not Found:** Entitas atau rute yang diminta tidak ditemukan di basis data.
- **409 Conflict:** Penghapusan entitas ditolak karena masih memiliki referensi aktif (misal: menghapus kelas/guru/ruang/mapel yang masih terikat jadwal aktif, atau menghapus jadwal yang sudah memiliki jurnal).
- **422 Unprocessable Entity:** Validasi data gagal, prasyarat master data belum terpenuhi, atau password konfirmasi salah.
- **429 Too Many Requests:** Pelanggaran batas laju request (*Rate Limit* terlampaui: 60 req/menit per token).
- **500 Internal Server Error:** Terjadi kesalahan fatal pada server atau layanan pihak ketiga.

---

## 2. Mekanisme Keamanan, Autentikasi & Otorisasi

### 2.1 Autentikasi Multi-Perangkat (Laravel Sanctum)
- **Token Format:** Bearer Token via header `Authorization: Bearer <plainTextToken>`.
- **Masa Berlaku Token:** 30 hari (43.200 menit) sejak dibuat jika tidak digunakan.
- **Identifikasi Perangkat:** Endpoint login mewajibkan field `device_name` (misal: "Windows 11 - Chrome 124") untuk mendukung pelacakan sesi multi-device.
- **Flag Perubahan Password:** Respons login menyertakan field `must_change_password: true/false`. Jika `true`, pengguna wajib diarahkan ke antarmuka penggantian kata sandi pertama kali.

### 2.2 Pola Konfirmasi Ulang Password (Step-Up Authentication)
Pada aksi mutasi sensitif, Waka Kurikulum wajib mengirimkan password akun yang sedang login di dalam body payload (`password: "..."`). Backend memvalidasi password tersebut menggunakan fungsi pembantu `passwordIsConfirmed()` terhadap hash user login. Jika salah, backend langsung mengembalikan status 422:
```json
{
  "success": false,
  "message": "Kata sandi salah. Tindakan dibatalkan demi keamanan.",
  "errors": {
    "password": ["Kata sandi konfirmasi tidak cocok."]
  }
}
```

### 2.3 Rate Limiting API
- Rute terautentikasi dilindungi oleh middleware `throttle:api` dengan kuota **60 request per menit per pengguna/token**.
- Jika batas terlampaui, backend mengembalikan status **HTTP 429 Too Many Requests** beserta header `Retry-After`. Front-End wajib menangani ini dengan membatasi polling dan memberi notifikasi jeda kepada pengguna.

---

## 3. Katalog Lengkap Endpoint REST API SCP

Berikut adalah daftar lengkap 40+ endpoint yang telah aktif dan teruji pada backend SCP:

### 3.1 Autentikasi, Profil & Verifikasi Kontak Mandiri (PRD 5.1, 5.2, 9.1)
| HTTP Method | Endpoint | Hak Akses | Body / Parameter Utama | Deskripsi & Fungsi |
|---|---|---|---|---|
| `GET` | `/api/ping` | Public | - | Health check status server & waktu saat ini. |
| `POST` | `/api/login` | Public | `{ username/nis_nip, password, device_name }` | Login kredensial, mengembalikan token & flag must_change_password. |
| `POST` | `/api/auth/google` | Public | `{ id_token, device_name }` | Login via Google Single Sign-On (SSO). |
| `GET` | `/api/me` | Auth (Semua) | - | Mengambil profil user aktif beserta relasi `assignments`. |
| `POST` | `/api/logout` | Auth (Semua) | - | Mencabut token akses sesi aktif saat ini. |
| `POST` | `/api/me/email` | Auth (Semua) | `{ email }` | Mengirim 6-digit OTP verifikasi ke alamat email baru. |
| `POST` | `/api/me/email/verify` | Auth (Semua) | `{ email, code }` | Verifikasi OTP email dan menyimpan `email_verified_at`. |
| `POST` | `/api/me/phone` | Auth (Semua) | `{ phone_number }` | Mengirim OTP WhatsApp via Twilio Service. |
| `POST` | `/api/me/phone/verify` | Auth (Semua) | `{ phone_number, code }` | Memvalidasi OTP WhatsApp dan menautkan nomor HP. |
| `POST` | `/api/me/google-link` | Auth (Semua) | `{ id_token }` | Menautkan akun Google ke akun user (auto-fill email jika kosong). |

### 3.2 Konfigurasi Akademik & Riwayat Siklus (PRD 5.3, 5.5, 9.2)
| HTTP Method | Endpoint | Hak Akses | Body / Parameter Utama | Deskripsi & Fungsi |
|---|---|---|---|---|
| `GET` | `/api/academic-settings` | Waka | - | Mengambil status konfigurasi aktif (`active_cycle`, `monday_is_upacara`). |
| `PATCH` | `/api/academic-settings` | Waka | `{ cycle_type: 1\|2, password }` | Mengubah putaran jadwal aktif + mencatat ke `cycle_history`. |
| `PATCH` | `/api/academic-settings/monday-status` | Waka | `{ is_upacara: boolean, password }` | Mengubah status upacara Senin (berdampak ke jam pertama KBM). |
| `GET` | `/api/cycle-history` | Waka | `?page=&per_page=` | Menampilkan log audit riwayat perubahan putaran aktif. |

### 3.3 Master Data Entitas Akademik & Penugasan (PRD 5.12, 5.13, 9.3)
| HTTP Method | Endpoint | Hak Akses | Body / Parameter Utama | Deskripsi & Fungsi |
|---|---|---|---|---|
| `GET` | `/api/classes` | Auth (Semua) | `?page=&per_page=&search=` | Daftar master kelas (tingkat & nama). |
| `POST` | `/api/classes` | Waka | `{ name, level: 10\|11\|12 }` | Menambahkan kelas baru. |
| `PUT` | `/api/classes/{id}` | Waka | `{ name, level, next_class_id }` | Memperbarui kelas / relasi kelas kenaikan. |
| `DELETE` | `/api/classes/{id}` | Waka | - | Soft-delete kelas (Ditolak 409 jika terikat jadwal aktif). |
| `POST` | `/api/class-promotions` | Waka | - | Eksekusi massal kenaikan kelas & kelulusan akhir tahun. |
| `GET` | `/api/rooms` | Auth (Semua) | `?page=&per_page=&search=` | Daftar master ruangan sekolah. |
| `POST` | `/api/rooms` | Waka | `{ name, capacity }` | Menambahkan ruangan baru. |
| `PUT` | `/api/rooms/{id}` | Waka | `{ name, capacity }` | Memperbarui ruangan. |
| `DELETE` | `/api/rooms/{id}` | Waka | - | Soft-delete ruangan (Ditolak 409 jika terikat jadwal aktif). |
| `GET` | `/api/subjects` | Auth (Semua) | `?page=&per_page=&search=` | Daftar master mata pelajaran. |
| `POST` | `/api/subjects` | Waka | `{ name }` | Menambahkan mata pelajaran baru. |
| `PUT` | `/api/subjects/{id}` | Waka | `{ name }` | Memperbarui mata pelajaran. |
| `DELETE` | `/api/subjects/{id}` | Waka | - | Soft-delete mapel (Ditolak 409 jika terikat jadwal aktif). |
| `GET` | `/api/teachers` | Auth (Semua) | `?page=&per_page=&search=` | Daftar guru beserta relasi `assignments`. |
| `POST` | `/api/teachers` | Waka | `{ name, nip/nis_nip, fet_staff_id, email }` | Auto-provisioning akun guru (kembalikan random password). |
| `PUT` | `/api/teachers/{id}` | Waka | `{ name, nip, fet_staff_id, email }` | Memperbarui data profil guru. |
| `DELETE` | `/api/teachers/{id}` | Waka | - | Soft-delete guru (Ditolak 409 jika terikat jadwal aktif). |
| `POST` | `/api/teachers/{id}/assignments` | Waka | `{ type: kesiswaan\|wali_kelas, class_id }` | Menetapkan penugasan kesiswaan atau wali kelas. |
| `DELETE` | `/api/teachers/{id}/assignments/{id}` | Waka | - | Mencabut penugasan tambahan guru. |
| `GET` | `/api/students` | Auth (Semua) | `?page=&per_page=&search=&class_id=` | Daftar siswa berpaginasi beserta kelasnya. |
| `POST` | `/api/students` | Waka | `{ name, nis, class_id }` | Auto-provisioning akun siswa + akun orang tua otomatis. |
| `PUT` | `/api/students/{id}` | Waka | `{ name, nis, class_id }` | Memperbarui data siswa. |
| `DELETE` | `/api/students/{id}` | Waka | - | Soft-delete siswa dan akun orang tua yang terhubung. |
| `POST` | `/api/students/{id}/hold-back` | Waka | - | Menandai siswa tinggal kelas sebelum promosi massal. |

### 3.4 Jadwal Pelajaran (Schedules) — Sentralisasi Waka (PRD 5.3, 5.4, 5.6, 9.4)
| HTTP Method | Endpoint | Hak Akses | Body / Parameter Utama | Deskripsi & Fungsi |
|---|---|---|---|---|
| `GET` | `/api/schedules` | Auth (Semua) | `?cycle=1\|2&day=1..5&class_id=&teacher_id=` | Menampilkan jadwal berpaginasi + `resolved_times` jam riil. (Guru ter-scoped jadwal mandiri). |
| `GET` | `/api/schedules?status=missing_journal` | Guru/Waka | `?teacher_id=&class_id=` | Alert jadwal hari ini yang selesai > 30 menit namun jurnal belum completed (kecuali teacher_absent). |
| `POST` | `/api/schedules` | Waka | `{ cycle_type, period_number, duration_periods, teacher_id, class_id, room_id, subject_id, day_of_week, password }` | Tambah jadwal manual (Cek prasyarat master data 422, cek password 422, cek bentrok 422). |
| `PUT` | `/api/schedules/{id}` | Waka | Payload identik + `password` | Edit jadwal manual (Cek password & bentrok). |
| `DELETE` | `/api/schedules/{id}` | Waka | Body/query: `{ password }` | Hapus jadwal (Ditolak 409 jika sudah memiliki riwayat jurnal). |

### 3.5 Import Jadwal Otomatis dari PDF FET (PRD 5.16, 5.17, 9.5)
| HTTP Method | Endpoint | Hak Akses | Body / Parameter Utama | Deskripsi & Fungsi |
|---|---|---|---|---|
| `POST` | `/api/schedule-imports` | Waka | Multipart: `{ cycle_type, file_kelas, file_ruangan }` | Unggah 2 berkas PDF FET (Cek prasyarat master data & fet_staff_id guru -> 202 Accepted). |
| `GET` | `/api/schedule-imports/{id}` | Waka | - | Detail preview import: status batch, total baris, matched, unmatched, conflict, duplicate. |
| `PATCH` | `/api/schedule-imports/{id}/rows/{row_id}` | Waka | `{ matched_class_id, matched_teacher_id, matched_room_id, matched_subject_id, exclude: bool }` | Resolusi manual satu baris atau mengecualikan baris. |
| `POST` | `/api/schedule-imports/{id}/confirm` | Waka | `{ password }` | Konfirmasi commit: tolak jika matched=0 (422), soft-delete jadwal lama putaran terkait, insert baris matched, hapus file PDF. |
| `DELETE` | `/api/schedule-imports/{id}` | Waka | - | Membatalkan batch import dan membersihkan berkas sementara. |

### 3.6 Perizinan Siswa (Leave Requests) & Presensi (PRD 5.8, 5.10, 5.15, 9.6)
| HTTP Method | Endpoint | Hak Akses | Body / Parameter Utama | Deskripsi & Fungsi |
|---|---|---|---|---|
| `GET` | `/api/leave-requests` | Auth | `?status=&type=&category=&class_id=&date=` | Daftar perizinan ter-scoped (Kesiswaan/Waka: semua; Wali Kelas: kelasnya; Siswa/Ortu: milik sendiri). |
| `GET` | `/api/leave-requests/{id}` | Auth | - | Detail lengkap perizinan beserta bukti dokumen surat. |
| `POST` | `/api/leave-requests` | Siswa / Ortu | Multipart: `{ type, category, start_date, end_date, departure_time, expected_return_time, document }` | Mengajukan izin (2 tipe x 2 kategori). Sakit wajib unggah surat. |
| `PATCH` | `/api/leave-requests/{id}` | Kesiswaan / Pemilik | `{ status: approved\|rejected }` (Kesiswaan) ATAU `{ type, category, ... }` (Pemilik saat status pending). | Verifikasi persetujuan izin ATAU pengeditan permohonan pending. |
| `DELETE` | `/api/leave-requests/{id}` | Pemilik | - | Membatalkan perizinan (hanya selama berstatus pending). |
| `GET` | `/api/attendances` | Auth | `?date=&start_date=&end_date=&class_id=&status=` | Rekapitulasi presensi ter-scoped peran (Hadir/Sakit/Izin/Alpa). |

### 3.7 Jurnal KBM & Presensi Exception-Based (PRD 5.7, 5.8, 5.11, 9.7)
| HTTP Method | Endpoint | Hak Akses | Body / Parameter Utama | Deskripsi & Fungsi |
|---|---|---|---|---|
| `GET` | `/api/journals` | Waka / Guru | `?date=&class_id=&teacher_id=&status=` | Riwayat jurnal (Waka/Kesiswaan: semua; Guru: jadwal sendiri / pengganti). |
| `GET` | `/api/journals/{id}` | Auth | - | Detail jurnal, foto, topik, dan daftar kehadiran siswa kelas. |
| `POST` | `/api/journals` | Guru / Kesiswaan | `{ schedule_id, date, status: ongoing\|teacher_absent }` | Buka kelas (ongoing) -> kembalikan `meta.approved_leaves`; atau tandai `teacher_absent`. Wali kelas / guru lain ditolak 403. |
| `PUT` | `/api/journals/{id}` | Guru / Pengganti | Multipart: `{ topic_description (min 10), photo, exceptions: [{ student_id, status: Sakit\|Izin\|Alpa }] }` | Menyelesaikan jurnal atomik: kompresi foto ~800px JPEG quality 35%, catat presensi exception-based (sisa siswa otomatis Hadir). |
| `PATCH` | `/api/journals/{id}` | Kesiswaan / Waka | `{ status: teacher_absent }` | Menandai jurnal yang sudah dibuat menjadi status guru berhalangan hadir. |

### 3.8 Sistem Kuis Berbantuan AI Asinkron (PRD 5.14, 9.8)
| HTTP Method | Endpoint | Hak Akses | Body / Parameter Utama | Deskripsi & Fungsi |
|---|---|---|---|---|
| `GET` | `/api/quizzes` | Auth | `?class_id=&status=&page=&per_page=` | Daftar kuis ter-scoped (Guru: miliknya; Siswa: published kelasnya; Ortu: published_result kelas anak). |
| `GET` | `/api/quizzes/{id}` | Auth | - | Detail kuis & butir soal (Kunci jawaban otomatis disembunyikan untuk siswa). |
| `POST` | `/api/quizzes` | Guru | `{ title, class_id, due_date, max_attempts }` | Inisialisasi kuis baru dalam status `draft_review`. |
| `PATCH` | `/api/quizzes/{id}` | Guru | `{ title, due_date, max_attempts, status: draft_review\|published\|published_result }` | Update metadata kuis, atau publikasikan kuis, atau rilis hasil nilai. |
| `POST` | `/api/quizzes/{id}/generate-prompt` | Guru | `{ prompt, total_questions, question_types, mc_count, essay_count, difficulty }` | **Metode 1:** Generate soal via prompt AI (Validasi komposisi ketat -> 202 Accepted). |
| `POST` | `/api/quizzes/{id}/extract-document` | Guru | Multipart: `{ document: PDF\|TXT (max 5MB) }` | **Metode 2:** Ekstraksi soal dari dokumen via AI (Menandai `needs_review: true` pada soal ambigu -> 202 Accepted). |
| `GET` | `/api/quizzes/{id}/questions` | Guru | - | **Tahap Preview:** Melihat butir soal hasil AI / manual untuk diperiksa sebelum publish. |
| `POST` | `/api/quizzes/{id}/questions` | Guru | `{ question_text, question_type, options, correct_answer }` | **Metode 3:** Tambah butir soal manual satu per satu. |
| `PUT` | `/api/quizzes/{id}/questions/{q_id}` | Guru | `{ question_text, question_type, options, correct_answer }` | Edit butir soal pada tahap preview. |
| `DELETE` | `/api/quizzes/{id}/questions/{q_id}` | Guru | - | Hapus butir soal pada tahap preview. |
| `PATCH` | `/api/quizzes/{id}/publish` | Guru | - | Konfirmasi final & publikasikan kuis (`status: published`) agar dapat dikerjakan siswa. |
| `POST` | `/api/quizzes/{id}/submissions` | Siswa | `{ answers: [{ question_id, selected_option, answer }] }` | Pengumpulan kuis oleh siswa (Validasi deadline & max attempts -> 202 Accepted -> Antrean Koreksi AI). |
| `GET` | `/api/quizzes/{id}/submissions` | Guru | - | Review seluruh submission siswa pada kuis terkait. |
| `PATCH` | `/api/quiz-submissions/{id}` | Guru | `{ score, feedback }` | Override nilai AI oleh guru dengan audit trail (`is_overridden: true`). |
| `GET` | `/api/quizzes/{id}/submissions/me` | Siswa / Ortu | - | Melihat skor akhir dan evaluasi umpan balik (Hanya aktif setelah status kuis `published_result`). |
