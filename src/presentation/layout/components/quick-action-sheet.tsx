"use client";

import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/presentation/shared/components/ui/sheet";
import { getQuickActionItems, type NavRole } from "@/presentation/layout/nav-config";

/** Bottom sheet ouvert par le bouton "+" central de la bottom tab bar
 * (nouvelle opération / paiement / mouvement de caisse). L'item "Nouvelle
 * opération" (sans `href`, voir nav-config.ts) délègue à `onNewOperation`
 * (géré par AppShell, partagé avec le bouton équivalent du header desktop)
 * plutôt que de naviguer. */
export function QuickActionSheet({
  role,
  open,
  onOpenChange,
  onNewOperation,
}: {
  role: NavRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewOperation: () => void;
}) {
  const items = getQuickActionItems(role);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Ajouter</SheetTitle>
        </SheetHeader>
        <ul className="grid grid-cols-2 gap-3 p-4 pt-0">
          {items.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <span className="bg-primary/10 flex size-14 items-center justify-center rounded-full">
                  <Icon className="text-primary size-7" aria-hidden />
                </span>
                <span className="text-foreground text-sm font-medium">{item.label}</span>
              </>
            );
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className="hover:bg-accent active:bg-accent flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center transition-colors"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onNewOperation();
                    }}
                    className="hover:bg-accent active:bg-accent flex w-full flex-col items-center gap-2 rounded-xl px-3 py-4 text-center transition-colors"
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
