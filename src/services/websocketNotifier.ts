import axios from 'axios';
import { Config } from '../config/index';

export class WebSocketNotifier {
  private baseUrl: string;

  constructor() {
    this.baseUrl = Config.websocket.serviceUrl;
  }

  async sendEvent(event: Record<string, unknown>): Promise<void> {
    try {
      const payload = {
        ...event,
        storeId: event.storeId || null,
      };
      
      await axios.post(`${this.baseUrl}/order-update`, payload);
    } catch (err) {
      console.error('Failed to send event to websocket service:', err);
    }
  }
}