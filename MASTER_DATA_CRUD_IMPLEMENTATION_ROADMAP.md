# ROADMAP IMPLEMENTASI MANAJEMEN MASTER DATA & DEPENDENCY GOVERNANCE
**School Class Project (SCP) — Arsitektur Laravel 13 & React 19**
*Dokumen Acuan Resmi: Perbaikan Arsitektur, Validasi Relasi, Deaktivasi Entitas, dan Reset Terkendali*
*Tanggal: 2 November 2026*

---

## 1. Analisis Kritis Rencana Awal vs Kondisi Nyata Codebase

Dokumen `master_data_crud_dependency_solution_plan.md` telah dianalisis secara mendalam terhadap seluruh struktur file, model Eloquent, skema migrasi database PostgreSQL, controller API, service, dan antarmuka web React yang ada di repositori SCP saat ini.

### 1.1. Evaluasi Filosofi Solusi Awal
* **Prinsip Hibrida (Hard Delete vs Deaktivasi):** Sangat tepat dan terbukti aman. Menghindari dua bencana ekstrem: `CASCADE DELETE` (yang memusnahkan riwayat jurnal/presensi) dan `SET NULL` (yang merusak integritas pelaporan akademik).
* **Pre-flight Dependency Checking:** Sangat tepat untuk memberikan transparansi penuh kepada Waka Kurikulum sebelum melakukan tindakan mutasi atau penghapusan data.
* **Token Revocation Instan:** Sangat krusial untuk mencegah pengguna yang telah dimutasi/dinonaktifkan tetap berinteraksi dengan API melalui token Sanctum yang masih aktif.

### 1.2. Diskrepansi Asumsi Dokumen Awal vs Arsitektur Nyata Codebase

Berdasarkan pencocokan langsung terhadap kode sumber (`/scp/app/Models/`, `/scp/database/migrations/`, dan `/scp/app/Http/Controllers/API/`), ditemukan beberapa ketidaksesuaian teknis pada dokumen perencanaan awal yang **wajib disesuaikan**:

| Aspek / Entitas | Asumsi dalam Dokumen Rencana Awal | Kondisi Nyata pada Codebase SCP Saat Ini | Konsekuensi & Penyesuaian Solusi |
| :--- | :--- | :--- | :--- |
| **Wali Kelas** | Diklaim sebagai kolom `classes.homeroom_teacher_id`. | Tidak ada kolom tersebut di tabel `classes`. Penugasan wali kelas disimpan di tabel `teacher_assignments` dengan `type = 'wali_kelas'`. | Inspeksi relasi kelas dan guru wajib memeriksa `teacher_assignments`, bukan foreign key langsung pada tabel `classes`. |
| **Relasi Jurnal** | Diklaim `journals` memiliki foreign key langsung: `class_id`, `teacher_id`, `room_id`, `subject_id`. | Tabel `journals` hanya memiliki `schedule_id` dan `substitute_teacher_id`. Keterikatan ke guru, kelas, mapel, dan ruang diturunkan via relasi `schedule`. | Pengecekan jurnal untuk master data harus melalui relasi bertingkat (*indirect relation*): `schedules.journals` dan `journals.substitute_teacher_id`. |
| **Slot Jadwal** | Diklaim `schedules.period_template_id`. | Tabel `schedules` menggunakan `period_number` dan `day_of_week`. Jam diselesaikan secara dinamis melalui `PeriodResolutionService`. | Pengecekan jadwal tidak memerlukan validasi ID template, melainkan kombinasi `day_of_week`, `period_number`, dan `cycle_type`. |
| **Status Aktif Entitas** | Dianggap kolom `is_active` sudah ada di beberapa entitas. | Kolom `is_active` **belum ada** pada tabel `users`, `classes`, `rooms`, maupun `subjects`. Saat ini seluruh entitas hanya menggunakan `SoftDeletes` (`deleted_at`). | Diperlukan migrasi terstruktur untuk menambahkan kolom `is_active` (boolean, default true) beserta indeks penunjang performa. |
| **Pengecekan Destroy Saat Ini** | Dianggap sudah ada proteksi parsial. | • `TeacherController`: Hanya cek `schedules`. Mengabaikan `teacher_assignments`, `substituteJournals`, dan `teacher_leave_requests`.<br>• `StudentController`: **Nol proteksi**. Langsung hapus siswa dan akun ortu, memicu `IntegrityConstraintViolation` pada `attendances` dan `leave_requests`.<br>• `SchoolClassController`: Hanya cek `schedules`. Mengabaikan siswa aktif (`class_id`) dan `next_class_id`.<br>• `SubjectController`: Hanya cek `schedules`. Mengabaikan `users.subject_id`. | Seluruh method `destroy()` wajib direfaktor total menggunakan satu service pusat: `MasterDataDependencyService`. |
| **Autentikasi Login** | Hanya meninjau login password biasa. | `AuthController` memiliki dua gerbang login: `login` (NIS/NIP & sandi) dan `loginWithGoogle` (SSO via Google ID Token). | Pengecekan `is_active` wajib disematkan pada **kedua** gerbang autentikasi tersebut. |
| **Frontend Dialog** | Dianggap sudah memiliki dialog de-aktivasi. | `DeleteConflictDialog.jsx` saat ini hanya menampilkan pesan statis *"Saya Mengerti"* tanpa rincian kuantitatif dependensi dan tanpa tombol opsi de-aktivasi. | Perlu peremajaan komponen `DeleteConflictDialog.jsx` agar dapat menampilkan rincian relasi dan tombol eksekusi *"Nonaktifkan Entitas"*. |

