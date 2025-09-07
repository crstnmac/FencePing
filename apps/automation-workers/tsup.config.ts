import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  dts: false,
  external: ['pg', 'pg-native', 'sqlite3', 'mysql2', 'mysql', 'oracle', 'strong-oracle', 'oracledb', 'mssql', 'better-sqlite3'],
  noExternal: ['@geofence/shared', '@geofence/db']
});