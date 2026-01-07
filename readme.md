# WhatsApp Message Scheduler

A TypeScript CLI tool to schedule WhatsApp messages for future delivery. Schedule messages using natural language time inputs like "tomorrow at 2pm" or "in 3 hours", with automatic retry on failure and email notifications.

## Features

- **Natural Language Scheduling**: Use intuitive time formats like "tomorrow at 2pm", "in 3 hours", "next Friday at 9am"
- **Multiple Input Methods**:
  - Inline message text via CLI arguments
  - Read messages from text files for longer content
- **Reliable Delivery**:
  - Automatic retry with exponential backoff (1min, 5min, 15min)
  - Persistent storage with atomic writes
  - Session persistence (no repeated QR scanning)
- **Email Notifications**: Get notified when messages permanently fail after retries
- **Daemon Process**: Continuous background process for scheduled message delivery
- **Chat ID Targeting**: Send to specific WhatsApp chats (DMs or groups) using their chat IDs

## Requirements

- Node.js >= 18.0.0
- WhatsApp account
- (Optional) SMTP server for email notifications

## Installation

```bash
# Clone the repository
git clone https://github.com/aaron1729/schedule-whatsapp-messages.git
cd schedule-whatsapp-messages

# Install dependencies
npm install

# Build the project
npm run build

# Link globally to use the 'wa-schedule' command anywhere
npm link
```

## Quick Start

### 1. Configure Environment

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Edit `.env` to configure email notifications (optional):

```env
# Email notifications (optional - leave blank to disable)
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=notification-recipient@example.com
```

