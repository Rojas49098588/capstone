/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // The extension opens http://localhost:5173/, so keep the port fixed.
  server: { port: 5173, strictPort: true },
  // Firestore alone is ~550 kB; it is loaded lazily in its own chunk (sync/services.ts), never in the main bundle (~410 kB).
  // desktop-sign-in.html is a second page, opened by the desktop app in the person's browser (not a route of the app).
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: { input: { main: path.resolve(import.meta.dirname, 'index.html'), desktopSignIn: path.resolve(import.meta.dirname, 'desktop-sign-in.html') } },
  },
  // A few user-event tests take 1-2 s alone but pass 5 s when the whole suite runs at once.
  test: { testTimeout: 15000, exclude: ["**/node_modules/**", "**/*.emulator.test.ts"] },
});
