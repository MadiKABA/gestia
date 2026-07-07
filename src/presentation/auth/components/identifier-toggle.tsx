"use client";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "PHONE", label: "Téléphone" },
  { value: "EMAIL", label: "Email" },
] as const;

/** Choix du canal de connexion — le téléphone reste l'identifiant prioritaire
 * (cahier des charges §4) : c'est la valeur par défaut du parent, jamais ce
 * composant. */
export function IdentifierToggle({
  value,
  onChange,
}: {
  value: "PHONE" | "EMAIL";
  onChange: (value: "PHONE" | "EMAIL") => void;
}) {
  return (
    <div
      className="bg-muted flex gap-1 rounded-lg p-1"
      role="tablist"
      aria-label="Moyen de connexion"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
