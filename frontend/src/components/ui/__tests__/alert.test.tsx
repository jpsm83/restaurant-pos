import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "../alert";

describe("Alert", () => {
  it("exposes alert role", () => {
    render(<Alert>Problem</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Problem");
  });
});
