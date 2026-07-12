import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";
import type { LogoUploader } from "@/application/tenant/logo-uploader";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * SDK officiel utilisé directement (contrairement à africastalking-client.ts,
 * qui évite le SDK npm pour ses dépendances vulnérables) : `cloudinary` est
 * déjà en dépendance et l'upload signé/multipart serait significativement
 * plus complexe à réimplémenter correctement qu'un simple appel `fetch`.
 */
export class CloudinaryLogoUploader implements LogoUploader {
  async upload(
    file: { buffer: Buffer; mimeType: string },
    tenantId: string,
  ): Promise<{ url: string }> {
    const dataUri = `data:${file.mimeType};base64,${file.buffer.toString("base64")}`;
    try {
      const result = await cloudinary.uploader.upload(dataUri, {
        public_id: "logo",
        // Dossier scopé par tenant + `overwrite: true` : pas de fuite entre
        // tenants et pas d'accumulation de fichiers orphelins facturables à
        // chaque changement de logo.
        folder: `gestia/tenants/${tenantId}`,
        overwrite: true,
        transformation: [{ width: 512, height: 512, crop: "limit" }],
        resource_type: "image",
      });
      return { url: result.secure_url };
    } catch (error) {
      throw new Error(`Échec de l'upload du logo (Cloudinary) : ${(error as Error).message}`);
    }
  }
}
