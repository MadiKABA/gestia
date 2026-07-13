import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/infrastructure/auth/session";
import { Button } from "@/presentation/shared/components/ui/button";
import { landingLabels } from "@/presentation/shared/labels";

/**
 * Écran d'accueil public — point d'entrée pour un visiteur non connecté
 * (marketing/présentation, contenu volontairement minimal pour cette
 * version). `start_url` du manifest PWA pointe ici (`public/manifest.json`),
 * donc une session valide doit repartir immédiatement vers `/dashboard` sans
 * afficher cet écran, sinon une PWA installée déjà connectée réaffiche la
 * vitrine à chaque ouverture. Le bouton adaptatif ci-dessous reste un filet
 * de sécurité pour les cas où cette redirection échouerait, pas le
 * mécanisme principal (voir `src/proxy.ts` pour le filtrage d'accès amont).
 */
export default async function Home() {
  const context = await getTenantContext();
  // Mécanisme principal (couvre en particulier l'ouverture de la PWA
  // installée, `start_url: "/"` — voir docstring ci-dessus) : une session
  // valide ne doit jamais voir cet écran. `redirect()` interrompt le rendu,
  // donc la branche "connecté" du bouton juste en dessous n'est en pratique
  // jamais atteinte tant que cet appel réussit — elle reste un filet de
  // sécurité explicite (cas résiduel) si ce garde-fou venait à être
  // contourné par un futur changement.
  if (context) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-10 px-6 py-10 text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="bg-primary flex size-16 items-center justify-center rounded-2xl">
          <span className="text-primary-foreground text-3xl font-bold">G</span>
        </div>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">Gestia</h1>
        <p className="text-muted-foreground max-w-md text-lg">{landingLabels.tagline}</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Button
          className="w-full"
          render={<Link href={context ? "/dashboard" : "/login"} />}
          nativeButton={false}
        >
          {context ? landingLabels.dashboardButtonLabel : landingLabels.loginButtonLabel}
        </Button>
        {context ? null : (
          <Link
            href="/register"
            className="text-muted-foreground hover:text-foreground block text-center text-sm font-medium transition-colors"
          >
            {landingLabels.registerLinkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
