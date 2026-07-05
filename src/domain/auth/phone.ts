import { ValidationError } from "@/domain/shared/errors";

/** Numéros au format international (+221771234567) — cahier des charges §4. */
const PHONE_REGEX = /^\+\d{8,15}$/;

export function validatePhoneFormat(phone: string): void {
  if (!PHONE_REGEX.test(phone)) {
    throw new ValidationError("Le numéro de téléphone doit être au format international (+221...)");
  }
}
