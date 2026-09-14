import { randomUUID } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  AffiliateModel,
  ArtworkModel,
  CartModel,
  FollowModel,
  InvoiceModel,
  OrderModel,
  PaymentModel,
  PaymentProofModel,
  PayoutModel,
  PromotionModel,
  ReviewModel,
  ShipmentModel,
  ShippingQuoteModel,
  ShippingRuleModel,
  StoreModel,
  SubscriptionModel,
  UploadModel,
  UserModel,
  WishlistItemModel,
} from "../models";
import { ApiError, asyncRoute, ok } from "../lib/http";
import { requireAuth, requireRole } from "../middleware/auth";
import { publicArtwork, publicAssetUrl, publicStore } from "../lib/serializers";
import { paymentProvider } from "../services/payments";
import { getEnv } from "../config/env";
import { trackWishlistSave } from "../services/view-tracker";
import { notify } from "../services/notifications";
import { audit } from "../services/audit";
import { releaseExpiredReservations } from "../services/reservations";
import {
  MANUAL_PAYMENT_INSTRUCTION,
  manualPaymentAccount,
  type ManualPaymentMethod,
} from "../services/manual-payments";
import {
  affiliatePricing,
  approveCommissionForOrder,
  createCommissionForPaidOrder,
  rejectCommissionForOrder,
  resolveAffiliateAttribution,
} from "../services/affiliates";

export const commerceRouter = Router();
type CartItemValue = {
  artworkId: mongoose.Types.ObjectId;
  quantity: number;
  priceSnapshot?: number;
};
const address = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    line1: z.string().trim().min(3).max(180),
    line2: z.string().trim().max(180).optional(),
    city: z.string().trim().min(2).max(100),
    province: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().max(24).optional(),
    country: z.string().trim().max(80).default("Pakistan"),
    phone: z.string().trim().min(7).max(30),
  })
  .strict();

commerceRouter.get(
  "/cart",
  requireAuth,
  asyncRoute(async (req, res) => {
    await releaseExpiredReservations();
    const cart = await CartModel.findOne({ buyerId: req.auth!.user._id }).lean();
    if (!cart) return ok(res, { items: [], subtotal: 0 });
    const cartItems = cart.items as unknown as CartItemValue[];
    const artworks = await ArtworkModel.find({
      _id: { $in: cartItems.map((item) => item.artworkId) },
    }).lean();
    const byId = new Map(artworks.map((item) => [String(item._id), item]));
    const items = cartItems
      .map((item) => {
        const artwork = byId.get(String(item.artworkId));
        return artwork
          ? {
              artwork: publicArtwork(artwork),
              quantity: item.quantity,
              priceChanged: item.priceSnapshot !== (artwork.discountPrice ?? artwork.price),
              available: artwork.status === "published" && artwork.quantity >= item.quantity,
            }
          : null;
      })
      .filter(Boolean);
    const subtotal = items.reduce<number>(
      (sum, item) => sum + (item!.artwork.discountPrice ?? item!.artwork.price) * item!.quantity,
      0,
    );
    return ok(res, { items, subtotal });
  }),
);

commerceRouter.get(
  "/order-payments/:paymentId/manual",
  requireAuth,
  asyncRoute(async (req, res) => {
    const payment = await PaymentModel.findOne({
      _id: req.params.paymentId,
      userId: req.auth!.user._id,
      paymentType: "order",
      provider: "manual",
    }).lean();
    if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    const order = await OrderModel.findOne({
      _id: payment.orderId,
      buyerId: req.auth!.user._id,
    }).lean();
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
    const method = payment.metadata?.method;
    if (method !== "jazzcash" && method !== "easypaisa" && method !== "hbl")
      throw new ApiError(409, "PAYMENT_METHOD_INVALID", "Payment method is not available");
    const latestProof = await PaymentProofModel.findOne({ paymentId: payment._id })
      .sort({ attempt: -1 })
      .lean();
    const screenshot = latestProof
      ? await UploadModel.findById(latestProof.screenshotId).select("url").lean()
      : undefined;
    return ok(res, {
      order: serializeOrder(order),
      payment: serializePayment(payment),
      paymentInstructions: {
        ...manualPaymentAccount(method),
        amount: payment.amount,
        orderId: order.orderNumber,
        paymentId: String(payment._id),
        instruction: MANUAL_PAYMENT_INSTRUCTION,
      },
      latestProof: latestProof ? serializePaymentProof(latestProof, screenshot?.url) : undefined,
      canSubmit:
        payment.status !== "successful" &&
        (!latestProof ||
          ["rejected", "information_requested"].includes(String(latestProof.status))),
    });
  }),
);

commerceRouter.post(
  "/order-payments/:paymentId/proof",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        fullName: z.string().trim().min(2).max(120),
        mobileNumber: z.string().trim().min(7).max(30),
        transactionId: z.string().trim().min(4).max(120),
        screenshotId: z.string().trim().min(1),
        note: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(req.body);
    const payment = await PaymentModel.findOne({
      _id: req.params.paymentId,
      userId: req.auth!.user._id,
      paymentType: "order",
      provider: "manual",
    });
    if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    if (payment.status === "successful")
      throw new ApiError(409, "PAYMENT_ALREADY_APPROVED", "This payment is already approved");
    const order = await OrderModel.findOne({
      _id: payment.orderId,
      buyerId: req.auth!.user._id,
    });
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
    const method = payment.metadata?.method;
    if (method !== "jazzcash" && method !== "easypaisa" && method !== "hbl")
      throw new ApiError(409, "PAYMENT_METHOD_INVALID", "Payment method is not available");
    const reusedTransaction = await PaymentProofModel.exists({
      paymentId: { $ne: payment._id },
      method,
      transactionId: input.transactionId,
      status: { $ne: "rejected" },
    });
    if (reusedTransaction)
      throw new ApiError(
        409,
        "TRANSACTION_ALREADY_SUBMITTED",
        "This transaction ID has already been submitted for another order",
      );
    const screenshot = await UploadModel.findOne({
      _id: input.screenshotId,
      ownerId: req.auth!.user._id,
      purpose: "payment_proof",
      access: "private",
      attachedTo: { $exists: false },
      mimeType: { $in: ["image/jpeg", "image/png", "image/webp"] },
    });
    if (!screenshot)
      throw new ApiError(
        422,
        "PAYMENT_SCREENSHOT_INVALID",
        "Upload a valid JPG, JPEG, PNG or WebP payment screenshot",
      );
    const dbSession = await mongoose.startSession();
    let proof: any;
    try {
      await dbSession.withTransaction(async () => {
        if (
          await PaymentProofModel.exists({
            paymentId: payment._id,
            isActive: true,
          }).session(dbSession)
        )
          throw new ApiError(
            409,
            "PAYMENT_PROOF_ALREADY_SUBMITTED",
            "Payment proof is already awaiting verification",
          );
        const attempt =
          (await PaymentProofModel.countDocuments({ paymentId: payment._id }).session(dbSession)) +
          1;
        [proof] = await PaymentProofModel.create(
          [
            {
              paymentId: payment._id,
              orderId: order._id,
              paymentType: "order",
              buyerId: req.auth!.user._id,
              method,
              amount: payment.amount,
              customerName: input.fullName,
              mobileNumber: input.mobileNumber,
              transactionId: input.transactionId,
              screenshotId: screenshot._id,
              note: input.note,
              status: "pending_verification",
              isActive: true,
              attempt,
              submittedAt: new Date(),
            },
          ],
          { session: dbSession },
        );
        const attached = await UploadModel.updateOne(
          { _id: screenshot._id, attachedTo: { $exists: false } },
          { $set: { attachedTo: proof._id } },
          { session: dbSession },
        );
        if (!attached.modifiedCount)
          throw new ApiError(
            409,
            "PAYMENT_SCREENSHOT_ALREADY_USED",
            "This screenshot has already been submitted",
          );
        payment.status = "pending_verification";
        order.paymentStatus = "pending_verification";
        order.status = "awaiting_payment_approval";
        await payment.save({ session: dbSession });
        await order.save({ session: dbSession });
        await ArtworkModel.updateMany(
          {
            _id: { $in: order.items.map((item: any) => item.artworkId) },
            reservedBy: req.auth!.user._id,
            status: "reserved",
          },
          { $set: { reservedUntil: new Date(Date.now() + 7 * 24 * 60 * 60_000) } },
          { session: dbSession },
        );
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        Number((error as { code: unknown }).code) === 11000
      )
        throw new ApiError(
          409,
          "PAYMENT_PROOF_ALREADY_SUBMITTED",
          "Payment proof is already awaiting verification",
        );
      throw error;
    } finally {
      await dbSession.endSession();
    }
    const admins = await UserModel.find({ role: "admin", status: "active" }).select("_id").lean();
    await Promise.all([
      ...admins.map((admin) =>
        notify(
          admin._id,
          "payment_proof_submitted",
          "Payment proof awaiting verification",
          `${order.orderNumber} has a new ${
            method === "jazzcash" ? "JazzCash" : method === "easypaisa" ? "Easypaisa" : "HBL"
          } payment proof.`,
          "/admin/payment-verification",
        ),
      ),
      notify(
        order.sellerId,
        "payment_pending_verification",
        "Order payment is under review",
        `Payment proof for ${order.orderNumber} is awaiting ArtDera verification.`,
        "/artist/dashboard/orders",
      ),
    ]);
    await audit(req, "order.payment_proof_submitted", "Order", order._id, undefined, {
      paymentId: String(payment._id),
      proofId: String(proof._id),
      method,
    });
    return ok(
      res,
      {
        proof: serializePaymentProof(proof.toObject(), screenshot.url),
        orderId: order.orderNumber,
        paymentStatus: "Pending Verification",
        orderStatus: "Awaiting Payment Approval",
      },
      "Payment proof submitted",
      201,
    );
  }),
);

