# Rencana Implementasi Teknis: Fase 5 (P4)
## Pembersihan Total Infrastruktur Demo & Mock Data (Opsi B)

> **Dokumen Terkait:** [`INTEGRATION_FIX_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/INTEGRATION_FIX_PLAN.md)  
> **Target Branch / Workspace:** `main` / `D:\MyUKK\SchoolClassProject`  
> **Status Dokumen:** DRAFT PERENCANAAN (Menunggu Persetujuan)  
> **Batasan:** DILARANG mengubah kode program, menjalankan migrasi database, atau memodifikasi file sebelum mendapatkan persetujuan eksplisit dari pengguna.

---

## 1. Ringkasan Fase 5 (P4)

Fase 5 merupakan fase finalisasi arsitektur dalam [`INTEGRATION_FIX_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/INTEGRATION_FIX_PLAN.md) (Opsi B: *Full Cleanup*). Fase ini bertujuan menuntaskan pembersihan seluruh artefak pengembangan, bypass login demo, mekanisme simulasi role switcher, dan mock dataset tiruan pada antarmuka frontend, sehingga sistem School Class Progress (SCP) beroperasi 100% menggunakan autentikasi token Sanctum dan basis data riil MySQL.

### 1.1 Masalah yang Ingin Diselesaikan
1. **Bypass Autentikasi Demo**: Keberadaan fungsi `loginWithDemo` dan konstanta `DEMO_PROFILES` memungkinkan pengguna berpindah akun tanpa validasi kredensial kata sandi database.
2. **Role Switcher Tiruan di TopBar**: Dropdown *"Uji Cepat Peran (UKK)"* pada TopBar menyimulasikan pergantian 5 peran secara instan di sisi klien dengan token palsu (`demo_sanctum_token_*`), yang mengaburkan status login otentik dan menyebabkan inkonsistensi sesi saat memanggil API backend terproteksi.
3. **Mock Data Masking di Service Layer**: Tiga service utama—[`quizApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/quizApi.js), [`leaveApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/leaveApi.js), dan [`journalApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/journalApi.js)—memiliki ratusan baris data tiruan (`MOCK_QUIZZES`, `MOCK_QUESTIONS`, `MOCK_SUBMISSIONS`, `MOCK_LEAVE_REQUESTS`, `MOCK_ATTENDANCES`, `MOCK_TEACHER_SCHEDULES`, `MOCK_STUDENTS_CLASS_1`) yang membungkus pemanggilan Axios dalam blok `catch`. Jika API gagal atau koneksi bermasalah, service mengembalikan status semu `{ success: true }`, sehingga kegagalan teknis tertutupi.

### 1.2 Kondisi Akhir yang Diharapkan
- Seluruh sesi login berasal dari autentikasi kredensial riil (NIS/NIP dan password) melalui `POST /api/login` yang menghasilkan token Sanctum resmi.
- TopBar hanya menampilkan profil pengguna aktif dari backend (`GET /api/me`), role badge resmi, inisial dinamis, serta navigasi pengaturan dan tombol logout.
- Seluruh pemanggilan fungsi pada `quizApi.js`, `leaveApi.js`, dan `journalApi.js` terhubung langsung ke endpoint RESTful backend Laravel tanpa fallback mock.
- Pengerjaan dan evaluasi kuis AI berjalan secara nyata menggunakan endpoint AI Gateway backend yang ditenagai model Google Gemini (`ag/gemini-3.8-flash`).
- Kesalahan jaringan atau validasi backend diteruskan secara transparan ke UI pemanggil agar ditangani oleh pesan error/alert resmi.

---

## 2. Analisis Kondisi Saat Ini & Kesenjangan Sistem

### 2.1 Analisis Halaman Login ([`LoginPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx))
- **Temuan Kode Aktual**: Berkas `LoginPage.jsx` saat ini **sudah bersih** dari konstanta `DEMO_PRESETS`, tombol *"Masuk Cepat Mode Demo"*, maupun tombol seleksi role chip demo.
- **Mekanisme Login Aktif**: Formulir login murni menggunakan state `username` (NIS/NIP/Username) dan `password`, lalu memanggil `login({ username, password, device_name })` dari `useAuth()`.
- **Status Tindakan**: Tidak memerlukan penghapusan elemen UI pada `LoginPage.jsx`. Hanya perlu verifikasi ketat bahwa pembersihan `loginWithDemo` pada `AuthContext` tidak memutus alur login standar `LoginPage`.

