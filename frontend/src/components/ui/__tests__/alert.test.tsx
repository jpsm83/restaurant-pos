import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "../alert";

describe("Alert", () => {
  it("exposes alert role", () => {
    render(<Alert>Problem</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Problem");
  });

  it("defaults to the error tone", () => {
    render(<Alert>Problem</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("bg-destructive/10");
  });

  it.each([
    ["error", "bg-destructive/10"],
    ["success", "bg-success/10"],
    ["warning", "bg-warning/20"],
    ["info", "bg-info/10"],
  ] as const)("renders the %s tone", (tone, expected) => {
    render(<Alert tone={tone}>Message</Alert>);
    expect(screen.getByRole("alert")).toHaveClass(expected);
  });
});
