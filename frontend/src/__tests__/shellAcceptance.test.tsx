/**
 * Routed-shell acceptance sweep for the Customer chrome and Business shell slice.
 *
 * These tests render the real route tree (`AppRoutes`), the real Customer,
 * account, and Business layouts, and the real Customer | Business mode provider.
 * Only the session (`useAuth`) and the network seams (`http`, the profile API)
 * are replaced so the whole slice can be exercised in one place.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IAuthAccessibleVenue } from "restaurant-pos-packages/interfaces/IAuth";
import type { INotificationInboxItem } from "restaurant-pos-packages/interfaces/INotification";
import type {
  IOwnerPortfolio,
  IOwnerPortfolioBusiness,
} from "restaurant-pos-packages/interfaces/IOwner";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/App";
import { AuthModeProvider } from "@/context/AuthModeContext";
import Navbar from "@/components/Navbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryKeys } from "@/services/queryKeys";
import { renderWithI18n } from "@/test/i18nTestUtils";
import type { AuthUser, UserProfile } from "@/auth/types";
import type { AuthMode } from "@/services/authMode";
import type { SupportedLanguage } from "@/i18n/config";

const FIND_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 20_000;

vi.setConfig({ testTimeout: TEST_TIMEOUT_MS });

type ServerState = {
  mode: AuthMode;
  user: Pick<
    AuthUser,
    "id" | "email" | "type" | "role" | "employeeId" | "businessId"
  >;
  venues: IAuthAccessibleVenue[];
  portfolio: IOwnerPortfolio;
  profile: UserProfile;
  inbox: INotificationInboxItem[];
};

const {
  mockUseAuth,
  mockGetUserProfile,
  mockUpdateUserProfile,
  mockGet,
  mockPost,
  mockPatch,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockGetUserProfile: vi.fn(),
  mockUpdateUserProfile: vi.fn(),
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/auth/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth/api")>();
  return {
    ...actual,
    getUserProfile: (...args: Parameters<typeof actual.getUserProfile>) =>
      mockGetUserProfile(...args),
    updateUserProfile: (...args: Parameters<typeof actual.updateUserProfile>) =>
      mockUpdateUserProfile(...args),
  };
});

vi.mock("@/services/http", () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function venue(
  overrides: Partial<IAuthAccessibleVenue> = {},
): IAuthAccessibleVenue {
  return {
    businessId: "b1",
    tradeName: "Alpha Bar",
    source: "ownership",
    effectiveLayer: "admin",
    jobRoles: [],
    capabilities: [],
    canEnterBusiness: true,
    ...overrides,
  };
}

function portfolio(
  businesses: Array<Pick<IOwnerPortfolioBusiness, "_id" | "tradeName">> = [],
): IOwnerPortfolio {
  return {
    owner: { _id: "o1", country: "USA", subscription: "Free" },
    country: "USA",
    subscription: "Free",
    companies:
      businesses.length > 0
        ? [
            {
              _id: "c1",
              country: "USA",
              businesses: businesses.map((business) => ({
                ...business,
                currencyTrade: "USD",
                companyId: "c1",
                profileComplete: true,
              })),
            },
          ]
        : [],
  };
}

function inboxEntry(
  overrides: Partial<INotificationInboxItem> = {},
): INotificationInboxItem {
  return {
    notificationId: "n1",
    businessId: "b1",
    notificationType: "Info",
    message: "Your order is ready.",
    createdAt: "2026-03-27T10:15:00.000Z",
    read: false,
    ...overrides,
  };
}

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    _id: "u1",
    personalDetails: {
      username: "customer",
      email: "customer@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      phoneNumber: "",
      birthDate: "",
      gender: "",
      nationality: "",
      imageUrl: "",
      address: {
        country: "Portugal",
        state: "Lisbon",
        city: "Lisbon",
        street: "Rua Augusta",
        buildingNumber: "10",
        postCode: "1100-053",
      },
    },
    languagePreference: "en",
    ...overrides,
  };
}

function createServer(overrides: Partial<ServerState> = {}): ServerState {
  return {
    mode: "customer",
    user: {
      id: "u1",
      email: "customer@example.com",
      type: "user",
      role: "Customer",
    },
    venues: [],
    portfolio: portfolio(),
    profile: profile(),
    inbox: [],
    ...overrides,
  };
}

let server: ServerState;

function accessSnapshotFor(item: IAuthAccessibleVenue) {
  return {
    businessId: item.businessId,
    effectiveLayer: item.effectiveLayer,
    source: item.source,
    jobRoles: item.jobRoles,
    capabilities: item.capabilities,
    canEnterBusiness: item.canEnterBusiness,
  };
}

function installServerMocks() {
  const venueById = (businessId: string) =>
    server.venues.find((candidate) => candidate.businessId === businessId);

  mockGet.mockImplementation(async (url: string) => {
    if (url === "/api/v1/auth/mode") {
      return { data: { mode: server.mode } };
    }
    if (url === "/api/v1/auth/venues") {
      return { data: { venues: server.venues } };
    }
    const inboxMatch = /^\/api\/v1\/notifications\/inbox(?:\?page=(\d+))?$/.exec(
      url,
    );
    if (inboxMatch) {
      return {
        data: {
          items: server.inbox,
          unreadCount: server.inbox.filter((entry) => !entry.read).length,
          page: Number(inboxMatch[1] ?? 1),
          limit: 20,
          hasMore: false,
        },
      };
    }
    if (url === "/api/v1/owners/portfolio") {
      return { data: server.portfolio };
    }
    const accessMatch = /^\/api\/v1\/business\/([^/]+)\/access$/.exec(url);
    if (accessMatch) {
      const item = venueById(accessMatch[1]);
      if (!item) throw new Error("venue not found");
      return { data: accessSnapshotFor(item) };
    }
    const businessMatch = /^\/api\/v1\/business\/([^/]+)$/.exec(url);
    if (businessMatch) {
      const item = venueById(businessMatch[1]);
      return {
        data: {
          _id: businessMatch[1],
          tradeName: item?.tradeName ?? "Venue",
          currencyTrade: "USD",
          email: server.user.email,
        },
      };
    }
    throw new Error(`unexpected GET ${url}`);
  });

  mockPost.mockImplementation(async (url: string, body: Record<string, unknown>) => {
    if (url === "/api/v1/auth/set-mode") {
      server.mode = body.mode === "business" ? "business" : "customer";
      return { data: { mode: server.mode } };
    }
    if (url === "/api/v1/business") {
      const newVenue = venue({
        businessId: "b-new",
        tradeName: String(body.tradeName ?? "New Venue"),
      });
      server.venues = [...server.venues, newVenue];
      server.portfolio = portfolio([
        ...(server.portfolio.companies[0]?.businesses ?? []).map((business) => ({
          _id: business._id,
          tradeName: business.tradeName,
        })),
        { _id: newVenue.businessId, tradeName: newVenue.tradeName },
      ]);
      return {
        data: {
          business: {
            _id: newVenue.businessId,
            tradeName: newVenue.tradeName,
            currencyTrade: "USD",
          },
          company: { _id: "c1", country: "USA" },
        },
      };
    }
    throw new Error(`unexpected POST ${url}`);
  });

  mockPatch.mockRejectedValue(new Error("unexpected PATCH"));
}

async function renderShell(entry: string, language?: SupportedLanguage) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  return {
    client,
    ...(await renderWithI18n(
      <MemoryRouter initialEntries={[entry]}>
        <QueryClientProvider client={client}>
          <TooltipProvider>
            <SidebarProvider defaultOpen={false}>
              <AuthModeProvider>
                <Navbar />
                <AppRoutes />
              </AuthModeProvider>
            </SidebarProvider>
          </TooltipProvider>
        </QueryClientProvider>
        <LocationProbe />
      </MemoryRouter>,
      { language },
    )),
  };
}

async function expectLocation(path: string) {
  await waitFor(() => {
    expect(screen.getByTestId("location")).toHaveTextContent(path);
  });
}

function findBusinessDashboard() {
  return screen.findByRole(
    "heading",
    { name: "Business dashboard" },
    { timeout: FIND_TIMEOUT_MS },
  );
}

function findVenueTabs() {
  return screen.findByRole(
    "navigation",
    { name: "Venues" },
    { timeout: FIND_TIMEOUT_MS },
  );
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
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
  server = createServer();
  mockUseAuth.mockReset();
  mockGetUserProfile.mockReset();
  mockUpdateUserProfile.mockReset();
  mockGet.mockReset();
  mockPost.mockReset();
  mockPatch.mockReset();

  mockUseAuth.mockImplementation(() => ({
    state: { status: "authenticated", user: server.user, error: null },
    dispatch: vi.fn(),
  }));

  mockGetUserProfile.mockImplementation(async () => ({
    ok: true,
    data: structuredClone(server.profile),
  }));

  mockUpdateUserProfile.mockImplementation(
    async (_userId: string, formData: FormData) => {
      const next = structuredClone(server.profile);

      if (formData.has("address")) {
        const raw = formData.get("address");
        next.personalDetails.address =
          typeof raw === "string" && raw.trim()
            ? (JSON.parse(raw) as UserProfile["personalDetails"]["address"])
            : undefined;
      }
      for (const key of [
        "username",
        "firstName",
        "lastName",
        "phoneNumber",
        "birthDate",
        "gender",
        "nationality",
      ] as const) {
        if (formData.has(key)) {
          (next.personalDetails[key] as string) = String(formData.get(key));
        }
      }
      if (formData.has("languagePreference")) {
        next.languagePreference = String(
          formData.get("languagePreference"),
        ) as UserProfile["languagePreference"];
      }

      server.profile = next;
      return { ok: true, data: { user: structuredClone(next) } };
    },
  );

  installServerMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});

describe("Customer chrome and Business shell acceptance", () => {
  it("keeps a pure customer in Customer chrome and opens Account, Profile, and Address", async () => {
    const user = userEvent.setup();
    await renderShell("/dashboard");

    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Business" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Account" }));

    await expectLocation("/account/profile");
    expect(
      await screen.findByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Address" }));

    await expectLocation("/account/address");
    expect(
      await screen.findByRole("heading", { name: "Address" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Business" }),
    ).not.toBeInTheDocument();
  });

  it("disables Business with an explanation when no venue is enterable", async () => {
    server = createServer({
      venues: [
        venue({
          businessId: "b2",
          tradeName: "Beta Bar",
          canEnterBusiness: false,
        }),
      ],
    });

    await renderShell("/dashboard");

    const workspace = await screen.findByRole("group", { name: "Workspace" });
    expect(
      within(workspace).getByRole("button", { name: "Business" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        /business is not available for your venues right now/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See why" })).toHaveAttribute(
      "href",
      "/mode",
    );
  });

  it("saves Profile and Address independently without clearing the Address", async () => {
    const user = userEvent.setup();
    await renderShell("/account/address");

    expect(
      await screen.findByRole("heading", { name: "Address" }),
    ).toBeInTheDocument();

    for (const [label, value] of [
      ["Country", "Spain"],
      ["State", "Madrid"],
      ["City", "Madrid"],
      ["Street", "Calle Mayor"],
      ["Building number", "20"],
      ["Post code", "28013"],
    ] as const) {
      const field = screen.getByLabelText(label);
      await user.clear(field);
      await user.type(field, value);
    }
    await user.click(screen.getByRole("button", { name: /Save (address|profile)/ }));

    await waitFor(() => {
      expect(server.profile.personalDetails.address?.street).toBe("Calle Mayor");
    });

    expect(server.profile.personalDetails.address?.street).toBe("Calle Mayor");

    await user.click(screen.getByRole("link", { name: "Profile" }));
    expect(
      await screen.findByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();

    const firstName = screen.getByLabelText("First name");
    await user.clear(firstName);
    await user.type(firstName, "Grace");
    await user.click(screen.getByRole("button", { name: /Save (address|profile)/ }));

    await waitFor(() => {
      expect(server.profile.personalDetails.firstName).toBe("Grace");
    });

    expect(server.profile.personalDetails.address?.street).toBe("Calle Mayor");

    await user.click(screen.getByRole("link", { name: "Address" }));
    expect(
      await screen.findByRole("heading", { name: "Address" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toHaveValue("Spain");
    expect(screen.getByLabelText("Street")).toHaveValue("Calle Mayor");
    expect(server.profile.personalDetails.address?.city).toBe("Madrid");
  });

  it("redirects /profile to the account Profile through the route tree", async () => {
    await renderShell("/profile");

    await expectLocation("/account/profile");
    expect(
      await screen.findByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();
  });

  it("shows the Business toggle to an eligible Owner and lands on a venue with tabs", async () => {
    server = createServer({
      venues: [
        venue({ businessId: "b1", tradeName: "Alpha Bar" }),
        venue({ businessId: "b2", tradeName: "Beta Bar" }),
      ],
      portfolio: portfolio([
        { _id: "b1", tradeName: "Alpha Bar" },
        { _id: "b2", tradeName: "Beta Bar" },
      ]),
    });
    const user = userEvent.setup();

    await renderShell("/dashboard");

    const workspace = await screen.findByRole("group", { name: "Workspace" });
    await user.click(within(workspace).getByRole("button", { name: "Business" }));

    expect(
      await findBusinessDashboard(),
    ).toBeInTheDocument();
    await expectLocation("/business/b1/dashboard");

    const tabs = screen.getByRole("navigation", { name: "Venues" });
    expect(
      within(tabs).getByRole("link", { name: "Alpha Bar" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(tabs).getByRole("link", { name: "Beta Bar" }),
    ).toBeInTheDocument();
    expect(server.mode).toBe("business");
  }, 30_000);

  it("switches venues from a tab without leaving Business mode", async () => {
    server = createServer({
      mode: "business",
      venues: [
        venue({ businessId: "b1", tradeName: "Alpha Bar" }),
        venue({ businessId: "b2", tradeName: "Beta Bar" }),
      ],
      portfolio: portfolio([
        { _id: "b1", tradeName: "Alpha Bar" },
        { _id: "b2", tradeName: "Beta Bar" },
      ]),
    });
    const user = userEvent.setup();

    await renderShell("/business/b1/dashboard");

    expect(
      await findBusinessDashboard(),
    ).toBeInTheDocument();
    const tabs = await findVenueTabs();
    await user.click(within(tabs).getByRole("link", { name: "Beta Bar" }));

    await expectLocation("/business/b2/dashboard");
    expect(server.mode).toBe("business");
    expect(mockPost).not.toHaveBeenCalledWith(
      "/api/v1/auth/set-mode",
      expect.anything(),
    );
  });

  it("opens the shared inbox from Business Me without venue filtering", async () => {
    server = createServer({
      mode: "business",
      venues: [
        venue({ businessId: "b1", tradeName: "Alpha Bar" }),
        venue({ businessId: "b2", tradeName: "Beta Bar" }),
      ],
      portfolio: portfolio([
        { _id: "b1", tradeName: "Alpha Bar" },
        { _id: "b2", tradeName: "Beta Bar" },
      ]),
      inbox: [
        inboxEntry({
          notificationId: "n2",
          businessId: "b2",
          message: "Beta venue update.",
          createdAt: "2026-03-27T11:45:00.000Z",
        }),
        inboxEntry({
          notificationId: "n1",
          businessId: "b1",
          message: "Alpha venue update.",
          createdAt: "2026-03-27T10:15:00.000Z",
        }),
      ],
    });
    const user = userEvent.setup();

    await renderShell("/business/b1/dashboard");

    expect(await findBusinessDashboard()).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Notifications" }));

    await expectLocation("/business/b1/notifications");
    expect(
      await screen.findByRole("heading", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Alpha venue update.")).toBeInTheDocument();
    expect(screen.getByText("Beta venue update.")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/notifications/inbox?page=1",
      expect.anything(),
    );
  });

  it("renders the Business Me inbox and navigation in Spanish", async () => {
    server = createServer({
      mode: "business",
      venues: [venue({ businessId: "b1", tradeName: "Alpha Bar" })],
      portfolio: portfolio([{ _id: "b1", tradeName: "Alpha Bar" }]),
      inbox: [inboxEntry({ message: "Actualización del local." })],
    });

    await renderShell("/business/b1/notifications", "es");

    expect(
      await screen.findByRole("heading", { name: "Notificaciones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Notificaciones" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Yo")).toBeInTheDocument();
    expect(
      await screen.findByText("Actualización del local."),
    ).toBeInTheDocument();
  });

  it("shows Owner chrome only on a tab the User owns", async () => {
    server = createServer({
      mode: "business",
      venues: [
        venue({ businessId: "b1", tradeName: "Alpha Bar", source: "ownership" }),
        venue({
          businessId: "b2",
          tradeName: "Beta Bar",
          source: "membership",
          effectiveLayer: "employee",
        }),
      ],
      portfolio: portfolio([{ _id: "b1", tradeName: "Alpha Bar" }]),
    });
    const user = userEvent.setup();

    await renderShell("/business/b1/dashboard");

    expect(
      await screen.findByRole(
        "button",
        { name: "Add venue" },
        { timeout: FIND_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Company" })).toBeInTheDocument();

    const tabs = await findVenueTabs();
    await user.click(within(tabs).getByRole("link", { name: "Beta Bar" }));

    await expectLocation("/business/b2/dashboard");
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Add venue" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("link", { name: "Company" }),
    ).not.toBeInTheDocument();
  });

  it("adds a venue through the existing flow and shows it after invalidation", async () => {
    server = createServer({
      mode: "business",
      venues: [venue({ businessId: "b1", tradeName: "Alpha Bar" })],
      portfolio: portfolio(),
    });
    const user = userEvent.setup();

    await renderShell("/business/b1/dashboard");

    expect(
      await findBusinessDashboard(),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add venue" }));
    await user.type(await screen.findByLabelText("Trade name"), "New Venue");
    await user.click(screen.getByRole("button", { name: "Create venue" }));

    const tabs = await findVenueTabs();
    expect(
      await within(tabs).findByRole("link", { name: "New Venue" }),
    ).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/business",
      expect.objectContaining({ tradeName: "New Venue", country: "USA" }),
    );
  });

  it("switches to Business when an eligible deep link arrives in Customer mode", async () => {
    server = createServer({
      venues: [venue({ businessId: "b1", tradeName: "Alpha Bar" })],
      portfolio: portfolio([{ _id: "b1", tradeName: "Alpha Bar" }]),
    });

    await renderShell("/business/b1/dashboard");

    expect(
      await findBusinessDashboard(),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(server.mode).toBe("business");
    });
  });

  it("explains an ineligible Business deep link and stays in Customer", async () => {
    server = createServer({
      venues: [
        venue({
          businessId: "b2",
          tradeName: "Beta Bar",
          canEnterBusiness: false,
        }),
      ],
    });

    await renderShell("/business/b2/dashboard");

    await expectLocation("/dashboard");
    expect(
      await screen.findByText(
        "Business is not available for that venue. You are in Customer mode.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(server.mode).toBe("customer");
  });

  it("reconciles an Account deep link in Business mode back to Customer", async () => {
    server = createServer({ mode: "business" });

    await renderShell("/account/profile");

    expect(
      await screen.findByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(server.mode).toBe("customer");
    });
  });

  it("sends the User to Customer with an explanation when eligibility is lost", async () => {
    server = createServer({
      mode: "business",
      venues: [venue({ businessId: "b1", tradeName: "Alpha Bar" })],
      portfolio: portfolio([{ _id: "b1", tradeName: "Alpha Bar" }]),
    });

    const { client } = await renderShell("/business/b1/dashboard");

    expect(
      await findBusinessDashboard(),
    ).toBeInTheDocument();

    server.venues = [
      venue({
        businessId: "b1",
        tradeName: "Alpha Bar",
        canEnterBusiness: false,
      }),
    ];
    await client.invalidateQueries({ queryKey: queryKeys.auth.venues() });

    await expectLocation("/dashboard");
    expect(
      await screen.findByText(
        "Business is not available for that venue. You are in Customer mode.",
      ),
    ).toBeInTheDocument();
  });

  it.each(["/employee", "/employee/dashboard"])(
    "redirects %s to the linked venue",
    async (entry) => {
      server = createServer({
        mode: "business",
        user: {
          id: "u1",
          email: "staff@example.com",
          type: "user",
          role: "Employee",
          employeeId: "e1",
          businessId: "b1",
        },
        venues: [
          venue({
            businessId: "b1",
            tradeName: "Alpha Bar",
            source: "membership",
            effectiveLayer: "employee",
          }),
        ],
      });

      await renderShell(entry);

      await expectLocation("/business/b1/dashboard");
      expect(await findBusinessDashboard()).toBeInTheDocument();
    },
  );

  it("sends a blocked linked venue to the Customer dashboard", async () => {
    server = createServer({
      mode: "business",
      user: {
        id: "u1",
        email: "staff@example.com",
        type: "user",
        role: "Employee",
        employeeId: "e1",
        businessId: "b2",
      },
      venues: [
        venue({
          businessId: "b2",
          tradeName: "Beta Bar",
          source: "membership",
          effectiveLayer: "employee",
          canEnterBusiness: false,
        }),
      ],
    });

    await renderShell("/employee/dashboard");

    await expectLocation("/dashboard");
    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("redirects /employee/profile to the account Profile", async () => {
    await renderShell("/employee/profile");

    await expectLocation("/account/profile");
    expect(
      await screen.findByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();
  });

  it("renders the Customer and Business chrome in Spanish", async () => {
    server = createServer({
      venues: [
        venue({ businessId: "b1", tradeName: "Alpha Bar" }),
        venue({ businessId: "b2", tradeName: "Beta Bar" }),
      ],
      portfolio: portfolio([
        { _id: "b1", tradeName: "Alpha Bar" },
        { _id: "b2", tradeName: "Beta Bar" },
      ]),
    });
    const user = userEvent.setup();

    await renderShell("/dashboard", "es");

    const workspace = await screen.findByRole("group", {
      name: "Espacio de trabajo",
    });
    await user.click(within(workspace).getByRole("button", { name: "Empresa" }));

    expect(
      await screen.findByRole("heading", { name: "Panel de empresa" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Locales" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Añadir local" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Empresa" })).toBeInTheDocument();
  });

  it("renders the guard explanation in Spanish", async () => {
    server = createServer({
      venues: [
        venue({
          businessId: "b2",
          tradeName: "Beta Bar",
          canEnterBusiness: false,
        }),
      ],
    });

    await renderShell("/business/b2/dashboard", "es");

    expect(
      await screen.findByText(
        "La empresa no está disponible para ese local. Estás en modo Cliente.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the Customer account area in Spanish", async () => {
    const user = userEvent.setup();

    await renderShell("/account/profile", "es");

    expect(
      await screen.findByRole("heading", { name: "Perfil" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar perfil" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dirección" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Dirección" }));

    await expectLocation("/account/address");
    expect(
      await screen.findByRole("heading", { name: "Dirección" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar dirección" }),
    ).toBeInTheDocument();
  });

  it("renders the mode fallback in Spanish", async () => {
    server = createServer({
      venues: [venue({ businessId: "b1", tradeName: "Alpha Bar" })],
      portfolio: portfolio([{ _id: "b1", tradeName: "Alpha Bar" }]),
    });

    await renderShell("/mode", "es");

    expect(
      await screen.findByRole("heading", { name: "¿Cómo quieres continuar?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar como cliente" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar como empresa" }),
    ).toBeInTheDocument();
  });
});