**For Gmail**: Create an [App Password](https://support.google.com/accounts/answer/185833) instead of using your regular password.

### 2. Start the Daemon

```bash
wa-schedule daemon start
```

On first run, you'll see a QR code. Scan it with your WhatsApp mobile app to authenticate. The session will be saved for future use.

### 3. Schedule a Message

```bash
# Schedule with inline text
wa-schedule send "1234567890@c.us" "tomorrow at 2pm" "Meeting reminder!"

# Schedule from a file (looks in txt-messages/ directory)
echo "Your message here" > txt-messages/reminder.txt
wa-schedule send "1234567890@c.us" "in 3 hours" --file reminder.txt

# Or use a full path
wa-schedule send "1234567890@c.us" "in 3 hours" --file /path/to/message.txt
```

The CLI will show you the parsed time and ask for confirmation before scheduling.

**Tips:**
- Create a `txt-messages/` directory in your project root to store message files. When using `--file` with just a filename (no path), it will automatically look in this directory.
- **File content is read at scheduling time**, not send time. Once scheduled, editing the file won't change the message. Use `wa-schedule list --pending` to see what will actually be sent.

## Usage

### Finding Chat IDs

**Easy way - Use the built-in command:**

```bash
wa-schedule list-chats
```

This will display all your WhatsApp chats with their IDs in a table format.

**Manual way - For your own number:**
- Format: `[country code][phone number]@c.us`
- Example: US number +1 555-123-4567 → `15551234567@c.us`

**Chat ID formats:**
- DMs: `1234567890@c.us` (phone number + @c.us)
- Groups: `123456789012345@g.us` (group ID + @g.us)
- Newer format: `53004241760480@lid` (Local Identifier - appears in newer WhatsApp versions)

**Note:** All formats are supported. For the same contact, both `@c.us` and `@lid` formats work.

### Commands

#### Schedule a Message

```bash
# With inline text
wa-schedule send <chatId> <time> <message>

# From a text file
wa-schedule send <chatId> <time> --file <path>
```

**Examples:**
```bash
# Inline message
wa-schedule send "1234567890@c.us" "tomorrow at 2pm" "Hello!"

# From file in txt-messages/ directory
wa-schedule send "1234567890@c.us" "next Monday at 9am" --file announcement.txt

# From file with full path
wa-schedule send "123456789012345@g.us" "in 30 minutes" --file /path/to/message.txt
```

**Time Format Examples:**
- `"tomorrow at 2pm"`
- `"in 3 hours"`
- `"in 30 minutes"`
- `"next Friday at 9am"`
- `"Jan 15 at 2:30pm"`
- `"Monday at 10am"`

#### List Messages

```bash
# List all messages (scheduled and sent)
wa-schedule list

# List only pending messages
wa-schedule list --pending

# List only sent messages
wa-schedule list --sent
```

**Note:** Sent messages are stored in `data/sent.json` with full details including scheduled time, actual sent time, and message content.

#### List All Chats

```bash
# List all your WhatsApp chats with their IDs
wa-schedule list-chats

# Limit the number of chats displayed
wa-schedule list-chats --limit 20
```

This command connects to WhatsApp (using your saved session) and displays all your chats with their chat IDs, making it easy to find the correct ID for scheduling messages.

#### Delete a Scheduled Message

```bash
wa-schedule delete <messageId>
```

You can use the full message ID or just the first 8 characters shown in the list.

#### Manage Daemon

```bash
# Start the daemon
wa-schedule daemon start

# Stop the daemon
wa-schedule daemon stop

# Check daemon status
wa-schedule daemon status
```

#### Overall Status

```bash
wa-schedule status
```

Shows daemon status, WhatsApp connection, pending messages, and next scheduled message.

## Architecture

### How It Works

1. **CLI Process**: Short-lived process that handles user commands and reads/writes JSON files
2. **Daemon Process**: Long-running background process that:
   - Maintains WhatsApp connection
   - Checks for due messages every 60 seconds
   - Sends messages when scheduled time arrives
   - Retries failed messages with exponential backoff
   - Sends email notifications for permanent failures

### File Structure

```
txt-messages/          # Your message text files (gitignored)

data/
├── scheduled.json      # Pending messages with full details
├── sent.json          # Complete sent message history with timestamps
├── daemon.json        # Daemon state (PID, heartbeat, connection status)
├── .wwebjs_auth/      # WhatsApp session data (encrypted)
└── .wwebjs_cache/     # WhatsApp client cache

logs/
└── daemon.log         # Daemon operational logs (startup, auth, checks)
```

**Message Storage:**
- `scheduled.json` - Contains all pending and failed messages with retry information
- `sent.json` - Complete history of successfully sent messages including:
  - Original message ID
  - Chat ID
  - Message content
  - Scheduled time (when it was supposed to send)
  - Actual sent time (when it was actually delivered)
  - Created time (when it was scheduled)

**Logs:**
- `daemon.log` - Operational events (daemon start/stop, authentication, scheduler checks)
- Message details are stored in JSON files, not in logs

### Retry Logic

When a message fails to send:
1. First retry: After 1 minute
2. Second retry: After 5 minutes
3. Third retry: After 15 minutes
4. After 3 failures: Marked as permanently failed, email notification sent

## Configuration

All configuration is in the `.env` file:

```env
# Data directory
DATA_DIR=./data

# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Daemon check interval in milliseconds (default: 60000 = 1 minute)
CHECK_INTERVAL=60000

# WhatsApp session timeout in minutes
SESSION_TIMEOUT=30

# Email notifications (optional)
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=notification-recipient@example.com
```

## Production Deployment

For production use, consider using PM2 for process management:

```bash
# Install PM2
npm install -g pm2

# Start daemon with PM2
pm2 start dist/daemon/index.js --name whatsapp-scheduler

# Save PM2 configuration
pm2 save

# Enable auto-start on system boot
pm2 startup
```

## Troubleshooting

### Daemon won't start
- Check `logs/daemon.log` for error messages
- Ensure Node.js version >= 18.0.0
- Try removing old session: `rm -rf data/.wwebjs_auth`

### QR code won't scan
- Make sure you're using the latest version of WhatsApp mobile app
- Try restarting the daemon: `wa-schedule daemon stop && wa-schedule daemon start`

### Messages not sending
- Check daemon status: `wa-schedule daemon status`
- Verify WhatsApp is connected
- Check `logs/daemon.log` for errors
- Verify chat ID format is correct

### Email notifications not working
- Verify SMTP settings in `.env`
- For Gmail, use an App Password, not your regular password
- Check `logs/daemon.log` for email sending errors
- Set `EMAIL_ENABLED=false` to disable if not needed

## Important Notes

### Daemon Must Run for Message Delivery

⚠️ **Critical**: The daemon must be actively running for scheduled messages to send. This is not a cloud service - it runs on your local machine.

**What stops message delivery:**
- Computer shutdown or sleep
- Daemon stopped or crashed
- Terminal/SSH session ended (if not using PM2)

**For reliable delivery:**
- Keep your computer awake with scheduled messages pending
- Use PM2 for production (see Production Deployment section)
- Run on an always-on server/VPS/Raspberry Pi
- Check daemon status before relying on scheduled messages: `wa-schedule status`

### WhatsApp Terms of Service

⚠️ **Important**: This tool uses [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), which is an unofficial WhatsApp API. Using unofficial APIs may violate WhatsApp's Terms of Service. Use at your own risk.

**Recommendations:**
- Use with a personal account, not business-critical accounts
- Avoid sending high volumes of messages
- Respect WhatsApp's rate limits
- Consider using [WhatsApp Business API](https://business.whatsapp.com/products/business-platform) for production use

### Session Security

- The `data/.wwebjs_auth/` directory contains encrypted session data
- Never commit this directory to version control (it's gitignored)
- Keep this directory secure as it allows access to your WhatsApp account

### Rate Limiting

The daemon sends messages one at a time with a minimum 60-second check interval to avoid triggering WhatsApp's anti-spam measures.

## Development

```bash
# Run in development mode (watches for changes)
npm run dev

# Build the project
npm run build

# Run the CLI directly
ts-node src/cli/index.ts <command>

# Run the daemon directly
ts-node src/daemon/index.ts
```

## Project Structure

```
src/
├── cli/                    # CLI interface
│   ├── index.ts           # Main CLI entry point
│   ├── commands/          # Command implementations
│   └── utils/             # CLI utilities
├── daemon/                # Background daemon
│   ├── index.ts          # Daemon entry point
│   ├── whatsapp-client.ts # WhatsApp integration
│   ├── scheduler.ts      # Message scheduling logic
│   ├── message-processor.ts # Send/retry logic
│   └── notifier.ts       # Email notifications
├── storage/               # Data persistence
│   ├── messages.ts       # Message storage
│   └── daemon-state.ts   # Daemon state
├── utils/                 # Shared utilities
│   ├── config.ts         # Configuration
│   ├── logger.ts         # Logging
│   └── date-parser.ts    # Natural language dates
└── types/                 # TypeScript types
    └── message.ts        # Message type definitions
```

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- GitHub Issues: https://github.com/aaron1729/schedule-whatsapp-messages/issues
- Check `logs/daemon.log` for detailed error information

## Acknowledgments

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - WhatsApp Web integration
- [chrono-node](https://github.com/wanasit/chrono) - Natural language date parsing
- [commander](https://github.com/tj/commander.js) - CLI framework
