import { ValidationError } from "@/domain/shared/errors";

export type PartyType = "CLIENT" | "SUPPLIER" | "BOTH";

export type Party = {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  whatsappNumber: string | null;
  type: PartyType;
  isCompany: boolean;
  companyName: string | null;
  contactName: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PartyInput = {
  name: string;
  phone?: string | null;
  whatsappNumber?: string | null;
  type: PartyType;
  isCompany?: boolean;
  companyName?: string | null;
  contactName?: string | null;
  note?: string | null;
};

/**
 * Règles métier pures (cahier des charges §7) :
 * - nom obligatoire
 * - au moins un moyen de contact (téléphone OU whatsapp) — pas obligatoirement
 *   les deux
 * - companyName reste recommandé mais non bloquant quand isCompany est coché
 *   (décrit comme une "case entreprise optionnelle" au cahier des charges)
 */
export function validatePartyInput(input: PartyInput): void {
  if (!input.name.trim()) {
    throw new ValidationError("Le nom du tiers est obligatoire");
  }
  if (!input.phone?.trim() && !input.whatsappNumber?.trim()) {
    throw new ValidationError("Un moyen de contact (téléphone ou WhatsApp) est obligatoire");
  }
}
