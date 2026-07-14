import { notFound } from "next/navigation";

/**
 * Catch-all pour toute URL sous l'espace applicatif qui ne correspond à
 * aucune page réelle. L'authentification est déjà garantie par
 * `(dashboard)/layout.tsx`, qui enveloppe ce segment comme tous les autres —
 * appeler `notFound()` ici (plutôt que laisser Next.js router vers le
 * `not-found.tsx` racine, hors AppShell) permet à `not-found.tsx` colocalisé
 * dans ce même dossier de rendre le 404 avec sidebar/bottom nav visibles.
 * Segments obligatoires (`[...slug]`, pas `[[...slug]]`) : un catch-all
 * optionnel matcherait aussi la racine du groupe, inutile ici (déjà gérée
 * par `app/page.tsx`).
 */
export default function CatchAllPage() {
  notFound();
}
