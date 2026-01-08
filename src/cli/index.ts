#!/usr/bin/env node

// Suppress punycode deprecation warning
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return; // Ignore punycode deprecation warnings
  }
  console.warn(warning.stack);
});

import { Command } from 'commander';
import { scheduleCommand } from './commands/schedule';
import { listCommand } from './commands/list';
import { deleteCommand } from './commands/delete';
import { daemonCommand } from './commands/daemon';
import { statusCommand } from './commands/status';
import { listChatsCommand } from './commands/list-chats';

const program = new Command();

program
  .name('wa-schedule')
  .description('CLI tool to schedule WhatsApp messages')
  .version('1.0.0');

// Register commands
scheduleCommand(program);
listCommand(program);
deleteCommand(program);
daemonCommand(program);
statusCommand(program);
listChatsCommand(program);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
