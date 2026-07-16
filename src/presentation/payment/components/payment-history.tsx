import { paymentLabels } from "@/presentation/shared/labels";
import { formatAmount } from "@/presentation/shared/format-amount";
import type { Payment, PaymentMethod } from "@/domain/payment/payment.entity";
import type { CurrencyCode } from "@/config/currencies";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: paymentLabels.methodCash,
  WAVE: paymentLabels.methodWave,
  ORANGE_MONEY: paymentLabels.methodOrangeMoney,
  AUTRE: paymentLabels.methodOther,
};

/**
 * N'est monté par l'appelant que si `payments.length > 1` (cf. cahier des
 * charges : jamais affiché pour un règlement en un seul versement, quel que
 * soit le statut) — ce composant ne recontrôle pas cette condition lui-même.
 */
export function PaymentHistory({
  payments,
  currency,
}: {
  payments: Payment[];
  currency: CurrencyCode;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-foreground text-sm font-semibold">{paymentLabels.historyTitle}</h2>
      <ul className="bg-card border-border divide-border divide-y rounded-xl border text-sm shadow-xs">
        {payments.map((payment) => (
          <li key={payment.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-foreground">{payment.createdAt.toLocaleDateString("fr-FR")}</p>
              <p className="text-muted-foreground text-xs">{METHOD_LABEL[payment.method]}</p>
            </div>
            <span className="font-medium tabular-nums">
              {formatAmount(payment.amount, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
