import { screen, waitFor } from "@testing-library/react";
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
    localStorage.clear();
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({
      ok: false,
      error: { code: "session.unauthorized", status: 401 },
    });
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
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

  it("does not request a refresh for an anonymous visitor", async () => {
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

    await waitFor(() =>
      expect(screen.getByTestId("routes-stub")).toBeInTheDocument(),
    );
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("requests a refresh when a prior session exists", async () => {
    localStorage.setItem("auth_had_session", "1");
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

    await waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1));
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
