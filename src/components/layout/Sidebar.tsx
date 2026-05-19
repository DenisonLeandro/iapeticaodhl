import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigationItems, type NavigationItem } from "@/config/navigation";
import { useUnreadPublicationsCount } from "@/hooks/usePublications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";


interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NavItem = ({
  item,
  collapsed,
  badgeCount,
}: {
  item: NavigationItem;
  collapsed: boolean;
  badgeCount: number;
}) => {
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.path}
      end={item.path === "/cases"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
          isActive &&
            "bg-sidebar-accent text-sidebar-foreground border-l-2 border-primary -ml-[2px]",
          collapsed && "justify-center px-0"
        )
      }
    >
      <div className="relative shrink-0">
        <Icon className="h-5 w-5" />
        {collapsed && badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </div>
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {badgeCount > 0 && (
            <Badge
              variant="destructive"
              className="h-5 min-w-5 justify-center px-1.5 text-xs"
            >
              {badgeCount > 99 ? "99+" : badgeCount}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
          {badgeCount > 0 && ` (${badgeCount})`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
};

const ExpandableNavItem = ({
  item,
  collapsed,
}: {
  item: NavigationItem;
  collapsed: boolean;
}) => {
  const location = useLocation();
  const isChildActive = item.children?.some((child) =>
    location.pathname.startsWith(child.path)
  );
  // Children always visible

  const Icon = item.icon;

  if (collapsed) {
    // When collapsed, show parent icon with tooltip listing children
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <NavLink
            to={item.children?.[0]?.path ?? item.path}
            className={cn(
              "flex items-center justify-center rounded-lg py-2.5 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
              isChildActive &&
                "bg-sidebar-accent text-sidebar-foreground border-l-2 border-primary -ml-[2px]"
            )}
          >
            <Icon className="h-5 w-5" />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{item.label}</span>
            {item.children?.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                className="text-xs hover:underline"
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div>
      <div
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
          "text-muted-foreground",
          isChildActive && "text-sidebar-foreground"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
      </div>
      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
        {item.children?.map((child) => (
          <NavItem key={child.path} item={child} collapsed={false} badgeCount={0} />
        ))}
      </div>
    </div>
  );
};

const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { data: unreadPublications = 0 } = useUnreadPublicationsCount();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            JT
          </div>
          {!collapsed && (
            <span className="font-display font-semibold text-sidebar-foreground whitespace-nowrap text-base">
              Peticionamento com IA
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navigationItems.map((item) => {
          if (item.children && item.children.length > 0) {
            return (
              <ExpandableNavItem
                key={item.path}
                item={item}
                collapsed={collapsed}
              />
            );
          }

          const badgeCount = item.showUnreadBadge ? unreadPublications : 0;
          return (
            <NavItem
              key={item.path}
              item={item}
              collapsed={collapsed}
              badgeCount={badgeCount}
            />
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-2">Recolher</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
