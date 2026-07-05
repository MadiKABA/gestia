import { env } from "@/lib/env";

const API_URL = "https://api.africastalking.com/version1/messaging";

/**
 * Client HTTP minimal (fetch natif) contre l'API REST d'Africa's Talking.
 * Volontairement pas de SDK npm : le paquet officiel `africastalking` embarque
 * des dépendances (axios/lodash/joi) avec des failles de sécurité connues.
 */
export async function sendSms(to: string, message: string): Promise<void> {
  const body = new URLSearchParams({
    username: env.AFRICASTALKING_USERNAME,
    to,
    message,
    ...(env.AFRICASTALKING_SENDER_ID ? { from: env.AFRICASTALKING_SENDER_ID } : {}),
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      apiKey: env.AFRICASTALKING_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Échec de l'envoi SMS Africa's Talking (${response.status})`);
  }
}
