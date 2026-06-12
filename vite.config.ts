// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Полифилл для Node.js модуля path, который использовался в Webpack
      'path': 'path-browserify',
    },
  },
  server: {
    host: true,        // слушать на 0.0.0.0 (IPv4), а не только ::1 — иначе localhost даёт ERR_CONNECTION_REFUSED
    port: 3010,        // выделенный порт для weay-react2 (3000 занят другим проектом)
    open: true,        // браузер сам откроется на нужном адресе
  },
});
