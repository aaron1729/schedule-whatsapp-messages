import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import logger from '../utils/logger';
import config from '../utils/config';
import * as path from 'path';

export class WhatsAppClient {
  private client: Client;
  private isReady: boolean = false;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(config.dataDir, '.wwebjs_auth'),
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // QR code for authentication
    this.client.on('qr', (qr: string) => {
      logger.info('QR code received. Please scan with your WhatsApp mobile app:');
      qrcode.generate(qr, { small: true });
    });

    // Authentication successful
    this.client.on('authenticated', () => {
      logger.info('WhatsApp authenticated successfully');
    });

    // Authentication failed
    this.client.on('auth_failure', (msg: string) => {
      logger.error('WhatsApp authentication failed', { message: msg });
      this.isConnected = false;
    });

    // Client is ready
    this.client.on('ready', () => {
      logger.info('WhatsApp client is ready!');
      this.isReady = true;
      this.isConnected = true;
    });

    // Disconnected
    this.client.on('disconnected', (reason: string) => {
      logger.warn('WhatsApp disconnected', { reason });
      this.isReady = false;
      this.isConnected = false;
    });

    // Loading screen
    this.client.on('loading_screen', (percent: number) => {
      logger.debug(`Loading WhatsApp... ${percent}%`);
    });
  }

  /**
   * Initialize and start the WhatsApp client
   */
  async initialize(): Promise<void> {
    logger.info('Initializing WhatsApp client...');
    await this.client.initialize();
  }

  /**
   * Send a message to a chat
   * @param chatId WhatsApp chat ID (e.g., "1234567890@c.us" or "123456789012345@g.us")
   * @param message Message text to send
   * @returns true if sent successfully, false otherwise
   */
  async sendMessage(chatId: string, message: string): Promise<boolean> {
    if (!this.isReady) {
      logger.error('Cannot send message: WhatsApp client not ready');
      return false;
    }

    try {
      await this.client.sendMessage(chatId, message);
      logger.info('Message sent successfully', { chatId });
      return true;
    } catch (error: any) {
      logger.error('Failed to send message', {
        chatId,
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Check if client is ready to send messages
   */
  isClientReady(): boolean {
    return this.isReady;
  }

  /**
   * Check if client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Destroy the WhatsApp client
   */
  async destroy(): Promise<void> {
    logger.info('Destroying WhatsApp client...');
    await this.client.destroy();
    this.isReady = false;
    this.isConnected = false;
  }

  /**
   * Get the underlying client instance (for advanced usage)
   */
  getClient(): Client {
    return this.client;
  }
}
