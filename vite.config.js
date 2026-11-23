import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset paths relative, so the build works on GitHub Pages
// (https://<user>.github.io/<repo>/) as well as on any other static host.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
