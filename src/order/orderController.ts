import { NextFunction, Request, Response } from "express";
import {
  CartItem,
  ProductPricingCache,
  Accessory,
  AccessoryPriceCache,
  ROLES,
  AuthRequest,
} from "../types";
import productCacheModel from "../productCache/productCacheModel";
import accessoryCacheModel from "../accessoryCache/accessoryCacheModel";
import couponModel from "../coupon/couponModel";
import orderModel from "./orderModel";
import { OrderEvents, OrderStatus, PaymentMode, PaymentStatus } from "./orderTypes";
import { PaymentGW } from "../payment/paymentTypes";
import { MessageBroker } from "../types/broker";
import idempotencyModel from "../idempotency/idempotencyModel";
import createHttpError from "http-errors";
import mongoose from "mongoose";
import customerModel from "../customer/customerModel";
export class OrderController {

  constructor(
    private paymentGw: PaymentGW,
    private broker: MessageBroker,
  ) {}


  create = async (req: Request, res: Response, next: NextFunction) => {
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

    const idempotencyKey = req.headers["idempotency-key"];
    const idempotency = await idempotencyModel.findOne({ key: idempotencyKey });

    let newOrder = idempotency ? [idempotency.response] : [];

    if (!idempotency) {
      const session = await mongoose.startSession();
      await session.startTransaction();

      try {
        newOrder = await orderModel.create(
          [
            {
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
            },
          ],
          { session },
        );

        await idempotencyModel.create(
          [{ key: idempotencyKey, response: newOrder[0] }],
          { session },
        );

        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        await session.endSession();

        return next(createHttpError(500, err.message));
      } finally {
        await session.endSession();
      }
    }

    const brokerMessage = {
      event_type: OrderEvents.ORDER_CREATE,
      data: newOrder[0],
    };

    if (paymentMode === PaymentMode.CARD) {
      const session = await this.paymentGw.createSession({
        amount: finalTotal,
        orderId: newOrder[0]._id.toString(),
        storeId: storeId,
        currency: "INR",
        idempotencyKey: idempotencyKey as string,
      });

      if (!session) {
        return next(createHttpError(500, "Payment gateway error."));
      }
      
      await this.broker.sendMessage(
        "order",
        JSON.stringify(brokerMessage),
        newOrder[0]._id.toString(),
      );

      return res.json({ razorpayOrderId: session.id, amount: finalTotal });
    }

    await this.broker.sendMessage(
      "order",
      JSON.stringify(brokerMessage),
      newOrder[0]._id.toString(),
    );

  
    return res.json({ newOrder: newOrder });
  };

  getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { role, store: userStoreId } = req.auth;

    console.log("User role:", role);
    const storeId = req.query.storeId;

    if (role === ROLES.CUSTOMER) {
      return next(createHttpError(403, "Not allowed."));
    }

    if (role === ROLES.ADMIN) {
      const filter = {};

      if (storeId) {
        filter["storeId"] = storeId;
      }

      // todo: VERY IMPORTANT. add pagination.
      const orders = await orderModel
        .find(filter, {}, { sort: { createdAt: -1 } })
        .populate("customerId")
        .exec();

      return res.json(orders);
    }

    if (role === ROLES.MANAGER) {
      const orders = await orderModel
        .find({ storeId: userStoreId }, {}, { sort: { createdAt: -1 } })
        .populate("customerId")
        .exec();

      if (!orders) {
        return next(createHttpError(400, "No orders found."));
      }

      return res.json(orders);
    }

