import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // React and performance optimizations
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  

  // Turbo monorepo configuration
  transpilePackages: ['@geofence/shared'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  
  // Production build configuration
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // Environment variables
  env: {
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  },

  // Webpack configuration for Node.js modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals.push({
        'utf-8-validate': 'commonjs utf-8-validate',
        'bufferutil': 'commonjs bufferutil',
      });
    }
    return config;
  },

  // ESLint configuration
  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: false
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false
  },

  // Turbopack configuration for monorepo
  turbopack: {
    root: path.join(__dirname, '../../'),
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
    resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js'],
    resolveAlias: {
      '@': path.join(__dirname, 'src'),
      '@/components': path.join(__dirname, 'src/components'),
      '@/lib': path.join(__dirname, 'src/lib')
    }
  },

  // Image optimization
  images: {
    domains: ['api.mapbox.com'],
    formats: ['image/webp', 'image/avif']
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          }
        ]
      }
    ];
  }
};

export default nextConfig;