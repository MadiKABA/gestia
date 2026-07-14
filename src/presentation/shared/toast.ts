import { toast } from "sonner";
import { commonLabels } from "@/presentation/shared/labels";

/**
 * Trois tons distincts (voir sonner.tsx pour les couleurs) : succès en ligne,
 * erreur, et mise en attente hors ligne — jamais présentée comme une erreur
 * (cf. CLAUDE.md "Sync offline"). Reste distinct de l'indicateur de sync du
 * header (network-status-indicator.tsx), qui représente l'état permanent de
 * la queue ; ceci est une notification ponctuelle liée à une action précise.
 */
export function toastSuccess(message: string): void {
  toast.success(message);
}

export function toastError(message: string): void {
  toast.error(message);
}

export function toastQueuedOffline(): void {
  toast(commonLabels.queuedOfflineMessage);
}
