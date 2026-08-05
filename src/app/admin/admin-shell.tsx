"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  Broadcast,
  CalendarBlank,
  ClipboardText,
  Lightbulb,
  List,
  ListChecks,
  MapTrifold,
  Package,
  SignOut,
  Target,
  Trophy,
  UserGear,
  UsersThree,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: Icon;
  badge?: string;
  adminOnly?: boolean;
  isActive: (pathname: string) => boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildNav(counts: AdminShellProps["counts"]): NavGroup[] {
  return [
    {
      label: "Planung",
      items: [
        {
          key: "games",
          label: "Games",
          href: "/admin",
          icon: Target,
          badge: counts.games > 0 ? String(counts.games) : undefined,
          isActive: (p) => p === "/admin" || p.startsWith("/admin/games"),
        },
        {
          key: "teams",
          label: "Teams",
          href: "/admin/teams",
          icon: UsersThree,
          badge: counts.teams > 0 ? String(counts.teams) : undefined,
          isActive: (p) => p.startsWith("/admin/teams"),
        },
        {
          key: "material",
          label: "Material",
          href: "/admin/materials",
          icon: Package,
          badge: counts.materials > 0 ? String(counts.materials) : undefined,
          isActive: (p) => p.startsWith("/admin/materials"),
        },
        {
          key: "zeitplan",
          label: "Zeitplan",
          href: "/admin/schedule",
          icon: CalendarBlank,
          isActive: (p) => p.startsWith("/admin/schedule"),
        },
        {
          key: "einsatzplan",
          label: "Einsatzplan",
          href: "/admin/einsatzplan",
          icon: ClipboardText,
          isActive: (p) => p.startsWith("/admin/einsatzplan"),
        },
        {
          key: "lageplan",
          label: "Lageplan",
          href: "/admin/situationsplan",
          icon: MapTrifold,
          isActive: (p) => p.startsWith("/admin/situationsplan"),
        },
      ],
    },
    {
      label: "Gameday",
      items: [
        {
          key: "leitstand",
          label: "Leitstand",
          href: "/admin/gameday",
          icon: Broadcast,
          badge: "LIVE",
          isActive: (p) => p.startsWith("/admin/gameday"),
        },
        {
          key: "schiedsrichter",
          label: "Schiedsrichter",
          href: "/referee",
          icon: ListChecks,
          isActive: () => false,
        },
        {
          key: "gast",
          label: "Gast-Ansicht",
          href: "/scoreboard",
          icon: Trophy,
          isActive: () => false,
        },
      ],
    },
    {
      label: "Verwaltung",
      items: [
        {
          key: "benutzer",
          label: "Benutzer",
          href: "/admin/users",
          icon: UserGear,
          adminOnly: true,
          isActive: (p) => p.startsWith("/admin/users"),
        },
        {
          key: "kvp",
          label: "KVP",
          href: "/admin/kvp",
          icon: Lightbulb,
          adminOnly: true,
          isActive: (p) => p.startsWith("/admin/kvp"),
        },
      ],
    },
  ];
}

interface AdminShellProps {
  userName: string;
  userRolle: string;
  isAdmin: boolean;
  version: string;
  counts: { games: number; teams: number; materials: number };
  children: React.ReactNode;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function NavList({
  groups,
  pathname,
  isAdmin,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-2.5 py-3.5">
      {groups.map((group) => {
        const items = group.items.filter((item) => !item.adminOnly || isAdmin);
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            <div className="cg-label px-2 pb-1.5">{group.label}</div>
            {items.map((item) => {
              const active = item.isActive(pathname);
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex h-[34px] items-center gap-2.5 rounded-lg px-2 text-[13px] transition-colors duration-150 ${
                    active
                      ? "bg-action-dim font-semibold text-action-tint"
                      : "font-[450] text-nav-idle hover:bg-sunken hover:text-ink-2"
                  }`}
                >
                  <IconComponent size={16} weight="bold" className="opacity-90" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`tnum text-[11px] ${item.badge === "LIVE" ? "font-semibold text-warn" : "text-label"}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ userName, userRolle, version }: Pick<AdminShellProps, "userName" | "userRolle" | "version">) {
  return (
    <div className="flex items-center gap-2.5 border-t border-line px-3.5 py-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-strong bg-raised text-[11px] font-semibold text-nav-idle">
        {initials(userName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-ink-2">{userName}</div>
        <div className="tnum truncate text-[10px] text-label">
          {userRolle.toUpperCase()} · v{version}
        </div>
      </div>
      <ThemeToggle className="h-7 w-7" />
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        aria-label="Abmelden"
        title="Abmelden"
        className="text-label transition-colors duration-150 hover:text-ink-2"
      >
        <SignOut size={15} weight="bold" />
      </button>
    </div>
  );
}

function Brand({ onClick, bordered = true }: { onClick?: () => void; bordered?: boolean }) {
  return (
    <Link
      href="/admin"
      onClick={onClick}
      className={`flex h-[60px] items-center gap-2.5 px-4 ${bordered ? "border-b border-line" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo.png" alt="CG26" className="h-[30px] w-auto" />
      <span className="flex flex-col">
        <span className="text-xs font-semibold tracking-[-0.01em] text-ink">Company Games</span>
        <span className="tnum text-[10px] font-medium text-ink-3">2026 · ORGA</span>
      </span>
    </Link>
  );
}

export function AdminShell({ userName, userRolle, isAdmin, version, counts, children }: AdminShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = buildNav(counts);

  return (
    <div className="flex min-h-dvh bg-bg text-ink">
      {/* Sidebar Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-[236px] flex-none flex-col border-r border-line bg-sunken lg:flex">
        <Brand />
        <NavList groups={groups} pathname={pathname} isAdmin={isAdmin} />
        <SidebarFooter userName={userName} userRolle={userRolle} version={version} />
      </aside>

      {/* Mobile-Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Navigation schliessen"
            className="absolute inset-0"
            style={{ background: "var(--scrim)" }}
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="anim-pop absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-line bg-sunken">
            <div className="flex items-center justify-between border-b border-line pr-2">
              <Brand onClick={() => setDrawerOpen(false)} bordered={false} />
              <button
                type="button"
                aria-label="Schliessen"
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center text-ink-2"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <NavList groups={groups} pathname={pathname} isAdmin={isAdmin} onNavigate={() => setDrawerOpen(false)} />
            <SidebarFooter userName={userName} userRolle={userRolle} version={version} />
          </aside>
        </div>
      )}

      {/* Inhaltsspalte */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-Topbar */}
        <header className="sticky top-0 z-40 flex h-[52px] items-center gap-3 border-b border-line bg-bg px-4 lg:hidden">
          <button
            type="button"
            aria-label="Navigation öffnen"
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong text-ink-2"
          >
            <List size={18} weight="bold" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="CG26" className="h-6 w-auto" />
          <span className="text-sm font-semibold">Orga</span>
        </header>
        {children}
      </div>
    </div>
  );
}
