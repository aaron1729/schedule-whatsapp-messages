import { Command } from 'commander';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as path from 'path';
import * as fs from 'fs';
import config from '../../utils/config';
import { printTable, error, info, success } from '../utils/formatting';

export function listChatsCommand(program: Command): void {
  program
    .command('list-chats')
    .description('List all WhatsApp chats with their IDs')
    .option('-l, --limit <number>', 'Limit number of chats to display', '50')
    .action(async (options: { limit?: string }) => {
      try {
        info('Connecting to WhatsApp...');

        const client = new Client({
          authStrategy: new LocalAuth({
            dataPath: path.join(config.dataDir, '.wwebjs_auth'),
          }),
          puppeteer: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
            ],
          },
        });

        // Wait for ready event
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout. Make sure you have authenticated with WhatsApp.'));
          }, 30000);

          client.on('ready', () => {
            clearTimeout(timeout);
            resolve();
          });

          client.on('auth_failure', () => {
            clearTimeout(timeout);
            reject(new Error('Authentication failed. Please re-authenticate.'));
          });

          client.initialize();
        });

        info('Fetching chats...');

        // Get all chats
        const chats = await client.getChats();

        const limit = parseInt(options.limit || '50', 10);
        const limitedChats = chats.slice(0, limit);

        // Format chat data
        const chatData = limitedChats.map(chat => {
          let type = 'Unknown';
          let name = chat.name || 'No name';

          if (chat.isGroup) {
            type = 'Group';
          } else {
            type = 'DM';
          }

          return {
            name: name.substring(0, 30),
            chatId: chat.id._serialized,
            type,
            unread: chat.unreadCount || 0,
          };
        });

        // Display to console
        console.log('');
        info(`Found ${chats.length} chats (showing first ${limitedChats.length}):`);
        console.log('');
        printTable(chatData);
        console.log('');

        // Write to file
        const outputFile = path.join(process.cwd(), 'list-chats.txt');
        let fileContent = `WhatsApp Chats (Total: ${chats.length}, Showing: ${limitedChats.length})\n`;
        fileContent += `Generated: ${new Date().toISOString()}\n\n`;
        fileContent += `${'Name'.padEnd(32)} ${'Chat ID'.padEnd(25)} ${'Type'.padEnd(8)} Unread\n`;
        fileContent += `${'='.repeat(32)} ${'='.repeat(25)} ${'='.repeat(8)} ${'='.repeat(6)}\n`;

        chatData.forEach(chat => {
          fileContent += `${chat.name.padEnd(32)} ${chat.chatId.padEnd(25)} ${chat.type.padEnd(8)} ${chat.unread}\n`;
        });

        fileContent += `\n\nUsage:\n`;
        fileContent += `  wa-schedule send "<chatId>" "<time>" "<message>"\n`;
        fileContent += `  wa-schedule send "<chatId>" "<time>" --file <filename>\n\n`;
        fileContent += `Example:\n`;
        fileContent += `  wa-schedule send "${chatData[0]?.chatId || 'CHAT_ID'}" "tomorrow at 2pm" "Hello!"\n`;

        fs.writeFileSync(outputFile, fileContent, 'utf-8');

        success(`Chat list saved to: list-chats.txt`);
        info('Use the chatId to schedule messages:');
        console.log('  wa-schedule send "<chatId>" "<time>" "<message>"');
        console.log('  wa-schedule send "<chatId>" "<time>" --file <filename>');
        console.log('');

        // Cleanup
        await client.destroy();
        process.exit(0);
      } catch (err: any) {
        error(`Failed to list chats: ${err.message}`);

        if (err.message.includes('browser is already running')) {
          console.log('');
          info('The daemon is currently running and using the WhatsApp session.');
          info('To list chats, stop the daemon first:');
          console.log('');
          console.log('  1. wa-schedule daemon stop');
          console.log('  2. wa-schedule list-chats');
          console.log('  3. wa-schedule daemon start');
          console.log('');
        } else if (err.message.includes('authenticated')) {
          info('Make sure the daemon has been started and authenticated at least once.');
          info('Run: wa-schedule daemon start');
        }
        process.exit(1);
      }
    });
}
