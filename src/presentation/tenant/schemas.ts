import { z } from "zod";
import { CURRENCY_CODES } from "@/config/currencies";

/**
 * `logoUrl` n'apparaît jamais ici : seul `uploadTenantLogoAction` (Cloudinary)
 * peut le renseigner, jamais saisi à la main par le patron via ce formulaire.
 * La contrainte "brandColor dans les presets" reste dans le domain, pas
 * dupliquée ici en Zod (cf. commentaire de schema.prisma : "contrôlé côté
 * application, pas en DB") — `currency` est en revanche un enum Prisma
 * strict (contrairement à `brandColor`, toujours un `String?` libre), donc
 * validé ici aussi pour rejeter une valeur hors liste avant d'atteindre le
 * domain/la base.
 */
export const updateTenantSettingsSchema = z.object({
  displayName: z.string().trim().min(1).optional().nullable(),
  currency: z.enum(CURRENCY_CODES).optional(),
  reminderDays: z.number().int().optional(),
  whatsappTemplate: z.string().trim().optional().nullable(),
  whatsappReceiptPartialTemplate: z.string().trim().optional().nullable(),
  whatsappReceiptFinalTemplate: z.string().trim().optional().nullable(),
  brandColor: z.string().optional().nullable(),
});

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;
