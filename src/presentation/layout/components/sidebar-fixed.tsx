import { SidebarNavContent } from "@/presentation/layout/components/sidebar-nav-content";
import type { NavRole } from "@/presentation/layout/nav-config";
import type { TenantBranding } from "@/application/tenant/tenant-branding.repository";

/** Sidebar fixe desktop/tablette (≥ lg) — toujours visible, même contenu
 * que le drawer mobile (SidebarNavContent). Le nom affiché en haut est celui
 * de la boutique (`displayName` personnalisé sinon nom légal du tenant),
 * jamais "Gestia" en dur — le logo Gestia discret reste visible ailleurs
 * (écran de connexion), voir CLAUDE.md "Theming". */
export function SidebarFixed({ role, branding }: { role: NavRole; branding: TenantBranding }) {
  return (
    <aside className="border-border bg-sidebar fixed inset-y-0 left-0 hidden w-64 border-r lg:block">
      <div className="border-border flex h-14 items-center border-b px-4">
        <span className="text-foreground truncate text-sm font-semibold">
          {branding.displayName ?? branding.tenantName}
        </span>
      </div>
      <div className="h-[calc(100%-3.5rem)]">
        <SidebarNavContent role={role} />
      </div>
    </aside>
  );
}
