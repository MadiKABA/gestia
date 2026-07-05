import type { OtpPurpose } from "@/domain/auth/otp";

export type OtpCode = {
  id: string;
  phone: string;
  codeHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type AuthUser = {
  id: string;
  tenantId: string;
  phone: string;
  pinHash: string;
  role: "PATRON" | "VENDEUR";
  active: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
};

/** Implémenté par src/infrastructure/auth/auth.repository.ts. */
export interface AuthRepository {
  findUserByPhone(phone: string): Promise<AuthUser | null>;
  createTenantWithPatron(input: {
    tenantName: string;
    patronName: string;
    phone: string;
    pinHash: string;
  }): Promise<AuthUser>;
  createVendeur(input: {
    tenantId: string;
    name: string;
    phone: string;
    placeholderPinHash: string;
  }): Promise<AuthUser>;
  updatePinHash(userId: string, pinHash: string): Promise<void>;

  createOtp(input: {
    phone: string;
    codeHash: string;
    purpose: OtpPurpose;
    expiresAt: Date;
  }): Promise<void>;
  findActiveOtp(phone: string, purpose: OtpPurpose): Promise<OtpCode | null>;
  consumeOtp(id: string): Promise<void>;
}
