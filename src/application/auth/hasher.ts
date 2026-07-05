/**
 * Hash générique (Argon2 — cahier des charges §4), utilisé pour le PIN comme
 * pour les codes OTP. Implémenté par src/infrastructure/auth/argon2-hasher.ts.
 */
export interface Hasher {
  hash(value: string): Promise<string>;
  verify(hash: string, value: string): Promise<boolean>;
}
