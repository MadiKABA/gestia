"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSidebarNavItems, type NavRole } from "@/presentation/layout/nav-config";
import { signOutAction } from "@/presentation/auth/actions";

/** Contenu de navigation partagé par le drawer mobile et la sidebar fixe
 * desktop — une seule liste à étendre pour les futures features. */
export function SidebarNavContent({
  role,
  onNavigate,
}: {
  role: NavRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [signingOut, startSignOut] = useTransition();
  const items = getSidebarNavItems(role);

  return (
    <nav className="flex h-full flex-col justify-between">
      <ul className="space-y-1 p-2">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-border border-t p-2">
        <button
          type="button"
          disabled={signingOut}
          onClick={() => startSignOut(() => signOutAction())}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60"
        >
          <LogOut className="size-5 shrink-0" aria-hidden />
          {signingOut ? "Déconnexion..." : "Déconnexion"}
        </button>
      </div>
    </nav>
  );
}