---

## 2. Rekomendasi Penyesuaian Arsitektur & Aturan Bisnis

### 2.1. Standarisasi Logika Hapus vs Nonaktifkan (*Hard Delete vs Logical Deactivation*)
1. **Hard Delete (`$model->forceDelete()` atau `$model->delete()` fisik):**
   * Hanya diperbolehkan jika entitas memiliki keterikatan relasi **nol** (bersih total dari jadwal, riwayat presensi, jurnal, kuis, dan perizinan).
   * Menjamin database tetap bersih dari *typo* input data master baru yang langsung dihapus.
2. **Deaktivasi Logis (`is_active = false`):**
   * Diwajibkan jika entitas sudah memiliki rekam jejak historis (KBM lampau, nilai kuis, presensi, atau penugasan).
   * Entitas tetap ada di database, relasi historis tidak menjadi `null` atau `dangling`, nama guru/siswa tetap tampil di rekapitulasi nilai dan jurnal lama.
   * Entitas tidak muncul di dropdown pemilihan jadwal aktif baru, form presensi harian berjalan, atau alur KBM aktif.
   * Akun pengguna (`users`) yang dinonaktifkan **wajib langsung diputus seluruh sesi login-nya** (`$user->tokens()->delete()`).

### 2.2. Penanganan Benturan Constraint Unik (*Unique Constraint Conflict*)
Ketika guru atau siswa dinonaktifkan, NIP/NIS/Email mereka tetap tersimpan di tabel `users`. Jika sekolah mendaftarkan kembali personil baru dengan NIP atau NIS yang sama:
* Rule validasi form input master data:
  ```php
  Rule::unique('users', 'nis_nip')->whereNull('deleted_at')
  ```
* Jika entitas dinonaktifkan (`is_active = false`), NIP tetap unik per institusi. Jika personil tersebut kembali aktif, Waka cukup mengaktifkan kembali (*Reactivate*) entitas tersebut alih-alih membuat record baru.

### 2.3. Proteksi Step-Up Authentication untuk Aksi Berisiko Tinggi
Operasi `Academic Reset` (Reset Data Percobaan, Reset Jadwal Semester, dan Promosi Kelas) serta penghapusan massal wajib mewajibkan konfirmasi sandi Waka (`passwordIsConfirmed`) untuk mencegah eksekusi tidak sengaja atau manipulasi sesi.

---

## 3. Roadmap Implementasi Bertahap (6 Fase Terstruktur)

