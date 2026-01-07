import { Command } from 'commander';
import { findScheduledMessage, removeScheduledMessage } from '../../storage/messages';
import { confirm } from '../utils/confirmation';
import { success, error, info } from '../utils/formatting';
import { formatDateTime } from '../../utils/date-parser';

export function deleteCommand(program: Command): void {
  program
    .command('delete')
    .description('Delete a scheduled message')
    .argument('<messageId>', 'Message ID (full ID or first 8 characters)')
    .action(async (messageId: string) => {
      try {
        // Find the message (support partial ID match)
        const messages = await import('../../storage/messages').then(m => m.loadScheduledMessages());
        const message = messages.find(m => m.id === messageId || m.id.startsWith(messageId));

        if (!message) {
          error(`Message not found: ${messageId}`);
          info('Use "wa-schedule list --pending" to see scheduled messages');
          process.exit(1);
        }

        // Show message details
        console.log('');
        info('Message details:');
        console.log(`  ID: ${message.id.substring(0, 8)}`);
        console.log(`  Chat ID: ${message.chatId}`);
        console.log(`  Message: "${message.message}"`);
        console.log(`  Scheduled for: ${formatDateTime(new Date(message.scheduledTime))}`);
        console.log(`  Status: ${message.status}`);
        console.log('');

        // Confirm deletion
        const confirmed = await confirm('Delete this message?');

        if (!confirmed) {
          console.log('Cancelled.');
          process.exit(0);
        }

        // Delete the message
        const deleted = await removeScheduledMessage(message.id);

        if (deleted) {
          success('Message deleted');
        } else {
          error('Failed to delete message');
          process.exit(1);
        }
      } catch (err: any) {
        error(`Failed to delete message: ${err.message}`);
        process.exit(1);
      }
    });
}
