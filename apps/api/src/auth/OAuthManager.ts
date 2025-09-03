import crypto from 'crypto';
import { URLSearchParams } from 'url';
import axios from 'axios';
import { getDbClient } from '../db/client.js';
import { encryptCredentials, decryptCredentials } from '../utils/encryption.js';
import { oauth, urls } from '../config/index.js';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
}

export class OAuthManager {
  private configs: Map<string, OAuthConfig> = new Map();

  constructor() {
    this.initializeConfigs();
  }

  private initializeConfigs() {
    // Google Sheets OAuth Config
    if (oauth.GOOGLE_CLIENT_ID && oauth.GOOGLE_CLIENT_SECRET) {
      this.configs.set('google_sheets', {
        clientId: oauth.GOOGLE_CLIENT_ID,
        clientSecret: oauth.GOOGLE_CLIENT_SECRET,
        redirectUri: `${urls.API_BASE_URL}/auth/callback/google`,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token'
      });
    }

    // Notion OAuth Config
    if (oauth.NOTION_CLIENT_ID && oauth.NOTION_CLIENT_SECRET) {
      this.configs.set('notion', {
        clientId: oauth.NOTION_CLIENT_ID,
        clientSecret: oauth.NOTION_CLIENT_SECRET,
        redirectUri: `${urls.API_BASE_URL}/auth/callback/notion`,
        scopes: ['read_content', 'update_content'],
        authUrl: 'https://api.notion.com/v1/oauth/authorize',
        tokenUrl: 'https://api.notion.com/v1/oauth/token'
      });
    }

    // Slack OAuth Config
    if (oauth.SLACK_CLIENT_ID && oauth.SLACK_CLIENT_SECRET) {
      this.configs.set('slack', {
        clientId: oauth.SLACK_CLIENT_ID,
        clientSecret: oauth.SLACK_CLIENT_SECRET,
        redirectUri: `${urls.API_BASE_URL}/auth/callback/slack`,
        scopes: ['chat:write', 'chat:write.public'],
        authUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access'
      });
    }
  }

