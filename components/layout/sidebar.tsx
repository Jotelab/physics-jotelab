"use client";

import { FocusScope } from "@radix-ui/react-focus-scope";
import { useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Wand2,
  Library,
  GraduationCap,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Settings,
  ArrowLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/features/auth/actions";
import type { UserProfile } from "@/features/auth/types";

type SidebarContentProps = {
  profile?: UserProfile | null;
  isCollapsed: boolean;
  headerSlot: React.ReactNode;
  onNavigate?: () => void;
  /** Larger tap targets for drawer / tablet */
  touchFriendly?: boolean;
};

const profileMenuItemClass =
  "min-h-0 cursor-pointer gap-3 rounded-md px-4 py-3 text-base focus:bg-accent focus:text-accent-foreground";

function SidebarContent({
  profile,
  isCollapsed,
  headerSlot,
  onNavigate,
  touchFriendly = false,
}: SidebarContentProps) {
  const pathname = usePathname();
  const t = useTranslations("common");
  const tSettings = useTranslations("settings");
  const isSettingsDomain =
    pathname.startsWith("/settings") || pathname.startsWith("/account");

  const workspaceNavItems = [
    { href: "/generate", label: t("generate"), icon: Wand2 },
    { href: "/learn", label: t("learn"), icon: GraduationCap },
    { href: "/library", label: t("library"), icon: Library },
  ];

  const settingsNavItems = [
    { href: "/account", label: tSettings("myAccount"), icon: User },
    { href: "/settings", label: tSettings("preferences"), icon: Settings },
  ];

  const navItems = isSettingsDomain ? settingsNavItems : workspaceNavItems;

  function isNavActive(href: string) {
    if (href === "/library") return pathname.startsWith("/library");
    if (href === "/account") return pathname.startsWith("/account");
    if (href === "/settings") return pathname.startsWith("/settings");
    return pathname === href;
  }

  const displayName = profile?.display_name ?? profile?.email ?? t("user");
  const creditBalance = profile?.credit_balance ?? "--";
  const initials = displayName.substring(0, 2).toUpperCase();

  function navLinkClass(isActive: boolean) {
    return cn(
      "flex items-center rounded-lg transition-colors",
      isCollapsed
        ? "aspect-square w-12 h-12 justify-center mx-auto p-0"
        : touchFriendly
          ? "min-h-16 gap-5 px-5 py-4 text-lg font-medium"
          : "min-h-14 gap-4 px-3 py-2.5 text-base font-medium",
      isActive
        ? "bg-primary text-primary-foreground"
        : "hover:bg-muted text-foreground",
    );
  }

  function navIconClass() {
    return cn("shrink-0", touchFriendly ? "size-7" : "size-6");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isSettingsDomain ? (
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 border-b",
            touchFriendly ? "min-h-20 px-5 py-4" : "px-3 py-3 lg:px-2 lg:py-2",
          )}
        >
          <Link
            href="/"
            onClick={onNavigate}
            className={cn(
              navLinkClass(false),
              "flex-1 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <ArrowLeft className={navIconClass()} />
            <span className="truncate">{t("backToWorkspace")}</span>
          </Link>
          {touchFriendly ? headerSlot : null}
        </div>
      ) : (
        <div
          className={cn(
            "flex shrink-0 items-center border-b p-4",
            touchFriendly ? "min-h-20 px-5" : "h-[73px]",
            isCollapsed && "justify-center px-1",
          )}
        >
          {!isCollapsed && (
            <h1
              className={cn(
                "truncate flex-1 font-bold",
                touchFriendly ? "text-3xl" : "text-xl",
              )}
            >
              {t("appName")}
            </h1>
          )}
          {headerSlot}
        </div>
      )}

      <nav
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          isCollapsed
            ? "pt-6 px-4 pb-3"
            : touchFriendly
              ? "pt-6 px-4 pb-4"
              : "pt-5 px-3 pb-3 lg:pt-5 lg:px-2 lg:pb-2",
        )}
      >
        <div
          className={cn(
            "flex flex-col",
            isCollapsed ? "space-y-3" : "space-y-2",
          )}
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = isNavActive(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={navLinkClass(isActive)}
              >
                <Icon className={navIconClass()} />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <div
        className={cn(
          "mt-auto shrink-0 border-t",
          isCollapsed
            ? "px-4 py-3"
            : touchFriendly
              ? "px-4 py-4"
              : "px-3 py-3 lg:px-2 lg:py-2",
        )}
      >
        {!profile ? (
          <Link
            href="/login"
            onClick={onNavigate}
            className={cn(
              "flex w-full items-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCollapsed
                ? "aspect-square w-12 justify-center mx-auto rounded-full border-0 bg-transparent p-0 hover:bg-muted"
                : "gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-accent",
            )}
            aria-label={t("signIn")}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <User className="size-5" />
            </div>
            {!isCollapsed && (
              <span className="truncate text-sm font-semibold text-foreground">
                {t("signIn")}
              </span>
            )}
          </Link>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex w-full items-center text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isCollapsed
                  ? "aspect-square w-12 justify-center mx-auto rounded-full border-0 bg-transparent p-0 hover:bg-muted"
                  : "gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-accent",
              )}
              aria-label={t("userProfile")}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {initials}
              </div>
              {!isCollapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold leading-tight text-foreground">
                      {displayName}
                    </div>
                    <div className="mt-0.5 truncate text-xs leading-normal text-muted-foreground">
                      {t("credits")}:{" "}
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {creditBalance}
                      </span>
                    </div>
                  </div>
                  <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isCollapsed ? "right" : "top"}
              align="start"
              sideOffset={4}
              className="z-[100] min-w-[var(--radix-dropdown-menu-trigger-width)] p-1"
            >
              {!isSettingsDomain ? (
                <DropdownMenuItem asChild className={profileMenuItemClass}>
                  <Link href="/settings" onClick={onNavigate}>
                    <Settings className="size-5" />
                    <span>{t("settings")}</span>
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <form action={signOutAction} className="w-full">
                <DropdownMenuItem
                  variant="destructive"
                  asChild
                  className={profileMenuItemClass}
                >
                  <button type="submit" className="w-full cursor-pointer">
                    <LogOut className="size-5" />
                    <span>{t("logout")}</span>
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function useIsSettingsDomain() {
  const pathname = usePathname();
  return pathname.startsWith("/settings") || pathname.startsWith("/account");
}

export function Sidebar({ profile }: { profile?: UserProfile | null }) {
  const t = useTranslations("common");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isSettingsDomain = useIsSettingsDomain();

  const effectiveCollapsed = isSettingsDomain ? false : isCollapsed;

  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r bg-muted/20 print:hidden lg:flex",
        effectiveCollapsed ? "w-20" : "w-72 2xl:w-64",
      )}
    >
      <SidebarContent
        profile={profile}
        isCollapsed={effectiveCollapsed}
        headerSlot={
          isSettingsDomain ? null : (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn(
                "inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted 2xl:size-10 2xl:rounded-lg",
                isCollapsed && "mx-auto",
              )}
              aria-label={
                isCollapsed ? t("expandSidebar") : t("collapseSidebar")
              }
            >
              {isCollapsed ? (
                <ChevronRight className="size-6 2xl:size-5" />
              ) : (
                <ChevronLeft className="size-6 2xl:size-5" />
              )}
            </button>
          )
        }
      />
    </aside>
  );
}

export function SidebarDrawer({
  profile,
  open,
  onClose,
  returnFocusRef,
}: {
  profile?: UserProfile | null;
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("common");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <aside
      id="mobile-navigation-drawer"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col border-r bg-background shadow-xl transition-transform duration-200 motion-reduce:transition-none lg:hidden print:hidden",
        open ? "translate-x-0" : "-translate-x-full",
      )}
      role="dialog"
      aria-modal={open}
      aria-label={t("mainNavigation")}
      aria-hidden={!open}
    >
      <FocusScope
        trapped={open}
        loop
        onMountAutoFocus={(event) => {
          if (!open) return;
          event.preventDefault();
          closeButtonRef.current?.focus();
        }}
        onUnmountAutoFocus={(event) => {
          if (!returnFocusRef?.current) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
      >
        <SidebarContent
          profile={profile}
          isCollapsed={false}
          touchFriendly
          onNavigate={onClose}
          headerSlot={
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted active:bg-muted"
              aria-label={t("closeMenu")}
            >
              <X className="size-7" />
            </button>
          }
        />
      </FocusScope>
    </aside>
  );
}
