import { MessageCircle } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { WhatsappMessagePreview } from "@/presentation/shared/components/whatsapp-message-preview";
import { transactionLabels } from "@/presentation/shared/labels";
import { formatLongDateFr } from "@/presentation/shared/date-format";
import { isValidPhoneNumber, toWhatsappDigits } from "@/domain/shared/phone";
import type { CurrencyCode } from "@/config/currencies";

/** Gabarit par défaut si le tenant n'a jamais personnalisé
 * `TenantSettings.whatsappTemplate` — placeholders remplacés par
 * `renderWhatsappTemplate`, jamais du HTML/markdown (message WhatsApp brut).
 * `{devise}` résolu avec `TenantSettings.currency` (jamais "FCFA" en dur) —
 * un gabarit déjà personnalisé par un tenant existant avant l'introduction
 * de cette variable n'est pas retouché automatiquement (voir CLAUDE.md). */
export const DEFAULT_WHATSAPP_TEMPLATE =
  "Salam {client}, j'espère que tu vas bien. Ici {boutique}. Selon mon cahier du {date}, tu as pris {description} pour un total de {montantTotal} {devise} (réf. {reference}). Il te reste {montantRestant} {devise} à régler. Merci et bonne journée !";

/** Gabarits par défaut des reçus de paiement — voir
 * `TenantSettings.whatsappReceiptPartialTemplate`/`whatsappReceiptFinalTemplate`,
 * consommés par `WhatsappReceiptLink` (presentation/payment). */
export const DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE =
  "Salam {client}, ici {boutique}. J'ai bien enregistré ton paiement de {montantPaye} {devise} par {modePaiement} aujourd'hui. Sur ton total de {montantTotal} {devise} pris le {date}, il te reste maintenant {montantRestant} {devise} dans mon cahier. Merci et à bientôt !";

export const DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE =
  "Salam {client}, ici {boutique}. Merci beaucoup pour ton paiement de {montantPaye} {devise}. Ton total de {montantTotal} {devise} pris le {date} est maintenant soldé à 0 {devise}. C'est totalement réglé (Safi) ! Merci pour la confiance. 🙏";

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

export function buildWhatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${toWhatsappDigits(phone)}?text=${encodeURIComponent(message)}`;
}

/**
 * Choisit le numéro de contact à utiliser pour un lien wa.me : `whatsappNumber`
 * si renseigné ET valide, sinon `phone` si valide, sinon aucun. Ne fait
 * jamais confiance à `whatsappNumber` sans revalider son format — une ligne
 * `Party` créée avant l'introduction de la validation de téléphone (ou toute
 * autre voie d'écriture directe) peut contenir une valeur non-vide mais
 * invalide (ex. un indicatif seul comme "+221", produit historiquement par un
 * bug de PhoneInput, voir git blame) ; la préférer aveuglément au `phone`
 * correct produirait un lien wa.me vers aucun contact réel plutôt que de
 * replier sur le numéro fiable.
 */
export function resolveWhatsappNumber(
  phone: string | null | undefined,
  whatsappNumber: string | null | undefined,
): string | null {
  if (whatsappNumber && isValidPhoneNumber(whatsappNumber)) return whatsappNumber;
  if (phone && isValidPhoneNumber(phone)) return phone;
  return null;
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
  totalAmount,
  reference,
  boutique,
  currency,
  description,
  date,
}: {
  phone: string;
  template: string | null;
  client: string;
  amount: number;
  totalAmount: number;
  reference: string | null;
  boutique: string;
  currency: CurrencyCode;
  description: string;
  date: Date;
}) {
  const message = renderWhatsappTemplate(template ?? DEFAULT_WHATSAPP_TEMPLATE, {
    client,
    // `montant` reste alimenté pour ne pas casser un gabarit déjà
    // personnalisé par un tenant avant l'introduction de `montantRestant`.
    montant: amount.toLocaleString("fr-FR"),
    montantRestant: amount.toLocaleString("fr-FR"),
    montantTotal: totalAmount.toLocaleString("fr-FR"),
    reference: reference ?? "",
    boutique,
    devise: currency,
    description,
    date: formatLongDateFr(date),
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
