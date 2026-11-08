import api from './api';

/**
 * Service API untuk Modul Guru & Kesiswaan (Fase 4 & 5):
 * Kalender Mengajar KBM, Pembukaan Sesi Kelas, Presensi Exception-Based,
 * Kompresi Dokumentasi KBM, dan Penanganan Guru Berhalangan/Piket Kesiswaan.
 */

export const journalApi = {
  /**
   * Mengambil jadwal mengajar guru yang login (auto-scoped di backend)
   * GET /api/schedules
   */
  async getTeacherSchedules(params = {}, config = {}) {
    return api.get('/schedules', { params, ...config });
  },

  /**
   * Mengambil peringatan jadwal KBM yang selesai > 30 menit lalu namun belum memiliki jurnal selesai
   * GET /api/schedules?status=missing_journal
   */
  async getMissingJournals(params = {}, config = {}) {
    return api.get('/schedules', {
      params: { ...params, status: 'missing_journal' },
      ...config,
    });
  },

  /**
   * Mengambil daftar jurnal (history / active)
   * GET /api/journals
   */
  async getJournals(params = {}, config = {}) {
    return api.get('/journals', { params, ...config });
  },

  /**
   * Mengambil rekapitulasi harian KBM & kepatuhan pengisian jurnal
   * GET /api/journals/daily-recap
   */
  async getDailyRecap(params = {}, config = {}) {
    return api.get('/journals/daily-recap', { params, ...config });
  },

  /**
   * Mengambil detail jurnal beserta riwayat presensi
   * GET /api/journals/{id}
   */
  async getJournalDetail(id) {
    return api.get(`/journals/${id}`);
  },

  /**
   * Membuka sesi kelas KBM (POST /api/journals)
   * Mengembalikan status 'ongoing' dan 'meta.approved_leaves'
   */
  async openJournal(payload) {
    return api.post('/journals', payload);
  },

  /**
   * Menyelesaikan jurnal KBM atomik (PUT /api/journals/{id})
   * Menerima FormData yang memuat: topic_description, photo, dan array exceptions
   */
  async completeJournal(id, formData) {
    // Untuk kompatibilitas Laravel multipart, gunakan POST dengan _method=PUT jika FormData
    if (formData instanceof FormData && !formData.has('_method')) {
      formData.append('_method', 'PUT');
    }

    return api.post(`/journals/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Menandai status teacher_absent (Guru Berhalangan Hadir / Jam Kosong)
   * Jika sesi jurnal sudah dibuka (id tersedia): PATCH /api/journals/{id}
   * Jika sesi jurnal belum dibuka (id null): POST /api/journals dengan status 'teacher_absent'
   */
  async markTeacherAbsent(id, payload = {}) {
    if (id) {
      return api.patch(`/journals/${id}`, payload);
    }
    return api.post('/journals', {
      ...payload,
      status: 'teacher_absent',
    });
  },

  /**
   * Mengambil daftar siswa per kelas (untuk presensi saat sesi baru dimulai)
   * GET /api/students?class_id={classId}&all=true&per_page=100
   */
  async getClassStudents(classId) {
    return api.get('/students', { params: { class_id: classId, all: true, per_page: 100 } });
  },
};

export default journalApi;