```
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 1: FONDASI SKEMA DATABASE & MODEL GOVERNANCE (MIGRATIONS)         │
│ Durasi: Prioritas Utama | Risiko: Rendah (Non-Breaking Schema Addition)│
│ • Tambah kolom is_active pada users, classes, rooms, subjects          │
│ • Tambah kolom aliases pada rooms                                      │
│ • Tambah scopeActive(), scopeInactive() pada seluruh Model Master Data │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 2: MESIN ANALISIS DEPENDENSI (MasterDataDependencyService)        │
│ Durasi: Prioritas Utama | Risiko: Rendah (Read-Only Inspection Logic)  │
│ • Bangun Service pusat pemeriksa relasi langsung & tidak langsung      │
│ • Ekspos endpoint GET /api/master/{entity}/{id}/dependencies           │
│ • Satukan perhitungan relasi: Schedules, Journals, Attendances, dll    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 3: REFACTOR CONTROLLER, SAFE MUTATION & SECURITY GUARD           │
│ Durasi: Prioritas Utama | Risiko: Menengah (Core Mutation Endpoints)   │
│ • Refaktor destroy() pada 5 Controller Master (Tolak 409 jika terikat) │
│ • Tambah endpoint POST /api/master/{entity}/{id}/toggle-status         │
│ • Pasang pemutusan token instan ($user->tokens()->delete())            │
│ • Pasang Login Guard pada AuthController (Normal & Google SSO)         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 4: INTEGRASI FRONTEND UI/UX MASTER DATA & DIALOG KONFLIK          │
│ Durasi: Prioritas Tinggi | Risiko: Rendah (Visual & Interaction Layer) │
│ • Tambah badge status Aktif/Nonaktif & filter status di MasterDataPage │
│ • Perbarui DeleteConflictDialog: Tampilkan rincian relasi & tombol     │
│   "Nonaktifkan Entitas" secara elegan                                  │
│ • Integrasi API checkDependencies & toggleStatus pada masterDataApi.js │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 5: MESIN RESET AKADEMIK TERKENDALI (AcademicResetService)         │
│ Durasi: Prioritas Menengah | Risiko: Tinggi (Atomic State Deletion)    │
│ • Bangun AcademicResetService dengan 3 cakupan reset aman              │
│ • Endpoint POST /api/waka/reset-scoped dengan proteksi sandi bertingkat│
│ • UI Tab/Modal Pengaturan Siklus Akademik di Halaman Waka              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 6: SINKRONISASI IMPOR CERDAS & ALIAS MATCHING RUANGAN             │
│ Durasi: Prioritas Menengah | Risiko: Rendah (Parser Hardening)         │
│ • Integrasi alias matching ruangan pada ParseSchedulePdfJob            │
│ • Dialog Resolusi Ketidakcocokan Ruangan pada ReviewImportPage         │
│ • Template Impor Excel yang sinkron dengan status entitas              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Rincian Teknis Setiap Fase Implementasi

### FASE 1: Fondasi Skema Database & Model Governance

#### 1. Tujuan & Ruang Lingkup
Mempersiapkan struktur database dan model Eloquent agar mampu mengenali status keaktifan entitas (`is_active`) serta alias ruangan untuk normalisasi parser PDF, tanpa merusak data yang telah ada.

#### 2. Detail Pekerjaan
1. **Database Migrations:**
   * Membuat file migrasi: `scp/database/migrations/2026_11_02_000001_add_is_active_to_master_tables.php`:
     * Tabel `users`: tambah kolom `is_active` (boolean, default true). Tambah indeks gabungan `['role', 'is_active']`.
     * Tabel `classes`: tambah kolom `is_active` (boolean, default true).
     * Tabel `rooms`: tambah kolom `is_active` (boolean, default true).
     * Tabel `subjects`: tambah kolom `is_active` (boolean, default true).
   * Membuat file migrasi: `scp/database/migrations/2026_11_02_000002_add_aliases_to_rooms_table.php`:
     * Tabel `rooms`: tambah kolom `aliases` (jsonb / json, nullable) untuk menyimpan variasi penulisan nama ruangan dari FET.
2. **Model Updates:**
   * `User.php`: Tambahkan `'is_active'` ke `#[Fillable]`, casts `'is_active' => 'boolean'`, tambahkan local scope `scopeActive($query)` dan `scopeInactive($query)`.
   * `Classes.php`: Tambahkan `'is_active'` ke `$fillable`, casts `'is_active' => 'boolean'`, scope `scopeActive()`.
   * `Room.php`: Tambahkan `'is_active'` dan `'aliases'` ke `$fillable`, casts `'is_active' => 'boolean'` dan `'aliases' => 'array'`, scope `scopeActive()`.
   * `Subject.php`: Tambahkan `'is_active'` ke `$fillable`, casts `'is_active' => 'boolean'`, scope `scopeActive()`.

