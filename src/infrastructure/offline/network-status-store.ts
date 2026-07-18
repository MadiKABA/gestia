import {
  computeBackoffDelayMs,
  syncQueue,
  type SyncTransport,
} from "@/infrastructure/offline/sync-engine";
import { pullEntity, type PullTransport } from "@/infrastructure/offline/pull-engine";
import { listPullableEntities } from "@/infrastructure/offline/pull-registry";
import {
  listFailedMutations,
  listPendingMutations,
  purgeSyncedMutations,
} from "@/infrastructure/offline/mutation-queue.store";
import { BACKGROUND_SYNC_TAG, supportsBackgroundSync } from "@/infrastructure/offline/platform";
import { AuthRequiredError } from "@/infrastructure/offline/errors";

export type SyncState = "idle" | "syncing" | "pending" | "error" | "auth_required";

export type NetworkStatusSnapshot = {
  online: boolean;
  syncState: SyncState;
  pendingCount: number;
  /** Mutations en échec définitif (voir markMutationPermanentlyFailed) —
   * jamais comptées dans `pendingCount` (déjà exclues de
   * listPendingMutations), résolues via /synchronisation
   * (sync-failures-panel.tsx), pas par la boucle de retry. */
  failedCount: number;
  /** Incrémenté à chaque cycle de pull terminé (succès ou échec partiel —
   * une entity peut avoir appliqué des pages avant qu'une autre échoue, voir
   * pull-engine.ts). Seul signal exposé aux listes montées (ProductsList
   * etc.) pour savoir qu'IndexedDB a pu changer sous leurs pieds : ces
   * listes lisent le cache local une fois au montage, sans quoi un pull
   * réussi en arrière-plan ne se reflèterait jamais dans un onglet déjà
   * ouvert. Comparer la valeur (pas juste écouter le changement de
   * `syncState`, qui ne bouge pas toujours entre deux cycles idle->idle). */
  syncVersion: number;
};

const SERVER_SNAPSHOT: NetworkStatusSnapshot = {
  online: true,
  syncState: "idle",
  pendingCount: 0,
  failedCount: 0,
  syncVersion: 0,
};
const PERIODIC_SYNC_INTERVAL_MS = 30_000;

/**
 * Store framework-agnostic (pas de dépendance React ni Next.js ici — voir
 * presentation/shared/hooks/use-network-status.ts pour le hook qui
 * l'expose via useSyncExternalStore, et qui fournit le vrai `syncTransport`
 * enveloppant la Server Action). Vit dans infrastructure/offline/ pour
 * rester importable par les futurs repositories offline-first de module
 * métier (ex: PartyOfflineRepository) — le transport reste injecté, jamais
 * importé en dur ici : ça garderait infrastructure/ dépendant de
 * presentation/, sens interdit dans cette architecture.
 */
