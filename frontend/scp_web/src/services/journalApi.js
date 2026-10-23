import api from './api';

/**
 * Service API untuk Modul Guru & Kesiswaan (Fase 4):
 * Kalender Mengajar KBM, Pembukaan Sesi Kelas, Presensi Exception-Based,
 * Kompresi Dokumentasi KBM, dan Penanganan Guru Berhalangan/Piket Kesiswaan.
 */

// Mock Fallback Data untuk Keperluan Standalone / Offline
const MOCK_TEACHER_SCHEDULES = [
  {
    id: 101,
    cycle_type: 1,
    day_of_week: 1, // Senin
    period_number: 1,
    duration_periods: 2,
    teacher_id: 1,
    teacher: { id: 1, name: 'Drs. Ahmad Fauzi, M.Pd.', nis_nip: '198501152010011001' },
    subject_id: 1,
    subject: { id: 1, name: 'Pemrograman Web & Perangkat Bergerak' },
    school_class_id: 1,
    schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    room_id: 9,
    room: { id: 9, name: 'Lab Komputer 1' },
    resolved_times: { start_time: '08:00', end_time: '09:30' },
    journal_status: 'ongoing', // ongoing | completed | not_started | teacher_absent
  },
  {
    id: 102,
    cycle_type: 1,
    day_of_week: 1, // Senin
    period_number: 4,
    duration_periods: 2,
    teacher_id: 1,
    teacher: { id: 1, name: 'Drs. Ahmad Fauzi, M.Pd.', nis_nip: '198501152010011001' },
    subject_id: 1,
    subject: { id: 1, name: 'Pemrograman Web & Perangkat Bergerak' },
    school_class_id: 2,
    schoolClass: { id: 2, name: 'X-TKJ-1', level: 'X' },
    room_id: 10,
    room: { id: 10, name: 'Lab Komputer 2' },
    resolved_times: { start_time: '10:30', end_time: '12:00' },
    journal_status: 'not_started',
  },
  {
    id: 103,
    cycle_type: 1,
    day_of_week: 2, // Selasa
    period_number: 2,
    duration_periods: 3,
    teacher_id: 1,
    teacher: { id: 1, name: 'Drs. Ahmad Fauzi, M.Pd.', nis_nip: '198501152010011001' },
    subject_id: 2,
    subject: { id: 2, name: 'Basis Data' },
    school_class_id: 5,
    schoolClass: { id: 5, name: 'XI-RPL-1', level: 'XI' },
    room_id: 9,
    room: { id: 9, name: 'Lab Komputer 1' },
    resolved_times: { start_time: '08:00', end_time: '10:15' },
    journal_status: 'completed',
  },
  {
    id: 104,
    cycle_type: 1,
    day_of_week: 3, // Rabu
    period_number: 1,
    duration_periods: 2,
    teacher_id: 1,
    teacher: { id: 1, name: 'Drs. Ahmad Fauzi, M.Pd.', nis_nip: '198501152010011001' },
    subject_id: 1,
    subject: { id: 1, name: 'Pemrograman Web & Perangkat Bergerak' },
    school_class_id: 1,
    schoolClass: { id: 1, name: 'X-RPL-1', level: 'X' },
    room_id: 9,
    room: { id: 9, name: 'Lab Komputer 1' },
    resolved_times: { start_time: '07:15', end_time: '08:45' },
    journal_status: 'not_started',
  },
  {
    id: 105,
    cycle_type: 1,
    day_of_week: 4, // Kamis
    period_number: 5,
    duration_periods: 2,
    teacher_id: 1,
    teacher: { id: 1, name: 'Drs. Ahmad Fauzi, M.Pd.', nis_nip: '198501152010011001' },
    subject_id: 3,
    subject: { id: 3, name: 'Pemodelan Perangkat Lunak' },
    school_class_id: 5,
    schoolClass: { id: 5, name: 'XI-RPL-1', level: 'XI' },
    room_id: 1,
    room: { id: 1, name: 'R-101' },
    resolved_times: { start_time: '10:30', end_time: '12:00' },
    journal_status: 'not_started',
  },
  {
    id: 106,
    cycle_type: 1,
    day_of_week: 5, // Jumat
    period_number: 1,
    duration_periods: 2,
    teacher_id: 1,
    teacher: { id: 1, name: 'Drs. Ahmad Fauzi, M.Pd.', nis_nip: '198501152010011001' },
    subject_id: 2,
    subject: { id: 2, name: 'Basis Data' },
    school_class_id: 2,
    schoolClass: { id: 2, name: 'X-TKJ-1', level: 'X' },
    room_id: 10,
    room: { id: 10, name: 'Lab Komputer 2' },
    resolved_times: { start_time: '07:15', end_time: '08:35' },
    journal_status: 'not_started',
  },
];