#### 3. Komponen Terdampak
* **Tabel:** `users`, `classes`, `rooms`, `subjects`.
* **Model:** `scp/app/Models/User.php`, `Classes.php`, `Room.php`, `Subject.php`.

#### 4. Batasan (*Out of Scope*)
* Tidak mengubah relasi foreign key database yang ada.
* Tidak menghapus data lama apa pun; semua baris eksisting secara otomatis mendapat `is_active = true`.

#### 5. Kriteria Keberhasilan & Pengujian
* Menjalankan `php artisan migrate` sukses tanpa rollback.
* Unit test: `User::active()->get()` mengembalikan pengguna aktif. `Room::create(['name' => 'Lab 1', 'aliases' => ['R.Lab 1', 'LAB-1']])` berhasil menyimpan dan meng-cast JSON alias dengan benar.

---

### FASE 2: Mesin Analisis Ketergantungan (`MasterDataDependencyService`)

#### 1. Tujuan & Ruang Lingkup
Membangun satu *engine* terpusat yang memetakan dan menghitung seluruh relasi (langsung dan tidak langsung) dari setiap entitas Master Data secara presisi sesuai skema SCP.

#### 2. Detail Pekerjaan
1. **Membuat Service:** `scp/app/Services/MasterDataDependencyService.php`:
   * Method `inspectTeacher(int $teacherId): array`:
     * Cek `schedules()->count()` (jadwal aktif).
     * Cek `journals` melalui jadwal yang pernah diampu + `substituteJournals()->count()` (jurnal sebagai guru pengganti).
     * Cek `assignments()->count()` (penugasan wali kelas / kesiswaan).
     * Cek `teacherLeaveRequests()->count()` (pengajuan izin mengajar).
     * Return: `['can_hard_delete' => bool, 'dependencies' => [...], 'summary' => string]`.
   * Method `inspectStudent(int $studentId): array`:
     * Cek `attendances()->count()` (rekam presensi kehadiran).
     * Cek `leaveRequests()->count()` (perizinan siswa).
     * Cek `quizSubmissions` (pengerjaan kuis siswa).
     * Cek akun orang tua terhubung (`linked_student_id`).
   * Method `inspectRoom(int $roomId): array`:
     * Cek `schedules()->count()`.
     * Cek `journals` melalui relasi `schedule.room_id`.
   * Method `inspectClass(int $classId): array`:
     * Cek `students()->count()` (siswa aktif di kelas).
     * Cek `schedules()->count()` (jadwal kelas).
     * Cek `teacherAssignments()->where('type', 'wali_kelas')->count()`.
     * Cek kelas lain yang menjadikan kelas ini sebagai `next_class_id`.
   * Method `inspectSubject(int $subjectId): array`:
     * Cek `schedules()->count()`.
     * Cek `User::where('role', 'teacher')->where('subject_id', $subjectId)->count()`.
2. **Ekspos Endpoint Pre-Flight Dependency:**
   * Daftarkan route di `routes/api.php` di bawah middleware Waka:
     `GET /api/master/{entity}/{id}/dependencies`
   * Hubungkan ke controller terkait atau controller dispatcher khusus.

#### 3. Komponen Terdampak
* **File Baru:** `scp/app/Services/MasterDataDependencyService.php`.
* **Routing:** `scp/routes/api.php`.
* **Controller:** `TeacherController.php`, `StudentController.php`, `RoomController.php`, `SchoolClassController.php`, `SubjectController.php`.

#### 4. Kriteria Keberhasilan & Pengujian
* Request `GET /api/master/teacher/{id}/dependencies` mengembalikan JSON berstruktur:
  ```json
  {
    "success": true,
    "data": {
      "entity": "teacher",
      "id": 15,
      "name": "Budi Santoso, M.Pd",
      "can_hard_delete": false,
      "breakdown": {
        "active_schedules": 4,
        "historical_journals": 32,
        "substitute_journals": 2,
        "teacher_assignments": 1,
        "leave_requests": 0
      },
      "recommendation": "deactivate"
    }
  }
  ```
* Entitas tanpa relasi mengembalikan `can_hard_delete: true` dan `recommendation: "delete"`.

---

