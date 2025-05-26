import { Request, Response } from "express";
import { PaymentGW } from "./paymentTypes";
import orderModel from "../order/orderModel";
import { OrderEvents, PaymentStatus } from "../order/orderTypes";
import { MessageBroker } from "../types/broker";

export class PaymentController {
  constructor(
    private paymentGw: PaymentGW,
    private broker: MessageBroker,
  ) {}
  handleWebhook = async (req: Request, res: Response) => {
    try {
      console.log('Webhook received:', req.headers, req.body);
      if (!req.headers['x-razorpay-signature']) {
        return res.status(401).json({ success: false, error: 'Missing signature' });
      }
      const razorpaySignature = req.headers['x-razorpay-signature'] as string;
      const webhookBody = req.body;
  
      // Verify webhook signature
      if (!this.paymentGw.verifyWebhookSignature(webhookBody, razorpaySignature)) {
        console.error('Invalid webhook signature');
        return res.status(400).json({ success: false });
      }
  
      // Handle payment captured event
      if (webhookBody.event === 'payment.captured') {
        const payment = webhookBody.payload.payment.entity;
        
        // Get order ID from Razorpay order reference
        const orderId = payment.order_id ? 
          await this.getOrderIdFromRazorpayOrder(payment.order_id) :
          payment.notes?.orderId;
  
        if (!orderId) {
          console.error('Missing order reference');
          return res.status(400).json({ success: false });
        }
  
        // Update order status
        const updatedOrder = await orderModel.findByIdAndUpdate(
          orderId,
          {
            paymentStatus: payment.status === 'captured' ? 
              PaymentStatus.PAID : 
              PaymentStatus.FAILED
          },
          { new: true }
        );
  
        if (!updatedOrder) {
          console.error(`Order ${orderId} not found`);
          return res.status(404).json({ success: false });
        }
  
        // Publish order update
        await this.broker.sendMessage(
          'order',
          JSON.stringify({
            event_type: OrderEvents.PAYMENT_STATUS_UPDATE,
            data: updatedOrder
          }),
          updatedOrder._id.toString()
        );
      }
  
      return res.json({ success: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      return res.status(500).json({ success: false });
    }
  };  
  private async getOrderIdFromRazorpayOrder(orderId: string): Promise<string | null> {
    try {
      const order = await this.paymentGw.getSession(orderId);
      return order.metadata.orderId;
    } catch (error) {
      console.error('Error fetching Razorpay order:', error);
      return null;
    }
  }
}

