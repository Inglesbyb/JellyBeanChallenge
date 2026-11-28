export default {
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'vendor-three';
          if (id.includes('node_modules/matter-js')) return 'vendor-matter';
          if (id.includes('node_modules/@capacitor')) return 'vendor-capacitor';
        },
      },
    },
  },
};
