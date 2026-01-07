import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { parseNaturalDate, validateFutureDate, formatDateTime, toISOString } from '../../utils/date-parser';
import { addScheduledMessage } from '../../storage/messages';
import { ScheduledMessage } from '../../types';
import { confirm } from '../utils/confirmation';
import { success, error, info } from '../utils/formatting';
import { readMessageFromFile } from '../utils/file-reader';

export function scheduleCommand(program: Command): void {
  program
    .command('send')
    .description('Schedule a WhatsApp message')
    .argument('<chatId>', 'WhatsApp chat ID (e.g., "1234567890@c.us" or "123456789012345@g.us")')
    .argument('<time>', 'When to send (e.g., "tomorrow at 2pm", "in 3 hours")')
    .argument('[message]', 'Message text (optional if using --file)')
    .option('-f, --file <path>', 'Read message from text file')
    .action(async (chatId: string, timeStr: string, messageText: string | undefined, options: { file?: string }) => {
      try {
        // Get message content (from argument or file)
        let message: string | null = null;

        if (options.file) {
          // Read from file
          message = await readMessageFromFile(options.file);
          if (!message) {
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
          process.exit(1);
        }

        // Validate chat ID format
        if (!validateChatId(chatId)) {
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

        const confirmed = await confirm('Schedule this message?');

        if (!confirmed) {
          console.log('Cancelled.');
          process.exit(0);
        }

        // Create scheduled message
        const scheduledMessage: ScheduledMessage = {
          id: uuidv4(),
          chatId,
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