commerceRouter.get(
  "/payments/:paymentId/manual",
  requireAuth,
  asyncRoute(async (req, res) => {
    const payment = await PaymentModel.findOne({
      _id: req.params.paymentId,
      userId: req.auth!.user._id,
      provider: "manual",
      paymentType: { $in: ["order", "subscription", "promotion"] },
    }).lean();
    if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    const method = payment.metadata?.method;
    if (method !== "jazzcash" && method !== "easypaisa" && method !== "hbl")
      throw new ApiError(409, "PAYMENT_METHOD_INVALID", "Payment method is not available");

    const [order, promotion, latestProof] = await Promise.all([
      payment.orderId ? OrderModel.findById(payment.orderId).select("orderNumber").lean() : null,
      payment.promotionId
        ? PromotionModel.findById(payment.promotionId).select("promotionType placement").lean()
        : null,
      PaymentProofModel.findOne({ paymentId: payment._id }).sort({ attempt: -1 }).lean(),
    ]);
    const screenshot = latestProof
      ? await UploadModel.findById(latestProof.screenshotId).select("url").lean()
      : undefined;
    const referenceLabel =
      order?.orderNumber ??
      (payment.paymentType === "subscription"
        ? `${String(payment.metadata?.targetPlanId ?? "ArtDera").replaceAll("-", " ")} ${String(
            payment.metadata?.billingCycle ?? "",
          )} subscription`
        : promotion?.placement || promotion?.promotionType || "ArtDera promotion");
    const returnPath =
      payment.paymentType === "order"
        ? "/account/orders"
        : payment.paymentType === "subscription"
          ? "/artist/dashboard/subscription"
          : "/artist/dashboard/promotions";

    return ok(res, {
      payment: serializePayment(payment),
      paymentType: payment.paymentType,
      paymentInstructions: {
        ...manualPaymentAccount(method),
        amount: payment.amount,
        paymentId: String(payment._id),
        referenceLabel,
        instruction: MANUAL_PAYMENT_INSTRUCTION,
      },
      latestProof: latestProof ? serializePaymentProof(latestProof, screenshot?.url) : undefined,
      canSubmit:
        payment.status !== "successful" &&
        (!latestProof ||
          ["rejected", "information_requested"].includes(String(latestProof.status))),
      returnPath,
    });
  }),
);

commerceRouter.post(
  "/payments/:paymentId/proof",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        fullName: z.string().trim().min(2).max(120),
        mobileNumber: z.string().trim().min(7).max(30),
        transactionId: z.string().trim().min(4).max(120),
        screenshotId: z.string().trim().min(1),
        note: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(req.body);
    const payment = await PaymentModel.findOne({
      _id: req.params.paymentId,
      userId: req.auth!.user._id,
      provider: "manual",
      paymentType: { $in: ["order", "subscription", "promotion"] },
    });
    if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    if (payment.status === "successful")
      throw new ApiError(409, "PAYMENT_ALREADY_APPROVED", "This payment is already approved");
    const method = payment.metadata?.method;
    if (method !== "jazzcash" && method !== "easypaisa" && method !== "hbl")
      throw new ApiError(409, "PAYMENT_METHOD_INVALID", "Payment method is not available");
    if (
      await PaymentProofModel.exists({
        paymentId: { $ne: payment._id },
        method,
        transactionId: input.transactionId,
        status: { $ne: "rejected" },
      })
    )
      throw new ApiError(
        409,
        "TRANSACTION_ALREADY_SUBMITTED",
        "This transaction ID has already been submitted for another payment",
      );
    const screenshot = await UploadModel.findOne({
      _id: input.screenshotId,
      ownerId: req.auth!.user._id,
      purpose: "payment_proof",
      access: "private",
      attachedTo: { $exists: false },
      mimeType: { $in: ["image/jpeg", "image/png", "image/webp"] },
    });
    if (!screenshot)
      throw new ApiError(
        422,
        "PAYMENT_SCREENSHOT_INVALID",
        "Upload a valid JPG, JPEG, PNG or WebP payment screenshot",
      );

    const dbSession = await mongoose.startSession();
    let proof: any;
    try {
      await dbSession.withTransaction(async () => {
        if (
          await PaymentProofModel.exists({ paymentId: payment._id, isActive: true }).session(
            dbSession,
          )
        )
          throw new ApiError(
            409,
            "PAYMENT_PROOF_ALREADY_SUBMITTED",
            "Payment proof is already awaiting verification",
          );
        const attempt =
          (await PaymentProofModel.countDocuments({ paymentId: payment._id }).session(dbSession)) +
          1;
        [proof] = await PaymentProofModel.create(
          [
            {
              paymentId: payment._id,
              orderId: payment.orderId,
              subscriptionId: payment.subscriptionId,
              promotionId: payment.promotionId,
              paymentType: payment.paymentType,
              buyerId: req.auth!.user._id,
              method,
              amount: payment.amount,
              customerName: input.fullName,
              mobileNumber: input.mobileNumber,
              transactionId: input.transactionId,
              screenshotId: screenshot._id,
              note: input.note,
              status: "pending_verification",
              isActive: true,
              attempt,
              submittedAt: new Date(),
            },
          ],
          { session: dbSession },
        );
        const attached = await UploadModel.updateOne(
          { _id: screenshot._id, attachedTo: { $exists: false } },
          { $set: { attachedTo: proof._id } },
          { session: dbSession },
        );
        if (!attached.modifiedCount)
          throw new ApiError(
            409,
            "PAYMENT_SCREENSHOT_ALREADY_USED",
            "This screenshot has already been submitted",
          );
        payment.status = "pending_verification";
        await payment.save({ session: dbSession });
        if (payment.orderId) {
          const order = await OrderModel.findOneAndUpdate(
            { _id: payment.orderId, buyerId: req.auth!.user._id },
            {
              $set: {
                paymentStatus: "pending_verification",
                status: "awaiting_payment_approval",
              },
            },
            { returnDocument: "after", session: dbSession },
          );
          if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
          await ArtworkModel.updateMany(
            {
              _id: { $in: order.items.map((item: any) => item.artworkId) },
              status: "reserved",
              reservedBy: req.auth!.user._id,
            },
            { $set: { reservedUntil: new Date(Date.now() + 7 * 24 * 60 * 60_000) } },
            { session: dbSession },
          );
        } else if (payment.subscriptionId) {
          await SubscriptionModel.updateOne(
            { _id: payment.subscriptionId, userId: req.auth!.user._id },
            { $set: { status: "payment_review" } },
            { session: dbSession },
          );
        }
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        Number((error as { code: unknown }).code) === 11000
      )
        throw new ApiError(
          409,
          "PAYMENT_PROOF_ALREADY_SUBMITTED",
          "Payment proof is already awaiting verification",
        );
      throw error;
    } finally {
      await dbSession.endSession();
    }
    const admins = await UserModel.find({ role: "admin", status: "active" }).select("_id").lean();
    await Promise.all(
      admins.map((admin) =>
        notify(
          admin._id,
          "payment_proof_submitted",
          "Payment proof awaiting verification",
          `A ${payment.paymentType} payment has a new ${
            method === "jazzcash" ? "JazzCash" : method === "easypaisa" ? "Easypaisa" : "HBL"
          } proof.`,
          "/admin/payment-verification",
        ),
      ),
    );
    await audit(req, "payment.proof_submitted", "Payment", payment._id, undefined, {
      proofId: String(proof._id),
      paymentType: payment.paymentType,
      method,
    });
    return ok(
      res,
      { proof: serializePaymentProof(proof.toObject(), screenshot.url) },
      "Payment proof submitted",
      201,
    );
  }),
);

