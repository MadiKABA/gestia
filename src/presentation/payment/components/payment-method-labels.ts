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
