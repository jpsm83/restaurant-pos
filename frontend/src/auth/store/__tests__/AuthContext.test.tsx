import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
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
const subscribeToAuthSessionChanges = vi.fn();
const unsubscribeFromAuthSessionChanges = vi.fn();

type AuthSessionSignal = "sign-in" | "sign-out";
let authSessionSignalHandler: ((signal: AuthSessionSignal) => void) | null =
  null;

vi.mock("../../sessionSync", () => ({
  subscribeToAuthSessionChanges: (
    handler: (signal: AuthSessionSignal) => void,
  ) => {
    subscribeToAuthSessionChanges(handler);
    authSessionSignalHandler = handler;
    return unsubscribeFromAuthSessionChanges;
  },
}));

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

let queryClient: QueryClient;

function renderWithProvider(children: ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>,
  );
}

async function emitAuthSessionSignal(signal: AuthSessionSignal) {
  await act(async () => {
    authSessionSignalHandler?.(signal);
  });
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
    subscribeToAuthSessionChanges.mockReset();
    unsubscribeFromAuthSessionChanges.mockReset();
    authSessionSignalHandler = null;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
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

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(screen.getByTestId("user-email")).toHaveTextContent(sampleUser.email);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(setAccessToken).toHaveBeenCalledWith("stored-jwt");
  });

  it("bootstrap: prior session, refresh + /me success dispatches AUTH_SUCCESS", async () => {
    localStorage.setItem("auth_had_session", "1");
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({
      ok: true,
      data: { accessToken: "new-jwt", user: null },
    });
    getCurrentUser.mockResolvedValue({ ok: true, data: sampleUser });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(setAccessToken).toHaveBeenCalledWith("new-jwt");
  });

  it("bootstrap: anonymous visitor does not call refresh", async () => {
    loadPersistedAccessToken.mockReturnValue(null);

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("bootstrap: prior session refresh fails ends unauthenticated", async () => {
    localStorage.setItem("auth_had_session", "1");
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({
      ok: false,
      error: { code: "session.transport" },
    });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("user-email")).toHaveTextContent("");
  });

  it("hydrates the signed-in user's language preference", async () => {
    loadPersistedAccessToken.mockReturnValue("stored-jwt");
    getCurrentUser.mockResolvedValue({ ok: true, data: sampleCustomer });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    await waitFor(() => {
      expect(changeAppLanguage).toHaveBeenCalledWith("es");
    });
  });

  it("bootstrap: unauthorized refresh clears the hint and shows the expired notice", async () => {
    localStorage.setItem("auth_had_session", "1");
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({
      ok: false,
      error: { code: "session.unauthorized", status: 401 },
    });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(sessionStorage.getItem("auth_session_expired_notice")).toBe("1");
    expect(localStorage.getItem("auth_had_session")).toBeNull();
  });

  it("bootstrap: transient refresh failure keeps the hint for the next load", async () => {
    localStorage.setItem("auth_had_session", "1");
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({
      ok: false,
      error: { code: "session.transport" },
    });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(sessionStorage.getItem("auth_session_expired_notice")).toBeNull();
    expect(localStorage.getItem("auth_had_session")).toBe("1");
  });

  it("stores the machine error code when restoring the session fails", async () => {
    localStorage.setItem("auth_had_session", "1");
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({
      ok: true,
      data: { accessToken: "new-jwt", user: null },
    });
    getCurrentUser.mockResolvedValue({
      ok: false,
      error: { code: "session.unauthorized", status: 401 },
    });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("error")).toHaveTextContent(
      "session.unauthorized",
    );
  });

  it("dispatch AUTH_CLEAR from a child updates state", async () => {
    const user = userEvent.setup();
    localStorage.setItem("auth_had_session", "1");
    loadPersistedAccessToken.mockReturnValue(null);
    refreshSession.mockResolvedValue({
      ok: true,
      data: { accessToken: "t", user: null },
    });
    getCurrentUser.mockResolvedValue({ ok: true, data: sampleUser });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    await user.click(screen.getByRole("button", { name: /sign-out/i }));

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("user-email")).toHaveTextContent("");
  });

  it("subscribes once and unsubscribes on unmount", async () => {
    loadPersistedAccessToken.mockReturnValue(null);

    const { unmount } = renderWithProvider(<StatusProbe />);

    await waitFor(() => expect(subscribeToAuthSessionChanges).toHaveBeenCalled());
    unmount();

    expect(subscribeToAuthSessionChanges).toHaveBeenCalledTimes(1);
    expect(unsubscribeFromAuthSessionChanges).toHaveBeenCalledTimes(1);
  });

  it("a sign-out signal clears identity, token, hint, and cached queries", async () => {
    localStorage.setItem("auth_had_session", "1");
    loadPersistedAccessToken.mockReturnValue("stored-jwt");
    getCurrentUser.mockResolvedValue({ ok: true, data: sampleUser });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    queryClient.setQueryData(["portfolio", sampleUser.id], {
      venues: [sampleUser.id],
    });

    await emitAuthSessionSignal("sign-out");

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("user-email")).toHaveTextContent("");
    expect(setAccessToken).toHaveBeenLastCalledWith(null);
    expect(localStorage.getItem("auth_had_session")).toBeNull();
    expect(
      queryClient.getQueryData(["portfolio", sampleUser.id]),
    ).toBeUndefined();
  });

  it("a sign-in signal hides the previous identity while restoring", async () => {
    loadPersistedAccessToken.mockReturnValue("stored-jwt");
    getCurrentUser.mockResolvedValueOnce({ ok: true, data: sampleUser });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent(
        sampleUser.email,
      ),
    );
    queryClient.setQueryData(["profile", sampleUser.id], {
      email: sampleUser.email,
    });

    let finishRefresh!: (value: unknown) => void;
    refreshSession.mockReturnValue(
      new Promise((resolve) => {
        finishRefresh = resolve;
      }),
    );

    act(() => {
      authSessionSignalHandler?.("sign-in");
    });

    await waitFor(() =>
      expect(screen.getByTestId("user-email")).not.toHaveTextContent(
        sampleUser.email,
      ),
    );
    expect(
      queryClient.getQueryData(["profile", sampleUser.id]),
    ).toBeUndefined();

    getCurrentUser.mockResolvedValueOnce({ ok: true, data: sampleCustomer });
    await act(async () => {
      finishRefresh({
        ok: true,
        data: { accessToken: "fresh-jwt", user: null },
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent(
        sampleCustomer.email,
      ),
    );
  });

  it("a sign-in signal discards the old token and adopts the new User", async () => {
    localStorage.setItem("auth_had_session", "1");
    loadPersistedAccessToken.mockReturnValue("stored-jwt");
    getCurrentUser.mockResolvedValueOnce({ ok: true, data: sampleUser });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent(
        sampleUser.email,
      ),
    );
    localStorage.removeItem("auth_had_session");
    queryClient.setQueryData(["profile", sampleUser.id], {
      email: sampleUser.email,
    });

    refreshSession.mockResolvedValue({
      ok: true,
      data: { accessToken: "fresh-jwt", user: null },
    });
    getCurrentUser.mockResolvedValueOnce({ ok: true, data: sampleCustomer });

    await emitAuthSessionSignal("sign-in");

    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent(
        sampleCustomer.email,
      ),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(setAccessToken).toHaveBeenCalledWith(null);
    expect(setAccessToken).toHaveBeenCalledWith("fresh-jwt");
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("auth_had_session")).toBe("1");
    expect(
      queryClient.getQueryData(["profile", sampleUser.id]),
    ).toBeUndefined();
    await waitFor(() =>
      expect(changeAppLanguage).toHaveBeenCalledWith("es"),
    );
  });

  it("a failed restore after a sign-in signal ends signed out without the expired notice", async () => {
    localStorage.setItem("auth_had_session", "1");
    loadPersistedAccessToken.mockReturnValue("stored-jwt");
    getCurrentUser.mockResolvedValue({ ok: true, data: sampleUser });

    renderWithProvider(<StatusProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("user-email")).toHaveTextContent(
        sampleUser.email,
      ),
    );
    refreshSession.mockResolvedValue({
      ok: false,
      error: { code: "session.unauthorized", status: 401 },
    });

    await emitAuthSessionSignal("sign-in");

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("user-email")).toHaveTextContent("");
    expect(sessionStorage.getItem("auth_session_expired_notice")).toBeNull();
    expect(localStorage.getItem("auth_had_session")).toBeNull();
  });
});