  generateAuthUrl(provider: string, organizationId: string, integrationId?: string): string {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`OAuth provider '${provider}' not configured`);
    }

    const state = this.generateState(organizationId, provider, integrationId);
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      response_type: 'code',
      state,
      access_type: 'offline', // For Google to get refresh token
      prompt: 'consent' // Force consent to get refresh token
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  async handleCallback(
    provider: string, 
    code: string, 
    state: string
  ): Promise<{ organizationId: string; integrationId?: string; tokens: OAuthTokens }> {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`OAuth provider '${provider}' not configured`);
    }

    // Verify and decode state
    const stateData = this.verifyState(state);
    
    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(provider, code, config);
    
    // Store tokens in database
    await this.storeTokens(stateData.organizationId, provider, tokens, stateData.integrationId);

    return {
      organizationId: stateData.organizationId,
      integrationId: stateData.integrationId,
      tokens
    };
  }

  async refreshTokens(provider: string, organizationId: string): Promise<OAuthTokens> {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`OAuth provider '${provider}' not configured`);
    }

    // Get existing tokens from database
    const client = await getDbClient();
    const tokenQuery = `
      SELECT credentials, security_metadata, id as automation_id
      FROM automations
      WHERE account_id = $1
      AND kind = $2
      AND credentials IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const tokenResult = await client.query(tokenQuery, [organizationId, provider]);
    
    if (tokenResult.rows.length === 0) {
      throw new Error(`No integration found for ${provider}`);
    }

    const row = tokenResult.rows[0];
    let credentials;
    
    try {
      // Decrypt credentials if they are encrypted
      const securityMetadata = row.security_metadata || {};
      if (securityMetadata.encrypted) {
        credentials = decryptCredentials(row.credentials);
      } else {
        // Legacy unencrypted credentials
        credentials = typeof row.credentials === 'string' ? JSON.parse(row.credentials) : row.credentials;
      }
    } catch (error) {
      throw new Error(`Failed to decrypt credentials for ${provider}`);
    }
    
    const refreshToken = credentials.refresh_token;
    const automationId = row.automation_id;

    if (!refreshToken) {
      throw new Error(`No refresh token available for ${provider}`);
    }

    // Refresh the tokens
    const newTokens = await this.refreshAccessToken(provider, refreshToken, config);
    
    // Store updated tokens
    await this.storeTokens(organizationId, provider, newTokens, automationId);

    return newTokens;
  }

  private generateState(organizationId: string, provider: string, integrationId?: string): string {
    const data = {
      organizationId,
      provider,
      integrationId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    };

    const stateString = JSON.stringify(data);
    return Buffer.from(stateString).toString('base64url');
  }

  private verifyState(state: string): { organizationId: string; provider: string; integrationId?: string } {
    try {
      const stateString = Buffer.from(state, 'base64url').toString('utf-8');
      const data = JSON.parse(stateString);

      // Check if state is not too old (15 minutes)
      const maxAge = 15 * 60 * 1000;
      if (Date.now() - data.timestamp > maxAge) {
        throw new Error('OAuth state expired');
      }

      return {
        organizationId: data.organizationId,
        provider: data.provider,
        integrationId: data.integrationId
      };
    } catch (error) {
      throw new Error('Invalid OAuth state');
    }
  }

  private async exchangeCodeForTokens(
    provider: string, 
    code: string, 
    config: OAuthConfig
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code'
    });

    try {
      const response = await axios.post(config.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      const data = response.data;
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        scope: data.scope
      };
    } catch (error: any) {
      throw new Error(`Failed to exchange code for tokens: ${error.response?.data?.error || error.message}`);
    }
  }

  private async refreshAccessToken(
    provider: string,
    refreshToken: string,
    config: OAuthConfig
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    try {
      const response = await axios.post(config.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      const data = response.data;
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
        tokenType: data.token_type || 'Bearer',
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
        scope: data.scope
      };
    } catch (error: any) {
      throw new Error(`Failed to refresh access token: ${error.response?.data?.error || error.message}`);
    }
  }

  private async storeTokens(
    organizationId: string,
    provider: string,
    tokens: OAuthTokens,
    integrationId?: string
  ): Promise<void> {
    const client = await getDbClient();
    
    const credentials = {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: tokens.tokenType,
      expires_at: tokens.expiresAt?.toISOString(),
      scope: tokens.scope
    };

    // Encrypt credentials before storing
    const encryptedCredentials = encryptCredentials(credentials);
    
    // Store metadata about encryption for key rotation
    const securityMetadata = {
      encrypted: true,
      encryption_version: '1',
      encrypted_at: new Date().toISOString()
    };

    if (integrationId) {
      // Update existing automation
      await client.query(
        'UPDATE automations SET credentials = $1, security_metadata = $2, updated_at = NOW() WHERE id = $3 AND account_id = $4',
        [encryptedCredentials, JSON.stringify(securityMetadata), integrationId, organizationId]
      );
    } else {
      // Create new automation or update existing one
      const upsertQuery = `
        INSERT INTO automations (name, kind, account_id, credentials, security_metadata, config, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, '{}', NOW(), NOW())
        ON CONFLICT (account_id, kind)
        DO UPDATE SET
          credentials = $4,
          security_metadata = $5,
          updated_at = NOW()
      `;

      await client.query(upsertQuery, [
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} Integration`,
        provider,
        organizationId,
        encryptedCredentials,
        JSON.stringify(securityMetadata)
      ]);
    }
  }

  async revokeTokens(provider: string, organizationId: string): Promise<void> {
    const client = await getDbClient();
    
    // First, get the current credentials so we can revoke them with the provider
    const result = await client.query(
      'SELECT credentials, security_metadata FROM automations WHERE account_id = $1 AND kind = $2',
      [organizationId, provider]
    );

    if (result.rows.length > 0 && result.rows[0].credentials) {
      let credentials;

      try {
        // Decrypt credentials if they are encrypted
        const securityMetadata = result.rows[0].security_metadata || {};
        if (securityMetadata.encrypted) {
          credentials = decryptCredentials(result.rows[0].credentials);
        } else {
          // Legacy unencrypted credentials
          credentials = typeof result.rows[0].credentials === 'string'
            ? JSON.parse(result.rows[0].credentials)
            : result.rows[0].credentials;
        }
      } catch (error) {
        console.error(`Failed to decrypt credentials for revocation:`, error);
        credentials = null;
      }

      // Call provider's revoke endpoint if available
      if (credentials) {
        try {
          await this.revokeWithProvider(provider, credentials);
        } catch (error) {
          console.error(`Failed to revoke tokens with ${provider} provider:`, error);
          // Continue with database cleanup even if provider revocation fails
        }
      }
    }

    // Remove credentials from database and mark as inactive
    await client.query(
      'UPDATE automations SET credentials = NULL, security_metadata = \'{"revoked": true, "revoked_at": "' + new Date().toISOString() + '"}\', enabled = false WHERE account_id = $1 AND kind = $2',
      [organizationId, provider]
    );
  }

  private async revokeWithProvider(provider: string, credentials: any): Promise<void> {
    const axios = (await import('axios')).default;
    
    switch (provider) {
      case 'google_sheets':
        // Google OAuth 2.0 revoke endpoint
        if (credentials.access_token) {
          await axios.post('https://oauth2.googleapis.com/revoke', null, {
            params: { token: credentials.access_token },
            timeout: 5000
          });
          console.log('✅ Google tokens revoked');
        }
        break;
        
      case 'notion':
        // Notion doesn't have a public revoke endpoint
        // The access token will naturally expire or can be revoked in Notion's admin panel
        console.log('ℹ️ Notion tokens marked as inactive (no public revoke endpoint)');
        break;
        
      case 'slack':
        // Slack OAuth revoke endpoint
        if (credentials.access_token) {
          await axios.post('https://slack.com/api/auth.revoke', 
            { token: credentials.access_token },
            {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              timeout: 5000
            }
          );
          console.log('✅ Slack tokens revoked');
        }
        break;
        
      default:
        console.log(`ℹ️ No revoke endpoint configured for provider: ${provider}`);
    }
  }
}
