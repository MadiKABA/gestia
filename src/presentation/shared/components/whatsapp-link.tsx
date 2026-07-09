import { MessageCircle } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { transactionLabels } from "@/presentation/shared/labels";

/** Gabarit par défaut si le tenant n'a jamais personnalisé
 * `TenantSettings.whatsappTemplate` — placeholders remplacés par
 * `renderWhatsappTemplate`, jamais du HTML/markdown (message WhatsApp brut). */
export const DEFAULT_WHATSAPP_TEMPLATE =
  "Bonjour {client}, petit rappel : {reference} de {montant} FCFA est toujours en attente. Merci de régulariser dès que possible !";

export function renderWhatsappTemplate(
  template: string,
  vars: { client: string; montant: string; reference: string },
): string {
  return template
    .replaceAll("{client}", vars.client)
    .replaceAll("{montant}", vars.montant)
    .replaceAll("{reference}", vars.reference);
}

/** Ne garde que les chiffres — wa.me n'accepte ni "+", ni espaces, ni
 * tirets, quel que soit le format saisi côté fiche client. */
export function toWhatsappDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function buildWhatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${toWhatsappDigits(phone)}?text=${encodeURIComponent(message)}`;
}

/**
 * Bouton de relance WhatsApp — l'appelant décide seul de la condition
 * d'affichage (créance non réglée uniquement, jamais une dette : voir
 * transaction-detail.tsx), ce composant ne fait que construire le lien.
 */
export function WhatsappLink({
  phone,
  template,
  client,
  amount,
  reference,
}: {
  phone: string;
  template: string | null;
  client: string;
  amount: number;
  reference: string | null;
}) {
  const message = renderWhatsappTemplate(template ?? DEFAULT_WHATSAPP_TEMPLATE, {
    client,
    montant: amount.toLocaleString("fr-FR"),
    reference: reference ?? "",
  });
  const href = buildWhatsappUrl(phone, message);

  return (
    <Button
      variant="outline"
      className="w-full"
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
      nativeButton={false}
    >
      <MessageCircle className="size-4" aria-hidden />
      {transactionLabels.whatsappButtonLabel}
    </Button>
  );
}
