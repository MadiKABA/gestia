import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-[#1B7A5A]/10 text-[#1B7A5A]",
        info: "bg-[#0F2A4A]/10 text-[#0F2A4A]",
        // Réservé aux statuts nécessitant une alerte réelle (impayé) — la
        // couleur d'alerte de la charte n'est jamais utilisée ailleurs pour
        // un usage décoratif (voir CLAUDE.md "Theming").
        alert: "bg-[#C0392B]/10 text-[#C0392B]",
        // Ambre — réservé au badge "à relancer" (échéance dépassée selon
        // TenantSettings.reminderDays) : signal d'attention, jamais aussi
        // fort que `alert` (impayé), jamais réutilisé pour un usage décoratif.
        warning: "bg-[#B45309]/10 text-[#B45309]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
