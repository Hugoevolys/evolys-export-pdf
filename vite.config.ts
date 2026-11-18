import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    // VITE_PROXY_CIBLE : seulement pour tester en local à côté de l'API Evolys (qui prend déjà 3001).
    proxy: { '/api': process.env.VITE_PROXY_CIBLE ?? 'http://localhost:3001' },
  },
});
