"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, UserRound } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/presentation/shared/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/presentation/shared/components/ui/dropdown-menu";
import { NetworkStatusIndicator } from "@/presentation/shared/components/network-status-indicator";
import { getPageTitle } from "@/presentation/layout/nav-config";
import { signOutAction } from "@/presentation/auth/actions";
import { clearAccountCache } from "@/infrastructure/offline/account-guard";
import { authLabels } from "@/presentation/shared/labels";
import type { CurrentUser } from "@/application/auth/get-current-user.use-case";

/** Initiales affichées en secours de l'avatar (pas de photo) — deux
 * premières lettres des deux premiers mots du nom, ex "Awa Diop" → "AD". */
function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

/** Header fixe : titre de la page courante, burger mobile (ouvre le
 * drawer), indicateur réseau/sync, profil de l'utilisateur connecté
 * (avatar/initiales + nom) avec un menu "Voir mon profil"/"Se déconnecter" —
 * remplace l'ancien logo boutique, qui reste affiché dans la sidebar (nom de
 * la boutique) plutôt qu'ici. */
export function AppHeader({
  currentUser,
  tenantId,
  onMenuClick,
}: {
  currentUser: CurrentUser;
  tenantId: string;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const [signingOut, startSignOut] = useTransition();

  function onSignOut() {
    startSignOut(async () => {
      // Vidé avant l'appel serveur, jamais après — même règle que
      // sidebar-nav-content.tsx (cahier des charges §9, appareil partagé).
      await clearAccountCache();
      await signOutAction();
    });
  }

  return (
    <header className="border-border bg-background fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-2 border-b px-4 lg:left-64">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="text-foreground truncate text-base font-semibold">{title}</h1>
        <NetworkStatusIndicator tenantId={tenantId} className="shrink-0" />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" disabled>
          <Bell className="size-5" aria-hidden />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="hover:bg-muted flex min-w-0 items-center gap-2 rounded-lg py-1 pr-1 pl-1.5 transition-colors"
              />
            }
          >
            <Avatar size="sm">
              <AvatarImage src={currentUser.image ?? undefined} alt={currentUser.name} />
              <AvatarFallback>{getInitials(currentUser.name)}</AvatarFallback>
            </Avatar>
            <span className="text-foreground hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
              {currentUser.name}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href="/profil" />}>
              <UserRound aria-hidden />
              {authLabels.viewProfileLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={signingOut} onClick={onSignOut}>
              <LogOut aria-hidden />
              {signingOut ? authLabels.signingOutLabel : authLabels.signOutLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ouvrir le menu"
          onClick={onMenuClick}
          className="lg:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </div>
    </header>
  );
}