commerceRouter.post(
  "/cart/items",
  requireAuth,
  asyncRoute(async (req, res) => {
    await releaseExpiredReservations();
    const input = z
      .object({ artworkId: z.string(), quantity: z.number().int().min(1).max(10).default(1) })
      .strict()
      .parse(req.body);
    const artwork = await ArtworkModel.findOne({
      _id: input.artworkId,
      status: "published",
      moderationStatus: "approved",
    });
    if (!artwork || artwork.quantity < input.quantity)
      throw new ApiError(409, "ARTWORK_UNAVAILABLE", "The artwork is no longer available");
    if (artwork.artworkType === "original" && input.quantity !== 1)
      throw new ApiError(
        422,
        "UNIQUE_ARTWORK_QUANTITY",
        "Original artworks can only be purchased once",
      );
    const store = await StoreModel.findById(artwork.storeId);
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found");
    if (String(store.ownerId) === String(req.auth!.user._id))
      throw new ApiError(422, "SELF_PURCHASE_NOT_ALLOWED", "You cannot buy your own artwork");
    const cart = await CartModel.findOneAndUpdate(
      { buyerId: req.auth!.user._id },
      {
        $pull: { items: { artworkId: artwork._id } },
        $setOnInsert: { buyerId: req.auth!.user._id },
      },
      { returnDocument: "after", upsert: true },
    );
    cart.items.push({
      artworkId: artwork._id,
      quantity: input.quantity,
      priceSnapshot: artwork.discountPrice ?? artwork.price,
    });
    await cart.save();
    return ok(
      res,
      { artworkId: String(artwork._id), quantity: input.quantity },
      "Added to cart",
      201,
    );
  }),
);

commerceRouter.delete(
  "/cart/items/:artworkId",
  requireAuth,
  asyncRoute(async (req, res) => {
    await CartModel.updateOne(
      { buyerId: req.auth!.user._id },
      { $pull: { items: { artworkId: req.params.artworkId } } },
    );
    return ok(res, { artworkId: req.params.artworkId }, "Removed from cart");
  }),
);

commerceRouter.post(
  "/shipping-quotes",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        artworkId: z.string(),
        quantity: z.number().int().min(1).max(10).default(1),
        shippingAddress: address,
      })
      .strict()
      .parse(req.body);
    const artwork = await ArtworkModel.findOne({
      _id: input.artworkId,
      status: "published",
      moderationStatus: "approved",
    });
    if (!artwork) throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork not found");
    if (artwork.quantity < input.quantity)
      throw new ApiError(409, "ARTWORK_UNAVAILABLE", "Not enough quantity available");
    if (artwork.artworkType === "original" && input.quantity !== 1)
      throw new ApiError(
        422,
        "UNIQUE_ARTWORK_QUANTITY",
        "Original artworks can only be purchased once",
      );

    const store = await StoreModel.findById(artwork.storeId);
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found");

    const [quote] = await ShippingQuoteModel.create([
      {
        buyerId: req.auth!.user._id,
        sellerId: store.ownerId,
        storeId: artwork.storeId,
        artworkId: artwork._id,
        buyerName: input.shippingAddress.fullName,
        buyerEmail: req.auth!.user.email,
        buyerPhone: input.shippingAddress.phone,
        country: input.shippingAddress.country,
        city: input.shippingAddress.city,
        province: input.shippingAddress.province,
        postalCode: input.shippingAddress.postalCode,
        shippingAddress: `${input.shippingAddress.line1}${input.shippingAddress.line2 ? ", " + input.shippingAddress.line2 : ""}`,
        quantity: input.quantity,
        status: "new_request",
      },
    ]);

    return ok(res, { quoteId: String(quote._id) }, "Shipping quote requested", 201);
  }),
);

commerceRouter.get(
  "/shipping-quotes",
  requireAuth,
  asyncRoute(async (req, res) => {
    const quotes = await ShippingQuoteModel.find({ buyerId: req.auth!.user._id })
      .sort({ createdAt: -1 })
      .lean();

    // We might want to populate artwork details
    const artworks = await ArtworkModel.find({ _id: { $in: quotes.map((q) => q.artworkId) } })
      .select("title images price discountPrice")
      .lean();
    const artworkById = new Map(artworks.map((a) => [String(a._id), a]));

    const items = quotes.map((quote) => ({
      ...quote,
      id: String(quote._id),
      _id: undefined,
      artwork: artworkById.get(String(quote.artworkId)),
    }));
    return ok(res, items);
  }),
);

commerceRouter.patch(
  "/shipping-quotes/:id/accept",
  requireAuth,
  asyncRoute(async (req, res) => {
    const quote = await ShippingQuoteModel.findOne({
      _id: req.params.id,
      buyerId: req.auth!.user._id,
    });
    if (!quote) throw new ApiError(404, "QUOTE_NOT_FOUND", "Shipping quote not found");
    if (!["quote_provided", "quote_sent"].includes(quote.status))
      throw new ApiError(409, "INVALID_STATUS", "Quote cannot be accepted in its current state");

    quote.status = "accepted";
    quote.acceptedAt = new Date();
    await quote.save();

    await audit(req, "commerce.shipping_quote_accepted", "ShippingQuote", quote._id);
    return ok(res, { id: String(quote._id), status: "accepted" }, "Shipping quote accepted");
  }),
);

