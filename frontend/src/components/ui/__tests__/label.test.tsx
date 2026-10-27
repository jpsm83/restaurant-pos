import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Label } from "../label";

describe("Label", () => {
  it("associates with control via htmlFor", () => {
    render(
      <>
        <Label htmlFor="f1">Field</Label>
        <input id="f1" />
      </>,
    );
    expect(screen.getByText("Field")).toHaveAttribute("for", "f1");
  });

  it("uses the foreground token", () => {
    render(<Label>Field</Label>);
    expect(screen.getByText("Field")).toHaveClass("text-foreground");
  });
});