### FASE 3: Refactor Controller, Safe Mutation & Security Guard

#### 1. Tujuan & Ruang Lingkup
Mencegah terjadinya HTTP 500 (SQL error) saat penghapusan master data, memfasilitasi deaktivasi entitas, memastikan sesi pengguna nonaktif langsung terputus, dan memblokir login bagi entitas nonaktif.

#### 2. Detail Pekerjaan
1. **Refaktor Method `destroy()` pada Controller Master Data:**
   * Panggil `MasterDataDependencyService::inspect{$entity}($id)`.
   * Jika `can_hard_delete === false`, kembalikan respon **HTTP 409 Conflict** dengan payload rincian ketergantungan relasi dan pesan edukatif.
   * Jika `can_hard_delete === true`, lakukan penghapusan bersih (`$model->delete()` / `$model->forceDelete()`) di dalam `DB::transaction`. Khusus siswa, hapus akun orang tua terhubung.
2. **Implementasi Endpoint Toggle Status (`is_active`):**
   * Buat method `toggleStatus(Request $request, $id)` pada `TeacherController`, `StudentController`, `RoomController`, `SchoolClassController`, dan `SubjectController`.
   * Endpoint: `POST /api/master/{entity}/{id}/toggle-status`.
   * Jika entitas bertipe `teacher` atau `student` dinonaktifkan (`is_active = false`), jalankan:
     ```php
     $user->tokens()->delete(); // Revoke semua token Sanctum seketika
     ```
     Jika siswa dinonaktifkan, akun orang tua terkait (`linked_student_id`) juga otomatis ikut dinonaktifkan dan token-nya di-revoke.
3. **Penyempurnaan Gerbang Login (`AuthController.php`):**
   * Di method `login()`: Setelah pengecekan password cocok, tambahkan validasi:
     ```php
     if (! $user->is_active) {
         return response()->json([
             'success' => false,
             'message' => 'Akun Anda telah dinonaktifkan oleh pihak kurikulum. Silakan hubungi administrator sekolah.',
         ], 403);
     }
     ```
   * Di method `loginWithGoogle()`: Tambahkan pengecekan yang sama jika pengguna yang ditautkan memiliki `is_active == false`.

#### 3. Komponen Terdampak
* `scp/app/Http/Controllers/API/TeacherController.php`
* `scp/app/Http/Controllers/API/StudentController.php`
* `scp/app/Http/Controllers/API/SchoolClassController.php`
* `scp/app/Http/Controllers/API/RoomController.php`
* `scp/app/Http/Controllers/API/SubjectController.php`
* `scp/app/Http/Controllers/API/AuthController.php`
* `scp/routes/api.php`

#### 4. Kriteria Keberhasilan & Pengujian
* Siswa/guru yang memiliki relasi jurnal atau presensi saat di-`DELETE` menghasilkan HTTP 409 (tidak crash 500).
* Mengubah status guru ke nonaktif seketika mencabut token aktifnya; request berikutnya dengan Bearer Token lama menghasilkan HTTP 401 Unauthorized.
* Guru nonaktif mencoba login ulang menghasilkan HTTP 403 Forbidden.

---

### FASE 4: Integrasi Frontend UI/UX Master Data & Dialog Konflik

#### 1. Tujuan & Ruang Lingkup
Memperbarui halaman antarmuka Waka Kurikulum agar menyajikan status keaktifan entitas secara visual, memungkinkan pengubahan status dengan satu klik, dan mengintegrasikan modal konflik yang ramah pengguna.

#### 2. Detail Pekerjaan
1. **Pembaruan Service Frontend (`frontend/scp_web/src/services/masterDataApi.js`):**
   * Tambahkan pemanggilan API baru:
     ```javascript
     checkDependencies: (entity, id) => api.get(`/master/${entity}/${id}/dependencies`),
     toggleStatus: (entity, id) => api.post(`/master/${entity}/${id}/toggle-status`),
     ```
