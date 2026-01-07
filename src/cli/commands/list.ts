import { Command } from 'commander';
import { loadScheduledMessages, loadSentMessages } from '../../storage/messages';
import { formatScheduledMessage, formatSentMessage, printTable, info } from '../utils/formatting';

export function listCommand(program: Command): void {
  program
    .command('list')
    .description('List scheduled or sent messages')
    .option('--pending', 'Show only pending messages')
    .option('--sent', 'Show only sent messages')
    .action(async (options: { pending?: boolean; sent?: boolean }) => {
      try {
        const showPending = options.pending || (!options.pending && !options.sent);
        const showSent = options.sent || (!options.pending && !options.sent);

        if (showPending) {
          console.log('');
          info('Scheduled Messages:');
          console.log('');

          const scheduled = await loadScheduledMessages();

          if (scheduled.length === 0) {
            console.log('No scheduled messages.');
          } else {
            const formatted = scheduled.map(formatScheduledMessage);
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
