import { describe, expect, it } from "vitest";
import {
  MAX_FAILED_ATTEMPTS,
  isLockedOut,
  nextLockoutState,
  validatePinFormat,
} from "@/domain/auth/pin-policy";
import { ValidationError } from "@/domain/shared/errors";

describe("validatePinFormat", () => {
  it("accepte un PIN à 4 chiffres", () => {
    expect(() => validatePinFormat("1234")).not.toThrow();
  });

  it("rejette un PIN de mauvaise longueur ou non numérique", () => {
    expect(() => validatePinFormat("123")).toThrow(ValidationError);
    expect(() => validatePinFormat("12a4")).toThrow(ValidationError);
  });
});

describe("isLockedOut", () => {
  it("n'est pas verrouillé sans lockedUntil", () => {
    expect(isLockedOut({ lockedUntil: null })).toBe(false);
  });

  it("est verrouillé si lockedUntil est dans le futur", () => {
    expect(isLockedOut({ lockedUntil: new Date(Date.now() + 60_000) })).toBe(true);
  });

  it("n'est plus verrouillé si lockedUntil est dans le passé", () => {
    expect(isLockedOut({ lockedUntil: new Date(Date.now() - 60_000) })).toBe(false);
  });
});

describe("nextLockoutState", () => {
  it("incrémente les tentatives sans verrouiller avant le seuil", () => {
    const state = nextLockoutState({ failedAttempts: 0 });
    expect(state.failedAttempts).toBe(1);
    expect(state.lockedUntil).toBeNull();
  });

  it("verrouille au seuil de tentatives échouées", () => {
    const state = nextLockoutState({ failedAttempts: MAX_FAILED_ATTEMPTS - 1 });
    expect(state.failedAttempts).toBe(MAX_FAILED_ATTEMPTS);
    expect(state.lockedUntil).not.toBeNull();
  });
});
