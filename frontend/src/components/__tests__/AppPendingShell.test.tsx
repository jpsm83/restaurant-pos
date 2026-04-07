import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { AppPendingShell } from "../AppPendingShell";

describe("AppPendingShell", () => {
  it("route variant exposes sr-only loading copy", async () => {
    await renderWithI18n(<AppPendingShell variant="route" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("session variant exposes status region and default session message", async () => {
    await renderWithI18n(<AppPendingShell variant="session" />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Loading session…",
    );
  });

  it("session variant uses custom message for aria-label when provided", async () => {
    await renderWithI18n(
      <AppPendingShell variant="session" message="Custom wait" />,
    );
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Custom wait",
    );
  });
});
