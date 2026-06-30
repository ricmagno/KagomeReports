import axios from 'axios';
import { env } from '@/config/environment';
import { apiLogger } from '@/utils/logger';

export interface SmsConfig {
  apiUrl: string;
  apiToken: string;
}

export class SmsService {
  private apiUrl: string;
  private apiToken: string | undefined;

  constructor() {
    this.apiUrl = env.NOTIFICATIONS_API_URL ?? '';
    this.apiToken = env.SMS_API_TOKEN;
  }

  reconfigure(config: SmsConfig): void {
    this.apiUrl = config.apiUrl;
    this.apiToken = config.apiToken;
    apiLogger.info('SMS service reconfigured from database', { apiUrl: config.apiUrl });
  }

  get isConfigured(): boolean {
    return !!(this.apiUrl && this.apiToken);
  }

  async sendSms(recipients: string[], message: string): Promise<boolean> {
    if (!this.apiToken) {
      apiLogger.error('SMS API token is not configured');
      return false;
    }

    if (!this.apiUrl) {
      apiLogger.error('SMS API URL is not configured');
      return false;
    }

    if (!recipients || recipients.length === 0) {
      apiLogger.warn('No recipients provided for SMS notification');
      return false;
    }

    try {
      const requestData = {
        recipients: recipients.join(','),
        message: message
      };

      apiLogger.info(`Sending SMS to ${recipients.length} recipients`);

      const response = await axios.post(this.apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-TOKEN-AUTH': this.apiToken
        },
        timeout: 10000
      });

      apiLogger.info(`SMS sent successfully. Status: ${response.status}`);
      return true;
    } catch (error: any) {
      const errorDetails = error.response
        ? { status: error.response.status, data: error.response.data }
        : error.message;
      apiLogger.error('Failed to send SMS notification', { error: errorDetails });
      return false;
    }
  }
}

export const smsService = new SmsService();
