import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "../../types";
import {
  AuthProvider,
  useAuth,
} from "../AuthContext";

const loadPersistedAccessToken = vi.fn<() => string | null>();
const getCurrentUser = vi.fn();
const refreshSession = vi.fn();
const setAccessToken = vi.fn();
const changeAppLanguage = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../api", () => ({
  loadPersistedAccessToken: () => loadPersistedAccessToken(),
  getCurrentUser: () => getCurrentUser(),
  refreshSession: () => refreshSession(),
  setAccessToken: (...args: unknown[]) => setAccessToken(...args),
}));

vi.mock("@/i18n/i18n", () => ({
  changeAppLanguage,
}));

const sampleUser: AuthSession = {
  id: "64b000000000000000000001",
  email: "owner@example.com",
  type: "user",
  mode: "business",
  languagePreference: "en",
  role: "Manager",
};

const sampleCustomer: AuthSession = {
  id: "64b000000000000000000002",
  email: "customer@example.com",
  type: "user",
  role: "Customer",
  languagePreference: "es",
};

function StatusProbe() {
  const { state, dispatch } = useAuth();
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="user-email">{state.user?.email ?? ""}</span>
      <span data-testid="error">{state.error ?? ""}</span>
      <button
        type="button"
        onClick={() => dispatch({ type: "AUTH_CLEAR" })}
      >
        sign-out
      </button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    loadPersistedAccessToken.mockReset();
    getCurrentUser.mockReset();
    refreshSession.mockReset();
    setAccessToken.mockReset();
    changeAppLanguage.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("useAuth throws when used outside AuthProvider", () => {
    function Outside() {
      useAuth();
      return null;
    }
    expect(() => render(<Outside />)).toThrow(
      "useAuth must be used inside AuthProvider",
    );
  });

  it("bootstrap: persisted token + /me success dispatches AUTH_SUCCESS", async () => {
    loadPersistedAccessToken.mockReturnValue("stored-jwt");
    getCurrentUser.mockResolvedValue({ ok: true, data: sampleUser });

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(screen.getByTestId("user-email")).toHaveTextContent(sampleUser.email);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(setAccessToken).toHaveBeenCalledWith("stored-jwt");
  });

  it("bootstrap: no persisted token, refresh + /me success dispatches AUTH_SUCCESS", async () => {
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({
      ok: true,
      data: { accessToken: "new-jwt", user: null },
    });
    getCurrentUser.mockResolvedValue({ ok: true, data: sampleUser });

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(setAccessToken).toHaveBeenCalledWith("new-jwt");
  });

  it("bootstrap: no token and refresh fails ends unauthenticated", async () => {
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({ ok: false, error: "nope" });

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("user-email")).toHaveTextContent("");
  });

  it("hydrates the signed-in user's language preference", async () => {
    loadPersistedAccessToken.mockReturnValue("stored-jwt");
    getCurrentUser.mockResolvedValue({ ok: true, data: sampleCustomer });

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    await waitFor(() => {
      expect(changeAppLanguage).toHaveBeenCalledWith("es");
    });
  });

  it("bootstrap: refresh had session flag sets expired notice when refresh fails", async () => {
    localStorage.setItem("auth_had_session", "1");
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({ ok: false, error: "expired" });

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(sessionStorage.getItem("auth_session_expired_notice")).toBe("1");
    expect(localStorage.getItem("auth_had_session")).toBeNull();
  });

  it("stores the machine error code when restoring the session fails", async () => {
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({
      ok: true,
      data: { accessToken: "new-jwt", user: null },
    });
    getCurrentUser.mockResolvedValue({
      ok: false,
      error: { code: "session.unauthorized", status: 401 },
    });

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("error")).toHaveTextContent(
      "session.unauthorized",
    );
  });

  it("dispatch AUTH_CLEAR from a child updates state", async () => {
    const user = userEvent.setup();
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({
      ok: true,
      data: { accessToken: "t", user: null },
    });
    getCurrentUser.mockResolvedValue({ ok: true, data: sampleUser });

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    await user.click(screen.getByRole("button", { name: /sign-out/i }));

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("user-email")).toHaveTextContent("");
  });
});
