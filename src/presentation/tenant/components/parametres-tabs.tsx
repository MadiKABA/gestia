"use client";

import { cn } from "@/lib/utils";

export type ParametresTabKey = "general" | "relance" | "appearance";

export function ParametresTabs({
  active,
  onChange,
  tabs,
}: {
  active: ParametresTabKey;
  onChange: (tab: ParametresTabKey) => void;
  tabs: { key: ParametresTabKey; label: string }[];
}) {
  return (
    <div
      className="bg-muted flex gap-1 overflow-x-auto rounded-lg p-1"
      role="tablist"
      aria-label="Sections des paramètres"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            // ~44px de hauteur cliquable (WCAG 2.5.5) — boutons natifs, hors
            // buttonVariants (voir ui/button.tsx pour le composant Button).
            "rounded-md border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
            active === tab.key
              ? "border-primary bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
