import { MessageCircle } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { WhatsappMessagePreview } from "@/presentation/shared/components/whatsapp-message-preview";
import {
  DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE,
  DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE,
  buildWhatsappUrl,
  renderWhatsappTemplate,
} from "@/presentation/shared/components/whatsapp-link";
import { PAYMENT_METHOD_LABEL } from "@/presentation/payment/components/payment-method-labels";
import { paymentLabels } from "@/presentation/shared/labels";
import { formatLongDateFr } from "@/presentation/shared/date-format";
import type { TransactionStatus } from "@/domain/transaction/transaction.entity";
import type { PaymentMethod } from "@/domain/payment/payment.entity";
import type { CurrencyCode } from "@/config/currencies";

/**
 * Bouton d'envoi de reçu WhatsApp après un paiement — choisit seul le
 * gabarit "reçu final (Safi)" ou "reçu partiel" selon le statut frais de la
 * transaction. Ne s'affiche jamais si `status === "EN_COURS"` (garde
 * défensive : ne devrait jamais arriver juste après un paiement réussi, voir
 * `deriveTransactionStatus`). L'appelant décide seul de la condition
 * d'affichage créance/dette, comme pour `WhatsappLink`.
 */
export function WhatsappReceiptLink({
  phone,
  status,
  client,
  amountPaid,
  method,
  remainingBalance,
  totalAmount,
  boutique,
  currency,
  date,
  partialTemplate,
  finalTemplate,
}: {
  phone: string;
  status: TransactionStatus;
  client: string;
  amountPaid: number;
  method: PaymentMethod;
  remainingBalance: number;
  totalAmount: number;
  boutique: string;
  currency: CurrencyCode;
  date: Date;
  partialTemplate: string | null;
  finalTemplate: string | null;
}) {
  if (status === "EN_COURS") return null;

  const template =
    status === "REGLEE"
      ? (finalTemplate ?? DEFAULT_WHATSAPP_RECEIPT_FINAL_TEMPLATE)
      : (partialTemplate ?? DEFAULT_WHATSAPP_RECEIPT_PARTIAL_TEMPLATE);

  const message = renderWhatsappTemplate(template, {
    client,
    montantPaye: amountPaid.toLocaleString("fr-FR"),
    modePaiement: PAYMENT_METHOD_LABEL[method],
    montantRestant: remainingBalance.toLocaleString("fr-FR"),
    montantTotal: totalAmount.toLocaleString("fr-FR"),
    boutique,
    devise: currency,
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
        {paymentLabels.sendReceiptButtonLabel}
      </Button>
    </div>
  );
}
