import { NextFunction, Request, Response } from "express";
import couponModel from "./couponModel";
import createHttpError from "http-errors";
import { ROLES } from "../types";
import { AuthRequest } from "../types";

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
  getAll = async (req: AuthRequest, res: Response) => {
    const { role, store: userStoreId } = req.auth;
    const { storeId, isActive, currentPage = 1, perPage = 10 } = req.query;

    const filter: Record<string, unknown> = {};

    if (role === ROLES.MANAGER) {
      filter.storeId = userStoreId;
    } else if (storeId) {
      filter.storeId = Number(storeId);
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Calculate pagination
    const page = Number(currentPage);
    const limit = Number(perPage);
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      couponModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      couponModel.countDocuments(filter),
    ]);

    const responseCoupons = coupons.map((coupon) => ({
      ...coupon.toObject(),
      id: coupon._id.toString(),
    }));

    return res.json({
      data: responseCoupons,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { role, store: userStoreId } = req.auth;
    const updateData = req.body;

    const coupon = await couponModel.findById(id);
    if (!coupon) {
      return next(createHttpError(404, "Coupon not found"));
    }

    if (
      role === ROLES.MANAGER &&
      String(coupon.storeId) !== String(userStoreId)
    ) {
      return next(createHttpError(403, "Not authorized to update this coupon"));
    }

    if (
      role === ROLES.MANAGER &&
      updateData.storeId &&
      updateData.storeId !== userStoreId
    ) {
      return next(createHttpError(403, "Cannot change store association"));
    }

    const updatedCoupon = await couponModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    res.json(updatedCoupon);
  };

  delete = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { role, store: userStoreId } = req.auth;

    const coupon = await couponModel.findById(id);
    if (!coupon) {
      return next(createHttpError(404, "Coupon not found"));
    }

    if (
      role === ROLES.MANAGER &&
      String(coupon.storeId) !== String(userStoreId)
    ) {
      return next(createHttpError(403, "Not authorized to delete this coupon"));
    }

    const updatedCoupon = await couponModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    res.json({ message: "Coupon deactivated", coupon: updatedCoupon });
  };

  reactivate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { role, store: userStoreId } = req.auth;

    const coupon = await couponModel.findById(id);
    if (!coupon) {
      return next(createHttpError(404, "Coupon not found"));
    }

    if (
      role === ROLES.MANAGER &&
      String(coupon.storeId) !== String(userStoreId)
    ) {
      return next(createHttpError(403, "Not authorized to modify this coupon"));
    }

    const updatedCoupon = await couponModel.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true },
    );

    res.json({ message: "Coupon reactivated", coupon: updatedCoupon });
  };
}
