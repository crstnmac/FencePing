import { Router } from 'express';
import { z } from 'zod';
import { compareSync, hashSync } from 'bcryptjs';
import jwt, { SignOptions, Secret } from "jsonwebtoken";
import crypto from 'crypto';
import { query } from '@geofence/db';
import { validateBody, requireAccount } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { OAuthManager } from '../auth/OAuthManager.js';
import { generateSecureToken, hashData } from '../utils/encryption.js';
import { auth, urls, config } from '../config/index.js';

const router = Router();
const oauthManager = new OAuthManager();

const RegisterSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  organization_name: z.string().min(1).max(255)
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const JWT_SECRET = auth.JWT_SECRET;
const JWT_EXPIRES_IN = auth.JWT_EXPIRES_IN;

// Rate limiting for auth attempts
const authAttempts = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const attempts = authAttempts.get(identifier);

  if (!attempts || now > attempts.resetTime) {
    authAttempts.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (attempts.count >= maxAttempts) {
    return true;
  }

  attempts.count++;
  return false;
}

async function createUserSession(userId: string, accountId: string, email: string, req: any): Promise<{ token: string; sessionId: string }> {
  // Create session record first to get the UUID
  const sessionResult = await query(
    'INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address, user_agent, last_activity_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [
      userId,
      'temp', // Temporary placeholder
      new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
      req.ip || req.connection?.remoteAddress,
      req.headers['user-agent'],
      new Date()
    ]
  );

  const sessionId = sessionResult.rows[0].id;

  // Create JWT token with the actual session ID
  const token = jwt.sign(
    {
      userId,
      email,
      accountId,
      sessionId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as SignOptions
  );

  // Update session with actual token hash
  const tokenHash = hashData(token);
  await query(
    'UPDATE user_sessions SET token_hash = $1 WHERE id = $2',
    [tokenHash, sessionId]
  );

  return { token, sessionId };
}

