import api from './api';

/**
 * Service API untuk Modul Kuis Berbantuan AI & Workflow Evaluasi Asinkron (Fase 6)
 * Mendukung inisialisasi kuis, 3 metode pembuatan soal (Prompt AI, Ekstraksi Dokumen, Manual),
 * kurasi butir soal (preview draft), pengerjaan siswa CBT, antrean evaluasi asinkron,
 * review submission guru, override nilai AI, dan rilis hasil.
 */

// Dataset Mock Fallback untuk Kuis
const MOCK_QUIZZES = [
  {
    id: 1,
    title: 'Kuis Persamaan Kuadrat & Fungsi Kuadrat',
    teacher_id: 1,
    teacher: { id: 1, name: 'Drs. Ahmad Fauzi, M.Pd.' },
    class_id: 1,
    schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    subject_id: 1,
    subject: { id: 1, name: 'Matematika Diskrit', code: 'MTK-X' },
    due_date: '2026-10-28',
    max_attempts: 2,
    status: 'published_result', // draft_review | published | published_result
    questions_count: 3,
    submissions_count: 5,
    created_at: '2026-10-20T08:00:00.000000Z',
  },
  {
    id: 2,
    title: 'Evaluasi Logika Pemrograman & Algoritma Dasar',
    teacher_id: 1,
    teacher: { id: 1, name: 'Drs. Ahmad Fauzi, M.Pd.' },
    class_id: 1,
    schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    subject_id: 2,
    subject: { id: 2, name: 'Dasar Pemrograman RPL', code: 'RPL-DAS' },
    due_date: '2026-10-30',
    max_attempts: 2,
    status: 'published',
    questions_count: 4,
    submissions_count: 3,
    created_at: '2026-10-22T09:30:00.000000Z',
  },
  {
    id: 3,
    title: 'Draft Asesmen Struktur Data Array & Objek',
    teacher_id: 1,
    teacher: { id: 1, name: 'Drs. Ahmad Fauzi, M.Pd.' },
    class_id: 1,
    schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    subject_id: 2,
    subject: { id: 2, name: 'Dasar Pemrograman RPL', code: 'RPL-DAS' },
    due_date: '2026-11-05',
    max_attempts: 1,
    status: 'draft_review',
    questions_count: 3,
    submissions_count: 0,
    created_at: '2026-10-23T07:15:00.000000Z',
  },
];