### 2.2 Analisis TopBar ([`TopBar.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx))
- **Mekanisme Demo yang Ditemukan**:
  1. Baris 35: Import dan destructuring `loginWithDemo` dari `useAuth()`.
  2. Baris 58-64: Fungsi `handleSelectDemoRole(roleKey)` yang memanggil `loginWithDemo(roleKey)`.
  3. Baris 190-221: Blok menu dropdown *"Uji Cepat Peran (UKK)"* yang merender 5 tombol pergantian role instan (`waka`, `teacher`, `kesiswaan`, `student`, `parent`).
  4. Baris 166: Avatar pengguna masih menggunakan inisial statis hardcoded `<div className="web-topbar__avatar">WK</div>`.
- **Status Tindakan**: Wajib menghapus `loginWithDemo`, `handleSelectDemoRole`, dan blok dropdown simulasi peran UKK, serta mengubah avatar inisial agar dinamis sesuai nama pengguna aktif.

### 2.3 Analisis Context Autentikasi ([`AuthContext.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx) & [`authConstants.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/authConstants.js))
- **Pada `authConstants.js`**:
  - Terdapat objek `DEMO_PROFILES` (baris 10-59) yang memuat profil palsu untuk 5 role.
  - Konstanta `ROLES` (baris 1-7) merupakan konstanta produksi yang sah dan wajib dipertahankan.
- **Pada `AuthContext.jsx`**:
  - Baris 3: `import { DEMO_PROFILES } from './authConstants';`
  - Baris 88-96: Method `loginWithDemo(demoKey)` yang membuat token palsu `demo_sanctum_token_${demoKey}_${Date.now()}` dan menyimpannya ke `localStorage`.
  - Baris 101: Pengecekan logout `if (token && !token.startsWith('demo_'))` yang mengecualikan pemanggilan `authApi.logout()` untuk token demo.
  - Baris 177 & 190: Eksposur `loginWithDemo` ke dalam context value `useMemo`.
- **Status Tindakan**: Hapus `DEMO_PROFILES`, hapus method `loginWithDemo`, sederhanakan logika logout agar selalu memanggil `authApi.logout()`, dan hapus `loginWithDemo` dari context value.

### 2.4 Analisis Service Layer Kuis AI ([`quizApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/quizApi.js))
- **Mock Dataset yang Ditemukan**:
  - Baris 11-60: `const MOCK_QUIZZES` (3 objek kuis).
  - Baris 63-186: `const MOCK_QUESTIONS` (koleksi butir soal PG dan Essay).
  - Baris 188-306: `const MOCK_SUBMISSIONS` (koleksi jawaban dan hasil evaluasi AI tiruan).
- **Kondisi Method Service**:
  - Seluruh 14 fungsi publik (`getQuizzes`, `createQuiz`, `getQuizDetail`, `generatePrompt`, `extractDocument`, `getQuizQuestions`, `createQuestion`, `updateQuestion`, `deleteQuestion`, `updateQuizStatus`, `getQuizSubmissions`, `submitQuiz`, `overrideSubmission`, `getMySubmission`) dibungkus oleh blok `try-catch` yang jika gagal akan memanipulasi atau mengembalikan mock dataset lokal.
- **Status Endpoint Backend**:
  - Seluruh 14 endpoint backend telah **tersedia 100%** di `scp/routes/api.php` dan teruji lulus melalui `QuizFeatureTest` serta `QuizWorkflowTest` (21/21 passed).
  - Backend menggunakan `AIService` terintegrasi dengan model `ag/gemini-3.8-flash` via queue job `GenerateQuizFromPromptJob`, `ExtractQuizFromDocumentJob`, dan `GradeQuizSubmissionJob`.

### 2.5 Analisis Service Layer Izin & Jurnal ([`leaveApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/leaveApi.js) & [`journalApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/journalApi.js))
- **Pada `leaveApi.js`**:
  - Baris 10-80: `const MOCK_LEAVE_REQUESTS` (4 permohonan izin siswa).
  - Baris 82-213: `const MOCK_ATTENDANCES` (koleksi rekap presensi).
  - Baris 224, 255: `getLeaveRequests` dan `getLeaveRequestDetail` memiliki fallback ke `MOCK_LEAVE_REQUESTS`.
  - Baris 277-292, 310-315, 329-333: `createLeaveRequest`, `updateLeaveRequest`, dan `deleteLeaveRequest` mengembalikan status sukses tiruan `(Offline Mode)` jika API error.
  - Baris 344: `getAttendances` memiliki fallback ke `MOCK_ATTENDANCES`.
  - *Catatan Integrasi Fase 4*: Method perizinan guru (`submitTeacherLeaveRequest`, `getTeacherLeaveRequests`, `approveTeacherLeaveRequest`, `rejectTeacherLeaveRequest`) sudah murni terhubung ke endpoint backend riil tanpa mock.
