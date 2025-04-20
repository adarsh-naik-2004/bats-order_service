import Razorpay from 'razorpay';
import crypto from 'crypto';
import config from 'config';
import {
  PaymentGW,
  PaymentOptions,
  VerifiedSession,
  PaymentSession,
} from './paymentTypes';

export class RazorpayGW implements PaymentGW {
  private razorpay: Razorpay;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: config.get('razorpay.keyId'),
      key_secret: config.get('razorpay.secretKey'),
    });
  }

  async createSession(options: PaymentOptions): Promise<PaymentSession> {
    const order = await this.razorpay.orders.create({
      amount: options.amount * 100, // Convert to paise
      currency: options.currency || 'INR',
      receipt: options.orderId,
      notes: {
        orderId: options.orderId,
        storeId: options.storeId,
      },
      payment_capture: true, // Auto-capture payment
    });

    return {
      id: order.id,
      paymentUrl: '', // Frontend will handle payment UI
      paymentStatus: 'unpaid',
    };
  }

  async getSession(id: string): Promise<VerifiedSession> {
    const order = await this.razorpay.orders.fetch(id);
    return {
      id: order.id,
      paymentStatus: (order.status === 'paid') ? 'paid' : 'unpaid',
      metadata: {
        orderId: String(order.notes.orderId),
      },
    };
  }

  verifyWebhookSignature(body: Record<string, unknown>, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', config.get('razorpay.webhookSecret'))
      .update(JSON.stringify(body))
      .digest('hex');
    return expectedSignature === signature;
  }
}