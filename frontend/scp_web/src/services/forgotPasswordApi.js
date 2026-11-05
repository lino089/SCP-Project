import api from './api';

export const forgotPasswordApi = {
  checkIdentity: (identifier) =>
    api.post('/auth/forgot-password/check-identity', { identifier }),

  sendOtp: (identifier, channel = 'email') =>
    api.post('/auth/forgot-password/send-otp', { identifier, channel }),

  verifyOtp: (identifier, code) =>
    api.post('/auth/forgot-password/verify-otp', { identifier, code }),

  resetPassword: ({ identifier, reset_token, new_password, new_password_confirmation }) =>
    api.post('/auth/forgot-password/reset-password', {
      identifier,
      reset_token,
      new_password,
      new_password_confirmation,
    }),
};

export default forgotPasswordApi;
