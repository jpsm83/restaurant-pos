import { screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/auth/store/AuthContext";
import App from "@/App";
import { renderWithI18n } from "@/test/i18nTestUtils";

vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="google-provider">{children}</div>
  ),
  GoogleLogin: () => <button type="button">Continue with Google</button>,
}));

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
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
    expect(screen.queryByTestId("google-provider")).not.toBeInTheDocument();
  });

  it("mounts the Google provider when a client id is configured", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client-id");
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

    expect(await screen.findByTestId("google-provider")).toBeInTheDocument();
    expect(screen.getByTestId("routes-stub")).toBeInTheDocument();
  });
});
