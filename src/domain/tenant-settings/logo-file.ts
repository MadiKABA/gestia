import { IMAGE_ALLOWED_MIME_TYPES, validateImageFile } from "@/domain/shared/image-file";

export const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
export const LOGO_ALLOWED_MIME_TYPES = IMAGE_ALLOWED_MIME_TYPES;

export function validateLogoFile(file: {
  mimeType: string;
  sizeBytes: number;
  content: Uint8Array;
}): void {
  validateImageFile(file, LOGO_MAX_SIZE_BYTES, "Le logo ne doit pas dépasser 2 Mo");
}
