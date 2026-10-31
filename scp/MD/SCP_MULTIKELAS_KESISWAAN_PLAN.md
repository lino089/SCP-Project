# Perencanaan Arsitektur & Implementasi: Ekstensi Multirole Guru (Wali Kelas & Tim Kesiswaan/BK)

Dokumen ini menyajikan analisis sistem, mitigasi risiko, rancangan alur, dan tahapan implementasi fitur **Wali Kelas**, **Tim Kesiswaan/BK**, serta **alur izin guru titip tugas** pada sistem School Class Progress (SCP).

---

## Daftar Isi

1. [Analisis Sistem](#1-analisis-sistem)
2. [Matriks Fitur & Cakupan Implementasi](#2-matriks-fitur--cakupan-implementasi)
3. [Dampak terhadap Fitur Existing](#3-dampak-terhadap-fitur-existing)
4. [Alur Kerja Fitur Baru & Integrasi](#4-alur-kerja-fitur-baru--integrasi)
5. [Kebutuhan Perubahan](#5-kebutuhan-perubahan)
6. [Risiko dan Antisipasi](#6-risiko-dan-antisipasi)
7. [Tahapan Implementasi](#7-tahapan-implementasi)
8. [Rencana Pengujian Otomatis](#8-rencana-pengujian-otomatis)

---

## 1. Analisis Sistem

### 1.1 Kondisi Existing (Terverifikasi dari Kode)

1. **Autentikasi & Autorisasi:**
   - Role utama pada tabel `users`: `vice_principal`, `teacher`, `student`, `parent`.
   - Tabel `teacher_assignments` sudah memiliki skema: `user_id`, `type` (enum: `kesiswaan`, `wali_kelas`), `class_id` (nullable).
   - Model `User` sudah memiliki helper method: `isKesiswaan()`, `isWaliKelas(?int $classId)`, dan `hasAssignment(string $type)`.
   - `AssignmentMiddleware` memvalidasi kepemilikan penugasan guru (`kesiswaan` / `wali_kelas`) namun tidak membatasi `class_id` di level request parameter secara granular.

2. **Jurnal & Presensi (`journals`, `attendances`):**
   - Tabel `journals` **sudah memiliki** kolom `substitute_teacher_id` (FK nullable ke `users.id`) — **tidak perlu ditambahkan**.
   - `JournalController::store()` sudah mengizinkan `isKesiswaan()` sebagai guru pengganti (skenario inval/piket).
   - Namun akses wali kelas ke jurnal **diblokir keras** di `store()` dan `update()`.

3. **Perizinan Siswa (`leave_requests`):**
   - `LeaveRequestController` sudah menerapkan role-scoping: Kesiswaan melihat semua, Wali Kelas hanya kelas binaannya, Siswa/Ortu hanya miliknya.
   - Verifikasi (approve/reject) izin siswa hanya bisa dilakukan oleh Kesiswaan atau Waka.

4. **Presensi (`attendances`):**
   - `AttendanceController` sudah menerapkan role-scoping yang sama dengan perizinan.
   - Wali Kelas sudah otomatis dibatasi pada `class_id` yang diampu.

5. **Jadwal (`schedules`):**
   - `ScheduleController::index()` scope role `teacher` hanya menampilkan jadwal di mana guru tersebut adalah `teacher_id`. Tidak ada scope tambahan untuk wali kelas.

6. **Izin Guru:**
   - Belum ada tabel, model, maupun controller untuk perizinan guru (`teacher_leave_requests`). Ini adalah **gap utama** yang seluruhnya perlu dibangun dari nol.

### 1.2 Bagian Sistem yang Perlu Disesuaikan / Ditambahkan

| No | Komponen | Status | Aksi |
|---|---|:---:|---|
| 1 | `teacher_leave_requests` (tabel, model, controller) | ❌ Belum ada | **Buat baru** |
| 2 | Scope jadwal untuk Wali Kelas (kelas binaan) | ❌ Belum ada | **Tambahkan** ke `ScheduleController` |
| 3 | Akses input jurnal untuk Wali Kelas (kelas binaan) | ❌ Belum ada | **Tambahkan** ke `JournalController` |
| 4 | Scope jurnal untuk Wali Kelas (view kelas binaan) | ❌ Belum ada | **Tambahkan** ke `JournalController::index()` |
| 5 | `AssignmentMiddleware` granularity class_id | ⚠️ Perlu sempurnakan | **Modifikasi** untuk parameter scope opsional |
| 6 | Scope presensi Wali Kelas | ✅ Sudah ada | Tidak perlu diubah |
| 7 | Scope izin siswa Wali Kelas | ✅ Sudah ada | Tidak perlu diubah |
| 8 | Input jurnal pengganti oleh Kesiswaan | ✅ Sudah ada | Tidak perlu diubah |
| 9 | Laporan presensi global Kesiswaan | ✅ Sudah ada | Tidak perlu diubah |

---

## 2. Matriks Fitur & Cakupan Implementasi

Tabel berikut merinci seluruh fitur yang diminta beserta strategi implementasinya.

### 2.1 Fitur Wali Kelas

| # | Fitur | Endpoint | Strategi | Status Awal |
|---|---|---|---|:---:|
| WK-1 | Presensi/verifikasi izin siswa kelas binaan | `GET /api/leave-requests` + `PATCH /api/leave-requests/{id}` | Role-scoping sudah ada di controller. Wali kelas hanya bisa lihat kelas binaannya; verifikasi approve/reject diserahkan ke Kesiswaan/Waka. Wali Kelas **hanya read** izin siswa. | ✅ Ada |
| WK-2 | Lihat laporan presensi kelas binaan | `GET /api/attendances` | Role-scoping sudah ada. Auto-filter ke `class_id` yang diampu. | ✅ Ada |
| WK-3 | Input jurnal kelas binaan | `POST /api/journals` + `PUT /api/journals/{id}` | **Baru.** Wali kelas dapat membuka sesi KBM dan mengisi jurnal **hanya** untuk kelas yang ia ampu sebagai wali kelas, tanpa harus menjadi `teacher_id` pada jadwal tersebut. `substitute_teacher_id` diisi dengan `id` wali kelas. | ❌ Perlu |
| WK-4 | Lihat daftar jurnal kelas binaan | `GET /api/journals` + `GET /api/journals/{id}` | **Baru.** Tambahkan scope wali kelas ke `JournalController::index()` dan `show()` agar bisa melihat jurnal seluruh mapel di kelas binaannya. | ❌ Perlu |
| WK-5 | Lihat jadwal mengajar (jadwal pribadinya) | `GET /api/schedules` | Sudah berjalan: semua guru melihat jadwal di mana mereka adalah `teacher_id`. | ✅ Ada |
| WK-6 | Lihat jadwal seluruh kelas binaan | `GET /api/schedules?class_id={id}` | **Baru.** Tambahkan scope wali kelas ke `ScheduleController::index()`: bisa melihat jadwal kelas binaannya tanpa filter `teacher_id`. | ❌ Perlu |
| WK-7 | Mengajukan izin tidak mengajar + titip tugas | `POST /api/teacher-leave-requests` | **Baru.** Wali kelas yang juga mengampu jadwal dapat mengajukan izin dan mendelegasikan tugas ke Tim Kesiswaan. | ❌ Perlu |
| WK-8 | Melihat status izin yang diajukan | `GET /api/teacher-leave-requests` | **Baru.** Guru (termasuk wali kelas) dapat melihat riwayat izin yang pernah diajukan. | ❌ Perlu |

### 2.2 Fitur Guru BK / Kesiswaan

| # | Fitur | Endpoint | Strategi | Status Awal |
|---|---|---|---|:---:|
| BK-1 | Laporan presensi seluruh siswa | `GET /api/attendances` | Sudah berjalan. Scope `isKesiswaan()` membuka akses global tanpa filter kelas. | ✅ Ada |
| BK-2 | Verifikasi izin siswa seluruh sekolah | `GET /api/leave-requests` + `PATCH /api/leave-requests/{id}` | Sudah berjalan. Kesiswaan dapat approve/reject semua pengajuan izin siswa. | ✅ Ada |
| BK-3 | Input jurnal pengganti (inval) | `POST /api/journals` + `PUT /api/journals/{id}` | Sudah berjalan. `isKesiswaan()` dapat membuka dan menyelesaikan jurnal sebagai `substitute_teacher_id`. | ✅ Ada |
| BK-4 | Verifikasi & kelola izin guru | `GET /api/teacher-leave-requests` + `PATCH /api/teacher-leave-requests/{id}/approve` | **Baru.** Kesiswaan menerima daftar izin guru masuk, dapat approve/reject beserta tugas delegasi. | ❌ Perlu |

### 2.3 Fitur Guru Mengajar

| # | Fitur | Endpoint | Strategi | Status Awal |
|---|---|---|---|:---:|
| GM-1 | Lihat jadwal mengajar | `GET /api/schedules` | Sudah berjalan. Auto-scope ke `teacher_id` milik guru. | ✅ Ada |
| GM-2 | Input jurnal | `POST /api/journals` + `PUT /api/journals/{id}` | Sudah berjalan. Guru pengampu jadwal bisa buka dan selesaikan jurnal. | ✅ Ada |
| GM-3 | Mengajukan izin tidak mengajar | `POST /api/teacher-leave-requests` | **Baru.** Guru input izin + alasan + surat keterangan untuk satu atau lebih sesi jadwal. | ❌ Perlu |
| GM-4 | Mengunggah tugas titipan (saat izin) | `POST /api/teacher-leave-requests` | **Baru.** Dalam satu payload izin, guru dapat menyertakan instruksi tugas dan lampiran file untuk siswa. | ❌ Perlu |
| GM-5 | Melihat status izin yang diajukan | `GET /api/teacher-leave-requests` | **Baru.** Guru dapat memantau status `pending/approved/rejected` izin yang sudah diajukan. | ❌ Perlu |

---

## 3. Dampak terhadap Fitur Existing

| # | Komponen Terdampak | Dampak | Mitigasi |
|---|---|---|---|
| 1 | **`JournalController::store()`** | Penambahan akses Wali Kelas. Validasi kepemilikan jadwal menjadi lebih kompleks. | Tambahkan cabang `isWaliKelas($schedule->class_id)` setelah pengecekan `isOriginalTeacher`. Wali Kelas hanya diizinkan membuka sesi untuk kelas binaannya, dan dicatat sebagai `substitute_teacher_id`. |
| 2 | **`JournalController::update()`** | Penambahan akses Wali Kelas yang sudah membuka jurnal. | `$isAuthorizedSubstitute` harus mencakup wali kelas yang tercatat sebagai `substitute_teacher_id`, bukan hanya kesiswaan. |
| 3 | **`JournalController::index()` & `show()`** | Wali Kelas perlu bisa melihat jurnal kelas binaannya. | Tambahkan scope `isWaliKelas()` di query, sejajar dengan scope guru. |
| 4 | **`ScheduleController::index()`** | Wali Kelas perlu bisa lihat seluruh jadwal kelas binaannya. | Tambahkan cabang: jika `isWaliKelas()` dan ada `class_id` request yang termasuk kelas binaannya, hapus filter `teacher_id` untuk query tersebut. |
| 5 | **`LeaveRequestController::update()`** | Wali Kelas saat ini tidak bisa approve izin siswa. | Kebijakan dipertahankan: verifikasi (approve/reject) izin siswa tetap eksklusif untuk Kesiswaan dan Waka. Wali Kelas hanya bisa **read**. |
| 6 | **`AttendanceController::index()`** | Tidak ada perubahan perilaku. | Tidak perlu dimodifikasi. |
| 7 | **Stabilitas Envelope Response** | Endpoint baru wajib menggunakan envelope standar. | Seluruh endpoint baru mengikuti format `{ success, message, data, meta?, errors? }`. |

---

## 4. Alur Kerja Fitur Baru & Integrasi

### 4.1 Alur Utama: Izin Guru & Delegasi Tugas

```
[Guru Pengampu / Wali Kelas]
       │
       ├─ (1) POST /teacher-leave-requests
       │       └── Isi: tanggal, schedule_id(s), alasan, surat, instruksi tugas, file tugas
       │
       ▼
[teacher_leave_requests] ── status: pending
       │
       ▼
[Tim Kesiswaan / BK]
       ├─ (2) GET /teacher-leave-requests         (lihat daftar izin masuk)
       ├─ (3) PATCH /{id}/approve OR /reject      (verifikasi izin)
       │
       ▼ (jika approved)
[schedules + journals]
       ├─ (4) Jadwal hari-H ditandai: guru tidak hadir
       ├─ (5) Kesiswaan buka sesi KBM pengganti:
       │       POST /journals { schedule_id, status: ongoing } → as substitute_teacher_id
       ├─ (6) Kesiswaan selesaikan jurnal:
       │       PUT /journals/{id} { topic_description, photo, exceptions }
       │
       ▼
[Rekap Presensi & Laporan]
       ├─ Wali Kelas  : GET /attendances?class_id={id}  (auto-scope kelas binaan)
       └─ Kesiswaan   : GET /attendances                (scope seluruh sekolah)
```

### 4.2 Alur Wali Kelas — Kelola Kelas Binaan

```
[Wali Kelas]
       │
       ├─ Lihat jadwal kelas binaan:
       │   GET /schedules?class_id={id_kelas_binaan}
       │   → ScheduleController membuka akses jika class_id ∈ kelas binaan wali kelas
       │
       ├─ Lihat & pantau jurnal kelas binaan:
       │   GET /journals?class_id={id_kelas_binaan}
       │   → JournalController scope: tampilkan jurnal kelas binaan
       │
       ├─ Input jurnal (jika ada kelas kosong / piket wali kelas):
       │   POST /journals { schedule_id }
       │   → Diizinkan jika schedule.class_id ∈ kelas binaan wali kelas
       │   → substitute_teacher_id = wali_kelas.id
       │   PUT  /journals/{id} { topic_description, photo, exceptions }
       │
       ├─ Pantau izin siswa kelas binaan:
       │   GET /leave-requests  (auto-scope ke kelas binaan)
       │   GET /leave-requests/{id}
       │   (verifikasi approve/reject tetap di Kesiswaan/Waka)
       │
       ├─ Lihat laporan presensi kelas binaan:
       │   GET /attendances  (auto-scope ke kelas binaan)
       │
       └─ Ajukan izin mengajar (jika wali kelas juga mengajar):
           POST /teacher-leave-requests
           GET  /teacher-leave-requests  (lihat status izin miliknya)
```

### 4.3 Alur Guru Mengajar — Izin & Titip Tugas

```
[Guru Mengajar]
       │
       ├─ (1) Ajukan izin:
       │   POST /teacher-leave-requests
       │   Body: { schedule_ids[], date, reason, attachment, task_instruction, task_attachment }
       │
       ├─ (2) Pantau status izin:
       │   GET /teacher-leave-requests  (hanya izin miliknya)
       │
       └─ (3) Setelah approved:
           → Jadwal hari-H akan ditangani oleh Tim Kesiswaan (alur 4.1 step 4–6)
           → Guru pengampu tidak dituntut mengisi jurnal secara mandiri untuk sesi tersebut
```

---

## 5. Kebutuhan Perubahan

### 5.1 Database & Migrasi

#### 5.1.1 Tabel Baru: `teacher_leave_requests`

```
id                  : Primary key (auto-increment)
teacher_id          : FK → users.id (guru yang mengajukan)
schedule_ids        : JSON (array schedule_id yang ditinggalkan, nullable)
date                : Date (tanggal izin)
reason              : Text (alasan tidak hadir)
attachment_path     : String, nullable (surat dokter / keterangan)
task_instruction    : Text, nullable (instruksi tugas titipan untuk siswa)
task_attachment_path: String, nullable (file tugas, misal PDF soal)
status              : Enum ['pending', 'approved', 'rejected'], default: 'pending'
approved_by         : FK → users.id, nullable (Kesiswaan/Waka yang memverifikasi)
verified_at         : Timestamp, nullable
timestamps          : created_at, updated_at
```

**Index yang diperlukan:**
- `INDEX(teacher_id, status)`
- `INDEX(date)`

#### 5.1.2 Tabel `journals` — Tidak Perlu Perubahan Skema

- Kolom `substitute_teacher_id` **sudah ada** sejak migration awal.
- Kolom `is_substitute` (boolean) **tidak diperlukan** — keberadaan nilai `substitute_teacher_id` sudah menjadi penanda yang cukup.

### 5.2 Model Baru & Modifikasi Model

#### 5.2.1 Model Baru: `TeacherLeaveRequest`

```php
// app/Models/TeacherLeaveRequest.php
protected $fillable = [
    'teacher_id', 'schedule_ids', 'date', 'reason',
    'attachment_path', 'task_instruction', 'task_attachment_path',
    'status', 'approved_by', 'verified_at',
];

protected $casts = [
    'schedule_ids' => 'array',
    'verified_at'  => 'datetime',
    'date'         => 'date:Y-m-d',
];

// Relasi:
public function teacher(): BelongsTo        // → User (teacher_id)
public function approvedBy(): BelongsTo     // → User (approved_by)
```

#### 5.2.2 Modifikasi Model `User`

Tambahkan relasi berikut:

```php
// Izin mengajar yang pernah diajukan oleh guru ini
public function teacherLeaveRequests(): HasMany
{
    return $this->hasMany(TeacherLeaveRequest::class, 'teacher_id');
}
```

#### 5.2.3 Helper Method Tambahan pada Model `User`

Tambahkan helper untuk mendukung otorisasi granular yang bersih:

```php
/**
 * Mengembalikan array class_id yang diampu sebagai wali kelas.
 */
public function homeroomClassIds(): array
{
    return $this->assignments()
        ->where('type', 'wali_kelas')
        ->pluck('class_id')
        ->filter()
        ->values()
        ->toArray();
}
```

### 5.3 Controller Baru & Modifikasi Controller

#### 5.3.1 Controller Baru: `TeacherLeaveRequestController`

| Method | Route | Akses | Deskripsi |
|---|---|---|---|
| `index()` | `GET /api/teacher-leave-requests` | Guru (izin miliknya), Kesiswaan, Waka | List izin guru dengan scoping role |
| `show()` | `GET /api/teacher-leave-requests/{id}` | Guru pemilik, Kesiswaan, Waka | Detail satu izin guru |
| `store()` | `POST /api/teacher-leave-requests` | Guru (semua, termasuk wali kelas) | Ajukan izin + lampiran + titip tugas |
| `approve()` | `PATCH /api/teacher-leave-requests/{id}/approve` | Kesiswaan, Waka | Setujui izin |
| `reject()` | `PATCH /api/teacher-leave-requests/{id}/reject` | Kesiswaan, Waka | Tolak izin |

**Logika `index()` (Role Scoping):**
- `vice_principal` atau `isKesiswaan()`: Lihat semua izin guru, dapat filter `?teacher_id=`, `?date=`, `?status=`
- Role `teacher` lainnya: Hanya melihat izin yang `teacher_id = auth()->id()`

**Logika `store()` (Validasi):**
```
Validasi:
  date             : required|date
  reason           : required|string|min:5
  schedule_ids     : nullable|array
  schedule_ids.*   : integer|exists:schedules,id (setiap id harus milik guru yang bersangkutan)
  attachment       : nullable|file|mimes:jpg,jpeg,png,pdf|max:5120
  task_instruction : nullable|string
  task_attachment  : nullable|file|mimes:jpg,jpeg,png,pdf|max:5120

Aturan Bisnis:
  - schedule_ids yang dikirim wajib merupakan jadwal yang teacher_id-nya = auth()->id()
  - Satu tanggal + schedule_id yang sama tidak boleh duplikat (cek izin pending/approved di tanggal sama)
```

#### 5.3.2 Modifikasi `JournalController`

**`index()` — Tambahkan scope Wali Kelas:**
```
Sebelum: Guru biasa hanya lihat jurnal di mana dia teacher atau substitute.
Sesudah: Wali Kelas juga melihat seluruh jurnal kelas binaannya.

Tambahkan kondisi setelah pengecekan $isWaka/$isKesiswaan:
  elseif ($user->isWaliKelas()) {
      $waliClassIds = $user->homeroomClassIds();
      // Tampilkan jurnal dari jadwal kelas binaan ATAU jurnal di mana dia adalah substitute
      $query->where(function ($q) use ($user, $waliClassIds) {
          $q->whereHas('schedule', fn ($sq) => $sq->whereIn('class_id', $waliClassIds))
            ->orWhere('substitute_teacher_id', $user->id);
      });
  }
```

**`show()` — Tambahkan akses Wali Kelas:**
```
Tambahkan variabel:
  $isWaliKelasOfClass = $user->isWaliKelas($journal->schedule->class_id);

Tambahkan ke kondisi otorisasi:
  if (!$isWaka && !$isKesiswaan && !$isOriginalTeacher && !$isSubstitute
      && !$isWaliKelasOfClass && !$isStudentInClass && !$isParentOfClass) {
      // return 403
  }
```

**`store()` — Tambahkan akses Wali Kelas (membuka sesi KBM):**
```
Aturan Bisnis Wali Kelas:
  - Hanya diizinkan untuk schedule yang class_id-nya ∈ kelas binaannya
  - Tidak diizinkan menandai status 'teacher_absent' (hanya Kesiswaan/Waka)
  - Wali Kelas dicatat sebagai substitute_teacher_id

Tambahkan kondisi baru:
  $isWaliKelasOfClass = ($user->role === 'teacher'
      && $user->isWaliKelas($schedule->class_id));

Modifikasi gate otorisasi:
  if (!$isOriginalTeacher && !$isKesiswaan && !$isWaka && !$isWaliKelasOfClass) {
      return 403;
  }

  // Blokir wali kelas dari aksi teacher_absent
  if ($request->input('status') === 'teacher_absent' && $isWaliKelasOfClass
      && !$isKesiswaan && !$isWaka) {
      return 403;
  }

  // Tentukan substitute_teacher_id
  $substituteTeacherId = (!$isOriginalTeacher && ($isKesiswaan || $isWaliKelasOfClass))
      ? $user->id
      : null;
```

**`update()` — Tambahkan akses Wali Kelas (menyelesaikan jurnal):**
```
Modifikasi $isAuthorizedSubstitute:
  $isAuthorizedSubstitute = ($journal->substitute_teacher_id === $user->id)
      && ($user->isKesiswaan() || $user->isWaliKelas($journal->schedule->class_id));
```

#### 5.3.3 Modifikasi `ScheduleController`

**`index()` — Tambahkan scope Wali Kelas:**
```
Kondisi existing untuk role 'teacher':
  $query->where('teacher_id', $user->id);

Diubah menjadi:
  if ($user->isWaliKelas() && $request->filled('class_id')
      && in_array($request->integer('class_id'), $user->homeroomClassIds())) {
      // Wali Kelas melihat seluruh jadwal kelas binaannya (semua guru di kelas itu)
      $query->where('class_id', $request->integer('class_id'));
  } else {
      // Guru reguler tetap hanya lihat jadwal miliknya
      $query->where('teacher_id', $user->id);
  }
```

### 5.4 Routes Baru

Semua route baru diletakkan di dalam grup `middleware(['auth:sanctum', 'throttle:api'])`.

```php
// Teacher Leave Requests (Izin Guru)
// Guru (semua termasuk Wali Kelas) dapat mengajukan dan melihat izin miliknya
Route::middleware('role:teacher,vice_principal')->group(function () {
    Route::get('/teacher-leave-requests',          [TeacherLeaveRequestController::class, 'index']);
    Route::get('/teacher-leave-requests/{id}',     [TeacherLeaveRequestController::class, 'show']);
});

Route::middleware('role:teacher')->group(function () {
    Route::post('/teacher-leave-requests',         [TeacherLeaveRequestController::class, 'store']);
});

// Verifikasi izin guru: hanya Kesiswaan dan Waka
Route::middleware('role:vice_principal,teacher')->group(function () {
    Route::patch('/teacher-leave-requests/{id}/approve', [TeacherLeaveRequestController::class, 'approve']);
    Route::patch('/teacher-leave-requests/{id}/reject',  [TeacherLeaveRequestController::class, 'reject']);
    // Catatan: otorisasi granular approve/reject (hanya kesiswaan/waka) divalidasi di dalam controller
});
```

---

## 6. Risiko dan Antisipasi

| No | Risiko Potensial | Dampak Teknis | Strategi Pencegahan / Solusi |
| :--- | :--- | :--- | :--- |
| 1 | **Wali Kelas membuka jurnal kelas yang bukan binaannya** | Akses tidak sah ke data kelas lain. | Validasi ketat di `JournalController::store()`: `schedule->class_id` harus ada di `$user->homeroomClassIds()` sebelum diizinkan. |
| 2 | **Wali Kelas melihat jadwal kelas lain** | Kebocoran data jadwal. | Scope `ScheduleController::index()` untuk wali kelas hanya berlaku jika `class_id` yang diminta ada di `homeroomClassIds()`. Jika tidak, fallback ke scope `teacher_id`. |
| 3 | **Guru mengajukan izin untuk schedule milik guru lain** | Izin tidak sah / pemalsuan data. | Validasi di `TeacherLeaveRequestController::store()`: setiap `schedule_id` dalam array `schedule_ids` diperiksa bahwa `schedules.teacher_id = auth()->id()`. |
| 4 | **Duplikasi izin untuk jadwal yang sama** | Data ganda, konflik status. | Pengecekan `unique` pada kombinasi `teacher_id + schedule_id + date` dengan status `pending` atau `approved` sebelum menyimpan izin baru. |
| 5 | **Konflik kepemilikan jurnal** | Guru pengganti ditolak validasi existing. | `JournalController::update()` memeriksa `substitute_teacher_id === auth()->id()` terlebih dahulu sebelum menolak akses, tidak hanya mengecek `original teacher`. |
| 6 | **Multirole tidak sinkron** | Guru sekaligus Wali Kelas dan Kesiswaan mengalami tumpang tindih otorisasi. | Evaluasi berbasis helper method Eloquent (`isKesiswaan()`, `isWaliKelas($classId)`, `homeroomClassIds()`) yang bebas dari branching role statis. Kesiswaan selalu menang jika ada konflik scope. |
| 7 | **Wali Kelas meng-approve izin siswa** | Pelanggaran kebijakan, bypass kesiswaan. | `LeaveRequestController::update()` tidak diubah — approve/reject tetap eksklusif untuk Kesiswaan dan Waka saja. |

---

## 7. Tahapan Implementasi

Pelaksanaan penambahan fitur ini dibagi secara ketat ke dalam **4 Tahap Berurutan**, di mana setiap tahap memiliki target berkas yang dibuat/dimodifikasi, detail kode & algoritma, langkah eksekusi CLI, serta kriteria penerimaan (*Acceptance Criteria*).

```
[Tahap 1: Skema Data & Helper Model]
   ├── Migrasi Tabel `teacher_leave_requests`
   ├── Model `TeacherLeaveRequest`
   └── Relasi & Helper `User::homeroomClassIds()`
            │
[Tahap 2: Perluasan Akses Wali Kelas pada Controller Existing]
   ├── Modifikasi `JournalController` (index, show, store, update)
   └── Modifikasi `ScheduleController` (index scope kelas binaan)
            │
[Tahap 3: Controller & Endpoint Izin Guru (TeacherLeaveRequestController)]
   ├── Controller `TeacherLeaveRequestController` (store, index, show, approve, reject)
   ├── Penanganan Upload Berkas Surat & Tugas Titipan
   └── Registrasi Rute API Baru di `routes/api.php`
            │
[Tahap 4: Pengujian Otomatis Komprehensif & Verifikasi Zero-Regression]
   ├── Test Suite `WaliKelasAccessTest.php` (10 Skenario)
   ├── Test Suite `TeacherLeaveRequestTest.php` (11 Skenario)
   ├── Test Suite `CounselorAccessTest.php` (6 Skenario)
   └── Eksekusi Seluruh Test Suite Proyek (`php artisan test`)
```

---

### Tahap 1 — Skema Data & Helper Model

**Tujuan Tahap 1:** Membangun fondasi persistensi basis data untuk perizinan guru serta menyediakan helper model yang efisien untuk validasi multirole di layer controller.

#### 1.1 Berkas yang Dibuat / Dimodifikasi:
1. `database/migrations/2026_10_31_000001_create_teacher_leave_requests_table.php` (Dibuat)
2. `app/Models/TeacherLeaveRequest.php` (Dibuat)
3. `app/Models/User.php` (Dimodifikasi)

#### 1.2 Detail Pengerjaan:

##### A. Pembuatan Migrasi `teacher_leave_requests`
- Membuat berkas migrasi baru:
  ```php
  Schema::create('teacher_leave_requests', function (Blueprint $table) {
      $table->id();
      $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
      $table->json('schedule_ids')->nullable(); // Menampung array ID jadwal sesi terkait
      $table->date('date');
      $table->text('reason');
      $table->string('attachment_path')->nullable(); // Bukti surat izin/sakit
      $table->text('task_instruction')->nullable(); // Instruksi tugas titipan siswa
      $table->string('task_attachment_path')->nullable(); // Berkas lampiran tugas siswa (PDF/Doc)
      $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
      $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
      $table->timestamp('verified_at')->nullable();
      $table->timestamps();

      $table->index(['teacher_id', 'status']);
      $table->index('date');
  });
  ```
- **Karakteristik Kunci**:
  - `teacher_id` berelasi dengan tabel `users` dengan aksi `cascadeOnDelete`.
  - `schedule_ids` disimpan sebagai format `JSON` yang menampung daftar satu atau beberapa ID jadwal yang berhalangan diampu pada hari tersebut. Jika guru izin harian penuh tanpa spesifikasi sesi, kolom ini bernilai `null`.
  - `approved_by` bertipe nullable dengan aksi `nullOnDelete` agar riwayat izin tetap aman jika akun verifikator dihapus.

##### B. Pembuatan Model `TeacherLeaveRequest`
- Lokasi: `app/Models/TeacherLeaveRequest.php`
- Mendaftarkan atribut `$fillable`:
  `['teacher_id', 'schedule_ids', 'date', 'reason', 'attachment_path', 'task_instruction', 'task_attachment_path', 'status', 'approved_by', 'verified_at']`.
- Mendaftarkan `$casts`:
  - `'schedule_ids' => 'array'`
  - `'date' => 'date:Y-m-d'`
  - `'verified_at' => 'datetime'`
- Mendefinisikan relasi Eloquent:
  - `public function teacher(): BelongsTo` -> Menautkan ke `User::class, 'teacher_id'`
  - `public function approvedBy(): BelongsTo` -> Menautkan ke `User::class, 'approved_by'`

##### C. Pembaruan Model `User`
- Lokasi: `app/Models/User.php`
- Menambahkan relasi perizinan guru:
  ```php
  public function teacherLeaveRequests(): HasMany
  {
      return $this->hasMany(TeacherLeaveRequest::class, 'teacher_id');
  }
  ```
- Menambahkan helper method untuk mengekstrak seluruh `class_id` yang dibina sebagai wali kelas:
  ```php
  public function homeroomClassIds(): array
  {
      return $this->assignments()
          ->where('type', 'wali_kelas')
          ->pluck('class_id')
          ->filter()
          ->values()
          ->toArray();
  }
  ```

#### 1.3 Verifikasi CLI Tahap 1:
- Eksekusi migrasi: `php artisan migrate`
- Verifikasi via Tinker:
  `php artisan tinker --execute="var_dump(Schema::hasTable('teacher_leave_requests'));"`
  *(Ekspektasi: `bool(true)`)*

#### 1.4 Kriteria Keberhasilan (Acceptance Criteria) Tahap 1:
- [ ] Tabel `teacher_leave_requests` terbentuk di basis data dengan indeks dan tipe kolom yang presisi.
- [ ] Model `TeacherLeaveRequest` dapat diinstansiasi dan mendukung casting otomatis `schedule_ids` menjadi array PHP.
- [ ] Pemanggilan `$user->homeroomClassIds()` mengembalikan array integer ID kelas binaan guru yang bersangkutan.

---

### Tahap 2 — Perluasan Akses Wali Kelas pada Controller Existing

**Tujuan Tahap 2:** Memberikan hak akses operasional kepada Wali Kelas untuk mengawasi jadwal kelas binaan, memantau riwayat jurnal, membuka sesi jurnal darurat, dan menyelesaikan jurnal KBM kelas binaannya tanpa merusak proteksi guru mapel reguler.

#### 2.1 Berkas yang Dimodifikasi:
1. `app/Http/Controllers/API/JournalController.php`
2. `app/Http/Controllers/API/ScheduleController.php`

#### 2.2 Detail Pengerjaan:

##### A. Modifikasi `JournalController.php`
1. **Method `index(Request $request)` (Listing Jurnal Ter-scoped):**
   - Mendeteksi apakah pengguna berstatus Wali Kelas via `$user->isWaliKelas()`.
   - Jika pengguna adalah Wali Kelas (dan bukan Waka/Kesiswaan), buka query agar menampilkan:
     - Jurnal dari jadwal yang `class_id`-nya ada dalam `$user->homeroomClassIds()`.
     - Jurnal dari jadwal di mana pengguna adalah `teacher_id` aslinya.
     - Jurnal di mana pengguna bertindak sebagai `substitute_teacher_id`.
   - Kode modifikasi:
     ```php
     elseif ($user->isWaliKelas()) {
         $waliClassIds = $user->homeroomClassIds();
         $query->where(function ($q) use ($user, $waliClassIds) {
             $q->whereHas('schedule', fn ($sq) => $sq->whereIn('class_id', $waliClassIds))
               ->orWhere('substitute_teacher_id', $user->id)
               ->orWhereHas('schedule', fn ($sq) => $sq->where('teacher_id', $user->id));
         });
     }
     ```
2. **Method `show(Request $request, $id)` (Detail Jurnal):**
   - Menambahkan evaluasi `$isWaliKelasOfClass = $user->isWaliKelas($journal->schedule->class_id);`.
   - Menyertakan variabel `$isWaliKelasOfClass` ke dalam gerbang otorisasi. Jika terpenuhi, berikan respons 200 OK detail jurnal beserta daftar kehadiran siswa.
3. **Method `store(Request $request)` (Membuka Sesi Jurnal):**
   - Evaluasi apakah pengguna adalah wali kelas dari kelas jadwal tersebut:
     `$isWaliKelasOfClass = ($user->role === 'teacher' && $user->isWaliKelas($schedule->class_id));`
   - Pada gerbang otorisasi: Izinkan jika `$isOriginalTeacher || $isKesiswaan || $isWaka || $isWaliKelasOfClass`. Selain itu tolak dengan HTTP 403.
   - **Proteksi Khusus**: Wali kelas **dilarang** menandai status `teacher_absent`. Jika status `teacher_absent` diminta oleh pengguna yang hanya wali kelas (bukan kesiswaan/waka), kembalikan HTTP 403: *"Hanya Guru Kesiswaan atau Waka Kurikulum yang berhak menandai status guru berhalangan hadir."*
   - Penentuan guru pengganti: Jika dibuka oleh wali kelas yang bukan guru pengampu aslinya, tetapkan `$substituteTeacherId = $user->id`.
4. **Method `update(Request $request, $id)` (Menyelesaikan Jurnal & Presensi):**
   - Perbarui definisi `$isAuthorizedSubstitute`:
     `$isAuthorizedSubstitute = ($journal->substitute_teacher_id === $user->id) && ($user->isKesiswaan() || $user->isWaliKelas($journal->schedule->class_id));`
   - Memastikan wali kelas yang telah membuka jurnal kelas binaannya dapat mengunggah dokumentasi foto KBM, menulis deskripsi materi, dan menyelesaikan absensi siswa exception-based.

##### B. Modifikasi `ScheduleController.php`
1. **Method `index(Request $request)` (Listing Jadwal):**
   - Pada bagian scoping role `teacher`:
     - Periksa apakah parameter `class_id` dikirimkan dalam request dan termasuk kelas binaan guru:
       `if ($user->isWaliKelas() && $request->filled('class_id') && in_array($request->integer('class_id'), $user->homeroomClassIds()))`
     - Jika ya, terapkan filter `$query->where('class_id', $request->integer('class_id'));` tanpa mengunci `teacher_id` ke user login. Dengan demikian, Wali Kelas dapat melihat jadwal seluruh guru/mata pelajaran di kelas yang diampunya.
     - Jika request `class_id` kosong atau di luar kelas binaannya, pertahankan perilaku standar: `$query->where('teacher_id', $user->id);` (hanya jadwal mengajar pribadi).

#### 2.3 Verifikasi CLI Tahap 2:
- Memastikan tidak ada syntax error pada controller yang diedit:
  `php -l app/Http/Controllers/API/JournalController.php`
  `php -l app/Http/Controllers/API/ScheduleController.php`

#### 2.4 Kriteria Keberhasilan (Acceptance Criteria) Tahap 2:
- [ ] Wali Kelas dapat melihat seluruh jadwal mata pelajaran di kelas binaannya dengan mengirimkan `GET /api/schedules?class_id={id_kelas_binaan}`.
- [ ] Wali Kelas yang meminta jadwal kelas lain yang bukan binaannya secara otomatis dialihkan kembali hanya melihat jadwal mengajarnya sendiri.
- [ ] Wali Kelas dapat melihat daftar dan detail jurnal pada kelas binaannya.
- [ ] Wali Kelas dapat membuka sesi KBM dan menyelesaikan jurnal kelas binaannya dengan tercatat sebagai `substitute_teacher_id`.
- [ ] Wali Kelas ditolak dengan HTTP 403 jika mencoba menandai jadwal sebagai `teacher_absent` atau membuka jurnal kelas lain.

---

### Tahap 3 — Controller & Endpoint Izin Guru (TeacherLeaveRequestController)

**Tujuan Tahap 3:** Membangun sistem alur pengajuan izin tidak mengajar dan delegasi tugas bagi seluruh guru (reguler maupun wali kelas), serta mekanisme verifikasi persetujuan/penolakan oleh Tim Kesiswaan / Waka Kurikulum.

#### 3.1 Berkas yang Dibuat / Dimodifikasi:
1. `app/Http/Controllers/API/TeacherLeaveRequestController.php` (Dibuat)
2. `routes/api.php` (Dimodifikasi)

#### 3.2 Detail Pengerjaan:

##### A. Pembuatan `TeacherLeaveRequestController.php`
Membangun 5 method utama dengan struktur logika sebagai berikut:

1. **`index(Request $request): JsonResponse`**
   - Otorisasi: `role: teacher, vice_principal`.
   - Query Scoping:
     - Jika `vice_principal` atau `user->isKesiswaan()`: Tampilkan seluruh izin guru sekolah. Dukung filter `?teacher_id=`, `?status=`, `?date=`, `?start_date=`, `?end_date=`.
     - Jika guru biasa / wali kelas: Kunci query hanya pada perizinan miliknya sendiri (`where('teacher_id', $user->id)`).
   - Eager Loading: `['teacher:id,name,nis_nip', 'approvedBy:id,name,nis_nip']`.
   - Pagination: Menggunakan `paginate($request->integer('per_page', 15))`.
   - Mengembalikan response JSON standar HTTP 200.

2. **`show(Request $request, $id): JsonResponse`**
   - Eager loading relasi lengkap.
   - Otorisasi: Izinkan hanya jika pengguna adalah Waka, Kesiswaan, atau pemilik izin (`$leave->teacher_id === $user->id`). Jika tidak, kembalikan HTTP 403.
   - Mengembalikan data detail izin guru (HTTP 200).

3. **`store(Request $request): JsonResponse`**
   - Otorisasi: `role: teacher` (termasuk guru biasa dan wali kelas).
   - Validasi Request:
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
   - **Validasi Integritas Kepemilikan Jadwal**:
     Jika `schedule_ids` diisi, periksa apakah seluruh schedule ID tersebut benar milik guru yang sedang login:
     ```php
     $invalidSchedules = Schedule::whereIn('id', $request->schedule_ids)
         ->where('teacher_id', '!=', $user->id)
         ->exists();
     if ($invalidSchedules) {
         return response()->json([
             'success' => false,
             'message' => 'Anda hanya dapat mengajukan izin untuk jadwal mengajar milik Anda sendiri.',
         ], 422);
     }
     ```
   - **Pencegahan Pengajuan Duplikat**:
     Cek apakah sudah ada pengajuan izin berstatus `pending` atau `approved` pada tanggal yang sama untuk guru tersebut. Jika ada, kembalikan HTTP 422.
   - **Penyimpanan Berkas (Storage)**:
     - Lampiran surat keterangan: `$request->file('attachment')->store('teacher_leaves/letters', 'public');`
     - Lampiran berkas tugas titipan: `$request->file('task_attachment')->store('teacher_leaves/tasks', 'public');`
   - **Penyimpanan Data**: Simpan record ke tabel `teacher_leave_requests` dengan status default `pending`.
   - Mengembalikan HTTP 201 Created dengan envelope standar.

4. **`approve(Request $request, $id): JsonResponse`**
   - Otorisasi: Hanya `vice_principal` atau `user->isKesiswaan()`. Selain itu kembalikan HTTP 403.
   - Ambil data izin berdasarkan `$id`.
   - Validasi status saat ini: Jika status bukan `pending`, kembalikan HTTP 422: *"Perizinan ini sudah diproses sebelumnya."*
   - Update record:
     ```php
     $leave->update([
         'status'      => 'approved',
         'approved_by' => $user->id,
         'verified_at' => Carbon::now('Asia/Jakarta'),
     ]);
     ```
   - Mengembalikan HTTP 200 OK dengan detail record terbaru.

5. **`reject(Request $request, $id): JsonResponse`**
   - Otorisasi: Hanya `vice_principal` atau `user->isKesiswaan()`. Selain itu kembalikan HTTP 403.
   - Validasi status: Wajib masih `pending`.
   - Update status menjadi `rejected`, catat `approved_by` dan `verified_at`.
   - Mengembalikan HTTP 200 OK.

##### B. Pendaftaran Rute di `routes/api.php`
Mendaftarkan rute baru di bawah grup middleware `['auth:sanctum', 'throttle:api']`:
```php
// Rute Izin Guru (Tahap 3)
Route::middleware('role:vice_principal,teacher')->group(function () {
    Route::get('/teacher-leave-requests', [TeacherLeaveRequestController::class, 'index']);
    Route::get('/teacher-leave-requests/{id}', [TeacherLeaveRequestController::class, 'show']);
    Route::patch('/teacher-leave-requests/{id}/approve', [TeacherLeaveRequestController::class, 'approve']);
    Route::patch('/teacher-leave-requests/{id}/reject', [TeacherLeaveRequestController::class, 'reject']);
});

Route::middleware('role:teacher')->group(function () {
    Route::post('/teacher-leave-requests', [TeacherLeaveRequestController::class, 'store']);
});
```

#### 3.3 Verifikasi CLI Tahap 3:
- Memeriksa daftar rute terdaftar:
  `php artisan route:list --path=teacher-leave-requests`
  *(Ekspektasi: 5 rute terdaftar dengan middleware sanctum dan role yang sesuai)*

#### 3.4 Kriteria Keberhasilan (Acceptance Criteria) Tahap 3:
- [ ] Guru dapat mengajukan izin tidak hadir disertai alasan, bukti surat, instruksi tugas, dan file lampiran tugas ke endpoint `POST /api/teacher-leave-requests`.
- [ ] Upaya guru mengajukan izin atas jadwal guru lain digagalkan dengan respons HTTP 422.
- [ ] Guru biasa hanya dapat melihat daftar riwayat izin yang diajukannya sendiri.
- [ ] Tim Kesiswaan dan Waka Kurikulum dapat melihat seluruh pengajuan izin guru dan menyetujui (`approve`) atau menolaknya (`reject`).
- [ ] Guru non-kesiswaan ditolak dengan HTTP 403 saat mencoba mengakses endpoint approval/rejection.

---

### Tahap 4 — Pengujian Otomatis Komprehensif & Verifikasi Zero-Regression

**Tujuan Tahap 4:** Memvalidasi seluruh skenario operasional dan keamanan melalui rangkaian pengujian otomatis (*automated feature tests*), serta memastikan tidak ada regresi (*zero-regression*) pada 199+ test suite yang telah ada sebelumnya.

#### 4.1 Berkas yang Dibuat:
1. `tests/Feature/WaliKelasAccessTest.php` (Dibuat)
2. `tests/Feature/TeacherLeaveRequestTest.php` (Dibuat)
3. `tests/Feature/CounselorAccessTest.php` (Dibuat)

#### 4.2 Detail Pengerjaan Matriks Pengujian:

##### A. Penyusunan `tests/Feature/WaliKelasAccessTest.php`
Menguji seluruh skenario hak akses Wali Kelas (10 Skenario):
1. `test_homeroom_teacher_can_view_schedules_of_their_class`: Request `GET /api/schedules?class_id={homeroom_class_id}` sukses menampilkan seluruh mapel di kelas tersebut.
2. `test_homeroom_teacher_cannot_view_schedules_of_other_classes`: Request `GET /api/schedules?class_id={other_class_id}` mengembalikan jadwal diri sendiri (fallback aman).
3. `test_homeroom_teacher_can_view_journals_of_their_class`: Request `GET /api/journals?class_id={homeroom_class_id}` menampilkan jurnal kelas binaan.
4. `test_homeroom_teacher_can_open_session_for_their_class`: Request `POST /api/journals` sukses membuat jurnal dengan `substitute_teacher_id = auth()->id()`.
5. `test_homeroom_teacher_cannot_open_session_for_other_class`: Request `POST /api/journals` pada kelas lain ditolak dengan status HTTP 403.
6. `test_homeroom_teacher_cannot_mark_teacher_absent`: Request `POST /api/journals` dengan `status: teacher_absent` oleh wali kelas ditolak dengan status HTTP 403.
7. `test_homeroom_teacher_can_complete_journal_they_opened`: Request `PUT /api/journals/{id}` sukses menyelesaikan jurnal dan presensi siswa.
8. `test_homeroom_teacher_can_view_leave_requests_of_their_class`: Request `GET /api/leave-requests` hanya memuat siswa pada kelas binaannya.
9. `test_homeroom_teacher_cannot_approve_student_leave_request`: Request `PATCH /api/leave-requests/{id}` oleh wali kelas ditolak dengan status HTTP 403.
10. `test_homeroom_teacher_can_view_attendance_recap_scoped_to_their_class`: Request `GET /api/attendances` otomatis ter-filter ke kelas binaannya.

##### B. Penyusunan `tests/Feature/TeacherLeaveRequestTest.php`
Menguji alur pengajuan izin guru dan delegasi tugas (11 Skenario):
1. `test_teacher_can_submit_leave_request_with_valid_schedules`: Pengajuan izin sukses mengembalikan HTTP 201 dan data tersimpan.
2. `test_teacher_cannot_submit_leave_request_for_others_schedule`: Pengajuan dengan `schedule_ids` milik guru lain ditolak dengan HTTP 422.
3. `test_teacher_cannot_submit_duplicate_leave_on_same_date`: Pengajuan kedua pada tanggal yang sama ditolak dengan HTTP 422.
4. `test_teacher_can_submit_leave_with_task_and_attachments`: Pengunggahan file surat dan file tugas tersimpan di storage public.
5. `test_teacher_can_view_only_their_own_leave_requests`: Endpoint `GET /api/teacher-leave-requests` hanya mengembalikan izin milik guru login.
6. `test_teacher_cannot_view_others_leave_request_detail`: Endpoint `GET /api/teacher-leave-requests/{id}` milik guru lain ditolak dengan HTTP 403.
7. `test_counselor_can_view_all_teachers_leave_requests`: Akun kesiswaan dapat melihat seluruh perizinan guru tanpa filter.
8. `test_counselor_can_approve_teacher_leave_request`: Kesiswaan sukses menyetujui izin, `verified_by` dan `verified_at` tercatat.
9. `test_counselor_can_reject_teacher_leave_request`: Kesiswaan sukses menolak izin.
10. `test_regular_teacher_cannot_approve_or_reject_leave_request`: Guru reguler ditolak dengan HTTP 403 saat mencoba approve/reject.
11. `test_homeroom_teacher_can_also_submit_teaching_leave_request`: Wali kelas yang memiliki jadwal mengajar dapat mengajukan izin seperti guru biasa.

##### C. Penyusunan `tests/Feature/CounselorAccessTest.php`
Menguji hak akses Tim Kesiswaan / BK (6 Skenario):
1. `test_counselor_can_view_all_students_attendance`: Akses rekapitulasi presensi lintas seluruh kelas berhasil.
2. `test_counselor_can_open_substitute_journal_for_any_class`: Kesiswaan dapat membuka sesi KBM pengganti di kelas mana pun.
3. `test_counselor_can_complete_substitute_journal`: Kesiswaan dapat menyelesaikan jurnal pengganti.
4. `test_counselor_can_mark_teacher_absent`: Kesiswaan dapat menandai status `teacher_absent`.
5. `test_counselor_can_view_and_approve_all_student_leaves`: Kesiswaan dapat menyetujui perizinan siswa di seluruh kelas.
6. `test_non_counselor_teacher_cannot_act_as_substitute_for_other_class`: Guru biasa tanpa penugasan kesiswaan ditolak saat mencoba membuka kelas guru lain.

#### 4.3 Verifikasi Eksekusi Pengujian:
1. Eksekusi test suite baru secara terisolasi:
   `php artisan test --filter=WaliKelasAccessTest`
   `php artisan test --filter=TeacherLeaveRequestTest`
   `php artisan test --filter=CounselorAccessTest`
2. Eksekusi pengujian penuh regresi sistem:
   `php artisan test`

#### 4.4 Kriteria Keberhasilan (Acceptance Criteria) Tahap 4:
- [ ] 27 skenario baru pada ketiga file test suite berjalan dengan status 100% Passed (Hijau).
- [ ] Seluruh pengujian eksisting (199+ tests) tetap berjalan 100% Passed tanpa ada error atau kegagalan (Zero Regression).

---

## 8. Rencana Pengujian Otomatis

### 8.1 `WaliKelasAccessTest.php`

| # | Nama Skenario | Ekspektasi |
|---|---|---|
| 1 | Wali kelas dapat melihat jadwal kelas binaannya | HTTP 200, data terbatas pada `class_id` yang diampu |
| 2 | Wali kelas tidak dapat melihat jadwal kelas lain via `class_id` | HTTP 200 tapi data kosong / filtered |
| 3 | Wali kelas dapat melihat daftar jurnal kelas binaannya | HTTP 200, data terbatas pada kelas binaan |
| 4 | Wali kelas dapat membuka sesi KBM kelas binaannya | HTTP 201, `substitute_teacher_id` terisi |
| 5 | Wali kelas tidak dapat membuka sesi KBM kelas lain | HTTP 403 |
| 6 | Wali kelas tidak dapat menandai `teacher_absent` | HTTP 403 |
| 7 | Wali kelas dapat menyelesaikan jurnal yang ia buka | HTTP 200, status `completed` |
| 8 | Wali kelas dapat melihat daftar izin siswa kelas binaannya | HTTP 200, hanya kelas binaannya |
| 9 | Wali kelas tidak dapat approve/reject izin siswa | HTTP 403 |
| 10 | Wali kelas dapat melihat laporan presensi kelas binaannya | HTTP 200, auto-scoped |

### 8.2 `TeacherLeaveRequestTest.php`

| # | Nama Skenario | Ekspektasi |
|---|---|---|
| 1 | Guru dapat mengajukan izin dengan schedule_ids miliknya | HTTP 201, record tersimpan |
| 2 | Guru tidak dapat mengajukan izin untuk schedule milik guru lain | HTTP 422 / 403 |
| 3 | Guru dapat melihat daftar izin miliknya | HTTP 200, hanya izin sendiri |
| 4 | Guru tidak dapat melihat izin guru lain | HTTP 200 data kosong / HTTP 403 |
| 5 | Kesiswaan dapat melihat semua izin guru | HTTP 200, semua data |
| 6 | Kesiswaan dapat approve izin guru | HTTP 200, status `approved` |
| 7 | Kesiswaan dapat reject izin guru | HTTP 200, status `rejected` |
| 8 | Guru biasa tidak dapat approve/reject izin guru lain | HTTP 403 |
| 9 | Izin duplikat untuk schedule yang sama ditolak | HTTP 422 |
| 10 | Izin dengan lampiran file valid tersimpan dengan path yang benar | HTTP 201, `attachment_path` terisi |
| 11 | Wali Kelas dapat mengajukan izin mengajar | HTTP 201 |

### 8.3 `CounselorAccessTest.php`

| # | Nama Skenario | Ekspektasi |
|---|---|---|
| 1 | Kesiswaan dapat melihat presensi semua siswa tanpa filter kelas | HTTP 200, data multi-kelas |
| 2 | Kesiswaan dapat membuka jurnal pengganti untuk kelas mana pun | HTTP 201 |
| 3 | Kesiswaan dapat menyelesaikan jurnal yang ia buka sebagai pengganti | HTTP 200 |
| 4 | Kesiswaan dapat melihat semua izin siswa | HTTP 200 |
| 5 | Kesiswaan dapat approve/reject izin siswa | HTTP 200 |
| 6 | Guru yang bukan kesiswaan tidak dapat membuka jurnal kelas orang lain | HTTP 403 |

---

*Dokumen ini adalah panduan perencanaan. Tidak ada implementasi kode yang dijalankan sebelum dokumen ini ditinjau dan disetujui. Urutan eksekusi mengikuti Tahapan Implementasi §7.*
