import { describe, expect, it } from "vitest";
import {
  MAX_FAILED_ATTEMPTS,
  computeLockoutExpiry,
  isLockedOut,
  isLockoutThresholdReached,
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

describe("isLockoutThresholdReached", () => {
  it("ne verrouille pas avant le seuil", () => {
    expect(isLockoutThresholdReached(MAX_FAILED_ATTEMPTS - 1)).toBe(false);
  });

  it("verrouille au seuil de tentatives échouées", () => {
    expect(isLockoutThresholdReached(MAX_FAILED_ATTEMPTS)).toBe(true);
  });

  it("reste verrouillé au-delà du seuil", () => {
    expect(isLockoutThresholdReached(MAX_FAILED_ATTEMPTS + 5)).toBe(true);
  });
});

describe("computeLockoutExpiry", () => {
  it("retourne une date dans le futur par rapport à `now`", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiry = computeLockoutExpiry(now);
    expect(expiry.getTime()).toBeGreaterThan(now.getTime());
  });
});
