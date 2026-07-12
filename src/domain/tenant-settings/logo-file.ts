import { ValidationError } from "@/domain/shared/errors";

export const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
export const LOGO_ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function validateLogoFile(file: { mimeType: string; sizeBytes: number }): void {
  if (!(LOGO_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimeType)) {
    throw new ValidationError("Format d'image non supporté (PNG, JPEG ou WEBP uniquement)");
  }
  if (file.sizeBytes > LOGO_MAX_SIZE_BYTES) {
    throw new ValidationError("Le logo ne doit pas dépasser 2 Mo");
  }
}