2. **Pembaruan Halaman `MasterDataPage.jsx`:**
   * Tambahkan kolom status pada tabel Master Data (Guru, Siswa, Kelas, Ruang, Mapel) berupa `Badge` (Hijau: "Aktif", Abu-abu: "Nonaktif").
   * Tambahkan filter status di atas tabel: Semua / Aktif / Nonaktif.
   * Tambahkan tombol aksi cepat di baris tabel: tombol toggle Aktifkan/Nonaktifkan.
   * Intersepsi tombol Hapus: Sebelum membuka konfirmasi biasa, panggil `checkDependencies`.
     * Jika `can_hard_delete === true`: Buka modal konfirmasi hapus permanen biasa.
     * Jika `can_hard_delete === false`: Buka `DeleteConflictDialog` dengan data breakdown relasi.
3. **Penyempurnaan Komponen `DeleteConflictDialog.jsx`:**
   * Tampilkan statistik kartu mini relasi (misal: "32 Jurnal KBM", "4 Jadwal Aktif", "1 Penugasan Wali Kelas").
   * Berikan dua tombol aksi:
     1. *"Batal"* (Tutup dialog).
     2. *"Nonaktifkan Entitas Ini"* (Warna oranye/amber) -> memicu `toggleStatus`, menutup dialog, dan me-refresh data tabel dengan toast notifikasi sukses.

#### 3. Komponen Terdampak
* `frontend/scp_web/src/services/masterDataApi.js`
* `frontend/scp_web/src/pages/waka/MasterDataPage.jsx`
* `frontend/scp_web/src/pages/waka/MasterData.css`
* `frontend/scp_web/src/pages/waka/components/DeleteConflictDialog.jsx`

#### 4. Kriteria Keberhasilan & Pengujian
* Pengguna dapat membedakan data aktif dan nonaktif dengan jelas melalui UI.
* Menekan tombol hapus pada guru berjadwal langsung memunculkan dialog konflik yang menampilkan rincian relasi, dan menekan "Nonaktifkan" berhasil mengubah status guru tanpa galat.

---

### FASE 5: Mesin Reset Akademik Terkendali (`AcademicResetService`)

#### 1. Tujuan & Ruang Lingkup
Menyediakan mekanisme pembersihan data berskala besar yang terkendali, teruji aman, dan transaksional untuk keperluan pergantian semester dan tahun ajaran baru.

#### 2. Detail Pekerjaan
1. **Membuat Service:** `scp/app/Services/AcademicResetService.php`:
   * Mendefinisikan 3 cakupan reset berbasis transaksi (`DB::transaction`):
     * **Scope 1: `RESET_TRIAL_DATA` (Reset Data Uji Coba):**
       * Menghapus seluruh transaksi KBM dummy: `journals`, `attendances`, `leave_requests`, `quizzes`, `quiz_questions`, `quiz_submissions`, `teacher_leave_requests`, `otp_codes`.
       * Menjaga master guru, siswa, kelas, mapel, dan jadwal tetap utuh.
     * **Scope 2: `RESET_SEMESTER_SCHEDULE` (Reset Jadwal Semester Baru):**
       * Menghapus jadwal KBM aktif (`schedules`) dan batch impor terkait.
       * Mengarsipkan status penugasan guru semester lalu (`teacher_assignments`).
       * **Melindungi dan tidak menyentuh** riwayat presensi (`attendances`) dan jurnal (`journals`) semester lampau.
     * **Scope 3: `CLASS_PROMOTION_AND_GRADUATION` (Promosi & Kelulusan Akhir Tahun):**
       * Menjalankan logika kenaikan kelas massal (`promoteClasses`): menaikkan `class_id` siswa ke `next_class_id`, menetapkan tanggal lulus (`graduation_date`) bagi kelas 12, dan menangani siswa tinggal kelas (`is_held_back`).
2. **Membuat Controller:** `scp/app/Http/Controllers/API/WakaResetController.php`:
   * Endpoint: `POST /api/waka/reset-scoped`.
   * Validasi ketat: `scope` (in: trial, schedule, promotion) dan verifikasi password Waka (`passwordIsConfirmed`).
   * Audit log: mencatat waktu, identitas Waka, dan cakupan reset yang dieksekusi.

#### 3. Komponen Terdampak
* **File Baru:** `scp/app/Services/AcademicResetService.php`
* **File Baru:** `scp/app/Http/Controllers/API/WakaResetController.php`
* **Routing:** `scp/routes/api.php`
* **Frontend:** `frontend/scp_web/src/pages/waka/DashboardWakaPage.jsx` atau komponen modal pengaturan siklus.

