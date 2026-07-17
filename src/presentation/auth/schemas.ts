import { z } from "zod";
import { validatePhoneFormat } from "@/domain/shared/phone";
import { validateEmailFormat } from "@/domain/auth/email";
import { validatePinFormat } from "@/domain/auth/pin-policy";
import { OTP_LENGTH } from "@/domain/auth/otp";
import { BUSINESS_TYPE_CODES, DEFAULT_BUSINESS_TYPE } from "@/domain/tenant/business-type";

/** Bornes de validation des formulaires — s'appuient sur les règles domain
 * (phone/email/pin) pour ne jamais dupliquer le format attendu côté serveur. */
const phoneField = z.string().refine(
  (value) => {
    try {
      validatePhoneFormat(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Le numéro de téléphone doit être au format international (+221...)" },
);

const emailField = z.string().refine(
  (value) => {
    try {
      validateEmailFormat(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "L'adresse email n'est pas valide" },
);

const pinField = z.string().refine(
  (value) => {
    try {
      validatePinFormat(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Le PIN doit contenir exactement 4 chiffres" },
);

const otpField = z
  .string()
  .length(OTP_LENGTH, `Le code doit contenir ${OTP_LENGTH} chiffres`)
  .regex(/^\d+$/, "Le code ne doit contenir que des chiffres");

export const requestRegistrationOtpSchema = z.object({ phone: phoneField });
export type RequestRegistrationOtpInput = z.infer<typeof requestRegistrationOtpSchema>;

export const confirmRegistrationSchema = z.object({
  phone: phoneField,
  otp: otpField,
  pin: pinField,
  tenantName: z.string().trim().min(2, "Le nom de la boutique est requis"),
  patronName: z.string().trim().min(2, "Votre nom est requis"),
  email: emailField.optional(),
  businessType: z.enum(BUSINESS_TYPE_CODES).default(DEFAULT_BUSINESS_TYPE),
});
export type ConfirmRegistrationInput = z.infer<typeof confirmRegistrationSchema>;

/** Téléphone prioritaire, email un second identifiant possible — même PIN,
 * jamais de mot de passe distinct (cahier des charges §4). */
export const loginSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("PHONE"), identifier: phoneField, pin: pinField }),
  z.object({ channel: z.literal("EMAIL"), identifier: emailField, pin: pinField }),
]);
export type LoginInput = z.infer<typeof loginSchema>;

export const requestPinResetSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("PHONE"), identifier: phoneField }),
  z.object({ channel: z.literal("EMAIL"), identifier: emailField }),
]);
export type RequestPinResetInput = z.infer<typeof requestPinResetSchema>;

export const confirmPinResetSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("PHONE"),
    identifier: phoneField,
    otp: otpField,
    newPin: pinField,
  }),
  z.object({
    channel: z.literal("EMAIL"),
    identifier: emailField,
    otp: otpField,
    newPin: pinField,
  }),
]);
export type ConfirmPinResetInput = z.infer<typeof confirmPinResetSchema>;

export const inviteVendeurSchema = z.object({
  name: z.string().trim().min(2, "Le nom du vendeur est requis"),
  phone: phoneField,
});
export type InviteVendeurInput = z.infer<typeof inviteVendeurSchema>;

export const deactivateVendeurSchema = z.object({
  vendeurId: z.string().min(1),
});
export type DeactivateVendeurInput = z.infer<typeof deactivateVendeurSchema>;

export const reactivateVendeurSchema = z.object({
  vendeurId: z.string().min(1),
});
export type ReactivateVendeurInput = z.infer<typeof reactivateVendeurSchema>;

/** Pas de champ `phone` : le téléphone n'est jamais modifiable via ce chemin
 * (voir update-vendeur.use-case.ts). */
export const updateVendeurSchema = z.object({
  vendeurId: z.string().min(1),
  name: z.string().trim().min(2, "Le nom du vendeur est requis"),
});
export type UpdateVendeurInput = z.infer<typeof updateVendeurSchema>;
