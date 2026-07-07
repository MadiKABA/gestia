"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/presentation/shared/components/ui/alert-dialog";
import { Button } from "@/presentation/shared/components/ui/button";
import { commonLabels } from "@/presentation/shared/labels";

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
  cancelLabel = commonLabels.cancel,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
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
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? commonLabels.deleting : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
