import express from "express";
import authenticate from "../common/middleware/authenticate";
import { asyncWrapper } from "../utils";
import { CouponController } from "./couponController";

const router = express.Router();
const couponController = new CouponController();

router.post("/", authenticate, asyncWrapper(couponController.create));
router.post("/verify", authenticate, asyncWrapper(couponController.verify));
router.get("/", authenticate, asyncWrapper(couponController.getAll)); 
router.put("/:id", authenticate, asyncWrapper(couponController.update));
router.delete("/:id", authenticate, asyncWrapper(couponController.delete)); 
router.post("/:id/reactivate", authenticate, asyncWrapper(couponController.reactivate)); 

export default router;