"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, Menu, Plus } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { NetworkStatusIndicator } from "@/presentation/shared/components/network-status-indicator";
import { getPageTitle } from "@/presentation/layout/nav-config";
import { transactionLabels } from "@/presentation/shared/labels";
import type { TenantBranding } from "@/application/tenant/tenant-branding.repository";

/** Header fixe : titre de la page courante, logo boutique (dashboard
 * uniquement), burger mobile (ouvre le drawer), emplacement notifications,
 * indicateur réseau/sync (masqué en ligne sans mutation en attente). Le
 * bouton central "+" mobile disparaît au breakpoint lg (bottom tab bar
 * cachée) : `onNewOperation` lui sert d'équivalent desktop, seul jamais
 * masqué par la sidebar contrairement au reste du menu rapide mobile
 * (paiement/caisse, hors périmètre tant que ces modules n'existent pas). */
export function AppHeader({
  branding,
  tenantId,
  onMenuClick,
  onNewOperation,
}: {
  branding: TenantBranding;
  tenantId: string;
  onMenuClick: () => void;
  onNewOperation: () => void;
}) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const showTenantLogo = pathname === "/dashboard" && branding.logoUrl;

  return (
    <header className="border-border bg-background fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-2 border-b px-4 lg:left-64">
      <div className="flex min-w-0 items-center gap-3">
        {showTenantLogo ? (
          <Image
            src={branding.logoUrl!}
            alt={branding.displayName ?? "Logo boutique"}
            width={28}
            height={28}
            className="shrink-0 rounded-md object-cover"
          />
        ) : null}
        <h1 className="text-foreground truncate text-base font-semibold">{title}</h1>
        <NetworkStatusIndicator tenantId={tenantId} className="shrink-0" />
      </div>

      <div className="flex items-center gap-1">
        <Button size="sm" onClick={onNewOperation} className="hidden lg:inline-flex">
          <Plus className="size-4" aria-hidden />
          {transactionLabels.newOperationButtonLabel}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" disabled>
          <Bell className="size-5" aria-hidden />
        </Button>
        <span className="text-muted-foreground hidden text-xs font-medium lg:inline">Gestia</span>
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
