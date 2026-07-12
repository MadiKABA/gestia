"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Pencil, Banknote } from "lucide-react";
import { Input } from "@/presentation/shared/components/ui/input";
import { Button } from "@/presentation/shared/components/ui/button";
import { Badge } from "@/presentation/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import {
  createTransactionOfflineRepository,
  seedTransactionCache,
} from "@/presentation/transaction/offline-repository";
import { BalanceSummaryCards } from "@/presentation/transaction/components/balance-summary-cards";
import { PaymentModal } from "@/presentation/payment/components/payment-modal";
import { WhatsappReceiptLink } from "@/presentation/payment/components/whatsapp-receipt-link";
import {
  isEligibleForReminder,
  type Transaction,
  type TransactionType,
} from "@/domain/transaction/transaction.entity";
import type { Payment, PaymentMethod } from "@/domain/payment/payment.entity";
import {
  commonLabels,
  paymentLabels,
  transactionLabels,
  syncLabels,
} from "@/presentation/shared/labels";

type StatusFilter = "ALL" | Transaction["status"];

const TYPE_FILTERS = [
  { value: "ALL", label: transactionLabels.filterAll },
  { value: "CREANCE", label: transactionLabels.filterCreance },
  { value: "DETTE", label: transactionLabels.filterDette },
] as const;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: transactionLabels.filterAll },
  { value: "EN_COURS", label: transactionLabels.statusEnCours },
  { value: "PARTIELLE", label: transactionLabels.statusPartielle },
  { value: "REGLEE", label: transactionLabels.statusReglee },
];

const TYPE_FILTER_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  TYPE_FILTERS.map((option) => [option.value, option.label]),
);
const STATUS_FILTER_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  STATUS_FILTERS.map((option) => [option.value, option.label]),
);

/** Wording mobile/détail ("En cours") — inchangé. */
const STATUS_LABEL: Record<Transaction["status"], string> = {
  EN_COURS: transactionLabels.statusEnCours,
  PARTIELLE: transactionLabels.statusPartielle,
  REGLEE: transactionLabels.statusReglee,
};

/** Wording + couleur du badge tableau desktop/tablette : "Impayée" plutôt
 * que "En cours", rouge d'alerte réservé à ce seul statut (voir CLAUDE.md
 * "Theming"). */
const STATUS_BADGE_LABEL: Record<Transaction["status"], string> = {
  EN_COURS: transactionLabels.statusImpayee,
  PARTIELLE: transactionLabels.statusPartielle,
  REGLEE: transactionLabels.statusReglee,
};
const STATUS_BADGE_VARIANT: Record<Transaction["status"], "success" | "info" | "alert"> = {
  EN_COURS: "alert",
  PARTIELLE: "info",
  REGLEE: "success",
};

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: paymentLabels.methodCash,
  WAVE: paymentLabels.methodWave,
  ORANGE_MONEY: paymentLabels.methodOrangeMoney,
  AUTRE: paymentLabels.methodOther,
};

/** Nombre d'opérations affichées par page — jamais toute la liste d'un coup
 * (cahier des charges : éviter une liste surchargée à l'écran). */
const PAGE_SIZE = 20;

type PartyContact = {
  id: string;
  name: string;
  phone: string | null;
  whatsappNumber: string | null;
};

/** Lit le cache local en priorité (affichage instantané, fonctionne hors
 * ligne) — même pattern que PartiesList. `parties` sert uniquement à
 * afficher un nom/téléphone lisibles (Transaction ne dénormalise jamais le
 * tiers, voir domain/transaction/transaction.entity.ts). */