- **Pada `journalApi.js`**:
  - Baris 10-114: `const MOCK_TEACHER_SCHEDULES` (jadwal tiruan guru).
  - Baris 115-148: `export const MOCK_STUDENTS_CLASS_1` (daftar 32 siswa dummy).
  - Baris 160, 221, 254, 331: Blok `catch` pada `getTeacherSchedules`, `getJournalDetail`, `openJournal`, dan `getClassStudents` jatuh ke mock dataset.
  - Baris 156-157: Method `getTeacherSchedules`, `getMissingJournals`, `getJournals`, `getJournalDetail`, `openJournal`, `completeJournal`, `markTeacherAbsent`, dan `getClassStudents` melakukan `return res.data;` yang mengikis struktur amplop standar backend (`{ success, data, meta, message }`).

---

## 3. Rencana Implementasi Terperinci

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          ARSITEKTUR AKHIR TANPA INFRASTRUKTUR DEMO                     │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [LoginPage]                      [TopBar]                       [AuthContext]
      │                               │                                │
      │ POST /api/login               │ Tampilan User Profil Riil      │ Sanctum Token Riil
      ▼                               ▼ (Tanpa Role Switcher UKK)      ▼ (Tanpa loginWithDemo)
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         Axios Instance (api.js)                             │
 │                  Authorization: Bearer <SanctumToken>                       │
 └──────────────────────┬──────────────────────┬───────────────────────────────┘
                        │                      │
        ┌───────────────┴────────┐    ┌────────┴───────────────┐
        ▼                        ▼    ▼                        ▼
  [quizApi.js]             [leaveApi.js]                 [journalApi.js]
  - GET /quizzes           - GET /leave-requests         - GET /schedules
  - POST /quizzes          - POST /leave-requests        - GET /journals
  - POST /generate-prompt  - PATCH /leave-requests/{id}  - POST /journals
  - POST /extract-document - GET /attendances            - POST /journals/{id} (PUT)
  - POST /submissions      - GET /teacher-leave-requests - GET /students?class_id=X
  - GET /submissions/me    - PATCH /teacher-leave/approve
  (Murni API Backend)      (Murni API Backend)           (Murni API Backend)
```

### 3.1 Bagian 5a: Pembersihan Halaman Login

- **File Terkait**: [`frontend/scp_web/src/pages/auth/LoginPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/LoginPage.jsx)
- **Kondisi Saat Ini**: Form login sudah bersih dan hanya memuat input username dan password.
- **Tindakan**:
  1. Memverifikasi tidak ada sisa impor atau variabel tak terpakai yang merujuk ke demo.
  2. Memastikan penanganan loading state (`isLoading`), pesan error otentikasi (`error`), dan validasi field (`fieldErrors`) bekerja optimal terhadap respons error HTTP 401 dan 422 dari backend.
  3. Memastikan alur pengalihan (*redirect*) setelah login sukses:
     - Jika pengguna memiliki `must_change_password: true`, diarahkan ke `/change-password`.
     - Jika tidak, diarahkan ke route beranda dinamis sesuai peran pengguna (`getHomeRoute()`).

---

### 3.2 Bagian 5b: Pembersihan TopBar dan Role Switcher UKK

- **File Terkait**: [`frontend/scp_web/src/components/layout/TopBar.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/components/layout/TopBar.jsx)
- **Kondisi Saat Ini**: Memuat dropdown *"Uji Cepat Peran (UKK)"* dan memanggil `loginWithDemo`.
- **Perubahan yang Diperlukan**:
  1. Hapus pemanggilan `loginWithDemo` dari `useAuth()` di baris 35.
  2. Hapus fungsi `handleSelectDemoRole` di baris 58-64.
  3. Hapus seluruh blok menu simulasi peran di dalam dropdown profil (baris 190-221):
     ```jsx
     {/* BLOK INI AKAN DIHAPUS TOTAL */}
     <div className="p-2 border-t border-b border-gray-100 my-1 bg-gray-50/70 rounded">
       <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">
         Uji Cepat Peran (UKK)
       </div>
       ...
     </div>
     ```
  4. Perbaiki Avatar Inisial Dinamis (baris 166):
     Ganti inisial statis `WK` dengan inisial dinamis dari nama pengguna:
     ```jsx
     <div className="web-topbar__avatar">
       {user?.name
         ? user.name
             .split(' ')
             .filter(Boolean)
             .map((n) => n[0])
             .slice(0, 2)
             .join('')
             .toUpperCase()
         : 'U'}
     </div>
     ```
  5. Pertahankan:
     - Tampilan informasi pengguna (`user?.name`, ID NIP/NIS).
     - Menu navigasi *"Profil & Keamanan"* (`/profile`).
     - Tombol *"Keluar Akun"* (`handleLogout`).
     - Badge role aktif (`getRoleLabel()`), badge tahun akademik, dan tombol navigasi sidebar.

---

### 3.3 Bagian 5c: Pembersihan Context Autentikasi (`AuthContext.jsx` & `authConstants.js`)

#### A. Pembersihan `authConstants.js`
- **File Terkait**: [`frontend/scp_web/src/context/authConstants.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/authConstants.js)
- **Tindakan**:
  - Hapus seluruh deklarasi objek `DEMO_PROFILES` (baris 10-59).
  - Pertahankan konstanta enum peran `ROLES`:
    ```javascript
    export const ROLES = {
      WAKA: 'waka',
      VICE_PRINCIPAL: 'vice_principal',
      TEACHER: 'teacher',
      STUDENT: 'student',
      PARENT: 'parent',
    };
    ```

