import chalk from 'chalk';
import { ScheduledMessage, SentMessage } from '../../types';
import { formatDateTime } from '../../utils/date-parser';

/**
 * Truncate a string to a maximum length
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Replace newlines with a visual indicator, handling ANSI color codes properly
 */
function replaceNewlinesForDisplay(message: string, maxLength: number): string {
  // First, replace newlines with a placeholder
  const withPlaceholder = message.replace(/\n/g, '␊');

  // Truncate based on visual length (without ANSI codes)
  const truncated = truncate(withPlaceholder, maxLength);

  // Replace placeholder with colored \n
  return truncated.replace(/␊/g, chalk.red('\\n'));
}

/**
 * Format a scheduled message for table display
 */
export function formatScheduledMessage(message: ScheduledMessage): {
  id: string;
  chatId: string;
  message: string;
  scheduledTime: string;
  status: string;
} {
  const scheduledTime = formatDateTime(new Date(message.scheduledTime));

  return {
    id: message.id.substring(0, 8),
    chatId: truncate(message.chatId, 20),
    message: replaceNewlinesForDisplay(message.message, 30),
    scheduledTime,
    status: message.status === 'failed' ? chalk.red('Failed') : chalk.yellow('Pending'),
  };
}

/**
 * Format a sent message for table display
 */
export function formatSentMessage(message: SentMessage): {
  id: string;
  chatId: string;
  message: string;
  scheduledTime: string;
  sentAt: string;
} {
  const scheduledTime = formatDateTime(new Date(message.scheduledTime));
  const sentAt = formatDateTime(new Date(message.sentAt));

  return {
    id: message.id.substring(0, 8),
    chatId: truncate(message.chatId, 20),
    message: replaceNewlinesForDisplay(message.message, 30),
    scheduledTime,
    sentAt,
  };
}

/**
 * Strip ANSI escape codes to get visible string length
 */
function visibleLength(str: string): number {
  // Remove ANSI escape codes
  return str.replace(/\u001b\[[0-9;]*m/g, '').length;
}

/**
 * Print a table to console
 */
export function printTable(data: any[]): void {
  if (data.length === 0) {
    console.log(chalk.gray('No items to display.'));
    return;
  }

  // Get column headers
  const headers = Object.keys(data[0]);
  const columnWidths = headers.map(header => {
    const maxDataWidth = Math.max(...data.map(row => visibleLength(String(row[header]))));
    return Math.max(header.length, maxDataWidth);
  });

  // Print header row
  const headerRow = headers
    .map((header, i) => chalk.bold(header.padEnd(columnWidths[i])))
    .join('  ');
  console.log(headerRow);

  // Print separator
  const separator = headers
    .map((_, i) => '─'.repeat(columnWidths[i]))
    .join('  ');
  console.log(chalk.gray(separator));

  // Print data rows
  data.forEach(row => {
    const dataRow = headers
      .map((header, i) => {
        const value = String(row[header]);
        const visLen = visibleLength(value);
        const padding = columnWidths[i] - visLen;
        return value + ' '.repeat(Math.max(0, padding));
      })
      .join('  ');
    console.log(dataRow);
  });
}

/**
 * Print success message
 */
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

/**
 * Print error message
 */
export function error(message: string): void {
  console.log(chalk.red('✗'), message);
}

/**
 * Print info message
 */
export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

/**
 * Print warning message
 */
export function warning(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}