export function TransactionsList({
  initialTransactions,
  tenantId,
  userId,
  parties,
  summary,
  initialType,
  lastPaymentMethodByTransactionId,
  whatsappReceiptTemplates,
  reminderDays,
}: {
  initialTransactions: Transaction[];
  tenantId: string;
  userId: string;
  parties: PartyContact[];
  summary: { owedToMe: number; owedByMe: number };
  /** Filtre initial ("Créances"/"Dettes" du menu, voir nav-config.ts) — la
   * page a déjà rendu la liste filtrée côté serveur avec cette même valeur. */
  initialType?: TransactionType;
  /** Mode de paiement du dernier paiement de chaque transaction (colonne
   * desktop/tablette) — calculé une fois au chargement serveur de la page ;
   * peut rester incomplet pour une transaction créée/filtrée après coup
   * (re-filtrage client hors ligne), auquel cas la colonne affiche "—". */
  lastPaymentMethodByTransactionId: Record<string, PaymentMethod>;
  /** Gabarits de reçu WhatsApp du tenant — mêmes valeurs que celles lues par
   * transaction-detail.tsx, pour proposer le même reçu après un paiement
   * rapide déclenché directement depuis cette liste. */
  whatsappReceiptTemplates: { partial: string | null; final: string | null };
  /** `TenantSettings.reminderDays` — sert uniquement au badge "à relancer"
   * (indicateur visuel, jamais une notification automatique, cf. CLAUDE.md
   * "Hors périmètre"). */
  reminderDays: number;
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | TransactionType>(initialType ?? "ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [paymentTarget, setPaymentTarget] = useState<Transaction | null>(null);
  const [receiptContext, setReceiptContext] = useState<{
    transaction: Transaction;
    payment: Payment;
    whatsappNumber: string;
    clientName: string;
  } | null>(null);
  const [, startTransition] = useTransition();
  const repository = useMemo(
    () => createTransactionOfflineRepository(tenantId, userId),
    [tenantId, userId],
  );
  const partyById = useMemo(() => new Map(parties.map((party) => [party.id, party])), [parties]);

  // Même resynchronisation que PartiesList : le routeur peut réutiliser ce
  // composant sans le remonter après un redirect post-mutation.
  const [prevInitialTransactions, setPrevInitialTransactions] = useState(initialTransactions);
  if (initialTransactions !== prevInitialTransactions) {
    setPrevInitialTransactions(initialTransactions);
    setTransactions(initialTransactions);
  }

  useEffect(() => {
    void seedTransactionCache(tenantId, initialTransactions);
  }, [tenantId, initialTransactions]);

  // La recherche texte (référence/nom/téléphone) est filtrée en mémoire
  // (voir `filteredTransactions` ci-dessous), donc seuls type/statut
  // déclenchent une nouvelle lecture du cache local — pas de debounce
  // nécessaire, ce sont des Select, pas un champ texte.
  useEffect(() => {
    startTransition(async () => {
      const results = await repository.list({
        type: type === "ALL" ? undefined : type,
        status: status === "ALL" ? undefined : status,
      });
      setTransactions(results);
      setVisibleCount(PAGE_SIZE);
    });
  }, [type, status, repository]);

  async function refresh() {
    const results = await repository.list({
      type: type === "ALL" ? undefined : type,
      status: status === "ALL" ? undefined : status,
    });
    setTransactions(results);
  }

  /** Même condition d'affichage que transaction-detail.tsx : créance
   * uniquement (jamais une dette), statut post-paiement différent de
   * EN_COURS, et un numéro WhatsApp effectivement disponible pour ce client. */
  async function onQuickPaymentSuccess(paidTransactionId: string, payment: Payment) {
    setPaymentTarget(null);
    const updated = await repository.getById(paidTransactionId);
    await refresh();
    if (!updated || updated.type !== "CREANCE" || updated.status === "EN_COURS") return;

    const party = partyById.get(updated.partyId);
    const whatsappNumber = party?.whatsappNumber ?? party?.phone ?? null;
    if (!whatsappNumber) return;

    setReceiptContext({
      transaction: updated,
      payment,
      whatsappNumber,
      clientName: party?.name ?? "",
    });
  }

  // Recherche par référence/description/nom/téléphone — volontairement pas
  // envoyée au repository (qui ne matche que la description) : ce filtre
  // texte reste local à l'écran plutôt que de faire évoluer le contrat
  // offline (TransactionSearchQuery) pour un besoin purement UI.
  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter((transaction) => {
      const party = partyById.get(transaction.partyId);
      return (
        transaction.description.toLowerCase().includes(term) ||
        (transaction.reference ?? "").toLowerCase().includes(term) ||
        (party?.name.toLowerCase().includes(term) ?? false) ||
        (party?.phone?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [transactions, search, partyById]);

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);

  // Cartes résumé desktop/tablette : total et impayées reflètent le
  // filtre type/statut couramment appliqué (comme la liste), pas la
  // recherche texte — cohérent avec "On me doit"/"Je dois" (résumé tenant
  // entier, jamais réduit par un filtre de cette page).
  const unpaidCount = useMemo(
    () => transactions.filter((transaction) => transaction.status !== "REGLEE").length,
    [transactions],
  );

  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-4 lg:max-w-5xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-foreground text-lg font-semibold">{transactionLabels.listTitle}</h1>
        <Button
          size="sm"
          render={<Link href="/transactions/nouvelle" />}
          nativeButton={false}
          className="shrink-0"
        >
          {transactionLabels.newOperationButtonLabel}
        </Button>
      </div>

      {/* Mobile (< lg) : résumé 2 cases, design inchangé. */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <BalanceSummaryCards owedToMe={summary.owedToMe} owedByMe={summary.owedByMe} />
      </div>

      {/* Desktop/tablette (≥ lg) : résumé étendu à 4 cases. */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-4">
        <BalanceSummaryCards owedToMe={summary.owedToMe} owedByMe={summary.owedByMe} />
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{transactionLabels.totalCountLabel}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">
            {transactions.length}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{transactionLabels.unpaidCountLabel}</p>
          <p className="mt-1 text-xl font-semibold text-[#C0392B] tabular-nums">{unpaidCount}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder={transactionLabels.searchPlaceholder}
          value={search}
          onValueChange={(value) => {
            setSearch(value);
            setVisibleCount(PAGE_SIZE);
          }}
          className="flex-1"
        />
        <div className="flex gap-2">
          <Select value={type} onValueChange={(value) => setType(value as "ALL" | TransactionType)}>
            <SelectTrigger className="w-32">
              <SelectValue>
                {(value: string) => TYPE_FILTER_LABEL_BY_VALUE[value] ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue>
                {(value: string) => STATUS_FILTER_LABEL_BY_VALUE[value] ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile (< lg) : cartes tap → détail, design inchangé. */}
      <ul className="grid grid-cols-1 gap-2 lg:hidden">
        {visibleTransactions.map((transaction) => {
          const signedAmount =
            transaction.type === "CREANCE" ? transaction.amount : -transaction.amount;
          const amountColorClass =
            transaction.type === "CREANCE" ? "text-[#1B7A5A]" : "text-[#0F2A4A]";
          return (
            <li
              key={transaction.id}
              className="bg-card border-border flex items-center gap-2 rounded-lg border p-3 shadow-xs"
            >
              <Link
                href={`/transactions/${transaction.id}`}
                className="hover:text-accent-foreground flex min-w-0 flex-1 items-center justify-between gap-2 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">
                    {transaction.description}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {partyById.get(transaction.partyId)?.name ?? "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {transaction.reference ?? syncLabels.syncing} ·{" "}
                    <span
                      className={
                        transaction.status === "REGLEE" ? "text-[#1B7A5A]" : "text-muted-foreground"
                      }
                    >
                      {STATUS_LABEL[transaction.status]}
                    </span>
                  </p>
                  {isEligibleForReminder(transaction, reminderDays) ? (
                    <Badge variant="warning">{transactionLabels.reminderBadgeLabel}</Badge>
                  ) : null}
                </div>
                <span className={`shrink-0 text-sm font-medium tabular-nums ${amountColorClass}`}>
                  {signedAmount.toLocaleString("fr-FR")} FCFA
                </span>
              </Link>
            </li>
          );
        })}
        {filteredTransactions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{transactionLabels.emptyStateList}</p>
        ) : null}
      </ul>

      {/* Desktop/tablette (≥ lg) : tableau avec actions par ligne. */}
      <div className="border-border bg-card hidden overflow-x-auto rounded-xl border lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs">
              <th className="px-3 py-2 font-medium">{transactionLabels.referenceLabel}</th>
              <th className="px-3 py-2 font-medium">{transactionLabels.personColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{transactionLabels.totalAmountColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{transactionLabels.paidAmountColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{paymentLabels.methodField}</th>
              <th className="px-3 py-2 font-medium">{transactionLabels.statusLabel}</th>
              <th className="px-3 py-2 font-medium">{transactionLabels.dateColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{transactionLabels.actionsColumnLabel}</th>
            </tr>
          </thead>
          <tbody>
            {visibleTransactions.map((transaction) => {
              const party = partyById.get(transaction.partyId);
              const lastMethod = lastPaymentMethodByTransactionId[transaction.id];
              return (
                <tr key={transaction.id} className="border-border border-b last:border-b-0">
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {transaction.reference ?? syncLabels.syncing}
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-foreground">{party?.name ?? "—"}</p>
                    {party?.phone ? (
                      <p className="text-muted-foreground text-xs">{party.phone}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {transaction.amount.toLocaleString("fr-FR")} FCFA
                  </td>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap tabular-nums">
                    {transaction.paidAmount.toLocaleString("fr-FR")} FCFA
                  </td>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {lastMethod ? PAYMENT_METHOD_LABEL[lastMethod] : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={STATUS_BADGE_VARIANT[transaction.status]}>
                        {STATUS_BADGE_LABEL[transaction.status]}
                      </Badge>
                      {isEligibleForReminder(transaction, reminderDays) ? (
                        <Badge variant="warning">{transactionLabels.reminderBadgeLabel}</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {transaction.createdAt.toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={transactionLabels.viewActionLabel}
                        render={<Link href={`/transactions/${transaction.id}`} />}
                        nativeButton={false}
                      >
                        <Eye aria-hidden />
                      </Button>
                      {transaction.paidAmount === 0 ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={transactionLabels.editButtonLabel}
                          render={<Link href={`/transactions/${transaction.id}/modifier`} />}
                          nativeButton={false}
                        >
                          <Pencil aria-hidden />
                        </Button>
                      ) : null}
                      {transaction.status !== "REGLEE" ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={paymentLabels.payButtonLabel(transaction.type)}
                          onClick={() => setPaymentTarget(transaction)}
                        >
                          <Banknote aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredTransactions.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">{transactionLabels.emptyStateList}</p>
        ) : null}
      </div>

      {visibleCount < filteredTransactions.length ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          {transactionLabels.showMoreLabel}
        </Button>
      ) : null}

      {receiptContext ? (
        <div className="border-primary/30 bg-primary/5 space-y-3 rounded-xl border p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-foreground text-sm font-medium">
              {paymentLabels.receiptPromptTitle}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setReceiptContext(null)}>
              {commonLabels.close}
            </Button>
          </div>
          <WhatsappReceiptLink
            phone={receiptContext.whatsappNumber}
            status={receiptContext.transaction.status}
            client={receiptContext.clientName}
            amountPaid={receiptContext.payment.amount}
            method={receiptContext.payment.method}
            remainingBalance={
              receiptContext.transaction.amount - receiptContext.transaction.paidAmount
            }
            partialTemplate={whatsappReceiptTemplates.partial}
            finalTemplate={whatsappReceiptTemplates.final}
          />
        </div>
      ) : null}

      {paymentTarget ? (
        <PaymentModal
          transaction={paymentTarget}
          tenantId={tenantId}
          userId={userId}
          open={paymentTarget !== null}
          onOpenChange={(open) => setPaymentTarget(open ? paymentTarget : null)}
          onSuccess={(payment) => void onQuickPaymentSuccess(paymentTarget.id, payment)}
        />
      ) : null}
    </div>
  );
}
