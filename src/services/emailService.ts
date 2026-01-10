/**
 * Email Delivery Service
 * Handles SMTP email delivery with attachment support
 * Requirements: 8.1, 8.2, 8.3, 8.5
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { reportLogger } from '@/utils/logger';
import { env } from '@/config/environment';

export interface EmailConfig {
  to: string[];
  cc?: string[] | undefined;
  bcc?: string[] | undefined;
  subject: string;
  text?: string | undefined;
  html?: string | undefined;
  attachments?: EmailAttachment[] | undefined;
  priority?: 'high' | 'normal' | 'low' | undefined;
  replyTo?: string | undefined;
}

export interface EmailAttachment {
  filename: string;
  path?: string | undefined;
  content?: Buffer | undefined;
  contentType?: string | undefined;
  cid?: string | undefined; // Content-ID for inline attachments
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recipients: {
    accepted: string[];
    rejected: string[];
    pending: string[];
  };
  response?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  textTemplate?: string;
  variables: string[];
}

export class EmailService {
  private transporter!: nodemailer.Transporter;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize SMTP transporter
   */
  private initializeTransporter(): void {
    try {
      // Check if SMTP is configured
      if (!env.SMTP_HOST || !env.SMTP_PORT) {
        reportLogger.warn('SMTP not configured - email service disabled');
        return;
      }

      const transportConfig: any = {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE || false, // true for 465, false for other ports
        auth: undefined,
        tls: {
          rejectUnauthorized: true // Default to secure
        }
      };

      // Add authentication if provided
      if (env.SMTP_USER && env.SMTP_PASSWORD) {
        transportConfig.auth = {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD
        };
      }

      this.transporter = nodemailer.createTransport(transportConfig);
      this.isConfigured = true;

      reportLogger.info('Email service initialized', {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: !!transportConfig.auth
      });
    } catch (error) {
      reportLogger.error('Failed to initialize email service', { error });
      this.isConfigured = false;
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.transporter.verify();
      reportLogger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      reportLogger.error('SMTP connection verification failed', { error });
      return false;
    }
  }

  /**
   * Send email
   */
  async sendEmail(config: EmailConfig): Promise<EmailResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Email service not configured',
        recipients: {
          accepted: [],
          rejected: config.to,
          pending: []
        }
      };
    }

    try {
      // Validate recipients
      if (!config.to || config.to.length === 0) {
        throw new Error('No recipients specified');
      }

      // Prepare email options
      const mailOptions: nodemailer.SendMailOptions = {
        from: env.SMTP_USER, // Use SMTP_USER as the from address
        to: config.to.join(', '),
        subject: config.subject,
        text: config.text,
        html: config.html,
        attachments: config.attachments?.map(att => ({
          filename: att.filename,
          path: att.path,
          content: att.content,
          contentType: att.contentType,
          cid: att.cid
        })),
        priority: config.priority || 'normal',
        replyTo: config.replyTo
      };

      // Add CC and BCC if provided
      if (config.cc && config.cc.length > 0) {
        mailOptions.cc = config.cc.join(', ');
      }
      if (config.bcc && config.bcc.length > 0) {
        mailOptions.bcc = config.bcc.join(', ');
      }

      reportLogger.info('Sending email', {
        to: config.to,
        cc: config.cc,
        bcc: config.bcc,
        subject: config.subject,
        attachments: config.attachments?.length || 0
      });

      const result = await this.transporter.sendMail(mailOptions);

      reportLogger.info('Email sent successfully', {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response
      });

      return {
        success: true,
        messageId: result.messageId,
        recipients: {
          accepted: result.accepted as string[],
          rejected: result.rejected as string[],
          pending: result.pending as string[]
        },
        response: result.response
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      reportLogger.error('Failed to send email', {
        error: errorMessage,
        to: config.to,
        subject: config.subject
      });

      return {
        success: false,
        error: errorMessage,
        recipients: {
          accepted: [],
          rejected: config.to,
          pending: []
        }
      };
    }
  }

  /**
   * Send email with report attachment
   */
  async sendReportEmail(
    recipients: string[],
    reportPath: string,
    reportName: string,
    customSubject?: string,
    customMessage?: string
  ): Promise<EmailResult> {
    try {
      // Verify report file exists
      if (!fs.existsSync(reportPath)) {
        throw new Error(`Report file not found: ${reportPath}`);
      }

      const fileStats = fs.statSync(reportPath);
      const fileSizeMB = fileStats.size / (1024 * 1024);

      // Check file size limit (default 25MB)
      const maxSizeMB = 25; // Default 25MB limit
      if (fileSizeMB > maxSizeMB) {
        throw new Error(`Report file too large: ${fileSizeMB.toFixed(2)}MB (max: ${maxSizeMB}MB)`);
      }

      const subject = customSubject || `Report: ${reportName} - ${new Date().toLocaleDateString()}`;
      const defaultMessage = `
        <h2>Automated Report Delivery</h2>
        <p>Please find attached the requested report: <strong>${reportName}</strong></p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>File Size:</strong> ${fileSizeMB.toFixed(2)} MB</p>
        <hr>
        <p><em>This is an automated message from the Kagome Reports system.</em></p>
      `;

      const emailConfig: EmailConfig = {
        to: recipients,
        subject,
        html: customMessage || defaultMessage,
        text: `Report: ${reportName}\nGenerated: ${new Date().toLocaleString()}\nFile Size: ${fileSizeMB.toFixed(2)} MB`,
        attachments: [
          {
            filename: path.basename(reportPath),
            path: reportPath,
            contentType: this.getContentType(reportPath)
          }
        ],
        priority: 'normal'
      };

      return await this.sendEmail(emailConfig);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      reportLogger.error('Failed to send report email', {
        error: errorMessage,
        recipients,
        reportPath,
        reportName
      });

      return {
        success: false,
        error: errorMessage,
        recipients: {
          accepted: [],
          rejected: recipients,
          pending: []
        }
      };
    }
  }

  /**
   * Send bulk emails with rate limiting
   */
  async sendBulkEmails(
    emails: EmailConfig[],
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      maxRetries?: number;
    } = {}
  ): Promise<{
    successful: number;
    failed: number;
    results: EmailResult[];
  }> {
    const {
      batchSize = 10,
      delayBetweenBatches = 1000,
      maxRetries = 3
    } = options;

    const results: EmailResult[] = [];
    let successful = 0;
    let failed = 0;

    reportLogger.info('Starting bulk email send', {
      totalEmails: emails.length,
      batchSize,
      delayBetweenBatches
    });

    // Process emails in batches
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      reportLogger.info('Processing email batch', {
        batchNumber: Math.floor(i / batchSize) + 1,
        batchSize: batch.length
      });

      // Send batch concurrently
      const batchPromises = batch.map(async (emailConfig) => {
        let lastError: string | undefined;
        
        // Retry logic
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const result = await this.sendEmail(emailConfig);
            if (result.success) {
              return result;
            } else {
              lastError = result.error;
              if (attempt < maxRetries) {
                await this.delay(1000 * attempt); // Exponential backoff
              }
            }
          } catch (error) {
            lastError = error instanceof Error ? error.message : 'Unknown error';
            if (attempt < maxRetries) {
              await this.delay(1000 * attempt);
            }
          }
        }

        // All retries failed
        return {
          success: false,
          error: lastError || 'Max retries exceeded',
          recipients: {
            accepted: [],
            rejected: emailConfig.to,
            pending: []
          }
        };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Count results
      batchResults.forEach(result => {
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      });

      // Delay between batches (except for the last batch)
      if (i + batchSize < emails.length) {
        await this.delay(delayBetweenBatches);
      }
    }

    reportLogger.info('Bulk email send completed', {
      totalEmails: emails.length,
      successful,
      failed
    });

    return {
      successful,
      failed,
      results
    };
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.doc':
        return 'application/msword';
      case '.xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case '.xls':
        return 'application/vnd.ms-excel';
      case '.csv':
        return 'text/csv';
      case '.txt':
        return 'text/plain';
      case '.html':
        return 'text/html';
      case '.json':
        return 'application/json';
      case '.zip':
        return 'application/zip';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get email service status
   */
  getStatus(): {
    configured: boolean;
    host?: string;
    port?: number;
    secure?: boolean;
    authenticated: boolean;
  } {
    return {
      configured: this.isConfigured,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      authenticated: !!(env.SMTP_USER && env.SMTP_PASSWORD)
    };
  }

  /**
   * Test email configuration
   */
  async testConfiguration(testRecipient: string): Promise<EmailResult> {
    const testConfig: EmailConfig = {
      to: [testRecipient],
      subject: 'Kagome Reports - Email Configuration Test',
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email to verify that the Kagome Reports email service is working correctly.</p>
        <p><strong>Sent:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>SMTP Host:</strong> ${env.SMTP_HOST}</p>
        <p><strong>SMTP Port:</strong> ${env.SMTP_PORT}</p>
        <p><strong>Secure:</strong> ${env.SMTP_SECURE ? 'Yes' : 'No'}</p>
        <hr>
        <p><em>If you received this email, the configuration is working correctly.</em></p>
      `,
      text: `Email Configuration Test\n\nThis is a test email to verify that the Kagome Reports email service is working correctly.\n\nSent: ${new Date().toLocaleString()}\nSMTP Host: ${env.SMTP_HOST}\nSMTP Port: ${env.SMTP_PORT}\nSecure: ${env.SMTP_SECURE ? 'Yes' : 'No'}\n\nIf you received this email, the configuration is working correctly.`,
      priority: 'normal'
    };

    return await this.sendEmail(testConfig);
  }
}

// Export singleton instance
export const emailService = new EmailService();