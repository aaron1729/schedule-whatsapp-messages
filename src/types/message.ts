/**
 * Represents a scheduled WhatsApp message
 */
export interface ScheduledMessage {
  /** Unique identifier (UUID) */
  id: string;

  /** WhatsApp chat ID (e.g., "1234567890@c.us" for DMs, "123456789012345@g.us" for groups) */
  chatId: string;

  /** Message text content */
  message: string;

  /** ISO 8601 timestamp when the message should be sent */
  scheduledTime: string;

  /** ISO 8601 timestamp when the message was created */
  createdAt: string;

  /** Current status of the message */
  status: 'pending' | 'failed';

  /** Number of retry attempts made */
  retryCount: number;

  /** Last error message if sending failed */
  lastError?: string;
}

/**
 * Represents a message that has been successfully sent
 */
export interface SentMessage {
  /** Original scheduled message ID */
  id: string;

  /** WhatsApp chat ID */
  chatId: string;

  /** Message text content */
  message: string;

  /** ISO 8601 timestamp when the message was scheduled for */
  scheduledTime: string;

  /** ISO 8601 timestamp when the message was actually sent */
  sentAt: string;

  /** ISO 8601 timestamp when the message was originally created */
  createdAt: string;
}

/**
 * Represents the daemon process state
 */
export interface DaemonState {
  /** Process ID of the daemon */
  pid: number;

  /** ISO 8601 timestamp when the daemon was started */
  startedAt: string;

  /** ISO 8601 timestamp of the last scheduler check */
  lastCheckAt: string;

  /** Whether WhatsApp is currently connected */
  whatsappConnected: boolean;

  /** ISO 8601 timestamp of the last heartbeat (updated every minute) */
  lastHeartbeat: string;
}