// Dataset Mock Butir Soal per Kuis
const MOCK_QUESTIONS = {
  1: [
    {
      id: 101,
      quiz_id: 1,
      question_type: 'multiple_choice',
      question_text: 'Akar-akar dari persamaan kuadrat x² - 5x + 6 = 0 adalah...',
      options: ['x = 1 atau x = 6', 'x = 2 atau x = 3', 'x = -2 atau x = -3', 'x = -1 atau x = -6'],
      correct_answer: 'B',
      points: 30,
      needs_review: false,
      review_note: null,
    },
    {
      id: 102,
      quiz_id: 1,
      question_type: 'multiple_choice',
      question_text: 'Jika diskriminan persamaan kuadrat bernilai positif (D > 0), maka grafik parabolanya...',
      options: [
        'Memotong sumbu X di dua titik berbeda',
        'Menyinggung sumbu X di satu titik',
        'Tidak memotong sumbu X sama sekali',
        'Selalu berada di bawah sumbu X',
      ],
      correct_answer: 'A',
      points: 30,
      needs_review: false,
      review_note: null,
    },
    {
      id: 103,
      quiz_id: 1,
      question_type: 'essay',
      question_text: 'Jelaskan hubungan nilai diskriminan (D = b² - 4ac) terhadap sifat akar-akar persamaan kuadrat dan sketsa grafiknya!',
      options: null,
      correct_answer: 'Rubrik AI: D > 0 (dua akar real berbeda, grafik memotong sumbu X di dua titik); D = 0 (dua akar real kembar, grafik menyinggung sumbu X); D < 0 (tidak ada akar real, grafik definit positif/negatif).',
      points: 40,
      needs_review: false,
      review_note: null,
    },
  ],
  2: [
    {
      id: 201,
      quiz_id: 2,
      question_type: 'multiple_choice',
      question_text: 'Manakah tipe data yang paling tepat untuk menyimpan nilai status kelulusan (Benar/Salah)?',
      options: ['Integer', 'String', 'Boolean', 'Float'],
      correct_answer: 'C',
      points: 25,
      needs_review: false,
      review_note: null,
    },
    {
      id: 202,
      quiz_id: 2,
      question_type: 'multiple_choice',
      question_text: 'Struktur perulangan yang mengeksekusi blok kode minimal satu kali sebelum memeriksa kondisi terminasi adalah...',
      options: ['for loop', 'while loop', 'do-while loop', 'foreach loop'],
      correct_answer: 'C',
      points: 25,
      needs_review: false,
      review_note: null,
    },
    {
      id: 203,
      quiz_id: 2,
      question_type: 'essay',
      question_text: 'Jelaskan perbedaan mendasar antara algoritma percabangan IF-ELSE dengan SWITCH-CASE beserta contoh kasus penggunaannya!',
      options: null,
      correct_answer: 'Rubrik AI: IF-ELSE mengevaluasi ekspresi boolean kompleks dan rentang nilai (range). SWITCH-CASE mengevaluasi nilai konstan/diskrit (equality check) secara lebih efisien dan terstruktur untuk banyak cabang.',
      points: 25,
      needs_review: false,
      review_note: null,
    },
    {
      id: 204,
      quiz_id: 2,
      question_type: 'essay',
      question_text: 'Tuliskan algoritma / pseudocode sederhana untuk menentukan apakah suatu bilangan bulat N adalah ganjil atau genap!',
      options: null,
      correct_answer: 'Rubrik AI: Input N -> Hitung N MOD 2 -> Jika sisa 0 cetak "Genap", jika tidak cetak "Ganjil" -> Selesai.',
      points: 25,
      needs_review: false,
      review_note: null,
    },
  ],
  3: [
    {
      id: 301,
      quiz_id: 3,
      question_type: 'multiple_choice',
      question_text: 'Indeks elemen pertama pada array dalam kebanyakan bahasa pemrograman modern (seperti JS, PHP, C) dimulai dari nomor...',
      options: ['0', '1', '-1', 'null'],
      correct_answer: 'A',
      points: 30,
      needs_review: false,
      review_note: null,
    },
    {
      id: 302,
      quiz_id: 3,
      question_type: 'multiple_choice',
      question_text: 'Manakah operasi array yang berfungsi untuk menambahkan elemen baru di posisi paling akhir?',
      options: ['shift()', 'unshift()', 'pop()', 'push()'],
      correct_answer: 'D',
      points: 30,
      needs_review: true,
      review_note: 'Kunci jawaban terdeteksi otomatis dari teks modul PDF. Harap verifikasi kesesuaian bahasa target (JavaScript vs PHP).',
    },
    {
      id: 303,
      quiz_id: 3,
      question_type: 'essay',
      question_text: 'Jelaskan analogi struktur data Array satu dimensi dalam kehidupan sehari-hari dan bagaimana cara mengakses data spesifik di dalamnya!',
      options: null,
      correct_answer: 'Rubrik AI: Analogi seperti loker bernomor urut atau rak buku bersekat. Mengakses data dilakukan menggunakan nomor indeks unik penunjuk posisi.',
      points: 40,
      needs_review: false,
      review_note: null,
    },
  ],
};

