import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAY_OPTIONS,
  useBusinessProfileSettingsGate,
} from "../useBusinessProfileSettingsController";

const mockUseAuth = vi.fn();
const mockUseParams = vi.fn();
const mockUseBusinessProfileQuery = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => mockUseParams(),
  };
});

vi.mock("@/services/business/businessService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/business/businessService")>();
  return {
    ...actual,
    useBusinessProfileQuery: (...args: unknown[]) =>
      mockUseBusinessProfileQuery(...args),
  };
});

describe("useBusinessProfileSettingsController exports", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseParams.mockReset();
    mockUseBusinessProfileQuery.mockReset();
  });

  it("exposes full weekday options from Sunday to Saturday", () => {
    expect(DAY_OPTIONS).toHaveLength(7);
    expect(DAY_OPTIONS[0]).toEqual({ value: 0, label: "Sunday" });
    expect(DAY_OPTIONS[6]).toEqual({ value: 6, label: "Saturday" });
  });
});

describe("useBusinessProfileSettingsGate", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseParams.mockReset();
    mockUseBusinessProfileQuery.mockReset();
  });

  it("returns wrong-session when user is not a business session", () => {
    mockUseAuth.mockReturnValue({
      state: { user: { id: "u1", email: "u@test.local", type: "user", role: "Customer" } },
    });
    mockUseParams.mockReturnValue({ businessId: "biz1" });
    mockUseBusinessProfileQuery.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: false,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useBusinessProfileSettingsGate());
    expect(result.current).toEqual({ kind: "wrong-session" });
  });

  it("returns no-business-id when route param is missing", () => {
    mockUseAuth.mockReturnValue({
      state: { user: { id: "b1", email: "b@test.local", type: "business", role: "Tenant" } },
    });
    mockUseParams.mockReturnValue({ businessId: undefined });
    mockUseBusinessProfileQuery.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: false,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useBusinessProfileSettingsGate());
    expect(result.current).toEqual({ kind: "no-business-id" });
  });
});
