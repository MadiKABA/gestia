import { ValidationError } from "@/domain/shared/errors";
import { BRAND_PRESET_VALUES } from "@/config/brand-presets";
import { isCurrencyCode, type CurrencyCode } from "@/config/currencies";

const REMINDER_DAYS_MIN = 1;
const REMINDER_DAYS_MAX = 30;
const WHATSAPP_TEMPLATE_MAX_LENGTH = 500;
const WHATSAPP_PLACEHOLDERS = ["{client}", "{montantRestant}", "{reference}"] as const;
const WHATSAPP_RECEIPT_PARTIAL_PLACEHOLDERS = [
  "{client}",
  "{montantPaye}",
  "{modePaiement}",
  "{montantRestant}",
] as const;
const WHATSAPP_RECEIPT_FINAL_PLACEHOLDERS = ["{client}", "{montantPaye}"] as const;

/**
 * Update partiel : seules les clés présentes sont validées/écrites (chaque
 * section du formulaire /parametres n'envoie que son propre sous-ensemble).
 * `logoUrl` n'est jamais exposé par `updateTenantSettingsSchema` (présentation) :
 * seul `uploadTenantLogo` le renseigne, dérivé d'un upload Cloudinary, jamais
 * saisi à la main par le patron.
 */
export type TenantSettingsUpdateInput = Partial<{
  displayName: string | null;
  currency: CurrencyCode;
  reminderDays: number;
  whatsappTemplate: string | null;
  whatsappReceiptPartialTemplate: string | null;
  whatsappReceiptFinalTemplate: string | null;
  brandColor: string | null;
  logoUrl: string | null;
}>;

/** Valide un gabarit WhatsApp générique (longueur + placeholders requis) —
 * factorisé pour les 3 champs de gabarit (relance, reçu partiel, reçu final)
 * qui partagent la même forme de règle, seuls la liste de placeholders et le
 * libellé d'erreur changent. */
function validateWhatsappTemplateField(
  value: string,
  placeholders: readonly string[],
  fieldLabel: string,
): void {
  if (value.length > WHATSAPP_TEMPLATE_MAX_LENGTH) {
    throw new ValidationError(
      `${fieldLabel} ne doit pas dépasser ${WHATSAPP_TEMPLATE_MAX_LENGTH} caractères`,
    );
  }
  const missing = placeholders.filter((placeholder) => !value.includes(placeholder));
  if (missing.length > 0) {
    throw new ValidationError(`${fieldLabel} doit contenir ${missing.join(", ")}`);
  }
}

/**
 * Règles métier pures (cahier des charges §5, theming) : `reminderDays` dans
 * une plage raisonnable, `brandColor` dans la liste des presets validés
 * contraste/accessibilité, chaque gabarit WhatsApp doit conserver les
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
    validateWhatsappTemplateField(
      input.whatsappTemplate,
      WHATSAPP_PLACEHOLDERS,
      "Le message de relance",
    );
  }

  if (input.whatsappReceiptPartialTemplate != null) {
    validateWhatsappTemplateField(
      input.whatsappReceiptPartialTemplate,
      WHATSAPP_RECEIPT_PARTIAL_PLACEHOLDERS,
      "Le message de reçu partiel",
    );
  }

  if (input.whatsappReceiptFinalTemplate != null) {
    validateWhatsappTemplateField(
      input.whatsappReceiptFinalTemplate,
      WHATSAPP_RECEIPT_FINAL_PLACEHOLDERS,
      "Le message de reçu final",
    );
  }

  if (input.displayName != null && !input.displayName.trim()) {
    throw new ValidationError("Le nom affiché ne peut pas être vide");
  }

  if (input.currency != null && !isCurrencyCode(input.currency)) {
    throw new ValidationError("La devise doit faire partie des devises proposées");
  }
}
