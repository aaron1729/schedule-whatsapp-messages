import { WhatsAppClient } from './whatsapp-client';
import { loadScheduledMessages } from '../storage/messages';
import { updateDaemonState } from '../storage/daemon-state';
import { processMessage, isMessageDue } from './message-processor';
import logger from '../utils/logger';
import config from '../utils/config';

/**
 * Scheduler class that periodically checks for and sends due messages
 */
export class Scheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private whatsappClient: WhatsAppClient;
  private isRunning: boolean = false;

  constructor(whatsappClient: WhatsAppClient) {
    this.whatsappClient = whatsappClient;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduler', { interval: config.checkInterval });

    // Run immediately, then periodically
    this.checkAndSendMessages();

    this.intervalId = setInterval(() => {
      this.checkAndSendMessages();
    }, config.checkInterval);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  /**
   * Check for due messages and process them
   */
  private async checkAndSendMessages(): Promise<void> {
    try {
      logger.debug('Checking for due messages...');

      // Load all scheduled messages
      const messages = await loadScheduledMessages();

      // Filter for due messages
      const dueMessages = messages.filter(isMessageDue);

      if (dueMessages.length > 0) {
        logger.info(`Found ${dueMessages.length} due message(s)`);

        // Process each due message
        for (const message of dueMessages) {
          await processMessage(message, this.whatsappClient);
        }
      } else {
        logger.debug('No due messages found');
      }

      // Update last check time in daemon state
      await updateDaemonState({
        lastCheckAt: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('Error checking for due messages', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}
