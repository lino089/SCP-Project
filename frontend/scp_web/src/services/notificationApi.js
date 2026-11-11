import api from './api';

export const notificationApi = {
  /**
   * Mengambil daftar notifikasi milik pengguna yang sedang login
   * GET /api/notifications
   */
  async getNotifications(params = {}, config = {}) {
    return api.get('/notifications', { params, ...config });
  },

  /**
   * Menandai satu notifikasi sebagai sudah dibaca
   * PATCH /api/notifications/{id}/read
   */
  async markAsRead(id, config = {}) {
    return api.patch(`/notifications/${id}/read`, {}, config);
  },

  /**
   * Menandai semua notifikasi sebagai sudah dibaca
   * PATCH /api/notifications/mark-all-read
   */
  async markAllAsRead(config = {}) {
    return api.patch('/notifications/mark-all-read', {}, config);
  },

  /**
   * Mengirimkan pengingat keterlambatan jurnal KBM oleh Waka
   * POST /api/notifications/remind-journal
   */
  async sendJournalReminder(payload, config = {}) {
    return api.post('/notifications/remind-journal', payload, config);
  },
};

export default notificationApi;
