import { createId } from "@paralleldrive/cuid2";

/**
 * Génère un id définitif côté client, sans dépendre du réseau — cet id
 * devient l'id réel de l'entité, jamais remplacé à la synchronisation (cahier
 * des charges §9). Seule la référence métier (CR-2026-XXXXX / DT-2026-XXXXX,
 * via `Sequence`) reste à réconcilier côté serveur.
 *
 * cuid2 plutôt que le `cuid()` classique par défaut de Prisma
 * (`@default(cuid())`, format différent) : ce dernier est signalé par ses
 * propres mainteneurs comme prévisible, un mauvais choix pour un id généré
 * à travers plusieurs appareils/tenants. L'id reste une clé opaque, jamais
 * montrée à l'utilisateur (voir CLAUDE.md, section Vocabulaire) — le format
 * n'a pas besoin de correspondre à celui des lignes déjà en base.
 */
export function generateClientId(): string {
  return createId();
}
