export interface Coupon {
  id: string;
  title: string;
  code: string;
  validUpto: Date;
  storeId: number;
  discount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