commerceRouter.post(
  "/checkout",
  requireAuth,
  asyncRoute(async (req, res) => {
    await releaseExpiredReservations();
    const input = z
      .object({
        shippingAddress: address,
        billingAddress: address.optional(),
        method: z
          .enum(["card", "bank-transfer", "easypaisa", "jazzcash", "raast", "hbl"])
          .default("card"),
        shippingQuoteId: z.string().optional(),
        affiliateCode: z
          .string()
          .trim()
          .min(5)
          .max(20)
          .regex(/^[A-Za-z0-9]+$/)
          .optional(),
        idempotencyKey: z
          .string()
          .uuid()
          .default(() => randomUUID()),
      })
      .strict()
      .parse(req.body);
    const isManualPayment =
      input.method === "jazzcash" || input.method === "easypaisa" || input.method === "hbl";
    if (!isManualPayment && !getEnv().DEMO_PAYMENT_MODE)
      throw new ApiError(
        422,
        "PAYMENT_METHOD_NOT_AVAILABLE",
        "Choose JazzCash, Easypaisa, or HBL to continue",
      );
    const receivingAccount = isManualPayment
      ? manualPaymentAccount(input.method as ManualPaymentMethod)
      : undefined;
    const existingOrders = await OrderModel.find({
      buyerId: req.auth!.user._id,
      checkoutKey: input.idempotencyKey,
    })
      .sort({ createdAt: 1 })
      .lean();
    if (existingOrders.length) {
      const orderIds = existingOrders.map((order) => order._id);
      const [existingPayments, existingInvoices, existingShipments] = await Promise.all([
        PaymentModel.find({ orderId: { $in: orderIds }, paymentType: "order" }).lean(),
        InvoiceModel.find({ orderId: { $in: orderIds } }).lean(),
        ShipmentModel.find({ orderId: { $in: orderIds } }).lean(),
      ]);
      return ok(
        res,
        {
          orders: existingOrders.map((order) => {
            const payment = existingPayments.find(
              (item) => String(item.orderId) === String(order._id),
            );
            const invoice = existingInvoices.find(
              (item) => String(item.orderId) === String(order._id),
            );
            const shipment = existingShipments.find(
              (item) => String(item.orderId) === String(order._id),
            );
            return {
              order: serializeOrder(order),
              payment: payment ? serializePayment(payment) : undefined,
              paymentInstructions:
                payment && receivingAccount && isManualPayment
                  ? {
                      ...receivingAccount,
                      amount: order.buyerTotal,
                      orderId: order.orderNumber,
                      paymentId: String(payment._id),
                      instruction: MANUAL_PAYMENT_INSTRUCTION,
                    }
                  : undefined,
              invoiceId: invoice ? String(invoice._id) : undefined,
              shipmentId: shipment ? String(shipment._id) : undefined,
            };
          }),
          estimateNotice: input.shippingQuoteId
            ? "The accepted international shipping and packaging quote is included in the total."
            : "The buyer pays only the artwork price.",
        },
        "Checkout already created",
      );
    }
    const attribution = await resolveAffiliateAttribution(req, input.affiliateCode);
    let cartItems: CartItemValue[] = [];
    let isInternational = false;
    let quoteCost = 0;
    let quotePackaging = 0;
    let deliveryEstimate = "";

    if (input.shippingQuoteId) {
      const quote = await ShippingQuoteModel.findById(input.shippingQuoteId);
      if (!quote) throw new ApiError(404, "QUOTE_NOT_FOUND", "Shipping quote not found");
      if (String(quote.buyerId) !== String(req.auth!.user._id))
        throw new ApiError(403, "FORBIDDEN", "Not your quote");
      if (quote.status !== "accepted")
        throw new ApiError(422, "QUOTE_NOT_ACCEPTED", "This quote is not accepted yet");

      const artwork = await ArtworkModel.findById(quote.artworkId);
      if (!artwork) throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork not found");

      cartItems = [
        {
          artworkId: quote.artworkId,
          quantity: quote.quantity,
          priceSnapshot: artwork.discountPrice ?? artwork.price,
        },
      ];
      isInternational = true;
      quoteCost = quote.quotedShippingCost ?? 0;
      quotePackaging = quote.quotedPackagingCost ?? 0;
      deliveryEstimate = quote.estimatedDeliveryTime ?? "";
    } else {
      const cart = await CartModel.findOne({ buyerId: req.auth!.user._id });
      if (!cart?.items.length) throw new ApiError(422, "CART_EMPTY", "Your cart is empty");
      cartItems = cart.items as unknown as CartItemValue[];
    }

    const artworks = await ArtworkModel.find({
      _id: { $in: cartItems.map((item) => item.artworkId) },
    });
    if (artworks.length !== cartItems.length)
      throw new ApiError(409, "CART_STALE", "One or more items are no longer available");
    const stores = await StoreModel.find({
      _id: { $in: artworks.map((artwork) => artwork.storeId) },
    });
    const storeById = new Map(stores.map((store) => [String(store._id), store]));
    const cartByArtwork = new Map<string, CartItemValue>(
      cartItems.map((item) => [String(item.artworkId), item]),
    );
    for (const artwork of artworks) {
      const item = cartByArtwork.get(String(artwork._id))!;
      const store = storeById.get(String(artwork.storeId));
      if (!store || artwork.status !== "published" || artwork.quantity < item.quantity)
        throw new ApiError(409, "ARTWORK_UNAVAILABLE", `${artwork.title} is no longer available`);
      if (artwork.artworkType === "original" && item.quantity !== 1)
        throw new ApiError(
          409,
          "UNIQUE_ARTWORK_QUANTITY",
          `${artwork.title} is a one-of-one original and can only be purchased once`,
        );
      if (String(store.ownerId) === String(req.auth!.user._id))
        throw new ApiError(422, "SELF_PURCHASE_NOT_ALLOWED", "You cannot buy your own artwork");
      const currentPrice = artwork.discountPrice ?? artwork.price;
      if (currentPrice !== item.priceSnapshot)
        throw new ApiError(
          409,
          "PRICE_CHANGED",
          `${artwork.title} has a new price. Review your cart before paying.`,
        );
    }
    const groups = new Map<string, typeof artworks>();
    for (const artwork of artworks) {
      const key = String(artwork.storeId);
      groups.set(key, [...(groups.get(key) ?? []), artwork]);
    }
    const prepared: Array<Record<string, any>> = [];
    for (const [storeId, group] of groups) {
      const store = storeById.get(storeId)!;
      const subscription = await SubscriptionModel.findOne({
        userId: store.ownerId,
        status: "active",
      }).lean();
      if (!subscription)
        throw new ApiError(
          409,
          "SELLER_UNAVAILABLE",
          `${store.name} cannot accept orders right now`,
        );
      const subtotal = group.reduce(
        (sum, artwork) =>
          sum +
          (artwork.discountPrice ?? artwork.price) *
            cartByArtwork.get(String(artwork._id))!.quantity,
        0,
      );
      const shippingCost = input.shippingQuoteId ? quoteCost : 0;
      const packagingCost = input.shippingQuoteId ? quotePackaging : 0;
      const paymentProcessingFee = 0;
      const platformCommission = Math.round(subtotal * (subscription.commissionRate / 100));
      const referralPricing = affiliatePricing(
        subtotal,
        subscription.commissionRate,
        attribution?.affiliate,
      );
      const appliedAttribution = referralPricing.applied ? attribution : undefined;
      const buyerTotal =
        referralPricing.eligibleArtworkAmount + shippingCost + packagingCost + paymentProcessingFee;
      const sellerNetAmount = Math.max(0, subtotal - platformCommission - paymentProcessingFee);
      const intent = isManualPayment
        ? {
            reference: `manual_${randomUUID()}`,
            amount: buyerTotal,
            currency: "PKR" as const,
            status: "pending" as const,
          }
        : await paymentProvider().createPayment({
            amount: buyerTotal,
            currency: "PKR",
            idempotencyKey: `${req.auth!.user._id}_${storeId}_${input.idempotencyKey}`,
          });
      prepared.push({
        store,
        subscription,
        group,
        subtotal,
        shippingCost,
        packagingCost,
        paymentProcessingFee,
        platformCommission,
        referralPricing,
        appliedAttribution,
        buyerTotal,
        sellerNetAmount,
        intent,
      });
    }
    const dbSession = await mongoose.startSession();
    const results: Array<Record<string, unknown>> = [];
    try {
      await dbSession.withTransaction(async () => {
        for (const entry of prepared) {
          const orderNumber = `AD-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
          for (const artwork of entry.group) {
            const item = cartByArtwork.get(String(artwork._id))!;
            const reserved = await ArtworkModel.findOneAndUpdate(
              { _id: artwork._id, status: "published", quantity: { $gte: item.quantity } },
              {
                $set: {
                  status: "reserved",
                  reservedBy: req.auth!.user._id,
                  reservedUntil: new Date(Date.now() + 20 * 60_000),
                },
              },
              { returnDocument: "after", session: dbSession },
            );
            if (!reserved)
              throw new ApiError(
                409,
                "ARTWORK_UNAVAILABLE",
                `${artwork.title} was just reserved by another buyer`,
              );
          }
          const [order] = await OrderModel.create(
            [
              {
                orderNumber,
                checkoutKey: input.idempotencyKey,
                buyerId: req.auth!.user._id,
                sellerId: entry.store.ownerId,
                storeId: entry.store._id,
                items: entry.group.map((artwork: any) => ({
                  artworkId: artwork._id,
                  title: artwork.title,
                  image: artwork.images?.[0]?.url,
                  price: artwork.discountPrice ?? artwork.price,
                  quantity: cartByArtwork.get(String(artwork._id))!.quantity,
                })),
                artworkSubtotal: entry.subtotal,
                discount: entry.referralPricing.discount,
                eligibleArtworkAmount: entry.referralPricing.eligibleArtworkAmount,
                affiliateId: entry.appliedAttribution?.affiliate._id,
                affiliateReferralId: entry.appliedAttribution?.referral?._id,
                affiliateCode: entry.appliedAttribution?.affiliate.code,
                affiliateCommissionRate: entry.appliedAttribution?.affiliate.commissionRate,
                affiliateDiscountRate: entry.appliedAttribution?.affiliate.buyerDiscountRate,
                shippingCost: entry.shippingCost,
                packagingCost: entry.packagingCost,
                handlingCost: 0,
                paymentProcessingFee: entry.paymentProcessingFee,
                platformCommission: entry.platformCommission,
                estimatedTax: 0,
                buyerTotal: entry.buyerTotal,
                sellerNetAmount: entry.sellerNetAmount,
                currency: "PKR",
                isInternational,
                shippingQuoteId: input.shippingQuoteId
                  ? new mongoose.Types.ObjectId(input.shippingQuoteId)
                  : undefined,
                deliveryEstimate,
                status: "awaiting_payment",
                paymentStatus: "pending",
                shippingAddress: input.shippingAddress,
                billingAddress: input.billingAddress ?? input.shippingAddress,
                buyerContactSnapshot: {
                  fullName: req.auth!.user.fullName,
                  email: req.auth!.user.email,
                  phone: req.auth!.user.phone,
                },
              },
            ],
            { session: dbSession },
          );
          const [payment] = await PaymentModel.create(
            [
              {
                userId: req.auth!.user._id,
                orderId: order._id,
                paymentType: "order",
                provider: isManualPayment ? "manual" : getEnv().PAYMENT_PROVIDER,
                providerReference: entry.intent.reference,
                amount: entry.buyerTotal,
                currency: "PKR",
                status: "pending",
                metadata: { method: input.method },
              },
            ],
            { session: dbSession },
          );
          const [invoice] = await InvoiceModel.create(
            [
              {
                invoiceNumber: `INV-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
                userId: req.auth!.user._id,
                orderId: order._id,
                paymentId: payment._id,
                items: order.items.map((item: any) => ({
                  description: item.title,
                  quantity: item.quantity,
                  unitPrice: item.price,
                  total: item.price * item.quantity,
                })),
                subtotal: entry.subtotal,
                discount: entry.referralPricing.discount,
                tax: 0,
                total: entry.buyerTotal,
                currency: "PKR",
                status: "issued",
                issuedAt: new Date(),
              },
            ],
            { session: dbSession },
          );
          const [shipment] = await ShipmentModel.create(
            [
              {
                orderId: order._id,
                courier: "Estimate only",
                pickupCity: entry.group[0].pickupCity ?? entry.store.city,
                deliveryCity: input.shippingAddress.city,
                weight: entry.group.reduce(
                  (sum: number, artwork: any) => sum + Number(artwork.weight ?? 0),
                  0,
                ),
                fragile: entry.group.some((artwork: any) => artwork.isFragile),
                packagingType: "Art-safe estimate",
                estimatedCost: entry.shippingCost,
                status: "estimate",
              },
            ],
            { session: dbSession },
          );
          results.push({
            order: serializeOrder(order.toObject()),
            payment: serializePayment(payment.toObject()),
            paymentInstructions:
              receivingAccount && isManualPayment
                ? {
                    ...receivingAccount,
                    amount: entry.buyerTotal,
                    orderId: order.orderNumber,
                    paymentId: String(payment._id),
                    instruction: MANUAL_PAYMENT_INSTRUCTION,
                  }
                : undefined,
            invoiceId: String(invoice._id),
            shipmentId: String(shipment._id),
          });
        }
        if (input.shippingQuoteId) {
          await ShippingQuoteModel.updateOne(
            { _id: input.shippingQuoteId, status: "accepted" },
            { $set: { status: "awaiting_payment" } },
            { session: dbSession },
          );
        } else {
          await CartModel.deleteOne({ buyerId: req.auth!.user._id }).session(dbSession);
        }
      });
    } finally {
      await dbSession.endSession();
    }
    for (const entry of prepared)
      await notify(
        entry.store.ownerId,
        "order_placed",
        "New order awaiting payment",
        "A buyer started checkout for your artwork.",
        "/artist/dashboard/orders",
      );
    await audit(req, "checkout.created", "Order", undefined, undefined, {
      orderIds: results.map((result: any) => result.order.id),
    });
    return ok(
      res,
      {
        orders: results,
        estimateNotice: input.shippingQuoteId
          ? "The accepted international shipping and packaging quote is included in the total."
          : "The buyer pays only the artwork price.",
      },
      "Checkout created",
      201,
    );
  }),
);

