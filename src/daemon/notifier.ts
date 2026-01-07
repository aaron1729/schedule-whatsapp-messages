import * as nodemailer from 'nodemailer';
import { ScheduledMessage } from '../types';
import config from '../utils/config';
import logger from '../utils/logger';
import { formatDateTime } from '../utils/date-parser';

/**
 * Send email notification when a message permanently fails
 */
export async function sendFailureNotification(message: ScheduledMessage): Promise<void> {
  // Check if email notifications are enabled
  if (!config.email.enabled) {
    logger.debug('Email notifications disabled, skipping notification');
    return;
  }

  // Validate email configuration
  if (!config.email.host || !config.email.user || !config.email.pass || !config.email.from || !config.email.to) {
    logger.warn('Email notifications enabled but configuration incomplete, skipping notification');
    return;
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });

    // Format message details
    const scheduledTime = formatDateTime(new Date(message.scheduledTime));
    const failureTime = formatDateTime(new Date());
    const messageId = message.id.substring(0, 8); // First 8 characters for display

    // Compose email
    const subject = `WhatsApp Message Failed - ID: ${messageId}`;
    const text = `
A scheduled WhatsApp message has permanently failed after ${message.retryCount} retry attempts.

Message Details:
- ID: ${message.id}
- Chat ID: ${message.chatId}
- Scheduled Time: ${scheduledTime}
- Message: "${message.message}"

Failure Details:
- Retry Attempts: ${message.retryCount}
- Last Error: ${message.lastError || 'Unknown error'}
- Final Failure Time: ${failureTime}

The message remains in your scheduled.json file with status 'failed'.
You can view it with: wa-schedule list --pending

---
Sent by WhatsApp Scheduler
`.trim();

    // Send email
    await transporter.sendMail({
      from: config.email.from,
      to: config.email.to,
      subject,
      text,
    });

    logger.info('Failure notification email sent successfully', { messageId: message.id });
  } catch (error: any) {
    // Log error but don't crash the daemon
    logger.error('Failed to send email notification', {
      error: error.message,
      messageId: message.id,
    });
  }
}
