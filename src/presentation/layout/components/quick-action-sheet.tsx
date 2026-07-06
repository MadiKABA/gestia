"use client";

import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/presentation/shared/components/ui/sheet";
import { QUICK_ACTION_ITEMS } from "@/presentation/layout/nav-config";

/** Bottom sheet ouvert par le bouton "+" central de la bottom tab bar
 * (nouvelle créance / dette / paiement). */
export function QuickActionSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Ajouter</SheetTitle>
        </SheetHeader>
        <ul className="space-y-1 p-4 pt-0">
          {QUICK_ACTION_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="hover:bg-accent hover:text-accent-foreground text-foreground flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors"
                >
                  <Icon className="text-primary size-5 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
