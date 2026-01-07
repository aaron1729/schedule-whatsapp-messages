import { Command } from 'commander';
import { loadDaemonState, isDaemonRunning } from '../../storage/daemon-state';
import { loadScheduledMessages } from '../../storage/messages';
import { formatDateTime } from '../../utils/date-parser';
import { success, warning, info } from '../utils/formatting';
import chalk from 'chalk';

export function statusCommand(program: Command): void {
  program
    .command('status')
    .description('Show overall system status')
    .action(async () => {
      try {
        console.log('');
        console.log(chalk.bold('WhatsApp Scheduler Status'));
        console.log('');

        // Daemon status
        const state = await loadDaemonState();
        const running = await isDaemonRunning();

        if (!state || !running) {
          warning('Daemon: Not running');
          info('Start the daemon with: wa-schedule daemon start');
        } else {
          success('Daemon: Running');
          console.log(`  PID: ${state.pid}`);

          // Calculate uptime
          const startedAt = new Date(state.startedAt);
          const now = new Date();
          const uptimeMs = now.getTime() - startedAt.getTime();
          const uptimeMinutes = Math.floor(uptimeMs / 60000);
          const uptimeHours = Math.floor(uptimeMinutes / 60);
          const uptimeDays = Math.floor(uptimeHours / 24);

          let uptimeStr = '';
          if (uptimeDays > 0) {
            uptimeStr = `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m`;
          } else if (uptimeHours > 0) {
            uptimeStr = `${uptimeHours}h ${uptimeMinutes % 60}m`;
          } else {
            uptimeStr = `${uptimeMinutes}m`;
          }

          console.log(`  Uptime: ${uptimeStr}`);
          console.log(`  WhatsApp: ${state.whatsappConnected ? chalk.green('Connected') : chalk.red('Disconnected')}`);
        }

        console.log('');

        // Message statistics
        const scheduled = await loadScheduledMessages();
        const pendingMessages = scheduled.filter(m => m.status === 'pending');
        const failedMessages = scheduled.filter(m => m.status === 'failed');

        console.log(chalk.bold('Messages:'));
        console.log(`  Pending: ${pendingMessages.length}`);
        console.log(`  Failed: ${failedMessages.length}`);

        // Next message due
        if (pendingMessages.length > 0) {
          const sortedMessages = pendingMessages.sort((a, b) => {
            return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
          });

          const nextMessage = sortedMessages[0];
          const nextTime = formatDateTime(new Date(nextMessage.scheduledTime));

          console.log(`  Next message: ${nextTime}`);
        }

        console.log('');

        // Hints
        if (!running) {
          info('Start the daemon to begin sending scheduled messages');
        } else if (pendingMessages.length === 0) {
          info('No pending messages. Schedule one with: wa-schedule send <chatId> <message> <time>');
        }

        console.log('');
      } catch (err: any) {
        console.error('Failed to get status:', err.message);
        process.exit(1);
      }
    });
}
