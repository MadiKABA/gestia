import { ValidationError } from "@/domain/shared/errors";
import { normalizePhoneToE164, validatePhoneFormat } from "@/domain/shared/phone";

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
  if (input.phone?.trim()) {
    validatePhoneFormat(input.phone.trim());
  }
  if (input.whatsappNumber?.trim()) {
    validatePhoneFormat(input.whatsappNumber.trim());
  }
}

/** Filet de sécurité avant persistance : normalise `phone`/`whatsappNumber`
 * au format E.164 (`+221771234567`), format déjà stocké en base. À appeler
 * uniquement après un `validatePartyInput` réussi. */
export function normalizePartyInput(input: PartyInput): PartyInput {
  return {
    ...input,
    phone: input.phone?.trim() ? normalizePhoneToE164(input.phone.trim()) : input.phone,
    whatsappNumber: input.whatsappNumber?.trim()
      ? normalizePhoneToE164(input.whatsappNumber.trim())
      : input.whatsappNumber,
  };
}
