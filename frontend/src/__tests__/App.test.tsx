import { screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/auth/store/AuthContext";
import App from "@/App";
import { renderWithI18n } from "@/test/i18nTestUtils";

const loadPersistedAccessToken = vi.fn<() => string | null>();
const getCurrentUser = vi.fn();
const refreshSession = vi.fn();
const setAccessToken = vi.fn();

vi.mock("@/auth/api", () => ({
  loadPersistedAccessToken: () => loadPersistedAccessToken(),
  getCurrentUser: () => getCurrentUser(),
  refreshSession: () => refreshSession(),
  setAccessToken: (...args: unknown[]) => setAccessToken(...args),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/appRoutes", () => ({
  AppRoutes: () => <div data-testid="routes-stub">AppRoutes</div>,
}));

describe("App.tsx", () => {
  beforeEach(() => {
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({ ok: false, error: "no session" });
    vi.clearAllMocks();
  });

  it("renders AuthModeProvider around AppRoutes", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
    });

    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("routes-stub")).toBeInTheDocument();
  });
});
