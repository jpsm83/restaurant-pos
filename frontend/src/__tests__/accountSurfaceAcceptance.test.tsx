/**
 * Account-surface acceptance sweep.
 *
 * Renders the real route tree, the real global account layout, and the real
 * account pages against the HTTP/session seams. The sweep proves the whole
 * slice together: every account destination is mode-agnostic, the sidebar is
 * the single global User surface, Sign-in & security owns the credential and
 * account-facts read, Profile/Address/Orders expose only their agreed fields,
 * and no out-of-scope account feature shipped (ADR-0018).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, UserProfile } from "@/auth/types";
import { AppRoutes } from "@/appRoutes";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthModeProvider } from "@/context/AuthModeContext";
import { renderWithI18n } from "@/test/i18nTestUtils";

// Account pages are route-split; a cold lazy import can exceed the default
// one-second query timeout under the full parallel suite.
const FIND_TIMEOUT_MS = 15_000;
const TEST_TIMEOUT_MS = 30_000;

vi.setConfig({ testTimeout: TEST_TIMEOUT_MS });

const { mockUseAuth, mockGet, mockPost, mockPatch, mockDelete, mockGetUserProfile } =
  vi.hoisted(() => ({
    mockUseAuth: vi.fn(),
    mockGet: vi.fn(),
    mockPost: vi.fn(),
    mockPatch: vi.fn(),
    mockDelete: vi.fn(),
    mockGetUserProfile: vi.fn(),
  }));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/auth/useGoogleSignInEnabled", () => ({
  useGoogleSignInEnabled: () => true,
}));

vi.mock("@/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth/api")>();
  return {
    ...actual,
    getUserProfile: (...args: Parameters<typeof actual.getUserProfile>) =>
      mockGetUserProfile(...args),
    updateUserProfile: vi.fn(),
    deleteUserPhoto: vi.fn(),
  };
});

vi.mock("@/services/http", () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

const accountStatus = {
  createdAt: "2026-01-01T12:00:00.000Z",
  emailVerified: true,
  privacyAcceptedAt: "2026-01-01T12:05:00.000Z",
  hasPendingEmailChange: true,
  pendingEmailRequestedAt: "2026-01-03T10:00:00.000Z",
  verificationRequestedAt: "2026-01-02T09:00:00.000Z",
  hasPassword: true,
  hasGoogleIdentity: false,
};

const serverProfile: UserProfile & Record<string, unknown> = {
  _id: "u1",
  personalDetails: {
    email: "account@example.com",
    username: "ada",
    firstName: "Ada",
    lastName: "Lovelace",
    phoneNumber: "",
    birthDate: "",
    gender: "",
    nationality: "",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
    address: {
      country: "Portugal",
      state: "Lisbon",
      city: "Lisbon",
      street: "Rua Augusta",
      buildingNumber: "10",
      postCode: "1100-053",
      additionalDetails: "Gate code 1234",
      coordinates: [-9.1393, 38.7223],
    },
  },
  languagePreference: "en",
  accountStatus,
  // Server-owned values that must never reach the rendered page.
  pendingEmail: "pending-address@example.com",
  pendingEmailToken: "pending-email-token-value",
  verificationToken: "verification-token-value",
  resetPasswordToken: "reset-token-value",
  googleId: "google-subject-value",
  refreshSessionVersion: 4,
};

const serverUser: AuthUser = {
  id: "u1",
  email: "account@example.com",
  type: "user",
  role: "Customer",
  emailVerified: true,
  languagePreference: "en",
  themePreference: "system",
  imageUrl: serverProfile.personalDetails.imageUrl,
  firstName: "Ada",
  lastName: "Lovelace",
  hasPassword: true,
  hasGoogleIdentity: false,
  mode: "business",
};

const ACCOUNT_DESTINATIONS = [
  ["/account/profile", "Profile"],
  ["/account/address", "Address"],
  ["/account/security", "Sign-in & security"],
  ["/account/notifications", "Notifications"],
  ["/account/preferences", "Preferences"],
  ["/account/orders", "Orders"],
] as const;

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: () => ({
      matches: false,
      media: "",
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  mockUseAuth.mockReset();
  mockGet.mockReset();
  mockPost.mockReset();
  mockPatch.mockReset();
  mockDelete.mockReset();
  mockGetUserProfile.mockReset();

  mockUseAuth.mockReturnValue({
    state: { status: "authenticated", user: serverUser, error: null },
    dispatch: vi.fn(),
  });
  mockGetUserProfile.mockResolvedValue({
    ok: true,
    data: structuredClone(serverProfile),
  });
  mockGet.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/v1/notifications/inbox")) {
      return { data: { items: [], unreadCount: 0, page: 1, limit: 20, hasMore: false } };
    }
    throw new Error(`unexpected GET ${url}`);
  });
});

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});

async function renderAccount(entry: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  return {
    ...(await renderWithI18n(
      <MemoryRouter initialEntries={[entry]}>
        <QueryClientProvider client={client}>
          <TooltipProvider>
            <SidebarProvider defaultOpen={false}>
              <AuthModeProvider>
                <AppRoutes />
              </AuthModeProvider>
            </SidebarProvider>
          </TooltipProvider>
        </QueryClientProvider>
        <LocationProbe />
      </MemoryRouter>,
    )),
  };
}

describe("account surface acceptance", () => {
  it("lists exactly the six global destinations and no out-of-scope account feature", async () => {
    await renderAccount("/account/security");

    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Sign-in & security" },
        { timeout: FIND_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href): href is string => href?.startsWith("/account") === true);

    expect(new Set(hrefs)).toEqual(
      new Set(ACCOUNT_DESTINATIONS.map(([path]) => path)),
    );
    expect(hrefs).toHaveLength(ACCOUNT_DESTINATIONS.length);

    for (const excluded of [
      /favorites/i,
      /marketing consent/i,
      /download my data/i,
      /payment methods?/i,
      /delete account/i,
      /unlink|disconnect google/i,
    ]) {
      expect(screen.queryByRole("link", { name: excluded })).toBeNull();
      expect(screen.queryByRole("button", { name: excluded })).toBeNull();
    }
  });

  it.each(
    (["customer", "business"] as const).flatMap((mode) =>
      ACCOUNT_DESTINATIONS.map(
        ([entry, heading]) => [entry, mode, heading] as const,
      ),
    ),
  )(
    "opens %s in %s mode without changing the stored mode",
    async (entry, mode, heading) => {
      mockUseAuth.mockReturnValue({
        state: {
          status: "authenticated",
          user: { ...serverUser, mode },
          error: null,
        },
        dispatch: vi.fn(),
      });

      await renderAccount(entry);

      expect(
        await screen.findByRole(
          "heading",
          { level: 1, name: heading },
          { timeout: FIND_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();
      expect(mockPost).not.toHaveBeenCalledWith(
        "/api/v1/auth/set-mode",
        expect.anything(),
      );
    },
  );

  it("shows the credential surface and every account fact without server-owned values", async () => {
    await renderAccount("/account/security");

    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Sign-in & security" },
        { timeout: FIND_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Sign-in email")).toHaveValue(
      "account@example.com",
    );
    expect(screen.getByText("This email is verified.")).toBeInTheDocument();
    expect(screen.getByText("Google not connected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change password" }),
    ).toBeInTheDocument();

    for (const label of [
      "Account created",
      "Email verified",
      "Privacy notice accepted",
      "Email change pending",
      "Email change requested",
      "Last verification email requested",
      "Password",
      "Google identity",
    ]) {
      expect(screen.getByText(label, { selector: "dt" })).toBeInTheDocument();
    }
    // Exactly the eight agreed facts: no internal counter leaks as a fact.
    expect(screen.getAllByRole("term")).toHaveLength(8);
    expect(screen.getAllByRole("definition")).toHaveLength(8);

    const rendered = document.body.textContent ?? "";
    for (const secret of [
      "pending-address@example.com",
      "pending-email-token-value",
      "verification-token-value",
      "reset-token-value",
      "google-subject-value",
    ]) {
      expect(rendered).not.toContain(secret);
    }
  });

  it("keeps Profile personal-details-plus-photo and offers photo removal", async () => {
    await renderAccount("/account/profile");

    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Profile" },
        { timeout: FIND_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();

    expect(screen.queryByLabelText("Sign-in email")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /change sign-in email/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /resend confirmation email/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove photo" }),
    ).toBeInTheDocument();
  });

  it("edits additional address details while keeping coordinates hidden", async () => {
    await renderAccount("/account/address");

    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Address" },
        { timeout: FIND_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Additional details")).toHaveValue(
      "Gate code 1234",
    );
    expect(
      screen.queryByRole("textbox", { name: /coordinates/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the Orders placeholder without reading order history", async () => {
    await renderAccount("/account/orders");

    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Orders" },
        { timeout: FIND_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This page is not built yet."),
    ).toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalledWith(
      expect.stringContaining("orders"),
      expect.anything(),
    );
  });

  it("lands the retired venue notifications URL on the shared account inbox", async () => {
    await renderAccount("/business/b1/notifications");

    await waitFor(
      () => {
        expect(screen.getByTestId("location")).toHaveTextContent(
          /^\/account\/notifications$/,
        );
      },
      { timeout: FIND_TIMEOUT_MS },
    );
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: "Notifications" },
        { timeout: FIND_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/notifications/inbox?page=1",
      expect.anything(),
    );
    expect(mockPost).not.toHaveBeenCalledWith(
      "/api/v1/auth/set-mode",
      expect.anything(),
    );
  });
});
