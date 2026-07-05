import { ValidationError } from "@/domain/shared/errors";

export type PartyType = "CLIENT" | "SUPPLIER" | "BOTH";

export type Party = {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  type: PartyType;
  isCompany: boolean;
  companyName: string | null;
  contactName: string | null;
  note: string | null;
  createdAt: Date;
};

export type PartyInput = {
  name: string;
  phone?: string | null;
  type: PartyType;
  isCompany?: boolean;
  companyName?: string | null;
  contactName?: string | null;
  note?: string | null;
};

/**
 * Règles métier pures (cahier des charges §7) :
 * - nom + téléphone minimum pour identifier un tiers
 * - si "entreprise", une raison sociale est obligatoire
 */
export function validatePartyInput(input: PartyInput): void {
  if (!input.name.trim()) {
    throw new ValidationError("Le nom du tiers est obligatoire");
  }
  if (!input.phone?.trim()) {
    throw new ValidationError("Le téléphone du tiers est obligatoire");
  }
  if (input.isCompany && !input.companyName?.trim()) {
    throw new ValidationError("La raison sociale est obligatoire pour un tiers entreprise");
  }
}
