"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { NetworkStatusIndicator } from "@/presentation/shared/components/network-status-indicator";
import { getPageTitle } from "@/presentation/layout/nav-config";
import type { TenantBranding } from "@/application/tenant/tenant-branding.repository";

const DEFAULT_LOGO_SRC = "/icons/icon-192.png";

/** Header fixe : titre de la page courante, burger mobile (ouvre le
 * drawer), emplacement notifications, indicateur réseau/sync (masqué en
 * ligne sans mutation en attente), logo boutique (ou Gestia par défaut) sur
 * desktop/tablette — jamais de CTA mis en avant ici, "Nouvelle opération"
 * est un lien classique de la navigation (voir nav-config.ts) depuis que la
 * création passe par une page dédiée plutôt qu'une modale. */
export function AppHeader({
  branding,
  tenantId,
  onMenuClick,
}: {
  branding: TenantBranding;
  tenantId: string;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

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
        <Image
          src={branding.logoUrl ?? DEFAULT_LOGO_SRC}
          alt={branding.displayName ?? "Gestia"}
          width={28}
          height={28}
          className="hidden shrink-0 rounded-md object-cover lg:inline-flex"
        />
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
