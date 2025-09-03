# Configuration Management

## Overview

The application uses a centralized configuration system that loads and validates all environment variables in one place, providing type-safe access to configuration throughout the codebase.

## Architecture

### Centralized Config Module
- **Location**: `apps/api/src/config/index.ts`
- **Purpose**: Single source of truth for all environment variables
- **Features**: 
  - Environment variable validation
  - Type safety with TypeScript interface
  - Organized exports by domain
  - Clear error messages for missing variables

### Key Benefits
1. **Validation at startup** - Application fails fast if required env vars are missing
2. **Type safety** - All config values are typed and validated
3. **Single import** - No more scattered `dotenv.config()` calls
4. **Organized access** - Config grouped by domain (auth, database, oauth, etc.)
5. **Clear dependencies** - All required variables documented in one place

## Configuration Structure

```typescript
// Main config object with all settings
export const config: Config

// Domain-specific exports for convenience
export const auth = {
  JWT_SECRET: string,
  JWT_EXPIRES_IN: string,
  ENCRYPTION_KEY: string
}

export const database = {
  DATABASE_URL: string
}

export const oauth = {
  NOTION_CLIENT_ID?: string,
  NOTION_CLIENT_SECRET?: string,
  // ... other OAuth providers
}

export const urls = {
  API_BASE_URL: string,
  DASHBOARD_URL: string,
  ALLOWED_ORIGINS: string[]
}
```

## Usage Examples

### Basic Import
```typescript
import { config } from '../config/index.js';
console.log('Running in:', config.NODE_ENV);
```

### Domain-Specific Import
```typescript
import { auth, database } from '../config/index.js';

const JWT_SECRET = auth.JWT_SECRET;
const dbUrl = database.DATABASE_URL;
```

### In Middleware
```typescript
// Before (scattered, error-prone)
import dotenv from 'dotenv';
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET; // Could be undefined!

// After (centralized, type-safe)
import { auth } from '../config/index.js';
const JWT_SECRET = auth.JWT_SECRET; // Always defined, validated at startup
```

## Required Environment Variables

The following environment variables are **required** and the application will fail to start without them:

- `JWT_SECRET` - Must be at least 32 characters long
- `ENCRYPTION_KEY` - Must be exactly 64 hex characters (32 bytes)
- `DATABASE_URL` - PostgreSQL connection string

## Environment File Setup

### Development
Ensure your `.env` file in the project root contains:

```bash
# Required
JWT_SECRET=your-jwt-secret-key-change-in-production-must-be-at-least-32-characters-long-for-security
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
DATABASE_URL="postgresql://user:pass@localhost:5432/geofence"

# API Configuration
API_BASE_URL=http://localhost:3001
DASHBOARD_URL=http://localhost:3000

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Production
1. Generate a cryptographically secure JWT secret (64+ characters)
2. Generate a 64-character hex encryption key
3. Use SSL-enabled database URL
4. Set appropriate CORS origins
5. Configure OAuth provider credentials

## Migration Guide

### Files Updated
- `apps/api/src/middleware/auth.ts` - Uses centralized auth config
- `apps/api/src/utils/encryption.ts` - Uses centralized encryption key
- `apps/api/src/auth/OAuthManager.ts` - Uses centralized OAuth config
- `apps/api/src/routes/auth.ts` - Uses centralized config for JWT and URLs
- `apps/api/src/middleware/security.ts` - Uses centralized CORS origins

### Before vs After

**Before (problematic):**
```typescript
// Scattered across multiple files
import dotenv from 'dotenv';
dotenv.config(); // Called multiple times

const JWT_SECRET = process.env.JWT_SECRET || 'fallback'; // Insecure fallback
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET'); // Runtime check
}
```

**After (robust):**
```typescript
// Single place for all config
import { auth } from '../config/index.js';
const JWT_SECRET = auth.JWT_SECRET; // Already validated at startup
```

## Error Handling

### Startup Validation
The config module validates all required environment variables at startup:

```
❌ Error: Missing required environment variables: JWT_SECRET, ENCRYPTION_KEY
❌ Error: JWT_SECRET must be at least 32 characters long
❌ Error: ENCRYPTION_KEY must be exactly 64 characters (32 bytes hex)
```

### Runtime Safety
With centralized config, runtime environment variable access is eliminated, preventing common issues:
- No more `undefined` environment variables
- No more scattered validation logic
- Clear error messages at startup
- Type safety throughout the application

## Best Practices

1. **Import what you need**: Use domain-specific imports for better tree-shaking
2. **Never fallback**: Required variables should fail fast, not use defaults
3. **Validate early**: All validation happens at startup, not during request processing
4. **Type everything**: The config interface ensures type safety
5. **Document dependencies**: All required variables are clear in the config module

## Security Considerations

- Environment variables are validated for security requirements (length, format)
- No secrets are logged or exposed in error messages
- Config validation happens before any request processing
- Type safety prevents accidental exposure of undefined values