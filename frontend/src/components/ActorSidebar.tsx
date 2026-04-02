import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export type ActorSidebarItem = {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  isActive: boolean;
};

type ActorSidebarProps = {
  items: ActorSidebarItem[];
  modeSwitchItems?: ActorSidebarItem[];
};

export default function ActorSidebar({
  items,
  modeSwitchItems = [],
}: ActorSidebarProps) {
  const { t } = useTranslation("nav");
  const { state: sidebarState } = useSidebar();
  const toggleTooltip =
    sidebarState === "expanded" ? t("sidebar.closeMenu") : t("sidebar.openMenu");

  return (
    <TooltipProvider>
      {/* Sidebar is fixed by shadcn/ui; offset it so it doesn't overlap our top navbar. */}
      <Sidebar variant="sidebar" collapsible="icon" className="top-12">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={toggleTooltip}
                className="font-semibold "
              >
                <SidebarTrigger
                  className="hidden md:flex items-center justify-end group-data-[state=collapsed]:justify-center hover:cursor-pointer"
                />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {items.map((item) => {
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.isActive}
                      tooltip={item.label}
                    >
                      <Link to={item.to} className="flex items-center gap-2">
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>

          {modeSwitchItems.length > 0 ? (
            <>
              <SidebarSeparator className="my-2" />
              <SidebarGroup>
                <SidebarMenu>
                  {modeSwitchItems.map((item) => {
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.isActive}
                          tooltip={item.label}
                        >
                          <Link to={item.to} className="flex items-center gap-2">
                            <item.icon className="size-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </>
          ) : null}
        </SidebarContent>

        <SidebarRail />
      </Sidebar>
    </TooltipProvider>
  );
}

