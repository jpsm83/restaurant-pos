/**
 * Tests for `AuthModeContext.tsx` — query enable rules, context value wiring, guards.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModeProvider, useAuthMode } from "../AuthModeContext";

const mockUseAuth = vi.fn();
const mockUseAuthModeQuery = vi.fn();
const mockUseSetAuthModeMutation = vi.fn();
const { mockSubscribeToAuthModeChanges } = vi.hoisted(() => ({
  mockSubscribeToAuthModeChanges: vi.fn(),
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/services/authMode", () => ({
  useAuthModeQuery: (...args: unknown[]) => mockUseAuthModeQuery(...args),
  useSetAuthModeMutation: () => mockUseSetAuthModeMutation(),
}));

vi.mock("@/services/authModeSync", () => ({
  subscribeToAuthModeChanges: (...args: unknown[]) =>
    mockSubscribeToAuthModeChanges(...args),
}));

function AuthModeProbe() {
  const ctx = useAuthMode();
  return (
    <div>
      <span data-testid="mode">{ctx.mode ?? "none"}</span>
      <span data-testid="loading">{String(ctx.isLoading)}</span>
      <span data-testid="error">{ctx.error?.message ?? "none"}</span>
      <span data-testid="setting">{String(ctx.isSettingMode)}</span>
      <button type="button" onClick={() => void ctx.refreshMode()}>
        refresh
      </button>
      <button type="button" onClick={() => void ctx.setModeAndRefresh("business")}>
        set business
      </button>
    </div>
  );
}

function renderUserShell(path: string, client = new QueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/:userId/customer"
            element={
              <AuthModeProvider>
                <AuthModeProbe />
              </AuthModeProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AuthModeProvider", () => {
  const refetch = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    refetch.mockClear();
    mockSubscribeToAuthModeChanges.mockClear();
    mockSubscribeToAuthModeChanges.mockReturnValue(vi.fn());
    mockUseAuthModeQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    });
    mockUseSetAuthModeMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });
  });

  it("throws when useAuthMode is used outside AuthModeProvider", () => {
    function Bad() {
      useAuthMode();
      return null;
    }
    expect(() =>
      render(
        <MemoryRouter>
          <Bad />
        </MemoryRouter>,
      ),
    ).toThrow("useAuthMode must be used within AuthModeProvider");
  });

  it("disables auth mode query when session is not an authenticated user", () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "unauthenticated",
        user: null,
        error: null,
      },
    });
    renderUserShell("/u1/customer");
    expect(mockUseAuthModeQuery).toHaveBeenCalledWith({ enabled: false });
    expect(screen.getByTestId("mode")).toHaveTextContent("none");
  });

  it("disables auth mode query outside user shell paths", () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", type: "user", email: "u@test", role: "Customer" },
        error: null,
      },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route
              path="/login"
              element={
                <AuthModeProvider>
                  <AuthModeProbe />
                </AuthModeProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(mockUseAuthModeQuery).toHaveBeenCalledWith({ enabled: false });
    expect(screen.getByTestId("mode")).toHaveTextContent("none");
  });

  it("enables query and exposes mode on user shell for person session", () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", type: "user", email: "u@test", role: "Customer" },
        error: null,
      },
    });
    mockUseAuthModeQuery.mockReturnValue({
      data: "business",
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    });
    renderUserShell("/u1/customer");
    expect(mockUseAuthModeQuery).toHaveBeenCalledWith({ enabled: true });
    expect(screen.getByTestId("mode")).toHaveTextContent("business");
  });

  it("invalidates the mode query when another tab publishes a change", () => {
    const client = new QueryClient();
    const invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue(undefined);
    renderUserShell("/u1/customer", client);

    const onChange = mockSubscribeToAuthModeChanges.mock
      .calls[0][0] as unknown as () => void;
    act(() => onChange());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["auth", "mode"] });
  });

  it("refreshMode does not refetch when query is disabled", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });
    renderUserShell("/u1/customer");
    await user.click(screen.getByRole("button", { name: "refresh" }));
    expect(refetch).not.toHaveBeenCalled();
  });

  it("setModeAndRefresh skips mutation when not a user session", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn();
    mockUseSetAuthModeMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });
    renderUserShell("/u1/customer");
    await user.click(screen.getByRole("button", { name: "set business" }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("setModeAndRefresh calls mutation for authenticated user session", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseSetAuthModeMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", type: "user", email: "u@test", role: "Customer" },
        error: null,
      },
    });
    renderUserShell("/u1/customer");
    await user.click(screen.getByRole("button", { name: "set business" }));
    expect(mutateAsync).toHaveBeenCalledWith("business");
  });
});
