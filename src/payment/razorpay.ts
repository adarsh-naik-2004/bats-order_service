// razorpay.ts
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Config } from '../config/index';
import {
  PaymentGW,
  PaymentOptions,
  PaymentSession,
  VerifiedSession
} from './paymentTypes';

export class RazorpayGW implements PaymentGW {
  private razorpay: Razorpay;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: Config.razorpay.keyId, // Add type assertion
      key_secret: Config.razorpay.secretKey,
    });
  }

  async createSession(options: PaymentOptions): Promise<PaymentSession> {
    try {
      const razorpayOrder = await this.razorpay.orders.create({
        amount: options.amount * 100,
        currency: options.currency || 'INR',
        receipt: options.orderId,
        notes: {
          orderId: options.orderId,
          storeId: options.storeId,
        },
        payment_capture: true // Keep as number (Razorpay expects 1/0)
      });

      return {
        id: razorpayOrder.id,
        paymentUrl: this.generatePaymentUrl(razorpayOrder.id),
        paymentStatus: 'unpaid'
      };
    } catch (error) {
      console.error('Razorpay session creation failed:', error);
      throw new Error('Payment gateway error');
    }
  }

  async getSession(id: string): Promise<VerifiedSession> {
    try {
      const order = await this.razorpay.orders.fetch(id);
      return {
        id: order.id,
        paymentStatus: order.status === 'paid' ? 'paid' : 'unpaid',
        metadata: {
          orderId: String(order.notes?.orderId || '')
        }
      };
    } catch (error) {
      console.error('Failed to fetch Razorpay session:', error);
      throw new Error('Payment session lookup failed');
    }
  }

  private generatePaymentUrl(orderId: string): string {
    return `https://checkout.razorpay.com/v1/pay/${orderId}`;
  }

  verifyWebhookSignature(body: unknown, signature: string): boolean {
    try {
      const webhookSecret = Config.razorpay.webhookSecret; // Add type assertion
      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');
        
      return crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(signature)
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
}