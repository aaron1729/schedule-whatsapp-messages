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

**Software:**
- Node.js >= 18.0.0
- WhatsApp account
- (Optional) SMTP server for email notifications

**System Resources (for server deployment):**
- **Minimum:** 2 CPU cores, 2GB RAM
- Chrome/Puppeteer requires adequate resources for browser automation
- Smaller VPS instances (1 core, 1GB RAM) will experience timeout issues

**Note:** For personal/occasional use, running locally on your Mac/PC is simpler and avoids resource constraints.

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

**QR Code Details:**
- QR code is also saved to `qr-code.txt` with generation timestamp
- Includes both local date/time and ISO timestamp for debugging
- Useful for scanning on a different device or checking when authentication was last needed

### 3. Schedule a Message

```bash
# Schedule with inline text
wa-schedule send "1234567890@c.us" "tomorrow at 2pm" "Meeting reminder!"

# Schedule from a file (looks in txt-messages/ directory)
echo "Your message here" > txt-messages/reminder.txt
wa-schedule send "1234567890@c.us" "in 3 hours" --file reminder.txt

# Or use a full path
wa-schedule send "1234567890@c.us" "in 3 hours" --file /path/to/message.txt

# Skip confirmation prompt (useful for scripting/SSH)
wa-schedule send "1234567890@c.us" "in 3 hours" --file reminder.txt --yes
```

The CLI will show you the parsed time and ask for confirmation before scheduling (unless `--yes` flag is used).

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

# Skip confirmation prompt
wa-schedule send <chatId> <time> <message> --yes
```

**Examples:**
```bash
# Inline message
wa-schedule send "1234567890@c.us" "tomorrow at 2pm" "Hello!"

# From file in txt-messages/ directory
wa-schedule send "1234567890@c.us" "next Monday at 9am" --file announcement.txt

# From file with full path
wa-schedule send "123456789012345@g.us" "in 30 minutes" --file /path/to/message.txt

# Skip confirmation (useful for scripting or SSH usage)
wa-schedule send "1234567890@c.us" "in 1 hour" "Automated reminder" --yes
```

**Time Format Examples:**
- `"tomorrow at 2pm"`
- `"in 3 hours"`
- `"in 30 minutes"`
- `"next Friday at 9am"`
- `"Jan 15 at 2:30pm"`
- `"Monday at 10am"`

**Special `dd` Shortcut:**

For convenience, you can use the `dd` shortcut to automatically schedule from dated message files:

```bash
# Finds the latest YYYY-MM-DD-dd.txt file and uses config-dd for chat ID
wa-schedule send dd "tomorrow at 9am"
```

**How it works:**
1. Reads the chat ID from a `config-dd` file in the project root (gitignored)
2. Searches `txt-messages/` for files matching pattern `YYYY-MM-DD-dd.txt`
3. Selects the file with the latest date (e.g., `2026-01-13-dd.txt`)
4. Validates that the scheduled time matches the file's date in Central Time
5. Shows a confirmation if dates match, or a warning if they don't

**Setup:**
```bash
# Create config-dd with your target chat ID
echo "120363407522639510@g.us" > config-dd

# Create dated message files
echo "Your message content" > txt-messages/2026-01-13-dd.txt
```

This is useful for recurring scheduled messages where you prepare files ahead of time.

#### List Messages

```bash
# List all messages (scheduled and sent)
wa-schedule list

# List only pending messages
wa-schedule list --pending

# List only failed messages
wa-schedule list --failed

# List only sent messages
wa-schedule list --sent
```

**Note:** Sent messages are stored in `data/sent.json` with full details including scheduled time, actual sent time, and message content. Failed messages remain in `data/scheduled.json` with status 'failed' after 3 retry attempts.

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

### Option 1: Server Deployment (24/7 Operation)

**System Requirements:**
- 2+ CPU cores
- 2GB+ RAM minimum
- Linux server (VPS, dedicated, or cloud instance)

**Ubuntu/Debian Setup:**

First, install Chrome dependencies:
```bash
sudo apt-get update
sudo apt-get install -y \
  ca-certificates fonts-liberation libappindicator3-1 libasound2 \
  libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
  libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 \
  libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
  libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
  lsb-release wget xdg-utils
```

Then use PM2 for process management:
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

**Note:** Smaller VPS instances (1 core, 1GB RAM) are insufficient for Chrome/Puppeteer and will experience timeout errors.

### Option 2: Local Deployment (Mac/PC)

**Best for:** Personal use, occasional scheduling (1-2 messages per day)

**Advantages:**
- No server costs
- No resource constraints
- Faster message sending
- Simple setup

**Disadvantage:** Computer must stay awake for messages to send

**Setup:**
```bash
# Keep your Mac awake while daemon runs
caffeinate -i wa-schedule daemon start

# Or run in separate terminals:
# Terminal 1: Keep Mac awake
caffeinate -i

# Terminal 2: Run daemon
wa-schedule daemon start
```

**macOS Sleep Prevention:**
- `caffeinate -i` prevents sleep while command runs
- Press Ctrl+C to stop and allow sleep
- Only needed while waiting for scheduled messages to send

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
- Verify WhatsApp is connected: `wa-schedule status`
- Check `logs/daemon.log` for errors
- Verify chat ID format is correct

### Timeout errors ("Runtime.callFunctionOn timed out")
**Cause:** Insufficient system resources for Chrome/Puppeteer

**Solutions:**
1. **Upgrade server resources** - Minimum 2 CPU cores, 2GB RAM
2. **Run locally instead** - Use `caffeinate -i` on your Mac (avoids resource issues)
3. **Check server load** - Run `free -h` and `nproc` to verify resources
4. **First message works, others timeout** - Indicates resource exhaustion; restart daemon or upgrade server

**Why it happens:**
- Chrome uses 200-300MB RAM and significant CPU
- Small VPS instances (1 core, 1GB RAM) cannot handle browser automation reliably
- Local machines have plenty of resources and work perfectly

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
