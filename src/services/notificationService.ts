import axios from 'axios';
import createHttpError from 'http-errors';
import { Config } from '../config/index';

export class NotificationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = Config.notification.serviceUrl;
  }

  async sendEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/notify`, {
        eventType,
        data
      });
    } catch (err) {
      console.error('Failed to send notification:', err);
      throw createHttpError(500, 'Notification service error');
    }
  }
}