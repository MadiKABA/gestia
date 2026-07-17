import { ValidationError } from "@/domain/shared/errors";

export type ProductType = "PRODUIT" | "SERVICE";

export type ProductUnit =
  | "PIECE"
  | "KILOGRAMME"
  | "GRAMME"
  | "LITRE"
  | "MILLILITRE"
  | "SAC"
  | "CARTON"
  | "DOUZAINE"
  | "METRE"
  | "PAQUET"
  | "BOITE"
  | "BOUTEILLE"
  | "SACHET"
  | "ROULEAU"
  | "PAIRE"
  | "LOT"
  | "AUTRE";

export type Product = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  type: ProductType;
  price: number;
  unit: ProductUnit | null;
  trackStock: boolean;
  stockQuantity: number | null;
  barcode: string | null;
  photoUrl: string | null;
  categoryId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Photo sélectionnée localement (aperçu `createObjectURL` côté formulaire),
 * jamais persistée telle quelle. Consommée uniquement par le mutation-handler
 * serveur (infrastructure/product/product-mutation-handler.ts), qui l'upload
 * vers Cloudinary et pose `photoUrl` — jamais lue par un repository Prisma
 * directement. `undefined` sur `ProductInput.photo` = aucun changement de
 * photo (update sans toucher à l'existant) ; `null` = suppression explicite
 * de la photo existante. */
export type ProductPhoto = { mimeType: string; base64: string };

export type ProductInput = {
  name: string;
  description?: string | null;
  type: ProductType;
  price: number;
  unit?: ProductUnit | null;
  trackStock?: boolean;
  stockQuantity?: number | null;
  barcode?: string | null;
  categoryId?: string | null;
  photo?: ProductPhoto | null;
};

/**
 * Règles métier pures : `unit`/`stockQuantity`/`trackStock` n'ont de sens que
 * pour `type = PRODUIT` — un `SERVICE` n'a ni unité ni quantité ni suivi de
 * stock (cf. CLAUDE.md Scope V1). Appliqué ici, pas seulement en base
 * (`unit`/`stockQuantity` restent nullable côté Prisma pour autoriser un
 * PRODUIT sans unité renseignée, mais jamais pour un SERVICE).
 */
export function validateProductInput(input: ProductInput): void {
  if (!input.name.trim()) {
    throw new ValidationError("Le nom du produit est obligatoire");
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new ValidationError("Le prix doit être un nombre positif");
  }

  if (input.type === "SERVICE") {
    if (input.unit != null) {
      throw new ValidationError("Un service n'a pas d'unité de mesure");
    }
    if (input.stockQuantity != null) {
      throw new ValidationError("Un service n'a pas de quantité en stock");
    }
    if (input.trackStock) {
      throw new ValidationError("Le suivi de stock n'est pas disponible pour un service");
    }
    return;
  }

  if (input.trackStock && input.stockQuantity == null) {
    throw new ValidationError(
      "La quantité en stock est obligatoire quand le suivi de stock est activé",
    );
  }
  if (!input.trackStock && input.stockQuantity != null) {
    throw new ValidationError("La quantité en stock ne peut être renseignée sans activer le suivi");
  }
}
