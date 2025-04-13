export interface Coupon {
  id: string;
  title: string;
  code: string;
  validUpto: Date;
  storeId: number;
  discount: number;
  createdAt: Date;
  updatedAt: Date;
}
