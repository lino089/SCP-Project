# Panduan & Perencanaan Redesign UI (Design System Transformation)

Dokumen ini memuat panduan komprehensif untuk mentransformasi seluruh antarmuka aplikasi dari gaya visual lama (*Gambar 1*) menuju standar modern, minimalis, dan profesional ala platform institusi/finansial premium (*Gambar 2*). 

> **Prinsip Utama:** Layout, susunan grid, dan arsitektur hierarki konten tetap dipertahankan. Perubahan difokuskan murni pada *visual language* (warna, tipografi, spasi, kontras, dan perlakuan komponen).

---

## 1. Fondasi Design Tokens

### 1.1 Palet Warna (Color System)
Singkirkan kontras ekstrem (misal banner navy gelap pekat berpadu aksen kuning menyala) dan warna-warni acak pada container ikon. Terapkan palet warna terstandarisasi berikut:

| Token Name | Hex Code | Deskripsi Penggunaan |
| :--- | :--- | :--- |
| `color-bg-app` | `#F8F9FA` | Latar belakang kanvas aplikasi (neutral off-white) |
| `color-surface` | `#FFFFFF` | Latar belakang Card, Bottom Sheet, Modal |
| `color-surface-subtle` | `#F1F3F6` | Latar container chip non-aktif, segmented control base |
| `color-text-primary` | `#0F172A` | Judul layar, teks utama, angka penting (slate black) |
| `color-text-secondary`| `#64748B` | Subtitle, body copy, keterangan jam/tanggal |
| `color-text-muted` | `#8A94A6` | Label kategori uppercase, caption kecil, placeholder |
| `color-action-blue` | `#0066FF` | Tautan aksi (*"Tampilkan lebih banyak"*, link navigasi aktif) |
| `color-border-subtle` | `#EDF0F5` | Garis pembatas card & divider (1px flat solid) |
| `color-badge-green-bg`| `#E8F8F0` | Latar badge status positif / aktif |
| `color-badge-green-fg`| `#059669` | Teks badge status positif / aktif |
| `color-badge-red-bg` | `#FDE8E8` | Latar badge status bentrok / tenggat waktu |
| `color-badge-red-fg` | `#E02424` | Teks badge status bentrok / tenggat waktu |
| `color-badge-amber-bg`| `#FEF3C7` | Latar badge status peringatan / pending |
| `color-badge-amber-fg`| `#D97706` | Teks badge status peringatan / pending |

---

### 1.2 Skala Tipografi (Typographic Hierarchy)

| Peruntukan | Ukuran (Size) | Bobot (Weight) | Letter Spacing | Transform / Catatan |
| :--- | :--- | :--- | :--- | :--- |
| **Page Header (H1)** | 22px – 24px | 700 (Bold) | -0.5px | Sentence case |
| **Section Title** | 12px – 13px | 600 (Semi-bold)| +0.8px | **UPPERCASE** (warna `#8A94A6`) |
| **Action Link** | 13px | 500 (Medium) | Normal | Sentence case (warna `#0066FF`) |
| **Card Heading** | 15px – 16px | 600 (Semi-bold)| Normal | Sentence case, line-height 1.35 |
| **Body / Caption** | 12px – 13px | 400 (Regular) | Normal | Warna `#64748B` |
| **Badge / Status** | 10px – 11px | 600 (Semi-bold)| +0.2px | Sentence/Caps, padding rapat |

---

### 1.3 Sudut & Elevasi (Border Radius & Shadow)

* **Card Radius:** `12px` hingga `16px`.
* **Badge / Pill Tag:** `4px` hingga `6px` untuk status kotak lembut; `9999px` untuk floating balance/selector.
* **Elevasi / Bayangan:**
  * **Larangan:** Hindari drop shadow pekat/buram gelap.
  * **Rekomendasi:** Gunakan flat border tipis: `1px solid #EDF0F5` atau soft elevation: `box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);`.

---

## 2. Standardisasi Komponen Antarmuka (Shared Components)

### 2.1 Section Header Terpadu
Gantikan heading teks biasa dengan pattern 2-kolom seperti pada Gambar 2:
* **Kiri:** Label kategori huruf kapital kecil (`UPPERCASE`, warna `#8A94A6`, 12px).
* **Kanan:** Link aksi cepat (`"Tampilkan lebih banyak"` / `"Kelola"`, warna `#0066FF`, 13px).

### 2.2 Hero / Summary Information Card
* **Kondisi Lama:** Card navy gelap pekat berlatar kontras tinggi dengan teks kuning menyala.
* **Kondisi Baru:** 
  * Card putih flat ber-border lembut (`#EDF0F5`).
  * Teks judul "Tahun Ajaran 2025/2026 Ganjil" menggunakan `#0F172A`.
  * Status "Aktif" diletakkan pada badge kapsul kecil hijau lembut (`#E8F8F0`) di samping atau pojok kanan atas.
  * Tombol switch siklus diubah menjadi *Segmented Control* ringkas.

