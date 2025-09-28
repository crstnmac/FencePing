import { Router } from 'express';
import { z } from 'zod';
import { query } from '@geofence/db';
import { fromNodeHeaders } from 'better-auth/node';
import { validateBody, requireAccount } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { auth as authConfig } from '../../auth.js';
import { urls } from '../config/index.js';

const router = Router();

const RegisterSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  organization_name: z.string().min(1).max(255),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Register new user and organization
router.post('/register', validateBody(RegisterSchema), async (req, res) => {
  try {
    const { name, email, password, organization_name } = req.body;

    // Check if user already exists
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUser = await query(existingUserQuery, [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Create user
      const userQuery = `
        INSERT INTO users (id, email, name, email_verified, image, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
        RETURNING id, name, email, created_at
      `;
      const userResult = await query(userQuery, [email, name, false, null]);
      const user = userResult.rows[0];

      // Create account with user as owner
      const accountQuery = `
        INSERT INTO accounts (id, name, owner_id)
        VALUES (gen_random_uuid(), $1, $2)
        RETURNING id, name, created_at
      `;
      const accountResult = await query(accountQuery, [organization_name, user.id]);
      const account = accountResult.rows[0];

      await query('COMMIT');

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            created_at: user.created_at,
          },
          organization: {
            id: account.id,
            name: account.name,
            role: 'owner',
            created_at: account.created_at,
          },
        },
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Login user
router.post('/login', validateBody(LoginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Use better-auth to sign in
    const result = await authConfig.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: fromNodeHeaders(req.headers),
    });

    if (!result.user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          created_at: result.user.createdAt,
        },
        organization: {
          id: result.user.id, // For now, use user ID as account ID
          name: 'Default Organization',
          role: 'owner',
        },
        accessToken: result.token,
        expires_in: '7d',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Logout user
router.post('/logout', requireAuth, async (req, res) => {
  try {
    // Use better-auth to sign out
    await authConfig.api.signOut({
      headers: fromNodeHeaders(req.headers),
    });

    res.json({
      success: true,
      message: 'Successfully logged out',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Get current user info
router.get('/me', requireAuth, async (req, res) => {
  try {
    // Get current session from better-auth
    const session = await authConfig.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          created_at: session.user.createdAt,
          last_login_at: session.session.createdAt,
        },
        organization: {
          id: session.user.id,
          name: 'Default Organization',
          role: 'owner',
        },
      },
    });
  } catch (error) {
    console.error('User info error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// OAuth functionality is now handled directly by Better Auth
// Social login endpoints are available at /api/auth/sign-in/social/:provider

export { router as authRoutes };
