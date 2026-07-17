import { IMAGE_ALLOWED_MIME_TYPES, validateImageFile } from "@/domain/shared/image-file";

/**
 * Même plafond que `serverActions.bodySizeLimit` (next.config.ts) — la photo
 * produit transite en base64 dans le payload de mutation (upload différé
 * hors ligne, voir product-mutation-handler.ts), jamais un plafond distinct
 * inventé pour ce module.
 */
export const PRODUCT_PHOTO_MAX_SIZE_BYTES = 3 * 1024 * 1024;
export const PRODUCT_PHOTO_ALLOWED_MIME_TYPES = IMAGE_ALLOWED_MIME_TYPES;

export function validateProductPhotoFile(file: {
  mimeType: string;
  sizeBytes: number;
  content: Uint8Array;
}): void {
  validateImageFile(file, PRODUCT_PHOTO_MAX_SIZE_BYTES, "La photo ne doit pas dépasser 3 Mo");
}