#### B. Pembersihan `AuthContext.jsx`
- **File Terkait**: [`frontend/scp_web/src/context/AuthContext.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx)
- **Tindakan**:
  1. Hapus impor `DEMO_PROFILES` di baris 3.
  2. Hapus definisi fungsi `loginWithDemo` (baris 88-96).
  3. Sederhanakan fungsi `logout` (baris 99-112):
     Hapus kondisi pengecekan `!token.startsWith('demo_')` sehingga logout selalu memanggil `authApi.logout()` jika token tersedia:
     ```javascript
     const logout = useCallback(async () => {
       try {
         if (token) {
           await authApi.logout();
         }
       } catch {
         // Abaikan kegagalan jaringan saat logout
       } finally {
         localStorage.removeItem('scp_token');
         localStorage.removeItem('scp_user');
         setToken(null);
         setUser(null);
       }
     }, [token]);
     ```
  4. Hapus `loginWithDemo` dari objek nilai `value` dan array dependensi `useMemo` (baris 177 dan 190).
  5. Pastikan mekanisme pemulihan sesi (`initAuth` pada `useEffect` baris 22-44) tetap utuh: mengambil token dari `localStorage`, memverifikasi profil via `authApi.getMe()`, dan membersihkan token jika respons bernilai tidak valid / HTTP 401.

---

### 3.4 Bagian 5d: Pembersihan Service Layer Kuis AI (`quizApi.js`)

- **File Terkait**: [`frontend/scp_web/src/services/quizApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/quizApi.js)
- **Kondisi Saat Ini**: Memuat 3 dataset mock raksasa (`MOCK_QUIZZES`, `MOCK_QUESTIONS`, `MOCK_SUBMISSIONS`) sepanjang ~300 baris, serta fallback simulasi di setiap method.
- **Perubahan yang Diperlukan**:
  1. Hapus seluruh deklarasi konstanta `MOCK_QUIZZES`, `MOCK_QUESTIONS`, dan `MOCK_SUBMISSIONS`.
  2. Ubah seluruh 14 fungsi publik agar melakukan pemanggilan HTTP langsung menggunakan instance `api` dan mengembalikan respons bodi JSON backend:

| Nama Fungsi | Endpoint Backend | Method | Payload / Parameter |
|---|---|:---:|---|
| `getQuizzes(params)` | `/quizzes` | `GET` | Query params (`class_id`, `status`, `per_page`, dll.) |
| `createQuiz(data)` | `/quizzes` | `POST` | JSON: `{ title, class_id, subject_id, due_date, max_attempts }` |
| `getQuizDetail(id)` | `/quizzes/${id}` | `GET` | URL param `id` |
| `generatePrompt(id, data)` | `/quizzes/${id}/generate-prompt` | `POST` | JSON: `{ prompt, total_questions, question_types, mc_count, essay_count, difficulty, additional_notes }` |
| `extractDocument(id, formData)` | `/quizzes/${id}/extract-document` | `POST` | FormData: `document` (PDF/TXT maks 5 MB), header `multipart/form-data` |
| `getQuizQuestions(id)` | `/quizzes/${id}/questions` | `GET` | URL param `id` |
| `createQuestion(id, data)` | `/quizzes/${id}/questions` | `POST` | JSON: `{ question_type, question_text, options, correct_answer, points }` |
| `updateQuestion(id, qId, data)` | `/quizzes/${id}/questions/${qId}` | `PUT` | JSON: update butir soal |
| `deleteQuestion(id, qId)` | `/quizzes/${id}/questions/${qId}` | `DELETE` | URL param `id`, `qId` |
| `updateQuizStatus(id, data)` | `/quizzes/${id}` | `PATCH` | JSON: `{ status: 'draft_review' \| 'published' \| 'published_result' }` |
| `publishQuiz(id)` | `/quizzes/${id}/publish` | `PATCH` | Memvalidasi kuis memiliki minimal 1 soal dan mengubah status ke `published` |
| `getQuizSubmissions(id)` | `/quizzes/${id}/submissions` | `GET` | URL param `id` (khusus guru pemilik kuis / waka) |
| `submitQuiz(id, data)` | `/quizzes/${id}/submissions` | `POST` | JSON: `{ answers: [{ question_id, student_answer }] }` |
| `overrideSubmission(submissionId, data)` | `/quiz-submissions/${submissionId}` | `PATCH` | JSON: `{ score, feedback }` |
| `getMySubmission(id)` | `/quizzes/${id}/submissions/me` | `GET` | Mengambil hasil pengerjaan siswa yang sedang login |

  3. Hapus seluruh fallback mock data di blok `catch`. Kesalahan jaringan atau HTTP error diteruskan (*rethrow*) agar halaman [`TeacherQuizPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/teacher/TeacherQuizPage.jsx) dan [`StudentQuizPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/student/StudentQuizPage.jsx) menampilkan notifikasi kesalahan otentik melalui toast / banner.

