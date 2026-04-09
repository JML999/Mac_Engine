import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VoxelCraft',
      fileName: 'voxelcraft',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
    minify: 'oxc',
    sourcemap: true,
  },
  server: {
    open: '/demo.html',
  },
});