// Register new user and organization
router.post('/register', validateBody(RegisterSchema), async (req, res) => {
  // Using query() function for automatic connection management

  try {
    const { name, email, password, organization_name } = req.body;

    // Rate limiting by IP and email
    const identifier = `${req.ip}:${email}`;
    if (isRateLimited(identifier)) {
      return res.status(429).json({
        success: false,
        error: 'Too many registration attempts. Please try again later.'
      });
    }

    // Check if user already exists
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUser = await query(existingUserQuery, [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password with higher cost for production
    const saltRounds = config.NODE_ENV === 'production' ? 14 : 12;
    const hashedPassword = hashSync(password, saltRounds);

    // Start transaction
    await query('BEGIN');

    try {
      // Create user
      const userQuery = `
        INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, created_at
      `;
      const userResult = await query(userQuery, [name, email, hashedPassword]);
      const user = userResult.rows[0];

      // Create account with user as owner
      const accountQuery = `
        INSERT INTO accounts (name, owner_id)
        VALUES ($1, $2)
        RETURNING id, name, created_at
      `;
      const accountResult = await query(accountQuery, [organization_name, user.id]);
      const account = accountResult.rows[0];

      // Create session and generate token
      const { token, sessionId } = await createUserSession(user.id, account.id, user.email, req);

      await query('COMMIT');

      // Clear rate limit on successful registration
      authAttempts.delete(identifier);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            created_at: user.created_at
          },
          organization: {
            id: account.id,
            name: account.name,
            role: 'owner',
            created_at: account.created_at
          },
          token,
          expires_in: JWT_EXPIRES_IN
        }
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {  }
});

// Login user
router.post('/login', validateBody(LoginSchema), async (req, res) => {
  // Using query() function for automatic connection management

  try {
    const { email, password } = req.body;

    // Rate limiting by IP and email
    const identifier = `${req.ip}:${email}`;
    if (isRateLimited(identifier, 10, 15 * 60 * 1000)) { // 10 attempts per 15 minutes
      return res.status(429).json({
        success: false,
        error: 'Too many login attempts. Please try again later.'
      });
    }

    // Get user with password hash, organization info, and security fields
    const queryText = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.password_hash,
        u.created_at,
        u.login_attempts,
        u.locked_until,
        a.id as account_id,
        a.name as account_name,
        'owner' as role
      FROM users u
      JOIN accounts a ON u.id = a.owner_id
      WHERE u.email = $1
    `;

    const result = await query(queryText, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      return res.status(401).json({
        success: false,
        error: 'Account temporarily locked due to multiple failed attempts'
      });
    }

    // Verify password
    if (!compareSync(password, user.password_hash)) {
      // Increment failed attempts
      const newAttempts = (user.login_attempts || 0) + 1;
      let lockUntil = null;

      if (newAttempts >= 5) {
        // Lock account for 30 minutes after 5 failed attempts
        lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + 30);
      }

      await query(
        'UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3',
        [newAttempts, lockUntil, user.id]
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    await query(
      'UPDATE users SET login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Create session and generate token
    const { token, sessionId } = await createUserSession(user.id, user.account_id, user.email, req);

    // Clear rate limit on successful login
    authAttempts.delete(identifier);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at
        },
        organization: {
          id: user.account_id,
          name: user.account_name,
          role: user.role
        },
        token,
        expires_in: JWT_EXPIRES_IN
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {  }
});

// Logout with session revocation
router.post('/logout', requireAuth, async (req, res) => {
  // Using query() function for automatic connection management

  try {
    if (req.user?.sessionId) {
      // Revoke the current session
      await query(
        'UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1',
        [req.user.sessionId]
      );
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {  }
});

// Verify token and get user info
router.get('/me', requireAuth, async (req, res) => {
  // Using query() function for automatic connection management

  try {
    const userId = req.user!.id;

    // Get current user and account info
    const queryText = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        u.last_login_at,
        a.id as account_id,
        a.name as account_name,
        'owner' as role
      FROM users u
      JOIN accounts a ON u.id = a.owner_id
      WHERE u.id = $1
    `;

    const result = await query(queryText, [userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at,
          last_login_at: user.last_login_at
        },
        organization: {
          id: user.account_id,
          name: user.account_name,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('User info error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {  }
});

// OAuth Routes

// Generate OAuth authorization URL
router.get('/oauth/:provider/authorize', requireAuth, requireAccount, async (req, res) => {
  try {
    const { provider } = req.params;
    const { integration_id } = req.query;
    const accountId = req.accountId!;

    const authUrl = oauthManager.generateAuthUrl(
      provider,
      accountId,
      integration_id as string | undefined
    );

    res.json({
      success: true,
      data: {
        authUrl,
        provider,
        accountId
      }
    });
  } catch (error) {
    console.error('OAuth authorize error:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Handle OAuth callback
router.get('/callback/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${urls.DASHBOARD_URL}/integrations?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${urls.DASHBOARD_URL}/integrations?error=missing_code_or_state`);
    }

    const result = await oauthManager.handleCallback(
      provider,
      code as string,
      state as string
    );

    // Redirect back to dashboard with success
    const redirectUrl = new URL(`${urls.DASHBOARD_URL}/integrations`);
    redirectUrl.searchParams.set('success', 'true');
    redirectUrl.searchParams.set('provider', provider);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectUrl = new URL(`${urls.DASHBOARD_URL}/integrations`);
    redirectUrl.searchParams.set('error', encodeURIComponent((error as Error).message));
    res.redirect(redirectUrl.toString());
  }
});

// Refresh OAuth tokens
router.post('/oauth/:provider/refresh', requireAuth, requireAccount, async (req, res) => {
  try {
    const { provider } = req.params;
    const accountId = req.accountId!;

    const tokens = await oauthManager.refreshTokens(provider, accountId);

    res.json({
      success: true,
      data: {
        provider,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope
      }
    });
  } catch (error) {
    console.error('OAuth refresh error:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Revoke OAuth tokens
router.delete('/oauth/:provider/revoke', requireAuth, requireAccount, async (req, res) => {
  try {
    const { provider } = req.params;
    const accountId = req.accountId!;

    await oauthManager.revokeTokens(provider, accountId);

    res.json({
      success: true,
      message: `${provider} integration revoked successfully`
    });
  } catch (error) {
    console.error('OAuth revoke error:', error);
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

export { router as authRoutes };
