import { useCallback, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, Settings2 } from "lucide-react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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

export type ActorSidebarSettingsItem = {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  isActive: boolean;
};

type ActorSidebarProps = {
  items: ActorSidebarItem[];
  modeSwitchItems?: ActorSidebarItem[];
  /** Optional collapsible group (e.g. business Settings → Delivery, Metrics). */
  settingsItems?: ActorSidebarSettingsItem[];
};

export default function ActorSidebar({
  items,
  modeSwitchItems = [],
  settingsItems = [],
}: ActorSidebarProps) {
  const { t } = useTranslation("nav");
  const { state: sidebarState, isMobile, setOpen, setOpenMobile } = useSidebar();
  const toggleTooltip =
    sidebarState === "expanded" ? t("sidebar.closeMenu") : t("sidebar.openMenu");

  /** Expand from icon-collapsed (or open the mobile sheet). `SidebarTrigger` alone toggles closed. */
  const expandSidebar = useCallback(() => {
    if (isMobile) setOpenMobile(true);
    else setOpen(true);
  }, [isMobile, setOpen, setOpenMobile]);

  const anySettingsActive = settingsItems.some((i) => i.isActive);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const settingsOpen = anySettingsActive || settingsExpanded;

  return (
    <TooltipProvider>
      {/* Sidebar is fixed by shadcn/ui; offset it so it doesn't overlap our top navbar. */}
      <Sidebar variant="sidebar" collapsible="icon" className="top-14">
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
                      <Link
                        to={item.to}
                        className="flex items-center gap-2"
                        onClick={expandSidebar}
                      >
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {settingsItems.length > 0 ? (
                <SidebarMenuItem>
                  <CollapsiblePrimitive.Root
                    open={settingsOpen}
                    onOpenChange={setSettingsExpanded}
                    className="group/collapsible min-w-0 w-full"
                  >
                    <CollapsiblePrimitive.Trigger asChild>
                      <SidebarMenuButton
                        isActive={anySettingsActive}
                        tooltip={t("settings.title")}
                        onClick={expandSidebar}
                      >
                        <Settings2 className="size-4" />
                        <span>{t("settings.title")}</span>
                        <ChevronDown className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsiblePrimitive.Trigger>
                    <CollapsiblePrimitive.Content className="overflow-hidden">
                      <SidebarMenuSub>
                        {settingsItems.map((sub) => (
                          <SidebarMenuSubItem key={sub.key}>
                            <SidebarMenuSubButton asChild isActive={sub.isActive}>
                              <Link
                                to={sub.to}
                                className="flex items-center gap-2"
                                onClick={expandSidebar}
                              >
                                <sub.icon className="size-4" />
                                <span>{sub.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsiblePrimitive.Content>
                  </CollapsiblePrimitive.Root>
                </SidebarMenuItem>
              ) : null}
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
                          <Link
                            to={item.to}
                            className="flex items-center gap-2"
                            onClick={expandSidebar}
                          >
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

