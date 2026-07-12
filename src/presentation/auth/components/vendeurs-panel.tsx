"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { Input } from "@/presentation/shared/components/ui/input";
import { Badge } from "@/presentation/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/shared/components/ui/select";
import { ConfirmDialog } from "@/presentation/shared/components/confirm-dialog";
import { deactivateVendeurAction, reactivateVendeurAction } from "@/presentation/auth/actions";
import { commonLabels, authLabels } from "@/presentation/shared/labels";
import { buildPremiereConnexionLink } from "@/domain/auth/premiere-connexion-link";
import { InviteVendeurModal } from "@/presentation/auth/components/invite-vendeur-modal";

type Vendeur = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  createdAt: Date;
  firstLoginAt: Date | null;
};

type VendeurStatus = "ACTIVE" | "DISABLED" | "PENDING";
type StatusFilter = "ALL" | VendeurStatus;

function statusOf(vendeur: Vendeur): VendeurStatus {
  if (!vendeur.active) return "DISABLED";
  if (!vendeur.firstLoginAt) return "PENDING";
  return "ACTIVE";
}

const STATUS_LABEL: Record<VendeurStatus, string> = {
  ACTIVE: authLabels.statusActive,
  DISABLED: authLabels.statusDisabled,
  PENDING: authLabels.statusPending,
};

const STATUS_BADGE_VARIANT: Record<VendeurStatus, "success" | "neutral" | "info"> = {
  ACTIVE: "success",
  DISABLED: "neutral",
  PENDING: "info",
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: authLabels.filterAll },
  { value: "ACTIVE", label: authLabels.statusActive },
  { value: "DISABLED", label: authLabels.statusDisabled },
  { value: "PENDING", label: authLabels.statusPending },
];
const STATUS_FILTER_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  STATUS_FILTERS.map((option) => [option.value, option.label]),
);

/** Nombre de vendeurs affichés par page — même pattern que
 * transactions-list.tsx (PAGE_SIZE + visibleCount + slice, pas de composant
 * de pagination dédié dans l'app). */
const PAGE_SIZE = 20;

