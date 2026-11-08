import api from './api';

/**
 * Service API untuk Manajemen Kalender Akademik & Agenda Khusus KBM
 */
export const academicEventApi = {
  getEvents: (params, config = {}) => api.get('/academic-events', { params, ...config }),
  getMyCalendar: (params, config = {}) => api.get('/academic-events/my-calendar', { params, ...config }),
  getEventById: (id) => api.get(`/academic-events/${id}`),
  checkExemption: (params, config = {}) => api.get('/academic-events/check-exemption', { params, ...config }),
  createEvent: (data) => api.post('/academic-events', data),
  updateEvent: (id, data) => api.put(`/academic-events/${id}`, data),
  deleteEvent: (id) => api.delete(`/academic-events/${id}`),
  importPreview: (formData) =>
    api.post('/academic-events/import-preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
  importCommit: (payload) => api.post('/academic-events/import-commit', payload),
};

export default academicEventApi;
