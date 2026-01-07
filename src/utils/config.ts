import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env file
dotenv.config();

export interface Config {
  dataDir: string;
  logLevel: string;
  checkInterval: number;
  sessionTimeout: number;
  email: {
    enabled: boolean;
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    from?: string;
    to?: string;
  };
}

function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Load and validate configuration
const config: Config = {
  dataDir: path.resolve(process.cwd(), process.env.DATA_DIR || './data'),
  logLevel: process.env.LOG_LEVEL || 'info',
  checkInterval: parseNumber(process.env.CHECK_INTERVAL, 60000),
  sessionTimeout: parseNumber(process.env.SESSION_TIMEOUT, 30),
  email: {
    enabled: parseBoolean(process.env.EMAIL_ENABLED, false),
    host: process.env.SMTP_HOST,
    port: parseNumber(process.env.SMTP_PORT, 587),
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_TO,
  },
};

// Ensure data directory exists
ensureDirectoryExists(config.dataDir);
ensureDirectoryExists(path.join(config.dataDir, '.wwebjs_auth'));

// Ensure logs directory exists
const logsDir = path.resolve(process.cwd(), './logs');
ensureDirectoryExists(logsDir);

export default config;
