import * as fs from 'fs/promises';
import * as path from 'path';
import { DaemonState } from '../types';
import config from '../utils/config';
import logger from '../utils/logger';

const DAEMON_STATE_FILE = path.join(config.dataDir, 'daemon.json');

/**
 * Atomically write JSON to a file
 */
async function atomicWrite(filePath: string, data: any): Promise<void> {
  const tempFile = `${filePath}.tmp`;

  try {
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempFile, filePath);
  } catch (error) {
    try {
      await fs.unlink(tempFile);
    } catch {
      // Ignore
    }
    throw error;
  }
}

/**
 * Load daemon state from file
 * Returns null if file doesn't exist
 */
export async function loadDaemonState(): Promise<DaemonState | null> {
  try {
    const content = await fs.readFile(DAEMON_STATE_FILE, 'utf-8');
    return JSON.parse(content) as DaemonState;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }

    logger.error('Failed to parse daemon state file', { error: error.message });
    return null;
  }
}

/**
 * Save daemon state to file
 */
export async function saveDaemonState(state: DaemonState): Promise<void> {
  await atomicWrite(DAEMON_STATE_FILE, state);
}

/**
 * Remove daemon state file
 */
export async function removeDaemonState(): Promise<void> {
  try {
    await fs.unlink(DAEMON_STATE_FILE);
    logger.info('Removed daemon state file');
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      logger.error('Failed to remove daemon state file', { error: error.message });
    }
  }
}

/**
 * Update heartbeat timestamp in daemon state
 */
export async function updateHeartbeat(): Promise<void> {
  const state = await loadDaemonState();

  if (state) {
    state.lastHeartbeat = new Date().toISOString();
    await saveDaemonState(state);
  }
}

/**
 * Update daemon state fields
 */
export async function updateDaemonState(updates: Partial<DaemonState>): Promise<void> {
  const state = await loadDaemonState();

  if (state) {
    const updatedState = { ...state, ...updates };
    await saveDaemonState(updatedState);
  }
}

/**
 * Check if daemon is running by verifying heartbeat is recent
 * Heartbeat should update every minute
 */
export async function isDaemonRunning(): Promise<boolean> {
  const state = await loadDaemonState();

  if (!state) {
    return false;
  }

  const lastHeartbeat = new Date(state.lastHeartbeat);
  const now = new Date();
  const diffMs = now.getTime() - lastHeartbeat.getTime();

  // Consider daemon dead if heartbeat is older than 2 minutes
  const HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000;

  return diffMs < HEARTBEAT_TIMEOUT_MS;
}
