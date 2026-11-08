import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// P-1 Build Guard Plugin untuk Mobile:
// Memastikan build produksi mobile WAJIB memakai HTTPS domain publik,
// dan melarang keras localhost, 127.0.0.1, atau IP privat terbawa ke rilis APK/bundle.
function mobileApiBuildGuard() {
  return {
    name: 'mobile-api-build-guard',
    configResolved(config) {
      if (config.command === 'build' && config.mode === 'production') {
        const apiUrl = config.env.VITE_API_BASE_URL || '';
        if (!apiUrl.startsWith('https://') || /localhost|127\.0\.0\.1|192\.168\./i.test(apiUrl)) {
          throw new Error(
            `\n[SECURITY BUILD GUARD] Mobile production build failed!\n` +
            `VITE_API_BASE_URL mengandung URL non-HTTPS atau lokal: "${apiUrl}"\n` +
            `Build produksi mobile WAJIB menggunakan endpoint HTTPS publik yang valid (contoh: https://schoolclassprogress.my.id/api).\n`
          );
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const _env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), mobileApiBuildGuard()],
    server: {
      port: 5174,
      host: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  };
})
