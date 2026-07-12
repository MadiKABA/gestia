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

/** Le compte doit être verrouillé une fois `failedAttempts` (déjà incrémenté
 * de façon atomique côté base, voir `AuthRepository.incrementFailedAttempts`)
 * au seuil — jamais calculé à partir d'une valeur lue en mémoire, pour éviter
 * le lost update qu'un `read-then-write` provoquerait sous requêtes
 * concurrentes (plusieurs tentatives de login en parallèle liraient toutes le
 * même compteur avant qu'aucune ne l'incrémente). */
export function isLockoutThresholdReached(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_ATTEMPTS;
}

export function computeLockoutExpiry(now = new Date()): Date {
  return new Date(now.getTime() + LOCKOUT_DURATION_MS);
}