    return next(createHttpError(403, "Not allowed."));
  };
  getMine = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.auth.sub;

    if (!userId) {
      return next(createHttpError(400, "No userId found."));
    }

    // todo: Add error handling.
    const customer = await customerModel.findOne({ userId });

    if (!customer) {
      return next(createHttpError(400, "No customer found."));
    }

    // todo: implement pagination.
    const orders = await orderModel.find(
      { customerId: customer._id },
      { cart: 0 },
    );

    return res.json(orders);
  };

  getSingle = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const orderId = req.params.orderId;
    const { sub: userId, role, store: storeId } = req.auth;

    const fields = req.query.fields
      ? req.query.fields.toString().split(",")
      : []; // ["orderStatus", "paymentStatus"]

    const projection = fields.reduce(
      (acc, field) => {
        acc[field] = 1;
        return acc;
      },
      { customerId: 1 },
    );

    // {
    //   orderStatus: 1,
    //   PaymentStatus: 1,
    // }

    const order = await orderModel
      .findOne({ _id: orderId }, projection)
      .populate("customerId")
      .exec();
    if (!order) {
      return next(createHttpError(400, "Order does not exists."));
    }

    // What roles can access this endpoint: Admin, manager (for their own shop), customer (own order)
    if (role === "admin") {
      return res.json(order);
    }

    const myShopOrder = order.storeId === storeId;
    if (role === "manager" && myShopOrder) {
      return res.json(order);
    }

    if (role === "customer") {
      const customer = await customerModel.findOne({ userId });

      if (!customer) {
        return next(createHttpError(400, "No customer found."));
      }

      if (order.customerId._id.toString() === customer._id.toString()) {
        return res.json(order);
      }
    }

    return next(createHttpError(403, "Operation not permitted."));
  };

  changeStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const { role, store: storeId } = req.auth;
    const orderId = req.params.orderId;

    if (role === ROLES.MANAGER || ROLES.ADMIN) {
      const order = await orderModel.findOne({ _id: orderId });
      if (!order) {
        return next(createHttpError(400, "Order not found."));
      }

      const isMyShopOrder = order.storeId === storeId;

      if (role === ROLES.MANAGER && !isMyShopOrder) {
        return next(createHttpError(403, "Not allowed."));
      }

      const updatedOrder = await orderModel.findOneAndUpdate(
        { _id: orderId },
        // todo: req.body.status <- Put proper validation.
        { orderStatus: req.body.status },
        { new: true },
      );

      const brokerMessage = {
        event_type: OrderEvents.ORDER_STATUS_UPDATE,
        data: updatedOrder,
      };

      await this.broker.sendMessage(
        "order",
        JSON.stringify(brokerMessage),
        updatedOrder._id.toString(),
      );

      return res.json({ _id: updatedOrder._id });
    }

    return next(createHttpError(403, "Not allowed."));
  };


  private async verifyProductCache(productIds: string[]) {
  const cachedProducts = await productCacheModel.find({
    productId: { $in: productIds }
  });

  const missingIds = productIds.filter(id => 
    !cachedProducts.some(p => p.productId === id)
  );

  if (missingIds.length > 0) {
    throw new Error(
      `Missing price configurations for products: ${missingIds.join(', ')}. ` +
      `Sync catalog data first.`
    );
  }
}



  private calculateTotal = async (cart: CartItem[]) => {

    
    const productIds = cart.map((item) => item._id);

    await this.verifyProductCache(productIds);

    const productPricings = await productCacheModel.find({
      productId: {
        $in: productIds,
      },
    }).lean({ flattenMaps: true });

    
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
    cachedProductPrice: ProductPricingCache | undefined,
    accessorysPricings: AccessoryPriceCache[],
  ) => {
    if (!cachedProductPrice?.priceConfiguration) {
      throw new Error(
        `Missing price configuration for product ${item._id}. ` +
        `Sync catalog data first.`
      );
    }
  
    const accessorysTotal = item.chosenConfiguration.selectedAccessorys.reduce(
      (acc, curr) => acc + this.getCurrentAccessoryPrice(curr, accessorysPricings),
      0,
    );
    
    console.log("Available cached dimensions:", Object.keys(cachedProductPrice.priceConfiguration));
    console.log("Chosen dimensions:", Object.keys(item.chosenConfiguration.priceConfiguration));


    const productTotal = Object.entries(item.chosenConfiguration.priceConfiguration).reduce(
      (acc, [dimensionName, selectedOption]) => {
        const dimension = cachedProductPrice.priceConfiguration[dimensionName];
        if (!dimension) {
          throw new Error(`Dimension '${dimensionName}' not found in cached product config.`);
        }
  
        const price = dimension.availableOptions[selectedOption];
        if (price === undefined) {
          throw new Error(
            `Option '${selectedOption}' not found for dimension '${dimensionName}' in cached config.`,
          );
        }
  
        return acc + price;
      },
      0,
    );
  
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