export class NetworkStatusStore {
  private snapshot: NetworkStatusSnapshot = SERVER_SNAPSHOT;
  private listeners = new Set<() => void>();
  private initialized = false;
  private syncing = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly tenantId: string,
    private readonly syncTransport: SyncTransport,
    private readonly pullTransport: PullTransport,
  ) {}

  getSnapshot = (): NetworkStatusSnapshot => this.snapshot;

  getServerSnapshot = (): NetworkStatusSnapshot => SERVER_SNAPSHOT;

  subscribe = (listener: () => void): (() => void) => {
    this.ensureInitialized();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Non bloquant, jamais attendu par l'appelant (cf. PartyOfflineRepository). */
  triggerSync = (): void => {
    this.ensureInitialized();
    void this.runSync();
    this.registerBackgroundSync();
  };

  /**
   * Best-effort, jamais attendu : demande au navigateur de tenter une sync
   * même si l'app se ferme avant que `runSync` ci-dessus n'aboutisse
   * (Background Sync API — Android/Chrome et dérivés Chromium uniquement,
   * voir ARCHITECTURE.md "Limitations iOS"). Sur un navigateur qui ne la
   * supporte pas, cette fonction est un no-op silencieux : les déclencheurs
   * déjà en place (`online`, `visibilitychange`, polling) restent le seul
   * mécanisme, exactement le fallback prévu.
   */
  private registerBackgroundSync(): void {
    if (!supportsBackgroundSync()) return;
    void navigator.serviceWorker.ready
      .then((registration) => registration.sync.register(BACKGROUND_SYNC_TAG))
      .catch(() => {
        // Best-effort : un refus/échec d'enregistrement laisse simplement les
        // déclencheurs foreground faire le travail, comme sur un navigateur
        // qui ne supporte pas l'API.
      });
  }

  private publish(patch: Partial<NetworkStatusSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;

    this.publish({ online: navigator.onLine });
    void this.refreshPendingCount().then((count) => {
      if (count > 0 && navigator.onLine) void this.runSync();
    });
    void this.refreshFailedCount();

    window.addEventListener("online", () => {
      this.publish({ online: true });
      void this.runSync();
    });
    window.addEventListener("offline", () => {
      this.publish({ online: false });
    });

    // Retour au premier plan (ex: appli PWA relancée depuis l'arrière-plan
    // sur mobile) : les événements réseau ('online') ne se redéclenchent pas
    // forcément si la connexion n'a jamais été coupée pendant l'absence,
    // alors que le tenant a pu recevoir des changements côté serveur entre
    // temps — sans ce déclencheur, il faudrait attendre le prochain tick du
    // polling périodique.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && navigator.onLine) void this.runSync();
    });

    setInterval(() => {
      if (navigator.onLine) void this.runSync();
    }, PERIODIC_SYNC_INTERVAL_MS);
  }

  private async refreshPendingCount(): Promise<number> {
    const pending = await listPendingMutations(this.tenantId);
    this.publish({ pendingCount: pending.length });
    return pending.length;
  }

  private async refreshFailedCount(): Promise<void> {
    const failed = await listFailedMutations(this.tenantId);
    this.publish({ failedCount: failed.length });
  }

  /**
   * Push puis pull, dans cet ordre (cahier des charges §9) : les mutations
   * locales en attente partent d'abord, puis les changements serveur sont
   * rapatriés — une entité tout juste poussée par CE client se retrouve
   * ainsi déjà cohérente au moment du pull, sans dépendre de l'ordre
   * d'arrivée réseau. Un échec du push ne bloque pas le pull : ce sont deux
   * opérations indépendantes, un pull qui réussit reste utile même si une
   * mutation locale a échoué (l'utilisateur voit quand même les changements
   * des autres postes du tenant).
   *
   * Session expirée détectée (push OU pull) : jamais traitée comme un échec
   * ordinaire — aucun backoff programmé (retenter avant reconnexion n'a
   * aucun sens), redirection immédiate vers /login. La mutation en attente
   * n'est ni perdue ni marquée échouée (voir sync-engine.ts/pull-engine.ts) :
   * la reprise se fait automatiquement au prochain cycle de sync déclenché
   * après reconnexion, sans code de "reprise" dédié.
   */
  private async runSync(): Promise<void> {
    if (this.syncing || !navigator.onLine) return;
    this.syncing = true;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.publish({ syncState: "syncing" });
    try {
      const pushResult = await syncQueue({
        tenantId: this.tenantId,
        syncTransport: this.syncTransport,
      });

      if (pushResult.reason === "auth_required") {
        this.publish({ syncState: "auth_required" });
        this.redirectToLogin();
        return;
      }

      const count = await this.refreshPendingCount();
      void this.refreshFailedCount();

      let pullFailed = false;
      for (const entity of listPullableEntities()) {
        try {
          await pullEntity({ tenantId: this.tenantId, entity, pullTransport: this.pullTransport });
        } catch (error) {
          if (error instanceof AuthRequiredError) {
            this.publish({ syncState: "auth_required" });
            this.redirectToLogin();
            return;
          }
          pullFailed = true;
        }
      }

      // Un pull a été tenté (qu'il ait réussi ou échoué en cours de route) :
      // IndexedDB a pu changer, les listes montées doivent le savoir pour se
      // relire — voir NetworkStatusSnapshot.syncVersion ci-dessus.
      this.publish({ syncVersion: this.snapshot.syncVersion + 1 });

      if (pushResult.failed || pullFailed) {
        this.publish({ syncState: "error" });
        this.retryTimeout = setTimeout(
          () => {
            void this.runSync();
          },
          pushResult.nextRetryDelayMs ?? computeBackoffDelayMs(0),
        );
      } else {
        // Cycle push+pull entièrement réussi : bon moment pour purger les
        // mutations déjà confirmées trop anciennes (cf.
        // mutation-queue.store.ts:purgeSyncedMutations) — jamais tenté sur
        // un cycle en échec, où la queue doit rester intacte pour la
        // prochaine tentative.
        await purgeSyncedMutations(this.tenantId);
        this.publish({ syncState: count > 0 ? "pending" : "idle" });
      }
    } finally {
      this.syncing = false;
    }
  }

  private redirectToLogin(): void {
    window.location.assign("/login");
  }
}

const stores = new Map<string, NetworkStatusStore>();

export function getNetworkStatusStore(
  tenantId: string,
  syncTransport: SyncTransport,
  pullTransport: PullTransport,
): NetworkStatusStore {
  let store = stores.get(tenantId);
  if (!store) {
    store = new NetworkStatusStore(tenantId, syncTransport, pullTransport);
    stores.set(tenantId, store);
  }
  return store;
}
