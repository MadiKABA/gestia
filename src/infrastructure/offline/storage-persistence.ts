/**
 * Stockage persistant (`navigator.storage`) — iOS Safari applique une
 * politique d'éviction d'IndexedDB plus agressive qu'Android après une
 * période d'inactivité de l'app (voir ARCHITECTURE.md "Limitations iOS") :
 * demander explicitement la persistance réduit ce risque, sans jamais le
 * supprimer complètement (le navigateur reste seul décisionnaire).
 */

function hasStorageManager(): boolean {
  return typeof navigator !== "undefined" && "storage" in navigator;
}

/** Résout à false sur un navigateur sans l'API Storage plutôt que de lancer
 * une erreur — la persistance best-effort du navigateur reste le
 * comportement par défaut de toute façon. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!hasStorageManager()) return false;
  return navigator.storage.persist();
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!hasStorageManager()) return false;
  return navigator.storage.persisted();
}
