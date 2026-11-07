import api from './api';

/**
 * Service API untuk Modul Guru & Kesiswaan (Jurnal KBM, Presensi, Sesi Kelas)
 */
export const journalApi = {
  getTeacherSchedules: (params = {}) => api.get('/schedules', { params }),
  getMissingJournals: (params = {}) =>
    api.get('/schedules', { params: { ...params, status: 'missing_journal' } }),
  getJournals: (params = {}) => api.get('/journals', { params }),
  getAll: (params = {}) => api.get('/journals', { params }),
  getDailyRecap: (params = {}) => api.get('/journals/daily-recap', { params }),
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
  getStudentsForSchedule: (scheduleId, params) =>
    api.get(`/schedules/${scheduleId}/students`, { params }),
};

export default journalApi;
