import api from './api';

/**
 * Service API untuk Fitur Rekap Kehadiran Siswa di Mobile
 * Khusus Wali Kelas, Kesiswaan, dan Waka Kurikulum
 */
export const attendanceRecapApi = {
  /**
   * Mengambil daftar kelas yang berhak diakses oleh pengguna yang sedang login.
   */
  getClasses: () => api.get('/attendance-recap/classes'),

  /**
   * Mengambil data rekapitulasi kehadiran (KPI, daftar siswa, & perbandingan kelas).
   * @param {Object} params - { class_id, start_date, end_date, month, year, search, status_filter, sort_by }
   */
  getSummary: (params) => api.get('/attendance-recap/summary', { params }),

  /**
   * Mengambil riwayat linimasa presensi dan catatan guru untuk siswa tertentu.
   * @param {number|string} studentId
   * @param {Object} params - { start_date, end_date, status }
   */
  getStudentHistory: (studentId, params) => api.get(`/attendance-recap/student/${studentId}`, { params }),

  /**
   * Mengunduh berkas laporan rekapitulasi kehadiran (.xlsx).
   * @param {Object} params - { class_id, start_date, end_date, month, year, search, status_filter, sort_by }
   */
  exportExcel: (params) =>
    api.get('/attendance-recap/export', {
      params,
      responseType: 'blob',
    }),
};

export default attendanceRecapApi;
