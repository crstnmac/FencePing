import { Logger } from 'pino';
export class WebhookIntegration {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute(
    payload: any,
    config: any,
    options: any
  ): Promise<{ success: boolean; response?: number; body?: string; error?: string }> {
    if (!config?.url) {
      const error = 'Webhook URL is required';
      this.logger?.error(error);
      return { success: false, error };
    }

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers || {}),
        },
        body: JSON.stringify(payload),
      });

      const body = await response.text();

      if (response.ok) {
        return { success: true, response: response.status, body };
      } else {
        const error = `HTTP ${response.status}: ${response.statusText}`;
        this.logger?.error(error);
        return { success: false, error };
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error occurred while sending webhook';
      this.logger?.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }
}