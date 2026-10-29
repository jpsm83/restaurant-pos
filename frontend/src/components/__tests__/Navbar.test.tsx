import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as i18nModule from "@/i18n/i18n";
import { renderWithI18n } from "@/test/i18nTestUtils";
import Navbar from "../Navbar";

const mockDispatch = vi.fn();

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

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

describe("Navbar", () => {
  it("renders the Business link on customer marketing home", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Navbar />
                <div>Page</div>
              </>
            }
          />
          <Route path="/business" element={<div>Business page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    const businessTab = screen.getByRole("link", { name: /business/i });
    await user.click(businessTab);
    expect(await screen.findByText("Business page")).toBeInTheDocument();
  });

  it("renders the User link on business marketing path", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business"]}>
        <Routes>
          <Route
            path="/business"
            element={
              <>
                <Navbar />
                <div>Business page</div>
              </>
            }
          />
          <Route path="/" element={<div>Customer page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const userLink = screen.getByRole("link", { name: /switch to user/i });
    await user.click(userLink);
    expect(await screen.findByText("Customer page")).toBeInTheDocument();
  });

  it("links Sign in to the shared auth entry on the business audience", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business"]}>
        <Routes>
          <Route
            path="/business"
            element={
              <>
                <Navbar />
                <div>Page</div>
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const signIn = screen.getByRole("link", { name: /sign in/i });
    expect(signIn).toHaveAttribute("href", "/login");
  });

  it("links Sign up to the shared sign-up form on the business audience", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/business"]}>
        <Routes>
          <Route
            path="/business"
            element={
              <>
                <Navbar />
                <div>Page</div>
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  // Phase 2.3 — language popover calls persisted change helper.
  it("opens language popover and calls changeAppLanguage when a locale is chosen", async () => {
    const user = userEvent.setup();
    const spy = vi
      .spyOn(i18nModule, "changeAppLanguage")
      .mockResolvedValue(undefined);

    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Navbar />
                <div>Page</div>
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: /change language/i }),
    );
    await user.click(
      await screen.findByRole("menuitemradio", { name: /^Español$/ }),
    );

    expect(spy).toHaveBeenCalledWith("es");
    spy.mockRestore();
  });
});
