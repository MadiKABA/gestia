"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Pas de next-themes dans le projet — `theme="system"` s'appuie directement
 * sur `prefers-color-scheme`, cohérent avec le reste de l'app (dark mode déjà
 * géré uniquement via la media query, voir globals.css). */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      style={
        {
          // Fonds teintés plutôt qu'aplats pleins — même convention que le
          // variant "destructive" du Button (bg-destructive/10 text-destructive).
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "color-mix(in oklch, var(--success) 12%, var(--background))",
          "--success-text": "var(--success)",
          "--success-border": "color-mix(in oklch, var(--success) 40%, transparent)",
          "--error-bg": "color-mix(in oklch, var(--destructive) 12%, var(--background))",
          "--error-text": "var(--destructive)",
          "--error-border": "color-mix(in oklch, var(--destructive) 40%, transparent)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
