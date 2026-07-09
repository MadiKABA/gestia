import type { OtpChannel, OtpPurpose } from "@/domain/auth/otp";

export type OtpCode = {
  id: string;
  identifier: string;
  channel: OtpChannel;
  codeHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  pinHash: string;
  email: string | null;
  image: string | null;
  role: "PATRON" | "VENDEUR";
  active: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
};

/** Implémenté par src/infrastructure/auth/auth.repository.ts. */
export interface AuthRepository {
  findUserByPhone(phone: string): Promise<AuthUser | null>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  createTenantWithPatron(input: {
    tenantName: string;
    patronName: string;
    phone: string;
    pinHash: string;
    email?: string;
  }): Promise<AuthUser>;
  createVendeur(input: {
    tenantId: string;
    name: string;
    phone: string;
    placeholderPinHash: string;
  }): Promise<AuthUser>;
  updatePinHash(userId: string, pinHash: string): Promise<void>;
  recordFailedLogin(
    userId: string,
    state: { failedAttempts: number; lockedUntil: Date | null },
  ): Promise<void>;
  clearLockout(userId: string): Promise<void>;
  setActive(userId: string, active: boolean): Promise<void>;
  listVendeursByTenant(tenantId: string): Promise<AuthUser[]>;

  createOtp(input: {
    identifier: string;
    channel: OtpChannel;
    codeHash: string;
    purpose: OtpPurpose;
    expiresAt: Date;
  }): Promise<void>;
  findActiveOtp(identifier: string, purpose: OtpPurpose): Promise<OtpCode | null>;
  consumeOtp(id: string): Promise<void>;
  findRecentOtpRequestTimestamps(
    identifier: string,
    purpose: OtpPurpose,
    since: Date,
  ): Promise<Date[]>;
}
