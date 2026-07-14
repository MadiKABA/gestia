import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { ValidationError } from "@/domain/shared/errors";

/** Numéros au format international (+221771234567) — `PhoneInput` (presentation)
 * garantit déjà ce préfixe, donc l'indicatif est toujours déductible du numéro
 * lui-même, sans paramètre de pays séparé à faire transiter jusqu'ici. */
export function validatePhoneFormat(phone: string): void {
  const parsed = parsePhoneNumberFromString(phone);
  if (!parsed || !parsed.isValid()) {
    throw new ValidationError("Le numéro de téléphone doit être au format international (+221...)");
  }
}

/** Filet de sécurité avant persistance : le stockage reste E.164
 * (`+221771234567`), format déjà émis par `PhoneInput` en amont. */
export function normalizePhoneToE164(phone: string): string {
  const parsed = parsePhoneNumberFromString(phone);
  if (!parsed || !parsed.isValid()) {
    throw new ValidationError("Le numéro de téléphone doit être au format international (+221...)");
  }
  return parsed.number;
}

/** Ne garde que les chiffres — wa.me n'accepte ni "+", ni espaces, ni
 * tirets, quel que soit le format saisi côté fiche client. */
export function toWhatsappDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}
