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
    build: {
      target: 'es2022',
      sourcemap: true,
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        input: { main: 'index.html', lesson: 'lesson.html', api: 'examples/api.html', embed: 'examples/embed.html' },
        output: {
          // separate long-lived vendor chunks: better caching + parallel download
          manualChunks(id: string) {
            if (id.includes('node_modules/maplibre-gl')) return 'maplibre';
            if (id.includes('@deck.gl/aggregation-layers')) return; // lazy-loaded on demand
            if (id.includes('node_modules/@deck.gl') || id.includes('node_modules/@luma.gl') || id.includes('node_modules/@math.gl') || id.includes('node_modules/@loaders.gl')) return 'deckgl';
            if (id.includes('node_modules/h3-js')) return 'h3';
          },
        },
      },
    },
    worker: { format: 'es' },
  };
});
