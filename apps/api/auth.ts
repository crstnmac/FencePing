import { betterAuth } from 'better-auth';
import { getPool } from '@geofence/db';
import config from './src/config/index.js';

export const auth = betterAuth({
  database: getPool(),
  secret: config.JWT_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || config.API_BASE_URL || 'http://localhost:3001',
  basePath: '/api/auth',
  trustedOrigins: [
    'http://localhost:3000', // Frontend development
    'http://localhost:3001', // API server
    process.env.DASHBOARD_URL || 'http://localhost:3000', // Dashboard URL
    process.env.FRONTEND_URL || 'http://localhost:3000', // Frontend URL
  ],
  user: {
    modelName: 'user', // Use existing 'user' table (singular)
    additionalFields: {
      organizationName: {
        type: 'string',
        required: false,
      },
    },
  },
  session: {
    modelName: 'session', // Use existing 'session' table (singular)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  account: {
    modelName: 'account', // Use existing 'account' table (singular)
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github'],
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: config.GOOGLE_CLIENT_ID || '',
      clientSecret: config.GOOGLE_CLIENT_SECRET || '',
    },
    github: {
      clientId: config.GITHUB_CLIENT_ID || '',
      clientSecret: config.GITHUB_CLIENT_SECRET || '',
    },
  },
});

export default auth;