import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
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
        duyurular: resolve(__dirname, 'duyurular.html'),
        'hizmet_biyogaz_tesisi_tasarimi': resolve(__dirname, 'hizmetler/biyogaz-tesisi-tasarimi.html'),
        'hizmet_anahtar_teslim_epc': resolve(__dirname, 'hizmetler/anahtar-teslim-epc.html'),
        'hizmet_tesis_optimizasyonu': resolve(__dirname, 'hizmetler/tesis-optimizasyonu.html'),
        'hizmet_gaz_aritma_biyometan': resolve(__dirname, 'hizmetler/gaz-aritma-biyometan.html'),
        'hizmet_digestat_ayirma': resolve(__dirname, 'hizmetler/digestat-ayirma.html'),
        'hizmet_kurutma_uniteleri': resolve(__dirname, 'hizmetler/kurutma-uniteleri.html'),
        'hizmet_koku_giderme': resolve(__dirname, 'hizmetler/koku-giderme.html'),
        'hizmet_substrat_hazirlama': resolve(__dirname, 'hizmetler/substrat-hazirlama.html'),
        'hizmet_mikro_orc': resolve(__dirname, 'hizmetler/mikro-orc.html'),
        'hizmet_teknik_danismanlik': resolve(__dirname, 'hizmetler/teknik-danismanlik.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});