### 2.3 Segmented Control (Pengganti Tombol Siklus Lama)
* Menggunakan container latar `#F1F3F6` dengan padding 3px.
* Opsi aktif berupa pill putih `#FFFFFF` dengan shadow ultra-halus dan teks hitam tegas.
* Opsi non-aktif berupa teks abu netral `#64748B` tanpa background.

### 2.4 Agenda / List Item Card
* **Kondisi Lama:** Nested cards (border kotak biru muda membungkus kartu putih bertingkat).
* **Kondisi Baru:**
  * Hilangkan border pembungkus luar.
  * Tampilkan agenda sebagai item tersendiri di atas surface putih bersih, dipisahkan oleh garis border tipis `1px solid #EDF0F5`.
  * Kategori agenda ("Holiday", "Exam") menggunakan badge teks abu-abu lembut tanpa aksen mencolok.

### 2.5 Grid Menu Navigasi & Ikon
* **Kondisi Lama:** Background ikon warna-warni pastel (kuning, biru, hijau, ungu).
* **Kondisi Baru:**
  * Container ikon diseragamkan dengan latar abu netral (`#F1F5F9`) atau aksen brand monokromatis transparan (`rgba(0, 102, 255, 0.08)`).
  * Seluruh ikon menggunakan bobot garis seragam (*stroke width: 1.5px – 1.75px*).

### 2.6 Bottom Navigation Bar
* Latar putih solid (`#FFFFFF`) dengan border atas `1px solid #EDF0F5`.
* Hilangkan bar kuning tebal di atas ikon.
* Status aktif cukup ditunjukkan dengan perubahan warna ikon & teks menjadi hitam/navy pekat atau biru primer.
* Label font seragam: 11px Medium.

---

## 3. Penerapan Konsisten di Seluruh Halaman

Layout halaman tidak perlu dibongkar ulang; cukup sesuaikan styling elemen pada tiap modul:

```
[ Layout Aplikasi Tetap ]
├── Top Header / Bar Akun      --> Diberi styling pill minimalis (ala pill saldo Gambar 2)
├── Hero Summary Banner        --> Diubah ke White Card + Segmented Control
├── Section Header (Kategori)  --> Format 2-kolom (Uppercase + Link Aksi Biru)
├── Content Area (Card/List)   --> Flat White Cards (Border 1px #EDF0F5, tanpa nested border)
└── Bottom Navigation          --> Stroke ikon tipis (1.5px), indikator aktif clean
```

### 3.1 Halaman Dashboard (Waka Kurikulum)
1. Ubah banner status "Tahun Ajaran" dari hitam pekat menjadi clean white card.
2. Hapus container border biru pada "Agenda Sekolah Hari Ini".
3. Standarkan icon container pada "Menu Manajemen Kurikulum" menjadi monokrom netral.

### 3.2 Halaman Jadwal & Kalender
1. **Tabs & Filter:** Gunakan pill chips datar dengan border tipis untuk pemilihan hari/kelas.
2. **Timeline / Slot Jam:** Garis penunjuk waktu menggunakan warna abu-abu netral tipis.
3. **Card Mata Pelajaran:** Card putih dengan penanda strip warna kecil (maksimal 3px di sisi kiri) sebagai pembeda kategori tanpa mendominasi visual.

### 3.3 Halaman Master Data & Monitoring
1. **Search & Filter Bar:** Input field tanpa drop shadow, border `1px solid #CBD5E1`, sudut `10px`.
2. **Status Bentrok / Warning:** Gunakan pill badge merah lembut (`#FDE8E8` / `#E02424`) yang terisolasi rapi, bukan mengubah seluruh baris menjadi merah menyala.
3. **Tabel Data:** Gunakan zebra striping lembut (`#F8FAFC`) dengan baris pemisah minimalis.

---

## 4. Tahapan Implementasi (Rollout Plan)

1. **Sprint 1: Token Global & Typography Reset**
   * Deklarasi palet warna baru di stylesheet global atau Tailwind configuration.
   * Reset font weight, scale, dan default link color (`#0066FF`).
   * Setel background universal aplikasi ke `#F8F9FA`.

2. **Sprint 2: Standardisasi Komponen Utama**
   * Refaktor komponen `Card`, `SectionHeader`, `Badge`, `SegmentedControl`, dan `BottomNav`.
   * Hapus asset ikon lama dan ganti dengan icon set outline 1.5px yang seragam (misal: Lucide Icons atau Feather Icons).

3. **Sprint 3: Penerapan ke Dashboard & Menu Utama**
   * Terapkan styling baru ke halaman Dashboard Waka Kurikulum.
   * Evaluasi keterbacaan data agenda dan aksesibilitas kontras.

4. **Sprint 4: Penerapan Menyeluruh & Quality Check**
   * Terapkan token baru ke Halaman Jadwal, Master Data, dan Monitoring.
   * Lakukan audit visual memastikan tidak ada lagi border nested dan warna acak yang tersisa.