import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChooseEmployeeModePage from "./ChooseEmployeeModePage";

const mockDispatch = vi.fn();
const mockSetModeAndRefresh = vi.fn();
const mockUseAuth = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock("@/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth")>();
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
    logout: vi.fn().mockResolvedValue({ ok: true }),
    setAccessToken: vi.fn(),
  };
});

vi.mock("@/context/AuthModeContext", () => ({
  useAuthMode: () => ({
    setModeAndRefresh: mockSetModeAndRefresh,
    isSettingMode: false,
    mode: "customer",
    isLoading: false,
    isError: false,
    error: null,
    refreshMode: vi.fn(),
  }),
}));

vi.mock("@/services/schedulesService", () => ({
  useNextShiftForEmployee: () => ({
    data: undefined,
    isSuccess: false,
    isLoading: false,
    isError: false,
  }),
}));

function makeEmployeeUser(canLogAsEmployee: boolean) {
  return {
    id: "u1",
    email: "staff@example.com",
    type: "user" as const,
    employeeId: "507f1f77bcf86cd799439011",
    businessId: "507f1f77bcf86cd799439012",
    canLogAsEmployee,
  };
}

function renderAtMode(path = "/u1/mode", client?: QueryClient) {
  const qc =
    client ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: 0 },
      },
    });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:userId/mode" element={<ChooseEmployeeModePage />} />
          <Route
            path="/:userId/customer"
            element={<div data-testid="customer-shell">Customer shell</div>}
          />
          <Route
            path="/:userId/employee"
            element={<div data-testid="employee-shell">Employee shell</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ChooseEmployeeModePage (Phase 3.7)", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockSetModeAndRefresh.mockReset();
    mockUseAuth.mockReset();
    mockGetCurrentUser.mockReset();
    mockSetModeAndRefresh.mockResolvedValue(undefined);
    mockGetCurrentUser.mockResolvedValue({ ok: true, data: null });
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: makeEmployeeUser(true),
        error: null,
      },
      dispatch: mockDispatch,
    });
  });

  it("calls setModeAndRefresh with customer then navigates to customer shell", async () => {
    const user = userEvent.setup();
    renderAtMode();

    await user.click(screen.getByRole("button", { name: /continue as customer/i }));

    await waitFor(() => {
      expect(mockSetModeAndRefresh).toHaveBeenCalledWith("customer");
    });
    await waitFor(() => {
      expect(screen.getByTestId("customer-shell")).toBeInTheDocument();
    });
  });

  it("calls setModeAndRefresh with employee when canLogAsEmployee then navigates", async () => {
    const user = userEvent.setup();
    renderAtMode();

    await user.click(screen.getByRole("button", { name: /continue as employee/i }));

    await waitFor(() => {
      expect(mockSetModeAndRefresh).toHaveBeenCalledWith("employee");
    });
    await waitFor(() => {
      expect(screen.getByTestId("employee-shell")).toBeInTheDocument();
    });
  });

  it("disables Continue as employee when canLogAsEmployee is false", () => {
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: makeEmployeeUser(false),
        error: null,
      },
      dispatch: mockDispatch,
    });

    renderAtMode();

    expect(screen.getByRole("button", { name: /continue as employee/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /continue as customer/i })).not.toBeDisabled();
  });
});
