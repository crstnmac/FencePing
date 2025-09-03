import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  dts: false,
  external: ['@geofence/shared', '@geofence/db']
});