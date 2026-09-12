import { Router } from "express";
import { z } from "zod";
import {
  ArtworkModel,
  ConversationModel,
  MessageModel,
  OfferModel,
  OrderModel,
  StoreModel,
  VideoConsultationModel,
} from "../models";
import { ApiError, asyncRoute, ok } from "../lib/http";
import { requireAuth } from "../middleware/auth";
import { moderationFlags, sanitizeText } from "../lib/security";
import { notify } from "../services/notifications";
import { audit } from "../services/audit";

export const messagesRouter = Router();

function participant(conversation: { participants: unknown[] }, userId: unknown) {
  return conversation.participants.some((value) => String(value) === String(userId));
}

function serializeConversation(value: Record<string, any>, userId: unknown) {
  return {
    id: String(value._id),
    participantIds: value.participants.map(String),
    buyerId: String(value.buyerId),
    sellerId: String(value.sellerId),
    storeId: String(value.storeId),
    artworkId: value.artworkId ? String(value.artworkId) : undefined,
    lastMessageAt: value.lastMessageAt?.toISOString?.() ?? value.lastMessageAt ?? value.updatedAt,
    lastMessagePreview: value.lastMessagePreview,
    unreadCount: value.unreadCount ?? 0,
    status:
      value.status === "active"
        ? "Active"
        : value.status === "archived"
          ? "Archived"
          : value.status === "blocked"
            ? "Blocked"
            : "Spam",
    blockedByMe: value.blockedBy?.some((id: unknown) => String(id) === String(userId)),
  };
}

function serializeMessage(value: Record<string, any>) {
  return {
    id: String(value._id),
    conversationId: String(value.conversationId),
    senderId: String(value.senderId),
    recipientId: String(value.recipientId),
    type: value.type,
    body: value.text,
    attachments: value.attachments ?? [],
    attachmentName: value.attachments?.[0]?.name,
    createdAt: value.createdAt?.toISOString?.() ?? value.createdAt,
    read: value.isRead,
    moderationFlags: value.moderationFlags ?? [],
  };
}

messagesRouter.post(
  "/conversations",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        storeId: z.string(),
        artworkId: z.string().optional(),
        message: z.string().trim().min(1).max(4000).optional(),
      })
      .strict()
      .parse(req.body);
    const store = await StoreModel.findById(input.storeId);
    if (!store || !store.isPublished) throw new ApiError(404, "STORE_NOT_FOUND", "Store not found");
    if (String(store.ownerId) === String(req.auth!.user._id))
      throw new ApiError(422, "SELF_CONVERSATION_NOT_ALLOWED", "You cannot message your own store");
    if (
      input.artworkId &&
      !(await ArtworkModel.exists({
        _id: input.artworkId,
        storeId: store._id,
        status: "published",
      }))
    )
      throw new ApiError(404, "ARTWORK_NOT_FOUND", "Artwork not found");
    const conversation = await ConversationModel.findOneAndUpdate(
      { buyerId: req.auth!.user._id, sellerId: store.ownerId, artworkId: input.artworkId ?? null },
      {
        $setOnInsert: {
          participants: [req.auth!.user._id, store.ownerId],
          buyerId: req.auth!.user._id,
          sellerId: store.ownerId,
          storeId: store._id,
          artworkId: input.artworkId,
          status: "active",
        },
      },
      { returnDocument: "after", upsert: true },
    );
    if (input.message) {
      const text = sanitizeText(input.message, 4000);
      const message = await MessageModel.create({
        conversationId: conversation._id,
        senderId: req.auth!.user._id,
        recipientId: store.ownerId,
        text,
        type: "text",
        moderationFlags: moderationFlags(text),
      });
      conversation.lastMessageAt = message.createdAt;
      conversation.lastMessagePreview = text.slice(0, 180);
      await conversation.save();
      await notify(
        store.ownerId,
        "new_message",
        "New message",
        `${req.auth!.user.fullName} sent you a message.`,
        `/artist/dashboard/messages?conversation=${conversation._id}`,
      );
    }
    return ok(
      res,
      serializeConversation(conversation.toObject(), req.auth!.user._id),
      "Conversation ready",
      201,
    );
  }),
);

messagesRouter.get(
  "/conversations",
  requireAuth,
  asyncRoute(async (req, res) => {
    const conversations = await ConversationModel.find({ participants: req.auth!.user._id })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();
    const ids = conversations.map((conversation) => conversation._id);
    const unread = await MessageModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { conversationId: { $in: ids }, recipientId: req.auth!.user._id, isRead: false } },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]);
    const counts = new Map(unread.map((entry) => [String(entry._id), entry.count]));
    return ok(
      res,
      conversations.map((conversation) =>
        serializeConversation(
          { ...conversation, unreadCount: counts.get(String(conversation._id)) ?? 0 },
          req.auth!.user._id,
        ),
      ),
    );
  }),
);

