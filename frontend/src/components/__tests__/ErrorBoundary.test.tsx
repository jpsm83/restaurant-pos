import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { ErrorBoundary } from "../ErrorBoundary";

const { reportRenderError } = vi.hoisted(() => ({
  reportRenderError: vi.fn(),
}));

vi.mock("@/monitoring/errorMonitoring", () => ({ reportRenderError }));

function ThrowingChild({ message = "boom" }: { message?: string }): ReactNode {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    reportRenderError.mockClear();
  });

  it("renders children when there is no error and reports nothing", async () => {
    await renderWithI18n(
      <ErrorBoundary>
        <p>OK</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(reportRenderError).not.toHaveBeenCalled();
  });

  it("reports a child render error once with its component stack", async () => {
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

      expect(reportRenderError).toHaveBeenCalledTimes(1);
      const [error, componentStack] = reportRenderError.mock.calls[0] as [
        Error,
        string,
      ];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("boom");
      expect(componentStack).toContain("ThrowingChild");
    } finally {
      consoleError.mockRestore();
    }
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