commerceRouter.post(
  "/order-payments/:paymentId/confirm-demo",
  requireAuth,
  asyncRoute(async (req, res) => {
    if (!getEnv().DEMO_PAYMENT_MODE)
      throw new ApiError(404, "NOT_FOUND", "The requested resource was not found");
    const { outcome } = z
      .object({ outcome: z.enum(["success", "failure"]).default("success") })
      .strict()
      .parse(req.body);
    const payment = await PaymentModel.findOne({
      _id: req.params.paymentId,
      userId: req.auth!.user._id,
      paymentType: "order",
    });
    if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    const order = await OrderModel.findById(payment.orderId);
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
    if (payment.status === "successful") {
      const created = await createCommissionForPaidOrder(order.toObject());
      if (created && order.affiliateId) {
        const affiliate = await AffiliateModel.findById(order.affiliateId).select("userId").lean();
        if (affiliate)
          await notify(
            affiliate.userId,
            "affiliate_sale_received",
            "Referral sale received",
            `Order ${order.orderNumber} generated a pending ambassador commission.`,
            "/account/ambassador",
          );
      }
      return ok(res, {
        payment: serializePayment(payment.toObject()),
        order: serializeOrder(order.toObject()),
      });
    }
    const verified = await paymentProvider().verifyPayment(payment.providerReference, outcome);
    const dbSession = await mongoose.startSession();
    let commissionCreated = false;
    try {
      await dbSession.withTransaction(async () => {
        if (!verified.successful) {
          payment.status = "failed";
          payment.failureReason = verified.failureReason;
          order.paymentStatus = "failed";
          order.status = "cancelled";
          order.cancelledAt = new Date();
          await ArtworkModel.updateMany(
            {
              _id: { $in: order.items.map((item: any) => item.artworkId) },
              reservedBy: req.auth!.user._id,
              status: "reserved",
            },
            { $set: { status: "published" }, $unset: { reservedBy: 1, reservedUntil: 1 } },
            { session: dbSession },
          );
          if (order.shippingQuoteId)
            await ShippingQuoteModel.updateOne(
              { _id: order.shippingQuoteId, status: "awaiting_payment" },
              { $set: { status: "accepted" } },
              { session: dbSession },
            );
          await rejectCommissionForOrder(order._id, "Payment failed", dbSession);
        } else {
          payment.status = "successful";
          payment.paidAt = verified.paidAt ?? new Date();
          order.paymentStatus = "paid";
          order.status = "paid";
          for (const item of order.items) {
            const sold = await ArtworkModel.findOneAndUpdate(
              {
                _id: item.artworkId,
                status: "reserved",
                reservedBy: req.auth!.user._id,
                quantity: { $gte: item.quantity },
              },
              [
                {
                  $set: {
                    quantity: { $subtract: ["$quantity", item.quantity] },
                    soldCount: { $add: [{ $ifNull: ["$soldCount", 0] }, item.quantity] },
                  },
                },
                {
                  $set: {
                    status: { $cond: [{ $lte: ["$quantity", 0] }, "sold", "published"] },
                  },
                },
                { $unset: ["reservedBy", "reservedUntil"] },
              ],
              { returnDocument: "after", session: dbSession, updatePipeline: true },
            );
            if (!sold)
              throw new ApiError(
                409,
                "ARTWORK_RESERVATION_EXPIRED",
                "The artwork reservation expired before payment completed",
              );
          }
          await InvoiceModel.updateOne(
            { paymentId: payment._id },
            { $set: { status: "paid", paidAt: payment.paidAt } },
            { session: dbSession },
          );
          if (order.shippingQuoteId)
            await ShippingQuoteModel.updateOne(
              { _id: order.shippingQuoteId },
              { $set: { status: "paid" } },
              { session: dbSession },
            );
          commissionCreated = await createCommissionForPaidOrder(order.toObject(), dbSession);
        }
        await payment.save({ session: dbSession });
        await order.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }
    if (verified.successful) {
      await notify(
        order.buyerId,
        "payment_successful",
        "Payment successful",
        `Order ${order.orderNumber} is confirmed.`,
        "/account/orders",
      );
      await notify(
        order.sellerId,
        "payment_successful",
        "Paid order received",
        `Order ${order.orderNumber} is ready for confirmation.`,
        "/artist/dashboard/orders",
      );
      if (commissionCreated && order.affiliateId) {
        const affiliate = await AffiliateModel.findById(order.affiliateId).select("userId").lean();
        if (affiliate)
          await notify(
            affiliate.userId,
            "affiliate_sale_received",
            "Referral sale received",
            `Order ${order.orderNumber} generated a pending ambassador commission.`,
            "/account/ambassador",
          );
      }
    }
    await audit(
      req,
      verified.successful ? "order.payment_succeeded" : "order.payment_failed",
      "Order",
      order._id,
    );
    return ok(
      res,
      { payment: serializePayment(payment.toObject()), order: serializeOrder(order.toObject()) },
      verified.successful ? "Payment successful" : "Payment failed",
    );
  }),
);

commerceRouter.get(
  "/orders",
  requireAuth,
  asyncRoute(async (req, res) => {
    const view = z.enum(["buyer", "seller"]).optional().parse(req.query.view);
    const filter =
      view === "buyer"
        ? { buyerId: req.auth!.user._id }
        : view === "seller"
          ? { sellerId: req.auth!.user._id }
          : req.auth!.user.role === "buyer"
            ? { buyerId: req.auth!.user._id }
            : req.auth!.user.role === "admin"
              ? {}
              : { sellerId: req.auth!.user._id };
    const orders = await OrderModel.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return ok(res, orders.map(serializeOrder));
  }),
);

const transitions: Record<string, string[]> = {
  awaiting_payment: ["paid", "cancelled"],
  awaiting_payment_approval: ["paid", "payment_confirmed", "awaiting_payment", "cancelled"],
  paid: ["seller_confirmed", "cancelled", "disputed"],
  payment_confirmed: ["seller_confirmed", "cancelled", "disputed"],
  seller_confirmed: ["preparing", "cancelled", "disputed"],
  preparing: ["ready_for_pickup", "cancelled", "disputed"],
  ready_for_pickup: ["shipped", "cancelled", "disputed"],
  shipped: ["out_for_delivery", "delivered", "disputed"],
  out_for_delivery: ["delivered", "disputed"],
  delivered: ["inspection_period", "return_requested", "disputed"],
  inspection_period: ["completed", "return_requested", "disputed"],
  return_requested: ["returned", "refunded", "disputed"],
  returned: ["refunded"],
};
const sellerTransitions = new Set([
  "seller_confirmed",
  "preparing",
  "ready_for_pickup",
  "shipped",
  "out_for_delivery",
  "delivered",
]);
const buyerTransitions = new Set([
  "cancelled",
  "inspection_period",
  "completed",
  "return_requested",
  "disputed",
]);

commerceRouter.patch(
  "/orders/:id/status",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { status } = z
      .object({
        status: z.enum([
          "paid",
          "seller_confirmed",
          "preparing",
          "ready_for_pickup",
          "shipped",
          "out_for_delivery",
          "delivered",
          "inspection_period",
          "completed",
          "return_requested",
          "returned",
          "refunded",
          "cancelled",
          "disputed",
        ]),
      })
      .strict()
      .parse(req.body);
    const order = await OrderModel.findById(req.params.id);
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
    const isBuyer = String(order.buyerId) === String(req.auth!.user._id);
    const isSeller = String(order.sellerId) === String(req.auth!.user._id);
    const isAdmin = req.auth!.user.role === "admin";
    if (!isBuyer && !isSeller && !isAdmin)
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this order");
    if (!transitions[order.status]?.includes(status))
      throw new ApiError(
        409,
        "INVALID_ORDER_TRANSITION",
        `Order cannot move from ${order.status} to ${status}`,
      );
    if (!isAdmin && sellerTransitions.has(status) && !isSeller)
      throw new ApiError(403, "SELLER_ONLY", "Only the seller can make this update");
    if (!isAdmin && buyerTransitions.has(status) && !isBuyer)
      throw new ApiError(403, "BUYER_ONLY", "Only the buyer can make this update");
    const before = order.status;
    order.status = status;
    if (status === "delivered") {
      order.inspectionEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60_000);
      await ShipmentModel.updateOne(
        { orderId: order._id },
        { $set: { status: "delivered", deliveredAt: new Date() } },
      );
    }
    if (status === "completed") {
      order.completedAt = new Date();
      const subscription = await SubscriptionModel.findOne({
        userId: order.sellerId,
        status: "active",
      }).lean();
      const payoutDays =
        subscription?.planId === "free" ? 10 : subscription?.planId === "professional" ? 7 : 5;
      await PayoutModel.updateOne(
        { orderId: order._id },
        {
          $setOnInsert: {
            sellerId: order.sellerId,
            grossAmount: order.artworkSubtotal,
            commissionDeduction: order.platformCommission,
            paymentFeeDeduction: order.paymentProcessingFee,
            shippingDeduction: 0,
            taxDeduction: 0,
            refundAdjustment: 0,
            netAmount: order.sellerNetAmount,
            status: "pending",
            availableAt: new Date(Date.now() + payoutDays * 24 * 60 * 60_000),
          },
        },
        { upsert: true },
      );
      await notify(
        order.sellerId,
        "payout_available",
        "Payout scheduled",
        `Payout for ${order.orderNumber} has been scheduled.`,
        "/artist/dashboard/payouts",
      );
    }
    await order.save();
    if (["cancelled", "returned", "refunded"].includes(status)) {
      await PayoutModel.updateMany(
        { orderId: order._id },
        { $set: { status: "cancelled", netAmount: 0 } },
      );
      const rejected = await rejectCommissionForOrder(
        order._id,
        `Order ${status.replaceAll("_", " ")}`,
      );
      if (rejected.modifiedCount && order.affiliateId) {
        const affiliate = await AffiliateModel.findById(order.affiliateId).select("userId").lean();
        if (affiliate)
          await notify(
            affiliate.userId,
            "affiliate_commission_rejected",
            "Commission rejected",
            `Commission for ${order.orderNumber} was rejected because the order was ${status.replaceAll("_", " ")}.`,
            "/account/ambassador",
          );
      }
    }
    const commissionApproved =
      status === "completed" && (await approveCommissionForOrder(order._id));
    if (commissionApproved && order.affiliateId) {
      const affiliate = await AffiliateModel.findById(order.affiliateId).select("userId").lean();
      if (affiliate)
        await notify(
          affiliate.userId,
          "affiliate_commission_approved",
          "Commission approved",
          `Commission for ${order.orderNumber} is now available for payout.`,
          "/account/ambassador",
        );
    }
    await notify(
      isBuyer ? order.sellerId : order.buyerId,
      `order_${status}`,
      "Order updated",
      `${order.orderNumber} is now ${status.replaceAll("_", " ")}.`,
      isBuyer ? "/artist/dashboard/orders" : "/account/orders",
    );
    await audit(req, "order.status_changed", "Order", order._id, { status: before }, { status });
    return ok(res, serializeOrder(order.toObject()), "Order updated");
  }),
);

