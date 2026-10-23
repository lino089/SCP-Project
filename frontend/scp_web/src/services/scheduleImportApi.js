import api from './api';

/**
 * Service API untuk Import Jadwal Pelajaran Otomatis dari Berkas PDF FET
 * Mendukung Waka Kurikulum dalam alur asinkron:
 * 1. Upload multipart 2 berkas PDF (Jadwal_Kelas & Jadwal_Ruangan) -> HTTP 202 Accepted
 * 2. Polling status ekstraksi & pengambilan daftar baris (uploaded -> parsing -> preview_ready)
 * 3. Resolusi baris manual (mapping / exclude)
 * 4. Konfirmasi komit jadwal baru per putaran dengan verifikasi kata sandi
 * 5. Pembatalan batch import
 */

export const scheduleImportApi = {
  uploadSchedulePdf: (formData) =>
    api.post('/schedule-imports', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  getImportDetail: (id) => api.get(`/schedule-imports/${id}`),

  resolveImportRow: (importId, rowId, data) =>
    api.patch(`/schedule-imports/${importId}/rows/${rowId}`, data), // { matched_class_id, matched_teacher_id, matched_room_id, matched_subject_id, exclude: boolean }

  confirmImport: (importId, data) =>
    api.post(`/schedule-imports/${importId}/confirm`, data), // { password }

  cancelImport: (importId) => api.delete(`/schedule-imports/${importId}`),
};

export default scheduleImportApi;
