import { describe, expect, it } from "vitest";
import { buttonVariants } from "../button-variants";

describe("button-variants", () => {
  it("produces class strings for variant and size", () => {
    const classes = buttonVariants({ variant: "outline", size: "sm" });
    expect(classes).toContain("border");
    expect(classes).toContain("h-8");
  });
});
