import api from './api';

/**
 * Service API untuk Modul Guru & Kesiswaan (Jurnal KBM, Presensi, Sesi Kelas)
 */
export const journalApi = {
  getJournals: (params = {}, config = {}) => api.get('/journals', { params, ...config }),
  getAll: (params = {}, config = {}) => api.get('/journals', { params, ...config }),
  getTeacherSchedules: (params = {}, config = {}) => api.get('/schedules', { params, ...config }),
  getMissingJournals: (params = {}, config = {}) =>
    api.get('/schedules', { params: { ...params, status: 'missing_journal' }, ...config }),
  getDailyRecap: (params = {}, config = {}) => api.get('/journals/daily-recap', { params, ...config }),
  getJournalDetail: (id) => api.get(`/journals/${id}`),
  getById: (id) => api.get(`/journals/${id}`),
  openJournal: (payload) => api.post('/journals', payload),
  create: (payload) => api.post('/journals', payload),
  completeJournal: (id, formData) => {
    if (formData instanceof FormData && !formData.has('_method')) {
      formData.append('_method', 'PUT');
    }
    return api.post(`/journals/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, formData) => {
    if (formData instanceof FormData && !formData.has('_method')) {
      formData.append('_method', 'PUT');
    }
    return api.post(`/journals/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  markTeacherAbsent: (id, payload = {}) => {
    if (id) {
      return api.patch(`/journals/${id}`, payload);
    }
    return api.post('/journals', {
      ...payload,
      status: 'teacher_absent',
    });
  },
  getClassStudents: (classId) =>
    api.get('/students', { params: { class_id: classId, all: true, per_page: 100 } }),
};

export default journalApi;
