export interface PaymentOptions {
  currency?: "INR";
  amount: number;
  orderId: string;
  storeId: string;
  idempotencyKey?: string;
}
type GatewayPaymentStatus = "no_payment_required" | "paid" | "unpaid";

export interface PaymentSession {
  id: string;
  paymentUrl: string;
  paymentStatus: GatewayPaymentStatus;
}
export interface CustomMetadata {
  orderId: string;
}

export interface VerifiedSession {
  id: string;
  metadata: CustomMetadata;
  paymentStatus: GatewayPaymentStatus;
}

export interface PaymentGW {
  createSession: (options: PaymentOptions) => Promise<PaymentSession>;
  getSession: (id: string) => Promise<VerifiedSession>;
  verifyWebhookSignature: (body: Record<string, unknown>, signature: string) => boolean;
}
