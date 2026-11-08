import api from './api';

/**
 * Service API untuk Manajemen Jadwal Pelajaran & Pengaturan Akademik Waka Kurikulum (Mobile)
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
  getAll: (params, config = {}) => api.get('/schedules', { params, ...config }),
  getSchedules: (params, config = {}) => api.get('/schedules', { params, ...config }),
  getById: (id) => api.get(`/schedules/${id}`),
  getMissingJournals: (params, config = {}) =>
    api.get('/schedules', { params: { ...params, status: 'missing_journal' }, ...config }),
  create: (data) => api.post('/schedules', data),
  createSchedule: (data) => api.post('/schedules', data),
  update: (id, data) => api.put(`/schedules/${id}`, data),
  updateSchedule: (id, data) => api.put(`/schedules/${id}`, data),
  delete: (id, data) => api.delete(`/schedules/${id}`, { data }),
  deleteSchedule: (id, data) => api.delete(`/schedules/${id}`, { data }),
  resetSchedules: (data) => api.post('/schedules/reset', data),
};

export default {
  settings: academicSettingApi,
  schedules: scheduleApi,
};
