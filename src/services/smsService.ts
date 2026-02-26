import axios from 'axios';
import { env } from '@/config/environment';
import { apiLogger } from '@/utils/logger';

export class SmsService {
    private apiUrl: string;
    private apiToken: string | undefined;

    constructor() {
        this.apiUrl = env.NOTIFICATIONS_API_URL;
        this.apiToken = env.SMS_API_TOKEN;
    }

    /**
     * Sends an SMS message to a list of phone numbers using the internal notifications API.
     * @param recipients Array of phone numbers
     * @param message Text message to be sent
     * @returns boolean indicating success or failure
     */
    async sendSms(recipients: string[], message: string): Promise<boolean> {
        if (!this.apiToken) {
            apiLogger.error('SMS_API_TOKEN is not configured for SMS notifications');
            return false;
        }

        if (!recipients || recipients.length === 0) {
            apiLogger.warn('No recipients provided for SMS notification');
            return false;
        }

        try {
            // Join array into a comma-separated string as expected by the API
            const requestData = {
                recipients: recipients.join(','),
                message: message
            };

            apiLogger.info(`Sending SMS notification to ${recipients.length} recipients`);

            const response = await axios.post(this.apiUrl, requestData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-TOKEN-AUTH': this.apiToken
                },
                timeout: 10000 // 10 seconds timeout
            });

            apiLogger.info(`SMS sent successfully. Status: ${response.status}`);
            return true;
        } catch (error: any) {
            const errorDetails = error.response ? {
                status: error.response.status,
                data: error.response.data
            } : error.message;

            apiLogger.error('Failed to send SMS notification', { error: errorDetails });
            return false;
        }
    }
}

export const smsService = new SmsService();
