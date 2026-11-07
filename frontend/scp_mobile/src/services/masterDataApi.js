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
  getAll: (params) => api.get('/rooms', { params }),
  getRooms: (params) => api.get('/rooms', { params }),
  getById: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms', data),
  createRoom: (data) => api.post('/rooms', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  updateRoom: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
  deleteRoom: (id) => api.delete(`/rooms/${id}`),
};

export const classApi = {
  getAll: (params) => {
    const cleanParams = params ? { ...params } : {};
    if (cleanParams.all === true) cleanParams.all = 1;
    return api.get('/classes', { params: cleanParams });
  },
  getClasses: (params) => {
    const cleanParams = params ? { ...params } : {};
    if (cleanParams.all === true) cleanParams.all = 1;
    return api.get('/classes', { params: cleanParams });
  },
  getById: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post('/classes', data),
  createClass: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  updateClass: (id, data) => api.put(`/classes/${id}`, data),
  delete: (id) => api.delete(`/classes/${id}`),
  deleteClass: (id) => api.delete(`/classes/${id}`),
  promoteClasses: (data) => api.post('/class-promotions', data),
};

export const subjectApi = {
  getAll: (params) => api.get('/subjects', { params }),
  getSubjects: (params) => api.get('/subjects', { params }),
  getById: (id) => api.get(`/subjects/${id}`),
  create: (data) => api.post('/subjects', data),
  createSubject: (data) => api.post('/subjects', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  updateSubject: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id) => api.delete(`/subjects/${id}`),
  deleteSubject: (id) => api.delete(`/subjects/${id}`),
};

export const teacherApi = {
  getAll: (params) => api.get('/teachers', { params }),
  getTeachers: (params) => api.get('/teachers', { params }),
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
  getAll: (params) => {
    const cleanParams = params ? { ...params } : {};
    if (cleanParams.all === true) cleanParams.all = 1;
    return api.get('/students', { params: cleanParams });
  },
  getStudents: (params) => {
    const cleanParams = params ? { ...params } : {};
    if (cleanParams.all === true) cleanParams.all = 1;
    return api.get('/students', { params: cleanParams });
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

export const parentApi = {
  getAll: (params) => api.get('/parents', { params }),
  getById: (id) => api.get(`/parents/${id}`),
  create: (data) => api.post('/parents', data),
  update: (id, data) => api.put(`/parents/${id}`, data),
  delete: (id) => api.delete(`/parents/${id}`),
};

export const teacherAssignmentApi = {
  getAll: (params) => api.get('/teacher-assignments', { params }),
  getById: (id) => api.get(`/teacher-assignments/${id}`),
  create: (data) => api.post('/teacher-assignments', data),
  update: (id, data) => api.put(`/teacher-assignments/${id}`, data),
  delete: (id) => api.delete(`/teacher-assignments/${id}`),
  getAssignmentMatrix: () => api.get('/teachers/assignments/matrix'),
};

export const gradePromotionApi = {
  execute: (data) => api.post('/class-promotions', data),
};

export const authConfirmApi = {
  confirmPassword: (password) => api.post('/confirm-password', { password }),
};

export default {
  summary: masterDataSummaryApi,
  classes: classApi,
  rooms: roomApi,
  subjects: subjectApi,
  teachers: teacherApi,
  students: studentApi,
  parents: parentApi,
  teacherAssignments: teacherAssignmentApi,
  gradePromotions: gradePromotionApi,
};
