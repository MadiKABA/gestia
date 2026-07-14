import { z } from "zod";
import { validatePartyInput, type PartyInput } from "@/domain/party/party.entity";
import { ValidationError } from "@/domain/shared/errors";
import { validatePhoneFormat } from "@/domain/shared/phone";
import { partyLabels } from "@/presentation/shared/labels";

/** Le formulaire délègue la règle de contact (téléphone OU whatsapp) à
 * `validatePartyInput` (domain) via `superRefine` — jamais de duplication de
 * la règle métier côté Zod. */
export const partyInputSchema = z
  .object({
    name: z.string().trim().min(1, partyLabels.nameRequiredError),
    phone: z.string().trim().optional().or(z.literal("")),
    whatsappNumber: z.string().trim().optional().or(z.literal("")),
    type: z.enum(["CLIENT", "SUPPLIER", "BOTH"]),
    isCompany: z.boolean(),
    companyName: z.string().trim().optional().or(z.literal("")),
    contactName: z.string().trim().optional().or(z.literal("")),
    note: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((input, ctx) => {
    // Erreurs de format attachées au bon champ avant la règle croisée
    // ci-dessous, qui ne revalidera donc jamais un format déjà en faute.
    if (input.phone?.trim()) {
      try {
        validatePhoneFormat(input.phone.trim());
      } catch (error) {
        if (error instanceof ValidationError) {
          ctx.addIssue({ code: "custom", message: error.message, path: ["phone"] });
        }
      }
    }
    if (input.whatsappNumber?.trim()) {
      try {
        validatePhoneFormat(input.whatsappNumber.trim());
      } catch (error) {
        if (error instanceof ValidationError) {
          ctx.addIssue({ code: "custom", message: error.message, path: ["whatsappNumber"] });
        }
      }
    }
    try {
      validatePartyInput({
        name: input.name,
        phone: input.phone || null,
        whatsappNumber: input.whatsappNumber || null,
        type: input.type,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        ctx.addIssue({ code: "custom", message: error.message, path: ["phone"] });
      }
    }
  });

export type PartyFormInput = z.infer<typeof partyInputSchema>;

/** Les champs texte optionnels du formulaire arrivent en chaîne vide plutôt
 * qu'`undefined` (contrôle React) — normalisés en `null` pour le domain. */
export function toPartyInput(input: PartyFormInput): PartyInput {
  return {
    name: input.name,
    phone: input.phone || null,
    whatsappNumber: input.whatsappNumber || null,
    type: input.type,
    isCompany: input.isCompany,
    companyName: input.companyName || null,
    contactName: input.contactName || null,
    note: input.note || null,
  };
}

export const partySearchSchema = z.object({
  search: z.string().trim().optional(),
  type: z.enum(["CLIENT", "SUPPLIER", "BOTH"]).optional(),
});
export type PartySearchInput = z.infer<typeof partySearchSchema>;
