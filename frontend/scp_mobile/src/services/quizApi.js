import api from './api';

/**
 * Service API untuk Modul Kuis AI (Fase 5)
 * Terhubung langsung ke RESTful QuizController Laravel & Google Gemini AIService.
 */
export const quizApi = {
  getQuizzes: (params = {}) => api.get('/quizzes', { params }),
  getAll: (params = {}) => api.get('/quizzes', { params }),
  createQuiz: (data) => api.post('/quizzes', data),
  create: (data) => api.post('/quizzes', data),
  getQuizDetail: (id) => api.get(`/quizzes/${id}`),
  getById: (id) => api.get(`/quizzes/${id}`),
  updateQuiz: (id, data) => api.patch(`/quizzes/${id}`, data),
  update: (id, data) => api.patch(`/quizzes/${id}`, data),
  deleteQuiz: (id) => api.delete(`/quizzes/${id}`),
  delete: (id) => api.delete(`/quizzes/${id}`),

  // Generator Soal AI
  generatePrompt: (id, data) =>
    api.post(`/quizzes/${id}/generate-prompt`, data, { timeout: 60000 }),
  extractDocument: (id, formData) =>
    api.post(`/quizzes/${id}/extract-document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }),

  // Kelola Butir Soal
  getQuizQuestions: (id) => api.get(`/quizzes/${id}/questions`),
  createQuestion: (id, data) => api.post(`/quizzes/${id}/questions`, data),
  updateQuestion: (id, questionId, data) =>
    api.put(`/quizzes/${id}/questions/${questionId}`, data),
  deleteQuestion: (id, questionId) =>
    api.delete(`/quizzes/${id}/questions/${questionId}`),

  // Publikasi
  publishQuiz: (id) => api.patch(`/quizzes/${id}/publish`),
  updateQuizStatus: (id, data) => api.patch(`/quizzes/${id}`, data),

  // Submissions Siswa & Koreksi Guru
  getQuizSubmissions: (id) => api.get(`/quizzes/${id}/submissions`),
  submitQuiz: (id, data) => api.post(`/quizzes/${id}/submissions`, data),
  overrideSubmission: (submissionId, data) =>
    api.patch(`/quiz-submissions/${submissionId}`, data),
  getMySubmission: (id) => api.get(`/quizzes/${id}/submissions/me`),
};

export default quizApi;
