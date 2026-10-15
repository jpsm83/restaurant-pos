import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Separator } from "../separator";

describe("Separator", () => {
  it("renders horizontal separator", () => {
    const { container } = render(<Separator />);
    expect(container.querySelector('[data-slot="separator"]')).toBeTruthy();
  });
});
