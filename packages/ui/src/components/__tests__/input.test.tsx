import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "../input";

describe("Input", () => {
  it("renders with data-slot and forwards props", () => {
    render(<Input aria-label="Email" placeholder="you@example.com" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("data-slot", "input");
    expect(input).toHaveAttribute("placeholder", "you@example.com");
  });
});