export const MOCK_STUDENTS_CLASS_1 = [
  { id: 1, nis: '2024001', name: 'Aisyah Putri Ramadhani', class_id: 1, status: 'Hadir' },
  { id: 2, nis: '2024002', name: 'Bayu Aditya Pratama', class_id: 1, status: 'Hadir' },
  { id: 3, nis: '2024003', name: 'Citra Dewi Lestari', class_id: 1, status: 'Hadir' },
  { id: 4, nis: '2024004', name: 'Dimas Arya Nugraha', class_id: 1, status: 'Hadir' },
  { id: 5, nis: '2024005', name: 'Eka Nur Safitri', class_id: 1, status: 'Sakit', official_leave: true },
  { id: 6, nis: '2024006', name: 'Fajar Hidayat', class_id: 1, status: 'Hadir' },
  { id: 7, nis: '2024007', name: 'Gita Rahmawati', class_id: 1, status: 'Hadir' },
  { id: 8, nis: '2024008', name: 'Hafiz Syahputra', class_id: 1, status: 'Hadir' },
  { id: 9, nis: '2024009', name: 'Intan Permatasari', class_id: 1, status: 'Hadir' },
  { id: 10, nis: '2024010', name: 'Joko Susilo', class_id: 1, status: 'Hadir' },
  { id: 11, nis: '2024011', name: 'Kartika Sari', class_id: 1, status: 'Hadir' },
  { id: 12, nis: '2024012', name: 'Lukman Hakim', class_id: 1, status: 'Izin', official_leave: true },
  { id: 13, nis: '2024013', name: 'Maya Anggraini', class_id: 1, status: 'Hadir' },
  { id: 14, nis: '2024014', name: 'Naufal Alfarizi', class_id: 1, status: 'Hadir' },
  { id: 15, nis: '2024015', name: 'Olivia Febrianti', class_id: 1, status: 'Hadir' },
  { id: 16, nis: '2024016', name: 'Panji Gumilang', class_id: 1, status: 'Hadir' },
  { id: 17, nis: '2024017', name: 'Qonita Az-Zahra', class_id: 1, status: 'Hadir' },
  { id: 18, nis: '2024018', name: 'Rian Saputra', class_id: 1, status: 'Hadir' },
  { id: 19, nis: '2024019', name: 'Salsabila Nadya', class_id: 1, status: 'Hadir' },
  { id: 20, nis: '2024020', name: 'Taufik Hidayatullah', class_id: 1, status: 'Hadir' },
  { id: 21, nis: '2024021', name: 'Umar Wirahadikusumah', class_id: 1, status: 'Hadir' },
  { id: 22, nis: '2024022', name: 'Vina Panduwinata', class_id: 1, status: 'Hadir' },
  { id: 23, nis: '2024023', name: 'Wahyu Hidayat', class_id: 1, status: 'Hadir' },
  { id: 24, nis: '2024024', name: 'Xavier Danendra', class_id: 1, status: 'Hadir' },
  { id: 25, nis: '2024025', name: 'Yasmin Aulia', class_id: 1, status: 'Hadir' },
  { id: 26, nis: '2024026', name: 'Zack Lee Pratama', class_id: 1, status: 'Hadir' },
  { id: 27, nis: '2024027', name: 'Aditya Pratama', class_id: 1, status: 'Hadir' },
  { id: 28, nis: '2024028', name: 'Bella Safira', class_id: 1, status: 'Hadir' },
  { id: 29, nis: '2024029', name: 'Chandra Wijaya', class_id: 1, status: 'Hadir' },
  { id: 30, nis: '2024030', name: 'Dina Mariana', class_id: 1, status: 'Hadir' },
  { id: 31, nis: '2024031', name: 'Erwin Gutawa', class_id: 1, status: 'Hadir' },
  { id: 32, nis: '2024032', name: 'Farah Quinn', class_id: 1, status: 'Hadir' },
];

