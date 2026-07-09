"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AppHeader } from "@/presentation/layout/components/app-header";
import { BottomTabBar } from "@/presentation/layout/components/bottom-tab-bar";
import { SidebarDrawer } from "@/presentation/layout/components/sidebar-drawer";
import { SidebarFixed } from "@/presentation/layout/components/sidebar-fixed";
import { QuickActionSheet } from "@/presentation/layout/components/quick-action-sheet";
import { StoragePersistenceWarning } from "@/presentation/shared/components/storage-persistence-warning";
import { InstallPromptBanner } from "@/presentation/shared/components/install-prompt-banner";
import { ensureCacheMatchesAccount } from "@/infrastructure/offline/account-guard";
import { registerPullableEntities } from "@/presentation/offline/register-pullable-entities";
import type { NavRole } from "@/presentation/layout/nav-config";
import type { TenantBranding } from "@/application/tenant/tenant-branding.repository";

/**
 * Layout applicatif principal : seul endroit portant la logique responsive
 * (classes Tailwind conditionnelles) — mobile (< lg) affiche header + bottom
 * tab bar + drawer ; desktop/tablette (≥ lg) affiche header + sidebar fixe,
 * sans bottom tab bar.
 */
export function AppShell({
  role,
  branding,
  tenantId,
  userId,
  children,
}: {
  role: NavRole;
  branding: TenantBranding;
  tenantId: string;
  userId: string;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  // Toujours false au premier rendu (serveur ET client, avant hydratation) :
  // aucun risque de mismatch. Ne passe à true qu'une fois le garde-fou de
  // compte résolu (voir account-guard.ts) — dans le cas courant (pas de
  // changement de compte), quasi instantané (une lecture localStorage), le
  // coût perçu est négligeable ; ça garantit surtout qu'aucun enfant (ex:
  // PartiesList) ne peut lire le cache offline avant que ce garde-fou n'ait
  // eu la main, l'ordre des effets React étant enfants avant parents.
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ensureCacheMatchesAccount(tenantId, userId).then(() => {
      if (!cancelled) setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, userId]);

  // Enregistrement idempotent (Set) — une fois suffit, avant que le premier
  // cycle de sync (network-status-store.ts) ne parcoure la liste des
  // entities à rafraîchir par pull.
  useEffect(() => {
    registerPullableEntities();
  }, []);

  return (
    <div className="bg-background min-h-dvh">
      <SidebarFixed role={role} />
      <AppHeader branding={branding} tenantId={tenantId} onMenuClick={() => setDrawerOpen(true)} />

      <main className="min-h-dvh pt-14 pb-16 lg:pb-0 lg:pl-64">
        {/* Juste sous le header, visible sans scroll sur toutes les tailles
            d'écran (cf. plan de refonte PWA) — en flux normal ici, pas de
            recouvrement à calculer avec le header `fixed` (déjà compensé par
            `pt-14` ci-dessus). */}
        <InstallPromptBanner />
        <StoragePersistenceWarning />
        {cacheReady ? children : null}
      </main>

      <BottomTabBar
        role={role}
        onQuickAction={() => setQuickActionOpen(true)}
        onMore={() => setDrawerOpen(true)}
      />

      <SidebarDrawer role={role} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <QuickActionSheet role={role} open={quickActionOpen} onOpenChange={setQuickActionOpen} />
    </div>
  );
}
