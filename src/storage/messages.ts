import * as fs from 'fs/promises';
import * as path from 'path';
import { ScheduledMessage, SentMessage } from '../types';
import { ScheduledMessagesFile, SentMessagesFile } from './types';
import config from '../utils/config';
import logger from '../utils/logger';

const SCHEDULED_FILE = path.join(config.dataDir, 'scheduled.json');
const SENT_FILE = path.join(config.dataDir, 'sent.json');

/**
 * Atomically write JSON to a file
 * Writes to a temp file first, then renames to prevent corruption
 */
async function atomicWrite(filePath: string, data: any): Promise<void> {
  const tempFile = `${filePath}.tmp`;

  try {
    // Write to temp file
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf-8');

    // Atomic rename
    await fs.rename(tempFile, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempFile);
    } catch {
      // Ignore errors
    }
    throw error;
  }
}

/**
 * Read JSON from a file, returning default value if file doesn't exist or is corrupted
 */
async function readJSONFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default
      return defaultValue;
    }

    // File exists but is corrupted
    logger.error(`Failed to parse ${filePath}, using default value`, { error: error.message });

    // Backup corrupted file
    const backupPath = `${filePath}.backup.${Date.now()}`;
    try {
      await fs.copyFile(filePath, backupPath);
      logger.info(`Backed up corrupted file to ${backupPath}`);
    } catch {
      // Ignore backup errors
    }

    return defaultValue;
  }
}

/**
 * Load all scheduled messages
 */
export async function loadScheduledMessages(): Promise<ScheduledMessage[]> {
  const data = await readJSONFile<ScheduledMessagesFile>(
    SCHEDULED_FILE,
    { messages: [] }
  );
  return data.messages;
}

/**
 * Save all scheduled messages
 */
export async function saveScheduledMessages(messages: ScheduledMessage[]): Promise<void> {
  const data: ScheduledMessagesFile = { messages };
  await atomicWrite(SCHEDULED_FILE, data);
}

/**
 * Add a new scheduled message
 */
export async function addScheduledMessage(message: ScheduledMessage): Promise<void> {
  const messages = await loadScheduledMessages();
  messages.push(message);
  await saveScheduledMessages(messages);
  logger.info(`Added scheduled message ${message.id}`);
}

/**
 * Remove a scheduled message by ID
 */
export async function removeScheduledMessage(id: string): Promise<boolean> {
  const messages = await loadScheduledMessages();
  const initialLength = messages.length;
  const filteredMessages = messages.filter(m => m.id !== id);

  if (filteredMessages.length === initialLength) {
    return false; // Message not found
  }

  await saveScheduledMessages(filteredMessages);
  logger.info(`Removed scheduled message ${id}`);
  return true;
}

/**
 * Update a scheduled message by ID
 */
export async function updateScheduledMessage(id: string, updates: Partial<ScheduledMessage>): Promise<boolean> {
  const messages = await loadScheduledMessages();
  const index = messages.findIndex(m => m.id === id);

  if (index === -1) {
    return false; // Message not found
  }

  messages[index] = { ...messages[index], ...updates };
  await saveScheduledMessages(messages);
  logger.info(`Updated scheduled message ${id}`);
  return true;
}

/**
 * Find a scheduled message by ID
 */
export async function findScheduledMessage(id: string): Promise<ScheduledMessage | null> {
  const messages = await loadScheduledMessages();
  return messages.find(m => m.id === id) || null;
}

/**
 * Load all sent messages
 */
export async function loadSentMessages(): Promise<SentMessage[]> {
  const data = await readJSONFile<SentMessagesFile>(
    SENT_FILE,
    { messages: [] }
  );
  return data.messages;
}

/**
 * Save all sent messages
 */
async function saveSentMessages(messages: SentMessage[]): Promise<void> {
  const data: SentMessagesFile = { messages };
  await atomicWrite(SENT_FILE, data);
}

/**
 * Add a message to sent history
 */
export async function addSentMessage(message: SentMessage): Promise<void> {
  const messages = await loadSentMessages();
  messages.push(message);
  await saveSentMessages(messages);
  logger.info(`Added sent message ${message.id} to history`);
}

/**
 * Move a scheduled message to sent history
 */
export async function moveToSent(scheduledMessage: ScheduledMessage, sentAt: string): Promise<void> {
  // Create sent message record
  const sentMessage: SentMessage = {
    id: scheduledMessage.id,
    chatId: scheduledMessage.chatId,
    message: scheduledMessage.message,
    scheduledTime: scheduledMessage.scheduledTime,
    sentAt,
    createdAt: scheduledMessage.createdAt,
  };

  // Add to sent and remove from scheduled
  await addSentMessage(sentMessage);
  await removeScheduledMessage(scheduledMessage.id);
}
