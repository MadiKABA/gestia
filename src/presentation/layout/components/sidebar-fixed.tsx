import { SidebarNavContent } from "@/presentation/layout/components/sidebar-nav-content";
import type { NavRole } from "@/presentation/layout/nav-config";

/** Sidebar fixe desktop/tablette (≥ lg) — toujours visible, même contenu
 * que le drawer mobile (SidebarNavContent). */
export function SidebarFixed({ role }: { role: NavRole }) {
  return (
    <aside className="border-border bg-sidebar fixed inset-y-0 left-0 hidden w-64 border-r lg:block">
      <div className="border-border flex h-14 items-center border-b px-4">
        <span className="text-foreground text-sm font-semibold">Gestia</span>
      </div>
      <div className="h-[calc(100%-3.5rem)]">
        <SidebarNavContent role={role} />
      </div>
    </aside>
  );
}
