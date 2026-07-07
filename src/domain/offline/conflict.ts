/**
 * Résolution de conflit "dernier écrit gagne" (cahier des charges §9) : un
 * conflit existe si l'entité a été modifiée côté serveur après le dernier
 * état connu du client au moment où il a préparé sa mutation. Ne décide
 * jamais qui gagne — la règle produit veut que l'écriture entrante gagne
 * toujours, ceci ne fait que signaler qu'un écrasement a eu lieu pour que
 * l'appelant trace l'AuditLog.
 */
export function detectConflict(clientKnownUpdatedAt: string, serverUpdatedAt: string): boolean {
  return new Date(serverUpdatedAt).getTime() > new Date(clientKnownUpdatedAt).getTime();
}
