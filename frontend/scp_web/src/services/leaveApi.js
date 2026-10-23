import api from './api';

/**
 * Service API untuk Modul Perizinan Siswa & Monitoring Kehadiran (Fase 5)
 * Mengelola pengajuan izin mandiri siswa/ortu, verifikasi oleh Kesiswaan/Waka,
 * serta monitoring rekapitulasi kehadiran institusi multi-role.
 */

// Mock Fallback Data untuk Perizinan Siswa
const MOCK_LEAVE_REQUESTS = [
  {
    id: 1,
    student_id: 4,
    student: {
      id: 4,
      name: 'Aisyah Putri Ramadhani',
      nis_nip: '2024001',
      class_id: 1,
      schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    },
    applicant_id: 4,
    applicant: { id: 4, name: 'Aisyah Putri Ramadhani', role: 'student' },
    type: 'tidak_masuk',
    category: 'sakit',
    start_date: '2026-10-23',
    end_date: '2026-10-24',
    departure_time: null,
    expected_return_time: null,
    status_approval: 'pending',
    document_path: 'leaves/surat_keterangan_dokter_aisyah.pdf',
    created_at: '2026-10-23T07:15:00.000000Z',
  },
  {
    id: 2,
    student_id: 5,
    student: {
      id: 5,
      name: 'Bayu Aditya Pratama',
      nis_nip: '2024002',
      class_id: 1,
      schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    },
    applicant_id: 5,
    applicant: { id: 5, name: 'Bayu Aditya Pratama', role: 'student' },
    type: 'tidak_masuk',
    category: 'lainnya',
    start_date: '2026-10-22',
    end_date: '2026-10-22',
    departure_time: null,
    expected_return_time: null,
    status_approval: 'approved',
    document_path: null,
    created_at: '2026-10-21T14:30:00.000000Z',
    verified_by: 3,
    verified_at: '2026-10-22T06:45:00.000000Z',
  },
  {
    id: 3,
    student_id: 6,
    student: {
      id: 6,
      name: 'Citra Dewi Lestari',
      nis_nip: '2024003',
      class_id: 1,
      schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    },
    applicant_id: 6,
    applicant: { id: 6, name: 'Citra Dewi Lestari', role: 'student' },
    type: 'keluar_sekolah',
    category: 'lainnya',
    start_date: '2026-10-23',
    end_date: '2026-10-23',
    departure_time: '10:30',
    expected_return_time: '12:00',
    status_approval: 'pending',
    document_path: null,
    created_at: '2026-10-23T08:00:00.000000Z',
  },
];

// Mock Fallback Data untuk Presensi Institusi
const MOCK_ATTENDANCES = [
  {
    id: 101,
    student_id: 4,
    student: {
      id: 4,
      name: 'Aisyah Putri Ramadhani',
      nis_nip: '2024001',
      class_id: 1,
      schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    },
    journal_id: 1,
    status: 'Hadir',
    date: '2026-10-23',
    journal: {
      id: 1,
      date: '2026-10-23',
      status: 'completed',
      topic_description: 'Praktikum Pembuatan REST API dengan Laravel dan Sanctum',
      photo_path: 'journals/demo-kbm-1.jpg',
      schedule: {
        id: 1,
        subject: { id: 1, name: 'Pemrograman Web' },
        teacher: { id: 2, name: 'Drs. Ahmad Fauzi, M.Pd.' },
      },
    },
  },
  {
    id: 102,
    student_id: 5,
    student: {
      id: 5,
      name: 'Bayu Aditya Pratama',
      nis_nip: '2024002',
      class_id: 1,
      schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    },
    journal_id: 1,
    status: 'Izin',
    date: '2026-10-23',
    journal: {
      id: 1,
      date: '2026-10-23',
      status: 'completed',
      topic_description: 'Praktikum Pembuatan REST API dengan Laravel dan Sanctum',
      photo_path: 'journals/demo-kbm-1.jpg',
      schedule: {
        id: 1,
        subject: { id: 1, name: 'Pemrograman Web' },
        teacher: { id: 2, name: 'Drs. Ahmad Fauzi, M.Pd.' },
      },
    },
  },
  {
    id: 103,
    student_id: 6,
    student: {
      id: 6,
      name: 'Citra Dewi Lestari',
      nis_nip: '2024003',
      class_id: 1,
      schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    },
    journal_id: 1,
    status: 'Hadir',
    date: '2026-10-23',
    journal: {
      id: 1,
      date: '2026-10-23',
      status: 'completed',
      topic_description: 'Praktikum Pembuatan REST API dengan Laravel dan Sanctum',
      photo_path: 'journals/demo-kbm-1.jpg',
      schedule: {
        id: 1,
        subject: { id: 1, name: 'Pemrograman Web' },
        teacher: { id: 2, name: 'Drs. Ahmad Fauzi, M.Pd.' },
      },
    },
  },
  {
    id: 104,
    student_id: 7,
    student: {
      id: 7,
      name: 'Dimas Arya Nugraha',
      nis_nip: '2024004',
      class_id: 1,
      schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    },
    journal_id: 1,
    status: 'Sakit',
    date: '2026-10-23',
    journal: {
      id: 1,
      date: '2026-10-23',
      status: 'completed',
      topic_description: 'Praktikum Pembuatan REST API dengan Laravel dan Sanctum',
      photo_path: 'journals/demo-kbm-1.jpg',
      schedule: {
        id: 1,
        subject: { id: 1, name: 'Pemrograman Web' },
        teacher: { id: 2, name: 'Drs. Ahmad Fauzi, M.Pd.' },
      },
    },
  },
  {
    id: 105,
    student_id: 8,
    student: {
      id: 8,
      name: 'Eka Nur Safitri',
      nis_nip: '2024005',
      class_id: 1,
      schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    },
    journal_id: 1,
    status: 'Hadir',
    date: '2026-10-23',
    journal: {
      id: 1,
      date: '2026-10-23',
      status: 'completed',
      topic_description: 'Praktikum Pembuatan REST API dengan Laravel dan Sanctum',
      photo_path: 'journals/demo-kbm-1.jpg',
      schedule: {
        id: 1,
        subject: { id: 1, name: 'Pemrograman Web' },
        teacher: { id: 2, name: 'Drs. Ahmad Fauzi, M.Pd.' },
      },
    },
  },
];

