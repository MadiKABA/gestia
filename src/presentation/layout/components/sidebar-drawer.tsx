"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/presentation/shared/components/ui/sheet";
import { SidebarNavContent } from "@/presentation/layout/components/sidebar-nav-content";
import type { NavRole } from "@/presentation/layout/nav-config";

/** Drawer mobile (< lg) ouvert via le burger du header ou le raccourci
 * "Plus" de la bottom tab bar — même contenu que la sidebar fixe desktop. */
export function SidebarDrawer({
  role,
  open,
  onOpenChange,
}: {
  role: NavRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-3/4 max-w-xs p-0">
        <SheetHeader className="border-border border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <SidebarNavContent role={role} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