// Dataset Mock Submissions Siswa
const MOCK_SUBMISSIONS = [
  {
    id: 1,
    quiz_id: 1,
    student_id: 4,
    student: { id: 4, name: 'Aisyah Putri Ramadhani', nis_nip: '2024001', class_name: 'X-RPL-1' },
    attempt_number: 1,
    grading_status: 'graded', // pending | graded
    ai_score: 88,
    is_overridden: false,
    overridden_by: null,
    overridden_at: null,
    submitted_at: '2026-10-21T14:32:00.000000Z',
    answers: [
      {
        question_id: 101,
        question_text: 'Akar-akar dari persamaan kuadrat x² - 5x + 6 = 0 adalah...',
        question_type: 'multiple_choice',
        student_answer: 'B',
        correct_answer: 'B',
        is_correct: true,
        points_awarded: 30,
        max_points: 30,
        ai_feedback: 'Jawaban pilihan ganda tepat.',
      },
      {
        question_id: 102,
        question_text: 'Jika diskriminan persamaan kuadrat bernilai positif (D > 0), maka grafik parabolanya...',
        question_type: 'multiple_choice',
        student_answer: 'A',
        correct_answer: 'A',
        is_correct: true,
        points_awarded: 30,
        max_points: 30,
        ai_feedback: 'Jawaban pilihan ganda tepat.',
      },
      {
        question_id: 103,
        question_text: 'Jelaskan hubungan nilai diskriminan (D = b² - 4ac) terhadap sifat akar-akar persamaan kuadrat dan sketsa grafiknya!',
        question_type: 'essay',
        student_answer: 'Bila nilai D positif (D > 0), persamaan punya 2 akar nyata berlainan dan grafik memotong sumbu X di dua titik. Kalau D = 0 grafiknya menyinggung sumbu X di 1 titik akar kembar. Jika D negatif, tidak memotong sumbu X.',
        correct_answer: 'Rubrik AI: D > 0 (dua akar real berbeda, grafik memotong sumbu X di dua titik); D = 0 (dua akar real kembar, grafik menyinggung sumbu X); D < 0 (tidak ada akar real).',
        is_correct: true,
        points_awarded: 28,
        max_points: 40,
        ai_feedback: 'Penjelasan konsep diskriminan sudah komprehensif dan tepat membedakan 3 kondisi nilai D beserta sketsa grafiknya.',
        teacher_feedback: 'Uraian sangat bagus dan runtut!',
      },
    ],
  },
  {
    id: 2,
    quiz_id: 1,
    student_id: 5,
    student: { id: 5, name: 'Bayu Aditya Pratama', nis_nip: '2024002', class_name: 'X-RPL-1' },
    attempt_number: 1,
    grading_status: 'graded',
    ai_score: 75,
    is_overridden: true,
    overridden_by: 1,
    overridden_at: '2026-10-22T10:15:00.000000Z',
    submitted_at: '2026-10-21T15:10:00.000000Z',
    answers: [
      {
        question_id: 101,
        question_text: 'Akar-akar dari persamaan kuadrat x² - 5x + 6 = 0 adalah...',
        question_type: 'multiple_choice',
        student_answer: 'B',
        correct_answer: 'B',
        is_correct: true,
        points_awarded: 30,
        max_points: 30,
        ai_feedback: 'Jawaban pilihan ganda tepat.',
      },
      {
        question_id: 102,
        question_text: 'Jika diskriminan persamaan kuadrat bernilai positif (D > 0), maka grafik parabolanya...',
        question_type: 'multiple_choice',
        student_answer: 'B',
        correct_answer: 'A',
        is_correct: false,
        points_awarded: 0,
        max_points: 30,
        ai_feedback: 'Pilihan B keliru. Parabola dengan D > 0 memotong sumbu X di dua titik, bukan menyinggung.',
      },
      {
        question_id: 103,
        question_text: 'Jelaskan hubungan nilai diskriminan (D = b² - 4ac) terhadap sifat akar-akar persamaan kuadrat dan sketsa grafiknya!',
        question_type: 'essay',
        student_answer: 'D dihitung dari b kuadrat - 4ac. Kalau hasilnya positif ada akarnya, kalau 0 akarnya sama, kalau minus tidak ada akar nyata.',
        correct_answer: 'Rubrik AI: D > 0 (dua akar real berbeda); D = 0 (akar kembar); D < 0 (tidak ada akar real).',
        is_correct: true,
        points_awarded: 45, // Overridden from 35 to 45
        max_points: 40,
        ai_feedback: 'Siswa menyebutkan ketiga sifat akar dasar, namun penjelasan mengenai grafik parabola belum dicantumkan.',
        teacher_feedback: 'Nilai disesuaikan guru: pemahaman dasar siswa cukup kuat meskipun kurang menyertakan bentuk grafiknya.',
      },
    ],
  },
  {
    id: 3,
    quiz_id: 2,
    student_id: 4,
    student: { id: 4, name: 'Aisyah Putri Ramadhani', nis_nip: '2024001', class_name: 'X-RPL-1' },
    attempt_number: 1,
    grading_status: 'graded',
    ai_score: 95,
    is_overridden: false,
    overridden_by: null,
    overridden_at: null,
    submitted_at: '2026-10-22T11:45:00.000000Z',
    answers: [],
  },
];