export const journalApi = {
  /**
   * Mengambil jadwal mengajar guru yang login (auto-scoped di backend)
   */
  async getTeacherSchedules(params = {}) {
    try {
      const res = await api.get('/schedules', { params });
      return res.data;
    } catch {
      // Offline fallback
      let filtered = [...MOCK_TEACHER_SCHEDULES];
      if (params.day) {
        filtered = filtered.filter((s) => s.day_of_week === parseInt(params.day, 10));
      }
      return {
        success: true,
        data: filtered,
        meta: { total: filtered.length },
      };
    }
  },

  /**
   * Mengambil peringatan jadwal KBM yang selesai > 30 menit lalu namun belum memiliki jurnal selesai
   */
  async getMissingJournals(params = {}) {
    try {
      const res = await api.get('/schedules', {
        params: { ...params, status: 'missing_journal' },
      });
      return res.data;
    } catch {
      return {
        success: true,
        data: [],
        meta: { total: 0 },
      };
    }
  },

  /**
   * Mengambil daftar jurnal (history / active)
   */
  async getJournals(params = {}) {
    try {
      const res = await api.get('/journals', { params });
      return res.data;
    } catch {
      return {
        success: true,
        data: [],
        meta: { current_page: 1, total: 0, last_page: 1 },
      };
    }
  },

  /**
   * Mengambil detail jurnal beserta riwayat presensi
   */
  async getJournalDetail(id) {
    try {
      const res = await api.get(`/journals/${id}`);
      return res.data;
    } catch {
      return {
        success: true,
        data: {
          id,
          topic_description: 'Pengenalan React Router & State Management',
          status: 'ongoing',
          date: new Date().toISOString().split('T')[0],
          schedule: MOCK_TEACHER_SCHEDULES[0],
          attendances: MOCK_STUDENTS_CLASS_1.map((st) => ({
            id: st.id,
            status: st.status,
            student: st,
          })),
        },
      };
    }
  },

  /**
   * Membuka sesi kelas KBM (POST /api/journals)
   * Mengembalikan status 'ongoing' dan 'meta.approved_leaves'
   */
  async openJournal(payload) {
    // payload: { schedule_id, status: 'ongoing', date: 'YYYY-MM-DD' }
    try {
      const res = await api.post('/journals', payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        throw err;
      }
      // Fallback response bila offline
      return {
        success: true,
        message: 'Jurnal KBM berhasil dibuka (Offline Standby).',
        data: {
          id: Date.now(),
          schedule_id: payload.schedule_id,
          date: payload.date || new Date().toISOString().split('T')[0],
          status: 'ongoing',
          schedule: MOCK_TEACHER_SCHEDULES.find((s) => s.id === payload.schedule_id) || MOCK_TEACHER_SCHEDULES[0],
        },
        meta: {
          approved_leaves: [
            { student_id: 5, student_name: 'Eka Nur Safitri', category: 'sakit', default_status: 'Sakit' },
            { student_id: 12, student_name: 'Lukman Hakim', category: 'izin', default_status: 'Izin' },
          ],
        },
      };
    }
  },

  /**
   * Menyelesaikan jurnal KBM atomik (PUT /api/journals/{id})
   * Menerima FormData yang memuat: topic_description, photo, dan array exceptions
   */
  async completeJournal(id, formData) {
    try {
      // Untuk kompatibilitas Laravel multipart, gunakan POST dengan _method=PUT jika FormData
      if (formData instanceof FormData && !formData.has('_method')) {
        formData.append('_method', 'PUT');
      }

      const res = await api.post(`/journals/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 422) {
        throw err;
      }
      return {
        success: true,
        message: 'Jurnal KBM dan presensi berhasil diselesaikan (Offline Mode).',
        data: {
          id,
          status: 'completed',
          topic_description: formData.get ? formData.get('topic_description') : '',
        },
        meta: {
          total_students_attendance: 32,
        },
      };
    }
  },

  /**
   * Menandai status teacher_absent (Guru Berhalangan Hadir / Jam Kosong)
   */
  async markTeacherAbsent(id, payload = {}) {
    try {
      const res = await api.patch(`/journals/${id}`, payload);
      return res.data;
    } catch (err) {
      if (err.response?.status === 403) {
        throw err;
      }
      return {
        success: true,
        message: 'Jadwal berhasil ditandai sebagai guru berhalangan hadir (teacher_absent).',
        data: { id, status: 'teacher_absent' },
      };
    }
  },

  /**
   * Mengambil daftar siswa per kelas (untuk presensi saat sesi baru dimulai)
   */
  async getClassStudents(classId) {
    try {
      const res = await api.get('/students', { params: { class_id: classId, per_page: 100 } });
      return res.data;
    } catch {
      return {
        success: true,
        data: MOCK_STUDENTS_CLASS_1,
      };
    }
  },
};

export default journalApi;
