# Akun Kredensial Pengujian Riil (Database: `db_scp`)

Dokumen ini berisi daftar akun uji coba aktif yang bersumber langsung dari database riil PostgreSQL (`db_scp`). Seluruh akun siap digunakan untuk pengujian login dan alur kerja aplikasi secara *real-time*.

---

## 1. Waka Kurikulum (Administrator Akademik)

| Field | Kredensial |
| :--- | :--- |
| **Peran (Role)** | `vice_principal` |
| **Username / Email** | `admin@sch.id` / `waka@smkn1bantul.sch.id` |
| **Kata Sandi (Password)** | `password123` |
| **Hak Akses** | Master Data, Import Jadwal, Atur Siklus & Tahun Ajaran, Review & Reset |

---

## 2. Guru Pengampu (Teacher)

> *Catatan: Guru login menggunakan **Nomor Telepon** sebagai ID dan **NIP** sebagai kata sandi awal.*

| Nama Guru | Nomor Telepon (ID Login) | NIP (Kata Sandi Awal) | Mata Pelajaran |
| :--- | :--- | :--- | :--- |
| **Aris Purwantinah, S.Pd.** | `081234567801` | `197707152007051002` | Bisnis Ritel |
| **Sunarsih, S.Pd.** | `081234567802` | `197810222008072003` | Projek IPAS & Informatika |
| **Amat Sukardi, S.Pd.** | `081234567804` | `198107152011011006` | Bahasa Inggris |
| **Muhammad Heru P., M.S.I.**| `081234567805` | `198210222012032007` | Bahasa Indonesia |
| **Sujar Hartono, S.Pd.** | `081234567807` | `198404082014072009` | Bahasa Inggris (Jadwal di X RPL 1) |

*(Total ada 87 guru riil terdaftar dengan format nomor telepon `081234567801` s/d `081234567887`).*

---

## 3. Peserta Didik (Student)

> *Catatan: Siswa login menggunakan **NIS** sebagai ID dan **NISN (10 digit)** sebagai kata sandi awal.*

| Nama Siswa | NIS (ID Login) | NISN (Kata Sandi Awal) | Rombel Kelas |
| :--- | :--- | :--- | :--- |
| **Dimas Nugroho** | `12100` | `0082975643` | X RPL 1 |

*(Total ada 1.536 siswa riil aktif terdaftar pada 48 rombel kelas).*

---

## 4. Wali Murid (Parent)

> *Catatan: Wali Murid login menggunakan **`P-` + NIS Siswa** sebagai ID dan **NISN Siswa (10 digit)** sebagai kata sandi awal.*

| Nama Wali Siswa | ID Login Wali | Kata Sandi (NISN Anak) | Siswa Terkait |
| :--- | :--- | :--- | :--- |
| **Wali Murid Dimas Nugroho** | `P-12100` | `0082975643` | Dimas Nugroho (X RPL 1) |

*(Total ada 1.536 akun wali murid yang otomatis terhubung ke siswa masing-masing via `linked_student_id`).*
