import { describe, it, expect } from "vitest";
import orderPriceMatches from "../../src/orders/orderPriceMatches.ts";

describe("orderPriceMatches", () => {
  it("matches equal net prices with no promotion", () => {
    expect(
      orderPriceMatches({ orderNetPrice: 10 }, { orderNetPrice: 10 }),
    ).toBe(true);
  });

  it("matches net prices within the tolerance", () => {
    expect(
      orderPriceMatches({ orderNetPrice: 10 }, { orderNetPrice: 10.009 }),
    ).toBe(true);
  });

  it("rejects net prices beyond the tolerance", () => {
    expect(
      orderPriceMatches({ orderNetPrice: 10 }, { orderNetPrice: 10.02 }),
    ).toBe(false);
  });

  it("matches when both sides applied the same promotion", () => {
    expect(
      orderPriceMatches(
        { orderNetPrice: 5, promotionApplyed: "Half Off" },
        { orderNetPrice: 5, promotionApplyed: "Half Off" },
      ),
    ).toBe(true);
  });

  it("rejects when the client did not report the applied promotion", () => {
    expect(
      orderPriceMatches(
        { orderNetPrice: 5 },
        { orderNetPrice: 5, promotionApplyed: "Half Off" },
      ),
    ).toBe(false);
  });

  it("rejects when the client reported a different promotion", () => {
    expect(
      orderPriceMatches(
        { orderNetPrice: 5, promotionApplyed: "Other" },
        { orderNetPrice: 5, promotionApplyed: "Half Off" },
      ),
    ).toBe(false);
  });

  it("ignores the server-derived discountPercentage (regression)", () => {
    // The server derives discountPercentage and the client cannot send it, so a
    // promoted order must still match when price and promotion name agree.
    const client = { orderNetPrice: 5, promotionApplyed: "Half Off" };
    const backend = {
      orderNetPrice: 5,
      promotionApplyed: "Half Off",
      discountPercentage: 50,
    };

    expect(orderPriceMatches(client, backend)).toBe(true);
  });
});
