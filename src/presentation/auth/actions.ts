"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { auth } from "@/infrastructure/auth/better-auth";
import { requireTenantContext } from "@/infrastructure/auth/session";
import { requirePatron } from "@/presentation/auth/require-role";
import { PrismaAuthRepository } from "@/infrastructure/auth/auth.repository";
import { Argon2Hasher } from "@/infrastructure/auth/argon2-hasher";
import { SmsOtpSender } from "@/infrastructure/auth/sms-otp-sender";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import { requestRegistrationOtp } from "@/application/auth/request-registration-otp.use-case";
import { confirmRegistration } from "@/application/auth/confirm-registration.use-case";
import { requestPinReset } from "@/application/auth/request-pin-reset.use-case";
import { confirmPinReset } from "@/application/auth/confirm-pin-reset.use-case";
import { inviteVendeur } from "@/application/auth/invite-vendeur.use-case";
import { deactivateVendeur } from "@/application/auth/deactivate-vendeur.use-case";
import { listVendeurs } from "@/application/auth/list-vendeurs.use-case";
import { ValidationError } from "@/domain/shared/errors";
import {
  confirmPinResetSchema,
  confirmRegistrationSchema,
  deactivateVendeurSchema,
  inviteVendeurSchema,
  loginSchema,
  requestPinResetSchema,
  requestRegistrationOtpSchema,
  type ConfirmPinResetInput,
  type ConfirmRegistrationInput,
  type DeactivateVendeurInput,
  type InviteVendeurInput,
  type LoginInput,
  type RequestPinResetInput,
  type RequestRegistrationOtpInput,
} from "@/presentation/auth/schemas";

const repository = new PrismaAuthRepository();
const hasher = new Argon2Hasher();
const otpSender = new SmsOtpSender();
const auditLogger = new PrismaAuditLogger();

export async function requestRegistrationOtpAction(input: RequestRegistrationOtpInput) {
  const { phone } = requestRegistrationOtpSchema.parse(input);
  await requestRegistrationOtp({ repository, otpSender, hasher }, { phone });
}

export async function confirmRegistrationAction(input: ConfirmRegistrationInput) {
  const { phone, otp, pin, tenantName, patronName } = confirmRegistrationSchema.parse(input);
  await confirmRegistration(
    { repository, hasher, auditLogger },
    { phone, otp, pin, tenantName, patronName },
  );

  // Le patron vient de définir son PIN dans ce même formulaire : on le connecte
  // directement plutôt que de lui faire ressaisir son PIN sur l'écran de
  // connexion (cahier des charges §9 : connexion < 5 s).
  await auth.api.signInPin({ body: { phone, pin } });
  redirect("/");
}

export async function loginAction(input: LoginInput) {
  const { phone, pin } = loginSchema.parse(input);

  try {
    await auth.api.signInPin({ body: { phone, pin } });
  } catch (error) {
    if (error instanceof APIError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }

  redirect("/");
}

export async function requestPinResetAction(input: RequestPinResetInput) {
  const { phone } = requestPinResetSchema.parse(input);
  await requestPinReset({ repository, otpSender, hasher }, { phone });
}

export async function confirmPinResetAction(input: ConfirmPinResetInput) {
  const { phone, otp, newPin } = confirmPinResetSchema.parse(input);
  await confirmPinReset({ repository, hasher, auditLogger }, { phone, otp, newPin });
}

export async function inviteVendeurAction(input: InviteVendeurInput) {
  const context = await requirePatron();
  const { name, phone } = inviteVendeurSchema.parse(input);

  await inviteVendeur(context, { repository, otpSender, hasher, auditLogger }, { name, phone });
  revalidatePath("/vendeurs");
}

export async function deactivateVendeurAction(input: DeactivateVendeurInput) {
  const context = await requirePatron();
  const { vendeurId } = deactivateVendeurSchema.parse(input);

  await deactivateVendeur(context, { repository, auditLogger }, { vendeurId });
  revalidatePath("/vendeurs");
}

export async function listVendeursAction() {
  const context = await requireTenantContext();
  return listVendeurs(context, { repository });
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
