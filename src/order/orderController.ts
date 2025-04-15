import { Request, Response } from "express";
import {
  CartItem,
  ProductPricingCache,
  Accessory,
  AccessoryPriceCache,
} from "../types";
import productCacheModel from "../productCache/productCacheModel";
import accessoryCacheModel from "../accessoryCache/accessoryCacheModel";
import couponModel from "../coupon/couponModel";
import orderModel from "./orderModel";
import { OrderStatus, PaymentStatus } from "./orderTypes";

export class OrderController {
  create = async (req: Request, res: Response) => {
    const {
      cart,
      couponCode,
      storeId,
      paymentMode,
      customerId,
      comment,
      address,
    } = req.body;


    const totalPrice = await this.calculateTotal(cart);

    let discountPercentage = 0;

    if (couponCode) {
      discountPercentage = await this.getDiscountPercentage(
        couponCode,
        storeId,
      );
    }

    const discountAmount = Math.round((totalPrice * discountPercentage) / 100);

    const priceAfterDiscount = totalPrice - discountAmount;

    const TAXES_PERCENT = 18;

    const taxes = Math.round((priceAfterDiscount * TAXES_PERCENT) / 100);
    const DELIVERY_CHARGES = 100;

    const finalTotal = priceAfterDiscount + taxes + DELIVERY_CHARGES;

    const newOrder = await orderModel.create({
      cart,
      address,
      comment,
      customerId,
      deliveryCharges: DELIVERY_CHARGES,
      discount: discountAmount,
      taxes,
      storeId,
      total: finalTotal,
      paymentMode,
      orderStatus: OrderStatus.RECEIVED,
      paymentStatus: PaymentStatus.PENDING,
    });

    return res.json({ newOrder: newOrder });
  };

  private calculateTotal = async (cart: CartItem[]) => {
    const productIds = cart.map((item) => item._id);

    const productPricings = await productCacheModel.find({
      productId: {
        $in: productIds,
      },
    });

  
    // 1. call catalog service.
    // 2. Use price from cart <- BAD

    const cartAccessoryIds = cart.reduce((acc, item) => {
      return [
        ...acc,
        ...item.chosenConfiguration.selectedAccessorys.map(
          (accessory) => accessory.id,
        ),
      ];
    }, []);

    const accessoryPricings = await accessoryCacheModel.find({
      accessoryId: {
        $in: cartAccessoryIds,
      },
    });

    const totalPrice = cart.reduce((acc, curr) => {
      const cachedProductPrice = productPricings.find(
        (product) => product.productId === curr._id,
      );

      return (
        acc +
        curr.qty * this.getItemTotal(curr, cachedProductPrice, accessoryPricings)
      );
    }, 0);

    return totalPrice;
  };

  private getItemTotal = (
    item: CartItem,
    cachedProductPrice: ProductPricingCache,
    accessorysPricings: AccessoryPriceCache[],
  ) => {
    const accessorysTotal = item.chosenConfiguration.selectedAccessorys.reduce(
      (acc, curr) => {
        return acc + this.getCurrentAccessoryPrice(curr, accessorysPricings);
      },
      0,
    );

    const productTotal = Object.entries(
      item.chosenConfiguration.priceConfiguration,
    ).reduce((acc, [key, value]) => {
      const price =
        cachedProductPrice.priceConfiguration[key].availableOptions[value];
      return acc + price;
    }, 0);

    return productTotal + accessorysTotal;
  };

  private getCurrentAccessoryPrice = (
    accessory: Accessory,
    accessoryPricings: AccessoryPriceCache[],
  ) => {
    const currentAccessory = accessoryPricings.find(
      (current) => accessory.id === current.accessoryId,
    );

    if (!currentAccessory) {
      return accessory.price;
    }

    return currentAccessory.price;
  };

  private getDiscountPercentage = async (
    couponCode: string,
    storeId: string,
  ) => {
    const code = await couponModel.findOne({ code: couponCode, storeId });

    if (!code) {
      return 0;
    }

    const currentDate = new Date();
    const couponDate = new Date(code.validUpto);

    if (currentDate <= couponDate) {
      return code.discount;
    }

    return 0;
  };
}
