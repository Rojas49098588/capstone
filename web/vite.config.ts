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
  // A few user-event tests take 1-2 s alone but pass 5 s when the whole suite runs at once.
  test: { testTimeout: 15000 },
});
