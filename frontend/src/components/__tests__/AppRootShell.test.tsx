import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { renderWithI18n } from "@/test/i18nTestUtils";
import AppRootShell from "../AppRootShell";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/Navbar", () => ({
  default: () => <nav data-testid="test-navbar">Navbar</nav>,
}));

vi.mock("@/App", () => ({
  default: () => <div data-testid="test-app">App</div>,
}));

function ShellRoute() {
  return <AppRootShell />;
}

describe("AppRootShell", () => {
  it("renders Navbar on standard paths", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<ShellRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("test-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("test-app")).toBeInTheDocument();
  });

  it("omits Navbar on minimal-chrome auth paths", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ShellRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("test-navbar")).not.toBeInTheDocument();
    expect(screen.getByTestId("test-app")).toBeInTheDocument();
  });
});
