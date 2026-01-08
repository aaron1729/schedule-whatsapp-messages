#!/usr/bin/env node

// Suppress punycode deprecation warning
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return; // Ignore punycode deprecation warnings
  }
  console.warn(warning.stack);
});

import { WhatsAppClient } from './whatsapp-client';
import { Scheduler } from './scheduler';
import { saveDaemonState, removeDaemonState, updateHeartbeat, updateDaemonState } from '../storage/daemon-state';
import { DaemonState } from '../types';
import logger from '../utils/logger';

let whatsappClient: WhatsAppClient | null = null;
let scheduler: Scheduler | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Start the heartbeat updater (updates every minute)
 */
function startHeartbeat(): void {
  // Update immediately
  updateHeartbeat();

  // Then update every minute
  heartbeatInterval = setInterval(() => {
    updateHeartbeat();
  }, 60000); // 60 seconds

  logger.debug('Heartbeat started');
}

/**
 * Stop the heartbeat updater
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  logger.debug('Heartbeat stopped');
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Stop heartbeat
    stopHeartbeat();

    // Stop scheduler
    if (scheduler) {
      scheduler.stop();
    }

    // Destroy WhatsApp client
    if (whatsappClient) {
      await whatsappClient.destroy();
    }

    // Remove daemon state file
    await removeDaemonState();

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error: any) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

/**
 * Main daemon entry point
 */
async function main(): Promise<void> {
  logger.info('Starting WhatsApp Scheduler daemon...');

  try {
    // Create daemon state
    const state: DaemonState = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      lastCheckAt: new Date().toISOString(),
      whatsappConnected: false,
      lastHeartbeat: new Date().toISOString(),
    };
    await saveDaemonState(state);
    logger.info(`Daemon state created (PID: ${process.pid})`);

    // Start heartbeat
    startHeartbeat();

    // Initialize WhatsApp client
    whatsappClient = new WhatsAppClient();
    await whatsappClient.initialize();

    // Wait for WhatsApp to be ready
    await waitForWhatsAppReady(whatsappClient);

    // Update daemon state with WhatsApp connection
    await updateDaemonState({ whatsappConnected: true });

    // Start scheduler
    scheduler = new Scheduler(whatsappClient);
    scheduler.start();

    logger.info('WhatsApp Scheduler daemon is running');
  } catch (error: any) {
    logger.error('Fatal error during daemon startup', {
      error: error.message,
      stack: error.stack,
    });
    await removeDaemonState();
    process.exit(1);
  }
}

/**
 * Wait for WhatsApp client to be ready (with timeout)
 */
async function waitForWhatsAppReady(client: WhatsAppClient): Promise<void> {
  const timeout = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();

  while (!client.isClientReady()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('WhatsApp client failed to become ready within timeout');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', async (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  await shutdown('uncaughtException');
});

process.on('unhandledRejection', async (reason: any) => {
  logger.error('Unhandled rejection', { reason });
  await shutdown('unhandledRejection');
});

// Start the daemon
main();
