import { paymentLabels } from "@/presentation/shared/labels";
import type { PaymentMethod } from "@/domain/payment/payment.entity";

/** Isolé de `payment-modal.tsx` pour rester consommable par
 * `whatsapp-receipt-link.tsx` sans dépendre d'un composant que les tests
 * mockent entièrement (voir payment-modal.test.tsx / transaction-detail.test.tsx). */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: paymentLabels.methodCash,
  WAVE: paymentLabels.methodWave,
  ORANGE_MONEY: paymentLabels.methodOrangeMoney,
  AUTRE: paymentLabels.methodOther,
};

/** Icônes du sélecteur de mode de paiement (vente au comptant,
 * sale-create-form.tsx) — même fichier que PAYMENT_METHOD_LABEL pour rester
 * une seule source centralisée par mode de paiement (cf. CLAUDE.md
 * "Vocabulaire"), pas utilisées ailleurs pour l'instant. */
export const PAYMENT_METHOD_ICON: Record<PaymentMethod, string> = {
  CASH: "💵",
  WAVE: "🌊",
  ORANGE_MONEY: "🍊",
  AUTRE: "💳",
};
