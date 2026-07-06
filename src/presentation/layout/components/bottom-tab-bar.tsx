"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOTTOM_TAB_ITEMS, type NavRole } from "@/presentation/layout/nav-config";

/** Bottom tab bar mobile (< lg) — disparaît complètement au breakpoint lg
 * (sidebar fixe desktop la remplace). Bouton "+" central proéminent. */
export function BottomTabBar({
  role,
  onQuickAction,
  onMore,
}: {
  role: NavRole;
  onQuickAction: () => void;
  onMore: () => void;
}) {
  const pathname = usePathname();
  const items = BOTTOM_TAB_ITEMS[role];

  return (
    <nav
      className="border-border bg-background fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Navigation principale"
    >
      {items.map((item) => {
        if (item.type === "quick-action") {
          return (
            <button
              key={item.key}
              type="button"
              onClick={onQuickAction}
              aria-label={item.label}
              className="bg-primary text-primary-foreground -mt-6 flex size-14 items-center justify-center rounded-full shadow-lg"
            >
              <CirclePlus className="size-7" aria-hidden />
            </button>
          );
        }

        if (item.type === "more") {
          return (
            <button
              key={item.key}
              type="button"
              onClick={onMore}
              className="text-muted-foreground flex flex-1 flex-col items-center gap-1 py-1 text-xs font-medium"
            >
              <Menu className="size-5" aria-hidden />
              {item.label}
            </button>
          );
        }

        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-1 text-xs font-medium",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