commerceRouter.get(
  "/shipping/:orderId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const order = await OrderModel.findById(req.params.orderId).lean();
    if (
      !order ||
      (![String(order.buyerId), String(order.sellerId)].includes(String(req.auth!.user._id)) &&
        req.auth!.user.role !== "admin")
    )
      throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
    const shipment = await ShipmentModel.findOne({ orderId: order._id }).lean();
    return ok(res, shipment ? serializeShipment(shipment) : null);
  }),
);

commerceRouter.post(
  "/shipping/estimate",
  requireAuth,
  requireRole("artist", "gallery", "gallery_staff"),
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        city: z.string().trim().min(2).max(100),
        province: z.string().trim().min(2).max(100).optional(),
        weightKg: z.number().positive().max(500),
        fragile: z.boolean().default(false),
        framed: z.boolean().default(false),
        packagingType: z.enum(["art_box", "wooden_crate", "tube"]).default("art_box"),
      })
      .strict()
      .parse(req.body);
    const rule = await ShippingRuleModel.findOne({
      isActive: true,
      $or: [
        { city: input.city },
        ...(input.province ? [{ province: input.province }] : []),
        { city: { $exists: false }, province: { $exists: false } },
      ],
    })
      .sort({ city: -1, province: -1 })
      .lean();
    const courierCost = Math.round(
      (rule?.baseCost ?? 1500) +
        input.weightKg * (rule?.perKgCost ?? 250) +
        (input.fragile ? (rule?.fragileSurcharge ?? 500) : 0) +
        (input.framed ? (rule?.framingSurcharge ?? 300) : 0),
    );
    const packagingCost =
      input.packagingType === "wooden_crate"
        ? 1600
        : input.packagingType === "tube"
          ? 450
          : input.fragile
            ? 500
            : 250;
    return ok(res, {
      currency: "PKR",
      courierCost,
      packagingCost,
      total: courierCost + packagingCost,
      ruleName: rule?.name ?? "Default ArtDera shipping estimate",
      isCourierQuote: false,
      notice: "This is a server-calculated marketplace estimate, not a confirmed courier quote.",
    });
  }),
);

