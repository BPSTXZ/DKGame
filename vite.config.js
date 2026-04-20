import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  base: 'DKGame',
  server: {
    port: 9527,
    host: '0.0.0.0', // 允许局域网内的其他设备通过 IP 访问
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
