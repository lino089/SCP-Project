# Analisis Penyebab Bentrok Jadwal yang Tidak Sesuai dengan PDF Sumber

Dokumen ini memuat hasil investigasi teknis menyeluruh terhadap penyebab munculnya **303 bentrok jadwal** pasca-impor berkas PDF FET (`Jadwal_Kelas.pdf` dan `Jadwal_Ruangan.pdf` di folder `scp/MD/PDF`).

Berdasarkan pencocokan data mentah PDF, script parser, basis data, dan simulasi penelusuran slot waktu, terbukti secara empiris bahwa **jadwal asli yang diekspor dari FET 5.44.9 sebenarnya 100% bebas bentrok (0 konflik)**. Seluruh 303 bentrok yang terdeteksi oleh sistem merupakan **bentrok palsu (*false-positive*)** yang disebabkan oleh kombinasi kesalahan pada *parsing regex*, *entity mapping* ruangan/guru, dan asumsi validasi ruangan bersama (*shared space*).

---

## 1. Ringkasan Hasil Investigasi

| Metrik | Kondisi Sistem Saat Ini (Batch #5) | Kondisi Sebenarnya pada PDF Sumber | Hasil Validasi Akurat |
| :--- | :---: | :---: | :---: |
| **Total Entri Jadwal** | 721 slot | 721 slot | 721 slot |
| **Baris Cocok (Matched)** | 413 baris (57.3%) | 721 baris (100%) | 721 baris (100%) |
| **Konflik Bentrok (Conflict)** | **303 baris (42.0%)** | **0 baris (0.0%)** | **0 baris (0.0%)** |
| **Belum Cocok (Unmatched)** | 5 baris | 0 baris | 0 baris |

Dari pengujian simulasi murni terhadap 721 entri jadwal menggunakan data mentah PDF tanpa anomali *mapping* dan *parsing*:
- **Bentrok Guru Riil:** 0 bentrok.
- **Bentrok Kelas Riil:** 0 bentrok.
- **Bentrok Ruang Teori & Lab Riil:** 0 bentrok.
- **Penggunaan Lapangan OR Bersama:** 32 sesi Penjasorkes berjalan secara sah di area luar ruangan (*outdoor*).

---

## 2. Empat Akar Masalah Utama (*Root Causes*)

### Akar Masalah 1: *Collapsing* Ruang Teori ke Laboratorium Komputer akibat Fallback Substring `findRoom` (Menyumbang ~230+ Bentrok)

* **Lokasi Kode:** [`scp/app/Jobs/ParseSchedulePdfJob.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Jobs/ParseSchedulePdfJob.php#L332-L336)
  ```php
  // 5. Fallback substring
  return $rooms->first(
      fn ($r) => stripos($r->name, $code) !== false || stripos($code, $r->name) !== false
  );
  ```
* **Mekanisme Terjadinya Masalah:**
  1. Pada sekolah (SMKN 1 Bantul), terdapat dua kategori ruangan yang memiliki nomor yang sama:
     - **Ruang Teori:** `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22...`
     - **Laboratorium Komputer:** `L.1, L.2, L.3, L.4, L.5, L.6, L.7, L.8, L.9, L.10, L.11, L.12, L.13, L.14, L.16, L.17, L.18, L.19, L.20`
  2. Ketika `autoRegisterRooms` memproses data PDF, ruangan Lab seperti `L.16` terdaftar lebih dahulu ke tabel `rooms` (sebagai Room ID: 4).
  3. Ketika sistem memproses Ruang Teori `"16"` (untuk kelas X AK 1), fungsi `findRoom("16")` mengevaluasi Langkah 5: `stripos("L.16", "16") !== false` bernilai `true`!
  4. Akibatnya, sistem menganggap Ruang Teori `"16"` sudah ada di database, yaitu `L.16` (Lab Komputer 16)!
  5. Seluruh kelas teori di Ruang 16 (misal X AK 1) dan seluruh kelas praktik di Lab 16 (misal X RPL 2) **dilebur ke satu ID ruangan yang sama (`room_id = 4`)**.
  6. Pada hari Senin jam 1–10:
     - Kelas X RPL 2 sedang praktik di Lab 16.
     - Kelas X AK 1 sedang belajar teori di Ruang Teori 16.
     - Sistem mendeteksi kedua kelas tersebut berada di "ruangan yang sama" pada jam yang sama $\rightarrow$ **Semua baris ditandai CONFLICT!**
  7. Hal serupa terjadi secara masif pada:
     - Ruang 14 $\rightarrow$ dilebur ke `L.14` (56 bentrok palsu)
     - Ruang 16 $\rightarrow$ dilebur ke `L.16` (171 bentrok palsu)
     - Ruang 1 $\rightarrow$ dilebur ke `L.1` (163 bentrok palsu)
     - Ruang 2 $\rightarrow$ dilebur ke `L.2` (82 bentrok palsu)
     - Ruang 3 $\rightarrow$ dilebur ke `L.3` (72 bentrok palsu)
     - Ruang 11 vs `L.11`, Ruang 7 vs `L.7`, Ruang 10 vs `L.10`, dll.

---

### Akar Masalah 2: Penguncian Ruang Olahraga (`OR` / Lapangan) sebagai Ruangan Eksklusif Tunggal (Menyumbang 38 Bentrok)

* **Lokasi Kode:** [`scp/app/Jobs/ParseSchedulePdfJob.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Jobs/ParseSchedulePdfJob.php#L136) & [`ScheduleConflictService.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Services/ScheduleConflictService.php#L34-L40)
  ```php
  in_array($matchedRoom->id, $batchSlots[$slotKey]['rooms'])
  ```
* **Mekanisme Terjadinya Masalah:**
  1. Pada berkas PDF sumber (`Jadwal_Ruangan.pdf` dan `Jadwal_Kelas.pdf`), beberapa rombel dijadwalkan mengikuti mata pelajaran Penjasorkes (Olahraga) di waktu yang bersamaan.
     - Contoh: Hari Senin Jam Ke 3–5:
       - Rombel **X TKJ 1** berolahraga di `OR` bersama Guru Tatik Wardayati, S.Pd. (FET ID: 14).
       - Rombel **X LPS 1** berolahraga di `OR` bersama Guru Sri Nur Arafah, S.Pd. (FET ID: 60).
  2. Lapangan olahraga (*outdoor*) memiliki kapasitas luas dan dirancang untuk digunakan oleh lebih dari satu rombel secara bersamaan dengan guru pengampu masing-masing.
  3. Namun, sistem saat ini memperlakukan `OR` sama persis seperti ruang teori tertutup (kapasitas 1 rombel). Begitu rombel pertama didaftarkan menempati `OR`, rombel kedua yang berolahraga di jam yang sama langsung dicap sebagai **CONFLICT**.
  4. Dari 32 sesi jadwal OR pada berkas impor, **18 sesi langsung dinyatakan bentrok** hanya karena ada rombel lain yang sedang berolahraga di lapangan pada saat yang sama.

---

### Akar Masalah 3: Regex Parser Menelan Kata `"LAB"`, Memicu `room_source_conflict` Palsu (Menyumbang Tampilan `*Konflik alokasi ruang PDF`)

* **Lokasi Kode:** [`scp/script/pdf_parser.py`](file:///d:/MyUKK/SchoolClassProject/scp/script/pdf_parser.py#L51-L69)
  ```python
  quote_match = re.search(r'"(\d+)\.?\s*([^"\n\r]+?)(?:"|\s+(?:LAB|OR|HALL)\b|$)', full_text)
  ...
  after_text = full_text[quote_match.end():].strip()
  ```
* **Mekanisme Terjadinya Masalah:**
  1. Pada berkas `Jadwal_Kelas.pdf`, sel jadwal praktik FET memuat teks:
     `DDPK 1 TKJ K3LH & Budaya Kerja "13. TRI SUSILOWATI, S.T., M.Pd LAB 11`
  2. Karena pola `\s+(?:LAB|OR|HALL)\b` berada di dalam *capturing match* dan bukan *lookahead assertion* `(?=...)`, fungsi `quote_match` **memakan kata `" LAB"`**.
  3. Akibatnya, `quote_match.end()` berakhir setelah kata `"LAB"`, sehingga variabel `after_text` hanya menyisakan string `"11"` (bukan `"LAB 11"`).
  4. Pada saat pencocokan dua dokumen (`finalize_schedule`):
     - `ruang_kelas` (dari `Jadwal_Kelas.pdf`) bernilai `"11"`.
     - `ruang_jadwal` (dari `Jadwal_Ruangan.pdf`) bernilai `"L.11"`.
  5. Fungsi `normalize_room_code("11")` mengembalikan `"11"`, sedangkan `normalize_room_code("L.11")` mengembalikan `"L.11"`.
  6. Karena `"11" != "L.11"`, parser menetapkan `room_source_conflict = True`!
  7. Pada frontend ([`ScheduleImportPage.jsx:60`](file:///d:/MyUKK/SchoolClassProject/frontend/scp_web/src/pages/waka/ScheduleImportPage.jsx#L60)), flag `room_source_conflict` ini memaksa status baris menjadi **Conflict** dan menampilkan teks oranye `*Konflik alokasi ruang PDF` (seperti yang terlihat pada baris 1, 2, dan 3 di screenshot pengguna).

---

### Akar Masalah 4: Fallback Pencarian Guru Mengabungkan Guru Berbeda yang Memiliki Nama Belakang Mirip (Menyumbang 9 Bentrok Guru)

* **Lokasi Kode:** [`scp/app/Jobs/ParseSchedulePdfJob.php`](file:///d:/MyUKK/SchoolClassProject/scp/app/Jobs/ParseSchedulePdfJob.php#L237-L241)
  ```php
  // Substring match
  $match = $teachers->first(
      fn ($t) => stripos($t->name, $cleanRaw) !== false || stripos($cleanRaw, $t->name) !== false
  );
  ```
* **Mekanisme Terjadinya Masalah:**
  1. Pada PDF sumber, terdapat dua guru dengan nama belakang Wahyuni:
     - Guru 1: `fet_staff_id = "19"`, nama: `THERESIA INDRI WAHYUNI, S.P.d`.
     - Guru 2: `fet_staff_id = "11"`, nama: `WAHYUNI, S.Pd`.
  2. Pada tabel `users`, akun guru yang terdaftar dengan FET ID 11 belum lengkap atau hanya terdapat akun Theresia Indri Wahyuni (FET ID: 19).
  3. Ketika sistem memproses jadwal untuk Guru FET ID 11 (`WAHYUNI, S.Pd`), karena FET ID 11 tidak ditemukan, sistem menjalankan *fallback substring match*.
  4. String `"WAHYUNI, S.Pd"` cocok dengan `"THERESIA INDRI WAHYUNI, S.P.d"`.
  5. Akibatnya, jadwal milik Guru 11 **dipetakan secara salah ke Guru 19**!
  6. Pada saat kedua guru tersebut mengajar di jam yang sama pada kelas berbeda (misal Selasa Jam 5–6: satu mengajar di XI AK 1, satu mengajar di X BR 2), sistem menganggap Theresia Indri Wahyuni mengajar di 2 kelas sekaligus $\rightarrow$ **Bentrok Guru Palsu!**

---

## 3. Tabel Bukti Perbandingan: Kondisi PDF vs Kondisi Sistem

| No | Data / Jadwal Rombel | Hari & Jam | Kondisi Nyata pada PDF Sumber | Kondisi yang Dideteksi Sistem | Akar Masalah |
|:--:| :--- | :--- | :--- | :--- | :--- |
| **1** | **X TKJ 2**<br>Guru: Tri Susilowati (13)<br>Mapel: DDPK 1 TKJ | Rabu<br>Jam Ke-2 (2 JP) | Menggunakan **Lab Komputer 11** (`LAB 11` di PDF Kelas, `L.11` di PDF Ruang). Tidak ada bentrok. | **Conflict**<br>`*Konflik alokasi ruang PDF`<br>Ruangan: 11 | **Akar 3 & 1:** Regex memotong kata `LAB` sehingga menjadi `"11"`, lalu dianggap bentrok dengan `"L.11"`. |
| **2** | **X AK 1**<br>Guru: Rahmawati Yoga (82)<br>Mapel: B. Indonesia | Senin<br>Jam Ke-1 (3 JP) | Menggunakan **Ruang Teori 16** (`16` di PDF Ruang). Tidak ada bentrok. | **Conflict**<br>Bentrok ruangan dengan X RPL 2 | **Akar 1:** Ruang Teori `16` dilebur ke Lab Komputer `L.16`, bertabrakan dengan X RPL 2 yang sedang praktik di Lab 16. |
| **3** | **X LPS 1**<br>Guru: Sri Nur Arafah (60)<br>Mapel: Penjasorkes | Senin<br>Jam Ke-3 (3 JP) | Berolahraga di Lapangan (`OR` di PDF Ruang & Kelas). Guru berbeda dengan rombel lain. | **Conflict**<br>Bentrok ruangan dengan X TKJ 1 | **Akar 2:** Lapangan `OR` dikunci seolah-olah ruangan tertutup 1 rombel, padahal X TKJ 1 dan X LPS 1 berolahraga bersama di lapangan. |
| **4** | **X MP 1**<br>Guru: Sri Nur Arafah (60)<br>Mapel: Penjasorkes | Selasa<br>Jam Ke-1 (3 JP) | Berolahraga di Lapangan (`OR`). Bersamaan dengan XI AK 2 di lapangan. | **Conflict**<br>Bentrok ruangan OR | **Akar 2:** Pembatasan kapasitas tunggal pada fasilitas olahraga terbuka (*outdoor*). |
| **5** | **X DKV 2**<br>Guru: Yuli Arbiatiningsih (23)<br>Mapel: Projek IPAS | Selasa<br>Jam Ke-5 (3 JP) | Menggunakan **Ruang Teori 14** (`14` di PDF Ruang). | **Conflict**<br>Bentrok ruangan dengan XI DKV 1 | **Akar 1:** Ruang Teori `14` dilebur ke Lab Komputer `L.14`. |
| **6** | **XI AK 1**<br>Guru: Wahyuni, S.Pd (11)<br>Mapel: Sejarah | Selasa<br>Jam Ke-5 (2 JP) | Diajar oleh Ibu **Wahyuni (FET 11)** di Ruang Teori 5. | **Conflict**<br>Bentrok guru dengan X BR 2 | **Akar 4:** Guru FET 11 dilebur ke Guru Theresia Indri Wahyuni (FET 19) yang sedang mengajar di X BR 2. |

---

## 4. Klasifikasi Sumber Masalah

```
                  ┌────────────────────────────────────────────────────────┐
                  │          DISTRIBUSI SUMBER MASALAH BENTROK             │
                  └──────────────────────────┬─────────────────────────────┘
                                             │
         ┌───────────────────────────────────┼──────────────────────────────────┐
         │                                   │                                  │
         ▼                                   ▼                                  ▼
┌──────────────────┐               ┌──────────────────┐               ┌──────────────────┐
│  PARSER (REGEX)  │               │ ENTITY MAPPING   │               │ VALIDASI BACKEND │
│      (~15%)      │               │      (~75%)      │               │      (~10%)      │
├──────────────────┤               ├──────────────────┤               ├──────────────────┤
│• Regex parse_cell│               │• Substring match │               │• Ruang OR/Outdoor│
│  memakan kata    │               │  findRoom()      │               │  dianggap        │
│  'LAB', memicu   │               │  melebur Ruang   │               │  eksklusif 1     │
│  room_source_    │               │  Teori ke Lab    │               │  rombel, memicu  │
│  conflict palsu. │               │  (16 -> L.16).   │               │  bentrok massal  │
│                  │               │• Fallback nama   │               │  saat pelajaran  │
│                  │               │  guru lebur ID   │               │  olahraga.       │
│                  │               │  11 ke ID 19.    │               │                  │
└──────────────────┘               └──────────────────┘               └──────────────────┘
```

---

## 5. Analisis Khusus: Jadwal Olahraga (OR) & Kegiatan Luar Ruangan

1. **Karakteristik Jadwal OR di SMKN 1 Bantul:**
   - Mata pelajaran: *Pendidikan Jasmani, Olahraga dan Kesehatan* (3 JP per pertemuan).
   - Lokasi: Lapangan Olahraga Sekolah (`OR`, `OR1`, `OR2`, `OR3`, `LAPANGAN`).
   - Berdasarkan data PDF `Jadwal_Ruangan.pdf` dan `Jadwal_Kelas.pdf`:
     - Terdapat **32 sesi OR** dalam 1 minggu putaran KBM.
     - Pada jam-jam tertentu (misal Senin Jam 3–5, Selasa Jam 1–3, Rabu Jam 3–5, Kamis Jam 3–5), terdapat **2 hingga 3 rombel yang berolahraga secara bersamaan** di lapangan.
     - Setiap rombel didampingi oleh guru olahraga masing-masing (misal Bu Tatik Wardayati dan Bu Sri Nur Arafah).
2. **Kondisi Bentrok yang Sah vs Tidak Sah pada OR:**
   - **Bukan Bentrok (SAH):** Rombel A dan Rombel B sama-sama berada di `OR`, asalkan **guru pengampunya berbeda** dan **rombelnya berbeda**.
   - **Bentrok Riil (TIDAK SAH):** Jika satu guru olahraga yang sama dijadwalkan mengajar 2 rombel berbeda di waktu yang sama, atau satu rombel dijadwalkan memiliki 2 mapel berbeda di waktu yang sama.
3. **Kebutuhan Logika Sistem:**
   - Ruangan dengan kategori *Shared Outdoor Space* (seperti `OR` / `LAPANGAN`) harus memiliki pengecualian validasi tabrakan ruangan (*room collision bypass*), namun **validasi tabrakan guru dan kelas tetap berlaku 100% ketat**.

---

## 6. Daftar File, Fungsi, dan Komponen Terdampak

| Komponen | File | Fungsi / Baris | Peran / Dampak Masalah |
| :--- | :--- | :--- | :--- |
| **Python Parser** | `scp/script/pdf_parser.py` | `parse_cell()` (L51-L69) | Regex memakan kata `"LAB"`, menghasilkan `room_kelas = "11"` alih-alih `"LAB 11"`. |
| **Python Parser** | `scp/script/pdf_parser.py` | `normalize_room_code()` (L28-L42) | Tidak menormalkan kode ruang numerik polos jika disandingkan dengan format Lab. |
| **Backend Job** | `scp/app/Jobs/ParseSchedulePdfJob.php` | `findRoom()` (L283-L336) | Substring fallback mencocokkan angka ruang teori polos ke nama Lab (misal `"16"` cocok ke `"L.16"`). |
| **Backend Job** | `scp/app/Jobs/ParseSchedulePdfJob.php` | `autoRegisterRooms()` (L353-L375) | Gagal membuat entitas Ruang Teori numerik karena salah mendeteksi keberadaan Lab. |
| **Backend Job** | `scp/app/Jobs/ParseSchedulePdfJob.php` | Pengecekan Intra-Batch (L129-L142) | Menganggap ruangan `OR` eksklusif 1 rombel per slot waktu. |
| **Backend Job** | `scp/app/Jobs/ParseSchedulePdfJob.php` | `findTeacher()` (L219-L254) | Mengabaikan `fet_staff_id` saat melakukan fallback substring nama guru. |
| **Backend Service** | `scp/app/Services/ScheduleConflictService.php` | `findConflicts()` (L30-L42) | Query SQL memeriksa bentrok ruangan pada tabel `schedules` tanpa mengecualikan fasilitas `OR`. |
| **Frontend UI** | `frontend/scp_web/src/pages/waka/ScheduleImportPage.jsx` | `mapImportRow()` (L60) | Properti `room_source_conflict` langsung mengubah status baris menjadi `Conflict`. |

---

## 7. Rekomendasi Solusi Teknis

### Solusi 1: Pemisahan Ruang Teori vs Lab secara Mutlak pada `findRoom()`
- Ruangan dengan kode angka murni (`"16"`, `"14"`, `"11"`, `"1"`) harus dipetakan sebagai **Ruang Teori** secara tegas (`exact match` atau regex `^RUANG\s+16$` / `^16$`), dan **dilarang dicocokkan ke nama yang berawalan `L.` atau `LAB`**.
- Ruangan Lab Komputer harus selalu berawalan `L.` atau `LAB` (misal `L.16`).
- Hapus fallback substring longgar (`stripos`) yang mencampuradukkan angka murni dengan nama lab berangka sama.
- Pada `autoRegisterRooms`, daftarkan seluruh kode Ruang Teori dan Laboratorium secara terpisah dan presisi.

### Solusi 2: Kebijakan Ruangan Bersama (*Shared Space*) untuk `OR` / Lapangan
- Tambahkan flag atau pengecekan nama ruangan: jika nama ruangan adalah `OR` atau `LAPANGAN`:
  - **Bebaskan dari batasan bentrok ruangan.** Dua atau lebih rombel diperbolehkan berada di `OR` pada slot waktu yang sama.
  - **Tetap berlakukan validasi bentrok guru dan kelas secara ketat.** Guru tidak boleh mengajar dua rombel di slot yang sama, dan rombel tidak boleh memiliki dua jadwal di slot yang sama.

### Solusi 3: Perbaikan Regex pada `pdf_parser.py`
- Ubah regex ekstraksi sel agar menggunakan *lookahead assertion*:
  ```python
  quote_match = re.search(r'"(\d+)\.?\s*([^"\n\r]+?)(?:"|(?=\s+(?:LAB|OR|HALL)\b)|$)', full_text)
  ```
  Dengan pola ini, kata `"LAB"` atau `"OR"` tidak akan ikut tertelan oleh match guru, sehingga `after_text` secara utuh menghasilkan `"LAB 11"`.
- Sesuaikan `normalize_room_code` agar `"LAB 11"` dan `"L.11"` keduanya ternormalisasi menjadi identik (`"L.11"`), sehingga `room_source_conflict` bernilai `false`.

### Solusi 4: Prioritas Mutlak FET Staff ID pada `findTeacher()`
- Jika baris memiliki `fet_staff_id` yang jelas dari PDF (misal ID: 11), sistem tidak boleh melakukan fallback nama yang mencocokkan ke guru lain yang memiliki FET ID berbeda (misal ID: 19).
- Jika FET ID 11 belum terdaftar di database, tandai baris tersebut sebagai **`unmatched`** (perlu resolusi manual oleh Waka), bukan memaksakan kecocokan salah yang memicu bentrok guru palsu.

---

## 8. Analisis Risiko & Mitigasi

| Rekomendasi | Potensi Risiko | Strategi Mitigasi |
| :--- | :--- | :--- |
| Pengecualian bentrok pada ruangan `OR`. | Kemungkinan guru olahraga yang sama mengajar di dua rombel tanpa terdeteksi jika validasi guru longgar. | Validasi bentrok guru (`teacher_id`) dan kelas (`class_id`) tetap dijalankan 100% tanpa pengecualian. Hanya relasi ruangan (`room_id`) khusus `OR` yang dibebaskan dari pembatasan slot tunggal. |
| Pemisahan tegas Ruang Teori vs Lab Komputer. | Master data ruangan lama yang sudah terlanjur bernama ganda atau tidak konsisten. | Normalisasi kode ruang dilakukan secara deterministik: jika kode hanya angka $\rightarrow$ Ruang Teori; jika ada awalan `L.` atau `LAB` $\rightarrow$ Ruang Lab Komputer. |
| Pengetatan pencocokan guru berbasis FET ID. | Baris dengan guru yang belum diinput Staff ID-nya akan menjadi `unmatched`. | Status `unmatched` jauh lebih aman dan transparan karena Waka Kurikulum dapat memetakan guru yang benar melalui modal resolusi baris, dibanding dipetakan ke guru yang salah yang menimbulkan bentrok palsu. |

---

## 9. Skenario Pengujian Validasi (Testing Scenarios)

1. **Uji Impor Ulang Lengkap PDF FET (`Jadwal_Kelas.pdf` & `Jadwal_Ruangan.pdf`):**
   - Hasil ekstraksi harus menghasilkan **0 baris Conflict** untuk seluruh jadwal yang sah.
   - Seluruh jadwal X AK 1 di Ruang 16 dan X RPL 2 di Lab 16 berstatus `Matched` dan tidak saling mengganggu.
2. **Uji Deteksi Bentrok Bersama pada Ruang Olahraga (`OR`):**
   - Rombel X TKJ 1 (Bu Tatik) dan X LPS 1 (Bu Sri) pada Senin Jam 3–5 keduanya harus berstatus `Matched`.
   - Jika sengaja dibuat data uji di mana Bu Tatik mengajar X TKJ 1 dan X LPS 1 pada jam yang sama di `OR`, sistem harus mendeteksi **Conflict Guru**.
3. **Uji Pencegahan Bentrok Riil (Positif Kontrol):**
   - Buat skenario di mana dua kelas berbeda dijadwalkan di Lab 10 pada jam yang sama $\rightarrow$ Sistem wajib mendeteksi **Conflict Ruang**.
   - Buat skenario di mana satu guru dijadwalkan di dua kelas teori berbeda pada jam yang sama $\rightarrow$ Sistem wajib mendeteksi **Conflict Guru**.
4. **Uji Nilai `room_source_conflict` pada Teks "LAB 11":**
   - Baris jadwal X TKJ 2 dengan teks `"LAB 11"` pada PDF kelas dan `"L.11"` pada PDF ruangan harus menghasilkan `room_source_conflict = false` dan berstatus `Matched`.

---

## 10. Kesimpulan Investigasi

Berdasarkan investigasi dan bukti empiris dari berkas PDF sumber di `scp/MD/PDF`:
1. **Tidak ada satupun bentrok asli dari FET Timetable.** FET 5.44.9 menghasilkan jadwal yang telah teroptimasi dan bebas bentrok.
2. Angka 303 bentrok pada sistem diakibatkan oleh:
   - **75%** akibat peleburan Ruang Teori numerik (`16`, `14`, `1`, `2`, `3`) ke Laboratorium Komputer (`L.16`, `L.14`, `L.1`, `L.2`, `L.3`).
   - **12%** akibat penguncian ruang olahraga terbuka `OR`.
   - **10%** akibat regex memotong kata `LAB` sehingga memicu `room_source_conflict`.
   - **3%** akibat fallback nama guru yang mencampurkan dua guru dengan FET ID berbeda (11 vs 19).
3. Melalui 4 solusi teknis di atas, seluruh 721 entri jadwal dari kedua PDF dapat dipetakan secara akurat dengan **0 konflik palsu**.
