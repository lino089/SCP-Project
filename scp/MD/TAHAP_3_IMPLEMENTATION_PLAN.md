# Rencana Implementasi Terperinci: Tahap 3 — Controller & Endpoint Izin Guru (TeacherLeaveRequestController)

**Dokumen Rencana:** `MD/TAHAP_3_IMPLEMENTATION_PLAN.md`  
**Proyek:** School Class Progress (SCP) — Backend REST API  
**Versi Target:** SCP v4.5 (Ekstensi Multirole Guru & Kesiswaan — Tahap 3)  
**Dokumen Acuan:** `MD/SCP_MULTIKELAS_KESISWAAN_PLAN.md` (Bab 4.3, Bab 5.1.1, Bab 5.2.1, Bab 5.3.1, Bab 5.4, Bab 7 Tahap 3), `MD/PRD.md`  
**Status Dokumen:** Usulan Rencana Detail (Menunggu Persetujuan Pengguna Sebelum Eksekusi)  

---

## DAFTAR ISI

1. [Tujuan dan Ruang Lingkup Tahap 3](#1-tujuan-dan-ruang-lingkup-tahap-3)
2. [Kondisi Aktual Sistem & Fondasi Tahap 1 & 2 (Terverifikasi)](#2-kondisi-aktual-sistem--fondasi-tahap-1--2-terverifikasi)
3. [Analisis Kebutuhan Teknis Setiap Method TeacherLeaveRequestController](#3-analisis-kebutuhan-teknis-setiap-method-teacherleaverequestcontroller)
   - 3.1 `index()` — Listing Pengajuan Izin Guru (Role Scoped)
   - 3.2 `show()` — Detail Satu Pengajuan Izin Guru
   - 3.3 `store()` — Pengajuan Izin Mengajar, Surat Keterangan & Titipan Tugas
   - 3.4 `approve()` — Persetujuan Izin Guru oleh Kesiswaan / Waka Kurikulum
   - 3.5 `reject()` — Penolakan Izin Guru oleh Kesiswaan / Waka Kurikulum
4. [Rancangan Validasi Request & Aturan Bisnis (Business Rules)](#4-rancangan-validasi-request--aturan-bisnis-business-rules)
   - 4.1 Validasi Input & Aturan File Attachment
   - 4.2 Validasi Integritas Kepemilikan Jadwal (`schedule_ids`)
   - 4.3 Logika Deteksi & Pencegahan Pengajuan Duplikat
   - 4.4 Status Lifecycle & Immutability Record
5. [Rancangan Otorisasi, Hak Akses & Role Scoping](#5-rancangan-otorisasi-hak-akses--role-scoping)
   - 5.1 Matriks Hak Akses per Role
   - 5.2 Pola Two-Tier Authorization (Route Middleware + Controller Guard)
6. [Rancangan Penanganan Berkas & Storage (`storage/app/public/teacher_leaves`)](#6-rancangan-penanganan-berkas--storage-storageapppublicteacher_leaves)
7. [Rancangan Rute API (`routes/api.php`)](#7-rancangan-rute-api-routesapiphp)
8. [Daftar File yang Dibuat / Dimodifikasi](#8-daftar-file-yang-dibuat--dimodifikasi)
9. [Urutan Pengerjaan Implementasi Bertahap](#9-urutan-pengerjaan-implementasi-bertahap)
10. [Analisis Risiko Keamanan, Integritas Data & Potensi Regresi](#10-analisis-risiko-keamanan-integritas-data--potensi-regresi)
11. [Rencana Verifikasi dan Perintah Pengujian CLI](#11-rencana-verifikasi-dan-perintah-pengujian-cli)
12. [Kriteria Keberhasilan (*Acceptance Criteria*)](#12-kriteria-keberhasilan-acceptance-criteria)
13. [Keputusan Teknis & Hal-Hal yang Membutuhkan Konfirmasi Pengguna](#13-keputusan-teknis--hal-hal-yang-membutuhkan-konfirmasi-pengguna)

---

## 1. Tujuan dan Ruang Lingkup Tahap 3

### 1.1 Tujuan Utama
Membangun subsistem alur perizinan guru (*Teacher Leave Request System*) yang terintegrasi secara penuh pada backend REST API SCP. Fitur ini memungkinkan:
1. **Seluruh guru (guru reguler maupun wali kelas)** dapat mengajukan perizinan tidak mengajar secara resmi melalui sistem, melampirkan surat bukti/keterangan medis, mendata jadwal-jadwal mengajar yang ditinggalkan, serta menitipkan tugas/materi KBM beserta file soal bagi kelas yang ditinggalkan.
2. **Tim Kesiswaan dan Waka Kurikulum** dapat memantau seluruh riwayat perizinan guru secara terpusat, memfilter berdasarkan guru, status, maupun rentang tanggal, serta melakukan verifikasi formal persetujuan (*approve*) atau penolakan (*reject*).
3. **Penyelarasan operasional KBM**: Izin yang disetujui menjadi rujukan absensi guru dan dasar penugasan guru pengganti (*inval*) atau penanganan sesi KBM darurat oleh Tim Kesiswaan / Wali Kelas (sebagaimana telah disiapkan pada Tahap 2).

### 1.2 Ruang Lingkup Pengerjaan (In-Scope Tahap 3)
Fokus pengerjaan dibatasi secara tegas pada:
1. **Pembuatan Controller Baru:**
   - Berkas: `app/Http/Controllers/API/TeacherLeaveRequestController.php`
   - Berisi 5 method: `index`, `show`, `store`, `approve`, `reject`.
2. **Pendaftaran Rute REST API Baru:**
   - Berkas: `routes/api.php`
   - Pendaftaran 5 rute baru di bawah grup middleware `auth:sanctum` dan `throttle:api` dengan konfigurasi role-based access.
3. **Penyusunan Rangkaian Automated Feature Test Tahap 3:**
   - Berkas: `tests/Feature/TeacherLeaveRequestTest.php`
   - Meliputi seluruh skenario positif, pembatasan otorisasi, validasi kepemilikan jadwal, proteksi duplikasi, upload berkas, serta pencegahan re-verifikasi.

### 1.3 Batasan Ketat (Strictly Out-of-Scope pada Tahap 3)
- **Tidak mengubah skema database migration:** Skema tabel `teacher_leave_requests` telah selesai dibuat dan diverifikasi pada Tahap 1.
- **Tidak mengubah model yang sudah ada:** Model `TeacherLeaveRequest` dan `User` sudah memiliki relasi dan helper yang lengkap dari Tahap 1.
- **Tidak memodifikasi `LeaveRequestController.php`:** Controller ini eksklusif untuk perizinan siswa. Perizinan guru dipisahkan secara terisolasi di `TeacherLeaveRequestController.php` untuk menjaga prinsip *Single Responsibility*.
- **Tidak memodifikasi `JournalController.php` atau `ScheduleController.php`:** Logika controller tersebut telah tuntas diimplementasikan dan diverifikasi pada Tahap 2.

---

## 2. Kondisi Aktual Sistem & Fondasi Tahap 1 & 2 (Terverifikasi)

Hasil inspeksi langsung terhadap baris kode aktual pada repositori SCP:

### 2.1 Skema Tabel `teacher_leave_requests` (Tahap 1)
Migrasi `database/migrations/2026_10_31_000001_create_teacher_leave_requests_table.php` telah aktif dan termigrasi dengan struktur:
- `id`: BIGSERIAL / BIGINT Primary Key.
- `teacher_id`: BIGINT UNSIGNED Foreign Key ke `users.id` (`cascadeOnDelete`).
- `schedule_ids`: JSON, nullable (array ID jadwal yang ditinggalkan).
- `date`: DATE (tanggal izin).
- `reason`: TEXT (alasan ketidakhadiran).
- `attachment_path`: VARCHAR(255), nullable (path surat keterangan dokter / izin).
- `task_instruction`: TEXT, nullable (instruksi tugas mandiri untuk siswa).
- `task_attachment_path`: VARCHAR(255), nullable (path berkas modul/tugas titipan).
- `status`: ENUM `['pending', 'approved', 'rejected']`, default `pending`.
- `approved_by`: BIGINT UNSIGNED Foreign Key ke `users.id`, nullable (`nullOnDelete`).
- `verified_at`: TIMESTAMP, nullable.
- `created_at`, `updated_at`: TIMESTAMP.
- Indeks: `INDEX(teacher_id, status)` dan `INDEX(date)`.

### 2.2 Model `TeacherLeaveRequest` & `User` (Tahap 1)
- `TeacherLeaveRequest.php` telah memiliki:
  - `$fillable` lengkap untuk seluruh atribut operasional.
  - `$casts`: `'schedule_ids' => 'array'`, `'date' => 'date:Y-m-d'`, `'verified_at' => 'datetime'`.
  - Relasi `teacher(): BelongsTo` (dengan `withTrashed()`).
  - Relasi `approvedBy(): BelongsTo` (dengan `withTrashed()`).
- `User.php` telah memiliki:
  - Relasi `teacherLeaveRequests(): HasMany` ke `TeacherLeaveRequest`.
  - Helper `isKesiswaan(): bool` (mengecek penugasan aktif `kesiswaan`).
  - Helper `isWaliKelas(?int $classId = null): bool`.
  - Helper `homeroomClassIds(): array` (mengembalikan daftar ID kelas binaan).

### 2.3 Model `Schedule` & Validasi Kepemilikan
- Model `Schedule` memiliki kolom `teacher_id`, `class_id`, `subject_id`, `room_id`, `day_of_week`, dan relasi `teacher(): BelongsTo`.
- Soft deletes aktif (`use SoftDeletes`).

### 2.4 Struktur Rute & Pipeline Middleware pada `routes/api.php`
- Semua rute API terlindungi oleh `Route::middleware(['auth:sanctum', 'throttle:api'])`.
- Otorisasi peran menggunakan alias middleware `'role'` (`RoleMiddleware::class`).
- Format envelope response standar SCP:
  `{ success: bool, message: string, data: mixed, meta?: array, errors?: mixed }`.

---

## 3. Analisis Kebutuhan Teknis Setiap Method `TeacherLeaveRequestController`

### 3.1 Method `index(Request $request): JsonResponse`
**Fungsi:** Mengambil daftar pengajuan izin guru dengan role-scoping ketat, filter multi-kriteria, dan pagination.

- **Otorisasi Rute:** `role:vice_principal,teacher`
- **Logika Scoping Peran (Data Isolation):**
  - Evaluasi hak akses verifikator:
    `$isVerifier = ($user->role === 'vice_principal' || ($user->role === 'teacher' && $user->isKesiswaan()));`
  - Jika `$isVerifier === true`:
    - Menampilkan seluruh data pengajuan izin guru di sekolah.
    - Mendukung filter `teacher_id`: `$query->where('teacher_id', $request->integer('teacher_id'))`.
  - Jika `$isVerifier === false` (Guru Reguler & Wali Kelas):
    - **Wajib di-scope secara absolut** ke ID guru yang sedang login:
      `$query->where('teacher_id', $user->id);`
    - Parameter `teacher_id` dari query string diabaikan demi keamanan.
- **Filter Universal (Berlaku untuk semua yang berhak melihat):**
  - Filter `status`: `$query->where('status', $request->input('status'))` (nilai: `pending`, `approved`, `rejected`).
  - Filter `date`: `$query->whereDate('date', $request->input('date'))`.
  - Filter rentang tanggal:
    `if ($request->filled('start_date') && $request->filled('end_date')) { $query->whereBetween('date', [$request->input('start_date'), $request->input('end_date')]); }`
- **Eager Loading:**
  - `teacher:id,name,nis_nip`
  - `approvedBy:id,name,nis_nip`
- **Pengurutan (Sorting):**
  - `orderBy('date', 'desc')->orderBy('id', 'desc')`
- **Pagination & Response Envelope (HTTP 200):**
  - Menggunakan `$perPage = $request->integer('per_page', 15);`
  - Response format:
    ```json
    {
      "success": true,
      "message": "Daftar pengajuan izin guru berhasil diambil.",
      "data": [ ... ],
      "meta": {
        "current_page": 1,
        "per_page": 15,
        "total": 24,
        "last_page": 2
      }
    }
    ```

---

### 3.2 Method `show(Request $request, $id): JsonResponse`
**Fungsi:** Mengambil data rincian satu perizinan guru tertentu.

- **Otorisasi Rute:** `role:vice_principal,teacher`
- **Pencarian Data & Eager Loading:**
  - Ambil record via `TeacherLeaveRequest::with(['teacher:id,name,nis_nip', 'approvedBy:id,name,nis_nip'])->findOrFail($id);`
- **Evaluasi Akses Granular:**
  - Diizinkan jika:
    1. Pengguna adalah Waka Kurikulum (`$user->role === 'vice_principal'`), ATAU
    2. Pengguna adalah Guru Kesiswaan (`$user->role === 'teacher' && $user->isKesiswaan()`), ATAU
    3. Pengguna adalah guru pemilik pengajuan tersebut (`$leaveRequest->teacher_id === $user->id`).
  - Jika tidak memenuhi salah satu syarat di atas:
    - Kembalikan response **HTTP 403 Forbidden**:
      ```json
      {
        "success": false,
        "message": "Akses ditolak. Anda tidak memiliki izin untuk melihat detail perizinan ini."
      }
      ```
- **Kondisi Khusus (Detail Jadwal Terkait):**
  - Jika `schedule_ids` terisi dan memiliki elemen array, controller juga dapat me-load data ringkas jadwal terkait (`id`, `subject:id,name`, `schoolClass:id,name`, `day_of_week`, `period_number`) dan melampirkannya ke objek respons atau atribut dinamis `schedules` untuk kenyamanan visual frontend.
- **Response Format (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Detail perizinan guru berhasil diambil.",
    "data": { ... }
  }
  ```

---

### 3.3 Method `store(Request $request): JsonResponse`
**Fungsi:** Memproses pengajuan izin tidak hadir guru beserta surat keterangan dan delegasi tugas.

- **Otorisasi Rute:** `role:teacher` (Guru reguler dan wali kelas memiliki hak yang sama untuk mengajukan izin mengajar).
- **Validasi Input Form-Data:**
  ```php
  $request->validate([
      'date'             => 'required|date',
      'reason'           => 'required|string|min:5|max:1000',
      'schedule_ids'     => 'nullable|array',
      'schedule_ids.*'   => 'integer|exists:schedules,id',
      'attachment'       => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
      'task_instruction' => 'nullable|string|max:2000',
      'task_attachment'  => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
  ]);
  ```
- **Aturan Integritas 1: Kepemilikan Jadwal (`schedule_ids`)**
  - Jika `schedule_ids` dikirimkan dan berupa array yang tidak kosong:
    - Verifikasi bahwa seluruh jadwal dalam array tersebut adalah jadwal di mana `teacher_id === $user->id`:
      ```php
      $scheduleIds = $request->input('schedule_ids', []);
      if (!empty($scheduleIds)) {
          $invalidScheduleExists = Schedule::whereIn('id', $scheduleIds)
              ->where('teacher_id', '!=', $user->id)
              ->exists();

          if ($invalidScheduleExists) {
              return response()->json([
                  'success' => false,
                  'message' => 'Anda hanya dapat mengajukan izin untuk jadwal mengajar milik Anda sendiri.',
              ], 422);
          }
      }
      ```
- **Aturan Integritas 2: Pencegahan Duplikasi Pengajuan (*Duplicate Prevention*)**
  - Guru dilarang mengajukan izin baru jika pada tanggal yang sama sudah memiliki izin berstatus `pending` atau `approved`:
    ```php
    $targetDate = Carbon::parse($request->input('date'))->toDateString();

    $existingActiveLeave = TeacherLeaveRequest::where('teacher_id', $user->id)
        ->whereDate('date', $targetDate)
        ->whereIn('status', ['pending', 'approved'])
        ->exists();

    if ($existingActiveLeave) {
        return response()->json([
            'success' => false,
            'message' => 'Anda sudah memiliki pengajuan izin yang berstatus pending atau disetujui pada tanggal tersebut.',
        ], 422);
    }
    ```
  - *Catatan:* Jika pengajuan izin sebelumnya pada tanggal tersebut berstatus `rejected`, guru **tetap diizinkan** mengajukan izin baru (misalnya setelah merevisi alasan atau melengkapi surat dokter).
- **Penyimpanan Berkas Lampiran:**
  - Lampiran surat keterangan:
    `$attachmentPath = $request->hasFile('attachment') ? $request->file('attachment')->store('teacher_leaves/letters', 'public') : null;`
  - Lampiran berkas tugas titipan:
    `$taskAttachmentPath = $request->hasFile('task_attachment') ? $request->file('task_attachment')->store('teacher_leaves/tasks', 'public') : null;`
- **Penyimpanan ke Basis Data:**
  ```php
  $leave = TeacherLeaveRequest::create([
      'teacher_id'           => $user->id,
      'schedule_ids'         => !empty($scheduleIds) ? array_values(array_unique($scheduleIds)) : null,
      'date'                 => $targetDate,
      'reason'               => $request->input('reason'),
      'attachment_path'      => $attachmentPath,
      'task_instruction'     => $request->input('task_instruction'),
      'task_attachment_path' => $taskAttachmentPath,
      'status'               => 'pending',
      'approved_by'          => null,
      'verified_at'          => null,
  ]);
  ```
- **Response Format (HTTP 201 Created):**
  ```json
  {
    "success": true,
    "message": "Pengajuan izin mengajar berhasil dikirim.",
    "data": { ... }
  }
  ```

---

### 3.4 Method `approve(Request $request, $id): JsonResponse`
**Fungsi:** Menyetujui pengajuan izin tidak hadir guru.

- **Otorisasi Rute:** `role:vice_principal,teacher`
- **Gerbang Otorisasi Tingkat Controller:**
  - Hanya Waka Kurikulum (`$user->role === 'vice_principal'`) atau Guru Kesiswaan (`$user->role === 'teacher' && $user->isKesiswaan()`) yang diizinkan.
  - Guru reguler maupun Wali Kelas yang mencoba mengakses rute ini ditolak dengan **HTTP 403 Forbidden**:
    ```json
    {
      "success": false,
      "message": "Akses ditolak. Hanya Tim Kesiswaan atau Waka Kurikulum yang berhak memverifikasi perizinan guru."
    }
    ```
- **Pencarian Data:**
  - `$leave = TeacherLeaveRequest::findOrFail($id);`
- **Validasi State Lifecycle (Immutability):**
  - Hanya pengajuan dengan status `pending` yang dapat diproses.
  - Jika status sudah `approved` atau `rejected`:
    ```php
    if ($leave->status !== 'pending') {
        return response()->json([
            'success' => false,
            'message' => 'Status perizinan ini sudah diproses sebelumnya dan tidak dapat diubah lagi.',
        ], 422);
    }
    ```
- **Eksekusi Pembaruan:**
  ```php
  $leave->update([
      'status'      => 'approved',
      'approved_by' => $user->id,
      'verified_at' => Carbon::now('Asia/Jakarta'),
  ]);
  ```
- **Response Format (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Pengajuan izin guru berhasil disetujui.",
    "data": { ... }
  }
  ```

---

### 3.5 Method `reject(Request $request, $id): JsonResponse`
**Fungsi:** Menolak pengajuan izin tidak hadir guru.

- **Otorisasi Rute:** `role:vice_principal,teacher`
- **Gerbang Otorisasi Tingkat Controller:**
  - Sama seperti `approve()`, hanya Waka Kurikulum atau Guru Kesiswaan yang berhak.
  - Pengguna lain ditolak dengan **HTTP 403 Forbidden**.
- **Pencarian Data:**
  - `$leave = TeacherLeaveRequest::findOrFail($id);`
- **Validasi State Lifecycle (Immutability):**
  - Wajib berstatus `pending`. Jika bukan `pending`, tolak dengan **HTTP 422 Unprocessable Content**.
- **Eksekusi Pembaruan:**
  ```php
  $leave->update([
      'status'      => 'rejected',
      'approved_by' => $user->id,
      'verified_at' => Carbon::now('Asia/Jakarta'),
  ]);
  ```
- **Response Format (HTTP 200 OK):**
  ```json
  {
    "success": true,
    "message": "Pengajuan izin guru berhasil ditolak.",
    "data": { ... }
  }
  ```

---

## 4. Rancangan Validasi Request & Aturan Bisnis (Business Rules)

### 4.1 Validasi Input & Aturan File Attachment
Tabel aturan validasi untuk payload `POST /api/teacher-leave-requests`:

| Field | Tipe & Aturan Validasi | Wajib/Opsional | Keterangan |
|---|---|---|---|
| `date` | `required\|date` | Wajib | Tanggal pelaksanaan izin guru |
| `reason` | `required\|string\|min:5\|max:1000` | Wajib | Alasan izin / ketidakhadiran |
| `schedule_ids` | `nullable\|array` | Opsional | Daftar ID jadwal yang terdampak |
| `schedule_ids.*` | `integer\|exists:schedules,id` | Kondisional | Harus merupakan ID schedule valid di database |
| `attachment` | `nullable\|file\|mimes:jpg,jpeg,png,pdf\|max:5120` | Opsional | Surat keterangan dokter / bukti permohonan izin (maks 5MB) |
| `task_instruction` | `nullable\|string\|max:2000` | Opsional | Instruksi teks tugas mandiri untuk kelas |
| `task_attachment` | `nullable\|file\|mimes:jpg,jpeg,png,pdf\|max:5120` | Opsional | Dokumen soal / materi modul titipan (maks 5MB) |

### 4.2 Validasi Integritas Kepemilikan Jadwal (`schedule_ids`)
- **Tantangan Keamanan:** Seorang guru yang nakal tidak boleh dapat mengajukan izin atas jadwal milik rekan guru lainnya.
- **Pencegahan:** Sebelum query penyimpanan dieksekusi, sistem memeriksa apakah ada ID dalam `schedule_ids` yang memiliki `teacher_id != auth()->id()`. Jika ditemukan sekurangnya satu jadwal milik guru lain, request digagalkan seketika dengan HTTP 422: *"Anda hanya dapat mengajukan izin untuk jadwal mengajar milik Anda sendiri."*

### 4.3 Logika Deteksi & Pencegahan Pengajuan Duplikat
- **Kasus 1:** Guru mengajukan izin untuk tanggal X berstatus `pending`. Guru tersebut mencoba mengirim pengajuan baru lagi pada tanggal X.  
  -> **Ditolak (HTTP 422)**.
- **Kasus 2:** Guru mengajukan izin untuk tanggal X yang telah di-`approved`. Guru mencoba mengirim pengajuan lagi pada tanggal X.  
  -> **Ditolak (HTTP 422)**.
- **Kasus 3:** Guru mengajukan izin untuk tanggal X yang di-`rejected`. Guru mengirimkan kembali pengajuan revisi dengan surat keterangan baru untuk tanggal X.  
  -> **Diterima (HTTP 201 Created)**. Status izin baru menjadi `pending`.
- **Kasus 4:** Guru A mengajukan izin pada tanggal X. Guru B juga mengajukan izin pada tanggal X.  
  -> **Diterima**, karena scoping periksa unik adalah per guru (`teacher_id`).

### 4.4 Status Lifecycle & Immutability Record
Diagram alur status perizinan guru:
```
           [Guru Mengajukan]
                   │
                   ▼
               (pending)
              /         \
   [Approve] /           \ [Reject]
            ▼             ▼
       (approved)     (rejected)
            │             │
        [LOCKED]       [LOCKED]
 (Tidak dapat diubah (Tidak dapat diubah
   kembali ke state   kembali ke state
    apapun / 422)      apapun / 422)
```
Record yang telah memiliki status `approved` atau `rejected` bersifat *immutable* terhadap aksi verifikasi ulang.

---

## 5. Rancangan Otorisasi, Hak Akses & Role Scoping

### 5.1 Matriks Hak Akses per Role

| Endpoint | Guru Reguler | Wali Kelas | Tim Kesiswaan | Waka Kurikulum | Siswa / Ortu |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /api/teacher-leave-requests` | Milik Sendiri | Milik Sendiri | Semua Guru | Semua Guru | Ditolak (403) |
| `GET /api/teacher-leave-requests/{id}` | Milik Sendiri | Milik Sendiri | Semua Guru | Semua Guru | Ditolak (403) |
| `POST /api/teacher-leave-requests` | Diizinkan | Diizinkan | Diizinkan | Ditolak (403)* | Ditolak (403) |
| `PATCH /api/teacher-leave-requests/{id}/approve` | Ditolak (403) | Ditolak (403) | Diizinkan | Diizinkan | Ditolak (403) |
| `PATCH /api/teacher-leave-requests/{id}/reject` | Ditolak (403) | Ditolak (403) | Diizinkan | Diizinkan | Ditolak (403) |

*\*Catatan:* `POST /api/teacher-leave-requests` hanya diakses oleh pengguna dengan role `teacher` (termasuk guru yang ditugaskan sebagai kesiswaan atau wali kelas). Akun struktural Waka Kurikulum murni tidak memiliki jadwal mengajar langsung dan bertindak sebagai pengelola/verifikator.

### 5.2 Pola Two-Tier Authorization (Route Middleware + Controller Guard)
Mengapa endpoint `approve` dan `reject` diletakkan di bawah `Route::middleware('role:vice_principal,teacher')` dan bukan hanya `role:vice_principal`?
- **Alasan Arsitektural SCP:** Akun Tim Kesiswaan di SCP memiliki role dasar `'teacher'` dengan catatan penugasan tambahan di tabel `teacher_assignments` bertipe `'kesiswaan'`.
- **Tingkat 1 (Route Level):** Memfilter agar hanya pengguna dengan akun Waka Kurikulum atau Guru yang dapat memicu request ke endpoint tersebut (menolak Siswa & Orang Tua langsung di route level).
- **Tingkat 2 (Controller Guard Level):** Di dalam method `approve()` dan `reject()`, sistem memeriksa hak khusus:
  ```php
  $isWaka = ($user->role === 'vice_principal');
  $isKesiswaan = ($user->role === 'teacher' && $user->isKesiswaan());

  if (!$isWaka && !$isKesiswaan) {
      return response()->json([
          'success' => false,
          'message' => 'Akses ditolak. Hanya Tim Kesiswaan atau Waka Kurikulum yang berhak memverifikasi perizinan guru.',
      ], 403);
  }
  ```
  Dengan mekanisme ini, guru biasa dan wali kelas otomatis terblokir dengan HTTP 403, sedangkan Guru Kesiswaan dan Waka Kurikulum dapat melanjutkan proses verifikasi.

---

## 6. Rancangan Penanganan Berkas & Storage (`storage/app/public/teacher_leaves`)

### 6.1 Struktur Direktori Penyimpanan
Berkas fisik disimpan pada disk `'public'` (merujuk ke folder `storage/app/public` yang terhubung via symlink ke `public/storage`):
```
storage/app/public/
└── teacher_leaves/
    ├── letters/       <-- Berkas surat keterangan dokter / izin (PDF/JPG/PNG)
    └── tasks/         <-- Berkas soal tugas / modul titipan guru (PDF/DOC/dll)
```

### 6.2 Konvensi Penanganan Berkas
1. **Hashing Otomatis Laravel:** Laravel `$request->file(...)->store('...', 'public')` secara otomatis menghasilkan nama berkas acak berkriptografi aman (misal: `teacher_leaves/letters/ab912f7c01a...pdf`), sehingga mencegah *file collision* atau eksploitasi *directory traversal*.
2. **Validasi Tipe Ekstensi & MIME:** Dibatasi hanya untuk format gambar dan dokumen standar (`jpg, jpeg, png, pdf`).
3. **Batas Ukuran:** Dibatasi maksimal 5120 KB (5 Megabytes).

---

## 7. Rancangan Rute API (`routes/api.php`)

Seluruh rute baru didaftarkan di dalam grup utama `Route::middleware(['auth:sanctum', 'throttle:api'])`.

```php
use App\Http\Controllers\API\TeacherLeaveRequestController;

// ...
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    // ... rute existing ...

    // 9.6b Perizinan Guru (Teacher Leave Requests - Tahap 3)
    Route::middleware('role:vice_principal,teacher')->group(function () {
        Route::get('/teacher-leave-requests', [TeacherLeaveRequestController::class, 'index']);
        Route::get('/teacher-leave-requests/{id}', [TeacherLeaveRequestController::class, 'show']);
        Route::patch('/teacher-leave-requests/{id}/approve', [TeacherLeaveRequestController::class, 'approve']);
        Route::patch('/teacher-leave-requests/{id}/reject', [TeacherLeaveRequestController::class, 'reject']);
    });

    Route::middleware('role:teacher')->group(function () {
        Route::post('/teacher-leave-requests', [TeacherLeaveRequestController::class, 'store']);
    });
});
```

### 7.1 Spesifikasi Rute

| HTTP Method | URI Path | Controller & Action | Middleware Role | Deskripsi |
|---|---|---|---|---|
| `GET` | `/api/teacher-leave-requests` | `TeacherLeaveRequestController@index` | `role:vice_principal,teacher` | List izin guru (ter-scoped) |
| `GET` | `/api/teacher-leave-requests/{id}` | `TeacherLeaveRequestController@show` | `role:vice_principal,teacher` | Detail perizinan guru |
| `POST` | `/api/teacher-leave-requests` | `TeacherLeaveRequestController@store` | `role:teacher` | Pengajuan izin baru oleh guru |
| `PATCH` | `/api/teacher-leave-requests/{id}/approve` | `TeacherLeaveRequestController@approve` | `role:vice_principal,teacher` | Menyetujui izin (Kesiswaan/Waka) |
| `PATCH` | `/api/teacher-leave-requests/{id}/reject` | `TeacherLeaveRequestController@reject` | `role:vice_principal,teacher` | Menolak izin (Kesiswaan/Waka) |

---

## 8. Daftar File yang Dibuat / Dimodifikasi

| No | Path Berkas | Status | Tanggung Jawab / Perubahan |
|:---:|---|:---:|---|
| 1 | `app/Http/Controllers/API/TeacherLeaveRequestController.php` | **Dibuat Baru** | Implementasi 5 method API: `index`, `show`, `store`, `approve`, `reject` beserta seluruh aturan validasi, scoping data, file storage, dan verifikasi status. |
| 2 | `routes/api.php` | **Dimodifikasi** | Mendaftarkan 5 endpoint perizinan guru di bawah grup middleware Sanctum dan role yang sesuai. |
| 3 | `tests/Feature/TeacherLeaveRequestTest.php` | **Dibuat Baru** | Test suite otomatis yang menguji seluruh fungsionalitas izin guru (15 skenario pengujian komprehensif). |

---

## 9. Urutan Pengerjaan Implementasi Bertahap

Untuk menjamin alur pengerjaan yang terstruktur dan aman, urutan eksekusi Tahap 3 direncanakan sebagai berikut:

```
[Langkah 1] Modifikasi routes/api.php
    └── Pendaftaran 5 rute izin guru dan import controller
            │
[Langkah 2] Pembuatan app/Http/Controllers/API/TeacherLeaveRequestController.php
    ├── Kerangka class & dependency injection
    ├── Implementasi store() (Validasi, Integritas Schedule, Duplikasi, File Upload)
    ├── Implementasi index() & show() (Scoping Guru vs Kesiswaan/Waka, Pagination)
    └── Implementasi approve() & reject() (Guard Kesiswaan/Waka, Status Lock)
            │
[Langkah 3] Pembuatan tests/Feature/TeacherLeaveRequestTest.php
    ├── Uji seluruh method store, index, show, approve, reject
    ├── Uji penolakan akses guru biasa pada approve/reject (403)
    ├── Uji penolakan pengajuan jadwal guru lain (422)
    └── Uji pencegahan duplikasi izin aktif di tanggal sama (422)
            │
[Langkah 4] Verifikasi Sintaks & Perintah Pengujian CLI
    ├── php -l app/Http/Controllers/API/TeacherLeaveRequestController.php
    ├── php artisan route:list --path=teacher-leave-requests
    ├── php artisan test --filter=TeacherLeaveRequestTest
    └── php artisan test (Zero-regression test: 260+ tests wajib 100% pass)
```

---

## 10. Analisis Risiko Keamanan, Integritas Data & Potensi Regresi

| No | Risiko Teknis | Dampak | Strategi Mitigasi / Penanganan |
|---|---|---|---|
| 1 | **Guru mengajukan izin untuk jadwal rekan guru lain** | Pelanggaran data jadwal & manipulasi absensi. | Validasi ketat di `store()`: sistem melakukan query ke tabel `schedules` untuk memastikan seluruh `id` di `schedule_ids` memiliki `teacher_id === auth()->id()`. Jika melanggar, gagalkan dengan HTTP 422. |
| 2 | **Guru biasa menyetujui izinnya sendiri atau rekannya** | Bypass hierarki persetujuan sekolah. | Controller guard ketat di `approve()` dan `reject()`: memeriksa `$user->role === 'vice_principal' || ($user->role === 'teacher' && $user->isKesiswaan())`. Guru biasa otomatis ditolak HTTP 403. |
| 3 | **Pengajuan ganda untuk tanggal yang sama** | Duplikasi data dan kebingungan tugas inval. | Pengecekan unik kombinasi `teacher_id + date` dengan status `pending` atau `approved`. Ditolak dengan pesan jelas via HTTP 422. |
| 4 | **Re-processing izin yang sudah diputus** | Data status tidak konsisten / race condition. | Pengecekan state lock: jika `status !== 'pending'`, proses dihentikan seketika dengan HTTP 422. |
| 5 | **Kebocoran data izin antar guru** | Pelanggaran privasi alasan sakit/pribadi guru. | Scoping otomatis di `index()` dan gate otorisasi di `show()`: Guru biasa hanya dapat melihat perizinan di mana `teacher_id === auth()->id()`. |
| 6 | **Upload berkas berbahaya (executable/script)** | Ancaman keamanan server. | Validasi ekstensi dan tipe MIME ketat (`jpg, jpeg, png, pdf`) serta pembatasan kapasitas maksimal 5MB. |

---

## 11. Rencana Verifikasi dan Perintah Pengujian CLI

### 11.1 Verifikasi Sintaks PHP
Memastikan tidak ada kesalahan sintaksis:
```bash
php -l app/Http/Controllers/API/TeacherLeaveRequestController.php
php -l routes/api.php
```

### 11.2 Verifikasi Pendaftaran Rute Laravel
Memastikan kelima endpoint terdaftar dengan URI, method, dan middleware yang tepat:
```bash
php artisan route:list --path=teacher-leave-requests
```
*Ekspektasi Output:*
- `GET api/teacher-leave-requests`
- `POST api/teacher-leave-requests`
- `GET api/teacher-leave-requests/{id}`
- `PATCH api/teacher-leave-requests/{id}/approve`
- `PATCH api/teacher-leave-requests/{id}/reject`

### 11.3 Eksekusi Test Suite Mandiri Tahap 3
Menjalankan pengujian spesifik untuk fitur perizinan guru:
```bash
php artisan test --filter=TeacherLeaveRequestTest
```
*Target:* Seluruh pengujian (15+ skenario) lulus (100% Passed).

### 11.4 Verifikasi Zero-Regression Keseluruhan
Menjalankan seluruh rangkaian tes backend SCP untuk menjamin bahwa modul perizinan siswa, modul jadwal, modul jurnal wali kelas, modul autentikasi, serta master data tetap bekerja 100% normal tanpa regresi:
```bash
php artisan test
```
*Target:* **260+ tests passed, 0 failures**.

---

## 12. Kriteria Keberhasilan (*Acceptance Criteria*)

Tahap 3 dinyatakan **Selesai dan Berhasil (Done)** apabila seluruh kriteria berikut terpenuhi secara objektif:

- [ ] **Endpoint Listing (`GET /api/teacher-leave-requests`)**:
  - [ ] Guru biasa hanya menerima riwayat pengajuan izin miliknya sendiri.
  - [ ] Tim Kesiswaan dan Waka Kurikulum dapat melihat pengajuan seluruh guru di sekolah.
  - [ ] Filter `status`, `date`, `start_date`, dan `end_date` berfungsi secara akurat.
  - [ ] Data dilengkapi pagination standar SCP dan eager loading guru pengaju serta verifikator.
- [ ] **Endpoint Detail (`GET /api/teacher-leave-requests/{id}`)**:
  - [ ] Guru pengaju dapat melihat detail izin miliknya (HTTP 200).
  - [ ] Tim Kesiswaan dan Waka Kurikulum dapat melihat detail izin guru manapun (HTTP 200).
  - [ ] Guru lain yang bukan pemilik izin ditolak dengan status HTTP 403.
- [ ] **Endpoint Pengajuan (`POST /api/teacher-leave-requests`)**:
  - [ ] Guru dapat mengajukan izin dengan mengisi tanggal, alasan, memilih jadwal yang ditinggalkan, mengunggah surat keterangan, instruksi tugas, dan file lampiran soal (HTTP 201).
  - [ ] Pengajuan yang menyertakan jadwal milik guru lain ditolak dengan respons HTTP 422.
  - [ ] Pengajuan kedua pada tanggal yang sama dengan izin aktif ditolak dengan HTTP 422.
  - [ ] Berkas surat keterangan tersimpan di `storage/app/public/teacher_leaves/letters`.
  - [ ] Berkas tugas titipan tersimpan di `storage/app/public/teacher_leaves/tasks`.
- [ ] **Endpoint Persetujuan (`PATCH /api/teacher-leave-requests/{id}/approve`)**:
  - [ ] Tim Kesiswaan atau Waka Kurikulum dapat menyetujui izin berstatus `pending` (HTTP 200).
  - [ ] Kolom `status` berubah menjadi `approved`, `approved_by` tercatat ID pengguna yang login, dan `verified_at` terisi timestamp waktu verifikasi.
  - [ ] Izin yang sudah disetujui/ditolak tidak dapat diproses ulang (HTTP 422).
  - [ ] Guru reguler atau wali kelas ditolak saat memanggil endpoint ini dengan status HTTP 403.
- [ ] **Endpoint Penolakan (`PATCH /api/teacher-leave-requests/{id}/reject`)**:
  - [ ] Tim Kesiswaan atau Waka Kurikulum dapat menolak izin berstatus `pending` (HTTP 200).
  - [ ] Kolom `status` berubah menjadi `rejected`, `approved_by` tercatat ID pengguna yang login, dan `verified_at` terisi timestamp waktu verifikasi.
  - [ ] Guru reguler atau wali kelas ditolak saat memanggil endpoint ini dengan status HTTP 403.
- [ ] **Uji Otomatis & Regresi**:
  - [ ] Berkas `tests/Feature/TeacherLeaveRequestTest.php` berhasil dibuat dan lulus 100%.
  - [ ] Seluruh rangkaian uji otomatis sistem (`php artisan test`) mempertahankan status **100% pass (Zero Regression)**.

---

## 13. Keputusan Teknis & Hal-Hal yang Membutuhkan Konfirmasi Pengguna

Sebelum implementasi kode dimulai, berikut adalah 2 catatan teknis yang telah dianalisis untuk memastikan kesepakatan bersama:

1. **Format Payload `schedule_ids` pada Form-Data:**
   Karena endpoint `store` mendukung pengunggahan file (`multipart/form-data`), frontend dapat mengirimkan `schedule_ids` dalam format array form standar (misal: `schedule_ids[] = 1`, `schedule_ids[] = 2`) ataupun JSON string yang di-*decode* otomatis. Validasi Laravel `'schedule_ids' => 'nullable|array'` mendukung format form-data array tersebut secara *native*. Kami merekomendasikan mendukung kedua variasi agar frontend leluasa.
2. **Tidak Adanya Kolom `rejection_note`:**
   Sesuai dengan rancangan skema basis data di Tahap 1 dan dokumen `SCP_MULTIKELAS_KESISWAAN_PLAN.md`, tabel `teacher_leave_requests` tidak memiliki kolom catatan penolakan (`rejection_note`). Verifikasi penolakan (`reject()`) mencatat status `rejected`, `approved_by`, dan `verified_at`. Apakah perlakuan ini sudah sesuai dengan ekspektasi Anda? *(Rekomendasi: Ya, ikuti skema Tahap 1 tanpa mengubah migrasi)*.
