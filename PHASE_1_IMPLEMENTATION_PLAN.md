# Implementation Plan — Fase 1 (P0): Perbaikan Runtime Kritis & Integrasi Password

> **Dokumen Status:** Final Technical Specification & Implementation Plan  
> **Versi:** 1.0  
> **Tanggal Perencanaan:** 1 November 2026  
> **Target Eksekusi:** Frontend (`frontend/scp_web/`) & Verifikasi Backend (`scp/`)  
> **Tingkat Prioritas:** **P0 (Kritis — Blocker Fungsionalitas Inti & Integritas Runtime)**  
> **Acuan Utama:** [`INTEGRATION_FIX_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/INTEGRATION_FIX_PLAN.md) Bab 4, 10 & [`CRITICAL_FINDINGS_RESOLUTION_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/CRITICAL_FINDINGS_RESOLUTION_PLAN.md)

---

## 1. Overview

Fase 1 (P0) merupakan fase fondasi paling kritis dalam penyelarasan antarmuka Frontend (`frontend/scp_web`) dengan Backend SCP v4.5 (`scp/`). Tujuan utama fase ini adalah:
1. **Mengeliminasi Bug Runtime Kritis:** Menyelesaikan crash JavaScript fatal pada halaman Monitoring Rekapitulasi Waka (`MonitoringRecapPage.jsx`) akibat ketidaksesuaian struktur export API yang menyebabkan halaman blank total.
2. **Menegakkan Integritas Autentikasi Kata Sandi:** Mengintegrasikan form perubahan kata sandi (baik mandatory change password maupun ubah profil) secara riil ke endpoint `PATCH /api/me/password`, mengeliminasi penelanan error palsu (*swallow 404*), dan memastikan pembaruan flag `must_change_password` tersinkronisasi atomik antara basis data dan state aplikasi.

Ruang lingkup Fase 1 dibatasi secara tegas pada dua sub-pekerjaan:
- **Fase 1a:** Integrasi Frontend dengan Route `PATCH /api/me/password`.
- **Fase 1b:** Perbaikan Pemanggilan `masterDataApi.getClasses()` di `MonitoringRecapPage.jsx`.

---

## 2. Reference Documents

Rencana implementasi ini disusun berdasarkan analisis mendalam terhadap dokumen spesifikasi dan kode sumber riil:

