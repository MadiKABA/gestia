import { ValidationError } from "@/domain/shared/errors";

/** Règles PIN + verrouillage (cahier des charges §4) : PIN à 4 chiffres,
 * verrouillage après 5 tentatives échouées. */
export const PIN_LENGTH = 4;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function validatePinFormat(pin: string): void {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    throw new ValidationError(`Le PIN doit contenir exactement ${PIN_LENGTH} chiffres`);
  }
}

export function isLockedOut(user: { lockedUntil: Date | null }, now = new Date()): boolean {
  return user.lockedUntil !== null && user.lockedUntil > now;
}

export function nextLockoutState(user: { failedAttempts: number }, now = new Date()) {
  const failedAttempts = user.failedAttempts + 1;
  const lockedUntil =
    failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null;
  return { failedAttempts, lockedUntil };
}
