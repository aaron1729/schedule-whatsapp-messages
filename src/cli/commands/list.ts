import { Command } from 'commander';
import { loadScheduledMessages, loadSentMessages } from '../../storage/messages';
import { formatScheduledMessage, formatSentMessage, printTable, info } from '../utils/formatting';

export function listCommand(program: Command): void {
  program
    .command('list')
    .description('List scheduled or sent messages')
    .option('--pending', 'Show only pending messages')
    .option('--failed', 'Show only failed messages')
    .option('--sent', 'Show only sent messages')
    .action(async (options: { pending?: boolean; failed?: boolean; sent?: boolean }) => {
      try {
        const showPending = options.pending || (!options.pending && !options.failed && !options.sent);
        const showFailed = options.failed;
        const showSent = options.sent || (!options.pending && !options.failed && !options.sent);

        if (showPending) {
          console.log('');
          info('Pending Messages:');
          console.log('');

          const scheduled = await loadScheduledMessages();
          const pendingMessages = scheduled.filter(m => m.status === 'pending');

          if (pendingMessages.length === 0) {
            console.log('No pending messages.');
          } else {
            const formatted = pendingMessages.map(formatScheduledMessage);
            printTable(formatted);
          }
        }

        if (showFailed) {
          if (showPending) {
            console.log('');
          }

          console.log('');
          info('Failed Messages:');
          console.log('');

          const scheduled = await loadScheduledMessages();
          const failedMessages = scheduled.filter(m => m.status === 'failed');

          if (failedMessages.length === 0) {
            console.log('No failed messages.');
          } else {
            const formatted = failedMessages.map(formatScheduledMessage);
            printTable(formatted);
          }
        }

        if (showSent) {
          if (showPending) {
            console.log('');
          }

          info('Sent Messages:');
          console.log('');

          const sent = await loadSentMessages();

          if (sent.length === 0) {
            console.log('No sent messages.');
          } else {
            const formatted = sent.map(formatSentMessage);
            printTable(formatted);
          }
        }

        console.log('');
      } catch (err: any) {
        console.error('Failed to list messages:', err.message);
        process.exit(1);
      }
    });
}