commerceRouter.patch(
  "/shipping/:orderId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        courier: z.string().trim().max(100).optional(),
        trackingNumber: z.string().trim().max(100).optional(),
        status: z
          .enum([
            "awaiting_pickup",
            "picked_up",
            "in_transit",
            "out_for_delivery",
            "delivered",
            "delayed",
            "damaged",
            "returned",
          ])
          .optional(),
        actualCost: z.number().nonnegative().optional(),
      })
      .strict()
      .parse(req.body);
    const order = await OrderModel.findOne({
      _id: req.params.orderId,
      sellerId: req.auth!.user._id,
    });
    if (!order && req.auth!.user.role !== "admin")
      throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
    const shipment = await ShipmentModel.findOneAndUpdate(
      { orderId: req.params.orderId },
      {
        $set: input,
        $push: input.status
          ? {
              trackingEvents: {
                status: input.status,
                description: `Status changed to ${input.status}`,
                occurredAt: new Date(),
              },
            }
          : {},
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!shipment) throw new ApiError(404, "SHIPMENT_NOT_FOUND", "Shipment not found");
    return ok(res, serializeShipment(shipment), "Shipment updated");
  }),
);

commerceRouter.get(
  "/payouts",
  requireAuth,
  requireRole("artist", "gallery", "admin"),
  asyncRoute(async (req, res) => {
    const filter = req.auth!.user.role === "admin" ? {} : { sellerId: req.auth!.user._id };
    const payouts = await PayoutModel.find(filter).sort({ createdAt: -1 }).lean();
    return ok(
      res,
      payouts.map((value) => ({
        id: String(value._id),
        sellerId: String(value.sellerId),
        orderId: String(value.orderId),
        gross: value.grossAmount,
        commission: value.commissionDeduction,
        shippingDeduction: value.shippingDeduction,
        taxEstimate: value.taxDeduction,
        processingDeduction: value.paymentFeeDeduction,
        refundAdjustment: value.refundAdjustment,
        net: value.netAmount,
        status:
          value.status === "completed"
            ? "Paid"
            : value.status === "available"
              ? "Available"
              : value.status === "on_hold"
                ? "On Hold"
                : "Pending",
        estimatedDate: value.availableAt?.toISOString(),
      })),
    );
  }),
);

commerceRouter.post(
  "/reviews",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        orderId: z.string(),
        artworkId: z.string(),
        rating: z.number().int().min(1).max(5),
        title: z.string().trim().max(150).default(""),
        comment: z.string().trim().max(3000).default(""),
      })
      .strict()
      .parse(req.body);
    const order = await OrderModel.findOne({
      _id: input.orderId,
      buyerId: req.auth!.user._id,
      status: "completed",
      "items.artworkId": input.artworkId,
    });
    if (!order)
      throw new ApiError(
        403,
        "REVIEW_NOT_ELIGIBLE",
        "Only completed-order buyers can review this artwork",
      );
    if (String(order.sellerId) === String(req.auth!.user._id))
      throw new ApiError(422, "SELF_REVIEW_NOT_ALLOWED", "You cannot review yourself");
    if (await ReviewModel.exists({ orderId: order._id, artworkId: input.artworkId }))
      throw new ApiError(409, "REVIEW_EXISTS", "This order item has already been reviewed");
    const review = await ReviewModel.create({
      orderId: order._id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      storeId: order.storeId,
      artworkId: input.artworkId,
      rating: input.rating,
      title: input.title,
      comment: input.comment,
      status: "approved",
    });
    const rating = await ReviewModel.aggregate([
      { $match: { storeId: order.storeId, status: "approved" } },
      { $group: { _id: "$storeId", rating: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    await StoreModel.updateOne(
      { _id: order.storeId },
      { $set: { rating: rating[0]?.rating ?? 0, reviewCount: rating[0]?.count ?? 0 } },
    );
    return ok(res, serializeReview(review.toObject()), "Review published", 201);
  }),
);

commerceRouter.patch(
  "/reviews/:id/respond",
  requireAuth,
  requireRole("artist", "gallery"),
  asyncRoute(async (req, res) => {
    const { response } = z
      .object({ response: z.string().trim().min(1).max(2000) })
      .strict()
      .parse(req.body);
    const review = await ReviewModel.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.auth!.user._id },
      { $set: { sellerResponse: response } },
      { returnDocument: "after" },
    ).lean();
    if (!review) throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found");
    return ok(res, serializeReview(review), "Response saved");
  }),
);

commerceRouter.get(
  "/reviews/public/:storeId",
  asyncRoute(async (req, res) => {
    const reviews = await ReviewModel.find({ storeId: req.params.storeId, status: "approved" })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return ok(res, reviews.map(serializeReview));
  }),
);

commerceRouter.get(
  "/reviews",
  requireAuth,
  asyncRoute(async (req, res) => {
    const view = z.enum(["buyer", "seller"]).optional().parse(req.query.view);
    const filter =
      view === "buyer"
        ? { buyerId: req.auth!.user._id }
        : view === "seller"
          ? { sellerId: req.auth!.user._id }
          : req.auth!.user.role === "buyer"
            ? { buyerId: req.auth!.user._id }
            : { sellerId: req.auth!.user._id };
    const reviews = await ReviewModel.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, reviews.map(serializeReview));
  }),
);

