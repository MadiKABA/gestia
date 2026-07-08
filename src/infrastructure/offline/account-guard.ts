import { clearAllOfflineData } from "@/infrastructure/offline/db";

const STORAGE_KEY = "gestia:offline:last-account";

function accountKey(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`;
}

/**
 * Garantit que le cache offline (IndexedDB) appartient bien au compte
 * actuellement connecté sur cet appareil — un changement de compte
 * (déconnexion suivie de la connexion d'un autre utilisateur/tenant sur le
 * même appareil/navigateur) doit vider tout cache précédent avant qu'aucune
 * nouvelle donnée n'y soit lue ou écrite (voir ARCHITECTURE.md "Sécurité du
 * cache local"). `localStorage` (synchrone) porte le marqueur plutôt
 * qu'IndexedDB : doit être lisible sans attendre l'ouverture d'une
 * connexion IndexedDB, pour que la comparaison précède tout accès au cache.
 *
 * À appeler une fois au montage du dashboard (app-shell.tsx), avant que
 * tout enfant susceptible de lire le cache offline (ex: PartiesList) ne
 * soit lui-même monté — d'où le composant appelant qui bloque le rendu de
 * ses enfants jusqu'à la résolution de cette fonction plutôt que de la
 * lancer en tâche de fond : sans ça, l'ordre d'exécution des effets React
 * (enfants avant parents) laisserait un enfant lire le cache avant que ce
 * garde-fou n'ait eu la main.
 */
export async function ensureCacheMatchesAccount(tenantId: string, userId: string): Promise<void> {
  const current = accountKey(tenantId, userId);
  const last = localStorage.getItem(STORAGE_KEY);
  if (last !== null && last !== current) {
    await clearAllOfflineData();
  }
  localStorage.setItem(STORAGE_KEY, current);
}

/**
 * Déconnexion (voir sidebar-nav-content.tsx) : vide le cache ET retire le
 * marqueur de compte — un appareil partagé ne doit garder aucune donnée
 * accessible après déconnexion. Retirer le marqueur (plutôt que le laisser
 * pointer sur le compte qui vient de se déconnecter) est ce qui permet à
 * `ensureCacheMatchesAccount` de détecter correctement la connexion d'un
 * compte différent juste après, même si ce nouveau compte réutilise
 * exactement le même appareil sans jamais repasser par cette fonction.
 */
export async function clearAccountCache(): Promise<void> {
  await clearAllOfflineData();
  localStorage.removeItem(STORAGE_KEY);
}
