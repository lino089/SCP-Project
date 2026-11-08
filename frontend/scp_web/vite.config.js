import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// P-1 Build Guard Plugin: Mencegah localhost / IP lokal masuk ke build produksi
function apiBaseUrlBuildGuard() {
  return {
    name: 'api-base-url-build-guard',
    configResolved(config) {
      if (config.command === 'build' && config.mode === 'production') {
        const apiUrl = config.env.VITE_API_BASE_URL || '';
        if (/localhost|127\.0\.0\.1|192\.168\./i.test(apiUrl)) {
          throw new Error(
            `\n[SECURITY BUILD GUARD] Production build failed!\n` +
            `VITE_API_BASE_URL contains prohibited local address: "${apiUrl}"\n` +
            `Production web build MUST use relative path "/api" (proxied by Nginx) or a valid public HTTPS endpoint.\n`
          );
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      apiBaseUrlBuildGuard(),
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-ui';
              }
              if (id.includes('axios')) {
                return 'vendor-network';
              }
              return 'vendor';
            }
          },
        },
      },
    },
  };
})
