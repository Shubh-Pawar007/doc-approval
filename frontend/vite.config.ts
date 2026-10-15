import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In dev the frontend calls /api on its own origin; Vite forwards to the backend (no CORS needed).
    proxy: { '/api': 'http://localhost:4000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
