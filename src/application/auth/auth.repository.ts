import type { OtpChannel, OtpPurpose } from "@/domain/auth/otp";

export type OtpCode = {
  id: string;
  identifier: string;
  channel: OtpChannel;
  codeHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
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
  createdAt: Date;
  firstLoginAt: Date | null;
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
  /** Nom uniquement — le téléphone (identifiant de connexion) n'est jamais
   * modifiable via cette méthode, voir update-vendeur.use-case.ts. */
  updateName(userId: string, name: string): Promise<void>;
  /** Incrémente atomiquement le compteur d'échecs côté base
   * (`UPDATE ... SET failedAttempts = failedAttempts + 1`) — jamais un
   * read-then-write applicatif, pour rester correct sous tentatives de login
   * concurrentes. Retourne le compteur à jour pour que l'appelant décide du
   * verrouillage (`isLockoutThresholdReached`). */
  incrementFailedAttempts(
    userId: string,
  ): Promise<{ failedAttempts: number; lockedUntil: Date | null }>;
  lockAccount(userId: string, lockedUntil: Date): Promise<void>;
  clearLockout(userId: string): Promise<void>;
  setActive(userId: string, active: boolean): Promise<void>;
  listVendeursByTenant(tenantId: string): Promise<AuthUser[]>;
  /** Idempotent : n'écrit que si `firstLoginAt` est encore `null`, quel que
   * soit le flux appelant (premier PIN vendeur invité ou reset PIN ultérieur
   * — voir confirm-pin-reset.use-case.ts). */
  recordFirstLoginIfUnset(userId: string): Promise<void>;

  createOtp(input: {
    identifier: string;
    channel: OtpChannel;
    codeHash: string;
    purpose: OtpPurpose;
    expiresAt: Date;
  }): Promise<void>;
  findActiveOtp(identifier: string, purpose: OtpPurpose): Promise<OtpCode | null>;
  /** Incrémente atomiquement le compteur d'essais côté base (même pattern
   * que `incrementFailedAttempts`) — retourne le compteur à jour pour que
   * l'appelant décide de l'invalidation (`isOtpAttemptsExceeded`). */
  incrementOtpAttempts(id: string): Promise<{ attempts: number }>;
  /** Compare-and-swap : ne marque consommé que si l'OTP n'est pas déjà
   * consommé (`WHERE consumedAt IS NULL`), et retourne `true` seulement si
   * cet appel a réellement effectué la transition — empêche deux
   * confirmations concurrentes avec le même code de réussir toutes les deux
   * (TOCTOU entre la vérification et la consommation). */
  consumeOtp(id: string): Promise<boolean>;
  findRecentOtpRequestTimestamps(
    identifier: string,
    purpose: OtpPurpose,
    since: Date,
  ): Promise<Date[]>;
}
