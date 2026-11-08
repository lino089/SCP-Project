import api from './api';

/**
 * Service API untuk Modul Perizinan Siswa & Monitoring Kehadiran (Fase 5)
 * Mengelola pengajuan izin mandiri siswa/ortu, verifikasi oleh Kesiswaan/Waka,
 * serta monitoring rekapitulasi kehadiran institusi multi-role secara riil.
 */

export const leaveApi = {
  /**
   * Mengambil daftar perizinan siswa (auto-scoped multi-role di backend)
   * GET /api/leave-requests
   */
  async getLeaveRequests(params = {}, config = {}) {
    return api.get('/leave-requests', { params, ...config });
  },

  /**
   * Mengambil detail satu perizinan siswa
   * GET /api/leave-requests/{id}
   */
  async getLeaveRequestDetail(id) {
    return api.get(`/leave-requests/${id}`);
  },

  /**
   * Mengajukan permohonan izin baru (POST /api/leave-requests)
   * Mengirim FormData multipart (tipe, kategori, tanggal/jam, dokumen)
   */
  async createLeaveRequest(formData) {
    return api.post('/leave-requests', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * Memperbarui perizinan:
   * - Verifikasi Kesiswaan / Waka: { status: 'approved' | 'rejected' }
   * - Edit permohonan pending oleh Siswa/Ortu: FormData / data
   * PATCH /api/leave-requests/{id}
   */
  async updateLeaveRequest(id, dataOrFormData) {
    const isFormData = dataOrFormData instanceof FormData;
    const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};
    return api.patch(`/leave-requests/${id}`, dataOrFormData, { headers });
  },

  /**
   * Membatalkan permohonan izin selama berstatus pending (DELETE /api/leave-requests/{id})
   */
  async deleteLeaveRequest(id) {
    return api.delete(`/leave-requests/${id}`);
  },

  /**
   * Mengambil rekapitulasi presensi institusi multi-role (GET /api/attendances)
   */
  async getAttendances(params = {}, config = {}) {
    return api.get('/attendances', { params, ...config });
  },

  /**
   * Mengajukan izin mengajar guru beserta lampiran dan tugas titipan.
   * POST /api/teacher-leave-requests (multipart/form-data)
   */
  async submitTeacherLeaveRequest(dataOrFormData) {
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
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Mengambil daftar perizinan mengajar guru (auto-scoped untuk guru yang login).
   * GET /api/teacher-leave-requests
   */
  async getTeacherLeaveRequests(params = {}) {
    return api.get('/teacher-leave-requests', { params });
  },

  /**
   * Menyetujui izin mengajar guru (Kesiswaan / Waka Kurikulum).
   * PATCH /api/teacher-leave-requests/{id}/approve
   */
  async approveTeacherLeaveRequest(id) {
    return api.patch(`/teacher-leave-requests/${id}/approve`);
  },

  /**
   * Menolak izin mengajar guru (Kesiswaan / Waka Kurikulum).
   * PATCH /api/teacher-leave-requests/{id}/reject
   */
  async rejectTeacherLeaveRequest(id) {
    return api.patch(`/teacher-leave-requests/${id}/reject`);
  },
};

export default leaveApi;