export function VendeursPanel({ initialVendeurs }: { initialVendeurs: Vendeur[] }) {
  const router = useRouter();
  const [vendeurs, setVendeurs] = useState(initialVendeurs);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitedLink, setInvitedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedVendeurId, setCopiedVendeurId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    vendeur: Vendeur;
    action: "deactivate" | "reactivate";
  } | null>(null);
  const [pendingAction, startPendingAction] = useTransition();

  const counts = useMemo(() => {
    let active = 0;
    let disabled = 0;
    let pending = 0;
    for (const vendeur of vendeurs) {
      const status = statusOf(vendeur);
      if (status === "ACTIVE") active++;
      else if (status === "DISABLED") disabled++;
      else pending++;
    }
    return { total: vendeurs.length, active, disabled, pending };
  }, [vendeurs]);

  const filteredVendeurs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vendeurs.filter((vendeur) => {
      if (statusFilter !== "ALL" && statusOf(vendeur) !== statusFilter) return false;
      if (!term) return true;
      return (
        vendeur.name.toLowerCase().includes(term) || vendeur.phone.toLowerCase().includes(term)
      );
    });
  }, [vendeurs, search, statusFilter]);

  const visibleVendeurs = filteredVendeurs.slice(0, visibleCount);

  function onInvited(invitedPhone: string) {
    setInviteModalOpen(false);
    setCopied(false);
    // Le SMS envoyé porte déjà ce lien (voir sms-otp-sender.ts) — l'afficher
    // ici permet au patron de le transmettre lui-même (WhatsApp, etc.) si
    // le SMS n'arrive pas ou si le vendeur n'a pas son téléphone sous la
    // main. Même fonction pure que côté serveur, jamais dupliquée.
    setInvitedLink(buildPremiereConnexionLink(process.env.NEXT_PUBLIC_APP_URL!, invitedPhone));
    router.refresh();
  }

  async function onCopyInvitedLink() {
    if (!invitedLink) return;
    try {
      await navigator.clipboard.writeText(invitedLink);
      setCopied(true);
    } catch {
      // Permission clipboard refusée/indisponible (contexte non sécurisé,
      // navigateur non supporté) : le lien reste affiché en clair
      // juste au-dessus, sélectionnable/copiable manuellement — jamais un
      // clic sans aucun retour.
      setError(authLabels.copyLinkFailedMessage);
    }
  }

  /** Disponible à tout moment pour un vendeur qui n'a pas encore défini son
   * PIN (`firstLoginAt` null) — pas seulement juste après l'invitation :
   * calcul client pur, aucun appel serveur nécessaire. */
  async function onCopyRowLink(vendeur: Vendeur) {
    const link = buildPremiereConnexionLink(process.env.NEXT_PUBLIC_APP_URL!, vendeur.phone);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedVendeurId(vendeur.id);
    } catch {
      setError(authLabels.copyLinkFailedMessage);
    }
  }

  function onConfirmAction() {
    if (!confirmTarget) return;
    const { vendeur, action } = confirmTarget;
    setError(null);
    startPendingAction(async () => {
      try {
        if (action === "deactivate") {
          await deactivateVendeurAction({ vendeurId: vendeur.id });
        } else {
          await reactivateVendeurAction({ vendeurId: vendeur.id });
        }
        setVendeurs((current) =>
          current.map((v) => (v.id === vendeur.id ? { ...v, active: action === "reactivate" } : v)),
        );
        setConfirmTarget(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : commonLabels.genericError);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-4 md:max-w-5xl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-foreground text-lg font-semibold">{authLabels.vendeursListTitle}</h1>
          <p className="text-muted-foreground text-sm">{authLabels.vendeursListDescription}</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => setInviteModalOpen(true)}>
          {authLabels.inviteVendeurButtonLabel}
        </Button>
      </div>

      <InviteVendeurModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInvited={onInvited}
      />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {invitedLink ? (
        <div className="border-primary/30 bg-primary/5 space-y-3 rounded-xl border p-4">
          <div>
            <p className="text-foreground text-sm font-medium">{authLabels.vendeurInvitedTitle}</p>
            <p className="text-muted-foreground text-sm">{authLabels.vendeurInvitedDescription}</p>
          </div>
          <p className="border-border bg-card overflow-x-auto rounded-lg border p-2 text-xs break-all">
            {invitedLink}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onCopyInvitedLink()}
            >
              {copied ? authLabels.linkCopiedButton : authLabels.copyLinkButton}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setInvitedLink(null)}>
              {authLabels.dismissVendeurInvitedLabel}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Mobile (< md) : résumé 2 cases. */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{authLabels.totalCountLabel}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">{counts.total}</p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{authLabels.pendingCountLabel}</p>
          <p className="mt-1 text-xl font-semibold text-[#0F2A4A] tabular-nums">{counts.pending}</p>
        </div>
      </div>

      {/* Desktop/tablette (≥ md) : résumé 4 cases. */}
      <div className="hidden gap-3 md:grid md:grid-cols-4">
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{authLabels.totalCountLabel}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">{counts.total}</p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{authLabels.activeCountLabel}</p>
          <p className="mt-1 text-xl font-semibold text-[#1B7A5A] tabular-nums">{counts.active}</p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{authLabels.disabledCountLabel}</p>
          <p className="text-foreground mt-1 text-xl font-semibold tabular-nums">
            {counts.disabled}
          </p>
        </div>
        <div className="bg-card border-border rounded-xl border p-4 shadow-xs">
          <p className="text-muted-foreground text-sm">{authLabels.pendingCountLabel}</p>
          <p className="mt-1 text-xl font-semibold text-[#0F2A4A] tabular-nums">{counts.pending}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder={authLabels.searchPlaceholder}
          value={search}
          onValueChange={(value) => {
            setSearch(value);
            setVisibleCount(PAGE_SIZE);
          }}
          className="flex-1"
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as StatusFilter);
            setVisibleCount(PAGE_SIZE);
          }}
        >
          <SelectTrigger className="w-40">
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

      {/* Mobile (< md) : cards simples, design inchangé. */}
      <ul className="grid grid-cols-1 gap-2 md:hidden">
        {visibleVendeurs.map((vendeur) => {
          const status = statusOf(vendeur);
          return (
            <li
              key={vendeur.id}
              className="bg-card border-border space-y-2 rounded-lg border p-3 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">{vendeur.name}</p>
                  <p className="text-muted-foreground truncate text-sm">{vendeur.phone}</p>
                </div>
                <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {status === "DISABLED" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmTarget({ vendeur, action: "reactivate" })}
                  >
                    {authLabels.reactivateButtonLabel}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmTarget({ vendeur, action: "deactivate" })}
                  >
                    {authLabels.deactivateButtonLabel}
                  </Button>
                )}
                {!vendeur.firstLoginAt ? (
                  <Button variant="outline" size="sm" onClick={() => void onCopyRowLink(vendeur)}>
                    {copiedVendeurId === vendeur.id
                      ? authLabels.linkCopiedButton
                      : authLabels.copyLinkButton}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
        {filteredVendeurs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {vendeurs.length === 0 ? authLabels.emptyStateList : authLabels.emptyStateFiltered}
          </p>
        ) : null}
      </ul>

      {/* Desktop/tablette (≥ md) : tableau avec actions par ligne. */}
      <div className="border-border bg-card hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-left text-xs">
              <th className="px-3 py-2 font-medium">{authLabels.nameColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{authLabels.phoneColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{authLabels.statusColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{authLabels.invitedAtColumnLabel}</th>
              <th className="px-3 py-2 font-medium">{authLabels.actionsColumnLabel}</th>
            </tr>
          </thead>
          <tbody>
            {visibleVendeurs.map((vendeur) => {
              const status = statusOf(vendeur);
              return (
                <tr key={vendeur.id} className="border-border border-b last:border-b-0">
                  <td className="text-foreground px-3 py-2">{vendeur.name}</td>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {vendeur.phone}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                    {vendeur.createdAt.toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {status === "DISABLED" ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={authLabels.reactivateButtonLabel}
                          onClick={() => setConfirmTarget({ vendeur, action: "reactivate" })}
                        >
                          <RotateCcw aria-hidden />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={authLabels.deactivateButtonLabel}
                          onClick={() => setConfirmTarget({ vendeur, action: "deactivate" })}
                        >
                          <Ban aria-hidden />
                        </Button>
                      )}
                      {!vendeur.firstLoginAt ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={authLabels.copyLinkRowActionLabel}
                          onClick={() => void onCopyRowLink(vendeur)}
                        >
                          {copiedVendeurId === vendeur.id ? (
                            <Check aria-hidden />
                          ) : (
                            <Copy aria-hidden />
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredVendeurs.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">
            {vendeurs.length === 0 ? authLabels.emptyStateList : authLabels.emptyStateFiltered}
          </p>
        ) : null}
      </div>

      {visibleCount < filteredVendeurs.length ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          {authLabels.showMoreLabel}
        </Button>
      ) : null}

      {confirmTarget ? (
        <ConfirmDialog
          open={confirmTarget !== null}
          onOpenChange={(open) => setConfirmTarget(open ? confirmTarget : null)}
          title={
            confirmTarget.action === "deactivate"
              ? authLabels.deactivateConfirmTitle(confirmTarget.vendeur.name)
              : authLabels.reactivateConfirmTitle(confirmTarget.vendeur.name)
          }
          description={
            confirmTarget.action === "deactivate"
              ? authLabels.deactivateConfirmDescription
              : authLabels.reactivateConfirmDescription
          }
          confirmLabel={
            confirmTarget.action === "deactivate"
              ? authLabels.deactivateButtonLabel
              : authLabels.reactivateButtonLabel
          }
          confirmVariant={confirmTarget.action === "deactivate" ? "destructive" : "default"}
          pending={pendingAction}
          pendingLabel={
            confirmTarget.action === "deactivate"
              ? authLabels.deactivatingButtonLabel
              : authLabels.reactivatingButtonLabel
          }
          onConfirm={onConfirmAction}
        />
      ) : null}
    </div>
  );
}
