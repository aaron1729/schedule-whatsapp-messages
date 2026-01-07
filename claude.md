# WhatsApp Message Scheduler - Technical Documentation

## Architecture Overview

**Single codebase, dual entry points:**
- **CLI Process** (`src/cli/index.ts`): Short-lived commands for user interaction
- **Daemon Process** (`src/daemon/index.ts`): Long-running background service
- **Communication**: File-based via JSON files in `data/` directory

**Critical Constraint: WhatsApp Session Lock**
- Only ONE process can access the WhatsApp session at a time
- The daemon holds the session while running
- Commands like `list-chats` require stopping the daemon first
- Session stored in `data/.wwebjs_auth/` using LocalAuth strategy

## Key Implementation Details

### File Storage
All data stored in JSON files with atomic writes (write to `.tmp`, then rename):
- `data/scheduled.json` - Pending and failed messages
- `data/sent.json` - Complete history of sent messages
- `data/daemon.json` - Daemon state (PID, heartbeat, WhatsApp connection)

### Message Scheduling Flow
1. User runs: `wa-schedule send "<chatId>" "<time>" --file <filename>`
2. CLI reads file from `txt-messages/` directory (if just filename, no path)
3. Content validated and stored in `scheduled.json` immediately
4. Chrono-node parses natural language time
5. User confirms parsed time
6. Message saved with UUID, scheduled time, and full content
7. **File changes after this point don't affect the scheduled message**

### Daemon Behavior
- Checks for due messages every 60 seconds (configurable via `CHECK_INTERVAL`)
- Messages can arrive up to 60 seconds early (user accepted this tolerance)
- Retry logic on failure: 1min → 5min → 15min delays
- After 3 failures: marked as 'failed', email notification sent
- Updates heartbeat in `daemon.json` every 60 seconds
- Auto-reconnects on WhatsApp disconnection

### Chat ID Formats
WhatsApp uses multiple ID formats:
- `1234567890@c.us` - Individual DMs (traditional format)
- `123456789012345@g.us` - Group chats
- `53004241760480@lid` - Newer Local Identifier format

**All three formats are supported.** The `@lid` format appears in newer WhatsApp versions but phone-based `@c.us` still works for the same contact.

Validation regex: `/^\d+@([cg]\.us|lid)$/`

## Important Behaviors

### File Input (`--file` flag)
- Just filename (e.g., `message.txt`) → looks in `txt-messages/`
- Path separators (e.g., `../message.txt`) → uses absolute/relative path
- File content read **at scheduling time**, not send time
- Content stored in `scheduled.json` - subsequent file edits don't affect message
- Implementation: `src/cli/utils/file-reader.ts` lines 14-16

### Time Parsing
Uses chrono-node for natural language parsing:
- "tomorrow at 2pm"
- "in 5 minutes" (requires "in" prefix for relative times)
- "next Monday at 9am"
- "Jan 15 at 2:30pm"

Parsed date shown to user for confirmation before scheduling.

### Sent Messages
Stored in `data/sent.json` with:
- Original message ID
- Chat ID and message content
- `scheduledTime` - when it was supposed to send
- `sentAt` - actual delivery timestamp
- `createdAt` - when user scheduled it

**Not stored in daemon.log** - only operational events go there.

## Command Reference

### Correct Syntax (time comes BEFORE message)
```bash
# Inline message
wa-schedule send "<chatId>" "<time>" "<message>"

# From file
wa-schedule send "<chatId>" "<time>" --file <filename>
```

### Installation
```bash
npm install
npm run build
npm link  # Creates global 'wa-schedule' command
```

Without `npm link`, use: `node dist/cli/index.js <command>`

### Common Workflows

**Schedule a message:**
```bash
echo "Your message" > txt-messages/reminder.txt
wa-schedule send "1234567890@c.us" "in 5 minutes" --file reminder.txt
```

**List all chats (requires daemon stopped):**
```bash
wa-schedule daemon stop
wa-schedule list-chats
wa-schedule daemon start
```

**Check what's scheduled:**
```bash
wa-schedule list --pending
```

**View sent history:**
```bash
wa-schedule list --sent
```

## Critical Files

### `src/daemon/whatsapp-client.ts`
WhatsApp Web integration:
- Displays QR code on first run (saved to `qr-code.txt`)
- Session persists in `data/.wwebjs_auth/`
- Handles events: qr, authenticated, ready, disconnected, auth_failure
- `sendMessage()` method used by message processor

### `src/storage/messages.ts`
Atomic JSON operations:
- `addScheduledMessage()` - Creates new scheduled message
- `updateScheduledMessage()` - Updates retry count, status, lastError
- `moveToSent()` - Removes from scheduled.json, adds to sent.json
- All use `atomicWrite()` to prevent corruption

### `src/daemon/message-processor.ts`
Message sending logic:
- Checks if message is due: `scheduledTime <= now`
- Attempts send via WhatsApp client
- On failure: increments retryCount, reschedules with delay
- After 3 failures: calls notifier, marks as 'failed'
- On success: calls moveToSent()

### `src/daemon/notifier.ts`
Email notifications:
- Only triggers after 3 retry failures
- Uses nodemailer with SMTP from .env
- Includes: message details, error, retry count
- Gracefully handles email failures (logs, doesn't crash daemon)

## Environment Configuration

Required in `.env`:
```bash
DATA_DIR=./data
LOG_LEVEL=info
CHECK_INTERVAL=60000  # 60 seconds

# Optional email notifications
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Use App Password for Gmail
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=notification-recipient@example.com
```

## Known Quirks & Gotchas

1. **Daemon must be running for messages to send** - Not a cloud service, requires active process
2. **Computer sleep/shutdown stops delivery** - Consider using PM2 or cloud server for reliability
3. **Messages can arrive up to 60 seconds early** - Due to 60-second check interval
4. **Session lock** - Can't run list-chats while daemon is active
5. **QR code in file** - First auth creates `qr-code.txt` (gitignored, personalized)
6. **Shell quoting matters** - Watch for stray commands (like "clear") getting into message text
7. **File content captured at schedule time** - Editing the file later doesn't change scheduled message

## Production Deployment

Use PM2 for process management:
```bash
npm install -g pm2
pm2 start dist/daemon/index.js --name whatsapp-scheduler
pm2 save
pm2 startup
```

## Security Notes

- `data/.wwebjs_auth/` contains encrypted WhatsApp session - **NEVER commit**
- `qr-code.txt` is personalized - gitignored
- `txt-messages/` may contain private messages - gitignored
- `list-chats.txt` contains personal chat data - gitignored
- This uses unofficial WhatsApp API - not recommended for business-critical use

## Git-Ignored Files/Directories

```
qr-code.txt
list-chats.txt
txt-messages/
data/scheduled.json
data/sent.json
data/daemon.json
data/.wwebjs_auth/
data/.wwebjs_cache/
.wwebjs_auth/
.wwebjs_cache/
logs/
.env
```

## Development Commands

```bash
npm run dev          # Watch mode for CLI
npm run build        # Compile TypeScript
npm run start:cli    # Run compiled CLI
npm run start:daemon # Run compiled daemon
```

## Future Improvement Ideas

- More frequent check interval for better timing precision
- Read-only session access for list-chats (avoid stopping daemon)
- Support for media messages (images, videos, audio)
- Web UI for scheduling
- Message templates
- Recurring messages
- Message editing before send time
- Timezone support
