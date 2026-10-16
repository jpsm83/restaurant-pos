import { useCallback, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import {
  SidebarFooter,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";

export type ActorSidebarItem = {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  isActive: boolean;
};

export type ActorSidebarSubPage = {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  isActive: boolean;
  /** Parent collapsible label; items sharing the same value form one group. */
  groupName: string;
  /** Icon for the parent row; omit to use the default settings icon. */
  groupIcon?: LucideIcon;
};

/** @deprecated Use `ActorSidebarSubPage` */
export type ActorSidebarSettingsItem = ActorSidebarSubPage;

type ActorSidebarProps = {
  pages: ActorSidebarItem[];
  subPages?: ActorSidebarSubPage[];
};

export default function ActorSidebar({
  pages,
  subPages = [],
}: ActorSidebarProps) {
  const { open, setOpen, openMobile, setOpenMobile, isMobile } = useSidebar();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const subPageGroups = useMemo(() => {
    const map = new Map<string, ActorSidebarSubPage[]>();
    for (const sub of subPages) {
      const list = map.get(sub.groupName);
      if (list) list.push(sub);
      else map.set(sub.groupName, [sub]);
    }
    return [...map.entries()].map(([groupName, items]) => ({
      groupName,
      items,
      GroupIcon: items[0]?.groupIcon ?? Settings,
    }));
  }, [subPages]);

  /** Expand from icon-collapsed (or open the mobile sheet). `SidebarTrigger` alone toggles closed. */
  const expandSidebar = useCallback(() => {
    if (isMobile) setOpenMobile(true);
    else setOpen(true);
  }, [isMobile, setOpen, setOpenMobile]);

  /** Match nav links: first expand the shell if needed, without collapsing the group on that same click. */
  const onGroupOpenChange = useCallback(
    (groupName: string, next: boolean) => {
      if (isMobile) {
        if (!openMobile) {
          setOpenMobile(true);
          setOpenGroups((prev) => ({ ...prev, [groupName]: true }));
          return;
        }
        setOpenGroups((prev) => ({ ...prev, [groupName]: next }));
        return;
      }
      if (!open) {
        setOpen(true);
        setOpenGroups((prev) => ({ ...prev, [groupName]: true }));
        return;
      }
      setOpenGroups((prev) => ({ ...prev, [groupName]: next }));
    },
    [isMobile, open, openMobile, setOpen, setOpenMobile]
  );

  return (
    <>
      {/* Sidebar Header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-end group-data-[collapsible=icon]:justify-center">
            <SidebarTrigger />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Sidebar Content */}
      <SidebarContent>
        <SidebarMenu>
          {pages.map((page) => (
            <SidebarMenuItem key={page.key}>
              <SidebarMenuButton
                asChild
                isActive={page.isActive}
                tooltip={page.label}
              >
                <Link to={page.to} onClick={expandSidebar}>
                  <page.icon className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {page.label}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          {subPageGroups.map(({ groupName, items, GroupIcon }) => (
            <Collapsible
              key={groupName}
              open={openGroups[groupName] ?? true}
              onOpenChange={(next) => onGroupOpenChange(groupName, next)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    isActive={items.some((s) => s.isActive)}
                    title={groupName}
                    onClick={expandSidebar}
                  >
                    <GroupIcon className="size-4" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {groupName}
                    </span>
                    <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {items.map((sub) => (
                      <SidebarMenuSubItem key={sub.key}>
                        <SidebarMenuSubButton asChild isActive={sub.isActive}>
                          <Link to={sub.to} onClick={expandSidebar}>
                            <sub.icon className="size-4 shrink-0" />
                            <span>{sub.label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarContent>

      {/* Sidebar Footer */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Footer">
              Footer Footer Footer
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
