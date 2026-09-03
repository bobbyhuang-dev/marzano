import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Sun,
  type LucideIcon,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/segmented-control";
import { nextTheme, THEME_PREFERENCES, type ThemePreference } from "@/lib/theme";
import { DURATION, prefersReducedMotion } from "@/lib/motion";
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
  "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-ui hover:bg-accent hover:text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70";

/**
 * Text on the docked rail. Collapsing fades it out at once, while the width is
 * still moving; expanding holds the fade until the rail is nearly open. The
 * `sr-only` that takes it out of the flow is applied by `narrow`, once the
 * move is over, so the fade always has a laid-out element to work on. The
 * drawer has no `group/rail` above it, so its copy of the same text stays put.
 */
const RAIL_LABEL =
  "transition-ui delay-(--transition-duration-fast) group-data-collapsed/rail:opacity-0 group-data-collapsed/rail:delay-0";

const THEME_LABELS: Record<ThemePreference, { label: string; icon: LucideIcon }> = {
  system: { label: "System", icon: Monitor },
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
};

// Declared in preference order, so the row reads the way the cycle steps.
const THEME_OPTIONS: SegmentedOption<ThemePreference>[] = THEME_PREFERENCES.map(
  (id) => ({ id, ...THEME_LABELS[id] }),
);

interface SidebarFooterButtonProps extends ComponentProps<"button"> {
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  /** Something behind the button has not been looked at yet. */
  fresh?: boolean;
}

/**
 * The footer's button shape, exported so a control the sidebar does not own --
 * a dialog trigger from `App` -- still sits flush with the ones it does.
 */
function SidebarFooterButton({
  icon: Icon,
  label,
  collapsed,
  fresh = false,
  className,
  ...props
}: SidebarFooterButtonProps) {
  return (
    <button
      type="button"
      title={label}
      className={cn(FOOTER_BUTTON, collapsed && "w-11 justify-center px-0", className)}
      {...props}
    >
      <span className="relative shrink-0">
        <Icon className="size-[1.125rem]" aria-hidden="true" />
        {/* On the icon rather than the label, so it survives the collapse. The
            ring cuts it out of the icon behind it. */}
        {fresh ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-card"
          />
        ) : null}
      </span>
      <span className={cn("whitespace-nowrap", RAIL_LABEL, collapsed && "sr-only")}>
        {label}
        {fresh ? <span className="sr-only"> (new)</span> : null}
      </span>
    </button>
  );
}

interface SidebarThemeToggleProps {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  collapsed: boolean;
}

/**
 * Collapsed, the rail is 44px wide and cycling is the only shape that fits, so
 * the icon has to carry the whole state: it swaps with a quarter turn, which
 * says the press landed and which way the choice moved. Without it the button
 * changes glyph between frames and reads as a redraw rather than an answer.
 */
