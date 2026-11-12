import api from './api';

/**
 * Service API untuk Fitur Generate Jadwal Otomatis (Waka Kurikulum)
 */
export const scheduleGenerationApi = {
  getConfig: () => api.get('/schedule-generation/config'),
  checkTargetState: (cycles) => api.post('/schedule-generation/check-target-state', { cycles }),
  runGeneration: (cycles) => api.post('/schedule-generation/run', { cycles }),
  getBatch: (batchUuid) => api.get(`/schedule-generation/batches/${batchUuid}`),
  getDrafts: (batchUuid, params = {}) =>
    api.get(`/schedule-generation/batches/${batchUuid}/drafts`, { params }),
  applyBatch: (batchUuid, password) =>
    api.post(`/schedule-generation/batches/${batchUuid}/apply`, { password }),
  discardBatch: (batchUuid) => api.delete(`/schedule-generation/batches/${batchUuid}`),
  getCurriculumAssignments: (params = {}) =>
    api.get('/schedule-generation/curriculum-assignments', { params }),
  updateCurriculumAssignment: (id, data) =>
    api.put(`/schedule-generation/curriculum-assignments/${id}`, data),
};

export default scheduleGenerationApi;
