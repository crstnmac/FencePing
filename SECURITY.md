# Security Implementation Guide

This document outlines the comprehensive security measures implemented in the GeoFence application.

## 🔒 Authentication & Authorization

### JWT-Based Authentication
- **Secure JWT implementation** with mandatory 32+ character secrets
- **Session management** with database-backed token tracking
- **Automatic session expiration** and revocation
- **Account lockout** after 5 failed login attempts (30-minute lockout)
- **Rate limiting** on authentication endpoints

### Authorization System
- **Role-based access control (RBAC)** with granular permissions
- **Resource ownership validation** for all operations
- **API key authentication** for external/device access
- **Scope-based permissions** for API keys

### Password Security
- **bcrypt hashing** with configurable salt rounds (14 for production)
- **Minimum password requirements** enforced client and server-side
- **No plaintext storage** of any credentials

## 🔐 Data Encryption

### OAuth Credential Protection
- **AES-256-GCM encryption** for all OAuth tokens
- **Unique initialization vectors** for each encryption operation
- **Authentication tags** to prevent tampering
- **Key rotation support** with version tracking

### Database Security
- **Encrypted sensitive fields** using application-level encryption
- **SQL injection prevention** with parameterized queries
- **Database connection encryption** in production

## 🛡️ API Security

### Rate Limiting
- **Global rate limiting** (100 requests per 15 minutes per IP)
- **Authentication-specific limits** (5-10 attempts per 15 minutes)
- **API key rate limiting** (1000 requests per hour per key)

### Security Headers
- **Helmet.js integration** for comprehensive header security
- **Content Security Policy (CSP)** to prevent XSS
- **HTTP Strict Transport Security (HSTS)** for HTTPS enforcement
- **X-Frame-Options** to prevent clickjacking
- **X-Content-Type-Options** to prevent MIME sniffing

### Input Validation
- **Zod schema validation** for all request bodies
- **SQL injection prevention** with parameterized queries
- **XSS prevention** through input sanitization
- **Path traversal protection** with suspicious pattern blocking

## 🔍 Monitoring & Logging

### Security Event Logging
- **Authentication attempts** (success/failure) with IP tracking
- **API key usage** monitoring and statistics
- **Suspicious request patterns** detection and blocking
- **Rate limit violations** logging

### Audit Trail
- **Immutable event logging** in dedicated audit tables
- **User action tracking** for all sensitive operations
- **Session lifecycle logging** (creation, usage, expiration)

## 🚀 Production Deployment Security

### Environment Configuration
```bash
# Required secure environment variables
JWT_SECRET=your-64-character-secure-random-string-here
ENCRYPTION_KEY=your-64-character-hex-encryption-key-here
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
NODE_ENV=production
```

### SSL/TLS Configuration
- **HTTPS enforcement** in production
- **SSL certificate validation** for all external connections
- **TLS 1.2+ only** for database connections

### Database Security
- **Connection pooling** with secure configurations
- **SSL-required connections** in production
- **Regular security updates** for PostgreSQL
- **Principle of least privilege** for database users

## 📋 Security Checklist

### Pre-Production Checklist
- [ ] Generate secure JWT secret (64+ characters)
- [ ] Generate encryption key for sensitive data
- [ ] Configure HTTPS with valid SSL certificates
- [ ] Set up proper CORS origins
- [ ] Enable database SSL connections
- [ ] Configure secure headers (Helmet.js)
- [ ] Set up monitoring and alerting
- [ ] Run security audit tools

### Runtime Security
- [ ] Monitor failed authentication attempts
- [ ] Track API key usage and anomalies
- [ ] Log security-relevant events
- [ ] Regular security updates
- [ ] Backup encrypted data securely

## 🔧 API Key Management

### Creating API Keys
```typescript
// Only organization owners can create API keys
POST /api/keys
{
  "name": "Device Integration",
  "scopes": ["devices:read", "devices:write", "events:write"],
  "expires_in_days": 90
}
```

### Available Scopes
- `devices:read` - Read device information
- `devices:write` - Create/update devices
- `events:read` - Read location events
- `events:write` - Create location events
- `geofences:read` - Read geofence data
- `geofences:write` - Create/update geofences
- `integrations:read` - Read integration status
- `automations:read` - Read automation rules
- `*` - Full access (admin only)

## 🚨 Incident Response

### Security Incident Handling
1. **Immediate Response**
   - Revoke compromised API keys/sessions
   - Block suspicious IP addresses
   - Enable additional logging

2. **Investigation**
   - Review audit logs and security events
   - Identify scope of potential breach
   - Document timeline and affected resources

3. **Recovery**
   - Rotate compromised secrets
   - Update security measures
   - Notify affected users if required

### Emergency Procedures
```bash
# Revoke all sessions for a user
UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = 'user-id';

# Disable all API keys for an organization
UPDATE api_keys SET is_active = false WHERE organization_id = 'org-id';

# Block IP address (application-level)
# Add to blocked IPs list in rate limiting middleware
```

## 📚 Security Best Practices

### Development
- Never commit secrets to version control
- Use secure defaults in all configurations
- Regular dependency updates and security audits
- Code review for security-sensitive changes

### Operations
- Regular backups with encryption at rest
- Monitor for security updates and CVEs
- Implement proper logging and alerting
- Regular penetration testing

### Data Handling
- Encrypt sensitive data at rest
- Use secure connections for all data transit
- Implement data retention policies
- Secure credential storage and rotation

## 🔗 Security Dependencies

### Core Security Libraries
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT token handling
- `helmet` - Security headers
- `crypto` (Node.js built-in) - Encryption operations

### Security Middleware Stack
1. **CORS** - Cross-origin request handling
2. **Helmet** - Security headers
3. **Rate Limiting** - Request throttling
4. **Authentication** - JWT validation
5. **Authorization** - Permission checking
6. **Input Validation** - Request sanitization

## 📞 Security Contact

For security-related issues or to report vulnerabilities:
- Create a private security issue in the repository
- Follow responsible disclosure practices
- Include detailed reproduction steps
- Allow reasonable time for fixes before public disclosure

---

**Note**: This security implementation follows industry best practices and provides defense-in-depth protection. Regular security audits and updates are recommended.