import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home } from "lucide-react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { renderWithI18n } from "@/test/i18nTestUtils";
import ActorSidebar from "../ActorSidebar";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

describe("ActorSidebar", () => {
  it("renders top-level nav links from pages", async () => {
    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <TooltipProvider>
          <SidebarProvider defaultOpen>
            <ActorSidebar
              pages={[
                {
                  key: "home",
                  label: "Home",
                  to: "/dashboard",
                  icon: Home,
                  isActive: true,
                },
              ]}
            />
          </SidebarProvider>
        </TooltipProvider>
        <Routes>
          <Route path="/" element={<div>Outlet</div>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const home = screen.getByRole("link", { name: /home/i });
    expect(home).toHaveAttribute("href", "/dashboard");
  });

  it("renders collapsible group and sub-links from subPages", async () => {
    const user = userEvent.setup();
    await renderWithI18n(
      <MemoryRouter initialEntries={["/"]}>
        <TooltipProvider>
          <SidebarProvider defaultOpen>
            <ActorSidebar
              pages={[]}
              subPages={[
                {
                  key: "sub1",
                  label: "Sub page",
                  to: "/settings/sub",
                  icon: Home,
                  isActive: false,
                  groupName: "Settings",
                },
              ]}
            />
          </SidebarProvider>
        </TooltipProvider>
        <Routes>
          <Route path="/" element={<div>Outlet</div>} />
          <Route path="/settings/sub" element={<div>Sub</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /sub page/i }));
    expect(await screen.findByText("Sub")).toBeInTheDocument();
  });
});
