import { ScheduledMessage, SentMessage } from '../types/message';

/**
 * Structure of scheduled.json file
 */
export interface ScheduledMessagesFile {
  messages: ScheduledMessage[];
}

/**
 * Structure of sent.json file
 */
export interface SentMessagesFile {
  messages: SentMessage[];
}
