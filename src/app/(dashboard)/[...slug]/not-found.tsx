import { NotFoundContent } from "@/presentation/shared/components/not-found-content";

/**
 * Colocalisé avec `page.tsx` (même dossier) — capture le `notFound()`
 * qu'il déclenche, et reste enveloppé par `(dashboard)/layout.tsx` (sidebar/
 * bottom nav toujours visibles). Voir `app/not-found.tsx` pour le cas non
 * authentifié.
 */
export default function CatchAllNotFound() {
  return <NotFoundContent />;
}
