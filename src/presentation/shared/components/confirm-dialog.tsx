"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/presentation/shared/components/ui/alert-dialog";
import { Button, type buttonVariants } from "@/presentation/shared/components/ui/button";
import { commonLabels } from "@/presentation/shared/labels";
import type { VariantProps } from "class-variance-authority";

/**
 * Modale de confirmation générique avant une action destructive (suppression
 * d'un client, d'un vendeur, d'un paiement...) — pas spécifique à un module,
 * le titre/la description sont fournis par l'appelant pour toujours rappeler
 * explicitement ce qui est concerné (jamais un texte générique impersonnel).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = commonLabels.delete,
  confirmVariant = "destructive",
  cancelLabel = commonLabels.cancel,
  pending = false,
  pendingLabel = commonLabels.deleting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Toujours "destructive" (rouge) par défaut — une action non destructive
   * (ex. réactiver un vendeur) peut passer "default" pour éviter la couleur
   * d'alerte de la charte sur un cas qui n'en est pas un (cf. CLAUDE.md
   * "Theming"). */
  confirmVariant?: VariantProps<typeof buttonVariants>["variant"];
  cancelLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} disabled={pending} onClick={onConfirm}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
