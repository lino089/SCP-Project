import api from './api';

/**
 * Master Data & Academic Services (SCP Mobile)
 * Note: Waka Data Import endpoints (Excel upload & resolution) are strictly excluded from Mobile scope.
 */

export const masterDataSummaryApi = {
  getSummary: () => api.get('/master-data/summary'),
  resetMasterData: (data) => api.post('/master-data/reset', data),
};

export const roomApi = {
  getAll: (params, config = {}) => api.get('/rooms', { params, ...config }),
  getRooms: (params, config = {}) => api.get('/rooms', { params, ...config }),
  getById: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms', data),
  createRoom: (data) => api.post('/rooms', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  updateRoom: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id, data) => api.delete(`/rooms/${id}`, { data }),
  deleteRoom: (id, data) => api.delete(`/rooms/${id}`, { data }),
};

export const classApi = {
  getAll: (params, config = {}) => {
    const cleanParams = params ? { ...params } : {};
    if (cleanParams.all === true) cleanParams.all = 1;
    return api.get('/classes', { params: cleanParams, ...config });
  },
  getClasses: (params, config = {}) => {
    const cleanParams = params ? { ...params } : {};
    if (cleanParams.all === true) cleanParams.all = 1;
    return api.get('/classes', { params: cleanParams, ...config });
  },
  getById: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post('/classes', data),
  createClass: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  updateClass: (id, data) => api.put(`/classes/${id}`, data),
  delete: (id, data) => api.delete(`/classes/${id}`, { data }),
  deleteClass: (id, data) => api.delete(`/classes/${id}`, { data }),
  promoteClasses: (data) => api.post('/class-promotions', data),
};

export const subjectApi = {
  getAll: (params, config = {}) => api.get('/subjects', { params, ...config }),
  getSubjects: (params, config = {}) => api.get('/subjects', { params, ...config }),
  getById: (id) => api.get(`/subjects/${id}`),
  create: (data) => api.post('/subjects', data),
  createSubject: (data) => api.post('/subjects', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  updateSubject: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id, data) => api.delete(`/subjects/${id}`, { data }),
  deleteSubject: (id, data) => api.delete(`/subjects/${id}`, { data }),
};

export const teacherApi = {
  getAll: (params, config = {}) => api.get('/teachers', { params, ...config }),
  getTeachers: (params, config = {}) => api.get('/teachers', { params, ...config }),
  getById: (id) => api.get(`/teachers/${id}`),
  create: (data) => api.post('/teachers', data),
  createTeacher: (data) => api.post('/teachers', data),
  update: (id, data) => api.put(`/teachers/${id}`, data),
  updateTeacher: (id, data) => api.put(`/teachers/${id}`, data),
  delete: (id, data) => api.delete(`/teachers/${id}`, { data }),
  deleteTeacher: (id, data) => api.delete(`/teachers/${id}`, { data }),
  assignRole: (teacherId, data) => api.post(`/teachers/${teacherId}/assignments`, data),
  revokeRole: (teacherId, assignmentId) =>
    api.delete(`/teachers/${teacherId}/assignments/${assignmentId}`),
};

export const studentApi = {
  getAll: (params, config = {}) => {
    const cleanParams = params ? { ...params } : {};
    if (cleanParams.all === true) cleanParams.all = 1;
    return api.get('/students', { params: cleanParams, ...config });
  },
  getStudents: (params, config = {}) => {
    const cleanParams = params ? { ...params } : {};
    if (cleanParams.all === true) cleanParams.all = 1;
    return api.get('/students', { params: cleanParams, ...config });
  },
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  createStudent: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  updateStudent: (id, data) => api.put(`/students/${id}`, data),
  delete: (id, data) => api.delete(`/students/${id}`, { data }),
  deleteStudent: (id, data) => api.delete(`/students/${id}`, { data }),
  holdBack: (id, data) => api.post(`/students/${id}/hold-back`, data),
};

export const gradePromotionApi = {
  execute: (data) => api.post('/class-promotions', data),
};

export default {
  summary: masterDataSummaryApi,
  classes: classApi,
  rooms: roomApi,
  subjects: subjectApi,
  teachers: teacherApi,
  students: studentApi,
  gradePromotions: gradePromotionApi,
};
