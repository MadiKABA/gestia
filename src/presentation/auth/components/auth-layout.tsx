import type { ReactNode } from "react";

/** Coquille commune aux écrans d'authentification (mobile-first, un écran =
 * une action). Porte le wordmark Gestia, discret mais toujours visible. */
export function AuthLayout({
  heading,
  description,
  children,
  footer,
}: {
  heading: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-primary text-sm font-semibold tracking-wide uppercase">Gestia</span>
        </div>
        <div className="border-border bg-card space-y-6 rounded-xl border p-6 shadow-xs">
          <div className="space-y-1.5 text-center">
            <h1 className="text-foreground text-lg font-semibold">{heading}</h1>
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
          </div>
          {children}
        </div>
        {footer ? <div className="text-muted-foreground text-center text-sm">{footer}</div> : null}
      </div>
    </div>
  );
}
