import { screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/auth/store/AuthContext";
import { AppRoutes } from "@/appRoutes";
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

vi.mock("@/pages/LoginPage", () => ({
  default: () => <div data-testid="login-stub">Login stub</div>,
}));

vi.mock("@/pages/marketing/CustomerMarketingPage", () => ({
  default: () => (
    <div data-testid="customer-marketing-stub">Customer marketing</div>
  ),
}));

describe("appRoutes.tsx — AppRoutes", () => {
  beforeEach(() => {
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({ ok: false, error: "no session" });
    vi.clearAllMocks();
  });

  function renderRoutes(initialEntry: string) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
    });
    return renderWithI18n(
      <MemoryRouter initialEntries={[initialEntry]}>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
  }

  it("lazy-loads login at /login when unauthenticated", async () => {
    await renderRoutes("/login");
    expect(
      await screen.findByTestId("login-stub", {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });

  it("shows customer marketing at / when unauthenticated", async () => {
    await renderRoutes("/");
    expect(
      await screen.findByTestId(
        "customer-marketing-stub",
        {},
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
  });
});
