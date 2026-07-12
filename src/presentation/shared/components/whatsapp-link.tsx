import { MessageCircle } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { WhatsappMessagePreview } from "@/presentation/shared/components/whatsapp-message-preview";
import { transactionLabels } from "@/presentation/shared/labels";

/** Gabarit par défaut si le tenant n'a jamais personnalisé
 * `TenantSettings.whatsappTemplate` — placeholders remplacés par
 * `renderWhatsappTemplate`, jamais du HTML/markdown (message WhatsApp brut). */
export const DEFAULT_WHATSAPP_TEMPLATE =
  "Bonjour {client}, petit rappel : {reference} de {montant} FCFA est toujours en attente. Merci de régulariser dès que possible !";

/** Gabarits par défaut des reçus de paiement — voir
 * `TenantSettings.whatsappReceiptPartialTemplate`/`whatsappReceiptFinalTemplate`,
 * consommés par `WhatsappReceiptLink` (presentation/payment). */
export const DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE =
  "Salam {client}, j'ai bien enregistré ton paiement de {montantPaye} FCFA par {modePaiement} aujourd'hui. Merci ! Il te reste maintenant {montantRestant} FCFA dans mon cahier. À bientôt !";

export const DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE =
  "Salam {client}, merci beaucoup pour ton paiement de {montantPaye} FCFA. Ton compte est maintenant à 0 FCFA. C'est totalement réglé (Safi) ! Merci pour la confiance. 🙏";

/** Clés de gabarit arbitraires (relance : `{client}`, `{montant}`,
 * `{reference}` ; reçu : `{montantPaye}`, `{modePaiement}`, `{montantRestant}`
 * en plus) — généralisé en `Record` plutôt qu'un type figé pour servir les
 * deux usages sans dupliquer la fonction. */
export function renderWhatsappTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    template,
  );
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
    <div className="space-y-2">
      <WhatsappMessagePreview message={message} />
      <Button
        variant="outline"
        className="w-full"
        render={<a href={href} target="_blank" rel="noopener noreferrer" />}
        nativeButton={false}
      >
        <MessageCircle className="size-4" aria-hidden />
        {transactionLabels.whatsappButtonLabel}
      </Button>
    </div>
  );
}
