import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "./LoginPage";

const mockDispatch = vi.fn();
const mockLogin = vi.fn();

vi.mock("@/auth/store/AuthContext", () => ({
  useAuth: () => ({
    state: {
      user: null,
      status: "unauthenticated",
      error: null,
    },
    dispatch: mockDispatch,
  }),
}));

vi.mock("@/auth", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockLogin.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("shows required validation when form is empty", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      screen.getByText("Email and password are required.")
    ).toBeInTheDocument();
  });

  it("shows backend error on failed login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      ok: false,
      error: "Invalid credentials",
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email/i), "john@doe.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });
});
