import api from './api';

/**
 * Service API untuk Manajemen Kalender Akademik & Agenda Khusus KBM (Mobile)
 */
export const academicEventApi = {
  // Read operations
  getAll: (params) => api.get('/academic-events', { params }),
  getEvents: (params) => api.get('/academic-events', { params }),
  getMyCalendar: (params) => api.get('/academic-events/my-calendar', { params }),
  getById: (id) => api.get(`/academic-events/${id}`),
  getEventById: (id) => api.get(`/academic-events/${id}`),
  checkExemption: (params) => api.get('/academic-events/check-exemption', { params }),

  // Write operations (Waka / Step-Up Auth)
  create: (data) => api.post('/academic-events', data),
  createEvent: (data) => api.post('/academic-events', data),
  update: (id, data) => api.put(`/academic-events/${id}`, data),
  updateEvent: (id, data) => api.put(`/academic-events/${id}`, data),
  delete: (id) => api.delete(`/academic-events/${id}`),
  deleteEvent: (id) => api.delete(`/academic-events/${id}`),
  confirmPassword: (password) => api.post('/confirm-password', { password }),
};

export default academicEventApi;
