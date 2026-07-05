import { ValidationError } from "@/domain/shared/errors";

export type PartyType = "CLIENT" | "SUPPLIER" | "BOTH";

export type Party = {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  whatsappNumber: string | null;
  type: PartyType;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PartyInput = {
  name: string;
  phone?: string | null;
  whatsappNumber?: string | null;
  type: PartyType;
  note?: string | null;
};

/**
 * Règles métier pures (cahier des charges §7) :
 * - nom + téléphone minimum pour identifier un tiers
 */
export function validatePartyInput(input: PartyInput): void {
  if (!input.name.trim()) {
    throw new ValidationError("Le nom du tiers est obligatoire");
  }
  if (!input.phone?.trim()) {
    throw new ValidationError("Le téléphone du tiers est obligatoire");
  }
}
