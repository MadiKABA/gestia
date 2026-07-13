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
import { EmailOtpSender } from "@/infrastructure/auth/email-otp-sender";
import { PrismaAuditLogger } from "@/infrastructure/audit-log/audit-log.repository";
import type { OtpChannel } from "@/domain/auth/otp";
import type { OtpSender } from "@/application/auth/otp-sender";
import { requestRegistrationOtp } from "@/application/auth/request-registration-otp.use-case";
import { confirmRegistration } from "@/application/auth/confirm-registration.use-case";
import { requestPinReset } from "@/application/auth/request-pin-reset.use-case";
import { confirmPinReset } from "@/application/auth/confirm-pin-reset.use-case";
import { inviteVendeur } from "@/application/auth/invite-vendeur.use-case";
import { deactivateVendeur } from "@/application/auth/deactivate-vendeur.use-case";
import { reactivateVendeur } from "@/application/auth/reactivate-vendeur.use-case";
import { updateVendeur } from "@/application/auth/update-vendeur.use-case";
import { listVendeurs } from "@/application/auth/list-vendeurs.use-case";
import { getCurrentUser } from "@/application/auth/get-current-user.use-case";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";
import { checkRateLimit, OTP_REQUEST_IP_RATE_LIMIT } from "@/infrastructure/shared/rate-limiter";
import { authLabels } from "@/presentation/shared/labels";
import {
  confirmPinResetSchema,
  confirmRegistrationSchema,
  deactivateVendeurSchema,
  reactivateVendeurSchema,
  updateVendeurSchema,
  inviteVendeurSchema,
  loginSchema,
  requestPinResetSchema,
  requestRegistrationOtpSchema,
  type ConfirmPinResetInput,
  type ConfirmRegistrationInput,
  type DeactivateVendeurInput,
  type ReactivateVendeurInput,
  type UpdateVendeurInput,
  type InviteVendeurInput,
  type LoginInput,
  type RequestPinResetInput,
  type RequestRegistrationOtpInput,
} from "@/presentation/auth/schemas";

const repository = new PrismaAuthRepository();
const hasher = new Argon2Hasher();
const smsOtpSender = new SmsOtpSender();
const emailOtpSender = new EmailOtpSender();
const auditLogger = new PrismaAuditLogger();

/** Le téléphone reste le canal par défaut (inscription, invitation vendeur) ;
 * l'email n'est utilisé que là où l'utilisateur l'a explicitement choisi. */
function otpSenderFor(channel: OtpChannel): OtpSender {
  return channel === "EMAIL" ? emailOtpSender : smsOtpSender;
}

/** Résultat d'une demande d'OTP : les refus métier (rate limiting, numéro déjà
 * pris...) sont une issue normale du flux, pas une exception serveur. */
export type RequestOtpResult = { success: true } | { success: false; error: string };

const OTP_IP_RATE_LIMIT_MESSAGE = "Trop de demandes depuis cette connexion. Réessayez plus tard.";

/** Meilleure IP disponible pour le rate limiting par IP des demandes d'OTP —
 * voir le commentaire sur OTP_REQUEST_IP_RATE_LIMIT (rate-limiter.ts) pour
 * l'hypothèse de confiance sur ce header. */
