/**
 * Venue People page tests — access gate, membership list, hire form, known
 * failures, and English/Spanish copy.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import BusinessPeoplePage from "../BusinessPeoplePage";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("@/services/http", () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

const managerAccess = {
  businessId: "b1",
  effectiveLayer: "manager",
  source: "membership",
  jobRoles: ["Manager"],
  capabilities: ["viewInventory"],
  canEnterBusiness: true,
};

type MembershipRow = {
  _id: string;
  businessId: string;
  userId: string;
  allEmployeeRoles: string[];
  employmentStatus: string;
  joinDate: string;
  displayName: string;
  email: string;
};

const adaMembership: MembershipRow = {
  _id: "e1",
  businessId: "b1",
  userId: "u1",
  allEmployeeRoles: ["Waiter", "Host"],
  employmentStatus: "Active",
  joinDate: "2026-04-07",
  displayName: "Ada Lovelace",
  email: "ada@example.com",
};

const graceMembership: MembershipRow = {
  _id: "e2",
  businessId: "b1",
  userId: "u2",
  allEmployeeRoles: ["Bartender"],
  employmentStatus: "Seasonal",
  joinDate: "2026-05-01T00:00:00.000Z",
  displayName: "Grace Hopper",
  email: "grace@example.com",
};

function renderPage(language?: "en" | "es") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });

  return renderWithI18n(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/business/b1/people"]}>
        <Routes>
          <Route
            path="/business/:businessId/people"
            element={<BusinessPeoplePage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
    { language },
  );
}

function axiosFailure(status: number, type: string, detail?: string) {
  const response = {
    status,
    data: { type, detail },
  } as AxiosResponse;
  return new AxiosError(
    detail ?? type,
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    response,
  );
}

function useEndpoints(options: {
  access?: typeof managerAccess;
  memberships?: MembershipRow[];
  accessError?: unknown;
  listError?: unknown;
}) {
  mockGet.mockImplementation((url: string) => {
    if (url === "/api/v1/business/b1/access") {
      if (options.accessError) return Promise.reject(options.accessError);
      return Promise.resolve({ data: options.access ?? managerAccess });
    }
    if (url === "/api/v1/employees/business/b1") {
      if (options.listError) return Promise.reject(options.listError);
      return Promise.resolve({ data: options.memberships ?? [] });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

describe("BusinessPeoplePage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("lists memberships with name, email, roles, status, and join date", async () => {
    useEndpoints({ memberships: [adaMembership, graceMembership] });

    await renderPage();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("Waiter, Host")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("04/07/2026")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("05/01/2026")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
  });

  it("shows the empty state when the venue has no memberships", async () => {
    useEndpoints({ memberships: [] });

    await renderPage();

    expect(await screen.findByText("No team members yet")).toBeInTheDocument();
    expect(
      screen.getByText("Hire your first staff member to get started."),
    ).toBeInTheDocument();
  });

  it("shows the loading state while access resolves", async () => {
    mockGet.mockReturnValue(new Promise(() => undefined));

    await renderPage();

    expect(screen.getByText("Loading people...")).toBeInTheDocument();
  });

  it("retries the membership list after a load failure", async () => {
    useEndpoints({
      listError: axiosFailure(500, "https://restaurant-pos.app/errors/internal"),
    });
    const user = userEvent.setup();

    await renderPage();

    expect(await screen.findByText("Could not load people")).toBeInTheDocument();

    useEndpoints({ memberships: [adaMembership] });
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("shows the access-denied state for a non-manager", async () => {
    useEndpoints({
      access: {
        ...managerAccess,
        effectiveLayer: "employee",
        jobRoles: ["Waiter"],
      },
    });

    await renderPage();

    expect(
      await screen.findByText("People are not available"),
    ).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/business/b1/access",
      { signal: expect.any(AbortSignal) },
    );
  });

  it("shows the access-denied state when the snapshot is forbidden", async () => {
    useEndpoints({
      accessError: axiosFailure(
        403,
        "https://restaurant-pos.app/errors/forbidden",
      ),
    });

    await renderPage();

    expect(
      await screen.findByText("People are not available"),
    ).toBeInTheDocument();
  });

  it("filters role choices to the caller's assignment bounds", async () => {
    useEndpoints({ memberships: [] });
    const user = userEvent.setup();

    await renderPage();
    await screen.findByText("No team members yet");
    await user.click(screen.getByRole("button", { name: "Hire staff" }));

    expect(screen.getByRole("checkbox", { name: "Waiter" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Manager" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("hires a staff member and refreshes the list with a localized confirmation", async () => {
    const memberships: MembershipRow[] = [];
    useEndpoints({ memberships });
    mockPost.mockImplementation(async (_url: string, body: FormData) => {
      memberships.push({
        _id: "e3",
        businessId: "b1",
        userId: "u3",
        allEmployeeRoles: JSON.parse(String(body.get("allEmployeeRoles"))),
        employmentStatus: String(body.get("employmentStatus")),
        joinDate: String(body.get("joinDate")),
        displayName: "New Person",
        email: String(body.get("userEmail")),
      });
      return { data: { message: "New employee created successfully!" } };
    });
    const user = userEvent.setup();

    await renderPage();
    await screen.findByText("No team members yet");
    await user.click(screen.getByRole("button", { name: "Hire staff" }));

    const form = screen.getByRole("form", { name: "Hire staff" });
    await user.type(
      within(form).getByLabelText("Sign-in email"),
      "new@example.com",
    );
    await user.click(within(form).getByRole("checkbox", { name: "Waiter" }));
    fireEvent.change(within(form).getByLabelText("Join date"), {
      target: { value: "2026-04-07" },
    });
    await user.click(within(form).getByRole("button", { name: "Hire staff" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [, body] = mockPost.mock.calls[0] as [string, FormData];
    expect(body.get("businessId")).toBe("b1");
    expect(body.get("userEmail")).toBe("new@example.com");
    expect(JSON.parse(String(body.get("allEmployeeRoles")))).toEqual(["Waiter"]);
    expect(body.get("employmentStatus")).toBe("Active");
    expect(body.get("joinDate")).toBe("2026-04-07");

    expect(
      await screen.findByText("Staff member hired successfully."),
    ).toBeInTheDocument();
    expect(await screen.findByText("New Person")).toBeInTheDocument();
  });

  it("requires at least one role before submitting", async () => {
    useEndpoints({ memberships: [] });
    const user = userEvent.setup();

    await renderPage();
    await screen.findByText("No team members yet");
    await user.click(screen.getByRole("button", { name: "Hire staff" }));

    const form = screen.getByRole("form", { name: "Hire staff" });
    await user.type(
      within(form).getByLabelText("Sign-in email"),
      "new@example.com",
    );
    await user.click(within(form).getByRole("button", { name: "Hire staff" }));

    expect(
      await screen.findByText("Select at least one job role."),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "no account",
      error: axiosFailure(
        409,
        "https://restaurant-pos.app/errors/conflict",
        "User does not exist!",
      ),
      copy: "No account uses that email. Ask the person to sign up first.",
    },
    {
      label: "duplicate membership",
      error: axiosFailure(
        409,
        "https://restaurant-pos.app/errors/conflict",
        "User is already an employee!",
      ),
      copy: "That person is already a member of this venue.",
    },
    {
      label: "forbidden",
      error: axiosFailure(
        403,
        "https://restaurant-pos.app/errors/forbidden",
      ),
      copy: "You cannot assign those roles at this venue.",
    },
    {
      label: "validation",
      error: axiosFailure(
        400,
        "https://restaurant-pos.app/errors/validation",
      ),
      copy: "Check the person's details and try again.",
    },
  ])("renders localized copy for a $label hire failure", async ({ error, copy }) => {
    useEndpoints({ memberships: [] });
    mockPost.mockRejectedValue(error);
    const user = userEvent.setup();

    await renderPage();
    await screen.findByText("No team members yet");
    await user.click(screen.getByRole("button", { name: "Hire staff" }));

    const form = screen.getByRole("form", { name: "Hire staff" });
    await user.type(
      within(form).getByLabelText("Sign-in email"),
      "new@example.com",
    );
    await user.click(within(form).getByRole("checkbox", { name: "Waiter" }));
    await user.click(within(form).getByRole("button", { name: "Hire staff" }));

    expect(await screen.findByText(copy)).toBeInTheDocument();
  });

  it("renders the membership list in Spanish", async () => {
    useEndpoints({ memberships: [adaMembership] });

    await renderPage("es");

    expect(await screen.findByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Miembros del equipo")).toBeInTheDocument();
    expect(
      await screen.findByText("Camarero, Recepcionista"),
    ).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("07/04/2026")).toBeInTheDocument();
  });
});
