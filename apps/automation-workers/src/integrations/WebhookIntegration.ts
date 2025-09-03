import axios, { AxiosError } from 'axios';
import { Logger } from 'pino';
import crypto from 'crypto';

export class WebhookIntegration {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute(
    payload: Record<string, unknown>,
    config: Record<string, unknown>,
    credentials: Record<string, unknown>
  ): Promise<{ success: boolean; response?: unknown; attempts: number }> {
    const { 
      url, 
      method = 'POST', 
      headers = {}, 
      retries = 3, 
      timeoutMs = 15000,
      signatureSecret 
    } = config;
    const { apiKey } = credentials || {};

    if (!url) {
      throw new Error('Webhook URL is required');
    }

    return this.executeWithRetry(
      payload,
      url as string,
      method as string,
      headers as Record<string, string>,
      apiKey as string | undefined,
      signatureSecret as string | undefined,
      timeoutMs as number,
      retries as number
    );
  }

  private async executeWithRetry(
    payload: Record<string, unknown>,
    url: string,
    method: string,
    headers: Record<string, string>,
    apiKey?: string,
    signatureSecret?: string,
    timeoutMs: number = 15000,
    maxRetries: number = 3
  ): Promise<{ success: boolean; response?: unknown; attempts: number }> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.sendWebhook(
          payload, 
          url, 
          method, 
          headers, 
          apiKey, 
          signatureSecret, 
          timeoutMs
        );
        
        this.logger.info(`📤 Webhook sent to ${url} - Status: ${(result.response as any)?.status} (attempt ${attempt})`);
        return { ...result, attempts: attempt };
        
      } catch (error: any) {
        lastError = error;
        const isRetryable = this.isRetryableError(error);
        
        this.logger.warn(
          `📤 Webhook attempt ${attempt}/${maxRetries} failed for ${url}: ${error.message} (retryable: ${isRetryable})`
        );
        
        // Don't retry non-retryable errors
        if (!isRetryable || attempt === maxRetries) {
          break;
        }
        
        // Exponential backoff with jitter
        const backoffMs = this.calculateBackoffDelay(attempt);
        this.logger.debug(`⏱️ Waiting ${backoffMs}ms before retry ${attempt + 1}`);
        await this.sleep(backoffMs);
      }
    }
    
    this.logger.error(`📤 Webhook failed after ${maxRetries} attempts for ${url}: ${lastError?.message}`);
    throw lastError;
  }

  private async sendWebhook(
    payload: Record<string, unknown>,
    url: string,
    method: string,
    headers: Record<string, string>,
    apiKey?: string,
    signatureSecret?: string,
    timeoutMs: number = 15000
  ): Promise<{ success: boolean; response?: unknown }> {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'GeoFence-Webhooks/1.0',
      ...headers
    };

    if (apiKey) {
      requestHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    // Add webhook signature if secret provided
    const bodyString = JSON.stringify(payload);
    if (signatureSecret) {
      const signature = this.generateSignature(bodyString, signatureSecret);
      requestHeaders['X-Webhook-Signature'] = signature;
      requestHeaders['X-Webhook-Timestamp'] = Date.now().toString();
    }

    const response = await axios({
      method: method.toUpperCase() as any,
      url,
      headers: requestHeaders,
      data: bodyString,
      timeout: timeoutMs,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });

    // Check for success status codes
    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data
        }
      };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private generateSignature(body: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body, 'utf8');
    return `sha256=${hmac.digest('hex')}`;
  }

  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Timeout errors are retryable
    if (error.message?.includes('timeout')) {
      return true;
    }
    
    // HTTP status codes that are retryable
    if (error.response?.status) {
      const status = error.response.status;
      // 429 (rate limit), 5xx (server errors) are retryable
      return status === 429 || (status >= 500 && status < 600);
    }
    
    return false;
  }

  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s... with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Cap at 10s
    const jitter = Math.random() * 1000; // 0-1s jitter
    return baseDelay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}