/**
 * Lien de première connexion d'un vendeur invité (cahier des charges §4) —
 * pointe vers /premiere-connexion?phone=..., qui saute l'étape "recevoir un
 * code" (déjà envoyé au moment de l'invitation, voir invite-vendeur.use-case.ts).
 * Fonction pure, sans dépendance à `next`/`env` : appelée à la fois côté
 * serveur (sms-otp-sender.ts, avec `env.NEXT_PUBLIC_APP_URL`) et côté client
 * (vendeurs-panel.tsx, avec `process.env.NEXT_PUBLIC_APP_URL`, seule forme
 * que le bundler Next.js sait remplacer en statique dans un composant client)
 * — jamais dupliquée entre les deux pour éviter toute divergence.
 */
export function buildPremiereConnexionLink(baseUrl: string, phone: string): string {
  return `${baseUrl}/premiere-connexion?phone=${encodeURIComponent(phone)}`;
}
