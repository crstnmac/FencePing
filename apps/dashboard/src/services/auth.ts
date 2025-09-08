const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const AUTH_TOKEN_KEY = 'auth_token';

// Types matching backend exactly
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  organization_name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  last_login_at?: string;
}

export interface Account {
  id: string;
  name: string;
  role: string;
  created_at?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    organization: Account;
    accessToken: string;
    refreshToken: string;
    expires_in: string;
  };
  error?: string;
}

export interface AuthMeResponse {
  success: boolean;
  data: {
    user: User;
    organization: Account;
  };
  error?: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    expires_in: string;
    user: User;
    organization: Account;
  };
  error?: string;
}

// Custom error class with enhanced error handling
export class AuthError extends Error {
  constructor(
    message: string, 
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AuthError';
  }

  // Check if error is due to rate limiting
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  // Check if error is due to invalid credentials
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  // Check if account is locked
  get isAccountLocked(): boolean {
    return this.status === 401 && this.message.includes('locked');
  }
}

// Enhanced auth service with proper error handling and token management
class AuthService {
  private refreshPromise: Promise<RefreshTokenResponse> | null = null;

  private getHeaders(includeAuth = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = this.getStoredToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return headers;
  }

  // Enhanced fetch with automatic token refresh
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Proactively refresh token if it's close to expiring
    await this.ensureValidToken();

    // First attempt with current token
    let response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(true),
        ...options.headers,
      },
    });

    // If unauthorized and we have a refresh token, try to refresh
    if (response.status === 401 && this.getStoredRefreshToken()) {
      try {
        // Use existing refresh promise or create new one to prevent multiple concurrent refreshes
        if (!this.refreshPromise) {
          this.refreshPromise = this.refreshToken();
        }

        await this.refreshPromise;
        this.refreshPromise = null;

        // Optional: Show success feedback (can be disabled in production)
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('✅ Token refreshed successfully');
        }

        // Retry the original request with new token
        response = await fetch(url, {
          ...options,
          headers: {
            ...this.getHeaders(true),
            ...options.headers,
          },
        });
      } catch (refreshError) {
        // Refresh failed, clear tokens and throw original error
        this.removeStoredToken();
        this.refreshPromise = null;
        throw new AuthError('Session expired. Please log in again.', 401);
      }
    }

    return response;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();

    if (!response.ok) {
      throw new AuthError(
        data.error || `Request failed with status ${response.status}`,
        response.status
      );
    }

    return data;
  }

  // Token management
  getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  getStoredRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  }

  setStoredToken(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  removeStoredToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem('refresh_token');
  }

  // Authentication methods
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(credentials),
    });

    const data = await this.handleResponse<AuthResponse>(response);
    
    // Store tokens on successful login
    if (data.success && data.data.accessToken && data.data.refreshToken) {
      this.setStoredToken(data.data.accessToken, data.data.refreshToken);
    }

    return data;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(userData),
    });

    const data = await this.handleResponse<AuthResponse>(response);
    
    // Store tokens on successful registration
    if (data.success && data.data.accessToken && data.data.refreshToken) {
      this.setStoredToken(data.data.accessToken, data.data.refreshToken);
    }

    return data;
  }

  async me(): Promise<AuthMeResponse> {
    const response = await this.authenticatedFetch(`${API_BASE_URL}/api/auth/me`);
    return this.handleResponse<AuthMeResponse>(response);
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    const refreshToken = this.getStoredRefreshToken();
    
    if (!refreshToken) {
      throw new AuthError('No refresh token available', 401);
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ refreshToken }),
    });

    const data = await this.handleResponse<RefreshTokenResponse>(response);
    
    // Store new tokens on successful refresh
    if (data.success && data.data.accessToken && data.data.refreshToken) {
      this.setStoredToken(data.data.accessToken, data.data.refreshToken);
    }

    return data;
  }

  async logout(): Promise<LogoutResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(true),
      });

      const data = await this.handleResponse<LogoutResponse>(response);
      
      // Always remove tokens locally, regardless of server response
      this.removeStoredToken();
      
      return data;
    } catch (error) {
      // Even if server logout fails, remove tokens locally
      this.removeStoredToken();
      throw error;
    }
  }

  // Check if token is close to expiring (within 5 minutes)
  private isTokenCloseToExpiry(): boolean {
    const token = this.getStoredToken();
    if (!token) return false;

    try {
      // Decode JWT token to check expiry (simple base64 decode)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      return (expiryTime - currentTime) < fiveMinutes;
    } catch {
      // If we can't decode the token, assume it's invalid
      return true;
    }
  }

  // Check if user is authenticated (has valid token)
  isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }

  // Proactively refresh token if it's close to expiring
  async ensureValidToken(): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new AuthError('No authentication token', 401);
    }

    if (this.isTokenCloseToExpiry() && this.getStoredRefreshToken()) {
      try {
        if (!this.refreshPromise) {
          this.refreshPromise = this.refreshToken();
        }
        await this.refreshPromise;
        this.refreshPromise = null;
      } catch (error) {
        // If refresh fails, clear tokens and throw
        this.removeStoredToken();
        throw new AuthError('Session expired. Please log in again.', 401);
      }
    }
  }

  // Public method for other services to use authenticated fetch
  async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    return this.authenticatedFetch(url, options);
  }
}

// Export singleton instance
export const authService = new AuthService();
