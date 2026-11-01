# Rencana Implementasi Teknis: Fase 3 (P2)
## Modul Impor Excel Master Data & Pembersihan Initial State

> **Dokumen Terkait:** [`INTEGRATION_FIX_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/INTEGRATION_FIX_PLAN.md)  
> **Target Branch / Workspace:** `main` / `D:\MyUKK\SchoolClassProject`  
> **Status Dokumen:** DRAFT PERENCANAAN (Menunggu Persetujuan)  
> **Batasan:** DILARANG mengubah kode atau menjalankan migrasi sebelum persetujuan eksplisit.

---

## 1. Ringkasan Fase 3 (P2)

Fase 3 bertujuan mengintegrasikan modul impor data massal berbasis spreadsheet Excel (`.xlsx`) untuk Guru dan Siswa pada antarmuka Waka Kurikulum, menyelaraskan form manual siswa, serta menghapus seluruh data tiruan (*fallback initial state*) pada halaman master data dan kenaikan kelas.

### Tujuan Utama
1. **Integrasi Impor Guru Excel**:
   - Mengintegrasikan download template resmi `guru_import_template.xlsx` dari `GET /api/teachers/import-template`.
   - Mengintegrasikan pengunggahan berkas Excel via `POST /api/teachers/import` (multipart `.xlsx`, max 5 MB).
   - Menampilkan modal impor dengan drag-and-drop, validasi format, dan tabel rekapitulasi error per baris (`{ row, attribute, message }`).
   - Memicu auto-provisioning akun Guru (`role: teacher`, password default NIP, `must_change_password: true`) dan pemetaan `fet_staff_id`.
2. **Integrasi Impor Siswa & Auto-Create Kelas (Zero-Manual v4.5)**:
   - Mengintegrasikan download template resmi `siswa_import_template.xlsx` dari `GET /api/students/import-template`.
   - Mengintegrasikan pengunggahan berkas Excel via `POST /api/students/import`.
   - Menangani otomatisasi backend: pembuatan kelas rombel baru secara otomatis (*auto-created* dengan deteksi level 10/11/12) dan pembuatan akun orang tua (`role: parent`, username `P-{nis}`).
   - Menampilkan notifikasi sukses yang merinci jumlah siswa, kelas baru, dan akun orang tua yang berhasil dibuat.
   - Menyelaraskan form manual Tambah & Edit Siswa dengan dropdown `gender` (`L`/`P`) dan input `nisn` (opsional, 10 digit angka numerik).
3. **Pembersihan Fallback Initial State**:
   - Menghapus konstanta data dummy (`FALLBACK_CLASSES`, `FALLBACK_ROOMS`, `FALLBACK_SUBJECTS`, `FALLBACK_TEACHERS`, `FALLBACK_STUDENTS`) pada `MasterDataPage.jsx`.
   - Menghapus konstanta data dummy (`FALLBACK_CLASSES`, `FALLBACK_STUDENTS`) pada `GradePromotionPage.jsx`.
   - Memverifikasi state `rows` pada `ReviewImportPage.jsx` murni menggunakan `useState([])`.
   - Memastikan `EmptyState` resmi tampil anggun ketika database belum memiliki data.

---

## 2. Analisis Kondisi Saat Ini & Kesenjangan Sistem

### 2.1 Analisis Backend (`scp`)

| Endpoint | Method | Middleware | Controller & Method | Status Backend |
|---|:---:|---|---|:---:|
| `/api/teachers/import-template` | `GET` | `auth:sanctum`, `role:vice_principal` | [`TeacherController@downloadTemplate`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/TeacherController.php#L23-L60) | **Aktif 100%** |
| `/api/teachers/import` | `POST` | `auth:sanctum`, `role:vice_principal` | [`TeacherController@import`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/TeacherController.php#L65-L247) | **Aktif 100%** |
| `/api/students/import-template` | `GET` | `auth:sanctum`, `role:vice_principal` | [`StudentController@downloadTemplate`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/StudentController.php#L23-L73) | **Aktif 100%** |
| `/api/students/import` | `POST` | `auth:sanctum`, `role:vice_principal` | [`StudentController@import`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/StudentController.php#L78-L364) | **Aktif 100%** |

#### Karakteristik Teknis Kontrak Backend:
1. **Format Template Download**:
   - Menghasilkan file Excel biner (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) dengan header `Content-Disposition: attachment; filename=guru_import_template.xlsx` atau `siswa_import_template.xlsx`.
   - Menggunakan fallback *stream generator* menggunakan `spatie/simple-excel` jika berkas statis belum ada di storage.
2. **Validasi & Transaksi Impor (All-or-Nothing / Atomic Streaming)**:
   - File wajib memiliki MIME type spreadsheet dan ekstensi `.xlsx` dengan ukuran $\le 5\text{ MB}$.
   - Memeriksa header wajib:
     - Guru: `nip`, `name`, `fet_staff_id` (opsional: `email`, `phone_number`).
     - Siswa: `nis`, `name`, `class_name`, `gender` (opsional: `nisn`, `parent_name`, `parent_phone`).
   - Memeriksa duplikasi internal berkas (*in-sheet duplicates*) dan duplikasi terhadap basis data aktif.
   - Jika terdapat $\ge 1$ baris tidak valid, **seluruh transaksi di-rollback** (`DB::transaction`) dan mengembalikan HTTP 422:
     ```json
     {
       "success": false,
       "message": "Validasi berkas gagal pada beberapa baris.",
       "errors": [
         { "row": 2, "attribute": "nip", "message": "Kolom NIP wajib diisi." },
         { "row": 5, "attribute": "gender", "message": "Jenis kelamin harus bernilai L atau P." }
       ]
     }
     ```
   - Jika header hilang atau berkas kosong, mengembalikan HTTP 422:
     ```json
     {
       "success": false,
       "message": "Format berkas tidak valid. Kolom header fet_staff_id wajib tersedia.",
       "errors": null
     }
     ```
   - Jika sukses (HTTP 201):
     - Guru:
       ```json
       {
         "success": true,
         "message": "Data guru berhasil diimpor.",
         "data": { "imported_count": 2 }
       }
       ```
     - Siswa:
       ```json
       {
         "success": true,
         "message": "Data siswa dan kelas berhasil diimpor.",
         "data": {
           "classes_created": 2,
           "classes_existing": 0,
           "students_imported": 3,
           "parents_imported": 3
         }
       }
       ```

### 2.2 Analisis Frontend (`frontend/scp_web`)

1. **`services/masterDataApi.js`**:
   - Objek `teacherApi` dan `studentApi` belum memiliki fungsi `downloadTemplate` dan `importTeachers` / `importStudents`.
   - Axios instance di `services/api.js` mengembalikan `response.data` pada level interceptor. Untuk endpoint download biner (`responseType: 'blob'`), `response.data` adalah objek `Blob`.
2. **`pages/waka/MasterDataPage.jsx`**:
   - Header halaman hanya memiliki tombol "Refresh" dan "Tambah Data". Belum ada tombol "Unduh Template Excel" dan "Impor Excel" pada Tab Guru maupun Tab Siswa.
   - Belum ada modal dialog untuk mengunggah file Excel guru dan siswa.
   - Inisialisasi state masih mengimpor konstanta lokal dummy:
     - `classList`: `useState(FALLBACK_CLASSES)` (12 rombel tiruan).
     - `roomList`: `useState(FALLBACK_ROOMS)` (6 ruang tiruan).
     - `subjectList`: `useState(FALLBACK_SUBJECTS)` (7 mapel tiruan).
     - `teacherList`: `useState(FALLBACK_TEACHERS)` (3 guru tiruan).
     - `studentList`: `useState(FALLBACK_STUDENTS)` (4 siswa tiruan).
   - Form manual siswa:
     - Field `gender` sudah ada di JSX namun opsi dropdown masih opsional (`Pilih Jenis Kelamin (Opsional)`), belum ditegaskan sebagai `L` / `P`.
     - Field `nisn` saat ini memiliki `maxLength={20}` dan belum ada filter pembatasan numerik 10 digit.
3. **`pages/waka/GradePromotionPage.jsx`**:
   - Inisialisasi state `classList` dan `studentList` masih menggunakan `FALLBACK_CLASSES` dan `FALLBACK_STUDENTS` (L48-49).
   - Menyebabkan tabel pemetaan kenaikan kelas dan daftar siswa hold-back menampilkan data palsu saat koneksi offline atau database baru.
4. **`pages/waka/ReviewImportPage.jsx`**:
   - State `rows` pada baris 69 sudah menggunakan `useState([])`. Verifikasi menunjukkan tidak ada data tiruan yang di-hardcode ke dalam state `rows`.

---

## 3. Rencana Implementasi Terperinci

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ALUR IMPLEMENTASI FASE 3                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. masterDataApi.js                                                    │
│    ├── teacherApi.downloadTemplate() & teacherApi.importTeachers()     │
│    └── studentApi.downloadTemplate() & studentApi.importStudents()     │
│                                                                        │
│ 2. MasterDataPage.jsx                                                  │
│    ├── Hapus 5 FALLBACK_* datasets ──> Inisialisasi useState([])        │
│    ├── Tab Guru ──> Tombol Unduh Template & Modal Impor Guru (.xlsx)    │
│    ├── Tab Siswa ──> Tombol Unduh Template & Modal Impor Siswa (.xlsx)  │
│    ├── Render Tabel Error Validasi Baris { row, attribute, message }   │
│    └── Penyesuaian Form Siswa Manual (Gender L/P, NISN 10 Digit)        │
│                                                                        │
│ 3. GradePromotionPage.jsx                                              │
│    └── Hapus 2 FALLBACK_* datasets ──> Inisialisasi useState([])        │
│                                                                        │
│ 4. ReviewImportPage.jsx                                                │
│    └── Verifikasi rows tetap useState([]) & tidak ada dummy data        │
└────────────────────────────────────────────────────────────────────────┘
```

### A. Bagian 3a — Integrasi Impor Excel Guru Massal

#### 1. Penambahan Method Service API ([`masterDataApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js))
Tambahkan pada objek `teacherApi`:
```javascript
export const teacherApi = {
  // ... fungsi yang sudah ada ...
  downloadTemplate: () => api.get('/teachers/import-template', { responseType: 'blob' }),
  importTeachers: (formData) =>
    api.post('/teachers/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
```

#### 2. Penambahan Aksi pada Tab Guru ([`MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx))
Pada bagian toolbar / header aksi ketika `activeTab === 'guru'`:
- Tombol **Unduh Template Excel**:
  - Memanggil `teacherApi.downloadTemplate()`.
  - Memicu unduhan browser secara otomatis dengan nama berkas `guru_import_template.xlsx`.
  - Memberikan indikator loading pada tombol saat proses unduh berlangsung.
- Tombol **Impor Guru (.xlsx)**:
  - Membuka modal dialog impor guru (`isTeacherImportModalOpen = true`).

#### 3. Modal Dialog Impor Guru
- Menggunakan komponen `Modal` berukuran `lg`.
- Berisi komponen `FileUpload`:
  - `accept=".xlsx"`
  - `maxSizeMB={5}`
  - `hint="Format berkas .xlsx (Excel), ukuran maksimal 5 MB"`
- Informasi panduan pengisian:
  - Kolom Wajib: `nip` (format text), `name`, `fet_staff_id`.
  - Kolom Opsional: `email`, `phone_number`.
  - Catatan sistem: Akun login guru dibuat otomatis dengan password default sama dengan NIP (`must_change_password: true`).
- Penanganan Hasil Impor:
  - **Kondisi Sukses (201)**:
    - Menampilkan alert sukses berisi jumlah guru yang berhasil diimpor (`imported_count`).
    - Memanggil `handleRefresh()` untuk memuat ulang daftar guru terbaru dari backend.
    - Menutup modal secara otomatis setelah 1,5 detik atau melalui tombol tutup.
  - **Kondisi Gagal Validasi Baris (422 dengan `errors` array)**:
    - Menampilkan banner peringatan: *"Terdapat kesalahan validasi pada berkas Excel. Seluruh perubahan dibatalkan (transaksi atomik). Perbaiki baris berikut dan unggah kembali:"*
    - Menampilkan **Tabel Rekapitulasi Error**:
      - Kolom 1: **Baris** (misal: "Baris 14")
      - Kolom 2: **Kolom / Atribut** (misal: `nip`, `fet_staff_id`, `email`)
      - Kolom 3: **Deskripsi Masalah** (misal: "NIP sudah terdaftar di sistem")
    - Tabel dibatasi dengan kontainer scrollable vertikal (`max-h-60 overflow-y-auto`) agar tetap rapi jika banyak baris error.
  - **Kondisi Gagal Berkas / Header (422 tanpa `errors` array atau 400)**:
    - Menampilkan banner pesan error langsung dari backend (misal: "Format berkas tidak valid. Kolom header fet_staff_id wajib tersedia.").

---

### B. Bagian 3b — Integrasi Impor Excel Siswa Massal & Penyelarasan Form

#### 1. Penambahan Method Service API ([`masterDataApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js))
Tambahkan pada objek `studentApi`:
```javascript
export const studentApi = {
  // ... fungsi yang sudah ada ...
  downloadTemplate: () => api.get('/students/import-template', { responseType: 'blob' }),
  importStudents: (formData) =>
    api.post('/students/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
```

#### 2. Penambahan Aksi pada Tab Siswa ([`MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx))
Ketika `activeTab === 'siswa'`:
- Tombol **Unduh Template Excel**:
  - Memanggil `studentApi.downloadTemplate()`.
  - Mengunduh berkas `siswa_import_template.xlsx`.
- Tombol **Impor Siswa (.xlsx)**:
  - Membuka modal dialog impor siswa (`isStudentImportModalOpen = true`).

#### 3. Modal Dialog Impor Siswa
- Komponen `Modal` berukuran `lg`.
- Komponen `FileUpload` (`accept=".xlsx"`, `maxSizeMB={5}`).
- Informasi panduan otomatisasi (Zero-Manual v4.5):
  - Kolom Wajib: `nis`, `name`, `class_name`, `gender` (`L` / `P`).
  - Kolom Opsional: `nisn` (10 digit angka), `parent_name`, `parent_phone`.
  - Otomatisasi Sistem:
    - Kelas rombel pada kolom `class_name` akan dibuat otomatis (*auto-created*) bila belum terdaftar, dengan tingkat kelas (10/11/12) terdeteksi otomatis.
    - Akun Orang Tua (`role: parent`, username `P-{nis}`) dibuat otomatis dan ditautkan ke siswa.
    - Akun Siswa (`role: student`, username `{nis}`) dibuat otomatis dengan password default `{nis}` (`must_change_password: true`).
- Penanganan Hasil Impor:
  - **Kondisi Sukses (201)**:
    - Menampilkan alert sukses informatif:
      *"Siswa berhasil diimpor dan kelas baru telah otomatis didaftarkan."*
    - Menampilkan ringkasan metrik:
      - Siswa diimpor: `{data.students_imported}`
      - Kelas baru dibuat: `{data.classes_created}`
      - Kelas yang sudah ada: `{data.classes_existing}`
      - Akun orang tua dibuat: `{data.parents_imported}`
    - **PENTING**: Memanggil pembaruan `studentList` DAN `classList` secara bersamaan (`Promise.all([studentApi.getStudents(), classApi.getClasses()])`) agar rombel kelas baru yang dibuat otomatis oleh backend langsung muncul di seluruh filter dan tab kelas tanpa perlu me-reload browser.
  - **Kondisi Gagal (422)**:
    - Menampilkan Tabel Rekapitulasi Error `{ row, attribute, message }` yang sama.

#### 4. Penyelarasan Form Tambah & Edit Siswa Manual
Pada modal form manual siswa (`activeTab === 'siswa'`):
1. **Field Jenis Kelamin (`gender`)**:
   - Menggunakan `<Select>` dengan opsi baku:
     - `""` (Pilih Jenis Kelamin)
     - `"L"` (Laki-laki)
     - `"P"` (Perempuan)
   - Mapping: disimpan ke `formData.gender` dan dikirim sebagai string `L` atau `P` (atau `null` jika kosong).
2. **Field NISN (`nisn`)**:
   - Menggunakan `<Input>` dengan pembatasan:
     - `maxLength={10}`
     - Validasi onChange: hanya menerima karakter angka numerik (`e.target.value.replace(/\D/g, '')`).
     - Helper text: *"Nomor Induk Siswa Nasional (10 digit angka, opsional)."*
     - Validasi frontend sebelum submit: jika diisi, wajib berupa string angka maksimal 10 karakter.
3. Sinkronisasi state:
   - Pada `handleOpenAdd`: inisialisasi `gender: ''`, `nisn: ''`.
   - Pada `handleOpenEdit`: set `gender: item.gender || ''`, `nisn: item.nisn || ''`.
   - Pada `handleSaveForm`: sertakan `gender` dan `nisn` pada payload create dan update.

---

### C. Bagian 3c — Pembersihan Hardcoded Initial State

#### 1. [`MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx)
- Hapus seluruh konstanta mock dummy:
  - `FALLBACK_CLASSES` (L35-48)
  - `FALLBACK_ROOMS` (L50-57)
  - `FALLBACK_SUBJECTS` (L59-67)
  - `FALLBACK_TEACHERS` (L69-94)
  - `FALLBACK_STUDENTS` (L96-125)
- Ubah deklarasi state (L133-137) menjadi:
  ```javascript
  const [classList, setClassList] = useState([]);
  const [roomList, setRoomList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [teacherList, setTeacherList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  ```
- Pada `handleOpenAdd` untuk siswa:
  - Ubah default `class_id`: `classList[0]?.id ? String(classList[0].id) : ''`.
  - Berikan validasi pada form jika `classList` masih kosong (tampilkan pesan bahwa Waka perlu menambahkan kelas terlebih dahulu atau mengimpor siswa via Excel).
- Pada blok `catch` pemanggilan API (`handleRefresh` dan `init`):
  - Hapus komentar mock offline dan pastikan state diatur ke array kosong `[]` jika fetch gagal, sehingga komponen `EmptyState` resmi tampil.

#### 2. [`GradePromotionPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/GradePromotionPage.jsx)
- Hapus konstanta mock dummy:
  - `FALLBACK_CLASSES` (L24-37)
  - `FALLBACK_STUDENTS` (L39-45)
- Ubah deklarasi state (L48-49) menjadi:
  ```javascript
  const [classList, setClassList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  ```
- Pada `handleRefresh` dan `init` `useEffect`:
  - Jika fetch API mengalami error/offline, atur state ke `[]`:
    ```javascript
    if (isMounted) {
      setClassList([]);
      setStudentList([]);
    }
    ```
- **Batasan Ketat Sesuai Instruksi**: Jangan mengubah logika eksekusi promosi massal atau menghapus simulasi promosi offline pada fase ini (penghapusan simulasi promosi offline dijadwalkan pada Fase 4e).

#### 3. [`ReviewImportPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx)
- Verifikasi baris 69:
  `const [rows, setRows] = useState([]);` sudah menggunakan array kosong.
  Pastikan tidak ada referensi data tiruan atau guard yang mempertahankan data dummy jika `rows` kosong.

---

## 4. Daftar Lengkap Berkas Terdampak & Rincian Perubahan

| No | Berkas | Perubahan yang Direncanakan |
|---|---|---|
| 1 | [`frontend/scp_web/src/services/masterDataApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js) | Tambahkan `downloadTemplate` dan `importTeachers` pada `teacherApi`. Tambahkan `downloadTemplate` dan `importStudents` pada `studentApi`. |
| 2 | [`frontend/scp_web/src/pages/waka/MasterDataPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MasterDataPage.jsx) | 1. Hapus 5 konstanta `FALLBACK_*`.<br>2. Ubah initial state 5 master dataset ke `useState([])`.<br>3. Tambahkan tombol Unduh Template & Impor Excel pada Tab Guru dan Tab Siswa.<br>4. Tambahkan Modal Impor Guru & Modal Impor Siswa beserta drag-and-drop `FileUpload`.<br>5. Tambahkan komponen Tabel Rekapitulasi Error per baris (`{ row, attribute, message }`).<br>6. Tambahkan notifikasi sukses informatif (termasuk auto-create kelas & akun ortu).<br>7. Sesuaikan form manual siswa: dropdown `gender` (`L`/`P`) dan input `nisn` (hanya 10 digit angka). |
| 3 | [`frontend/scp_web/src/pages/waka/GradePromotionPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/GradePromotionPage.jsx) | 1. Hapus 2 konstanta `FALLBACK_*`.<br>2. Ubah initial state `classList` dan `studentList` ke `useState([])`.<br>3. Pastikan penanganan catch block menyetel array kosong `[]`. |
| 4 | [`frontend/scp_web/src/pages/waka/ReviewImportPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ReviewImportPage.jsx) | Verifikasi kepatuhan initial state `rows = []` dan pastikan tidak ada data dummy fallback yang tersisa. |

---

## 5. Urutan dan Tahapan Pengerjaan

Pekerjaan diorganisasikan secara linier berdasarkan ketergantungan modul:

```
Tahap 1: Service Layer API Extension (masterDataApi.js)
   │
   ▼
Tahap 2: Pembersihan Initial State (MasterDataPage.jsx & GradePromotionPage.jsx)
   │
   ▼
Tahap 3: Penyelarasan Form Manual Siswa (Gender L/P & NISN 10 Digit)
   │
   ▼
Tahap 4: Implementasi Modul Impor Guru Excel (Tombol, Modal, Error Table)
   │
   ▼
Tahap 5: Implementasi Modul Impor Siswa Excel (Tombol, Modal, Auto-Create Class Refresh)
   │
   ▼
Tahap 6: Verifikasi & Pengujian Kompilasi (Vite Build & PHPUnit)
```

### Rincian per Tahap:
- **Tahap 1**: Menambahkan method `downloadTemplate` dan `importTeachers` pada `teacherApi`, serta `downloadTemplate` dan `importStudents` pada `studentApi` di `masterDataApi.js`.
- **Tahap 2**: Menghapus konstanta `FALLBACK_*` dan mengganti initial state menjadi `[]` pada `MasterDataPage.jsx` dan `GradePromotionPage.jsx`. Memverifikasi rendering `EmptyState`.
- **Tahap 3**: Memperbarui form Tambah & Edit Siswa di `MasterDataPage.jsx`: pastikan dropdown `gender` memiliki opsi `L` dan `P`, serta input `nisn` membatasi masukan hanya angka dengan panjang maksimal 10 digit.
- **Tahap 4**: Mengimplementasikan tombol unduh template guru dan modal dialog impor guru di `MasterDataPage.jsx` (Tab Guru), lengkap dengan penanganan error tabel baris.
- **Tahap 5**: Mengimplementasikan tombol unduh template siswa dan modal dialog impor siswa di `MasterDataPage.jsx` (Tab Siswa), lengkap dengan penanganan error tabel baris dan multi-dataset refresh (`classList` + `studentList`).
- **Tahap 6**: Menjalankan build frontend (`npm run build`) dan test suite backend (`php artisan test`) untuk memvalidasi zero regression.

---

## 6. Rencana Pengujian Komprehensif

### 6.1 Pengujian Unduh Template Excel
1. **Unduh Template Guru**:
   - Klik tombol "Unduh Template Excel" pada Tab Guru.
   - Verifikasi browser mengunduh berkas biner `.xlsx` bernama `guru_import_template.xlsx`.
   - Buka berkas dan pastikan kolom header memuat: `nip`, `name`, `fet_staff_id`, `email`, `phone_number`.
2. **Unduh Template Siswa**:
   - Klik tombol "Unduh Template Excel" pada Tab Siswa.
   - Verifikasi browser mengunduh berkas biner `.xlsx` bernama `siswa_import_template.xlsx`.
   - Buka berkas dan pastikan kolom header memuat: `nis`, `name`, `class_name`, `gender`, `nisn`, `parent_name`, `parent_phone`.

### 6.2 Pengujian Impor Excel Guru
1. **Berkas Valid**:
   - Unggah berkas Excel guru dengan format dan data valid.
   - Verifikasi pesan sukses menampilkan jumlah guru yang diimpor.
   - Verifikasi tabel guru pada halaman langsung ter-refresh dan menampilkan guru baru dengan NIP dan FET Staff ID yang tepat.
2. **Berkas dengan Error Header / Kosong (HTTP 422)**:
   - Unggah berkas tanpa kolom header `fet_staff_id`.
   - Verifikasi modal menampilkan banner error: *"Format berkas tidak valid. Kolom header fet_staff_id wajib tersedia."*
3. **Berkas dengan Error Baris Spesifik (HTTP 422 Atomik)**:
   - Unggah berkas yang memuat baris dengan NIP duplikat atau kolom wajib kosong.
   - Verifikasi modal menampilkan **Tabel Rekapitulasi Error**:
     - Memverifikasi nomor baris akurat sesuai baris di spreadsheet.
     - Memverifikasi kolom yang salah ditampilkan (misal: `nip`, `fet_staff_id`).
     - Memverifikasi transaksi atomik bekerja (tidak ada guru yang tersimpan sebagian ke database).

### 6.3 Pengujian Impor Excel Siswa & Auto-Create Kelas
1. **Berkas Valid dengan Kelas Baru**:
   - Unggah berkas siswa yang memuat nama rombel baru (misal: `X RPL 3`, `XI TKJ 1`).
   - Verifikasi pesan sukses: *"Siswa berhasil diimpor dan kelas baru telah otomatis didaftarkan."*
   - Verifikasi metrik summary menampilkan `classes_created`, `students_imported`, `parents_imported`.
   - Verifikasi tab Siswa memuat siswa baru dan tab Kelas memuat kelas baru dengan level yang tepat (10 atau 11).
2. **Berkas dengan Error Validasi Gender / NISN**:
   - Unggah berkas dengan nilai gender bukan `L` atau `P` (misal: `X`).
   - Verifikasi modal menampilkan Tabel Rekapitulasi Error dengan keterangan *"Jenis kelamin harus bernilai L atau P"*.

### 6.4 Pengujian Validasi Form Manual Siswa
1. **Field Gender**:
   - Pilih `L` $\rightarrow$ simpan $\rightarrow$ periksa badge di tabel menampilkan `L (Laki-laki)`.
   - Pilih `P` $\rightarrow$ simpan $\rightarrow$ periksa badge di tabel menampilkan `P (Perempuan)`.
2. **Field NISN**:
   - Ketik huruf atau simbol $\rightarrow$ verifikasi input menolak karakter non-angka.
   - Ketik angka $> 10$ digit $\rightarrow$ verifikasi input terpotong tepat pada 10 digit (`maxLength={10}`).
   - Biarkan kosong (opsional) $\rightarrow$ simpan $\rightarrow$ pastikan data berhasil tersimpan tanpa error validasi backend.

### 6.5 Pengujian Initial State & Empty State
1. **Database Kosong**:
   - Buka `MasterDataPage.jsx` pada masing-masing tab saat database belum terisi.
   - Pastikan tidak ada data dummy (Ahmad Fauzi, X-RPL-1, dll.).
   - Pastikan komponen `EmptyState` resmi tampil dengan teks dan tombol aksi yang relevan.
2. **Grade Promotion Page**:
   - Buka `GradePromotionPage.jsx` saat data kosong.
   - Pastikan tidak ada data kelas dummy (X-RPL-1 s.d. XII-AKL-1) atau siswa dummy.
   - Pastikan tabel menampilkan empty state yang layak.

### 6.6 Pengujian Regresi & Kompilasi
1. Jalankan `npm run build` pada `frontend/scp_web` $\rightarrow$ pastikan lolos kompilasi tanpa error JSX atau sintaksis.
2. Jalankan test suite backend `php artisan test --filter=TeacherImportTest` dan `php artisan test --filter=StudentImportTest` $\rightarrow$ pastikan 100% test passing.

---

## 7. Analisis Risiko Teknis & Mitigasi

| Risiko Teknis | Dampak | Strategi Mitigasi |
|---|---|---|
| **Axios Response Interceptor pada Download Blob** | Ketika request download template gagal (misal 403 atau 500), Axios yang dikonfigurasi dengan `{ responseType: 'blob' }` akan membungkus response error JSON ke dalam `Blob`, sehingga pesan error tidak dapat dibaca langsung sebagai teks. | Tangani pada catch handler: jika `err.raw?.response?.data instanceof Blob`, gunakan `FileReader` atau `blob.text()` untuk mem-parse JSON error, lalu tampilkan pesan error yang informatif kepada pengguna. |
| **Keterlambatan Sinkronisasi Kelas Baru setelah Impor Siswa** | Jika Waka mengimpor siswa dengan rombel baru, namun state `classList` tidak ikut di-refresh, filter kelas dan dropdown pada halaman master data tidak akan menampilkan kelas baru tersebut sampai halaman di-refresh manual. | Pada handler sukses `importStudents`, panggil `Promise.all([studentApi.getStudents(), classApi.getClasses()])` untuk menyinkronkan daftar siswa dan daftar kelas secara serentak. |
| **Tabel Error Terlalu Panjang pada Berkas Besar** | Jika file Excel memiliki 50+ baris error, modal dialog akan memanjang melebihi batas layar browser pengguna. | Batasi kontainer tabel error dengan `max-h-64 overflow-y-auto`, buat header tabel *sticky* (`sticky top-0 bg-gray-50`), dan sertakan counter ringkasan: *"Ditemukan {errors.length} baris bermasalah"*. |
| **Pembersihan Fallback Menyebabkan Crash pada Akses Properti Null** | Kode lama mungkin mengasumsikan `classList[0].id` selalu ada (misal `classList[0].id`). Saat diubah ke `[]`, akses langsung tanpa optional chaining dapat memicu `TypeError: Cannot read properties of undefined`. | Periksa seluruh akses array pada `MasterDataPage.jsx` dan `GradePromotionPage.jsx`, gunakan safe navigation / optional chaining: `classList[0]?.id ? String(classList[0].id) : ''`. |

---

## 8. Kriteria Keberhasilan (Acceptance Criteria)

- [ ] **AC-3.1**: Waka Kurikulum dapat mengunduh berkas template Excel guru (`guru_import_template.xlsx`) dan siswa (`siswa_import_template.xlsx`) langsung melalui tombol pada antarmuka web.
- [ ] **AC-3.2**: Modal impor guru mendukung upload berkas `.xlsx` dengan drag-and-drop dan membatasi ukuran berkas maksimal 5 MB.
- [ ] **AC-3.3**: Modal impor siswa mendukung upload berkas `.xlsx`, mengeksekusi impor atomik, dan menampilkan notifikasi sukses informatif yang mencakup jumlah siswa diimpor dan kelas yang otomatis didaftarkan.
- [ ] **AC-3.4**: Jika berkas Excel memuat data tidak valid, modal impor menampilkan Tabel Rekapitulasi Error per baris (`{ row, attribute, message }`) yang terstruktur rapi.
- [ ] **AC-3.5**: Form manual tambah & edit siswa menyediakan dropdown `gender` (`L` dan `P`) serta input `nisn` yang membatasi masukan hanya 10 digit angka numerik.
- [ ] **AC-3.6**: Seluruh initial state mock dummy (`FALLBACK_*`) pada `MasterDataPage.jsx` dan `GradePromotionPage.jsx` telah dihapus dan digantikan oleh `useState([])`.
- [ ] **AC-3.7**: Komponen `EmptyState` resmi tampil dengan baik pada `MasterDataPage.jsx` dan `GradePromotionPage.jsx` ketika database belum memiliki data.
- [ ] **AC-3.8**: State `rows` pada `ReviewImportPage.jsx` terverifikasi bersih dan menggunakan `useState([])`.
- [ ] **AC-3.9**: Seluruh kode frontend lolos kompilasi produksi (`npm run build`) dengan zero error, dan seluruh feature test backend impor (`TeacherImportTest` & `StudentImportTest`) lulus 100%.

---

## 9. Hal yang Membutuhkan Keputusan Pengguna (Technical Decision Points)

Sebelum implementasi dieksekusi, terdapat 3 hal teknis yang direkomendasikan untuk disepakati:

### 1. Penempatan Tombol Impor & Unduh Template pada `MasterDataPage.jsx`
- **Opsi A (Rekomendasi)**: Letakkan tombol "Unduh Template Excel" dan "Impor Excel" pada area header utama (`master-data__header-actions`) di samping tombol "Refresh" dan "Tambah Data", dan tombol impor hanya muncul secara kontekstual sesuai tab yang aktif (hanya saat Tab Guru atau Tab Siswa aktif).
- **Opsi B**: Letakkan tombol di dalam area toolbar pencarian/filter (`master-data__toolbar`).
> **Rekomendasi**: Opsi A, karena konsisten dengan gaya desain tombol aksi utama pada SCP dan lebih mudah ditemukan oleh Waka Kurikulum.

### 2. Validasi Panjang NISN pada Form Manual Siswa
- **Opsi A (Rekomendasi)**: Input `nisn` bersifat opsional; jika diisi, wajib berupa string angka numerik dengan batas maksimal 10 digit (`maxLength={10}` dan hanya angka). Jika pengguna memasukkan kurang dari 10 digit (misal 8 digit), sistem tetap mengizinkannya karena backend hanya mensyaratkan `max:20`.
- **Opsi B**: Input `nisn` wajib tepat 10 digit jika diisi (regex: `/^\d{10}$/`). Jika kurang dari 10 digit, form memunculkan pesan error: *"NISN harus terdiri dari 10 digit angka."*
> **Rekomendasi**: Opsi B, karena nomor NISN resmi Kemendikbudristek selalu tepat 10 digit angka, sehingga mencegah salah ketik oleh operator sekolah.

### 3. Otomatisasi Penutupan Modal Pasca Impor Sukses
- **Opsi A (Rekomendasi)**: Setelah impor berhasil, tampilkan banner sukses berisi rincian data selama 2,5 detik, kemudian modal tertutup otomatis dan tabel me-refresh data. Pengguna juga dapat menutup modal secara instan via tombol "Tutup".
- **Opsi B**: Modal tidak tertutup otomatis sampai pengguna menekan tombol "Selesai" / "Tutup".
> **Rekomendasi**: Opsi B, agar pengguna memiliki waktu membaca ringkasan metrik impor (berapa siswa diimpor, berapa kelas baru dibuat, berapa akun ortu dibuat) tanpa tergesa-gesa.
