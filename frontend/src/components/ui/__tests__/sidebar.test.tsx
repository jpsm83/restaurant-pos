import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/test/i18nTestUtils";
import { Sidebar, SidebarProvider, useSidebar } from "../sidebar";

const mobile = vi.hoisted(() => ({ value: false }));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mobile.value,
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

function MobileSidebarProbe() {
  const { setOpenMobile } = useSidebar();
  return (
    <>
      <button type="button" onClick={() => setOpenMobile(true)}>
        open mobile
      </button>
      <Sidebar>
        <p>Mobile content</p>
      </Sidebar>
    </>
  );
}

afterEach(() => {
  mobile.value = false;
});

describe("sidebar", () => {
  it("throws when useSidebar is used outside SidebarProvider", async () => {
    function Bad() {
      useSidebar();
      return null;
    }
    await expect(
      renderWithI18n(<Bad />),
    ).rejects.toThrow("useSidebar must be used within a SidebarProvider.");
  });

  it("toggles open state on desktop", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <SidebarProvider defaultOpen>
        <SidebarProbe />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("true");
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("sidebar-open")).toHaveTextContent("false");
  });

  it("renders translated mobile sidebar labels in Spanish", async () => {
    const user = userEvent.setup();
    mobile.value = true;

    await renderWithI18n(
      <SidebarProvider>
        <MobileSidebarProbe />
      </SidebarProvider>,
      { language: "es" },
    );

    await user.click(screen.getByRole("button", { name: "open mobile" }));

    expect(await screen.findByText("Barra lateral")).toBeInTheDocument();
    expect(
      screen.getByText("Muestra la barra lateral móvil."),
    ).toBeInTheDocument();
  });
});
