/** Aperçu texte du message WhatsApp déjà interpolé, affiché avant l'envoi —
 * WhatsApp n'offre aucune confirmation programmatique une fois le lien
 * ouvert, l'aperçu évite d'envoyer un message mal formé sans s'en rendre
 * compte. */
export function WhatsappMessagePreview({ message }: { message: string }) {
  return <p className="bg-muted rounded-lg p-3 text-sm">{message}</p>;
}
