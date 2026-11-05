# Rencana Implementasi & Panduan Setup Google AI Studio (Free Tier) — SCP

**Proyek:** School Class Progress (SCP) — SMK Negeri 1 Bantul  
**Nomor Dokumen:** SCP-PLAN-AI-2026-001  
**Status:** DRAFT PERENCANAAN — *Menunggu Persetujuan Pengguna (Belum Diimplementasikan)*  
**Tanggal Penyusunan:** 5 November 2026  
**Target Komponen:** Backend Laravel (`scp/app/Services/AIService.php`, `scp/config/services.php`, `scp/.env`)  

---

## 1. Latar Belakang & Tujuan

Fitur Kuis Berbantuan AI pada proyek SCP mencakup 3 kemampuan utama:
1. **Pembuatan Soal Otomatis dari Prompt:** Guru memasukkan materi, AI menghasilkan kombinasi soal Pilihan Ganda & Esai terstruktur JSON.
2. **Ekstraksi Soal dari Berkas Dokumen:** Guru mengunggah materi PDF/TXT (maks. 5MB), AI menyusun teks menjadi butir soal terstandarisasi.
3. **Koreksi Asinkron Jawaban Esai Siswa:** AI mengevaluasi jawaban esai siswa terhadap rubrik kata kunci secara semantik, memberikan skor 0–100 dan umpan balik (*feedback*).

Saat ini, backend terhubung ke gateway pihak ketiga (`9router.wekanz.id`) yang berpotensi menimbulkan biaya sewa token/gateway saat sistem diadopsi oleh pihak sekolah.

**Tujuan Rencana Ini:**
Mengalihkan koneksi AI secara langsung ke **Google AI Studio (Gemini Flash Free Tier)** agar sistem:
- **100% Gratis Selamanya:** Sekolah tidak dibebani biaya operasional token/langganan kartu kredit.
- **Resmi & Stabil:** Mengakses langsung infrastruktur Google Cloud AI dengan latensi rendah.
- **Zero Heavy Refactoring:** Memanfaatkan antarmuka kompatibilitas OpenAI (*OpenAI-compatible endpoint*) yang disediakan Google AI Studio, sehingga logika inti `AIService.php` tetap utuh.

---

## 2. Panduan Langkah Demi Langkah Cara Setup Google AI Studio (Bagi Pengembang & Sekolah)

Berikut adalah panduan resmi yang dapat dilakukan oleh Anda sekarang (maupun staf IT sekolah di masa depan) untuk memperoleh Kunci API (*API Key*) gratis:

### Langkah 1: Buka Portal Google AI Studio
1. Buka peramban (*browser*) dan kunjungi portal resmi:  
   👉 **`https://aistudio.google.com/`**
2. Masuk (*Sign In*) menggunakan akun Google biasa (`@gmail.com` atau akun Google Workspace sekolah).
3. **Tidak memerlukan kartu kredit ataupun deposit saldo.**

### Langkah 2: Buat API Key Baru
1. Pada menu navigasi sebelah kiri, klik tombol **"Get API key"**.
2. Klik tombol **"Create API key"**.
3. Pilih opsi project:
   - Pilih project Google Cloud yang sudah ada, **ATAU**
   - Pilih *"Create API key in new project"* (Google akan membuatkan container project gratis secara otomatis).
4. Salin kode API Key yang muncul (diawali dengan karakter `AIzaSy...`).
5. Simpan API Key ini di tempat yang aman (jangan pernah membagikannya secara publik atau mengunggahnya ke repositori GitHub terbuka).

### Langkah 3: Konfirmasi Batas Kuota Gratis (Free Tier Quota)
Pada tier gratis Google AI Studio untuk model **Gemini 1.5 Flash**:
- **Batas Harian:** **1.500 Request per Hari (RPD)**.
- **Batas Per Menit:** **15 Request per Menit (RPM)**.
- **Batas Token:** **1.000.000 Token per Menit (TPM)**.

*Estimasi untuk Sekolah:* Jika 10 guru membuat masing-masing 2 kuis dalam satu hari dan 100 siswa mengumpulkan esai, kuota harian yang terpakai hanya sekitar ~120 request dari jatah 1.500 request (sisa kuota masih sangat melimpah).

---

## 3. Rencana Teknis Perubahan Konfigurasi

### 3.1. Penyelarasan Variabel Lingkungan (`scp/.env`)
Penggantian konfigurasi dari gateway lama ke endpoint resmi Google:

```env
# =========================================================================
# KONFIGURASI LAYANAN AI (GOOGLE AI STUDIO - FREE TIER)
# =========================================================================
# Endpoint kompatibel OpenAI resmi dari Google AI Studio:
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai

# Kunci API resmi hasil generate dari aistudio.google.com:
AI_API_KEY=AIzaSy_MASUKKAN_KUNCI_API_GOOGLE_ANDA_DI_SINI

# Model resmi Free Tier (Cepat, Efisien, & Stabil untuk Format JSON):
AI_MODEL=gemini-1.5-flash

# Timeout request dalam detik (disarankan 45 - 60 detik):
AI_TIMEOUT=60

# Verifikasi SSL (Wajib true untuk production/keamanan data):
AI_VERIFY_SSL=true
```

### 3.2. Penyelarasan Konfigurasi Layanan (`scp/config/services.php`)
Memastikan nilai default fallback merujuk ke Google AI Studio:

```php
'ai' => [
    'base_url' => env('AI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
    'api_key' => env('AI_API_KEY'),
    'model' => env('AI_MODEL', 'gemini-1.5-flash'),
    'timeout' => (int) env('AI_TIMEOUT', 60),
    'verify_ssl' => (bool) env('AI_VERIFY_SSL', true),
],
```

---

## 4. Analisis Kompatibilitas Kode (`AIService.php`)

Pada `scp/app/Services/AIService.php` (baris 234–269), fungsi pengiriman request memanggil:
```php
$url = rtrim($this->baseUrl, '/') . '/chat/completions';

$payload = [
    'model' => $this->model,
    'stream' => false,
    'temperature' => $temperature,
    'messages' => $messages,
];

$httpRequest = Http::withToken($this->apiKey)->timeout($this->timeout);
$response = $httpRequest->post($url, $payload);
$content = $response->json('choices.0.message.content');
```

**Hasil Verifikasi Kompatibilitas:**
- Google AI Studio mendukung spesifikasi **OpenAI Chat Completions v1** secara native di URL:  
  `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
- Header autentikasi `Authorization: Bearer <AIzaSy...>` didukung penuh.
- Struktur payload request `messages` (`system` dan `user`) serta ekstraksi response `$response->json('choices.0.message.content')` **100% identik**.
- Parser JSON (`cleanAndParseJson` dan `normalizeQuestionsArray`) di `AIService.php` sudah dilengkapi regex penangkap codeblock markdown (````json ... ````), sehingga output Gemini akan langsung terbaca tanpa error.

---

## 5. Isu-Isu Sensitif & Keputusan yang Perlu Dikonfirmasi oleh Anda

Sebelum implementasi ini dieksekusi, terdapat beberapa hal penting yang perlu persetujuan eksplisit:

### Isu Sensitif 1: Pemilihan Versi Model AI
* **Pilihan A (Rekomendasi - `gemini-1.5-flash`):** Model versi stabil yang sudah teruji luas di dunia industri, sangat konsisten mematuhi format JSON instruksi ujian, dan jarang mengalami perubahan skema mendadak.
* **Pilihan B (`gemini-2.0-flash`):** Model generasi terbaru Google. Sedikit lebih cepat, namun statusnya masih relatif baru sehingga terkadang mengalami perubahan kuota atau rate-limit sewaktu-waktu.
* 👉 *Rekomendasi:* Gunakan `gemini-1.5-flash` untuk stabilitas pengujian UKK dan operasional sekolah.

### Isu Sensitif 2: Penanganan Batas Kecepatan 15 Request/Menit (Rate Limiting)
* **Situasi:** Jika satu kelas berisi 36 siswa mengumpulkan jawaban esai pada saat bersamaan, job queue `GradeQuizSubmissionJob` akan memanggil AI secara berurutan.
* **Pertanyaan Desain:** Apakah kita perlu menambahkan delay kecil (misal: 4 detik per koreksi esai) pada queue worker, atau membiarkan queue worker menangani retry otomatis (`release(10)`) jika sewaktu-waktu menerima respons HTTP 429 (Too Many Requests)?
* 👉 *Rekomendasi:* Pasang mekanisme jeda aman pada job worker agar antrean tidak pernah menyentuh plafon 15 RPM.

### Isu Sensitif 3: Kebijakan Graceful Fallback (Jika API Key Belum Diisi / Kuota Habis)
* **Situasi:** Jika kelak sistem dipasang di komputer sekolah namun staf belum memasukkan API Key di `.env`, apa yang harus dilakukan aplikasi?
* **Opsi Kebijakan:**
  - **Opsi A (Informatif & Non-Blocking):** Tombol *Generate AI* di frontend menampilkan pesan ramah: *"Fitur asisten AI belum dikonfigurasi. Anda tetap dapat menyusun soal kuis secara manual."*
  - **Opsi B (Hard Error):** Menampilkan error teknis HTTP 500 seperti saat ini.
* 👉 *Rekomendasi:* Terapkan Opsi A agar aplikasi tetap terlihat elegan dan profesional di mata penguji meskipun tanpa internet/AI.

---

## 6. Tahapan Eksekusi yang Direncanakan (Setelah Persetujuan)

Setelah Anda menyetujui rencana ini, tahapan kerja yang akan dilakukan adalah:

1. **Fase 1 (Persiapan Kredensial):** Anda membuat API Key di `aistudio.google.com` dan mencatatnya.
2. **Fase 2 (Pembaruan Konfigurasi Backend):** Memperbarui `.env` dan `config/services.php` mengarah ke Google AI Studio.
3. **Fase 3 (Uji Konektivitas Mandiri):** Menjalankan unit test koneksi `php artisan test --filter=QuizFeatureTest` untuk memastikan respon JSON Gemini diterima dan diparsing dengan benar.
4. **Fase 4 (Uji Frontend End-to-End):** Mencoba pembuatan kuis melalui prompt materi dan uji coba koreksi submission esai di halaman Web.

---

**Catatan Akhir:** Dokumen ini bersifat **proposal perencanaan teknis**. Tidak ada kode atau konfigurasi yang diubah pada tahap ini. Implementasi baru akan dimulai setelah ada instruksi dan persetujuan dari Anda.
