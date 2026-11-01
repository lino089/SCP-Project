import api from './api';

/**
 * Service API untuk Modul Kuis AI (Fase 5 - Zero Mock)
 * Terhubung langsung ke endpoint RESTful QuizController Laravel & Google Gemini AIService.
 */

export const quizApi = {
  /**
   * Mengambil daftar kuis (GET /api/quizzes)
   * Auto-scoped di backend sesuai peran pengguna (Guru: miliknya; Siswa: published kelasnya)
   */
  async getQuizzes(params = {}) {
    return api.get('/quizzes', { params });
  },

  /**
   * Inisialisasi kuis baru oleh Guru (POST /api/quizzes)
   * Status awal selalu draft_review
   */
  async createQuiz(data) {
    return api.post('/quizzes', data);
  },

  /**
   * Mengambil detail kuis dan statusnya (GET /api/quizzes/{id})
   */
  async getQuizDetail(id) {
    return api.get(`/quizzes/${id}`);
  },

  /**
   * Metode 1: Generate Soal Kuis Berbantuan Prompt AI (POST /api/quizzes/{id}/generate-prompt)
   * Mengembalikan HTTP 202 Accepted untuk pemrosesan asinkron
   */
  async generatePrompt(id, data) {
    return api.post(`/quizzes/${id}/generate-prompt`, data);
  },

  /**
   * Metode 2: Ekstraksi Dokumen Materi PDF/TXT (POST /api/quizzes/{id}/extract-document)
   * Multipart FormData dengan batasan berkas 5MB, mengembalikan HTTP 202 Accepted
   */
  async extractDocument(id, formData) {
    return api.post(`/quizzes/${id}/extract-document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * Mengambil daftar butir soal kuis pada tahap preview (GET /api/quizzes/{id}/questions)
   */
  async getQuizQuestions(id) {
    return api.get(`/quizzes/${id}/questions`);
  },

  /**
   * Metode 3: Menambah butir soal secara manual (POST /api/quizzes/{id}/questions)
   */
  async createQuestion(id, data) {
    return api.post(`/quizzes/${id}/questions`, data);
  },

  /**
   * Memperbarui butir soal pada tahap preview (PUT /api/quizzes/{id}/questions/{questionId})
   */
  async updateQuestion(id, questionId, data) {
    return api.put(`/quizzes/${id}/questions/${questionId}`, data);
  },

  /**
   * Menghapus butir soal pada tahap preview (DELETE /api/quizzes/{id}/questions/{questionId})
   */
  async deleteQuestion(id, questionId) {
    return api.delete(`/quizzes/${id}/questions/${questionId}`);
  },

  /**
   * Memperbarui status kuis: konfirmasi publikasi (published) atau rilis hasil (published_result)
   * (PATCH /api/quizzes/{id})
   */
  async updateQuizStatus(id, data) {
    return api.patch(`/quizzes/${id}`, data);
  },

  /**
   * Mengambil daftar submissions pengerjaan kuis siswa (GET /api/quizzes/{id}/submissions)
   */
  async getQuizSubmissions(id) {
    return api.get(`/quizzes/${id}/submissions`);
  },

  /**
   * Pengiriman jawaban kuis oleh Siswa (POST /api/quizzes/{id}/submissions)
   * Mengembalikan HTTP 202 Accepted untuk evaluasi asinkron
   */
  async submitQuiz(id, data) {
    return api.post(`/quizzes/${id}/submissions`, data);
  },

  /**
   * Guru meng-override skor dan feedback AI submission siswa (PATCH /api/quiz-submissions/{id})
   */
  async overrideSubmission(submissionId, data) {
    return api.patch(`/quiz-submissions/${submissionId}`, data);
  },

  /**
   * Mengambil hasil evaluasi kuis mandiri siswa/ortu (GET /api/quizzes/{id}/submissions/me)
   */
  async getMySubmission(id) {
    return api.get(`/quizzes/${id}/submissions/me`);
  },
};

export default quizApi;
