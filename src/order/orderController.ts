import { NextFunction, Request, Response } from "express";
import axios from "axios";
import { CartItem, ROLES, AuthRequest } from "../types";
import couponModel from "../coupon/couponModel";
import orderModel from "./orderModel";
import {
  OrderEvents,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
} from "./orderTypes";
import { PaymentGW } from "../payment/paymentTypes";
import idempotencyModel from "../idempotency/idempotencyModel";
import createHttpError from "http-errors";
import mongoose from "mongoose";
import customerModel from "../customer/customerModel";
import { NotificationService } from "../services/notificationService";
import { WebSocketNotifier } from "../services/websocketNotifier";
import { Config } from "../config/index";
export class OrderController {
  constructor(
    private paymentGw: PaymentGW,
    private notificationService: NotificationService,
    private websocketNotifier: WebSocketNotifier,
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

    const customer = await customerModel.findById(customerId);
    if (!customer) {
      return next(createHttpError(400, "Customer not found"));
    }

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

    let orderDoc = newOrder[0];
    if (!(orderDoc instanceof mongoose.Document)) {
      orderDoc = new orderModel(orderDoc);
    }

    if (paymentMode === PaymentMode.CARD) {
      const session = await this.paymentGw.createSession({
        amount: finalTotal,
        orderId: orderDoc._id.toString(),
        storeId: storeId,
        currency: "INR",
        idempotencyKey: idempotencyKey as string,
      });

      if (!session) {
        return next(createHttpError(500, "Payment gateway error."));
      }

      await this.websocketNotifier.sendEvent({
        topic: "order",
        event_type: OrderEvents.ORDER_CREATE,
        data: { ...orderDoc.toObject(), customerEmail: customer.email },
      });

      await this.notificationService.sendEvent(OrderEvents.ORDER_CREATE, {
        ...orderDoc.toObject(),
        customerEmail: customer.email,
      });

      return res.json({ razorpayOrderId: session.id, amount: finalTotal });
    }

    await this.websocketNotifier.sendEvent({
      topic: "order",
      event_type: OrderEvents.ORDER_CREATE,
      data: { ...orderDoc.toObject(), customerEmail: customer.email },
    });

    await this.notificationService.sendEvent(OrderEvents.ORDER_CREATE, {
      ...orderDoc.toObject(),
      customerEmail: customer.email,
    });

    return res.json({ newOrder: [orderDoc] });
  };

  getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { role, store: userStoreId } = req.auth;

    console.log("User role:", role);
    const storeId = req.query.storeId;

    if (role === ROLES.CUSTOMER) {
      return next(createHttpError(403, "Not allowed."));
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    if (role === ROLES.ADMIN) {
      const filter: Record<string, unknown> = {};
      if (storeId) filter.storeId = storeId;

      const [orders, total] = await Promise.all([
        orderModel
          .find(filter)
          .populate("customerId")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        orderModel.countDocuments(filter),
      ]);

      return res.json({
        data: orders,
        total,
        page,
        limit,
      });
    }

    if (role === ROLES.MANAGER) {
      const [orders, total] = await Promise.all([
        orderModel
          .find({ storeId: parseInt(userStoreId) })
          .populate("customerId")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        orderModel.countDocuments({ storeId: parseInt(userStoreId) }),
      ]);

      return res.json({
        data: orders,
        total,
        page,
        limit,
      });
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

      const customer = await customerModel.findById(updatedOrder.customerId);
      if (!customer) {
        console.log(`Customer not found for order: ${updatedOrder._id}`);
      }

      await this.websocketNotifier.sendEvent({
        topic: "order",
        event_type: OrderEvents.ORDER_STATUS_UPDATE,
        data: {
          orderId: updatedOrder._id.toString(),
          ...updatedOrder.toObject(),
          customerEmail: customer?.email,
        },
      });

      await this.notificationService.sendEvent(
        OrderEvents.ORDER_STATUS_UPDATE,
        {
          orderId: updatedOrder._id.toString(),
          ...updatedOrder.toObject(),
          customerEmail: customer?.email,
        },
      );

      return res.json({ _id: updatedOrder._id });
    }

    return next(createHttpError(403, "Not allowed."));
  };

  private calculateTotal = async (cart: CartItem[]) => {
    try {
      // Extract product IDs from cart
      const productIds = cart.map((item) => item._id);
      console.log("Fetching prices for product IDs:", productIds);

      const response = await axios.post(
        `${Config.collection.serviceUrl}/products/prices`,
        { ids: productIds },
        { timeout: 15000 }, // Increased timeout
      );

      console.log("Received price response:", response.data);

      const products = response.data as {
        id: string; // Note: this is "id" not "_id"
        priceConfiguration: Record<
          string,
          {
            priceType: string;
            availableOptions: Record<string, number>;
            _id?: string; // Handle the optional _id field
          }
        >;
      }[];

      // Create lookup maps for faster access
      const productMap = new Map<
        string,
        Record<string, { availableOptions: Record<string, number> }>
      >();

      products.forEach((p) => {
        // Create a simplified structure without _id fields
        const simplifiedConfig: Record<
          string,
          { availableOptions: Record<string, number> }
        > = {};

        Object.entries(p.priceConfiguration).forEach(([dimension, config]) => {
          simplifiedConfig[dimension] = {
            availableOptions: config.availableOptions,
          };
        });

        productMap.set(p.id, simplifiedConfig);
      });

      // Calculate total price
      return cart.reduce((total, item) => {
        const productPriceConfig = productMap.get(item._id);

        if (!productPriceConfig) {
          console.error(`Missing price config for product: ${item._id}`);
          throw new Error(`Price config missing for product ${item._id}`);
        }

        // Validate chosen configuration
        if (
          !item.chosenConfiguration ||
          !item.chosenConfiguration.priceConfiguration
        ) {
          throw new Error(`Missing configuration for product ${item._id}`);
        }

        const productPrice = Object.entries(
          item.chosenConfiguration.priceConfiguration,
        ).reduce((sum, [dimension, option]) => {
          const dimensionConfig = productPriceConfig[dimension];
          if (!dimensionConfig) {
            throw new Error(
              `Dimension '${dimension}' not found for product ${item._id}`,
            );
          }

          const price = dimensionConfig.availableOptions[option];
          if (price === undefined) {
            throw new Error(
              `Option '${option}' not found for dimension '${dimension}' in product ${item._id}`,
            );
          }

          return sum + price;
        }, 0);

        return total + item.qty * productPrice;
      }, 0);
    } catch (error) {
      console.error("Price calculation failed:", {
        error: error.message,
        stack: error.stack,
      });

      if (axios.isAxiosError(error)) {
        console.error("Axios error details:", {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          headers: error.config?.headers,
        });
      }

      throw new Error("Failed to calculate order total");
    }
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