messagesRouter.get(
  "/conversations/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const conversation = await ConversationModel.findById(req.params.id).lean();
    if (!conversation || !participant(conversation, req.auth!.user._id))
      throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    const messages = await MessageModel.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    const offers = await OfferModel.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .lean();
    const consultations = await VideoConsultationModel.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .select(req.auth!.user.role === "admin" ? "+meetingUrl" : "")
      .lean();
    return ok(res, {
      conversation: serializeConversation(conversation, req.auth!.user._id),
      messages: messages.map(serializeMessage),
      offers: offers.map(serializeOffer),
      consultations: consultations.map((item) => serializeConsultation(item, req.auth!.user._id)),
    });
  }),
);

messagesRouter.post(
  "/conversations/:id/messages",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        text: z.string().trim().max(4000).default(""),
        type: z.enum(["text", "image", "document"]).default("text"),
        attachments: z
          .array(
            z
              .object({
                url: z.string().max(1500),
                name: z.string().max(255),
                mimeType: z.string().max(100),
                size: z.number().int().positive(),
              })
              .strict(),
          )
          .max(5)
          .default([]),
      })
      .strict()
      .refine(
        (value) => Boolean(value.text || value.attachments.length),
        "A message or attachment is required",
      )
      .parse(req.body);
    const conversation = await ConversationModel.findById(req.params.id);
    if (!conversation || !participant(conversation, req.auth!.user._id))
      throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    if (conversation.status === "blocked")
      throw new ApiError(403, "CONVERSATION_BLOCKED", "This conversation is blocked");
    const recipientId =
      String(conversation.buyerId) === String(req.auth!.user._id)
        ? conversation.sellerId
        : conversation.buyerId;
    const text = sanitizeText(input.text, 4000);
    let flags = moderationFlags(text);
    if (flags.length) {
      const eligibleOrder = await OrderModel.exists({
        buyerId: conversation.buyerId,
        sellerId: conversation.sellerId,
        status: {
          $in: [
            "paid",
            "seller_confirmed",
            "preparing",
            "ready_for_pickup",
            "shipped",
            "out_for_delivery",
            "delivered",
            "inspection_period",
            "completed",
          ],
        },
      });
      if (eligibleOrder) flags = [];
    }
    const message = await MessageModel.create({
      conversationId: conversation._id,
      senderId: req.auth!.user._id,
      recipientId,
      type: input.type,
      text,
      attachments: input.attachments,
      moderationFlags: flags,
    });
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessagePreview = text.slice(0, 180) || "Attachment";
    await conversation.save();
    await notify(
      recipientId,
      "new_message",
      "New message",
      `${req.auth!.user.fullName} sent you a message.`,
      `/messages?conversation=${conversation._id}`,
    );
    return ok(
      res,
      serializeMessage(message.toObject()),
      flags.length ? "Message sent and flagged for safety review" : "Message sent",
      201,
    );
  }),
);

