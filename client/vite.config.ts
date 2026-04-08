import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    port: 5174,
    hmr: {
      clientPort: 443,
    },
    allowedHosts: ['.discordsays.com', 'localhost'],
  },
  build: {
    outDir: 'dist',
  },
});
