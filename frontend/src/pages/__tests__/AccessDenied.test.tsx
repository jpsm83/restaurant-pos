import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import AccessDenied from "../AccessDenied";

const mockUseAuth = vi.fn();
const mockGetPostLoginDestination = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/auth/postLoginRedirect", () => ({
  getPostLoginDestination: (...args: unknown[]) => mockGetPostLoginDestination(...args),
}));

describe("AccessDenied", () => {
  beforeEach(() => {
    mockGetPostLoginDestination.mockReset();
    mockUseAuth.mockReturnValue({
      state: { status: "unauthenticated", user: null, error: null },
    });
  });

  it("renders home link and go back when unauthenticated", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/denied"]}>
        <Routes>
          <Route path="/denied" element={<AccessDenied />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
  });

  it("navigates to post-login destination when opening workspace", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      state: {
        status: "authenticated",
        user: { id: "u1", email: "u@test.local", type: "user", role: "Customer" },
        error: null,
      },
    });
    mockGetPostLoginDestination.mockReturnValue("/u1/customer/dashboard");
    await renderWithI18n(
      <MemoryRouter initialEntries={["/denied"]}>
        <Routes>
          <Route path="/denied" element={<AccessDenied />} />
          <Route path="/u1/customer/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Open your workspace" }));
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
