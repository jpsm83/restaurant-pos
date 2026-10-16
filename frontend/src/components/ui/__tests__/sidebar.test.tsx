import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SidebarProvider, useSidebar } from "../sidebar";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? key,
  }),
}));

function SidebarProbe() {
  const { open, toggleSidebar } = useSidebar();
  return (
    <>
      <span data-testid="sidebar-open">{String(open)}</span>
      <button type="button" onClick={toggleSidebar}>
        toggle
      </button>
    </>
  );
}

describe("sidebar", () => {
  it("throws when useSidebar is used outside SidebarProvider", () => {
    function Bad() {
      useSidebar();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(
      "useSidebar must be used within a SidebarProvider.",
    );
  });

  it("toggles open state on desktop", async () => {
    const user = userEvent.setup();
    render(
      <SidebarProvider defaultOpen>
        <SidebarProbe />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("true");
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("false");
  });
});
