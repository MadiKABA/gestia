import { ValidationError } from "@/domain/shared/errors";

export const IMAGE_ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageMimeType = (typeof IMAGE_ALLOWED_MIME_TYPES)[number];

function hasBytesAt(content: Uint8Array, offset: number, signature: readonly number[]): boolean {
  return signature.every((byte, i) => content[offset + i] === byte);
}

/**
 * Détecte le format réel à partir des premiers octets (magic bytes) — jamais
 * du `mimeType` déclaré par le client, falsifiable (ex. un fichier renommé
 * avec un en-tête `Content-Type` arbitraire dans une requête construite hors
 * navigateur). PNG : `89 50 4E 47`. JPEG : `FF D8 FF`. WEBP : `RIFF` (octets
 * 0-3) suivi de `WEBP` (octets 8-11, entre les deux vit la taille du chunk).
 *
 * Partagé entre le logo boutique (`domain/tenant-settings/logo-file.ts`) et
 * la photo produit (`domain/product/product-photo.ts`) : même règle, seule
 * la taille maximale autorisée diffère entre les deux appelants.
 */
export function detectImageMimeType(content: Uint8Array): ImageMimeType | null {
  if (hasBytesAt(content, 0, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (hasBytesAt(content, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    hasBytesAt(content, 0, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytesAt(content, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  return null;
}

export function validateImageFile(
  file: { mimeType: string; sizeBytes: number; content: Uint8Array },
  maxSizeBytes: number,
  tooLargeMessage: string,
): void {
  if (!(IMAGE_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimeType)) {
    throw new ValidationError("Format d'image non supporté (PNG, JPEG ou WEBP uniquement)");
  }
  if (file.sizeBytes > maxSizeBytes) {
    throw new ValidationError(tooLargeMessage);
  }
  if (detectImageMimeType(file.content) !== file.mimeType) {
    throw new ValidationError("Le contenu du fichier ne correspond pas à une image valide");
  }
}