---

### 3.5 Bagian 5e: Pembersihan Service Layer Izin dan Jurnal (`leaveApi.js` & `journalApi.js`)

#### A. Pembersihan `leaveApi.js`
- **File Terkait**: [`frontend/scp_web/src/services/leaveApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/leaveApi.js)
- **Tindakan**:
  1. Hapus konstanta `MOCK_LEAVE_REQUESTS` dan `MOCK_ATTENDANCES`.
  2. Bersihkan method perizinan siswa dari fallback mock:
     - `getLeaveRequests(params)`: `return api.get('/leave-requests', { params })`
     - `getLeaveRequestDetail(id)`: `return api.get('/leave-requests/' + id)`
     - `createLeaveRequest(formData)`: `return api.post('/leave-requests', formData, { headers: { 'Content-Type': 'multipart/form-data' } })`
     - `updateLeaveRequest(id, dataOrFormData)`: `return api.patch('/leave-requests/' + id, dataOrFormData, { headers })`
     - `deleteLeaveRequest(id)`: `return api.delete('/leave-requests/' + id)`
     - `getAttendances(params)`: `return api.get('/attendances', { params })`
  3. Pertahankan fungsi perizinan guru yang telah terintegrasi di Fase 4 (`submitTeacherLeaveRequest`, `getTeacherLeaveRequests`, `approveTeacherLeaveRequest`, `rejectTeacherLeaveRequest`).

#### B. Pembersihan `journalApi.js`
- **File Terkait**: [`frontend/scp_web/src/services/journalApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/journalApi.js)
- **Tindakan**:
  1. Hapus konstanta `MOCK_TEACHER_SCHEDULES` dan `MOCK_STUDENTS_CLASS_1`.
  2. Sederhanakan pemanggilan method agar mengembalikan seluruh objek respons Axios (tidak lagi melakukan `return res.data;` yang mengikis atribut meta backend):
     - `getTeacherSchedules(params)`: `return api.get('/schedules', { params })`
     - `getMissingJournals(params)`: `return api.get('/schedules', { params: { ...params, status: 'missing_journal' } })`
     - `getJournals(params)`: `return api.get('/journals', { params })`
     - `getJournalDetail(id)`: `return api.get('/journals/' + id)`
     - `openJournal(payload)`: `return api.post('/journals', payload)`
     - `completeJournal(id, formData)`: `return api.post('/journals/' + id, formData, { headers: { 'Content-Type': 'multipart/form-data' } })`
     - `markTeacherAbsent(id, payload)`: `return api.patch('/journals/' + id, payload)`
     - `getClassStudents(classId)`: `return api.get('/students', { params: { class_id: classId, per_page: 100 } })`
  3. Hapus seluruh fallback mock di dalam blok `catch`.

---

## 4. Daftar Lengkap Berkas Terdampak & Matriks Perubahan