function CyclingThemeButton({
  theme,
  onThemeChange,
}: Omit<SidebarThemeToggleProps, "collapsed">) {
  const { label, icon: Icon } = THEME_LABELS[theme];
  const upcoming = THEME_LABELS[nextTheme(theme)].label.toLowerCase();
  const description = `Theme: ${label.toLowerCase()}. Switch to ${upcoming}`;

  return (
    <button
      type="button"
      onClick={() => onThemeChange(nextTheme(theme))}
      aria-label={description}
      title={description}
      className={cn(FOOTER_BUTTON, "w-11 justify-center px-0 animate-fade-in")}
    >
      <span className="relative flex size-[1.125rem] shrink-0 items-center justify-center">
        <AnimatePresence initial={false}>
          <motion.span
            key={theme}
            aria-hidden="true"
            className="absolute inset-0"
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          >
            <Icon className="size-[1.125rem]" />
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

/**
 * Two shapes for one setting. Wide enough for three segments, all of the
 * options are on screen and any of them is one press away -- and the current
 * one is visible without reading it off a single icon. It takes the raised
 * variant rather than the settings dialog's filled one: the footer carries this
 * control on every screen, and a block of accent down there would outweigh the
 * view the sidebar is actually for. Collapsed, the rail is too narrow for three
 * segments and the button cycles instead.
 */
function SidebarThemeToggle({
  theme,
  onThemeChange,
  collapsed,
}: SidebarThemeToggleProps) {
  if (collapsed) {
    return <CyclingThemeButton theme={theme} onThemeChange={onThemeChange} />;
  }

  return (
    <SegmentedControl
      aria-label="Theme"
      options={THEME_OPTIONS}
      value={theme}
      onValueChange={onThemeChange}
      stretch
      iconOnly
      variant="raised"
      className="animate-fade-in"
    />
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
      <BrandMark className="size-8 text-primary" />
      <span
        className={cn(
          "truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground",
          RAIL_LABEL,
          collapsed && "sr-only",
        )}
      >
        Marzano
      </span>
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
              "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-ui outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70",
              collapsed && "w-11 flex-col justify-center gap-0.5 px-0",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
            <span
              className={cn(
                "flex-1 truncate text-left",
                RAIL_LABEL,
                collapsed && "sr-only",
              )}
            >
              {item.label}
            </span>
            {item.count ? (
              // Collapsed, the count sits under the icon rather than floating over
              // its corner, and inherits the item's own colour: a tally of what the
              // view holds, not a notification waiting to be cleared. Keyed so the
              // move between the two places fades rather than pops.
              <span
                key={collapsed ? "stacked" : "inline"}
                className={cn(
                  "font-semibold tabular-nums animate-fade-in",
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
  /**
   * Rendered above the theme toggle. A function rather than a node because only
   * the sidebar knows whether it is collapsed, and the controls have to match.
   */
  footerActions?: (collapsed: boolean) => ReactNode;
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
  footerActions,
  menuOpen,
  onMenuOpenChange,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  // The choice and the layout are two states, because the layout has to wait
  // for the width: collapsing keeps the wide layout under the fading labels
  // until the rail has closed over it, and expanding switches to the wide
  // layout at once so the opening edge reveals it already in place.
  const [narrow, setNarrow] = useState(collapsed);

  useEffect(() => {
    saveCollapsed(collapsed);
  }, [collapsed]);

  useEffect(() => {
    if (!collapsed) return;

    const timer = window.setTimeout(
      () => setNarrow(true),
      prefersReducedMotion() ? 0 : DURATION.base,
    );

    return () => window.clearTimeout(timer);
  }, [collapsed]);

  const toggleCollapsed = () => {
    const next = !collapsed;

    setCollapsed(next);
    if (!next) setNarrow(false);
  };

  return (
    <>
      {/* Docked from lg up, where the content still has room to breathe next to it. */}
      <aside
        data-collapsed={collapsed ? "" : undefined}
        className={cn(
          "group/rail sticky top-0 hidden h-dvh shrink-0 self-start overflow-hidden border-r border-border bg-card transition-[width] duration-base ease-out-cubic lg:block",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        {/* Laid out at the width it is heading for, and only revealed or
            covered by the rail's moving edge: text that reflowed with the
            width would truncate its way across the move. */}
        <div
          className={cn("flex h-full flex-col", narrow ? "w-[4.5rem]" : "w-64")}
        >
          <SidebarBrand collapsed={narrow} />
          <SidebarNav
            items={items}
            activeId={activeId}
            onSelect={onSelect}
            collapsed={narrow}
          />
          <div
            className={cn(
              "flex shrink-0 flex-col gap-1 border-t border-border p-3",
              narrow && "items-center px-2",
            )}
          >
            {footerActions?.(narrow)}
            <SidebarThemeToggle
              theme={theme}
              onThemeChange={onThemeChange}
              collapsed={narrow}
            />
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(FOOTER_BUTTON, narrow && "w-11 justify-center px-0")}
            >
              {collapsed ? (
                <PanelLeft className="size-[1.125rem] shrink-0" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-[1.125rem] shrink-0" aria-hidden="true" />
              )}
              <span className={cn("whitespace-nowrap", RAIL_LABEL, narrow && "sr-only")}>
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </span>
            </button>
          </div>
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
          <div className="flex shrink-0 flex-col gap-1 border-t border-border p-3">
            {footerActions?.(false)}
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

export { AppSidebar, SidebarFooterButton };
