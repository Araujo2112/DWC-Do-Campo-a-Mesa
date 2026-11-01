import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  css: { preprocessorOptions: { scss: { api: 'modern-compiler', quietDeps: true, silenceDeprecations: ['import', 'mixed-decls', 'color-functions', 'global-builtin'] } } }
});