### 4.1 Berkas Ruang Lingkup Utama Fase 5
| No | Path Berkas | Sifat Perubahan | Komponen / Method Terdampak | Alasan Perubahan |
|---|---|:---:|---|---|
| 1 | `frontend/scp_web/src/context/authConstants.js` | Modifikasi | Hapus `DEMO_PROFILES`, pertahankan `ROLES`. | Menghapus akun dan profil demo tiruan dari memori klien. |
| 2 | `frontend/scp_web/src/context/AuthContext.jsx` | Modifikasi | Hapus `loginWithDemo`, sederhanakan `logout`, hapus impor `DEMO_PROFILES`. | Memastikan token autentikasi 100% berasal dari backend Sanctum. |
| 3 | `frontend/scp_web/src/components/layout/TopBar.jsx` | Modifikasi | Hapus `handleSelectDemoRole`, hapus dropdown UKK, perbaiki avatar inisial dinamis. | Menghilangkan manipulasi role tiruan pada header antarmuka. |
| 4 | `frontend/scp_web/src/services/quizApi.js` | Refactoring Penuh | Hapus `MOCK_QUIZZES`, `MOCK_QUESTIONS`, `MOCK_SUBMISSIONS`, sambungkan 14 method ke REST API backend. | Menghubungkan modul evaluasi AI ke model Gemini Flash riil. |
| 5 | `frontend/scp_web/src/services/leaveApi.js` | Modifikasi | Hapus `MOCK_LEAVE_REQUESTS`, `MOCK_ATTENDANCES`, hapus offline fallback response. | Menggunakan database riil untuk perizinan dan presensi siswa. |
| 6 | `frontend/scp_web/src/services/journalApi.js` | Modifikasi | Hapus `MOCK_TEACHER_SCHEDULES`, `MOCK_STUDENTS_CLASS_1`, hapus offline fallback response. | Menggunakan database riil untuk jurnal KBM dan presensi kelas. |

### 4.2 Berkas Pendukung yang Diverifikasi (Read-Only)
| No | Path Berkas | Peran dalam Sistem | Status Verifikasi |
|---|---|---|---|
| 1 | `frontend/scp_web/src/pages/auth/LoginPage.jsx` | Form login portal | Terverifikasi sudah bersih dari `DEMO_PRESETS`. |
| 2 | `frontend/scp_web/src/services/api.js` | Axios interceptor & `authApi` | Terverifikasi menangani Bearer token Sanctum dan auto-redirect 401. |
| 3 | `frontend/scp_web/src/pages/teacher/TeacherQuizPage.jsx` | Halaman guru manajemen kuis AI | Terverifikasi memanggil `quizApi` dengan penanganan toast error. |
| 4 | `frontend/scp_web/src/pages/student/StudentQuizPage.jsx` | Halaman CBT siswa pengerjaan kuis | Terverifikasi memanggil `quizApi` secara langsung. |
| 5 | `frontend/scp_web/src/pages/teacher/TeacherJournalPage.jsx` | Halaman pengisian jurnal KBM | Terverifikasi menangani error dan respons meta dari `journalApi`. |
| 6 | `frontend/scp_web/src/pages/student/StudentPermissionPage.jsx` | Halaman pengajuan izin siswa | Terverifikasi menangani error form dari `leaveApi`. |
| 7 | `scp/routes/api.php` | Routing API backend | Terverifikasi 100% memetakan rute kuis, jurnal, dan perizinan. |
| 8 | `scp/app/Http/Controllers/API/QuizController.php` | Controller kuis AI | Terverifikasi 100% lulus 21/21 PHPUnit Feature Tests. |

---

## 5. Urutan dan Tahapan Implementasi

Pelaksanaan Fase 5 disusun berdasarkan dependensi teknis dari lapisan inti (*core auth*) hingga lapisan antarmuka (*UI & services*):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        URUTAN EKSEKUSI FASE 5                          │
├────────────────────────────────────────────────────────────────────────┤
│ 1. [authConstants.js]  Hapus DEMO_PROFILES                             │
│ 2. [AuthContext.jsx]   Hapus loginWithDemo & bersihkan logout           │
│ 3. [TopBar.jsx]        Hapus dropdown UKK role switcher & inisial user │
│ 4. [quizApi.js]        Hapus MOCK datasets & integrasikan REST API     │
│ 5. [leaveApi.js]       Hapus MOCK_LEAVE_REQUESTS & MOCK_ATTENDANCES    │
│ 6. [journalApi.js]     Hapus MOCK_TEACHER_SCHEDULES & MOCK_STUDENTS    │
│ 7. [Build & Test]      npm run build & php artisan test                │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Tahap 1 — Pembersihan Inti Autentikasi (`authConstants.js` & `AuthContext.jsx`)**:
   - Menghapus konstanta profil demo dan fungsi bypass autentikasi.
   - Memastikan context provider hanya mengekspos token dan user yang sah dari backend.
2. **Tahap 2 — Pembersihan Antarmuka Navigasi (`TopBar.jsx`)**:
   - Menghilangkan dropdown simulasi peran UKK dari profil menu.
   - Menyelaraskan inisial avatar pengguna secara dinamis.
3. **Tahap 3 — Modernisasi Service Layer Kuis AI (`quizApi.js`)**:
   - Menghapus 300+ baris mock dataset kuis.
   - Menyambungkan 14 method ke endpoint riil `POST/GET/PATCH /api/quizzes/*`.