commerceRouter.get(
  "/wishlist",
  requireAuth,
  asyncRoute(async (req, res) => {
    const records = await WishlistItemModel.find({ userId: req.auth!.user._id })
      .sort({ createdAt: -1 })
      .lean();
    const artworks = await ArtworkModel.find({
      _id: { $in: records.map((record) => record.artworkId) },
      status: "published",
    }).lean();
    return ok(res, artworks.map(publicArtwork));
  }),
);

commerceRouter.post(
  "/wishlist/:artworkId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const artwork = await ArtworkModel.findOne({ _id: req.params.artworkId, status: "published" });
    if (!artwork) throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork not found");
    const result = await WishlistItemModel.updateOne(
      { userId: req.auth!.user._id, artworkId: artwork._id },
      { $setOnInsert: { userId: req.auth!.user._id, artworkId: artwork._id } },
      { upsert: true },
    );
    if (result.upsertedCount) {
      await ArtworkModel.updateOne({ _id: artwork._id }, { $inc: { wishlistCount: 1 } });
      void trackWishlistSave(artwork.storeId, artwork._id, req.auth!.user._id);
    }
    return ok(res, { artworkId: String(artwork._id), saved: true }, "Saved to wishlist", 201);
  }),
);

commerceRouter.delete(
  "/wishlist/:artworkId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const result = await WishlistItemModel.deleteOne({
      userId: req.auth!.user._id,
      artworkId: req.params.artworkId,
    });
    if (result.deletedCount)
      await ArtworkModel.updateOne(
        { _id: req.params.artworkId, wishlistCount: { $gt: 0 } },
        { $inc: { wishlistCount: -1 } },
      );
    return ok(res, { artworkId: req.params.artworkId, saved: false }, "Removed from wishlist");
  }),
);

commerceRouter.get(
  "/follows",
  requireAuth,
  asyncRoute(async (req, res) => {
    const follows = await FollowModel.find({ userId: req.auth!.user._id }).lean();
    const stores = await StoreModel.find({
      _id: { $in: follows.map((follow) => follow.storeId) },
      isPublished: true,
    }).lean();
    return ok(res, stores.map(publicStore));
  }),
);

commerceRouter.post(
  "/follows/:storeId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const store = await StoreModel.findOne({ _id: req.params.storeId, isPublished: true });
    if (!store) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found");
    const result = await FollowModel.updateOne(
      { userId: req.auth!.user._id, storeId: store._id },
      { $setOnInsert: { userId: req.auth!.user._id, storeId: store._id } },
      { upsert: true },
    );
    if (result.upsertedCount)
      await StoreModel.updateOne({ _id: store._id }, { $inc: { totalFollowers: 1 } });
    return ok(res, { storeId: String(store._id), following: true }, "Store followed", 201);
  }),
);

commerceRouter.delete(
  "/follows/:storeId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const result = await FollowModel.deleteOne({
      userId: req.auth!.user._id,
      storeId: req.params.storeId,
    });
    if (result.deletedCount)
      await StoreModel.updateOne(
        { _id: req.params.storeId, totalFollowers: { $gt: 0 } },
        { $inc: { totalFollowers: -1 } },
      );
    return ok(res, { storeId: req.params.storeId, following: false }, "Store unfollowed");
  }),
);

function serializeOrder(value: Record<string, any>) {
  const labels: Record<string, string> = {
    awaiting_payment: "Awaiting Payment",
    awaiting_payment_approval: "Awaiting Payment Approval",
    paid: "Paid",
    payment_confirmed: "Payment Confirmed",
    seller_confirmed: "Seller Confirmed",
    preparing: "Preparing",
    ready_for_pickup: "Ready for Pickup",
    shipped: "Shipped",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    inspection_period: "Inspection Period",
    completed: "Completed",
    return_requested: "Return Requested",
    returned: "Returned",
    refunded: "Refunded",
    cancelled: "Cancelled",
    disputed: "Disputed",
  };
  return {
    id: String(value._id),
    orderNumber: value.orderNumber,
    buyerId: String(value.buyerId),
    sellerId: String(value.sellerId),
    storeId: String(value.storeId),
    items: (value.items ?? []).map((item: any) => ({
      id: String(item._id),
      artworkId: String(item.artworkId),
      title: item.title,
      price: item.price,
      quantity: item.quantity,
      image: publicAssetUrl(item.image),
    })),
    status: labels[value.status] ?? value.status,
    paymentStatus: String(value.paymentStatus)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    subtotal: value.artworkSubtotal,
    discount: value.discount,
    eligibleArtworkAmount: value.eligibleArtworkAmount ?? value.artworkSubtotal - value.discount,
    affiliateCode: value.affiliateCode,
    affiliateDiscountRate: value.affiliateDiscountRate,
    shipping: value.shippingCost,
    packaging: value.packagingCost,
    commission: value.platformCommission,
    total: value.buyerTotal,
    deliveryCity: value.shippingAddress?.city ?? "",
    createdAt: value.createdAt?.toISOString?.() ?? value.createdAt,
    inspectionEndsAt: value.inspectionEndsAt?.toISOString?.() ?? value.inspectionEndsAt,
  };
}

function serializePayment(value: Record<string, any>) {
  return {
    id: String(value._id),
    userId: String(value.userId),
    orderId: value.orderId ? String(value.orderId) : undefined,
    amount: value.amount,
    status:
      value.status === "successful"
        ? "Paid"
        : value.status === "pending_verification"
          ? "Pending Verification"
          : value.status === "information_requested"
            ? "More Information Requested"
            : value.status === "rejected"
              ? "Rejected"
              : value.status === "failed"
                ? "Failed"
                : "Pending",
    reference: value.providerReference,
    createdAt: value.createdAt?.toISOString?.() ?? value.createdAt,
    failureReason: value.failureReason,
  };
}

function serializePaymentProof(value: Record<string, any>, screenshotUrl?: string) {
  const statusLabels: Record<string, string> = {
    pending_verification: "Pending Verification",
    approved: "Paid",
    rejected: "Rejected",
    information_requested: "More Information Requested",
  };
  return {
    id: String(value._id),
    paymentId: String(value.paymentId),
    orderId: value.orderId ? String(value.orderId) : undefined,
    paymentType: value.paymentType,
    method: value.method,
    amount: value.amount,
    fullName: value.customerName,
    mobileNumber: value.mobileNumber,
    transactionId: value.transactionId,
    screenshotUrl,
    note: value.note,
    status: statusLabels[value.status] ?? value.status,
    attempt: value.attempt,
    submittedAt: value.submittedAt?.toISOString?.() ?? value.submittedAt,
    rejectionReason: value.reviewReason,
  };
}

function serializeShipment(value: Record<string, any>) {
  const labels: Record<string, string> = {
    estimate: "Packaging Required",
    awaiting_pickup: "Awaiting Pickup",
    picked_up: "Picked Up",
    in_transit: "In Transit",
    out_for_delivery: "In Transit",
    delivered: "Delivered",
    delayed: "Delayed",
    damaged: "Damaged",
    returned: "Returned",
  };
  return {
    id: String(value._id),
    orderId: String(value.orderId),
    status: labels[value.status] ?? value.status,
    courier: value.courier,
    trackingNumber: value.trackingNumber,
    pickupCity: value.pickupCity,
    deliveryCity: value.deliveryCity,
    estimatedCost: value.estimatedCost,
    actualCost: value.actualCost,
    estimateOnly: value.status === "estimate",
    trackingEvents: value.trackingEvents,
    updatedAt: value.updatedAt?.toISOString?.() ?? value.updatedAt,
  };
}

function serializeReview(value: Record<string, any>) {
  return {
    id: String(value._id),
    orderId: String(value.orderId),
    artworkId: String(value.artworkId),
    buyerId: String(value.buyerId),
    sellerId: String(value.sellerId),
    rating: value.rating,
    title: value.title,
    body: value.comment,
    sellerResponse: value.sellerResponse,
    status:
      value.status === "approved"
        ? "Published"
        : value.status === "suspended"
          ? "Reported"
          : "Pending",
    createdAt: value.createdAt?.toISOString?.() ?? value.createdAt,
  };
}
