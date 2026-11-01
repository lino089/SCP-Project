# Rencana Implementasi Teknis: Fase 4 (P3)
## Integrasi API, Penyesuaian Multirole, dan Sinkronisasi Data

> **Dokumen Terkait:** [`INTEGRATION_FIX_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/INTEGRATION_FIX_PLAN.md)  
> **Target Branch / Workspace:** `main` / `D:\MyUKK\SchoolClassProject`  
> **Status Dokumen:** DRAFT PERENCANAAN (Menunggu Persetujuan)  
> **Batasan:** DILARANG mengubah kode program, menjalankan migrasi database, atau memodifikasi file sebelum mendapatkan persetujuan eksplisit dari pengguna.

---

## 1. Ringkasan Fase 4 (P3)

Fase 4 berfokus pada penyelesaian integrasi API end-to-end, penegakan kontrol akses multirole sesuai *Role-Based Access Control* (RBAC) pada jadwal dan perizinan, polling asinkron ekstraksi PDF jadwal, serta penghapusan simulasi offline kenaikan kelas massal.

### Tujuan Utama
1. **Fase 4a — Pengajuan Izin Guru & Delegasi Tugas (`leaveApi.js` & `TeacherSchedulePage.jsx`)**:
   - Menambahkan method `approveTeacherLeaveRequest` dan `rejectTeacherLeaveRequest` pada `leaveApi.js`.
   - Menghubungkan formulir izin guru dengan `POST /api/teacher-leave-requests` (multipart form-data: tanggal, alasan, `schedule_ids`, lampiran surat, instruksi tugas, berkas tugas).
   - Menghapus manipulasi `localStorage` tiruan (`teacher_leave_active`, `teacher_leave_reason`, `teacher_leave_tasks`) dan beralih murni ke state data backend (`GET /api/teacher-leave-requests`).
   - Menyediakan antarmuka "Riwayat Pengajuan Izin Saya" pada antarmuka guru.
2. **Fase 4b — Pusat Verifikasi Izin & Proteksi Hak Akses Wali Kelas (`PermissionVerifyPage.jsx`)**:
   - Menegakkan hak akses Wali Kelas pada verifikasi izin siswa: Wali Kelas bersifat murni **READ-ONLY** (hanya melihat izin kelas binaannya, tombol "Setujui" dan "Tolak" disembunyikan, digantikan badge/status *"Menunggu Verifikasi Kesiswaan"*).
   - Menambahkan **Tab Perizinan Guru** (`GET /api/teacher-leave-requests`) yang khusus diakses oleh Kesiswaan dan Waka Kurikulum untuk memverifikasi izin guru (`PATCH /api/teacher-leave-requests/{id}/approve` dan `PATCH /api/teacher-leave-requests/{id}/reject`). Tab ini disembunyikan sepenuhnya dari guru biasa dan wali kelas murni.
3. **Fase 4c — Penyesuaian Multirole Wali Kelas pada Jadwal & Jurnal (`TeacherSchedulePage.jsx` & `TeacherJournalPage.jsx`)**:
   - Pada `TeacherSchedulePage.jsx`, menyediakan selektor/tab beralih antara **"Jadwal Mengajar Saya"** dan **"Jadwal Kelas Binaan ({nama_kelas})"** jika guru memiliki penugasan `wali_kelas`. Ketika tab kelas binaan dipilih, jadwal dimuat via `GET /api/schedules?class_id={homeroomClassId}`.
   - Pada `TeacherJournalPage.jsx`, memperbaiki *guard check* akses: Wali Kelas diizinkan membuka sesi KBM darurat untuk kelas binaannya (`isWaliKelas(schedule.class_id)`), bukan lagi diblokir HTTP 403.
   - Tombol *"Tandai Guru Berhalangan Hadir (Jam Kosong)"* (`teacher_absent`) disembunyikan dari Wali Kelas murni dan hanya ditampilkan untuk Kesiswaan dan Waka Kurikulum (selaras dengan validasi backend `JournalController`).
4. **Fase 4d — Polling Asinkron Upload Import PDF FET (`UploadImportPage.jsx`)**:
   - Menghapus seluruh simulasi `setTimeout` palsu (1200ms, 2400ms) dan mode fallback demo offline (`Date.now()`).
   - Mengimplementasikan mekanisme polling berkala (`setInterval` setiap 1.5 detik) ke `GET /api/schedule-imports/{batch_id}` setelah menerima HTTP 202 Accepted dari backend.
   - Menghentikan polling dan mengarahkan pengguna ke halaman preview (`/web/review-import/:id`) ketika status mencapai `preview_ready`, atau menampilkan error backend ketika status bernilai `failed`.
   - Memastikan pembersihan interval timer (`clearInterval`) saat komponen di-unmount atau formulir di-reset guna mencegah kebocoran memori (*memory leak*).
5. **Fase 4e — Pembersihan Simulasi Offline Promosi Kelas Massal (`GradePromotionPage.jsx`)**:
   - Menghapus manipulasi state lokal di blok `catch` pada `handleExecutePromotion` yang menyimulasikan kelulusan dan kenaikan kelas tiruan.
   - Mempertahankan integritas state asli dan menampilkan notifikasi kesalahan otentik dari respons backend jika eksekusi gagal.

---

## 2. Analisis Kondisi Saat Ini & Kesenjangan Sistem

### 2.1 Analisis Endpoint & Kontrak Backend (`scp`)

Seluruh endpoint backend yang dibutuhkan oleh Fase 4 telah terpasang, terdaftar di `scp/routes/api.php`, dan terverifikasi 100% lulus melalui PHPUnit Feature Tests:

| Endpoint | Method | Middleware / Role | Controller & Action | Keterangan & Aturan Otorisasi |
|---|:---:|---|---|---|
| `/api/teacher-leave-requests` | `GET` | `role:vice_principal,teacher` | `TeacherLeaveRequestController@index` | Auto-scoped: Guru biasa melihat izin miliknya sendiri; Waka/Kesiswaan melihat semua guru di sekolah. |
| `/api/teacher-leave-requests/{id}` | `GET` | `role:vice_principal,teacher` | `TeacherLeaveRequestController@show` | Dapat diakses pemilik izin, Waka, atau Tim Kesiswaan. |
| `/api/teacher-leave-requests` | `POST` | `role:teacher` | `TeacherLeaveRequestController@store` | Multipart/form-data: `date`, `reason`, `schedule_ids` (JSON), `attachment`, `task_instruction`, `task_attachment`. Menolak duplikasi pending/approved di tanggal yang sama (422). |
| `/api/teacher-leave-requests/{id}/approve` | `PATCH` | `role:vice_principal,teacher` | `TeacherLeaveRequestController@approve` | Khusus Tim Kesiswaan atau Waka Kurikulum. Guru biasa/wali kelas ditolak (HTTP 403). |
| `/api/teacher-leave-requests/{id}/reject` | `PATCH` | `role:vice_principal,teacher` | `TeacherLeaveRequestController@reject` | Khusus Tim Kesiswaan atau Waka Kurikulum. Guru biasa/wali kelas ditolak (HTTP 403). |
| `/api/leave-requests` | `GET` | `role:vice_principal,teacher,student,parent` | `LeaveRequestController@index` | Auto-scoped: Wali kelas otomatis hanya melihat perizinan siswa di kelas binaannya. |
| `/api/leave-requests/{id}` | `PATCH` | `role:vice_principal,teacher,student,parent` | `LeaveRequestController@update` | Approval/rejection siswa hanya boleh dilakukan Waka atau Kesiswaan. Wali Kelas ditolak (HTTP 403). |
| `/api/schedules` | `GET` | `auth:sanctum` | `ScheduleController@index` | Jika `user.role === 'teacher'` dan parameter `class_id` cocok dengan kelas binaan wali kelas, backend membuka seluruh jadwal rombel tersebut. |
| `/api/journals` | `POST` | `role:vice_principal,teacher` | `JournalController@store` | Guru pengajar, Kesiswaan, Waka, atau Wali Kelas rombel diizinkan membuka sesi KBM (`substitute_teacher_id` otomatis diisi). Status `teacher_absent` ditolak jika aktor adalah wali kelas (HTTP 403). |
| `/api/journals/{id}` | `PUT` | `role:teacher` | `JournalController@update` | Guru pengganti yang membuka sesi (termasuk Wali Kelas) berhak menyelesaikan jurnal dan presensi. |
| `/api/journals/{id}` | `PATCH` | `role:vice_principal,teacher` | `JournalController@markTeacherAbsent` | Khusus Kesiswaan & Waka. Wali kelas ditolak (HTTP 403). |
| `/api/schedule-imports` | `POST` | `role:vice_principal` | `ScheduleImportController@store` | Mengunggah 2 file PDF FET dan mendispatch `ParseSchedulePdfJob`. Mengembalikan HTTP 202 dengan `data.id` dan `status: uploaded`. |
| `/api/schedule-imports/{id}` | `GET` | `role:vice_principal` | `ScheduleImportController@show` | Menampilkan progres dan status parsing (`uploaded`, `parsing`, `preview_ready`, `failed`). |
| `/api/class-promotions` | `POST` | `role:vice_principal` | `SchoolClassController@promoteClasses` | Menjalankan kenaikan kelas dan kelulusan massal dalam `DB::transaction`. Mengembalikan `{ total_students, promoted, held_back, graduated }`. |

### 2.2 Analisis Frontend (`frontend/scp_web`)

| Berkas | Kondisi Saat Ini | Masalah / Kesenjangan |
|---|---|---|
| `services/leaveApi.js` | Memiliki `submitTeacherLeaveRequest` dan `getTeacherLeaveRequests`. | Belum memiliki fungsi `approveTeacherLeaveRequest(id)` dan `rejectTeacherLeaveRequest(id, notes)`. |
| `pages/teacher/TeacherSchedulePage.jsx` | - Menggunakan `localStorage` (`teacher_leave_active`, `teacher_leave_tasks`, `teacher_leave_reason`).<br>- Status kartu jadwal di-override jika flag lokal aktif tanpa mengecek status approval backend.<br>- Hanya memanggil `journalApi.getTeacherSchedules()`. | - Tidak ada sinkronisasi status izin aktual (pending/approved/rejected) per tanggal.<br>- Belum ada antarmuka untuk melihat daftar "Riwayat Izin Mengajar Saya".<br>- Guru yang bertindak sebagai Wali Kelas tidak memiliki opsi beralih untuk melihat jadwal kelas binaannya. |
| `pages/teacher/PermissionVerifyPage.jsx` | - Menampilkan tombol "Setujui" dan "Tolak" untuk setiap permohonan pending.<br>- Hanya memeriksa otorisasi umum `hasRole('waka') || isKesiswaan() || isWaliKelas()`.<br>- Hanya menampilkan perizinan siswa. | - Wali kelas yang mengklik tombol verifikasi menerima pesan error HTTP 403 dari backend karena tidak memiliki hak verifikasi.<br>- Belum ada pemisahan tab untuk perizinan guru (`GET /api/teacher-leave-requests`), sehingga Kesiswaan dan Waka tidak memiliki tempat di UI untuk menyetujui/menolak izin mengajar guru. |
| `pages/teacher/TeacherJournalPage.jsx` | - Baris 82: `return !isOriginalTeacher && !isKesiswaan();`<br>- Baris 427: Tombol "Tandai Guru Berhalangan Hadir (Jam Kosong)" ditampilkan tanpa pembatasan role. | - Wali kelas yang membuka KBM darurat kelas binaannya diblokir oleh halaman Forbidden 403 frontend.<br>- Wali kelas dapat mengklik tombol guru berhalangan hadir dan menerima HTTP 403 dari backend. |
| `pages/waka/UploadImportPage.jsx` | - Baris 139-150: Menggunakan dua `setTimeout` bertingkat (1200ms dan 2400ms) untuk mengubah progress dan status menjadi `preview_ready`.<br>- Baris 161-175: Fallback offline menyimulasikan parsing jika request gagal. | - Tidak memantau proses parsing asinkron nyata pada antrean backend.<br>- Menimbulkan risiko inkonsistensi saat parsing nyata di server memakan waktu lebih dari 2.4 detik atau gagal. |
| `pages/waka/GradePromotionPage.jsx` | - Baris 155-165: Blok `catch` pada `handleExecutePromotion` menjalankan simulasi lokal yang mengubah state `studentList` dan `promotionResult`. | - Jika backend mengembalikan kegagalan/error, UI justru menginformasikan kenaikan kelas berhasil (simulasi palsu). |

---

## 3. Rencana Implementasi Terperinci

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ARSITEKTUR ALUR KERJA FASE 4                           │
└─────────────────────────────────────────────────────────────────────────────────┘

 1. Pengajuan Izin Guru (4a)             2. Pusat Verifikasi Izin (4b)
 ┌─────────────────────────┐             ┌───────────────────────────────────────┐
 │   TeacherSchedulePage   │             │         PermissionVerifyPage          │
 │ (Form Izin & Delegasi)  │             │ ┌─────────────────┬─────────────────┐ │
 └───────────┬─────────────┘             │ │  Tab 1: Siswa   │  Tab 2: Guru    │ │
             │ POST                      │ │ (Wali: RO)      │ (Kesiswaan/Waka)│ │
             ▼                           │ └─────────────────┴─────────────────┘ │
 ┌─────────────────────────┐             └───────────────────┬───────────────────┘
 │ /teacher-leave-requests │                                 │ PATCH
 └─────────────────────────┘                                 ▼
                                                 ┌───────────────────────────────┐
                                                 │ /teacher-leave-requests/{id}/ │
                                                 │ approve / reject              │
                                                 └───────────────────────────────┘

 3. Multirole Wali Kelas (4c)            4. Asinkron Upload PDF (4d)
 ┌─────────────────────────┐             ┌───────────────────────────────────────┐
 │   TeacherSchedulePage   │             │          UploadImportPage             │
 │ [Jadwal Saya | Binaan]  │             └───────────────────┬───────────────────┘
 └───────────┬─────────────┘                                 │ POST /schedule-imports
             │                                               ▼
             ├─ Jadwal Binaan ───────────┐       ┌───────────────────────────────┐
             │                           ▼       │ HTTP 202 Accepted {id}        │
             │                   ┌──────────────┐└───────────────┬───────────────┘
             │                   │GET /schedules│                │
             │                   │?class_id=X   │                ▼ (Polling 1.5s)
             │                   └──────────────┘       ┌─────────────────┐
             ▼                                          │ GET /schedule-  │
 ┌─────────────────────────┐                            │ imports/{id}    │
 │   TeacherJournalPage    │                            └────────┬────────┘
 │ (KBM Darurat Binaan OK) │                                     │ status == 'preview_ready'
 └─────────────────────────┘                                     ▼
                                                        [ReviewImportPage]
```

### 3.1 Fase 4a: Integrasi Pengajuan Izin Guru & Delegasi Tugas

#### A. Penambahan Endpoint pada `leaveApi.js`
Menambahkan dua fungsi ke `frontend/scp_web/src/services/leaveApi.js`:
```javascript
/**
 * Menyetujui izin mengajar guru (Kesiswaan / Waka Kurikulum).
 * PATCH /api/teacher-leave-requests/{id}/approve
 */
async approveTeacherLeaveRequest(id) {
  return api.patch(`/teacher-leave-requests/${id}/approve`);
},

/**
 * Menolak izin mengajar guru (Kesiswaan / Waka Kurikulum).
 * PATCH /api/teacher-leave-requests/{id}/reject
 */
async rejectTeacherLeaveRequest(id) {
  return api.patch(`/teacher-leave-requests/${id}/reject`);
},
```

#### B. Pembersihan `localStorage` & Penyempurnaan `TeacherSchedulePage.jsx`
1. **Pembersihan State Lokal Tiruan**:
   - Menghapus pembacaan initial state dari `localStorage.getItem('teacher_leave_active')`.
   - Menghapus penulisan ke `localStorage` pada `handleSendLeave` dan penghapusan item pada `handleCancelLeave`.
2. **Sinkronisasi Data Izin dari Backend**:
   - Memanggil `leaveApi.getTeacherLeaveRequests({ per_page: 20 })` pada `useEffect` komponen.
   - Menyimpan daftar riwayat izin dalam state `teacherLeaves` (`useState([])`).
   - Mencocokkan perizinan yang relevan dengan tanggal jadwal yang sedang dilihat guru:
     - Jika ada izin berstatus `approved` pada tanggal tersebut: tampilkan badge `<Badge variant="warning">Izin Disetujui</Badge>`.
     - Jika ada izin berstatus `pending` pada tanggal tersebut: tampilkan badge `<Badge variant="info">Izin Menunggu Verifikasi</Badge>`.
     - Jika izin berstatus `rejected`: abaikan atau tampilkan status normal jadwal.
3. **Penyediaan Modal "Riwayat Izin Mengajar"**:
   - Menambahkan tombol "Riwayat Izin" pada header halaman di samping tombol "Ajukan Izin Mengajar".
   - Menampilkan modal dengan tabel riwayat izin: Tanggal, Alasan, Status Approval, Link Surat Izin, dan Dokumen Tugas Titipan.
4. **Validasi Form Pengajuan Izin**:
   - Mengirim payload ke `leaveApi.submitTeacherLeaveRequest` dengan field: `date`, `reason`, `schedule_ids`, `attachment`, `task_instruction`, `task_attachment`.
   - Menangani error HTTP 422 secara terstruktur (misalnya: duplikasi pengajuan di tanggal yang sama).

---

### 3.2 Fase 4b: Pusat Verifikasi Izin & Proteksi Hak Akses Wali Kelas

Lokasi file: `frontend/scp_web/src/pages/teacher/PermissionVerifyPage.jsx`

#### A. Proteksi Hak Akses Wali Kelas pada Tab Siswa (Read-Only)
1. **Identifikasi Kemampuan Verifikasi (*Capability Check*)**:
   ```javascript
   const canVerify = useMemo(() => {
     return hasRole('waka') || isKesiswaan();
   }, [hasRole, isKesiswaan]);
   ```
2. **Kondisional Render Kolom Aksi**:
   - Jika `canVerify === true`: tampilkan tombol **Setujui** (`handleUpdateStatus(row.id, 'approved')`) dan **Tolak** (`handleUpdateStatus(row.id, 'rejected')`).
   - Jika `canVerify === false` (yaitu guru adalah Wali Kelas murni):
     - Tampilkan badge informatif: `<Badge variant="warning">Menunggu Kesiswaan</Badge>`.
     - Tidak menampilkan tombol tindakan yang berisiko memicu HTTP 403.
     - Tambahkan pesan banner di bagian atas: *"Sebagai Wali Kelas, Anda memiliki akses pemantauan (Read-Only) terhadap perizinan siswa di kelas binaan Anda. Persetujuan akhir dilakukan oleh Tim Kesiswaan/Piket."*

#### B. Penambahan Tab Perizinan Guru untuk Kesiswaan & Waka
1. **Navigasi Tab Tingkat Atas**:
   - Jika pengguna memiliki hak `canVerify` (Kesiswaan atau Waka), sediakan tab utama:
     - **Tab 1: Perizinan Siswa** (daftar izin siswa mandiri & verifikasi).
     - **Tab 2: Perizinan Guru** (daftar pengajuan izin mengajar guru & verifikasi).
   - Jika pengguna adalah Wali Kelas murni, sembunyikan navigasi Tab Tingkat Atas dan langsung fokuskan ke Tab Siswa (Read-Only).
2. **Tabel & Aksi Verifikasi Izin Guru (Tab 2)**:
   - Mengambil data via `leaveApi.getTeacherLeaveRequests({ per_page: 50 })`.
   - Kolom tabel:
     - **No**: Nomor urut.
     - **Guru Pengajar**: Nama guru (`row.teacher?.name`) & NIP (`row.teacher?.nis_nip`).
     - **Tanggal Izin**: Tanggal tidak hadir.
     - **Alasan & Keterangan**: Alasan tidak hadir.
     - **Tugas Titipan**: Keterangan instruksi tugas & link unduh berkas tugas (`task_attachment_path`).
     - **Surat Izin**: Link unduh/lihat surat keterangan (`attachment_path`).
     - **Status**: Badge (`pending`, `approved`, `rejected`).
     - **Aksi Verifikasi**:
       - Tombol **Setujui** $\rightarrow$ memanggil `leaveApi.approveTeacherLeaveRequest(row.id)`.
       - Tombol **Tolak** $\rightarrow$ memanggil `leaveApi.rejectTeacherLeaveRequest(row.id)`.

---

### 3.3 Fase 4c: Penyesuaian Multirole Wali Kelas pada Jadwal & Jurnal

#### A. Selektor Jadwal Kelas Binaan pada `TeacherSchedulePage.jsx`
1. **Deteksi Peran Wali Kelas & Kelas Binaan**:
   - Memeriksa apakah `user.assignments` memuat penugasan `type === 'wali_kelas'`.
   - Mengambil informasi kelas binaan: `homeroomClass = user.assignments.find(a => a.type === 'wali_kelas')`.
   - Mengambil `homeroomClassId = homeroomClass?.class_id`.
2. **Tab / Toggle View Mode**:
   - Jika guru memiliki peran wali kelas, tampilkan toggle di header:
     - **[Jadwal Mengajar Saya]** (default)
     - **[Jadwal Kelas Binaan ({nama_kelas})]**
3. **Pemuatan Data Sesuai Tab Aktif**:
   - Jika tab **Jadwal Mengajar Saya** aktif: panggil `journalApi.getTeacherSchedules({ per_page: 100 })`.
   - Jika tab **Jadwal Kelas Binaan** aktif: panggil `scheduleApi.getSchedules({ class_id: homeroomClassId, per_page: 100 })`.
   - Seluruh jadwal rombel pada kelas binaan ditampilkan lengkap dengan nama guru pengampu masing-masing mapel.

#### B. Perbaikan Guard Check & Otorisasi pada `TeacherJournalPage.jsx`
1. **Koreksi Logika Penolakan Akses (*Guard Check*)**:
   Ubah baris 79-83 pada `frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx`:
   ```javascript
   // Sebelum:
   const isAccessDenied = useMemo(() => {
     if (!schedule || !user) return false;
     return !isOriginalTeacher && !isKesiswaan();
   }, [schedule, user, isOriginalTeacher, isKesiswaan]);

   // Sesudah:
   const isAccessDenied = useMemo(() => {
     if (!schedule || !user) return false;
     const isHomeroomOfClass = isWaliKelas(schedule.class_id);
     // Diizinkan jika: Guru Asli, Tim Kesiswaan, Waka Kurikulum, ATAU Wali Kelas dari rombel tersebut
     return !isOriginalTeacher && !isKesiswaan() && !hasRole('waka') && !isHomeroomOfClass;
   }, [schedule, user, isOriginalTeacher, isKesiswaan, hasRole, isWaliKelas]);
   ```
2. **Mode Pengganti Kesiswaan vs Wali Kelas**:
   Perbarui `isSubstituteMode` agar merefleksikan peran pengganti:
   ```javascript
   const isSubstituteMode = useMemo(() => {
     if (isOriginalTeacher) return false;
     return isKesiswaan() || isWaliKelas(schedule?.class_id);
   }, [isOriginalTeacher, isKesiswaan, isWaliKelas, schedule?.class_id]);
   ```
3. **Proteksi Tombol "Tandai Guru Berhalangan Hadir (Jam Kosong)"**:
   Backend `JournalController@markTeacherAbsent` strictly membatasi: hanya Guru Kesiswaan atau Waka Kurikulum yang berhak. Wali Kelas murni ditolak (HTTP 403).
   Maka di `TeacherJournalPage.jsx`, tombol aksi *Jam Kosong* disembunyikan jika pengguna bukan Kesiswaan dan bukan Waka:
   ```javascript
   const canMarkAbsent = isKesiswaan() || hasRole('waka');
   // Render tombol jam kosong hanya jika canMarkAbsent bernilai true
   ```

---

### 3.4 Fase 4d: Polling Asinkron Upload Import PDF FET

Lokasi file: `frontend/scp_web/src/pages/waka/UploadImportPage.jsx`

#### A. Penghapusan Simulasi `setTimeout` Palsu
- Menghapus deklarasi `t1`, `t2` berbasis durasi tetap (1200ms & 2400ms).
- Menghapus blok demo fallback di dalam blok `catch` yang menggunakan `Date.now()`.

#### B. Implementasi Polling Otentik Berkala
1. **Inisialisasi Ref Polling**:
   Menggunakan `pollingIntervalRef = useRef(null)` untuk menyimpan referensi timer interval.
2. **Alur Polling**:
   - Setelah berkas PDF diunggah ke `POST /api/schedule-imports` dan menerima respons HTTP 202 Accepted dengan `res.data.id`:
   - Simpan `batchId = res.data.id`.
   - Set status tampilan ke `parsing` dan update teks status menjadi: *"Berkas diterima di antrean server (HTTP 202). Memproses ekstraksi koordinat FET..."*.
   - Jalankan polling `scheduleImportApi.getScheduleImport(batchId)` setiap 1500 ms (1.5 detik).
3. **Evaluasi Status Batch**:
   - Jika status respons `status === 'preview_ready'`:
     - Hentikan interval polling (`clearInterval`).
     - Set progress value ke 100%.
     - Set status tampilan ke `preview_ready`.
     - Tampilkan notifikasi sukses dan arahkan pengguna ke halaman peninjauan: `navigate('/web/review-import/' + batchId)`.
   - Jika status respons `status === 'failed'`:
     - Hentikan interval polling.
     - Set status tampilan ke `error`.
     - Tampilkan pesan kesalahan dari backend: *"Gagal mengekstrak berkas PDF jadwal. Pastikan struktur berkas sesuai format FET."*.
   - Jika masih berstatus `uploaded` atau `parsing`:
     - Tingkatkan progress bar secara proporsional (misalnya bergerak di kisaran 50% - 90%) untuk memberikan umpan balik visual bahwa server sedang bekerja.
4. **Pembersihan Timer pada Siklus Hidup Komponen (*Cleanup on Unmount & Reset*)**:
   - Tambahkan fungsi pembersihan interval pada return callback `useEffect` dan pada `handleReset`:
   ```javascript
   const clearPolling = () => {
     if (pollingIntervalRef.current) {
       clearInterval(pollingIntervalRef.current);
       pollingIntervalRef.current = null;
     }
   };
   ```

---

### 3.5 Fase 4e: Pembersihan Simulasi Offline Promosi Kelas Massal

Lokasi file: `frontend/scp_web/src/pages/waka/GradePromotionPage.jsx`

#### A. Pembersihan Blok `handleExecutePromotion`
Pada implementasi saat ini di baris 155-165, blok `catch` menjalankan manipulasi lokal tiruan:
```javascript
// KODE LAMA YANG AKAN DIHAPUS:
} catch {
  // Offline simulation
  const resultData = {
    total_students: studentList.length,
    promoted: studentList.filter((s) => !s.is_held_back).length,
    held_back: studentList.filter((s) => s.is_held_back).length,
    graduated: 1,
  };
  setPromotionResult(resultData);
  setIsConfirmModalOpen(false);
}
```

#### B. Implementasi Penanganan Error Otentik
Mengganti blok tersebut dengan penanganan error riil yang transparan kepada pengguna:
```javascript
// IMPLEMENTASI BARU:
} catch (err) {
  const errorMsg =
    err.response?.data?.message ||
    err.message ||
    'Gagal mengeksekusi proses kenaikan kelas massal. Silakan periksa kembali koneksi server.';
  alert(errorMsg);
} finally {
  setIsExecuting(false);
}
```
- Menutup modal konfirmasi hanya jika eksekusi benar-benar berhasil (`setIsConfirmModalOpen(false)` dipindahkan ke dalam blok `try`).
- Jika terjadi error pada backend (misal HTTP 422 atau 500), modal tidak menampilkan data kelulusan palsu, dan status siswa di UI tetap utuh tidak berubah.
- Pada `handleToggleHoldBack`, jika pemanggilan API gagal, kembalikan status toggle ke nilai aslinya dan tampilkan pesan kesalahan alih-alih melakukan silent update.

---

## 4. Daftar Lengkap Berkas Terdampak & Matriks Perubahan

| No | Berkas | Sub-Fase | Sifat Perubahan | Komponen / Method Terdampak |
|---|---|:---:|:---:|---|
| 1 | `frontend/scp_web/src/services/leaveApi.js` | 4a, 4b | Penambahan | Menambahkan `approveTeacherLeaveRequest` dan `rejectTeacherLeaveRequest`. |
| 2 | `frontend/scp_web/src/pages/teacher/TeacherSchedulePage.jsx` | 4a, 4c | Modifikasi & Refactoring | - Hapus ketergantungan `localStorage`.<br>- Sinkronisasi status izin dari backend `getTeacherLeaveRequests`.<br>- Tambah modal "Riwayat Izin Mengajar".<br>- Tambah selektor tab "Jadwal Saya" vs "Jadwal Kelas Binaan". |
| 3 | `frontend/scp_web/src/pages/teacher/PermissionVerifyPage.jsx` | 4b | Modifikasi & Penambahan | - Proteksi Wali Kelas (Read-Only pada tab siswa).<br>- Tambah tab perizinan guru untuk Kesiswaan/Waka dengan aksi approve/reject. |
| 4 | `frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx` | 4c | Modifikasi | - Perbaiki guard otorisasi agar Wali Kelas dapat membuka KBM darurat.<br>- Sembunyikan tombol jam kosong (`teacher_absent`) dari Wali Kelas murni. |
| 5 | `frontend/scp_web/src/pages/waka/UploadImportPage.jsx` | 4d | Modifikasi | - Ganti fake `setTimeout` dengan interval polling nyata 1.5 detik.<br>- Handle transisi status `preview_ready` dan `failed`.<br>- Cleanup polling timer pada unmount & reset. |
| 6 | `frontend/scp_web/src/pages/waka/GradePromotionPage.jsx` | 4e | Pembersihan | - Hapus simulasi offline di catch block `handleExecutePromotion`.<br>- Tampilkan alert/notifikasi error otentik backend. |

---

## 5. Urutan dan Tahapan Pengerjaan

Pelaksanaan Fase 4 akan dijalankan secara modular dan bertahap mengikuti urutan ketergantungan komponen:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        URUTAN EKSEKUSI FASE 4                          │
├────────────────────────────────────────────────────────────────────────┤
│ 1. [leaveApi.js]               Tambah approve & reject teacher leave   │
│ 2. [PermissionVerifyPage.jsx]  Proteksi Wali Kelas & Tab Izin Guru    │
│ 3. [TeacherSchedulePage.jsx]   Hapus localStorage, riwayat izin,      │
│                                selektor jadwal kelas binaan            │
│ 4. [TeacherJournalPage.jsx]    Guard KBM darurat Wali Kelas & hide     │
│                                tombol jam kosong bagi wali kelas       │
│ 5. [UploadImportPage.jsx]      Polling berkala 1.5s PDF FET            │
│ 6. [GradePromotionPage.jsx]    Hapus offline catch simulation          │
│ 7. Verifikasi & Build          Build frontend & validasi seluruh test  │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Langkah 1 (Service Layer)**: Perbarui `leaveApi.js` untuk menyediakan method approval dan rejection izin guru.
2. **Langkah 2 (Pusat Verifikasi)**: Perbarui `PermissionVerifyPage.jsx` untuk menambahkan tab verifikasi guru dan memberlakukan status Read-Only bagi wali kelas.
3. **Langkah 3 (Jadwal Guru & Izin)**: Perbarui `TeacherSchedulePage.jsx` untuk menghilangkan localStorage, menambahkan riwayat izin dari backend, dan menambahkan selektor jadwal kelas binaan.
4. **Langkah 4 (Jurnal & Presensi)**: Perbarui `TeacherJournalPage.jsx` agar wali kelas dapat mengisi jurnal kelas binaannya tanpa terkena 403, serta menyembunyikan tombol status guru berhalangan dari wali kelas.
5. **Langkah 5 (Upload Asinkron)**: Perbarui `UploadImportPage.jsx` dengan implementasi interval polling berkala dan pembersihan timer.
6. **Langkah 6 (Kenaikan Kelas)**: Bersihkan simulasi offline pada `GradePromotionPage.jsx`.
7. **Langkah 7 (Verifikasi Menyeluruh)**: Jalankan `npm run build` pada frontend dan verifikasi suite pengujian backend Laravel (`php artisan test`).

---

## 6. Rencana Pengujian Komprehensif

### 6.1 Backend Automated Tests (PHPUnit)
Memastikan seluruh suite pengujian terkait pada backend tetap lulus 100%:
1. `TeacherLeaveRequestTest.php` (17 pengujian: pengajuan izin, validasi lampiran, pencegahan duplikasi tanggal, approval Kesiswaan/Waka, penolakan akses guru lain).
2. `LeaveRequestFeatureTest.php` (17 pengujian: pengajuan izin siswa, verifikasi Kesiswaan/Waka, proteksi role).
3. `WaliKelasAccessTest.php` (13 pengujian: akses jadwal kelas binaan, pengisian jurnal darurat oleh wali kelas, penolakan approval siswa oleh wali kelas, penolakan aksi jam kosong oleh wali kelas).
4. `ClassPromotionTest.php` (pengujian transaksi kenaikan kelas massal dan kelulusan tingkat akhir).
5. `ScheduleImportTest.php` (pengujian status asinkron import PDF FET).

### 6.2 Frontend Manual & Integration Verification
1. **Skenario Izin Guru (Fase 4a)**:
   - Login sebagai guru regular (`guru@example.com`).
   - Buka `/teacher/schedule`, klik "Ajukan Izin Mengajar".
   - Isi form (tanggal hari ini, alasan, pilih jadwal yang didelegasikan, unggah lampiran surat dan tugas).
   - Pastikan data terkirim ke backend dan riwayat izin muncul di modal "Riwayat Izin Mengajar".
   - Pastikan kartu jadwal pada tanggal izin merefleksikan badge status izin pending/disetujui.
2. **Skenario Verifikasi Izin Kesiswaan vs Wali Kelas (Fase 4b)**:
   - Login sebagai Wali Kelas murni (`walikelas@example.com`).
   - Masuk ke `/teacher/permissions`.
   - Pastikan Tab Perizinan Guru **tidak tampil**.
   - Pastikan pada Tab Siswa, tombol "Setujui" dan "Tolak" **tidak ada**, dan kolom aksi bertuliskan *"Menunggu Verifikasi Kesiswaan"*.
   - Login sebagai Guru Kesiswaan (`kesiswaan@example.com`).
   - Masuk ke `/teacher/permissions`.
   - Pastikan kedua tab (Siswa & Guru) tampil.
   - Pada Tab Guru, lakukan persetujuan (Approve) izin guru yang diajukan pada skenario 4a.
3. **Skenario Multirole Wali Kelas pada Jadwal & Jurnal (Fase 4c)**:
   - Login sebagai Wali Kelas.
   - Buka `/teacher/schedule`, beralih ke tab *"Jadwal Kelas Binaan"*.
   - Verifikasi bahwa seluruh jadwal mata pelajaran kelas binaan tampil dengan benar.
   - Klik salah satu jadwal kelas binaan yang gurunya tidak hadir untuk membuka sesi darurat.
   - Masuk ke `/teacher/journal`: pastikan **TIDAK** muncul halaman Forbidden 403.
   - Pastikan tombol *"Tandai Guru Berhalangan Hadir (Jam Kosong)"* **tidak muncul**.
   - Isi materi pengajaran pengganti dan simpan jurnal.
4. **Skenario Polling Asinkron Upload PDF (Fase 4d)**:
   - Login sebagai Waka Kurikulum.
   - Buka `/web/upload-import`, pilih siklus dan unggah dua berkas PDF jadwal FET.
   - Klik "Mulai Proses Impor".
   - Verifikasi progress bar berjalan dan secara otomatis berpindah ke `/web/review-import/:id` setelah status menjadi `preview_ready`.
   - Buka tab lain / navigasikan keluar saat upload berlangsung untuk memastikan tidak terjadi kebocoran memori (timer dibersihkan).
5. **Skenario Simulasi Offline Promosi Kelas (Fase 4e)**:
   - Login sebagai Waka Kurikulum, buka `/web/grade-promotion`.
   - Lakukan uji coba kenaikan kelas. Jika backend mengembalikan kegagalan, verifikasi bahwa pesan error backend tampil di alert dan data siswa tidak berubah secara semu.

---

## 7. Analisis Risiko & Strategi Mitigasi

| Risiko | Dampak | Probabilitas | Strategi Mitigasi |
|---|:---:|:---:|---|
| **Kebocoran Memori Polling (*Orphaned Timers*)** | Sedang | Sedang | Menggunakan `useRef` untuk menyimpan timer interval, dan memanggil `clearInterval` secara ketat pada cleanup callback `useEffect` saat unmount komponen atau saat reset form. |
| **Konflik Multi-Role (Wali Kelas merangkap Kesiswaan)** | Tinggi | Rendah | Menggunakan pemisahan kapabilitas berbasis fungsi `canVerify = hasRole('waka') || isKesiswaan()`. Jika guru memiliki kedua peran, wewenang verifikasi tetap terbuka tanpa saling mengesampingkan. |
| **State Duplikasi Izin pada Kalender Jadwal** | Rendah | Sedang | Pencocokan izin mengajar dilakukan secara spesifik berdasarkan tanggal (`date === scheduleDate`), bukan sekadar flag boolean global. |
| **Kegagalan Ekstraksi PDF FET di Server (Timeout/Error)** | Sedang | Rendah | Polling dibatasi maksimum 60 detik (40 iterasi). Jika status belum `preview_ready` atau berubah menjadi `failed`, interval dihentikan dan UI menampilkan opsi "Coba Lagi" dengan rincian log kesalahan. |

---

## 8. Acceptance Criteria (Kriteria Keberhasilan)

Fase 4 dinyatakan selesai dan sukses jika seluruh kriteria berikut terpenuhi:
1. `leaveApi.js` memiliki fungsi `approveTeacherLeaveRequest` dan `rejectTeacherLeaveRequest` yang terintegrasi ke backend.
2. `TeacherSchedulePage.jsx` bersih dari pembacaan dan penulisan `localStorage` tiruan perizinan, serta memiliki modal riwayat izin guru dan selektor jadwal kelas binaan bagi wali kelas.
3. `PermissionVerifyPage.jsx` membedakan hak akses secara tegas: Wali Kelas murni berstatus Read-Only tanpa tombol aksi pada izin siswa, serta Kesiswaan/Waka memiliki akses Tab Perizinan Guru untuk menyetujui atau menolak izin mengajar.
4. `TeacherJournalPage.jsx` mengizinkan Wali Kelas membuka dan mengisi sesi KBM darurat pada rombel binaannya tanpa error 403, sekaligus menyembunyikan tombol aksi `teacher_absent`.
5. `UploadImportPage.jsx` menggunakan polling riil setiap 1.5 detik ke backend untuk memantau status parsing tanpa fake `setTimeout` atau demo fallback, dan timer dibersihkan saat halaman ditutup.
6. `GradePromotionPage.jsx` tidak lagi menyimulasikan kelulusan/kenaikan kelas tiruan di blok catch, melainkan menangani error backend secara transparan.
7. Seluruh pengujian backend (`TeacherLeaveRequestTest`, `WaliKelasAccessTest`, dll.) dan frontend build (`npm run build`) berjalan bersih tanpa error.

---

## 9. Hal yang Membutuhkan Keputusan Pengguna

Sebelum memulai implementasi kode program, mohon konfirmasi untuk 3 (tiga) keputusan desain berikut:

1. **Tampilan Riwayat Izin Guru pada `TeacherSchedulePage`**:
   - **Opsi A (Direkomendasikan)**: Menambahkan tombol *"Riwayat Izin Saya"* di header halaman jadwal yang membuka Modal berisi tabel riwayat pengajuan izin (Tanggal, Alasan, Lampiran, Status Badge: Pending/Approved/Rejected, Verifikator). Ditambah banner informatif di atas kalender jika pada hari aktif terdapat izin mengajar.
   - **Opsi B**: Mengganti tampilan jadwal dengan sub-tab terpisah di halaman yang sama: [Jadwal Mengajar] dan [Riwayat Izin Mengajar].
   - *Rekomendasi:* **Opsi A** (lebih ringkas dan tidak memecah fokus guru saat melihat jadwal harian).

2. **Penataan Navigasi Tab pada `PermissionVerifyPage`**:
   - **Opsi A (Direkomendasikan)**: Untuk Kesiswaan dan Waka, disediakan 2 Top-Level Tabs:
     - Tab 1: **Perizinan Siswa** (dengan filter: Menunggu, Semua, Disetujui, Ditolak).
     - Tab 2: **Perizinan Guru** (dengan filter: Menunggu, Semua, Disetujui, Ditolak, beserta kolom surat tugas dan tombol Setujui/Tolak).
     Bagi Wali Kelas murni, halaman langsung menampilkan Tab Siswa (Read-Only) tanpa tombol aksi dan tanpa Tab Guru.
   - **Opsi B**: Menggabungkan daftar izin siswa dan guru ke dalam satu tabel tunggal dengan penambahan kolom tipe permohonan ("Siswa" / "Guru").
   - *Rekomendasi:* **Opsi A** (karena struktur data, dokumen bukti, dan alur tindak lanjut izin guru dan izin siswa berbeda secara signifikan).

3. **Batas Maksimal Waktu Polling (*Timeout*) Upload PDF FET**:
   - Polling berkala dilakukan setiap 1.5 detik.
   - Rekomendasi batas maksimum: 60 detik (40 kali polling). Jika setelah 60 detik berkas belum selesai diekstrak, polling berhenti dan sistem menampilkan pesan: *"Proses ekstraksi memakan waktu lebih lama dari biasanya. Anda dapat menunggu beberapa saat atau memeriksa halaman reviu jadwal."* disertai tombol "Periksa Status Ulang".
   - Apakah durasi interval 1.5 detik dan timeout 60 detik ini disetujui?