4. **Tahap 4 — Pembersihan Service Layer Izin & Jurnal (`leaveApi.js` & `journalApi.js`)**:
   - Menghapus seluruh konstanta mock dan blok respons tiruan offline.
   - Mengembalikan amplop data otentik dari API backend.
5. **Tahap 5 — Verifikasi Komprehensif & Build**:
   - Memeriksa tidak ada referensi `DEMO_` yang tertinggal di seluruh bundel.
   - Menjalankan `npm run build` dan memvalidasi seluruh test suite backend.

---

## 6. Rencana Pengujian Komprehensif

### 6.1 Pengujian Autentikasi Riil & Sesi Sanctum
1. **Login Kredensial Riil Database**:
   - Menguji login dengan akun Guru (`nip: 198001012005011001`, password riil) $\rightarrow$ berhasil login dan menerima token Sanctum asli.
   - Menguji login dengan kata sandi salah $\rightarrow$ menerima HTTP 401 dan pesan *"Kredensial tidak valid"*, tanpa ada fallback demo.
2. **Pemulihan Sesi (`GET /api/me`)**:
   - Refresh browser saat login $\rightarrow$ aplikasi memanggil `GET /api/me`, data profil terpulihkan secara otentik.
   - Hapus token secara manual di DevTools $\rightarrow$ otomatis redirect ke `/login` tanpa loop tak terbatas.
3. **Logout Bersih**:
   - Klik *"Keluar Akun"* di TopBar $\rightarrow$ memanggil `POST /api/logout`, menghapus `scp_token` dan `scp_user` dari `localStorage`, dan kembali ke `/login`.
4. **Verifikasi Hilangnya Role Switcher**:
   - Buka dropdown profil di TopBar $\rightarrow$ verifikasi bahwa baris menu *"Uji Cepat Peran (UKK)"* dan 5 tombol switch role sudah **tidak ada lagi**.

### 6.2 Pengujian Modul Kuis AI (`quizApi.js`)
1. **Generate Soal via Prompt AI**:
   - Guru membuat kuis baru $\rightarrow$ klik *"Generate Soal AI via Prompt"*.
   - Kirim topik materi (contoh: "Fungsi Kuadrat dan Diskriminan", 3 soal PG, 2 Essay).
   - Verifikasi bahwa kuis mengirim `POST /api/quizzes/{id}/generate-prompt` ke backend yang memicu `AIService` Gemini Flash.
   - Butir soal muncul pada tabel peninjauan draft tanpa mock dataset.
2. **Ekstraksi Soal via Dokumen**:
   - Unggah berkas silabus/materi format PDF/TXT $\rightarrow$ klik *"Ekstrak Soal"*.
   - Verifikasi berkas dikirim via multipart `POST /api/quizzes/{id}/extract-document`.
3. **Pengerjaan CBT Siswa & Penilaian Asinkron**:
   - Siswa membuka kuis yang telah berstatus `published`.
   - Mengumpulkan jawaban $\rightarrow$ memanggil `POST /api/quizzes/{id}/submissions`.
   - Backend menjalankan `GradeQuizSubmissionJob` untuk mengoreksi jawaban PG dan mengevaluasi esai via rubrik AI.
4. **Override Nilai oleh Guru**:
   - Guru membuka submission siswa $\rightarrow$ melakukan override skor esai $\rightarrow$ memanggil `PATCH /api/quiz-submissions/{id}` dengan audit trail overrider.

### 6.3 Pengujian Modul Izin & Jurnal Tanpa Mock
1. **Pengajuan Izin Siswa**:
   - Siswa mengirim form izin sakit beserta surat dokter $\rightarrow$ tersimpan ke tabel database `leave_requests`.
   - Matikan koneksi backend sementara $\rightarrow$ UI menampilkan pesan kesalahan jaringan nyata, bukan *"Pengajuan perizinan berhasil dikirim (Offline Mode)"*.
2. **Pembukaan Sesi Jurnal KBM**:
   - Guru membuka sesi KBM pada jadwal aktif $\rightarrow$ memanggil `POST /api/journals`.
   - Menampilkan daftar presensi siswa kelas binaan dari tabel `students` dan perizinan terkonfirmasi dari `leave_requests`.
   - Menyimpan jurnal beserta foto dokumentasi KBM $\rightarrow$ data tersimpan atomik ke tabel database `journals` dan `attendances`.

---

## 7. Analisis Risiko & Strategi Mitigasi

