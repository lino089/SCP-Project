import api from './api';

/**
 * Service API untuk Manajemen Kalender Akademik & Agenda Khusus KBM
 */
export const academicEventApi = {
  getEvents: (params) => api.get('/academic-events', { params }),
  getMyCalendar: (params) => api.get('/academic-events/my-calendar', { params }),
  getEventById: (id) => api.get(`/academic-events/${id}`),
  checkExemption: (params) => api.get('/academic-events/check-exemption', { params }),
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
