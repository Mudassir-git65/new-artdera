import { NotificationModel } from "../models";

export async function notify(
  userId: unknown,
  type: string,
  title: string,
  message: string,
  link?: string,
  metadata: Record<string, unknown> = {},
) {
  return NotificationModel.create({ userId, type, title, message, link, metadata });
}