| Dokumen / Berkas Sumber | Path Berkas | Bagian / Fokus Analisis |
|---|---|---|
| **Rencana Induk Integrasi** | [`INTEGRATION_FIX_PLAN.md`](file:///D:/MyUKK/SchoolClassProject/INTEGRATION_FIX_PLAN.md) | Bab 4 (Fase 1a & 1b) & Bab 10 (Berkas Terdampak). |
| **Product Requirements Document** | [`scp/MD/PRD.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/PRD.md) | Bab 5.1 & 9.1 (Autentikasi, Profil & Mandatory Change Password). |
| **Spesifikasi Teknis Backend** | [`scp/MD/Development.md`](file:///D:/MyUKK/SchoolClassProject/scp/MD/Development.md) | Bab API Routes, Envelopes, & Step-Up Auth Pattern. |
| **Controller Profil Backend** | [`scp/app/Http/Controllers/API/ProfileController.php`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/ProfileController.php#L357-L408) | Implementasi method `changePassword` (L357–408). |
| **Automated Feature Test** | [`scp/tests/Feature/ChangePasswordTest.php`](file:///D:/MyUKK/SchoolClassProject/scp/tests/Feature/ChangePasswordTest.php) | 8 Skenario pengujian resmi endpoint perubahan kata sandi. |
| **Context Autentikasi Frontend** | [`frontend/scp_web/src/context/AuthContext.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx#L123-L138) | Method `changePassword` & pengelolaan `must_change_password`. |
| **Halaman Profil Frontend** | [`frontend/scp_web/src/pages/profile/ProfilePage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx#L138-L183) | Handler form ubah kata sandi `handleChangePassword`. |
| **Halaman Mandatory Password** | [`frontend/scp_web/src/pages/auth/ChangePasswordPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/ChangePasswordPage.jsx#L20-L67) | Handler mandatory change password bagi pengguna baru. |
| **Halaman Rekap Monitoring** | [`frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx#L59-L87) | Lifecycle hook `loadInitialData` & pemanggilan service kelas. |
| **Master Data API Service** | [`frontend/scp_web/src/services/masterDataApi.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js#L9-L54) | Struktur named export `classApi` vs default export `masterDataApi`. |
| **Network Client Core** | [`frontend/scp_web/src/services/api.js`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/api.js#L25-L70) | Axios interceptor unwrapping & method `authApi.changePassword`. |

---

## 3. Current Condition Analysis

### 3.1 Analisis Kondisi Aktual Fase 1a (Integrasi Password)

#### A. Kondisi Backend (`scp/`)
1. **Endpoint `PATCH /api/me/password`:**
   - Terdaftar pada [`scp/routes/api.php` L34](file:///D:/MyUKK/SchoolClassProject/scp/routes/api.php#L34) di dalam grup middleware `auth:sanctum`.
   - Menggunakan controller [`ProfileController::changePassword`](file:///D:/MyUKK/SchoolClassProject/scp/app/Http/Controllers/API/ProfileController.php#L357-L408).
2. **Validasi & Integritas:**
   - `current_password`: Wajib diisi string. Diverifikasi via `Hash::check($request->current_password, $user->password)`. Jika tidak cocok, server mengembalikan status **HTTP 422 Unprocessable Content** dengan payload:
     ```json
     {
       "success": false,
       "message": "Kata sandi saat ini yang Anda masukkan tidak sesuai.",
       "errors": {
         "current_password": ["Kata sandi saat ini yang Anda masukkan salah."]
       }
     }
     ```
   - `new_password`: Wajib diisi, minimal 8 karakter, wajib memiliki konfirmasi identik (`confirmed`), dan wajib berbeda dari password saat ini (`different:current_password`).
   - `new_password_confirmation`: Wajib diisi string.
3. **Hasil Mutasi Database:**
   - Menyimpan hash bcrypt baru: `$user->update(['password' => Hash::make($request->new_password), 'must_change_password' => false])`.
   - Mengembalikan respons **HTTP 200 OK**:
     ```json
     {
       "success": true,
       "message": "Kata sandi akun Anda berhasil diperbarui.",
       "data": { "must_change_password": false }
     }
     ```
4. **Verifikasi Pengujian Otomatis:**
   - Seluruh 8 skenario pengujian di [`ChangePasswordTest.php`](file:///D:/MyUKK/SchoolClassProject/scp/tests/Feature/ChangePasswordTest.php) berstatus **100% PASS** (401 unauthenticated, 422 empty fields, 422 min:8, 422 confirmation mismatch, 422 same as current, 422 incorrect current password, 200 success hash/flag reset, dan login re-test dengan password baru).

#### B. Masalah Kritis di Frontend (`frontend/scp_web/`)
1. **Penelanan Error 404 & Mutasi State Sepihak di `AuthContext.jsx` ([L124-138](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx#L124-L138)):**
   ```javascript
   const changePassword = useCallback(async (passwords) => {
     try {
       if (token && !token.startsWith('demo_')) {
         await authApi.changePassword(passwords);
       }
     } catch (err) {
       // If endpoint doesn't exist yet (404), allow fallback for must_change_password in Phase 1
       if (err.status !== 404) {
         throw err;
       }
     }

     updateUserProfile({ must_change_password: false });
     return true;
   }, [token, updateUserProfile]);
   ```
   - **Celah Teknis:**  
     Jika server merespons HTTP 404 (misal endpoint salah path atau offline), kondisi `if (err.status !== 404)` menyebabkan error **ditelan diam-diam (*silent swallow*)**.
     Lebih berbahaya lagi, baris `updateUserProfile({ must_change_password: false })` dieksekusi **di luar blok `try`**. Akibatnya, state lokal user diubah seolah-olah ganti kata sandi berhasil, padahal password di database tidak pernah berubah.
2. **Sukses Palsu di `ProfilePage.jsx` ([L157-183](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx#L157-L183)):**
   ```javascript
   try {
     await authApi.changePassword({ ... });
     setPasswordSuccess(true);
     // ... reset form ...
   } catch (err) {
     if (err.errors) setFieldErrors(err.errors);
     if (err.status === 404) {
       setPasswordSuccess(true); // <--- BENCANA: Sukses palsu!
       setOldPassword('');
       setNewPassword('');
       setConfirmPassword('');
     } else {
       setPasswordError(err.message || 'Gagal mengubah kata sandi...');
     }
   }
   ```
   - **Celah Teknis:**  
     Jika API merespons HTTP 404, komponen justru menampilkan alert hijau sukses *"Kata sandi berhasil diperbarui."* dan mengosongkan form. Pengguna mengira akun mereka aman dengan kata sandi baru, namun ketika login kembali, kata sandi baru tersebut ditolak karena database masih menyimpan hash lama.
3. **Inkonsistensi Pemanggilan Service:**
   - [`ChangePasswordPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/ChangePasswordPage.jsx#L47) memanggil method `changePassword(...)` dari `useAuth()`.
   - Sementara [`ProfilePage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx#L158) memanggil `authApi.changePassword(...)` langsung, sehingga pembaruan `must_change_password` di AuthContext terlewati saat user mengubah password lewat profil.

---

### 3.2 Analisis Kondisi Aktual Fase 1b (Perbaikan Runtime Monitoring Rekap)

#### A. Struktur Service `masterDataApi.js` ([L9-54](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/services/masterDataApi.js#L9-L54))
- Berkas mengekspor named export per entitas:
  - `export const classApi = { getClasses, createClass, updateClass, deleteClass, promoteClasses };`
  - `export const roomApi = { ... };`
  - `export const subjectApi = { ... };`
  - `export const teacherApi = { ... };`
  - `export const studentApi = { ... };`
- Default export membungkus objek-objek tersebut dalam namespace:
  ```javascript
  export default {
    classes: classApi,
    rooms: roomApi,
    subjects: subjectApi,
    teachers: teacherApi,
    students: studentApi,
  };
  ```

#### B. Masalah di `MonitoringRecapPage.jsx` ([L18, L65-69](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx#L18))
1. **Kesalahan Impor & Pemanggilan:**
   - Baris 18: `import masterDataApi from '../../services/masterDataApi';`
   - Baris 68: `masterDataApi.getClasses({ per_page: 50 }).catch(() => ({ data: [] }))`
2. **Dampak Fatal Runtime (Crash Cascade):**
   - Objek `masterDataApi` (default export) **tidak memiliki properti `getClasses`** (properti yang ada adalah `masterDataApi.classes.getClasses`).
   - Karena `masterDataApi.getClasses` bernilai `undefined`, pemanggilan `masterDataApi.getClasses(...)` secara langsung melempar:
     ```
     TypeError: masterDataApi.getClasses is not a function
     ```
   - **Mengapa `.catch()` tidak menolong?**  
     Ekspresi `masterDataApi.getClasses(...)` gagal dievaluasi secara *synchronous* saat menyusun argumen array untuk `Promise.all([ ... ])`. Kode melempar exception sebelum fungsi sempat menghasilkan sebuah Promise. Akibatnya, `.catch()` tidak pernah terpasang.
   - **Akibat pada Halaman:**  
     Eksekusi fungsi `loadInitialData()` langsung terlempar ke blok `catch {}` umum pada baris 82. Request presensi (`leaveApi.getAttendances`) dan request jurnal (`journalApi.getJournals`) di dalam `Promise.all` dibatalkan/diabaikan. Halaman monitoring rekap terbuka dalam kondisi data kosong total (*blank slate*), dan dropdown filter rombel kelas tidak terisi.
3. **Audit Dampak Terhadap Komponen Lain:**
   - Dari seluruh berkas di `frontend/scp_web/src`, **hanya `MonitoringRecapPage.jsx` yang memiliki kesalahan ini**.
   - Halaman lain seperti `GradePromotionPage.jsx`, `MasterDataPage.jsx`, `ReviewImportPage.jsx`, dan `ScheduleManagementPage.jsx` sudah menggunakan named import yang benar: `import { classApi } from '../../services/masterDataApi';`.
   - `TeacherQuizPage.jsx` menggunakan default export secara benar: `masterDataApi.classes.getClasses()`.
   - Mengubah `MonitoringRecapPage.jsx` ke named import `classApi` sepenuhnya aman dan tidak memicu efek samping pada berkas lain.

---

## 4. Technical Implementation Plan

### 4.1 Rencana Teknis Fase 1a: Integrasi Password Riil & Eliminasi Swallow 404

#### A. Penyesuaian `AuthContext.jsx` ([`frontend/scp_web/src/context/AuthContext.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx))
1. **Hapus Penelanan 404 & Pindahkan Pembaruan State:**
   - Ubah method `changePassword` menjadi:
     ```javascript
     // Change password method
     const changePassword = useCallback(async (passwords) => {
       const res = await authApi.changePassword(passwords);
       
       // Perbarui state pengguna hanya jika request API sukses HTTP 200
       updateUserProfile({ must_change_password: false });
       return res;
     }, [updateUserProfile]);
     ```
   - **Prinsip Teknis:**  
     Fungsi tidak lagi menangkap dan menelan error di level context. Jika backend merespons error (401, 404, 422, 500), Axios reject akan diteruskan langsung ke komponen pemanggil (`ChangePasswordPage` atau `ProfilePage`) untuk ditampilkan ke pengguna.

#### B. Penyesuaian `ProfilePage.jsx` ([`frontend/scp_web/src/pages/profile/ProfilePage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx))
1. **Konsistensi Pemanggilan Context:**
   - Ubah baris destrukturisasi hook `useAuth()` pada baris 28:
     ```javascript
     const { user, updateUserProfile, logout, changePassword } = useAuth();
     ```
2. **Refactor Handler `handleChangePassword` (Baris 138–183):**
   - Hapus pemanggilan langsung ke `authApi.changePassword`. Gunakan method `changePassword` dari context:
     ```javascript
     const handleChangePassword = async (e) => {
       e.preventDefault();
       setPasswordError('');
       setPasswordSuccess(false);
       setFieldErrors({});

       // Validasi client-side awal
       const errors = {};
       if (!oldPassword) errors.current_password = ['Kata sandi saat ini wajib diisi.'];
       if (!newPassword) errors.new_password = ['Kata sandi baru wajib diisi.'];
       else if (newPassword.length < 8) errors.new_password = ['Kata sandi baru minimal 8 karakter.'];
       if (newPassword !== confirmPassword) errors.new_password_confirmation = ['Konfirmasi kata sandi tidak cocok.'];

       if (Object.keys(errors).length > 0) {
         setFieldErrors(errors);
         return;
       }

       setPasswordLoading(true);

       try {
         await changePassword({
           current_password: oldPassword,
           new_password: newPassword,
           new_password_confirmation: confirmPassword,
         });

         setPasswordSuccess(true);
         setOldPassword('');
         setNewPassword('');
         setConfirmPassword('');
       } catch (err) {
         if (err.errors) {
           setFieldErrors(err.errors);
         }
         setPasswordError(
           err.message || 'Gagal mengubah kata sandi. Periksa kembali kata sandi saat ini.'
         );
       } finally {
         setPasswordLoading(false);
       }
     };
     ```
   - **Prinsip Teknis:**  
     - Hapus seluruh percabangan `if (err.status === 404)`.
     - Respons 422 dari backend (kata sandi lama salah atau konfirmasi tidak cocok) akan otomatis mengisi state `fieldErrors` dan menampilkan banner merah `passwordError`.
     - Form hanya dikosongkan dan `passwordSuccess` hanya bernilai `true` apabila server merespons HTTP 200.

#### C. Verifikasi Konsistensi pada `ChangePasswordPage.jsx` ([`frontend/scp_web/src/pages/auth/ChangePasswordPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/auth/ChangePasswordPage.jsx))
- Komponen ini sudah memanggil `await changePassword(...)` dan memiliki handler `catch (err)` yang menangkap `err.errors` dan `err.message`.
- Dengan diperbaikinya `AuthContext.jsx`, alur mandatory change password bagi pengguna baru otomatis tervalidasi riil tanpa modifikasi struktural pada komponen ini.

---

### 4.2 Rencana Teknis Fase 1b: Perbaikan Pemanggilan `classApi.getClasses()` di `MonitoringRecapPage`

#### A. Penyesuaian `MonitoringRecapPage.jsx` ([`frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx))
1. **Perbaiki Baris Impor (Baris 18):**
   - Ubah impor default menjadi named export:
     ```javascript
     // SEBELUM:
     import masterDataApi from '../../services/masterDataApi';

     // SESUDAH:
     import { classApi } from '../../services/masterDataApi';
     ```
2. **Perbaiki Pemanggilan pada Hook `loadInitialData` (Baris 65–69):**
   - Ubah baris 68:
     ```javascript
     const [attRes, jourRes, clsRes] = await Promise.all([
       leaveApi.getAttendances({ per_page: 100 }),
       journalApi.getJournals({ per_page: 100 }),
       classApi.getClasses({ per_page: 50 }).catch(() => ({ data: [] })),
     ]);
     ```
3. **Verifikasi Penanganan Response:**
   - Backend `SchoolClassController::index` merespons:
     `{ success: true, message: '...', data: [...classes...], meta: { ... } }`
   - Interceptor Axios mengembalikan objek JSON tersebut ke `clsRes`.
   - Blok baris 79–81:
     ```javascript
     if (clsRes.data && Array.isArray(clsRes.data)) {
       setClassesList(clsRes.data);
     }
     ```
     akan membaca array kelas dengan tepat, mengisi state `classesList`, dan mengaktifkan dropdown filter rombel kelas pada halaman monitoring.

---

## 5. Affected Files

Berikut rincian berkas yang akan disentuh pada tahap implementasi Fase 1 beserta sifat perubahannya:

| # | Path Berkas | Lapisan | Sifat Perubahan | Rincian Perubahan |
|---|---|:---:|:---:|---|
| 1 | [`frontend/scp_web/src/context/AuthContext.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/context/AuthContext.jsx) | Frontend Context | Modifikasi Logika | Hapus penelanan error 404; pindahkan `updateUserProfile({ must_change_password: false })` ke dalam blok `try` setelah respon 200 OK; teruskan seluruh exception ke pemanggil. |
| 2 | [`frontend/scp_web/src/pages/profile/ProfilePage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/profile/ProfilePage.jsx) | Frontend Page | Modifikasi Logika | Gunakan `changePassword` dari `useAuth()`; hapus penanganan sukses palsu pada error 404; tangani error validasi HTTP 422 pada form field. |
| 3 | [`frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx`](file:///D:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/MonitoringRecapPage.jsx) | Frontend Page | Bugfix Sintaks/Impor | Ganti impor default `masterDataApi` menjadi named import `{ classApi }`; ubah baris 68 menjadi `classApi.getClasses({ per_page: 50 })`. |

> [!NOTE]
> Berkas backend (`scp/`) **TIDAK MEMERLUKAN PERUBAHAN** pada Fase 1 karena endpoint `PATCH /api/me/password` dan `GET /api/classes` telah aktif, teruji, dan sesuai kontrak PRD.

---

## 6. Execution Sequence

Pengerjaan Fase 1 wajib dilakukan secara berurutan (*step-by-step*) untuk meminimalkan risiko regresi dan memudahkan verifikasi bertahap:

```mermaid
flowchart TD
    subgraph Tahap 1: Eksekusi Fase 1b (Runtime Bugfix)
        Step1["1. Edit import & pemanggilan classApi di MonitoringRecapPage.jsx"]
        Step2["2. Verifikasi dev build & load halaman /waka/monitoring-recap"]
        Step3["3. Pastikan console browser bebas dari TypeError dan data terisi"]
    end

    subgraph Tahap 2: Eksekusi Fase 1a (Core Auth Service)
        Step4["4. Refactor method changePassword di AuthContext.jsx"]
        Step5["5. Pindahkan updateUserProfile ke dalam try block"]
        Step6["6. Pastikan error di-rethrow tanpa menelan status 404"]
    end

    subgraph Tahap 3: Eksekusi Fase 1a (Profile Page Integration)
        Step7["7. Update ProfilePage.jsx untuk konsumsi changePassword context"]
        Step8["8. Hapus blok sukses palsu if (err.status === 404)"]
        Step9["9. Sambungkan penanganan fieldErrors & passwordError dari HTTP 422"]
    end

    subgraph Tahap 4: Pengujian E2E & Verifikasi Regresi
        Step10["10. Uji skenario mandatory ganti password (/change-password)"]
        Step11["11. Uji skenario ubah password di halaman profil (/profile)"]
        Step12["12. Uji skenario kata sandi salah & validasi min:8 / confirmation"]
    end

    Tahap 1 --> Tahap 2
    Tahap 2 --> Tahap 3
    Tahap 3 --> Tahap 4
```

---

## 7. Risk Analysis

| # | Potensi Risiko | Dampak | Probabilitas | Strategi Mitigasi Teknis |
|---|---|:---:|:---:|---|
| 1 | Pengguna terkunci (*locked out*) jika flag `must_change_password` gagal diubah ke `false` di database | Kritis | Rendah | State lokal frontend hanya diubah jika backend mengembalikan respons HTTP 200 dengan nilai `data.must_change_password === false`. Backend telah memiliki test assertion atomik untuk hal ini. |
| 2 | Sesi pengguna logout tiba-tiba saat mengganti password | Sedang | Rendah | Endpoint `PATCH /api/me/password` tidak me-revoke Personal Access Token Sanctum yang sedang aktif. Token tetap valid untuk sesi berjalan. |
| 3 | Pesan error validasi dari server (HTTP 422) tidak muncul di bawah field input | Rendah | Sedang | Pastikan pemetaan `err.errors` ke state `fieldErrors` dipertahankan dan sesuai dengan key backend: `current_password`, `new_password`, dan `new_password_confirmation`. Komponen `Input` sudah memiliki prop `error`. |
| 4 | Data kehadiran atau jurnal gagal dimuat jika `classApi.getClasses` mengalami timeout | Sedang | Rendah | Pemanggilan `classApi.getClasses({ per_page: 50 })` tetap dibungkus dengan `.catch(() => ({ data: [] }))` di dalam `Promise.all`, sehingga jika endpoint kelas lambat/gagal, data presensi dan jurnal tetap dapat ter-render. |

---

## 8. Testing Strategy

### 8.1 Verifikasi Backend (Automated Tests)
Jalankan pengujian terisolasi untuk memastikan endpoint backend tetap solid:
```powershell
cd scp; php artisan test --filter=ChangePasswordTest
```
**Kriteria Hasil:** 8 passed, 0 failed.

### 8.2 Verifikasi Frontend (Manual E2E & Browser Console)

#### Skenario 1: Bugfix Runtime Monitoring Rekap (Fase 1b)
1. Buka browser dan login sebagai akun Waka Kurikulum.
2. Akses URL `/waka/monitoring-recap`.
3. **Hasil yang Wajib Terpenuhi:**
   - Konsol browser (F12) bersih dari error `TypeError: masterDataApi.getClasses is not a function`.
   - Tiga kartu ringkasan metrik kehadiran menampilkan angka riil.
   - Dropdown filter "Rombel Kelas" memuat daftar kelas dari database (bukan opsi kosong).
   - Tabel "Rekapitulasi Presensi" dan "Riwayat Jurnal KBM" terisi data secara presisi.

#### Skenario 2: Mandatory Change Password Alur Pertama Kali Login (Fase 1a)
1. Buat atau gunakan akun siswa/guru baru yang memiliki kolom `must_change_password = 1`.
2. Login ke sistem; pengguna otomatis dialihkan ke halaman `/change-password`.
3. Coba masukkan password lama yang salah:
   - Form menampilkan pesan error server HTTP 422: *"Kata sandi saat ini yang Anda masukkan tidak sesuai."*
   - Pengguna tetap berada di halaman `/change-password`.
4. Masukkan password baru kurang dari 8 karakter:
   - Validasi menampilkan error: *"Kata sandi baru minimal 8 karakter."*
5. Masukkan password baru yang sama dengan password lama:
   - Server menampilkan error: *"Kata sandi baru tidak boleh sama dengan kata sandi saat ini."*
6. Masukkan password baru yang valid ($\ge 8$ karakter, konfirmasi cocok):
   - Sistem menampilkan alert sukses hijau dan mengarahkan pengguna ke beranda sesuai peran.
   - Verifikasi database: Kolom `must_change_password` pada tabel `users` berubah menjadi `0`.

#### Skenario 3: Ubah Password Mandiri di Halaman Profil (Fase 1a)
1. Login dengan akun aktif dan buka menu Profil (`/profile`).
2. Masuk ke bagian "Ubah Kata Sandi".
3. Lakukan pengujian dengan password saat ini yang salah $\rightarrow$ Pastikan banner merah dan error field muncul, dan **TIDAK ADA alert hijau sukses palsu**.
4. Masukkan kata sandi saat ini yang benar dan kata sandi baru yang valid $\rightarrow$ Pastikan kata sandi berhasil diperbarui, form direset, dan user dapat login kembali menggunakan kata sandi baru tersebut.

---

## 9. Acceptance Criteria (Definisi Selesai)

### Kriteria Keberhasilan Fase 1a:
- [ ] Tidak ada lagi penelanan error HTTP 404 pada `AuthContext.jsx`.
- [ ] State `must_change_password` lokal hanya bernilai `false` jika request API menerima HTTP 200.
- [ ] Tidak ada lagi alert sukses palsu di `ProfilePage.jsx` saat API merespons error status 404.
- [ ] Kata sandi baru tersimpan permanen di basis data dalam format hash bcrypt baru.
- [ ] Kolom `must_change_password` pada basis data berubah menjadi `false` (`0`).
- [ ] Seluruh pesan kesalahan validasi HTTP 422 dari server tertampil secara presisi pada form input terkait.

### Kriteria Keberhasilan Fase 1b:
- [ ] Berkas `MonitoringRecapPage.jsx` mengimpor `classApi` secara resmi dari `services/masterDataApi`.
- [ ] Tidak ada error `TypeError` saat halaman `/waka/monitoring-recap` dimuat.
- [ ] `Promise.all` mengeksekusi ketiga request (presensi, jurnal, dan rombel kelas) secara harmonis.
- [ ] Dropdown filter kelas terisi penuh dengan data kelas aktual dari basis data.

---

## 10. Open Questions & Decisions

Sebelum mengeksekusi implementasi, berikut dua poin desain teknis yang telah dianalisis untuk persetujuan:

1. **Pilihan Arsitektur Pemanggilan di `ProfilePage.jsx`:**
   - *Alternatif A:* `ProfilePage.jsx` memanggil `authApi.changePassword` secara langsung lalu memanggil `updateUserProfile({ must_change_password: false })`.
   - *Alternatif B (Rekomendasi):* `ProfilePage.jsx` mendestrukturisasi dan memanggil `changePassword` dari `useAuth()`.
   - *Rekomendasi Tim:* **Alternatif B**, karena memastikan seluruh logika perubahan kata sandi terpusat di satu gerbang (*single source of truth*) dalam `AuthContext`, menghindari duplikasi kode penanganan state profile.
2. **Pembersihan Kondisi Token Demo di `AuthContext.jsx`:**
   - Di baris 126 terdapat guard: `if (token && !token.startsWith('demo_'))`.
   - Mengingat kebijakan resmi proyek adalah **Opsi B (Dibersihkan Total)**, penghapusan guard demo ini di Fase 1a akan langsung menegakkan pemanggilan API riil.
   - *Rekomendasi Tim:* Hapus guard `!token.startsWith('demo_')` pada fungsi `changePassword` di Fase 1a agar seluruh permintaan kata sandi 100% dialirkan ke server backend Sanctum.

---

## 11. Implementation Boundaries (Batasan Wajib)

1. **Scope Freeze:** Hanya diperbolehkan memodifikasi berkas yang tercantum pada [Bab 5 (Affected Files)](#5-affected-files).
2. **Larangan Modifikasi Fase Lanjutan:** Tidak boleh memodifikasi berkas yang masuk ruang lingkup Fase 2 s.d. Fase 5 (seperti `ParentMonitoringPage.jsx`, `ScheduleManagementPage.jsx`, `DashboardWakaPage.jsx`, `MasterDataPage.jsx`, `PermissionVerifyPage.jsx`, `TopBar.jsx`, atau berkas mock di service layer).
3. **Integritas Backend:** Dilarang mengubah kode controller, model, migration, atau test pada direktori `scp/` karena backend telah 100% siap dan terverifikasi untuk Fase 1.
4. **Non-Destructive Execution:** Dilarang mereset basis data atau mengubah konfigurasi lingkungan (`.env`).