async function clientIpKey(): Promise<string> {
  const forwardedFor = (await headers()).get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function requestRegistrationOtpAction(
  input: RequestRegistrationOtpInput,
): Promise<RequestOtpResult> {
  const { phone } = requestRegistrationOtpSchema.parse(input);

  const ip = await clientIpKey();
  if (!checkRateLimit(`otp-request:${ip}`, OTP_REQUEST_IP_RATE_LIMIT)) {
    return { success: false, error: OTP_IP_RATE_LIMIT_MESSAGE };
  }

  try {
    await requestRegistrationOtp({ repository, otpSender: smsOtpSender, hasher }, { phone });
    return { success: true };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/** Adapte `requestRegistrationOtpAction` à la forme générique attendue par
 * `RequestOtpForm` (channel/identifier) — l'inscription reste 100% téléphone,
 * `channel` n'est ici jamais "EMAIL". Doit être une Server Action à part
 * entière (pas une closure inline dans un Server Component) : Next.js ne peut
 * pas sérialiser une fonction non marquée `"use server"` vers un Client
 * Component. */
export async function requestRegistrationOtpFromIdentifierAction(input: {
  channel: "PHONE" | "EMAIL";
  identifier: string;
}): Promise<RequestOtpResult> {
  return requestRegistrationOtpAction({ phone: input.identifier });
}

export async function confirmRegistrationAction(input: ConfirmRegistrationInput) {
  const { phone, otp, pin, tenantName, patronName, email } = confirmRegistrationSchema.parse(input);
  await confirmRegistration(
    { repository, hasher, auditLogger },
    { phone, otp, pin, tenantName, patronName, email },
  );

  // Le patron vient de définir son PIN dans ce même formulaire : on le connecte
  // directement plutôt que de lui faire ressaisir son PIN sur l'écran de
  // connexion (cahier des charges §9 : connexion < 5 s).
  await auth.api.signInPin({ body: { channel: "PHONE", identifier: phone, pin } });
  redirect("/dashboard");
}

export async function loginAction(input: LoginInput) {
  const { channel, identifier, pin } = loginSchema.parse(input);

  try {
    await auth.api.signInPin({ body: { channel, identifier, pin } });
  } catch (error) {
    if (error instanceof APIError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }

  redirect("/dashboard");
}

export async function requestPinResetAction(
  input: RequestPinResetInput,
): Promise<RequestOtpResult> {
  const { channel, identifier } = requestPinResetSchema.parse(input);

  const ip = await clientIpKey();
  if (!checkRateLimit(`otp-request:${ip}`, OTP_REQUEST_IP_RATE_LIMIT)) {
    return { success: false, error: OTP_IP_RATE_LIMIT_MESSAGE };
  }

  try {
    await requestPinReset(
      { repository, otpSender: otpSenderFor(channel), hasher },
      { channel, identifier },
    );
    return { success: true };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

export async function confirmPinResetAction(input: ConfirmPinResetInput) {
  const { channel, identifier, otp, newPin } = confirmPinResetSchema.parse(input);
  await confirmPinReset({ repository, hasher, auditLogger }, { channel, identifier, otp, newPin });
}

export async function inviteVendeurAction(input: InviteVendeurInput) {
  const context = await requirePatron();
  const { name, phone } = inviteVendeurSchema.parse(input);

  await inviteVendeur(
    context,
    { repository, otpSender: smsOtpSender, hasher, auditLogger },
    { name, phone },
  );
  revalidatePath("/vendeurs");
}

export async function deactivateVendeurAction(input: DeactivateVendeurInput) {
  const context = await requirePatron();
  const { vendeurId } = deactivateVendeurSchema.parse(input);

  try {
    await deactivateVendeur(context, { repository, auditLogger }, { vendeurId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new Error(authLabels.vendeurNotFoundMessage);
    }
    throw error;
  }
  revalidatePath("/vendeurs");
}

export async function reactivateVendeurAction(input: ReactivateVendeurInput) {
  const context = await requirePatron();
  const { vendeurId } = reactivateVendeurSchema.parse(input);

  try {
    await reactivateVendeur(context, { repository, auditLogger }, { vendeurId });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new Error(authLabels.vendeurNotFoundMessage);
    }
    throw error;
  }
  revalidatePath("/vendeurs");
}

export async function updateVendeurAction(input: UpdateVendeurInput) {
  const context = await requirePatron();
  const { vendeurId, name } = updateVendeurSchema.parse(input);

  try {
    await updateVendeur(context, { repository, auditLogger }, { vendeurId, name });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new Error(authLabels.vendeurNotFoundMessage);
    }
    throw error;
  }
  revalidatePath("/vendeurs");
}

export async function listVendeursAction() {
  const context = await requireTenantContext();
  return listVendeurs(context, { repository });
}

export async function getCurrentUserAction() {
  const context = await requireTenantContext();
  return getCurrentUser(context, { repository });
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
