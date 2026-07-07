import { env } from "@/lib/env";

const API_URL = "https://api.sandbox.africastalking.com/version1/messaging";

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

  console.log("AT_USERNAME:", JSON.stringify(env.AFRICASTALKING_USERNAME));
  console.log("AT_API_KEY length:", env.AFRICASTALKING_API_KEY.length);
  console.log(
    "AT_API_KEY starts/ends:",
    env.AFRICASTALKING_API_KEY.slice(0, 6),
    "...",
    env.AFRICASTALKING_API_KEY.slice(-4),
  );

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
    const errorBody = await response.text();
    throw new Error(`Échec de l'envoi SMS Africa's Talking (${response.status}): ${errorBody}`);
  }
}
