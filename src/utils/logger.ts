import winston from 'winston';
import * as path from 'path';
import config from './config';

// Determine if we're in daemon mode or CLI mode
const isDaemon = process.argv[1]?.includes('daemon');

// Create logger with different transports based on context
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'whatsapp-scheduler' },
  transports: [],
});

if (isDaemon) {
  // Daemon: log to file
  logger.add(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'daemon.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );

  // Also log errors to console in daemon mode for debugging
  logger.add(
    new winston.transports.Console({
      level: 'error',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
} else {
  // CLI: log to console only
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export default logger;
