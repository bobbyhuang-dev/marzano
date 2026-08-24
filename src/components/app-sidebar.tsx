import { useEffect, useState } from "react";
import {
  ListTodo,
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Sun,
  type LucideIcon,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { nextTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "marzano.sidebar.v1";

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Shown next to the label, and under the icon when collapsed. */
  count?: number;
}

function loadCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      collapsed ? "collapsed" : "expanded",
    );
  } catch {
    // A sidebar that forgets its width is better than one that crashes.
  }
}

const FOOTER_BUTTON =
  "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground ring-offset-background transition-colors duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const THEME_LABELS: Record<ThemePreference, { label: string; icon: LucideIcon }> = {
  system: { label: "System theme", icon: Monitor },
  light: { label: "Light theme", icon: Sun },
  dark: { label: "Dark theme", icon: Moon },
};

interface SidebarThemeToggleProps {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  collapsed: boolean;
}

/**
 * One button rather than three: the choice is a preference people set once,
 * and cycling keeps it legible at the collapsed width, where a segmented
 * control would not fit.
 */
function SidebarThemeToggle({
  theme,
  onThemeChange,
  collapsed,
}: SidebarThemeToggleProps) {
  const { label, icon: Icon } = THEME_LABELS[theme];
  const upcoming = THEME_LABELS[nextTheme(theme)].label.toLowerCase();

  return (
    <button
      type="button"
      onClick={() => onThemeChange(nextTheme(theme))}
      aria-label={`${label}. Switch to ${upcoming}`}
      title={`${label}. Switch to ${upcoming}`}
      className={cn(FOOTER_BUTTON, collapsed && "w-11 justify-center px-0")}
    >
      <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
      <span className={cn("whitespace-nowrap", collapsed && "sr-only")}>{label}</span>
    </button>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center gap-2.5 px-4",
        collapsed && "justify-center px-0",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-primary text-primary-foreground">
        <ListTodo className="size-5" aria-hidden="true" />
      </span>
      {collapsed ? null : (
        <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          Marzano
        </span>
      )}
    </div>
  );
}

interface SidebarNavProps {
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
}

function SidebarNav({ items, activeId, onSelect, collapsed }: SidebarNavProps) {
  return (
    <nav
      aria-label="Views"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3",
        collapsed && "items-center px-2",
      )}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium ring-offset-background transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              collapsed && "w-11 flex-col justify-center gap-0.5 px-0",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
            <span className={cn("flex-1 truncate text-left", collapsed && "sr-only")}>
              {item.label}
            </span>
            {item.count ? (
              // Collapsed, the count sits under the icon rather than floating over
              // its corner, and inherits the item's own colour: a tally of what the
              // view holds, not a notification waiting to be cleared.
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  collapsed ? "text-[0.625rem] leading-none" : "text-xs",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

interface AppSidebarProps {
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  /** The drawer state for narrow screens, where the sidebar cannot stay docked. */
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}

function AppSidebar({
  items,
  activeId,
  onSelect,
  theme,
  onThemeChange,
  menuOpen,
  onMenuOpenChange,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [revealingToggleLabel, setRevealingToggleLabel] = useState(false);

  useEffect(() => {
    saveCollapsed(collapsed);
  }, [collapsed]);

  const toggleCollapsed = () => {
    setRevealingToggleLabel(collapsed);
    setCollapsed(!collapsed);
  };

  return (
    <>
      {/* Docked from lg up, where the content still has room to breathe next to it. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 self-start flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav
          items={items}
          activeId={activeId}
          onSelect={onSelect}
          collapsed={collapsed}
        />
        <div
          className={cn(
            "flex shrink-0 flex-col gap-1 border-t border-border p-3",
            collapsed && "items-center px-2",
          )}
        >
          <SidebarThemeToggle
            theme={theme}
            onThemeChange={onThemeChange}
            collapsed={collapsed}
          />
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(FOOTER_BUTTON, collapsed && "w-11 justify-center px-0")}
          >
            {collapsed ? (
              <PanelLeft className="size-[1.125rem] shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-[1.125rem] shrink-0" aria-hidden="true" />
            )}
            <span
              className={cn(
                "whitespace-nowrap",
                collapsed && "sr-only",
                revealingToggleLabel && "animate-sidebar-label-in",
              )}
              onAnimationEnd={() => setRevealingToggleLabel(false)}
            >
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </span>
          </button>
        </div>
      </aside>

      <Sheet open={menuOpen} onOpenChange={onMenuOpenChange}>
        <SheetContent side="left" className="w-[17rem] max-w-[85vw] bg-card dark:bg-card lg:hidden">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Switch between your task views.
          </SheetDescription>
          <SidebarBrand collapsed={false} />
          <SidebarNav
            items={items}
            activeId={activeId}
            collapsed={false}
            onSelect={(id) => {
              onSelect(id);
              onMenuOpenChange(false);
            }}
          />
          <div className="shrink-0 border-t border-border p-3">
            <SidebarThemeToggle
              theme={theme}
              onThemeChange={onThemeChange}
              collapsed={false}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export { AppSidebar };
