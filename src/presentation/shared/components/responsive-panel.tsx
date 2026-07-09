"use client";

import type { ReactNode } from "react";
import { useMediaQuery } from "@/presentation/shared/hooks/use-media-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/presentation/shared/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/presentation/shared/components/ui/dialog";

const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Panneau responsive partagé par tout formulaire ouvert par-dessus une page
 * (création d'opération, etc.) : bottom sheet sur mobile (< 1024px), modale
 * centrée sur desktop/tablette (≥ 1024px) — jamais un bottom sheet étiré sur
 * grand écran. Le contenu (`children`) est identique dans les deux cas, seul
 * le conteneur change.
 */
export function ResponsivePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
