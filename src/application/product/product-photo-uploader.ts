/** Port applicatif — implémenté par CloudinaryProductPhotoUploader
 * (infrastructure/external/cloudinary-client.ts). `productId` (contrairement
 * à LogoUploader, un seul logo par tenant) scope le `public_id` Cloudinary :
 * plusieurs produits par tenant, chacun garde sa propre image. */
export interface ProductPhotoUploader {
  upload(
    file: { buffer: Buffer; mimeType: string },
    tenantId: string,
    productId: string,
  ): Promise<{ url: string }>;
}
