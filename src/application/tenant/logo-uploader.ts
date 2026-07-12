/** Port applicatif — implémenté par CloudinaryLogoUploader
 * (infrastructure/external/cloudinary-client.ts). */
export interface LogoUploader {
  upload(file: { buffer: Buffer; mimeType: string }, tenantId: string): Promise<{ url: string }>;
}
