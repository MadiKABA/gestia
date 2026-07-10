import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { commonLabels } from "@/presentation/shared/labels";

/**
 * Lien de retour explicite pour les pages de création/édition — mobile-first
 * : chaque écran doit avoir une sortie claire et visible, jamais dépendre du
 * seul bouton retour du navigateur ou de la sidebar (cf. CLAUDE.md).
 */
export function BackLink({ href, label = commonLabels.back }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