export const leaveApi = {
  /**
   * Mengambil daftar perizinan siswa (auto-scoped multi-role di backend)
   */
  async getLeaveRequests(params = {}) {
    try {
      const res = await api.get('/leave-requests', { params });
      return res;
    } catch {
      let filtered = [...MOCK_LEAVE_REQUESTS];
      if (params.status || params.status_approval) {
        const s = params.status || params.status_approval;
        if (s !== 'all') {
          filtered = filtered.filter((item) => item.status_approval === s);
        }
      }
      if (params.type && params.type !== 'all') {
        filtered = filtered.filter((item) => item.type === params.type);
      }
      return {
        success: true,
        data: filtered,
        meta: {
          current_page: 1,
          per_page: params.per_page || 15,
          total: filtered.length,
          last_page: 1,
        },
      };
    }
  },

  /**
   * Mengambil detail satu perizinan siswa
   */
  async getLeaveRequestDetail(id) {
    try {
      const res = await api.get(`/leave-requests/${id}`);
      return res;
    } catch {
      const match = MOCK_LEAVE_REQUESTS.find((r) => r.id === parseInt(id, 10)) || MOCK_LEAVE_REQUESTS[0];
      return {
        success: true,
        data: match,
      };
    }
  },

  /**
   * Mengajukan permohonan izin baru (POST /api/leave-requests)
   * Mengirim FormData multipart (tipe, kategori, tanggal/jam, dokumen)
   */
  async createLeaveRequest(formData) {
    try {
      const res = await api.post('/leave-requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res;
    } catch (err) {
      if (err.response?.status === 422 || err.response?.status === 403) {
        throw err;
      }
      // Fallback response offline
      return {
        success: true,
        message: 'Pengajuan perizinan berhasil dikirim (Offline Mode).',
        data: {
          id: Date.now(),
          type: formData.get ? formData.get('type') : 'tidak_masuk',
          category: formData.get ? formData.get('category') : 'sakit',
          status_approval: 'pending',
          start_date: formData.get ? formData.get('start_date') : '2026-10-23',
          end_date: formData.get ? formData.get('end_date') : '2026-10-24',
          document_path: formData.get && formData.get('document') ? 'leaves/surat_izin_offline.pdf' : null,
          created_at: new Date().toISOString(),
        },
      };
    }
  },

  /**
   * Memperbarui perizinan:
   * - Verifikasi Kesiswaan / Waka: { status: 'approved' | 'rejected' }
   * - Edit permohonan pending oleh Siswa/Ortu: FormData / data
   */
  async updateLeaveRequest(id, dataOrFormData) {
    try {
      const isFormData = dataOrFormData instanceof FormData;
      const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};
      const res = await api.patch(`/leave-requests/${id}`, dataOrFormData, { headers });
      return res;
    } catch (err) {
      if (err.response?.status === 422 || err.response?.status === 403) {
        throw err;
      }
      return {
        success: true,
        message: 'Data perizinan berhasil diperbarui (Offline Mode).',
        data: { id, status_approval: dataOrFormData.status || 'approved' },
      };
    }
  },

  /**
   * Membatalkan permohonan izin selama berstatus pending (DELETE /api/leave-requests/{id})
   */
  async deleteLeaveRequest(id) {
    try {
      const res = await api.delete(`/leave-requests/${id}`);
      return res;
    } catch (err) {
      if (err.response?.status === 422 || err.response?.status === 403) {
        throw err;
      }
      return {
        success: true,
        message: 'Pengajuan perizinan berhasil dibatalkan (Offline Mode).',
      };
    }
  },

  /**
   * Mengambil rekapitulasi presensi institusi multi-role (GET /api/attendances)
   */
  async getAttendances(params = {}) {
    try {
      const res = await api.get('/attendances', { params });
      return res;
    } catch {
      let filtered = [...MOCK_ATTENDANCES];
      if (params.status && params.status !== 'ALL') {
        filtered = filtered.filter((a) => a.status.toLowerCase() === params.status.toLowerCase());
      }
      if (params.class_id && params.class_id !== 'ALL') {
        filtered = filtered.filter((a) => a.student?.class_id === parseInt(params.class_id, 10));
      }
      return {
        success: true,
        data: filtered,
        meta: {
          current_page: 1,
          per_page: params.per_page || 15,
          total: filtered.length,
          last_page: 1,
        },
      };
    }
  },
};

export default leaveApi;
