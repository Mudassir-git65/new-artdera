import { ArtworkModel, OrderModel, PaymentModel } from "../models";

/**
 * Releases checkout reservations that were not paid within their server-side
 * window. This operation is idempotent and is safe to run from both the
 * background maintenance loop and checkout entry points.
 */
export async function releaseExpiredReservations(now = new Date()) {
  const expiredArtworks = await ArtworkModel.find({
    status: "reserved",
    reservedUntil: { $lte: now },
  })
    .select("_id reservedBy")
    .lean();
  if (!expiredArtworks.length) return { artworksReleased: 0, ordersCancelled: 0 };

  const artworkIds = expiredArtworks.map((artwork) => artwork._id);
  const expiredOrders = await OrderModel.find({
    status: "awaiting_payment",
    "items.artworkId": { $in: artworkIds },
  })
    .select("_id")
    .lean();
  const orderIds = expiredOrders.map((order) => order._id);

  const [artworkResult, orderResult] = await Promise.all([
    ArtworkModel.updateMany(
      { _id: { $in: artworkIds }, status: "reserved", reservedUntil: { $lte: now } },
      { $set: { status: "published" }, $unset: { reservedBy: 1, reservedUntil: 1 } },
    ),
    OrderModel.updateMany(
      { _id: { $in: orderIds }, status: "awaiting_payment" },
      { $set: { status: "cancelled", paymentStatus: "cancelled", cancelledAt: now } },
    ),
    PaymentModel.updateMany(
      { orderId: { $in: orderIds }, status: { $in: ["initiated", "pending", "processing"] } },
      { $set: { status: "cancelled", failureReason: "Checkout reservation expired" } },
    ),
  ]);

  return {
    artworksReleased: artworkResult.modifiedCount,
    ordersCancelled: orderResult.modifiedCount,
  };
}
