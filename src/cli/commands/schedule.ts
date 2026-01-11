import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { parseNaturalDate, validateFutureDate, formatDateTime, toISOString } from '../../utils/date-parser';
import { addScheduledMessage } from '../../storage/messages';
import { ScheduledMessage } from '../../types';
import { confirm } from '../utils/confirmation';
import { success, error, info, warning } from '../utils/formatting';
import { readMessageFromFile } from '../utils/file-reader';
import { getDdChatId, getLatestDdFile, extractDateFromFilename, validateDateMatch } from '../utils/dd-helper';
import { isDaemonRunning } from '../../storage/daemon-state';
import * as fs from 'fs/promises';
import chalk from 'chalk';

export function scheduleCommand(program: Command): void {
  program
    .command('send')
    .description('Schedule a WhatsApp message')
    .argument('<chatId>', 'WhatsApp chat ID (e.g., "1234567890@c.us" or "123456789012345@g.us")')
    .argument('<time>', 'When to send (e.g., "tomorrow at 2pm", "in 3 hours")')
    .argument('[message]', 'Message text (optional if using --file)')
    .option('-f, --file <path>', 'Read message from text file')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (chatId: string, timeStr: string, messageText: string | undefined, options: { file?: string; yes?: boolean }) => {
      try {
        // Special handling for "dd" shortcut
        let actualChatId = chatId;
        let actualFile: string | undefined = options.file;
        let ddFileDate: Date | null = null;

        if (chatId === 'dd') {
          // Get chat ID from config-dd
          try {
            actualChatId = await getDdChatId();
          } catch (err: any) {
            error(err.message);
            process.exit(1);
          }

          // Find latest dd file
          const latestFile = await getLatestDdFile();
          if (!latestFile) {
            error('No dd files found in txt-messages/');
            info('Expected filename format: YYYY-MM-DD-dd.txt (e.g., 2026-01-10-dd.txt)');
            process.exit(1);
          }

          actualFile = latestFile.fullPath;
          ddFileDate = latestFile.date;

          info(`Using file: ${chalk.cyan(latestFile.filename)}`);
          console.log('');
        }

        // Get message content (from argument or file)
        let message: string | null = null;

        if (actualFile) {
          // Read from file
          message = await fs.readFile(actualFile, 'utf8');
          if (!message || message.trim().length === 0) {
            error('Message file is empty');
            process.exit(1);
          }
        } else if (messageText) {
          // Use provided message
          message = messageText;
        } else {
          error('Please provide a message or use --file to read from a file');
          info('Examples:');
          console.log('  wa-schedule send "123@c.us" "tomorrow at 2pm" "Hello!"');
          console.log('  wa-schedule send "123@c.us" "tomorrow at 2pm" --file msg.txt');
          console.log('  wa-schedule send dd "tomorrow at 2pm"');
          process.exit(1);
        }

        // Validate chat ID format
        if (!validateChatId(actualChatId)) {
          error('Invalid chat ID format');
          info('Chat ID should be:');
          console.log('  - For DMs: "1234567890@c.us"');
          console.log('  - For groups: "123456789012345@g.us"');
          console.log('  - Or newer format: "1234567890@lid"');
          process.exit(1);
        }

        // Parse the time
        const parsedDate = parseNaturalDate(timeStr);
        if (!parsedDate) {
          error(`Could not parse time: "${timeStr}"`);
          info('Examples of valid time formats:');
          console.log('  - "tomorrow at 2pm"');
          console.log('  - "in 3 hours"');
          console.log('  - "next Friday at 9am"');
          console.log('  - "Jan 15 at 2:30pm"');
          process.exit(1);
        }

        // Validate it's in the future
        if (!validateFutureDate(parsedDate)) {
          error('Scheduled time must be in the future');
          process.exit(1);
        }

        // Show parsed time and ask for confirmation
        const formattedTime = formatDateTime(parsedDate);
        console.log('');
        info(`Message will be sent at: ${formattedTime}`);
        console.log('');

        // If using dd shortcut, validate date matches filename
        if (ddFileDate) {
          const validation = validateDateMatch(parsedDate, ddFileDate);

          if (validation.matches) {
            success(`✓ Date confirmation: Message will be sent on ${chalk.bold(validation.scheduledDateCT)} (Central Time)`);
            console.log('');
          } else {
            warning(`⚠ DATE MISMATCH WARNING!`);
            console.log('');
            console.log(`  File date (CT):      ${chalk.yellow(validation.filenameDateCT)}`);
            console.log(`  Scheduled date (CT): ${chalk.yellow(validation.scheduledDateCT)}`);
            console.log('');
            console.log('  The message will be sent on a different date than indicated in the filename.');
            console.log('');
          }
        }

        // Skip confirmation if --yes flag is provided
        if (!options.yes) {
          const confirmed = await confirm('Schedule this message?');

          if (!confirmed) {
            console.log('Cancelled.');
            process.exit(0);
          }
        }

        // Create scheduled message
        const scheduledMessage: ScheduledMessage = {
          id: uuidv4(),
          chatId: actualChatId,
          message,
          scheduledTime: toISOString(parsedDate),
          createdAt: new Date().toISOString(),
          status: 'pending',
          retryCount: 0,
        };

        // Save to storage
        await addScheduledMessage(scheduledMessage);

        // Show success
        success(`Message scheduled (ID: ${scheduledMessage.id.substring(0, 8)})`);

        // Check if daemon is running and warn if not
        const daemonRunning = await isDaemonRunning();
        if (!daemonRunning) {
          console.log('');
          warning('⚠ WARNING: Daemon is not running!');
          console.log('');
          console.log('  Your message has been scheduled, but it will NOT be sent until the daemon starts.');
          console.log('');
          info('To start the daemon:');
          console.log('  wa-schedule daemon start');
          console.log('');
        }
      } catch (err: any) {
        error(`Failed to schedule message: ${err.message}`);
        process.exit(1);
      }
    });
}

/**
 * Validate WhatsApp chat ID format
 */
function validateChatId(chatId: string): boolean {
  // DM format: number@c.us
  // Group format: number@g.us
  // Local ID format: number@lid (newer WhatsApp identifier)
  return /^\d+@([cg]\.us|lid)$/.test(chatId);
}
