import api from './api';

/**
 * Service API untuk Manajemen Jadwal Pelajaran & Pengaturan Akademik Waka Kurikulum
 * Mengelola siklus putaran jadwal, status upacara hari Senin, log riwayat putaran,
 * serta operasi CRUD jadwal pelajaran berbasis verifikasi kata sandi (Step-Up Auth).
 */

export const academicSettingApi = {
  getSettings: () => api.get('/academic-settings'),
  getPeriodTemplates: () => api.get('/period-templates'),
  updateCycle: (data) => api.patch('/academic-settings', data), // { cycle_type: 1|2, password }
  updateMondayStatus: (data) => api.patch('/academic-settings/monday-status', data), // { is_upacara: boolean, password }
  updateAcademicYear: (data) => api.patch('/academic-settings/year', data), // { academic_year: string, semester?: string, password }
  getCycleHistory: (params) => api.get('/cycle-history', { params }),
};

export const scheduleApi = {
  getSchedules: (params, config = {}) => api.get('/schedules', { params, ...config }),
  getMissingJournals: (params, config = {}) =>
    api.get('/schedules', { params: { ...params, status: 'missing_journal' }, ...config }),
  createSchedule: (data) => api.post('/schedules', data), // { cycle_type, day_of_week, period_number, duration_periods, class_id, teacher_id, room_id, subject_id, password }
  updateSchedule: (id, data) => api.put(`/schedules/${id}`, data),
  deleteSchedule: (id, data) => api.delete(`/schedules/${id}`, { data }), // { password }
  resetSchedules: (data) => api.post('/schedules/reset', data), // { password }
};

export default {
  settings: academicSettingApi,
  schedules: scheduleApi,
};
