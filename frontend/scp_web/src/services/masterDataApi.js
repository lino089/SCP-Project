import api from './api';

/**
 * Service API untuk Manajemen Master Data Sekolah & Siklus Promosi
 * Mendukung Waka Kurikulum dalam mengelola Kelas, Ruangan, Mata Pelajaran,
 * Guru (beserta penugasan tambahan & FET ID), serta Siswa (beserta akun orang tua).
 */

export const masterDataSummaryApi = {
  getSummary: () => api.get('/master-data/summary'),
  resetMasterData: (data) => api.post('/master-data/reset', data), // { password, scope }
};

export const classApi = {
  getClasses: (params) => {
    const cleanParams = params ? { ...params } : {};
    if (cleanParams.all === true) cleanParams.all = 1;
    return api.get('/classes', { params: cleanParams });
  },
  createClass: (data) => api.post('/classes', data),
  updateClass: (id, data) => api.put(`/classes/${id}`, data),
  deleteClass: (id) => api.delete(`/classes/${id}`),
  promoteClasses: () => api.post('/class-promotions'),
};

export const roomApi = {
  getRooms: (params) => api.get('/rooms', { params }),
  createRoom: (data) => api.post('/rooms', data),
  updateRoom: (id, data) => api.put(`/rooms/${id}`, data),
  deleteRoom: (id) => api.delete(`/rooms/${id}`),
};

export const subjectApi = {
  getSubjects: (params) => api.get('/subjects', { params }),
  createSubject: (data) => api.post('/subjects', data),
  updateSubject: (id, data) => api.put(`/subjects/${id}`, data),
  deleteSubject: (id) => api.delete(`/subjects/${id}`),
};

export const teacherApi = {
  getTeachers: (params) => api.get('/teachers', { params }),
  createTeacher: (data) => api.post('/teachers', data),
  updateTeacher: (id, data) => api.put(`/teachers/${id}`, data),
  deleteTeacher: (id, data) => api.delete(`/teachers/${id}`, { data }),
  assignRole: (teacherId, data) => api.post(`/teachers/${teacherId}/assignments`, data),
  revokeRole: (teacherId, assignmentId) => api.delete(`/teachers/${teacherId}/assignments/${assignmentId}`),
  downloadTemplate: () =>
    api.get('/teachers/import-template', {
      params: { t: Date.now() },
      responseType: 'blob',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    }),
  importTeachers: (formData) =>
    api.post('/teachers/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
};

export const studentApi = {
  getStudents: (params) => {
    const cleanParams = params ? { ...params } : {};
    if (cleanParams.all === true) cleanParams.all = 1;
    return api.get('/students', { params: cleanParams });
  },
  createStudent: (data) => api.post('/students', data),
  updateStudent: (id, data) => api.put(`/students/${id}`, data),
  deleteStudent: (id, data) => api.delete(`/students/${id}`, { data }),
  holdBack: (id, data) => api.post(`/students/${id}/hold-back`, data),
  downloadTemplate: () =>
    api.get('/students/import-template', {
      params: { t: Date.now() },
      responseType: 'blob',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    }),
  importStudents: (formData) =>
    api.post('/students/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
};

export const recycleBinApi = {
  checkDependencies: (entity, id) => api.get(`/master/${entity}/${id}/dependencies`),
  getTrash: (params) => api.get('/master/trash', { params }),
  restoreData: (entity, id) => api.post(`/master/${entity}/${id}/restore`),
  forceDeleteData: (entity, id, data) => api.delete(`/master/${entity}/${id}/force`, { data }),
};

export const teacherAssignmentApi = {
  getAssignmentMatrix: () => api.get('/teachers/assignments/matrix'),
  getAssignmentHistories: (params) => api.get('/teachers/assignments/histories', { params }),
  assignRole: (teacherId, data) => api.post(`/teachers/${teacherId}/assignments`, data),
  revokeRole: (teacherId, assignmentId) => api.delete(`/teachers/${teacherId}/assignments/${assignmentId}`),
  importPreview: (formData) =>
    api.post('/teachers/assignments/import-preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
  importCommit: (payload) => api.post('/teachers/assignments/import-commit', payload),
};

export default {
  summary: masterDataSummaryApi,
  classes: classApi,
  rooms: roomApi,
  subjects: subjectApi,
  teachers: teacherApi,
  teacherAssignments: teacherAssignmentApi,
  students: studentApi,
  recycleBin: recycleBinApi,
};