#### 4. Kriteria Keberhasilan & Pengujian
* Eksekusi `RESET_TRIAL_DATA` menghapus riwayat presensi uji coba tanpa merusak akun siswa atau kelas.
* Eksekusi dengan password salah langsung ditolak dengan respon HTTP 422 / 401.
* Seluruh operasi rollback secara otomatis jika terjadi interupsi database di tengah eksekusi.

---

### FASE 6: Sinkronisasi Impor Cerdas & Normalisasi Alias Ruangan

#### 1. Tujuan & Ruang Lingkup
Mencegah terbentuknya data master ganda saat Waka mengimpor berkas PDF/Excel jadwal pelajaran semester baru yang memiliki variasi penulisan nama ruangan.

#### 2. Detail Pekerjaan
1. **Alias Matching pada Job Impor Jadwal:**
   * Modifikasi `scp/app/Jobs/ParseSchedulePdfJob.php` dan service parser terkait:
     * Sebelum membuat record `Room` baru dari teks jadwal, cari kecocokan pada kolom `name` tabel `rooms`.
     * Jika tidak ditemukan, cari kecocokan pada kolom JSON `aliases` (misal: `"LAB-KOMP-1"` cocok dengan alias `"Lab Komputer 1"`).
     * Jika cocok, gunakan ID ruangan yang sudah ada.
     * Jika tidak cocok sama sekali, tandai baris impor sebagai `unresolved_room` agar Waka dapat memetakan aliasnya secara manual di antarmuka web.
2. **Frontend Review Import (`ReviewImportPage.jsx`):**
   * Tambahkan opsi saat me-resolve ruangan: *"Simpan sebagai alias permanen untuk ruangan ini"* agar impor di masa depan otomatis mengenali variasi nama tersebut.

#### 3. Komponen Terdampak
* `scp/app/Jobs/ParseSchedulePdfJob.php`
* `scp/app/Http/Controllers/API/ScheduleImportController.php`
* `frontend/scp_web/src/pages/waka/ReviewImportPage.jsx`

#### 4. Kriteria Keberhasilan & Pengujian
* File PDF dengan variasi nama ruangan yang sudah dialiaskan tidak lagi menghasilkan duplikasi baris ruangan pada tabel `rooms`.

---

## 5. Matriks Risiko Teknis & Strategi Mitigasi

| Risiko Potensial | Dampak Teknis | Strategi Mitigasi |
| :--- | :--- | :--- |
| **Dangling Reference pada Soft Delete** | Relasi Eloquent seperti `$journal->schedule->teacher` mengembalikan `null` jika guru di-soft-delete tanpa penanganan `withTrashed()`. | **Utamakan Deaktivasi (`is_active = false`)**. Guru berelasi tidak di-soft-delete melainkan dinonaktifkan, sehingga record-nya tetap ada dan terbaca utuh di riwayat lampau. |
| **Sesi Token Menempel Pasca Deaktivasi** | Guru yang dinonaktifkan masih bisa submit jurnal jika token Sanctum-nya belum kedaluwarsa. | Jalankan pemutusan token seketika: `$user->tokens()->delete()` di dalam transaksi toggle status. |
| **Bypass SSO Google untuk Akun Nonaktif** | Pengguna nonaktif login menggunakan Google OAuth dan memperoleh token baru. | Pasang pemeriksaan `!$user->is_active` pada method `loginWithGoogle` di `AuthController.php`. |
| **Kegagalan Parsial Saat Reset Data Massal** | Separuh data terhapus, separuh tertinggal akibat timeout skrip. | Bungkus seluruh logika di dalam `DB::transaction()`. Set timeout execution yang memadai (`set_time_limit(120)`). |
| **Benturan Unique Index NIP/NIS** | Guru baru tidak bisa didaftarkan jika ada guru nonaktif dengan NIP serupa. | Tambahkan pesan edukasi pada validasi unik agar Waka mengaktifkan kembali entitas lama, atau perbarui NIP entitas lama jika terjadi kesalahan input. |

---

## 6. Skenario Pengujian Otomatis (*Automated Feature Test Matrix*)

Seluruh skenario berikut wajib dicakup dalam test suite otomatis `/scp/tests/Feature/MasterDataGovernanceTest.php`:

