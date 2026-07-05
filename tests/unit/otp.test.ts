import { describe, expect, it } from "vitest";
import {
  OTP_REQUEST_COOLDOWN_MS,
  OTP_REQUEST_MAX_PER_WINDOW,
  assertOtpRequestAllowed,
  isOtpExpired,
} from "@/domain/auth/otp";
import { ValidationError } from "@/domain/shared/errors";

describe("isOtpExpired", () => {
  it("n'est pas expiré avant expiresAt", () => {
    expect(isOtpExpired({ expiresAt: new Date(Date.now() + 60_000) })).toBe(false);
  });

  it("est expiré après expiresAt", () => {
    expect(isOtpExpired({ expiresAt: new Date(Date.now() - 1) })).toBe(true);
  });
});

describe("assertOtpRequestAllowed", () => {
  it("autorise une première demande sans historique", () => {
    expect(() => assertOtpRequestAllowed([])).not.toThrow();
  });

  it("rejette une nouvelle demande pendant le cooldown", () => {
    const now = new Date();
    const lastRequest = new Date(now.getTime() - OTP_REQUEST_COOLDOWN_MS / 2);
    expect(() => assertOtpRequestAllowed([lastRequest], now)).toThrow(ValidationError);
  });

  it("autorise une nouvelle demande une fois le cooldown écoulé", () => {
    const now = new Date();
    const lastRequest = new Date(now.getTime() - OTP_REQUEST_COOLDOWN_MS - 1);
    expect(() => assertOtpRequestAllowed([lastRequest], now)).not.toThrow();
  });

  it("rejette au-delà du plafond sur la fenêtre glissante", () => {
    const now = new Date();
    const requests = Array.from(
      { length: OTP_REQUEST_MAX_PER_WINDOW },
      (_, i) => new Date(now.getTime() - OTP_REQUEST_COOLDOWN_MS * 2 * (i + 1)),
    );
    expect(() => assertOtpRequestAllowed(requests, now)).toThrow(ValidationError);
  });
});
