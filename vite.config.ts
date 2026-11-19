import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    return {
      build: {
        outDir: 'dist-lib',
        lib: { entry: 'src/index.ts', name: 'MapWidget', formats: ['es'], fileName: 'map-widget' },
        sourcemap: true,
      },
      worker: { format: 'es' },
    };
  }
  return {
    base: './',
    build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 4000 },
    worker: { format: 'es' },
  };
});
