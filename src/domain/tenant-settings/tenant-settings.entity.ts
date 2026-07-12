import { ValidationError } from "@/domain/shared/errors";
import { BRAND_PRESET_VALUES } from "@/config/brand-presets";

const REMINDER_DAYS_MIN = 1;
const REMINDER_DAYS_MAX = 30;
const WHATSAPP_TEMPLATE_MAX_LENGTH = 500;
const WHATSAPP_PLACEHOLDERS = ["{client}", "{montant}", "{reference}"] as const;

/**
 * Update partiel : seules les clés présentes sont validées/écrites (chaque
 * section du formulaire /parametres n'envoie que son propre sous-ensemble).
 * `logoUrl` n'est jamais exposé par `updateTenantSettingsSchema` (présentation) :
 * seul `uploadTenantLogo` le renseigne, dérivé d'un upload Cloudinary, jamais
 * saisi à la main par le patron.
 */
export type TenantSettingsUpdateInput = Partial<{
  displayName: string | null;
  currency: string;
  reminderDays: number;
  whatsappTemplate: string | null;
  brandColor: string | null;
  logoUrl: string | null;
}>;

/**
 * Règles métier pures (cahier des charges §5, theming) : `reminderDays` dans
 * une plage raisonnable, `brandColor` dans la liste des presets validés
 * contraste/accessibilité, `whatsappTemplate` doit conserver les trois
 * placeholders attendus par `renderWhatsappTemplate` (whatsapp-link.tsx).
 */
export function validateTenantSettingsInput(input: TenantSettingsUpdateInput): void {
  if (input.reminderDays !== undefined) {
    if (
      !Number.isInteger(input.reminderDays) ||
      input.reminderDays < REMINDER_DAYS_MIN ||
      input.reminderDays > REMINDER_DAYS_MAX
    ) {
      throw new ValidationError(
        `Le délai de relance doit être compris entre ${REMINDER_DAYS_MIN} et ${REMINDER_DAYS_MAX} jours`,
      );
    }
  }

  if (input.brandColor != null && !BRAND_PRESET_VALUES.has(input.brandColor)) {
    throw new ValidationError("La couleur doit faire partie des couleurs proposées");
  }

  if (input.whatsappTemplate != null) {
    if (input.whatsappTemplate.length > WHATSAPP_TEMPLATE_MAX_LENGTH) {
      throw new ValidationError(
        `Le message de relance ne doit pas dépasser ${WHATSAPP_TEMPLATE_MAX_LENGTH} caractères`,
      );
    }
    const missing = WHATSAPP_PLACEHOLDERS.filter(
      (placeholder) => !input.whatsappTemplate!.includes(placeholder),
    );
    if (missing.length > 0) {
      throw new ValidationError(`Le message de relance doit contenir ${missing.join(", ")}`);
    }
  }

  if (input.displayName != null && !input.displayName.trim()) {
    throw new ValidationError("Le nom affiché ne peut pas être vide");
  }

  if (input.currency != null && !input.currency.trim()) {
    throw new ValidationError("La devise ne peut pas être vide");
  }
}
