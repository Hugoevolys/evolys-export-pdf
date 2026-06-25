import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';

export default defineConfig(({ mode }) => {
  // Le proxy dev suit le PORT du backend (.env) -> meme source que le serveur.
  // Defaut 3002 pour cohabiter avec un autre projet local occupant 3001.
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.PORT || '3002';
  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      port: 5173,
      proxy: { '/api': `http://localhost:${apiPort}` },
    },
  };
});
