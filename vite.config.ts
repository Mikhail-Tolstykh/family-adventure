import { defineConfig } from 'vite';

// base './' makes the build work from any sub-path (GitHub Pages serves /family-adventure/).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
