import api from './api';

/**
 * Service API untuk Manajemen Kalender Akademik & Agenda Khusus KBM (Mobile)
 */
export const academicEventApi = {
  // Read operations
  getAll: (params, config = {}) => api.get('/academic-events', { params, ...config }),
  getEvents: (params, config = {}) => api.get('/academic-events', { params, ...config }),
  getMyCalendar: (params, config = {}) => api.get('/academic-events/my-calendar', { params, ...config }),
  getById: (id) => api.get(`/academic-events/${id}`),
  getEventById: (id) => api.get(`/academic-events/${id}`),
  checkExemption: (params, config = {}) => api.get('/academic-events/check-exemption', { params, ...config }),

  // Write operations (Waka / Step-Up Auth)
  create: (data) => api.post('/academic-events', data),
  createEvent: (data) => api.post('/academic-events', data),
  update: (id, data) => api.put(`/academic-events/${id}`, data),
  updateEvent: (id, data) => api.put(`/academic-events/${id}`, data),
  delete: (id) => api.delete(`/academic-events/${id}`),
  deleteEvent: (id) => api.delete(`/academic-events/${id}`),
};

export default academicEventApi;
