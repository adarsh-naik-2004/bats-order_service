import express from "express";
import authenticate from "../common/middleware/authenticate";
import { asyncWrapper } from "../utils";
import { OrderController } from "./orderController";
import { RazorpayGW } from "../payment/razorpay";
import { NotificationService } from "../services/notificationService"; 
import { WebSocketNotifier } from "../services/websocketNotifier";
const router = express.Router();

const paymentGw = new RazorpayGW();
const notificationService = new NotificationService(); 
const websocketNotifier = new WebSocketNotifier();

const orderController = new OrderController(paymentGw, notificationService, websocketNotifier);

router.post("/", authenticate, asyncWrapper(orderController.create));

router.get("/", authenticate, asyncWrapper(orderController.getAll));
router.get("/mine", authenticate, asyncWrapper(orderController.getMine));
router.get("/:orderId", authenticate, asyncWrapper(orderController.getSingle));
router.patch(
  "/change-status/:orderId",
  authenticate,
  asyncWrapper(orderController.changeStatus),
);

export default router;
