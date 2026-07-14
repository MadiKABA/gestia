"use client";

import { useRouter } from "next/navigation";
import { FileQuestion } from "lucide-react";
import { Button } from "@/presentation/shared/components/ui/button";
import { commonLabels, notFoundLabels } from "@/presentation/shared/labels";

/**
 * Contenu partagé par les deux `not-found.tsx` de l'app (racine et
 * `(dashboard)/[...slug]`, voir ces fichiers) — seul le wrapping change
 * selon la présence d'une session, jamais ce contenu. Le bouton retour
 * utilise l'historique du navigateur (`router.back()`), pas un `href` fixe
 * comme `BackLink` : une 404 n'a pas de destination "parente" connue.
 */
export function NotFoundContent() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-full">
        <FileQuestion className="text-muted-foreground size-7" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-foreground text-lg font-semibold">{notFoundLabels.title}</h1>
        <p className="text-muted-foreground text-sm">{notFoundLabels.description}</p>
      </div>
      <Button variant="outline" onClick={() => router.back()}>
        {commonLabels.back}
      </Button>
    </div>
  );
}
