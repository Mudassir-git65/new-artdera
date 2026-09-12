import { randomUUID } from "node:crypto";
import { getEnv } from "../config/env";
import { ApiError } from "../lib/http";

export interface PaymentIntent {
  reference: string;
  amount: number;
  currency: "PKR";
  status: "pending";
}
export interface VerifiedPayment {
  reference: string;
  successful: boolean;
  paidAt?: Date;
  failureReason?: string;
}
export interface PaymentProvider {
  createPayment(input: {
    amount: number;
    currency: "PKR";
    idempotencyKey: string;
  }): Promise<PaymentIntent>;
  verifyPayment(
    reference: string,
    requestedOutcome?: "success" | "failure",
  ): Promise<VerifiedPayment>;
  refundPayment(input: {
    reference: string;
    amount: number;
  }): Promise<{ reference: string; refunded: boolean }>;
  handleWebhook(payload: unknown, signature: string): Promise<{ accepted: boolean }>;
}

class DemoPaymentProvider implements PaymentProvider {
  async createPayment(input: { amount: number; currency: "PKR"; idempotencyKey: string }) {
    return {
      reference: `demo_${input.idempotencyKey}_${randomUUID()}`,
      amount: input.amount,
      currency: input.currency,
      status: "pending" as const,
    };
  }
  async verifyPayment(reference: string, requestedOutcome = "success" as "success" | "failure") {
    return requestedOutcome === "success"
      ? { reference, successful: true, paidAt: new Date() }
      : { reference, successful: false, failureReason: "Demo payment was declined" };
  }
  async refundPayment(input: { reference: string; amount: number }) {
    return { reference: input.reference, refunded: input.amount >= 0 };
  }
  async handleWebhook(_payload: unknown, _signature: string) {
    return { accepted: true };
  }
}

export function paymentProvider(): PaymentProvider {
  const env = getEnv();
  if (env.DEMO_PAYMENT_MODE && env.PAYMENT_PROVIDER === "demo") return new DemoPaymentProvider();
  throw new ApiError(503, "PAYMENT_PROVIDER_UNAVAILABLE", "Payment processing is not configured");
}
