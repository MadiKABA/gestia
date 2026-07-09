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
 * (nouvelle opération / paiement) — chaque item navigue vers sa page dédiée
 * (voir nav-config.ts). */
export function QuickActionSheet({
  role,
  open,
  onOpenChange,
}: {
  role: NavRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
                <Link
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="hover:bg-accent active:bg-accent flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center transition-colors"
                >
                  {content}
                </Link>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
