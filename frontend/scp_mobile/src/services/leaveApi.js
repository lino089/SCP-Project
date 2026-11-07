import api from './api';

/**
 * Service API untuk Modul Perizinan Guru & Siswa (Fase 4 & 5)
 */
export const leaveApi = {
  // --- Perizinan Siswa ---
  getLeaveRequests: (params = {}) => api.get('/leave-requests', { params }),
  getLeaveRequestDetail: (id) => api.get(`/leave-requests/${id}`),
  createLeaveRequest: (formData) =>
    api.post('/leave-requests', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateLeaveRequest: (id, dataOrFormData) => {
    const isFormData = dataOrFormData instanceof FormData;
    const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};
    return api.patch(`/leave-requests/${id}`, dataOrFormData, { headers });
  },
  deleteLeaveRequest: (id) => api.delete(`/leave-requests/${id}`),

  // Rekapitulasi Presensi Institusi
  getAttendances: (params = {}) => api.get('/attendances', { params }),

  // --- Perizinan Mengajar Guru ---
  submitTeacherLeaveRequest: (dataOrFormData) => {
    let payload = dataOrFormData;
    if (!(dataOrFormData instanceof FormData)) {
      payload = new FormData();
      if (dataOrFormData.date) payload.append('date', dataOrFormData.date);
      if (dataOrFormData.reason) payload.append('reason', dataOrFormData.reason);
      if (Array.isArray(dataOrFormData.schedule_ids) && dataOrFormData.schedule_ids.length > 0) {
        payload.append('schedule_ids', JSON.stringify(dataOrFormData.schedule_ids.map(Number)));
      }
      if (dataOrFormData.attachment instanceof File) {
        payload.append('attachment', dataOrFormData.attachment);
      }
      if (dataOrFormData.task_instruction) {
        payload.append('task_instruction', dataOrFormData.task_instruction);
      }
      if (dataOrFormData.task_attachment instanceof File) {
        payload.append('task_attachment', dataOrFormData.task_attachment);
      }
    }
    return api.post('/teacher-leave-requests', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getTeacherLeaveRequests: (params = {}) => api.get('/teacher-leave-requests', { params }),
  getTeacherLeaveDetail: (id) => api.get(`/teacher-leave-requests/${id}`),
  approveTeacherLeaveRequest: (id) => api.patch(`/teacher-leave-requests/${id}/approve`),
  rejectTeacherLeaveRequest: (id) => api.patch(`/teacher-leave-requests/${id}/reject`),
};

// Aliases for compatibility
export const studentLeaveApi = {
  getAll: (params) => leaveApi.getLeaveRequests(params),
  getById: (id) => leaveApi.getLeaveRequestDetail(id),
  create: (formData) => leaveApi.createLeaveRequest(formData),
  update: (id, data) => leaveApi.updateLeaveRequest(id, data),
  approve: (id, notes = '') => leaveApi.updateLeaveRequest(id, { status_approval: 'approved', notes }),
  reject: (id, notes = '') => leaveApi.updateLeaveRequest(id, { status_approval: 'rejected', notes }),
  delete: (id) => leaveApi.deleteLeaveRequest(id),
};

export const teacherLeaveApi = {
  getAll: (params) => leaveApi.getTeacherLeaveRequests(params),
  getById: (id) => leaveApi.getTeacherLeaveDetail(id),
  create: (formData) => leaveApi.submitTeacherLeaveRequest(formData),
  approve: (id) => leaveApi.approveTeacherLeaveRequest(id),
  reject: (id) => leaveApi.rejectTeacherLeaveRequest(id),
};

export default leaveApi;
