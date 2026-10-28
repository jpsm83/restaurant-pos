import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/auth/types";
import type { LiveConnectionStatus } from "@/live/connection";
import { createTestI18n, renderWithI18n } from "@/test/i18nTestUtils";
import commonEs from "@/i18n/locales/es/common.json";
import LiveConnectionBanner from "../LiveConnectionBanner";

const authState: {
  user: AuthSession | null;
  status: "authenticated" | "unauthenticated";
  error: null;
} = {
  user: null,
  status: "unauthenticated",
  error: null,
};

let liveStatus: LiveConnectionStatus = "idle";

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: authState,
    dispatch: vi.fn(),
  }),
}));

vi.mock("@/live/useLiveConnectionStatus", () => ({
  useLiveConnectionStatus: () => liveStatus,
}));

const signedInUser: AuthSession = {
  id: "64b000000000000000000001",
  email: "owner@example.com",
  type: "user",
  mode: "business",
  role: "Manager",
};

describe("LiveConnectionBanner", () => {
  beforeEach(() => {
    authState.user = null;
    authState.status = "unauthenticated";
    liveStatus = "idle";
  });

  afterEach(() => {
    authState.user = null;
    authState.status = "unauthenticated";
    liveStatus = "idle";
  });

  it("does not show a live state on guest pages", async () => {
    liveStatus = "disconnected";
    await renderWithI18n(<LiveConnectionBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows disconnected in English on signed-in chrome and leaves the page mounted", async () => {
    authState.status = "authenticated";
    authState.user = signedInUser;
    liveStatus = "disconnected";

    await renderWithI18n(
      <>
        <LiveConnectionBanner />
        <main>Last known screen</main>
      </>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Disconnected");
    expect(screen.getByText("Last known screen")).toBeInTheDocument();
  });

  it("shows disconnected in Spanish on signed-in chrome", async () => {
    authState.status = "authenticated";
    authState.user = signedInUser;
    liveStatus = "disconnected";

    const i18n = await createTestI18n();
    i18n.addResourceBundle("es", "common", commonEs, true, true);
    await i18n.changeLanguage("es");

    await renderWithI18n(<LiveConnectionBanner />, { i18n });

    expect(screen.getByRole("status")).toHaveTextContent("Desconectado");
  });

  it("shows reconnecting in Spanish on signed-in chrome", async () => {
    authState.status = "authenticated";
    authState.user = signedInUser;
    liveStatus = "reconnecting";

    const i18n = await createTestI18n();
    i18n.addResourceBundle("es", "common", commonEs, true, true);
    await i18n.changeLanguage("es");

    await renderWithI18n(<LiveConnectionBanner />, { i18n });

    expect(screen.getByRole("status")).toHaveTextContent("Reconectando");
  });

  it("hides the banner once the tab is live", async () => {
    authState.status = "authenticated";
    authState.user = signedInUser;
    liveStatus = "live";

    await renderWithI18n(<LiveConnectionBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
