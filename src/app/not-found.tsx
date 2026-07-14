import { NotFoundContent } from "@/presentation/shared/components/not-found-content";

/**
 * Capture toute URL non matchée par l'app entière, ainsi que les `notFound()`
 * explicites hors du groupe `(dashboard)` (ex: sous un préfixe d'auth mal
 * saisi). Rendu autonome, sans `AppShell` : un visiteur qui atteint cet écran
 * n'a par construction pas de session valide (voir `src/proxy.ts`, qui
 * redirige vers /login toute route non publique sans session) — la sidebar
 * n'aurait rien à afficher. Le cas authentifié est couvert séparément par
 * `(dashboard)/[...slug]/not-found.tsx`.
 */
export default function NotFound() {
  return <NotFoundContent />;
}
