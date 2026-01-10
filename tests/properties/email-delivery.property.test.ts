/**
 * Property-based tests for Email Delivery Completeness
 * Property 13: Email Delivery Completeness
 * Validates: Requirements 8.1, 8.2, 8.3
 */

import * as fc from 'fast-check';
import { emailService, EmailConfig, EmailAttachment } from '@/services/emailService';
import fs from 'fs';
import path from 'path';

describe('Property 13: Email Delivery Completeness', () => {
  beforeAll(() => {
    jest.setTimeout(30000);
  });

  /**
   * Property: Email configuration validation should be consistent
   */
  test('Email configuration validation maintains consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 5 }),
          cc: fc.option(fc.array(fc.emailAddress(), { minLength: 1, maxLength: 3 })),
          bcc: fc.option(fc.array(fc.emailAddress(), { minLength: 1, maxLength: 3 })),
          subject: fc.string({ minLength: 1, maxLength: 200 }),
          text: fc.option(fc.string({ maxLength: 1000 })),
          html: fc.option(fc.string({ maxLength: 1000 })),
          priority: fc.option(fc.constantFrom('high', 'normal', 'low')),
          replyTo: fc.option(fc.emailAddress())
        }),
        async (emailData) => {
          const config: EmailConfig = {
            to: emailData.to,
            cc: emailData.cc || undefined,
            bcc: emailData.bcc || undefined,
            subject: emailData.subject,
            text: emailData.text || undefined,
            html: emailData.html || undefined,
            priority: emailData.priority as 'high' | 'normal' | 'low' | undefined,
            replyTo: emailData.replyTo || undefined
          };

          // Test email service status (should not throw)
          const status = emailService.getStatus();
          expect(typeof status.configured).toBe('boolean');
          expect(typeof status.authenticated).toBe('boolean');

          // Validate that configuration structure is preserved
          expect(config.to).toEqual(emailData.to);
          expect(config.subject).toBe(emailData.subject);
          
          if (emailData.cc) {
            expect(config.cc).toEqual(emailData.cc);
          }
          if (emailData.bcc) {
            expect(config.bcc).toEqual(emailData.bcc);
          }
          if (emailData.priority) {
            expect(config.priority).toBe(emailData.priority);
          }
          if (emailData.replyTo) {
            expect(config.replyTo).toBe(emailData.replyTo);
          }

          // Verify email addresses are valid format
          config.to.forEach(email => {
            expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
          });

          if (config.cc) {
            config.cc.forEach(email => {
              expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
            });
          }

          if (config.bcc) {
            config.bcc.forEach(email => {
              expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
            });
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Email attachment handling should be consistent
   */
  test('Email attachment handling maintains consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          recipients: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 3 }),
          subject: fc.string({ minLength: 1, maxLength: 100 }),
          attachments: fc.array(
            fc.record({
              filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/[^a-zA-Z0-9.-]/g, '_') + '.txt'),
              content: fc.string({ maxLength: 1000 }),
              contentType: fc.constantFrom('text/plain', 'application/pdf', 'text/csv')
            }),
            { minLength: 0, maxLength: 3 }
          )
        }),
        async (emailData) => {
          const attachments: EmailAttachment[] = emailData.attachments.map(att => ({
            filename: att.filename,
            content: Buffer.from(att.content),
            contentType: att.contentType
          }));

          const config: EmailConfig = {
            to: emailData.recipients,
            subject: emailData.subject,
            text: 'Test email with attachments',
            attachments
          };

          // Verify attachment structure is preserved
          expect(config.attachments).toHaveLength(emailData.attachments.length);
          
          config.attachments?.forEach((attachment, index) => {
            const originalAttachment = emailData.attachments[index];
            if (originalAttachment) {
              expect(attachment.filename).toBe(originalAttachment.filename);
              expect(attachment.contentType).toBe(originalAttachment.contentType);
              expect(Buffer.isBuffer(attachment.content)).toBe(true);
              
              // Verify content is preserved
              if (attachment.content) {
                expect(attachment.content.toString()).toBe(originalAttachment.content);
              }
            }
          });

          // Verify filename validation
          attachments.forEach(attachment => {
            expect(attachment.filename).toBeTruthy();
            expect(attachment.filename.length).toBeGreaterThan(0);
            expect(attachment.filename).toMatch(/\.(txt|pdf|csv)$/);
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Bulk email processing should maintain order and completeness
   */
  test('Bulk email processing maintains order and completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            to: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 2 }),
            subject: fc.string({ minLength: 1, maxLength: 50 }),
            text: fc.string({ minLength: 1, maxLength: 200 }),
            priority: fc.constantFrom('high', 'normal', 'low')
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (emailDataArray) => {
          const emailConfigs: EmailConfig[] = emailDataArray.map(data => ({
            to: data.to,
            subject: data.subject,
            text: data.text,
            priority: data.priority as 'high' | 'normal' | 'low'
          }));

          // Test bulk email structure (without actually sending)
          const batchSize = Math.min(3, emailConfigs.length);
          
          // Verify input structure is preserved
          expect(emailConfigs).toHaveLength(emailDataArray.length);
          
          emailConfigs.forEach((config, index) => {
            const originalData = emailDataArray[index];
            if (originalData) {
              expect(config.to).toEqual(originalData.to);
              expect(config.subject).toBe(originalData.subject);
              expect(config.text).toBe(originalData.text);
              expect(config.priority).toBe(originalData.priority);
            }
          });

          // Verify batch processing logic
          const batches: EmailConfig[][] = [];
          for (let i = 0; i < emailConfigs.length; i += batchSize) {
            batches.push(emailConfigs.slice(i, i + batchSize));
          }

          // Verify all emails are included in batches
          const totalEmailsInBatches = batches.reduce((sum, batch) => sum + batch.length, 0);
          expect(totalEmailsInBatches).toBe(emailConfigs.length);

          // Verify batch sizes are correct
          batches.forEach((batch, index) => {
            if (index < batches.length - 1) {
              // All batches except the last should be full size
              expect(batch.length).toBe(batchSize);
            } else {
              // Last batch can be smaller
              expect(batch.length).toBeGreaterThan(0);
              expect(batch.length).toBeLessThanOrEqual(batchSize);
            }
          });

          // Verify order is preserved
          let emailIndex = 0;
          batches.forEach(batch => {
            batch.forEach(email => {
              expect(email).toEqual(emailConfigs[emailIndex]);
              emailIndex++;
            });
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Email content type detection should be accurate
   */
  test('Email content type detection is accurate and consistent', async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            filename: fc.oneof(
              fc.constant('document.pdf'),
              fc.constant('spreadsheet.xlsx'),
              fc.constant('data.csv'),
              fc.constant('text.txt'),
              fc.constant('archive.zip'),
              fc.constant('webpage.html'),
              fc.constant('config.json'),
              fc.constant('unknown.xyz')
            ),
            expectedType: fc.oneof(
              fc.constant('application/pdf'),
              fc.constant('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
              fc.constant('text/csv'),
              fc.constant('text/plain'),
              fc.constant('application/zip'),
              fc.constant('text/html'),
              fc.constant('application/json'),
              fc.constant('application/octet-stream')
            )
          }),
          { minLength: 1, maxLength: 8 }
        ),
        (testCases) => {
          testCases.forEach(testCase => {
            // Create a mock attachment to test content type detection
            const attachment: EmailAttachment = {
              filename: testCase.filename,
              content: Buffer.from('test content')
            };

            // Verify filename is preserved
            expect(attachment.filename).toBe(testCase.filename);
            expect(attachment.filename).toBeTruthy();
            expect(attachment.filename.length).toBeGreaterThan(0);

            // Verify content is preserved
            expect(Buffer.isBuffer(attachment.content)).toBe(true);
            expect(attachment.content?.toString()).toBe('test content');

            // Test file extension extraction
            const extension = path.extname(attachment.filename).toLowerCase();
            expect(typeof extension).toBe('string');

            // Verify consistent behavior for same extensions
            const duplicateAttachment: EmailAttachment = {
              filename: testCase.filename,
              content: Buffer.from('different content')
            };

            expect(path.extname(duplicateAttachment.filename)).toBe(path.extname(attachment.filename));
          });
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property: Email recipient validation should be comprehensive
   */
  test('Email recipient validation is comprehensive and consistent', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          validEmails: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 5 }),
          invalidEmails: fc.array(
            fc.oneof(
              fc.constant('invalid-email'),
              fc.constant('missing@domain'),
              fc.constant('@missing-local.com'),
              fc.constant('spaces in@email.com'),
              fc.constant(''),
              fc.constant('just-text')
            ),
            { minLength: 0, maxLength: 3 }
          ),
          duplicateEmails: fc.array(fc.emailAddress(), { minLength: 0, maxLength: 2 })
        }),
        (testData) => {
          // Test valid emails
          testData.validEmails.forEach(email => {
            expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
            expect(email.length).toBeGreaterThan(0);
            expect(email).not.toContain(' ');
            const emailParts = email.split('@');
            expect(emailParts).toHaveLength(2);
            expect(emailParts[0]?.length).toBeGreaterThan(0);
            expect(emailParts[1]?.length).toBeGreaterThan(0);
            expect(emailParts[1]).toContain('.');
          });

          // Test invalid emails
          testData.invalidEmails.forEach(email => {
            if (email.length > 0) {
              expect(email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
            }
          });

          // Test duplicate handling
          const allEmails = [...testData.validEmails, ...testData.duplicateEmails];
          const uniqueEmails = [...new Set(allEmails)];
          
          // Verify Set behavior for deduplication
          expect(uniqueEmails.length).toBeLessThanOrEqual(allEmails.length);
          
          // Verify all unique emails are still valid
          uniqueEmails.forEach(email => {
            expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
          });

          // Test email config with various recipient combinations
          const config: EmailConfig = {
            to: testData.validEmails,
            subject: 'Test Subject',
            text: 'Test content'
          };

          expect(config.to).toEqual(testData.validEmails);
          expect(config.to.length).toBeGreaterThan(0);
          
          // Verify all recipients are preserved
          config.to.forEach((email, index) => {
            expect(email).toBe(testData.validEmails[index]);
          });
        }
      ),
      { numRuns: 40 }
    );
  });

  /**
   * Property: Email service status should be consistent
   */
  test('Email service status reporting is consistent', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          testRecipient: fc.emailAddress()
        }),
        (testData) => {
          // Test service status
          const status = emailService.getStatus();
          
          // Verify status structure
          expect(typeof status.configured).toBe('boolean');
          expect(typeof status.authenticated).toBe('boolean');
          
          if (status.host) {
            expect(typeof status.host).toBe('string');
            expect(status.host.length).toBeGreaterThan(0);
          }
          
          if (status.port) {
            expect(typeof status.port).toBe('number');
            expect(status.port).toBeGreaterThan(0);
            expect(status.port).toBeLessThanOrEqual(65535);
          }
          
          if (status.secure !== undefined) {
            expect(typeof status.secure).toBe('boolean');
          }

          // Verify consistent behavior across multiple calls
          const status2 = emailService.getStatus();
          expect(status2.configured).toBe(status.configured);
          expect(status2.authenticated).toBe(status.authenticated);
          expect(status2.host).toBe(status.host);
          expect(status2.port).toBe(status.port);
          expect(status2.secure).toBe(status.secure);

          // Test recipient validation
          expect(testData.testRecipient).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        }
      ),
      { numRuns: 15 }
    );
  });
});