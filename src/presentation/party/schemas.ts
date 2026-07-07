import { z } from "zod";
import { validatePartyInput } from "@/domain/party/party.entity";
import { ValidationError } from "@/domain/shared/errors";
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

export const partySearchSchema = z.object({
  search: z.string().trim().optional(),
  type: z.enum(["CLIENT", "SUPPLIER", "BOTH"]).optional(),
});
export type PartySearchInput = z.infer<typeof partySearchSchema>;
