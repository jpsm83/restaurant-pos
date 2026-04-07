import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { ErrorBoundary } from "../ErrorBoundary";

function ThrowingChild({ message = "boom" }: { message?: string }) {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  it("renders children when there is no error", async () => {
    await renderWithI18n(
      <ErrorBoundary>
        <p>OK</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("renders fallback UI and recovery actions after a child throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      await renderWithI18n(
        <MemoryRouter>
          <ErrorBoundary>
            <ThrowingChild />
          </ErrorBoundary>
        </MemoryRouter>,
      );

      expect(
        await screen.findByRole("heading", { name: /something went wrong/i }),
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", { name: /reload page/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /^home$/i })).toHaveAttribute(
        "href",
        "/",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
