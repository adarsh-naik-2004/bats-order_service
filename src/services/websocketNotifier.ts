import axios from 'axios';
import { Config } from '../config/index';

export class WebSocketNotifier {
  private baseUrl: string;

  constructor() {
    this.baseUrl = Config.websocket.ServiceUrl;
  }

  async sendEvent(event: Record<string, unknown>): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/order-update`, event);
    } catch (err) {
      console.error('Failed to send event to websocket service:', err);
    }
  }
}