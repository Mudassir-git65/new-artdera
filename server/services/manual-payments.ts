import { getEnv } from "../config/env";
import { ApiError } from "../lib/http";

export type ManualPaymentMethod = "jazzcash" | "easypaisa" | "hbl";

export const MANUAL_PAYMENT_INSTRUCTION =
  "Send the exact amount to the selected account, then upload your payment screenshot and transaction ID. The purchase will remain pending until ArtDera verifies the payment.";

export function manualPaymentAccount(method: ManualPaymentMethod) {
  const env = getEnv();
  const title =
    method === "jazzcash"
      ? env.JAZZCASH_ACCOUNT_TITLE
      : method === "easypaisa"
        ? env.EASYPAISA_ACCOUNT_TITLE
        : env.HBL_ACCOUNT_TITLE;
  const number =
    method === "jazzcash"
      ? env.JAZZCASH_ACCOUNT_NUMBER
      : method === "easypaisa"
        ? env.EASYPAISA_ACCOUNT_NUMBER
        : env.HBL_ACCOUNT_NUMBER;
  if (!title || !number || (method === "hbl" && !env.HBL_IBAN))
    throw new ApiError(
      503,
      "PAYMENT_ACCOUNT_NOT_CONFIGURED",
      "This payment method is temporarily unavailable. Please choose another method.",
    );
  return {
    method,
    label:
      method === "jazzcash"
        ? "JazzCash"
        : method === "easypaisa"
          ? "Easypaisa"
          : "HBL (Bank Transfer)",
    accountTitle: title,
    accountNumber: number,
    ...(method === "hbl" ? { iban: env.HBL_IBAN, qrCode: env.HBL_QR_CODE_PATH } : {}),
  };
}
