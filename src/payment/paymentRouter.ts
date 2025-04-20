import express from "express";
import { asyncWrapper } from "../utils";
import { PaymentController } from "./paymentController";
import { createMessageBroker } from "../common/factories/brokerFactory";
import { RazorpayGW } from "./razorpay";

const router = express.Router();

const paymentGW = new RazorpayGW();
const broker = createMessageBroker();

const paymentController = new PaymentController(paymentGW, broker);

router.post("/webhook", asyncWrapper(paymentController.handleWebhook));

export default router;
