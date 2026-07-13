import { z } from "zod";
import { validatePartyInput, type PartyInput } from "@/domain/party/party.entity";
import { ValidationError } from "@/domain/shared/errors";

/**
 * Schéma du payload de mutation Party tel qu'il transite réellement dans la
 * queue de sync — la forme domaine `PartyInput` (`phone`/`whatsappNumber` en
 * `string | null`), pas la forme formulaire de partyInputSchema
 * (presentation/party/schemas.ts, chaînes vides) : party-form.tsx convertit
 * déjà via toPartyInput avant d'appeler repository.create/update, donc ce
 * qui arrive ici est toujours la forme domaine. Même règle métier que le
 * formulaire (délégation à validatePartyInput, jamais dupliquée) : c'est le
 * même contrat, juste sur l'autre forme des mêmes données.
 *
 * Longueurs plafonnées (200/1000) : ces champs texte libre transitent par la
 * queue de sync sans limite HTML native (contrairement à un champ de
 * formulaire) — évite qu'une valeur arbitrairement longue dégrade le
 * stockage, cohérent avec le plafond déjà appliqué aux templates WhatsApp
 * (WHATSAPP_TEMPLATE_MAX_LENGTH, tenant-settings.entity.ts).
 */
export const partySyncPayloadSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().nullable().optional(),
    whatsappNumber: z.string().trim().nullable().optional(),
    type: z.enum(["CLIENT", "SUPPLIER", "BOTH"]),
    isCompany: z.boolean().optional(),
    companyName: z.string().trim().max(200).nullable().optional(),
    contactName: z.string().trim().max(200).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .superRefine((input, ctx) => {
    try {
      validatePartyInput(input as PartyInput);
    } catch (error) {
      if (error instanceof ValidationError) {
        ctx.addIssue({ code: "custom", message: error.message, path: ["phone"] });
      }
    }
  });