export const quizApi = {
  /**
   * Mengambil daftar kuis (GET /api/quizzes)
   * Auto-scoped di backend sesuai peran pengguna (Guru: miliknya; Siswa: published kelasnya)
   */
  async getQuizzes(params = {}) {
    try {
      const res = await api.get('/quizzes', { params });
      return res;
    } catch {
      let filtered = [...MOCK_QUIZZES];
      if (params.status && params.status !== 'all') {
        filtered = filtered.filter((q) => q.status === params.status);
      }
      if (params.class_id && params.class_id !== 'all') {
        filtered = filtered.filter((q) => q.class_id === parseInt(params.class_id, 10));
      }
      return {
        success: true,
        data: filtered,
        meta: {
          current_page: 1,
          per_page: params.per_page || 15,
          total: filtered.length,
          last_page: 1,
        },
      };
    }
  },

  /**
   * Inisialisasi kuis baru oleh Guru (POST /api/quizzes)
   * Status awal selalu draft_review
   */
  async createQuiz(data) {
    try {
      const res = await api.post('/quizzes', data);
      return res;
    } catch (err) {
      if (
        err.status === 422 ||
        err.status === 403 ||
        err.response?.status === 422 ||
        err.response?.status === 403
      ) {
        throw err;
      }
      const newQuiz = {
        id: Date.now(),
        title: data.title,
        teacher_id: 1,
        teacher: { id: 1, name: 'Drs. Ahmad Fauzi, M.Pd.' },
        class_id: parseInt(data.class_id, 10) || 1,
        schoolClass: { id: 1, name: data.class_name || 'X-RPL-1', level: 'X' },
        subject_id: parseInt(data.subject_id, 10) || 1,
        subject: { id: 1, name: 'Matematika Diskrit', code: 'MTK-X' },
        due_date: data.due_date || '2026-10-31',
        max_attempts: parseInt(data.max_attempts, 10) || 2,
        status: 'draft_review',
        questions_count: 0,
        submissions_count: 0,
        created_at: new Date().toISOString(),
      };
      MOCK_QUIZZES.unshift(newQuiz);
      MOCK_QUESTIONS[newQuiz.id] = [];
      return {
        success: true,
        message: 'Kuis berhasil diinisialisasi dalam status Draft Review (Offline Mode).',
        data: newQuiz,
      };
    }
  },

  /**
   * Mengambil detail kuis dan statusnya (GET /api/quizzes/{id})
   */
  async getQuizDetail(id) {
    try {
      const res = await api.get(`/quizzes/${id}`);
      return res;
    } catch {
      const quiz = MOCK_QUIZZES.find((q) => q.id === parseInt(id, 10)) || MOCK_QUIZZES[0];
      return {
        success: true,
        data: quiz,
      };
    }
  },

  /**
   * Metode 1: Generate Soal Kuis Berbantuan Prompt AI (POST /api/quizzes/{id}/generate-prompt)
   * Mengembalikan HTTP 202 Accepted untuk pemrosesan asinkron
   */
  async generatePrompt(id, data) {
    try {
      const res = await api.post(`/quizzes/${id}/generate-prompt`, data);
      return res;
    } catch (err) {
      if (err.status === 422 || err.response?.status === 422) throw err;
      // Simulasi generasi butir soal secara offline
      const quizId = parseInt(id, 10);
      const generated = [
        {
          id: Date.now() + 1,
          quiz_id: quizId,
          question_type: 'multiple_choice',
          question_text: `[AI Generated] Apa definisi dari topik materi: ${data.prompt?.slice(0, 40) || 'Konsep Dasar'}?`,
          options: [
            'Pendekatan terstruktur dalam menyelesaikan persoalan komputasi',
            'Kumpulan instruksi acak tanpa urutan logis',
            'Perangkat keras pemroses data sekunder',
            'Format kompresi berkas jaringan lokal',
          ],
          correct_answer: 'A',
          points: 25,
          needs_review: false,
          review_note: null,
        },
        {
          id: Date.now() + 2,
          quiz_id: quizId,
          question_type: 'multiple_choice',
          question_text: '[AI Generated] Manakah pernyataan yang paling tepat mengenai karakteristik kompleksitas waktu efisien?',
          options: ['O(n²)', 'O(1)', 'O(2^n)', 'O(n!)'],
          correct_answer: 'B',
          points: 25,
          needs_review: false,
          review_note: null,
        },
        {
          id: Date.now() + 3,
          quiz_id: quizId,
          question_type: 'essay',
          question_text: `[AI Generated] Uraikan langkah-langkah implementasi praktis terkait "${data.prompt || 'topik pembelajaran'}" beserta contoh penerapannya!`,
          options: null,
          correct_answer: 'Rubrik AI: Siswa mampu memaparkan minimal 3 tahapan sistematis, menggunakan terminologi yang tepat, serta menyertakan contoh kasus riil yang relevan.',
          points: 50,
          needs_review: false,
          review_note: null,
        },
      ];
      MOCK_QUESTIONS[quizId] = generated;
      const targetQuiz = MOCK_QUIZZES.find((q) => q.id === quizId);
      if (targetQuiz) {
        targetQuiz.questions_count = generated.length;
      }
      return {
        success: true,
        status: 202,
        message: 'Permintaan generate soal berhasil diterima AI Gateway (Offline 202 Simulation).',
        data: { status: 'completed', generated_count: generated.length },
      };
    }
  },

  /**
   * Metode 2: Ekstraksi Dokumen Materi PDF/TXT (POST /api/quizzes/{id}/extract-document)
   * Multipart FormData dengan batasan berkas 5MB, mengembalikan HTTP 202 Accepted
   */
  async extractDocument(id, formData) {
    try {
      const res = await api.post(`/quizzes/${id}/extract-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res;
    } catch (err) {
      if (err.status === 422 || err.response?.status === 422) throw err;
      const quizId = parseInt(id, 10);
      const extracted = [
        {
          id: Date.now() + 10,
          quiz_id: quizId,
          question_type: 'multiple_choice',
          question_text: '[Ekstraksi Dokumen] Berdasarkan teks materi, manakah fungsi utama dari proses kompilasi kode?',
          options: [
            'Menerjemahkan kode sumber menjadi bahasa mesin yang dapat dieksekusi',
            'Menghapus seluruh file konfigurasi sementara',
            'Menyimpan salinan dokumen ke cloud storage',
            'Mengubah format teks biasa menjadi dokumen terenkripsi',
          ],
          correct_answer: 'A',
          points: 30,
          needs_review: false,
          review_note: null,
        },
        {
          id: Date.now() + 11,
          quiz_id: quizId,
          question_type: 'multiple_choice',
          question_text: '[Ekstraksi Dokumen] Parameter manakah yang digunakan untuk membatasi ukuran memori alokasi?',
          options: ['-Xmx', '-Xms', '-Xss', '-XX:PermSize'],
          correct_answer: 'A',
          points: 30,
          needs_review: true,
          review_note: 'Teks dari dokumen PDF sedikit terpotong pada nomor soal 2. Mohon periksa kembali opsi dan kunci jawaban.',
        },
        {
          id: Date.now() + 12,
          quiz_id: quizId,
          question_type: 'essay',
          question_text: '[Ekstraksi Dokumen] Jelaskan kesimpulan analisis yang disajikan pada Bab 2 dokumen materi!',
          options: null,
          correct_answer: 'Rubrik AI: Kesimpulan menyoroti pentingnya efisiensi memori, redundansi data minimal, dan skalabilitas arsitektur.',
          points: 40,
          needs_review: false,
          review_note: null,
        },
      ];
      MOCK_QUESTIONS[quizId] = extracted;
      const targetQuiz = MOCK_QUIZZES.find((q) => q.id === quizId);
      if (targetQuiz) {
        targetQuiz.questions_count = extracted.length;
      }
      return {
        success: true,
        status: 202,
        message: 'Dokumen berhasil diproses oleh ekstraktor AI (Offline 202 Simulation).',
        data: { status: 'completed', extracted_count: extracted.length },
      };
    }
  },

  /**
   * Mengambil daftar butir soal kuis pada tahap preview (GET /api/quizzes/{id}/questions)
   */
  async getQuizQuestions(id) {
    try {
      const res = await api.get(`/quizzes/${id}/questions`);
      return res;
    } catch {
      const questions = MOCK_QUESTIONS[parseInt(id, 10)] || [];
      return {
        success: true,
        data: questions,
      };
    }
  },

  /**
   * Metode 3: Menambah butir soal secara manual (POST /api/quizzes/{id}/questions)
   */
  async createQuestion(id, data) {
    try {
      const res = await api.post(`/quizzes/${id}/questions`, data);
      return res;
    } catch (err) {
      if (err.status === 422 || err.response?.status === 422) throw err;
      const quizId = parseInt(id, 10);
      const newQuestion = {
        id: Date.now(),
        quiz_id: quizId,
        question_type: data.question_type || 'multiple_choice',
        question_text: data.question_text,
        options: data.question_type === 'essay' ? null : data.options || ['A', 'B', 'C', 'D'],
        correct_answer: data.correct_answer,
        points: parseInt(data.points, 10) || 20,
        needs_review: false,
        review_note: null,
      };
      if (!MOCK_QUESTIONS[quizId]) MOCK_QUESTIONS[quizId] = [];
      MOCK_QUESTIONS[quizId].push(newQuestion);
      const targetQuiz = MOCK_QUIZZES.find((q) => q.id === quizId);
      if (targetQuiz) targetQuiz.questions_count = MOCK_QUESTIONS[quizId].length;
      return {
        success: true,
        message: 'Butir soal berhasil ditambahkan secara manual (Offline Mode).',
        data: newQuestion,
      };
    }
  },

  /**
   * Memperbarui butir soal pada tahap preview (PUT /api/quizzes/{id}/questions/{questionId})
   */
  async updateQuestion(id, questionId, data) {
    try {
      const res = await api.put(`/quizzes/${id}/questions/${questionId}`, data);
      return res;
    } catch (err) {
      if (err.status === 422 || err.response?.status === 422) throw err;
      const quizId = parseInt(id, 10);
      const qList = MOCK_QUESTIONS[quizId] || [];
      const idx = qList.findIndex((q) => q.id === parseInt(questionId, 10));
      if (idx !== -1) {
        qList[idx] = { ...qList[idx], ...data, needs_review: false }; // Clear review flag once edited
      }
      return {
        success: true,
        message: 'Butir soal berhasil diperbarui (Offline Mode).',
        data: qList[idx],
      };
    }
  },

  /**
   * Menghapus butir soal pada tahap preview (DELETE /api/quizzes/{id}/questions/{questionId})
   */
  async deleteQuestion(id, questionId) {
    try {
      const res = await api.delete(`/quizzes/${id}/questions/${questionId}`);
      return res;
    } catch {
      const quizId = parseInt(id, 10);
      if (MOCK_QUESTIONS[quizId]) {
        MOCK_QUESTIONS[quizId] = MOCK_QUESTIONS[quizId].filter(
          (q) => q.id !== parseInt(questionId, 10)
        );
        const targetQuiz = MOCK_QUIZZES.find((q) => q.id === quizId);
        if (targetQuiz) targetQuiz.questions_count = MOCK_QUESTIONS[quizId].length;
      }
      return {
        success: true,
        message: 'Butir soal berhasil dihapus (Offline Mode).',
      };
    }
  },

  /**
   * Memperbarui status kuis: konfirmasi publikasi (published) atau rilis hasil (published_result)
   * (PATCH /api/quizzes/{id})
   */
  async updateQuizStatus(id, data) {
    try {
      const res = await api.patch(`/quizzes/${id}`, data);
      return res;
    } catch (err) {
      if (
        err.status === 422 ||
        err.status === 403 ||
        err.response?.status === 422 ||
        err.response?.status === 403
      ) {
        throw err;
      }
      const targetQuiz = MOCK_QUIZZES.find((q) => q.id === parseInt(id, 10));
      if (targetQuiz) {
        if (data.status) targetQuiz.status = data.status;
        if (data.due_date) targetQuiz.due_date = data.due_date;
        if (data.max_attempts) targetQuiz.max_attempts = data.max_attempts;
      }
      return {
        success: true,
        message: `Status kuis berhasil diubah menjadi ${data.status || 'aktif'} (Offline Mode).`,
        data: targetQuiz,
      };
    }
  },

  /**
   * Mengambil daftar submissions pengerjaan kuis siswa (GET /api/quizzes/{id}/submissions)
   */
  async getQuizSubmissions(id) {
    try {
      const res = await api.get(`/quizzes/${id}/submissions`);
      return res;
    } catch {
      const submissions = MOCK_SUBMISSIONS.filter(
        (s) => s.quiz_id === parseInt(id, 10)
      );
      return {
        success: true,
        data: submissions,
      };
    }
  },

  /**
   * Pengiriman jawaban kuis oleh Siswa (POST /api/quizzes/{id}/submissions)
   * Mengembalikan HTTP 202 Accepted untuk evaluasi asinkron
   */
  async submitQuiz(id, data) {
    try {
      const res = await api.post(`/quizzes/${id}/submissions`, data);
      return res;
    } catch (err) {
      if (err.status === 422 || err.response?.status === 422) throw err;
      const quizId = parseInt(id, 10);
      const newSubmission = {
        id: Date.now(),
        quiz_id: quizId,
        student_id: 4,
        student: { id: 4, name: 'Aisyah Putri Ramadhani', nis_nip: '2024001', class_name: 'X-RPL-1' },
        attempt_number: 1,
        grading_status: 'graded',
        ai_score: 85,
        is_overridden: false,
        overridden_by: null,
        overridden_at: null,
        submitted_at: new Date().toISOString(),
        answers: data.answers || [],
      };
      MOCK_SUBMISSIONS.unshift(newSubmission);
      const targetQuiz = MOCK_QUIZZES.find((q) => q.id === quizId);
      if (targetQuiz) targetQuiz.submissions_count += 1;

      return {
        success: true,
        status: 202,
        message: 'Jawaban berhasil dikumpulkan. Penilaian asinkron AI sedang diproses (Offline Simulation).',
        data: newSubmission,
      };
    }
  },

  /**
   * Guru meng-override skor dan feedback AI submission siswa (PATCH /api/quiz-submissions/{id})
   */
  async overrideSubmission(submissionId, data) {
    try {
      const res = await api.patch(`/quiz-submissions/${submissionId}`, data);
      return res;
    } catch (err) {
      if (err.status === 422 || err.response?.status === 422) throw err;
      const sub = MOCK_SUBMISSIONS.find((s) => s.id === parseInt(submissionId, 10));
      if (sub) {
        sub.ai_score = parseInt(data.score, 10);
        sub.is_overridden = true;
        sub.overridden_by = 1;
        sub.overridden_at = new Date().toISOString();
        if (data.teacher_feedback) {
          sub.teacher_feedback = data.teacher_feedback;
        }
      }
      return {
        success: true,
        message: 'Nilai dan umpan balik berhasil disesuaikan oleh Guru (Offline Mode).',
        data: sub,
      };
    }
  },

  /**
   * Mengambil hasil evaluasi kuis mandiri siswa/ortu (GET /api/quizzes/{id}/submissions/me)
   */
  async getMySubmission(id) {
    try {
      const res = await api.get(`/quizzes/${id}/submissions/me`);
      return res;
    } catch {
      const quizId = parseInt(id, 10);
      const sub = MOCK_SUBMISSIONS.find((s) => s.quiz_id === quizId && s.student_id === 4) || MOCK_SUBMISSIONS[0];
      return {
        success: true,
        data: sub,
      };
    }
  },
};

export default quizApi;
