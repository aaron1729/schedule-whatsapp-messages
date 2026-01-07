import { Command } from 'commander';
import { spawn } from 'child_process';
import * as path from 'path';
import { loadDaemonState, isDaemonRunning } from '../../storage/daemon-state';
import { success, error, info, warning } from '../utils/formatting';
import { formatDateTime } from '../../utils/date-parser';

export function daemonCommand(program: Command): void {
  const daemon = program
    .command('daemon')
    .description('Manage the WhatsApp scheduler daemon');

  // Start daemon
  daemon
    .command('start')
    .description('Start the daemon')
    .action(async () => {
      try {
        // Check if already running
        const running = await isDaemonRunning();
        if (running) {
          warning('Daemon is already running');
          const state = await loadDaemonState();
          if (state) {
            console.log(`  PID: ${state.pid}`);
            console.log(`  Started: ${formatDateTime(new Date(state.startedAt))}`);
          }
          process.exit(0);
        }

        info('Starting WhatsApp scheduler daemon...');

        // Find the daemon script path
        const daemonScript = path.join(__dirname, '..', '..', 'daemon', 'index.js');

        // Spawn daemon process (detached)
        const daemonProcess = spawn('node', [daemonScript], {
          detached: true,
          stdio: 'ignore',
        });

        // Unref so parent can exit
        daemonProcess.unref();

        // Wait a bit for daemon to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if daemon started successfully
        const state = await loadDaemonState();
        if (state) {
          success(`Daemon started (PID: ${state.pid})`);
          info('The daemon will authenticate with WhatsApp and display a QR code if needed.');
          info('Check logs/daemon.log for details.');
        } else {
          error('Daemon may have failed to start. Check logs/daemon.log for details.');
          process.exit(1);
        }
      } catch (err: any) {
        error(`Failed to start daemon: ${err.message}`);
        process.exit(1);
      }
    });

  // Stop daemon
  daemon
    .command('stop')
    .description('Stop the daemon')
    .action(async () => {
      try {
        const state = await loadDaemonState();

        if (!state) {
          warning('Daemon is not running');
          process.exit(0);
        }

        info(`Stopping daemon (PID: ${state.pid})...`);

        // Send SIGTERM to daemon process
        try {
          process.kill(state.pid, 'SIGTERM');
        } catch (err: any) {
          if (err.code === 'ESRCH') {
            // Process doesn't exist
            warning('Daemon process not found (may have already stopped)');
            // Clean up state file
            await import('../../storage/daemon-state').then(m => m.removeDaemonState());
            process.exit(0);
          } else {
            throw err;
          }
        }

        // Wait for daemon to stop
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify stopped
        const stillRunning = await isDaemonRunning();
        if (!stillRunning) {
          success('Daemon stopped');
        } else {
          warning('Daemon may still be running. Try "wa-schedule daemon status"');
        }
      } catch (err: any) {
        error(`Failed to stop daemon: ${err.message}`);
        process.exit(1);
      }
    });

  // Daemon status
  daemon
    .command('status')
    .description('Check daemon status')
    .action(async () => {
      try {
        const state = await loadDaemonState();

        if (!state) {
          console.log('Daemon: Not running');
          process.exit(0);
        }

        const running = await isDaemonRunning();

        if (!running) {
          console.log('Daemon: Stopped (stale state file)');
          process.exit(0);
        }

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

        // Show status
        console.log('');
        success('Daemon: Running');
        console.log(`  PID: ${state.pid}`);
        console.log(`  Uptime: ${uptimeStr}`);
        console.log(`  WhatsApp: ${state.whatsappConnected ? 'Connected' : 'Disconnected'}`);
        console.log(`  Last check: ${formatDateTime(new Date(state.lastCheckAt))}`);
        console.log(`  Last heartbeat: ${formatDateTime(new Date(state.lastHeartbeat))}`);
        console.log('');
      } catch (err: any) {
        error(`Failed to check daemon status: ${err.message}`);
        process.exit(1);
      }
    });
}
