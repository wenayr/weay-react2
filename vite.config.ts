// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Polyfill for the Node.js path module that was used in Webpack
      'path': 'path-browserify',
    },
  },
  server: {
    host: true,        // listen on 0.0.0.0 (IPv4), not only ::1; otherwise localhost returns ERR_CONNECTION_REFUSED
    port: 3010,        // dedicated port for weay-react2 (3000 is used by another project)
    open: true,        // browser opens the correct address automatically
  },
});

