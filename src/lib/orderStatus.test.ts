import { describe, it, expect } from "vitest";
import { formatOrderRef, needsFulfillment, isShippedOrDelivered, orderStatusBadge, isSale } from "./orderStatus";
import { applicationStatusBadge } from "./applicationStatus";

describe("order status", () => {
  it("treats a paid, unshipped order as needing fulfillment", () => {
    expect(needsFulfillment("paid")).toBe(true);
    expect(needsFulfillment("pending")).toBe(false);
    expect(orderStatusBadge("paid").label).toBe("NEEDS FULFILLMENT");
  });

  it("labels shipped and delivered separately", () => {
    expect(orderStatusBadge("shipped").label).toBe("SHIPPED");
    expect(orderStatusBadge("delivered").label).toBe("DELIVERED");
    expect(isShippedOrDelivered("shipped")).toBe(true);
    expect(isShippedOrDelivered("paid")).toBe(false);
  });

  it("only counts returned orders as returned", () => {
    expect(orderStatusBadge("returned").label).toBe("RETURNED");
    expect(orderStatusBadge("paid").label).not.toBe("RETURNED");
  });

  it("counts paid through delivered as sales", () => {
    expect(["paid", "processing", "shipped", "delivered"].every(isSale)).toBe(true);
    expect(["pending", "cancelled", "returned"].some(isSale)).toBe(false);
  });

  it("formats a stable order reference from the ID", () => {
    expect(formatOrderRef("c8112e4a-1234-5678-9abc-def012345678")).toBe("#C8112E4A");
  });
});

describe("application status", () => {
  it("uses application labels, not order labels", () => {
    expect(applicationStatusBadge("approved").label).toBe("APPROVED");
    expect(applicationStatusBadge("rejected").label).toBe("DECLINED");
    expect(applicationStatusBadge("draft").label).toBe("DRAFT");
  });
});