messagesRouter.post(
  "/conversations/:id/read",
  requireAuth,
  asyncRoute(async (req, res) => {
    const conversation = await ConversationModel.findById(req.params.id).lean();
    if (!conversation || !participant(conversation, req.auth!.user._id))
      throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    await MessageModel.updateMany(
      { conversationId: conversation._id, recipientId: req.auth!.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    return ok(res, { read: true });
  }),
);

messagesRouter.patch(
  "/conversations/:id/status",
  requireAuth,
  asyncRoute(async (req, res) => {
    const { action } = z
      .object({ action: z.enum(["archive", "unarchive", "block", "unblock", "report"]) })
      .strict()
      .parse(req.body);
    const conversation = await ConversationModel.findById(req.params.id);
    if (!conversation || !participant(conversation, req.auth!.user._id))
      throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    const userId = req.auth!.user._id;
    if (action === "archive") conversation.status = "archived";
    if (action === "unarchive") conversation.status = "active";
    if (action === "block") {
      conversation.status = "blocked";
      if (!conversation.blockedBy.some((id: unknown) => String(id) === String(userId)))
        conversation.blockedBy.push(userId);
    }
    if (action === "unblock") {
      conversation.blockedBy = conversation.blockedBy.filter(
        (id: unknown) => String(id) !== String(userId),
      );
      if (!conversation.blockedBy.length) conversation.status = "active";
    }
    if (action === "report") {
      conversation.status = "reported";
      if (!conversation.reportedBy.some((id: unknown) => String(id) === String(userId)))
        conversation.reportedBy.push(userId);
    }
    await conversation.save();
    await audit(req, `conversation.${action}`, "Conversation", conversation._id);
    return ok(res, serializeConversation(conversation.toObject(), userId), "Conversation updated");
  }),
);

messagesRouter.post(
  "/offers",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        conversationId: z.string(),
        offeredPrice: z.number().positive(),
        message: z.string().trim().max(1000).optional(),
        expiresInHours: z.number().int().min(1).max(168).default(48),
      })
      .strict()
      .parse(req.body);
    const conversation = await ConversationModel.findById(input.conversationId);
    if (!conversation || !participant(conversation, req.auth!.user._id))
      throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    if (String(conversation.buyerId) !== String(req.auth!.user._id))
      throw new ApiError(403, "BUYER_ONLY", "Only the buyer can create an offer");
    if (!conversation.artworkId)
      throw new ApiError(422, "ARTWORK_REQUIRED", "This conversation is not linked to an artwork");
    const artwork = await ArtworkModel.findOne({
      _id: conversation.artworkId,
      status: "published",
    });
    if (!artwork) throw new ApiError(409, "ARTWORK_UNAVAILABLE", "The artwork is not available");
    const offer = await OfferModel.create({
      conversationId: conversation._id,
      artworkId: artwork._id,
      buyerId: conversation.buyerId,
      sellerId: conversation.sellerId,
      originalPrice: artwork.discountPrice ?? artwork.price,
      offeredPrice: input.offeredPrice,
      currency: "PKR",
      message: input.message ? sanitizeText(input.message, 1000) : undefined,
      status: "pending",
      expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60_000),
    });
    const message = await MessageModel.create({
      conversationId: conversation._id,
      senderId: req.auth!.user._id,
      recipientId: conversation.sellerId,
      type: "offer",
      text: `Offer: PKR ${input.offeredPrice.toLocaleString("en-PK")}`,
      offerId: offer._id,
    });
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessagePreview = message.text;
    await conversation.save();
    await notify(
      conversation.sellerId,
      "new_offer",
      "New offer",
      `A buyer offered PKR ${input.offeredPrice.toLocaleString("en-PK")}.`,
      `/artist/dashboard/messages?conversation=${conversation._id}`,
    );
    return ok(res, serializeOffer(offer.toObject()), "Offer sent", 201);
  }),
);

messagesRouter.patch(
  "/offers/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        action: z.enum(["accept", "reject", "counter", "withdraw"]),
        counterPrice: z.number().positive().optional(),
      })
      .strict()
      .parse(req.body);
    const offer = await OfferModel.findById(req.params.id);
    if (!offer) throw new ApiError(404, "OFFER_NOT_FOUND", "Offer not found");
    if (offer.status !== "pending" && offer.status !== "countered")
      throw new ApiError(409, "OFFER_NOT_ACTIVE", "This offer is no longer active");
    const isBuyer = String(offer.buyerId) === String(req.auth!.user._id);
    const isSeller = String(offer.sellerId) === String(req.auth!.user._id);
    if (!isBuyer && !isSeller)
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this offer");
    const respondingToCounter = offer.status === "countered";
    if (["accept", "reject"].includes(input.action) && (respondingToCounter ? !isBuyer : !isSeller))
      throw new ApiError(
        403,
        "OFFER_RESPONSE_NOT_ALLOWED",
        "Only the current offer recipient can respond",
      );
    if (input.action === "counter" && (!isSeller || respondingToCounter))
      throw new ApiError(403, "SELLER_ONLY", "Only the seller can make one counter-offer");
    if (input.action === "withdraw" && !isBuyer)
      throw new ApiError(403, "BUYER_ONLY", "Only the buyer can withdraw this offer");
    if (input.action === "counter" && !input.counterPrice)
      throw new ApiError(422, "COUNTER_PRICE_REQUIRED", "Enter a counter price");
    offer.status =
      input.action === "accept"
        ? "accepted"
        : input.action === "reject"
          ? "rejected"
          : input.action === "counter"
            ? "countered"
            : "withdrawn";
    if (input.counterPrice) offer.counterPrice = input.counterPrice;
    await offer.save();
    const recipient = isBuyer ? offer.sellerId : offer.buyerId;
    await notify(
      recipient,
      `offer_${offer.status}`,
      `Offer ${offer.status}`,
      `The offer status changed to ${offer.status}.`,
      `/messages?conversation=${offer.conversationId}`,
    );
    await audit(req, `offer.${offer.status}`, "Offer", offer._id);
    return ok(res, serializeOffer(offer.toObject()), "Offer updated");
  }),
);

