import { ScheduledMessage } from '../types';
import { WhatsAppClient } from './whatsapp-client';
import { moveToSent, updateScheduledMessage } from '../storage/messages';
import { sendFailureNotification } from './notifier';
import logger from '../utils/logger';

// Retry delays in milliseconds: 1min, 5min, 15min
const RETRY_DELAYS = [60000, 300000, 900000];
const MAX_RETRIES = 3;

/**
 * Process and send a scheduled message
 * Handles retry logic and failure notifications
 */
export async function processMessage(
  message: ScheduledMessage,
  whatsappClient: WhatsAppClient
): Promise<void> {
  logger.info('Processing message', {
    id: message.id,
    chatId: message.chatId,
    retryCount: message.retryCount,
  });

  // Check if WhatsApp client is ready
  if (!whatsappClient.isClientReady()) {
    logger.warn('WhatsApp client not ready, will retry later', { id: message.id });
    return;
  }

  // Attempt to send message
  const success = await whatsappClient.sendMessage(message.chatId, message.message);

  if (success) {
    // Success! Move to sent history
    const sentAt = new Date().toISOString();
    await moveToSent(message, sentAt);
    logger.info('Message sent successfully and moved to sent history', { id: message.id });
  } else {
    // Failed to send, handle retry logic
    await handleSendFailure(message);
  }
}

/**
 * Handle message send failure with retry logic
 */
async function handleSendFailure(message: ScheduledMessage): Promise<void> {
  const newRetryCount = message.retryCount + 1;

  logger.warn('Message send failed', {
    id: message.id,
    retryCount: newRetryCount,
  });

  if (newRetryCount > MAX_RETRIES) {
    // Max retries exceeded, mark as permanently failed
    await updateScheduledMessage(message.id, {
      status: 'failed',
      retryCount: newRetryCount,
      lastError: `Failed after ${MAX_RETRIES} retry attempts`,
    });

    logger.error('Message permanently failed after max retries', {
      id: message.id,
      chatId: message.chatId,
    });

    // Send email notification
    const updatedMessage: ScheduledMessage = {
      ...message,
      status: 'failed',
      retryCount: newRetryCount,
      lastError: `Failed after ${MAX_RETRIES} retry attempts`,
    };
    await sendFailureNotification(updatedMessage);
  } else {
    // Schedule for retry
    const retryDelay = RETRY_DELAYS[newRetryCount - 1];
    const newScheduledTime = new Date(Date.now() + retryDelay).toISOString();

    await updateScheduledMessage(message.id, {
      retryCount: newRetryCount,
      scheduledTime: newScheduledTime,
      lastError: `Send attempt ${newRetryCount} failed, retrying in ${retryDelay / 1000 / 60} minutes`,
    });

    logger.info('Message rescheduled for retry', {
      id: message.id,
      retryCount: newRetryCount,
      newScheduledTime,
    });
  }
}

/**
 * Check if a message is due to be sent
 */
export function isMessageDue(message: ScheduledMessage): boolean {
  const now = new Date();
  const scheduledTime = new Date(message.scheduledTime);
  return scheduledTime <= now && message.status === 'pending';
}
