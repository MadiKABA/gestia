import { requireTenantContext } from "@/infrastructure/auth/session";
import { BackLink } from "@/presentation/shared/components/back-link";
import { SyncFailuresPanel } from "@/presentation/offline/components/sync-failures-panel";
import { syncFailuresLabels } from "@/presentation/shared/labels";

/**
 * Volontairement absente de SIDEBAR_NAV_ITEMS/BOTTOM_TAB_ITEMS
 * (nav-config.ts) : accessible uniquement via le lien de l'indicateur
 * réseau du header (network-status-indicator.tsx) quand des mutations sont
 * en échec définitif — pas une destination de navigation courante. Ouverte
 * aux deux rôles : la queue offline est locale à l'appareil, jamais liée
 * à un rôle particulier (un vendeur peut tout aussi bien avoir une action
 * bloquée que le patron).
 */
export default async function SynchronisationPage() {
  const { tenantId } = await requireTenantContext();

  return (
    <div className="space-y-4 p-4">
      <BackLink href="/tiers" />
      <div>
        <h1 className="text-foreground text-lg font-semibold">{syncFailuresLabels.pageTitle}</h1>
        <p className="text-muted-foreground text-sm">{syncFailuresLabels.pageDescription}</p>
      </div>
      <SyncFailuresPanel tenantId={tenantId} />
    </div>
  );
}
