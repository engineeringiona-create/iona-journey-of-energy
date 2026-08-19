import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    // This project lives on a Windows-mounted path (/mnt/c/...) under
    // WSL, where inotify doesn't reliably fire for drvfs, so chokidar's
    // default watcher misses edits and Vite keeps serving stale cached
    // transforms. Polling works around it.
    watch: { usePolling: true, interval: 300 }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        hakkimizda: resolve(__dirname, 'hakkimizda.html'),
        teknoloji: resolve(__dirname, 'teknoloji.html'),
        etki: resolve(__dirname, 'etki.html'),
        iletisim: resolve(__dirname, 'iletisim.html'),
        ionaflux: resolve(__dirname, 'ionaflux.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});
