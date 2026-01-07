import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export default defineConfig({
  plugins: [vue(), react()],
  root: 'app',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http:
      '/CowCoo': 'http:
      '/ws': {
        target: 'ws:
        ws: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app')
    }
  }
});