messagesRouter.post(
  "/consultations",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        conversationId: z.string(),
        requestedDate: z.coerce.date(),
        requestedTime: z.string().trim().min(1).max(30),
        timezone: z.string().trim().min(1).max(80),
        message: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(req.body);
    const conversation = await ConversationModel.findById(input.conversationId);
    if (!conversation || !participant(conversation, req.auth!.user._id) || !conversation.artworkId)
      throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    const consultation = await VideoConsultationModel.create({
      buyerId: conversation.buyerId,
      sellerId: conversation.sellerId,
      artworkId: conversation.artworkId,
      conversationId: conversation._id,
      requestedDate: input.requestedDate,
      requestedTime: input.requestedTime,
      timezone: input.timezone,
      message: input.message ? sanitizeText(input.message, 1000) : undefined,
      status: "requested",
    });
    const recipient =
      String(conversation.buyerId) === String(req.auth!.user._id)
        ? conversation.sellerId
        : conversation.buyerId;
    await notify(
      recipient,
      "video_request",
      "Video consultation request",
      "A new consultation time was requested.",
      `/messages?conversation=${conversation._id}`,
    );
    return ok(
      res,
      serializeConsultation(consultation.toObject(), req.auth!.user._id),
      "Consultation requested",
      201,
    );
  }),
);

messagesRouter.patch(
  "/consultations/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        action: z.enum(["accept", "reject", "suggest_alternate", "cancel", "complete"]),
        meetingUrl: z.string().url().max(500).optional(),
        alternativeTimes: z
          .array(
            z
              .object({
                requestedDate: z.coerce.date(),
                requestedTime: z.string().max(30),
                timezone: z.string().max(80),
              })
              .strict(),
          )
          .max(5)
          .optional(),
      })
      .strict()
      .parse(req.body);
    const consultation = await VideoConsultationModel.findById(req.params.id).select("+meetingUrl");
    if (!consultation) throw new ApiError(404, "CONSULTATION_NOT_FOUND", "Consultation not found");
    const conversation = await ConversationModel.findById(consultation.conversationId).lean();
    if (!conversation || !participant(conversation, req.auth!.user._id))
      throw new ApiError(404, "CONSULTATION_NOT_FOUND", "Consultation not found");
    consultation.status =
      input.action === "accept"
        ? "accepted"
        : input.action === "reject"
          ? "rejected"
          : input.action === "suggest_alternate"
            ? "alternate_suggested"
            : input.action === "cancel"
              ? "cancelled"
              : "completed";
    if (input.meetingUrl && String(consultation.sellerId) === String(req.auth!.user._id))
      consultation.meetingUrl = input.meetingUrl;
    if (input.alternativeTimes) consultation.alternativeTimes = input.alternativeTimes;
    await consultation.save();
    const recipient =
      String(consultation.buyerId) === String(req.auth!.user._id)
        ? consultation.sellerId
        : consultation.buyerId;
    await notify(
      recipient,
      "video_request_updated",
      "Consultation updated",
      `The consultation is now ${consultation.status}.`,
      `/messages?conversation=${consultation.conversationId}`,
    );
    return ok(
      res,
      serializeConsultation(consultation.toObject(), req.auth!.user._id),
      "Consultation updated",
    );
  }),
);

function serializeOffer(value: Record<string, any>) {
  return {
    id: String(value._id),
    conversationId: String(value.conversationId),
    artworkId: String(value.artworkId),
    buyerId: String(value.buyerId),
    sellerId: String(value.sellerId),
    originalPrice: value.originalPrice,
    amount: value.offeredPrice,
    counterPrice: value.counterPrice,
    status: String(value.status).replace(/^./, (letter) => letter.toUpperCase()),
    message: value.message,
    expiresAt: value.expiresAt?.toISOString?.() ?? value.expiresAt,
    createdAt: value.createdAt?.toISOString?.() ?? value.createdAt,
  };
}

function serializeConsultation(value: Record<string, any>, userId: unknown) {
  const authorized = [String(value.buyerId), String(value.sellerId)].includes(String(userId));
  return {
    id: String(value._id),
    conversationId: String(value.conversationId),
    buyerId: String(value.buyerId),
    sellerId: String(value.sellerId),
    artworkId: String(value.artworkId),
    preferredDate: value.requestedDate?.toISOString?.() ?? value.requestedDate,
    preferredTime: value.requestedTime,
    timezone: value.timezone,
    message: value.message,
    status: value.status,
    meetingLink: authorized ? value.meetingUrl : undefined,
    alternativeTimes: value.alternativeTimes,
  };
}