| Risiko | Dampak | Probabilitas | Strategi Mitigasi |
|---|:---:|:---:|---|
| **Kegagalan Koneksi AI Gateway (Quota / Rate Limit Gemini)** | Sedang | Rendah | Backend `QuizController` telah dilengkapi penanganan timeout (45 detik) dan fallback status `draft_review`. Jika Gemini sibuk, error 422/500 tertangkap di frontend dan menampilkan pesan informatif pada toast guru. |
| **User Tersangkut di Token Demo Usang** | Sedang | Rendah | Pada inisialisasi `AuthContext`, jika token tersimpan berawalan `demo_`, otomatis hapus token dari `localStorage` dan arahkan ke `/login`. |
| **Penghapusan `return res.data;` Memutus Format State Komponen** | Tinggi | Rendah | Memverifikasi seluruh titik pemanggilan di `TeacherJournalPage`, `TeacherSchedulePage`, `StudentPermissionPage`, dan `TeacherQuizPage` agar konsisten membaca `res.data` atau `res` secara aman (`res?.data || res`). |
| **Sesi Asinkron Antrean Queue Kuis** | Sedang | Rendah | Pada environment lokal dengan `QUEUE_CONNECTION=sync`, pemrosesan langsung tuntas. Jika queue asinkron, frontend tetap menyediakan tombol *"Muat Ulang Butir Soal"* (`getQuizQuestions`). |

---

## 8. Acceptance Criteria (Kriteria Keberhasilan)

Fase 5 dinyatakan selesai dan sukses apabila seluruh kriteria berikut terpenuhi:
1. `authConstants.js` bersih dari objek `DEMO_PROFILES`.
2. `AuthContext.jsx` tidak lagi memuat method `loginWithDemo` dan tidak ada lagi pembuatan `demo_sanctum_token_*`.
3. `TopBar.jsx` tidak lagi memuat dropdown *"Uji Cepat Peran (UKK)"* maupun tombol pergantian role instan, serta inisial avatar pengguna mencerminkan nama pengguna aktif.
4. `quizApi.js` bersih dari `MOCK_QUIZZES`, `MOCK_QUESTIONS`, dan `MOCK_SUBMISSIONS`, serta 14 method service terhubung langsung ke REST API backend.
5. `leaveApi.js` bersih dari `MOCK_LEAVE_REQUESTS` dan `MOCK_ATTENDANCES`, serta tidak ada respons sukses semu `(Offline Mode)` pada method CRUD.
6. `journalApi.js` bersih dari `MOCK_TEACHER_SCHEDULES` dan `MOCK_STUDENTS_CLASS_1`, serta mengembalikan data otentik dari API backend.
7. Seluruh unit dan feature test backend (`php artisan test`) tetap lulus 100%, dan bundel frontend (`npm run build`) berhasil dikompilasi tanpa galat.

---

## 9. Hal yang Membutuhkan Keputusan Pengguna

Sebelum tahap implementasi kode program dimulai, mohon konfirmasi untuk 3 (tiga) keputusan teknis berikut:

1. **Pembersihan Token Demo Lama pada `localStorage` saat Inisialisasi**:
   - Pengguna atau penguji mungkin masih memiliki `scp_token` bernilai `demo_sanctum_token_*` di peramban mereka dari sesi pengujian sebelumnya.
   - **Rekomendasi**: Pada `initAuth()` di `AuthContext.jsx`, kita tambahkan pengecekan: jika token yang ditemukan di `localStorage` diawali dengan `"demo_"`, token tersebut langsung dihapus otomatis (`localStorage.removeItem`) dan state direset ke `null`, sehingga pengguna diminta login secara resmi dengan akun riil.
   - *Apakah pembersihan otomatis token demo lawas ini disetujui?*

2. **Format Inisial Avatar Dinamis di TopBar**:
   - Di `TopBar.jsx`, elemen avatar saat ini menampilkan teks statis `WK`.
   - **Rekomendasi**: Mengubah teks avatar tersebut agar otomatis mengambil 2 huruf pertama dari nama pengguna login (misal: "Ahmad Fauzi" $\rightarrow$ "AF", "Aisyah Putri" $\rightarrow$ "AP", "Waka Kurikulum" $\rightarrow$ "WK").
   - *Apakah perubahan inisial dinamis ini disetujui?*

3. **Penanganan Polling Ringan pada Pembuatan Soal AI (`TeacherQuizPage.jsx`)**:
   - Pemanggilan `generatePrompt` dan `extractDocument` mengembalikan HTTP 202 Accepted.
   - Pada `QUEUE_CONNECTION=sync` (pengujian standar lokal), soal selesai dibuat seketika sehingga pemanggilan `getQuizQuestions` langsung berhasil.
   - Namun untuk mencegah kondisi antrean latar belakang belum selesai (`status: generating`), apakah disetujui jika kita menambahkan mekanisme pengecekan ulang otomatis (polling 1 detik, maksimal 5 kali) jika butir soal belum muncul seketika setelah generate prompt?
   - *Apakah mekanisme polling ringan ini disetujui?*
