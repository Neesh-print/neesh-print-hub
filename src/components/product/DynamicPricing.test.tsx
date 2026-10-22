import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DynamicPricing } from "./DynamicPricing";

describe("DynamicPricing with landed shipping (shipping_v2)", () => {
  it("shows space prices, shipping and a Loss margin for 10 FAY to New York", () => {
    render(
      <DynamicPricing
        wholesalePrice={16}
        retailPrice={22.5}
        quantity={10}
        onQuantityChange={() => {}}
        maxQuantity={199}
        minQuantity={5}
        minimumNote="US minimum 5 copies."
        landed={{ shippingUsd: 81.41, shippingLabel: "Shipping to New York" }}
      />,
    );
    expect(screen.getByText("$176.00")).toBeInTheDocument();
    expect(screen.getByText("$81.41")).toBeInTheDocument();
    expect(screen.getByText("−$32.41 (−14%)")).toBeInTheDocument();
    expect(screen.getByText("Loss")).toBeInTheDocument();
    expect(screen.getByText("US minimum 5 copies.")).toBeInTheDocument();
    expect(screen.getByText(/You'd lose \$32.41/)).toBeInTheDocument();
  });

  it("shows a Healthy margin", () => {
    render(
      <DynamicPricing
        wholesalePrice={10}
        retailPrice={20}
        quantity={5}
        onQuantityChange={() => {}}
        maxQuantity={50}
        landed={{ shippingUsd: 9.96, shippingLabel: "Shipping to New York" }}
      />,
    );
    expect(screen.getByText("+$35.04 (35%)")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });
});
