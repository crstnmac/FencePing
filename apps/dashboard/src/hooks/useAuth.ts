// Re-export the Better Auth hook as useAuth for compatibility
// This maintains backward compatibility while using Better Auth
export { useBetterAuth as useAuth } from './useBetterAuth';

// Export types for convenience
export type { User, AuthError } from './useBetterAuth';