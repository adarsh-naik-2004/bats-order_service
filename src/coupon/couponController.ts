import { NextFunction, Request, Response } from "express";
import couponModel from "./couponModel";
import createHttpError from "http-errors";

export class CouponController {
  create = async (req: Request, res: Response) => {
    const { title, code, validUpto, discount, storeId } = req.body;


    const coupon = await couponModel.create({
      title,
      code,
      discount,
      validUpto,
      storeId,
    });

    return res.json(coupon);
  };


  verify = async (req: Request, res: Response, next: NextFunction) => {
    const { code, storeId } = req.body;

    const coupon = await couponModel.findOne({ code, storeId });

    if (!coupon) {
      const error = createHttpError(400, "Coupon does not exists");
      return next(error);
    }

    const currentDate = new Date();
    const couponDate = new Date(coupon.validUpto);

    if (currentDate <= couponDate) {
      return res.json({ valid: true, discount: coupon.discount });
    }

    return res.json({ valid: false, discount: 0 });
  };
}
