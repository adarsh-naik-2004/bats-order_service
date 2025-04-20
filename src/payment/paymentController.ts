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
    const razorpaySignature = req.headers['x-razorpay-signature'] as string;
    const webhookBody = req.body;
  
    if (!this.paymentGw.verifyWebhookSignature(webhookBody, razorpaySignature)) {
      return res.status(400).json({ success: false });
    }
  
    if (webhookBody.event === 'payment.captured') {
      const payment = webhookBody.payload.payment.entity;
      const orderId = payment.notes.orderId;
      const isPaymentSuccess = payment.status === 'captured';
  
      const updatedOrder = await orderModel.findOneAndUpdate(
        { _id: orderId },
        { paymentStatus: isPaymentSuccess ? PaymentStatus.PAID : PaymentStatus.FAILED },
        { new: true },
      );
  
      const brokerMessage = {
        event_type: OrderEvents.PAYMENT_STATUS_UPDATE,
        data: updatedOrder,
      };
  
      await this.broker.sendMessage(
        "order",
        JSON.stringify(brokerMessage),
        updatedOrder._id.toString(),
      );
    }
  
    return res.json({ success: true });
  };
}
