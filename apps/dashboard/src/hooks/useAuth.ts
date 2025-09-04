// Re-export the useAuth hook from the auth context
// This maintains backward compatibility while consolidating auth logic
export { useAuth } from '../contexts/AuthContext';

// Export types for convenience
export type { User, Account, LoginRequest, RegisterRequest } from '../services/auth';