| ID Tes | Fokus Pengujian | Kondisi Awal | Aksi yang Dijalankan | Ekspektasi (*Assertions*) |
| :---: | :--- | :--- | :--- | :--- |
| **MD-01** | Hapus Bersih Guru | Guru baru dibuat, tanpa relasi KBM | `DELETE /api/teachers/{id}` | • HTTP 200 OK.<br>• Record guru terhapus permanen dari tabel `users`. |
| **MD-02** | Tolak Hapus Guru Berelasi | Guru memiliki riwayat jadwal & jurnal | `DELETE /api/teachers/{id}` | • **HTTP 409 Conflict**.<br>• Payload memuat rincian jurnal & jadwal terkait.<br>• Record guru tidak terhapus. |
| **MD-03** | Deaktivasi & Revoke Sesi | Guru memiliki token Sanctum aktif | `POST /api/teachers/{id}/toggle-status` | • `is_active` menjadi `false`.<br>• Token di `personal_access_tokens` terhapus.<br>• Request dengan token lama menghasilkan HTTP 401. |
| **MD-04** | Login Guard Akun Nonaktif | User memiliki `is_active = false` | `POST /api/auth/login` (kredensial benar) | • **HTTP 403 Forbidden**.<br>• Pesan: *"Akun Anda telah dinonaktifkan..."*.<br>• Tidak ada token baru yang diterbitkan. |
| **MD-05** | Login Guard Google SSO | User Google ID memiliki `is_active = false` | `POST /api/auth/google` | • **HTTP 403 Forbidden**.<br>• Token akses ditolak. |
| **MD-06** | Tolak Hapus Kelas Bersiswa | Kelas berisi 30 siswa aktif | `DELETE /api/classes/{id}` | • **HTTP 409 Conflict**.<br>• Detail memuat jumlah 30 siswa aktif. |
| **MD-07** | Tolak Hapus Siswa Berpresensi | Siswa memiliki rekam presensi | `DELETE /api/students/{id}` | • **HTTP 409 Conflict**.<br>• Siswa dan data absensi tetap utuh. |
| **MD-08** | Reset Scoped: Trial Data | Database berisi jurnal & presensi dummy | `POST /api/waka/reset-scoped` (scope: trial) | • Jurnal, presensi, dan kuis terhapus.<br>• Master guru, siswa, kelas, dan jadwal tetap ada. |
| **MD-09** | Reset Scoped: Password Salah | Waka mengirim password konfirmasi salah | `POST /api/waka/reset-scoped` | • **HTTP 422 / 401**.<br>• Tidak ada data yang dihapus sama sekali. |
| **MD-10** | Ruang: Alias Matching Impor | Ruangan memiliki alias `"LAB-KOMP"` | Parse baris impor dengan nama `"LAB-KOMP"` | • Mengaitkan ke ID ruangan lama.<br>• Tidak membuat duplikasi record baru di `rooms`. |

---

## 7. Rekomendasi Urutan Pengerjaan & Kesimpulan

1. **Urutan Pengerjaan Wajib:**
   * **Langkah 1:** Jalankan **Fase 1** (Migrasi Skema Database). Langkah ini aman dan tidak mengganggu fungsionalitas eksisting karena seluruh data lama otomatis bernilai `is_active = true`.
   * **Langkah 2:** Kerjakan **Fase 2** (Service Pemeriksa Dependensi). Murni penambahan class logika tanpa mengubah alur controller yang sedang berjalan.
   * **Langkah 3:** Kerjakan **Fase 3** (Refaktor Controller & Auth Guard). Menghilangkan bug SQL 500 dan menutup celah keamanan sesi nonaktif.
   * **Langkah 4:** Kerjakan **Fase 4** (Integrasi Frontend). Memberikan pengalaman pengguna yang intuitif di browser.
   * **Langkah 5 & 6:** Kerjakan **Fase 5** (Reset Akademik) dan **Fase 6** (Alias Ruangan) untuk penyempurnaan manajemen siklus sekolah.

2. **Kesimpulan Arsitektur:**
   Dengan menerapkan Roadmap ini, sistem Master Data SCP bertransformasi dari sistem yang rentan terhadap galat integritas relasi (*foreign key failure*) menjadi sistem yang **tangguh, transparan, melindungi rekam jejak historis KBM, dan aman secara operasional**.
