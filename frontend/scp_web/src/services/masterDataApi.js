import api from './api';

/**
 * Service API untuk Manajemen Master Data Sekolah & Siklus Promosi
 * Mendukung Waka Kurikulum dalam mengelola Kelas, Ruangan, Mata Pelajaran,
 * Guru (beserta penugasan tambahan & FET ID), serta Siswa (beserta akun orang tua).
 */

export const classApi = {
  getClasses: (params) => api.get('/classes', { params }),
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
  deleteTeacher: (id) => api.delete(`/teachers/${id}`),
  assignRole: (teacherId, data) => api.post(`/teachers/${teacherId}/assignments`, data),
  revokeRole: (teacherId, assignmentId) => api.delete(`/teachers/${teacherId}/assignments/${assignmentId}`),
};

export const studentApi = {
  getStudents: (params) => api.get('/students', { params }),
  createStudent: (data) => api.post('/students', data),
  updateStudent: (id, data) => api.put(`/students/${id}`, data),
  deleteStudent: (id) => api.delete(`/students/${id}`),
  holdBack: (id) => api.post(`/students/${id}/hold-back`),
};

export default {
  classes: classApi,
  rooms: roomApi,
  subjects: subjectApi,
  teachers: teacherApi,
  students: studentApi,
};
