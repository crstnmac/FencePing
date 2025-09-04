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
    token: string;
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

  setStoredToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  removeStoredToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  // Authentication methods
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(credentials),
    });

    const data = await this.handleResponse<AuthResponse>(response);
    
    // Store token on successful login
    if (data.success && data.data.token) {
      this.setStoredToken(data.data.token);
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
    
    // Store token on successful registration
    if (data.success && data.data.token) {
      this.setStoredToken(data.data.token);
    }

    return data;
  }

  async me(): Promise<AuthMeResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: this.getHeaders(true),
    });

    return this.handleResponse<AuthMeResponse>(response);
  }

  async logout(): Promise<LogoutResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(true),
      });

      const data = await this.handleResponse<LogoutResponse>(response);
      
      // Always remove token locally, regardless of server response
      this.removeStoredToken();
      
      return data;
    } catch (error) {
      // Even if server logout fails, remove token locally
      this.removeStoredToken();
      throw error;
    }
  }

  // Check if user is authenticated (has valid token)
  isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }
}

// Export singleton instance
export const authService = new AuthService();