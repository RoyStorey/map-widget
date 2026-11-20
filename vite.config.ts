import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    // The package build (npm run build:lib, run automatically on install from git).
    // Everything is bundled – the host app needs no other dependencies – and CSS is
    // injected at run time, so importing 'map-widget/embed' is all a host does.
    return {
      publicDir: false,
      resolve: { alias: [{ find: /^\.\/workers$/, replacement: fileURLToPath(new URL('./src/core/workers.inline.ts', import.meta.url)) }] },
      build: {
        outDir: 'dist-lib',
        target: 'es2022',
        lib: {
          entry: { index: 'src/index.ts', embed: 'src/embed/index.ts', spec: 'src/spec/index.ts' },
          formats: ['es'],
          fileName: (_format: string, name: string) => `${name}.js`,
        },
        sourcemap: false,
        chunkSizeWarningLimit: 6000,
        rollupOptions: { output: { chunkFileNames: 'chunks/[name]-[hash].js' } },
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
        input: { main: 'index.html', widget: 'widget.html', api: 'examples/api.html', embed: 'examples/embed.html' },
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
