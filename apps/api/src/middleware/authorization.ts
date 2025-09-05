import { Request, Response, NextFunction } from 'express';
import { query } from '@geofence/db';

export enum Permission {
  // User management
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_DELETE = 'users:delete',

  // Organization management
  ORGANIZATION_READ = 'organization:read',
  ORGANIZATION_WRITE = 'organization:write',
  ORGANIZATION_ADMIN = 'organization:admin',

  // Device management
  DEVICES_READ = 'devices:read',
  DEVICES_WRITE = 'devices:write',
  DEVICES_DELETE = 'devices:delete',

  // Geofence management
  GEOFENCES_READ = 'geofences:read',
  GEOFENCES_WRITE = 'geofences:write',
  GEOFENCES_DELETE = 'geofences:delete',

  // Integration management
  INTEGRATIONS_READ = 'integrations:read',
  INTEGRATIONS_WRITE = 'integrations:write',
  INTEGRATIONS_DELETE = 'integrations:delete',

  // Automation management
  AUTOMATIONS_READ = 'automations:read',
  AUTOMATIONS_WRITE = 'automations:write',
  AUTOMATIONS_DELETE = 'automations:delete',

  // Event and analytics
  EVENTS_READ = 'events:read',
  EVENTS_WRITE = 'events:write',
  ANALYTICS_READ = 'analytics:read',

  // API key management
  API_KEYS_READ = 'api_keys:read',
  API_KEYS_WRITE = 'api_keys:write',
  API_KEYS_DELETE = 'api_keys:delete',

  // Admin permissions
  ADMIN_ALL = 'admin:all'
}

export enum Role {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer'
}

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: Object.values(Permission), // All permissions
  [Role.ADMIN]: [
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.ORGANIZATION_READ,
    Permission.ORGANIZATION_WRITE,
    Permission.DEVICES_READ,
    Permission.DEVICES_WRITE,
    Permission.DEVICES_DELETE,
    Permission.GEOFENCES_READ,
    Permission.GEOFENCES_WRITE,
    Permission.GEOFENCES_DELETE,
    Permission.INTEGRATIONS_READ,
    Permission.INTEGRATIONS_WRITE,
    Permission.INTEGRATIONS_DELETE,
    Permission.AUTOMATIONS_READ,
    Permission.AUTOMATIONS_WRITE,
    Permission.AUTOMATIONS_DELETE,
    Permission.EVENTS_READ,
    Permission.EVENTS_WRITE,
    Permission.ANALYTICS_READ,
    Permission.API_KEYS_READ,
    Permission.API_KEYS_WRITE,
    Permission.API_KEYS_DELETE
  ],
  [Role.MEMBER]: [
    Permission.ORGANIZATION_READ,
    Permission.DEVICES_READ,
    Permission.DEVICES_WRITE,
    Permission.GEOFENCES_READ,
    Permission.GEOFENCES_WRITE,
    Permission.INTEGRATIONS_READ,
    Permission.INTEGRATIONS_WRITE,
    Permission.AUTOMATIONS_READ,
    Permission.AUTOMATIONS_WRITE,
    Permission.EVENTS_READ,
    Permission.ANALYTICS_READ
  ],
  [Role.VIEWER]: [
    Permission.ORGANIZATION_READ,
    Permission.DEVICES_READ,
    Permission.GEOFENCES_READ,
    Permission.INTEGRATIONS_READ,
    Permission.AUTOMATIONS_READ,
    Permission.EVENTS_READ,
    Permission.ANALYTICS_READ
  ]
};

/**
 * Get user's role and permissions for an organization
 */
async function getUserPermissions(userId: string, accountId: string): Promise<{ role: Role; permissions: Permission[] }> {
  // Check if user is the organization owner
  const ownerQuery = `
    SELECT 'owner' as role
    FROM accounts 
    WHERE id = $1 AND owner_id = $2
  `;

  const ownerResult = await query(ownerQuery, [accountId, userId]);

  if (ownerResult.rows.length > 0) {
    return {
      role: Role.OWNER,
      permissions: ROLE_PERMISSIONS[Role.OWNER]
    };
  }

  // For now, we only have owner role. In the future, add organization_members table
  // with roles for team members

  throw new Error('User does not have access to this organization');
}

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(...requiredPermissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id || !req.accountId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const { permissions } = await getUserPermissions(req.user.id, req.accountId);

      // Check if user has admin:all permission (bypass all checks)
      if (permissions.includes(Permission.ADMIN_ALL)) {
        return next();
      }

      // Check if user has any of the required permissions
      const hasPermission = requiredPermissions.some(permission =>
        permissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          required: requiredPermissions,
          userPermissions: permissions
        });
      }

      // Store user permissions in request for further use
      req.userPermissions = permissions;

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
  };
}

/**
 * Check if user owns a specific resource
 */
export function requireResourceOwnership(resourceType: 'device' | 'geofence' | 'integration' | 'automation') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resourceId = req.params.id || req.params.deviceId || req.params.geofenceId || req.params.integrationId;

      if (!resourceId) {
        return res.status(400).json({
          success: false,
          error: 'Resource ID required'
        });
      }

      if (!req.accountId) {
        return res.status(401).json({
          success: false,
          error: 'Organization context required'
        });
      }

      let tableName: string;

      switch (resourceType) {
        case 'device':
          tableName = 'devices';
          break;
        case 'geofence':
          tableName = 'geofences';
          break;
        case 'integration':
          tableName = 'integrations';
          break;
        case 'automation':
          tableName = 'automation_rules';
          break;
        default:
          throw new Error('Invalid resource type');
      }

      const queryText = `SELECT id FROM ${tableName} WHERE id = $1 AND account_id = $2`;
      const result = await query(queryText, [resourceId, req.accountId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: `${resourceType} not found or access denied`
        });
      }

      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
}

/**
 * Check if user can access organization data
 */
export async function canAccessOrganization(userId: string, accountId: string): Promise<boolean> {
  try {
    await getUserPermissions(userId, accountId);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Middleware for API key scope validation (alternative to user permissions)
 */
export function requireApiKeyScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.apiKey) {
      // If using API key authentication
      const hasScope = req.apiKey.scopes.includes(scope) || req.apiKey.scopes.includes('*');

      if (!hasScope) {
        return res.status(403).json({
          success: false,
          error: `Required API key scope: ${scope}`
        });
      }

      return next();
    }

    // Fall back to user permission check if no API key
    next();
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userPermissions?: Permission[];
    }
  }
}