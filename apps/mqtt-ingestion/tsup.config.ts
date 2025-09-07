import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  external: ['pg', 'pg-native', 'sqlite3', 'mysql2', 'mysql', 'oracle', 'strong-oracle', 'oracledb', 'mssql', 'better-sqlite3'],
  noExternal: ['@geofence/shared', '@geofence/db']
});