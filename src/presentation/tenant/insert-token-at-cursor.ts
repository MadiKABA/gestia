/** Insère `{token}` à la position du curseur (ou remplace la sélection) dans
 * un texte de gabarit — logique pure partagée par les 3 champs de gabarit
 * WhatsApp des Paramètres, voir `whatsapp-variable-badges.tsx`. */
export function insertTokenAtCursor(
  current: string,
  token: string,
  selectionStart: number,
  selectionEnd: number,
): { value: string; cursor: number } {
  const placeholder = `{${token}}`;
  const value = current.slice(0, selectionStart) + placeholder + current.slice(selectionEnd);
  return { value, cursor: selectionStart + placeholder.length };
}
