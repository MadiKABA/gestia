import { authLabels } from "@/presentation/shared/labels";
import type { CurrentUser } from "@/application/auth/get-current-user.use-case";

const ROLE_LABEL: Record<CurrentUser["role"], string> = {
  PATRON: authLabels.roleLabelPatron,
  VENDEUR: authLabels.roleLabelVendeur,
};

/** Vue lecture seule — aucune modification depuis cette page (hors périmètre
 * de ce retrofit navigation, voir plan associé). */
export function ProfilView({ currentUser }: { currentUser: CurrentUser }) {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-4">
      <h1 className="text-foreground text-lg font-semibold">{authLabels.profilePageTitle}</h1>

      <div className="bg-card border-border space-y-3 rounded-xl border p-4 text-sm shadow-xs">
        <p>
          <span className="text-muted-foreground">{authLabels.profileNameLabel} : </span>
          {currentUser.name}
        </p>
        <p>
          <span className="text-muted-foreground">{authLabels.profilePhoneLabel} : </span>
          {currentUser.phone}
        </p>
        {currentUser.email ? (
          <p>
            <span className="text-muted-foreground">{authLabels.profileEmailLabel} : </span>
            {currentUser.email}
          </p>
        ) : null}
        <p>
          <span className="text-muted-foreground">{authLabels.profileRoleLabel} : </span>
          {ROLE_LABEL[currentUser.role]}
        </p>
      </div>
    </div>
  );
}
