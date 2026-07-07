"use client";

import { useState, type ReactNode } from "react";
import { AppHeader } from "@/presentation/layout/components/app-header";
import { BottomTabBar } from "@/presentation/layout/components/bottom-tab-bar";
import { SidebarDrawer } from "@/presentation/layout/components/sidebar-drawer";
import { SidebarFixed } from "@/presentation/layout/components/sidebar-fixed";
import { QuickActionSheet } from "@/presentation/layout/components/quick-action-sheet";
import { StoragePersistenceWarning } from "@/presentation/shared/components/storage-persistence-warning";
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
  children,
}: {
  role: NavRole;
  branding: TenantBranding;
  tenantId: string;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);

  return (
    <div className="bg-background min-h-dvh">
      <SidebarFixed role={role} />
      <AppHeader branding={branding} tenantId={tenantId} onMenuClick={() => setDrawerOpen(true)} />

      <main className="min-h-dvh pt-14 pb-16 lg:pb-0 lg:pl-64">
        <StoragePersistenceWarning />
        {children}
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
